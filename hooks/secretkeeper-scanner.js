#!/usr/bin/env node
// secretkeeper — deterministic secret scanner (regex + entropy)
// Zero dependencies. Same logic used by CLI, hooks, and benchmarks.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
];

const PATTERNS = [
  {
    id: 'aws-access-key',
    label: 'AWS Access Key ID',
    severity: 'critical',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
  },
  {
    id: 'aws-secret-key',
    label: 'AWS Secret Access Key',
    severity: 'critical',
    regex: /(?:aws[_-]?secret[_-]?access[_-]?key|secret[_-]?access[_-]?key)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
  },
  {
    id: 'github-pat',
    label: 'GitHub Personal Access Token',
    severity: 'critical',
    regex: /\b(ghp_[A-Za-z0-9]{36,})\b/g,
  },
  {
    id: 'github-oauth',
    label: 'GitHub OAuth Token',
    severity: 'critical',
    regex: /\b(gho_[A-Za-z0-9]{36,})\b/g,
  },
  {
    id: 'github-app',
    label: 'GitHub App Token',
    severity: 'critical',
    regex: /\b((?:ghu|ghs)_[A-Za-z0-9]{36,})\b/g,
  },
  {
    id: 'gitlab-pat',
    label: 'GitLab Personal Access Token',
    severity: 'critical',
    regex: /\b(glpat-[A-Za-z0-9\-_]{20,})\b/g,
  },
  {
    id: 'openai-key',
    label: 'OpenAI API Key',
    severity: 'critical',
    regex: /\b(sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,})\b/g,
  },
  {
    id: 'anthropic-key',
    label: 'Anthropic API Key',
    severity: 'critical',
    regex: /\b(sk-ant-[A-Za-z0-9\-_]{20,})\b/g,
  },
  {
    id: 'stripe-key',
    label: 'Stripe API Key',
    severity: 'critical',
    regex: /\b((?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,})\b/g,
  },
  {
    id: 'twilio-key',
    label: 'Twilio API Key',
    severity: 'critical',
    regex: /\b(SK[0-9a-fA-F]{32})\b/g,
  },
  {
    id: 'sendgrid-key',
    label: 'SendGrid API Key',
    severity: 'critical',
    regex: /\b(SG\.[A-Za-z0-9_\-]{22,}\.[A-Za-z0-9_\-]{22,})\b/g,
  },
  {
    id: 'slack-token',
    label: 'Slack Token',
    severity: 'critical',
    regex: /\b(xox[baprs]-[A-Za-z0-9\-]{10,})\b/g,
  },
  {
    id: 'npm-token',
    label: 'npm Access Token',
    severity: 'critical',
    regex: /\b(npm_[A-Za-z0-9]{36,})\b/g,
  },
  {
    id: 'google-api-key',
    label: 'Google API Key',
    severity: 'high',
    regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
  },
  {
    id: 'azure-connection',
    label: 'Azure Connection String',
    severity: 'critical',
    regex: /(DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{40,})/gi,
  },
  {
    id: 'jwt-secret',
    label: 'JWT Signing Secret',
    severity: 'high',
    regex: /(?:jwt[_-]?(?:secret|key|signing[_-]?key)|signing[_-]?secret)\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
  },
  {
    id: 'oauth-client-secret',
    label: 'OAuth Client Secret',
    severity: 'high',
    regex: /(?:client[_-]?secret|oauth[_-]?secret)\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
  },
  {
    id: 'hardcoded-password',
    label: 'Hardcoded Password',
    severity: 'high',
    regex: /(?:password|passwd|pwd)\s*[=:]\s*['"]([^'"]{4,})['"]/gi,
  },
  {
    id: 'database-url',
    label: 'Database Connection String',
    severity: 'critical',
    regex: /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+)\b/gi,
  },
  {
    id: 'private-key',
    label: 'Private Key',
    severity: 'critical',
    regex: /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/g,
  },
  {
    id: 'generic-api-key',
    label: 'Generic API Key Assignment',
    severity: 'medium',
    regex: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[=:]\s*['"]([A-Za-z0-9_\-./+=]{16,})['"]/gi,
  },
];

// Sensitive data logged to console/debugger — leaks in browser DevTools at runtime
const SENSITIVE_NAME =
  /\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|refresh[_-]?token|auth[_-]?token|password|passwd|pwd|jwt(?:[_-]?secret)?|private[_-]?key|client[_-]?secret|credentials?|session[_-]?token|bearer(?:[_-]?token)?|stripe[_-]?key|openai[_-]?key|aws[_-]?(?:secret|key)|database[_-]?url|connection[_-]?string)\b/i;

const CONSOLE_LOG_PATTERNS = [
  {
    id: 'console-log-sensitive',
    label: 'Secret Logged to Console (runtime leak)',
    severity: 'high',
    regex:
      /(?:console\.(?:log|debug|info|warn|error|trace|dir)|print|logger\.(?:debug|info|warn|error|trace)|(?:debug|info|warn|error|trace)(?:\.log)?)\s*\([^)]*(?:api[_-]?key|secret|token|password|credential|jwt|private[_-]?key|auth[_-]?header|bearer)[^)]*\)/gi,
  },
  {
    id: 'console-log-env-secret',
    label: 'Env Secret Logged to Console (runtime leak)',
    severity: 'critical',
    regex:
      /(?:console\.(?:log|debug|info|warn|error|trace|dir)|print|logger\.(?:debug|info|warn|error|trace))\s*\([^)]*process\.env\.[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*[^)]*\)/gi,
  },
  {
    id: 'console-log-env-python',
    label: 'Env Secret Logged (Python print/logger)',
    severity: 'critical',
    regex:
      /(?:print|logger\.(?:debug|info|warning|error))\s*\([^)]*os\.environ\[[^\]]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[^\]]*\][^)]*\)/gi,
  },
];

const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /^example[-_]/i,
  /^(changeme|placeholder|replace_me|insert_|sample_|test_|fake|dummy|todo|xxx)$/i,
  /^\$\{/,
  /process\.env/i,
  /^<[^>]+>$/,
];

// Well-known documentation example values (not real secrets, but skip in audits)
const KNOWN_DOC_EXAMPLES = new Set([
  'akiaiosfodnn7example',
  'wfjahfjkahfjkwbfjqwbfjqwbfj', // AWS secret key doc example
]);

function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isLikelyPlaceholder(value) {
  const str = String(value).trim();
  const lower = str.toLowerCase();
  if (KNOWN_DOC_EXAMPLES.has(lower)) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(str) || p.test(lower));
}

function redact(value) {
  const str = String(value);
  if (str.length <= 8) return '***';
  return str.slice(0, 4) + '…' + str.slice(-4);
}

function loadIgnorePatterns(rootDir) {
  const patterns = [];
  const ignorePath = path.join(rootDir, '.secretkeeperignore');
  if (!fs.existsSync(ignorePath)) return patterns;

  const lines = fs.readFileSync(ignorePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    patterns.push(trimmed);
  }
  return patterns;
}

function matchesIgnore(filePath, ignorePatterns) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of [...DEFAULT_IGNORE, ...ignorePatterns]) {
    const p = pattern.replace(/\\/g, '/');
    if (p.endsWith('/')) {
      if (normalized.startsWith(p) || normalized.includes('/' + p)) return true;
    } else {
      if (
        normalized === p ||
        normalized.startsWith(p + '/') ||
        normalized.includes('/' + p + '/') ||
        normalized.endsWith('/' + p)
      ) {
        return true;
      }
    }
  }
  return false;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function scanConsoleLeaks(content, filePath, findings, seen) {
  for (const pattern of CONSOLE_LOG_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const key = `${pattern.id}:${filePath}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        id: pattern.id,
        label: pattern.label,
        severity: pattern.severity,
        file: filePath,
        line: lineNumberAt(content, match.index),
        match: redact(match[0].slice(0, 80)),
        rawLength: match[0].length,
      });
    }
  }

  // Catch console.log(variable) where variable name is sensitive
  const logCallRegex =
    /(?:console\.(?:log|debug|info|warn|error|trace|dir)|print|logger\.(?:debug|info|warn|error|trace))\s*\(\s*([a-zA-Z_$][\w$]*)\s*\)/g;
  let logMatch;
  while ((logMatch = logCallRegex.exec(content)) !== null) {
    const varName = logMatch[1];
    if (!SENSITIVE_NAME.test(varName)) continue;
    if (/^(err|error|message|msg|text|data|result|response|status|count|index|i|j|k|n)$/i.test(varName)) continue;

    const key = `console-log-var:${filePath}:${logMatch.index}`;
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      id: 'console-log-variable',
      label: 'Sensitive Variable Logged to Console (runtime leak)',
      severity: 'high',
      file: filePath,
      line: lineNumberAt(content, logMatch.index),
      match: `${logMatch[0].slice(0, 40)}…`,
      rawLength: logMatch[0].length,
    });
  }
}

function scanContent(content, filePath = '<inline>') {
  const findings = [];
  const seen = new Set();

  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const raw = match[1] || match[0];
      if (!raw || isLikelyPlaceholder(raw)) continue;

      const key = `${pattern.id}:${filePath}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        id: pattern.id,
        label: pattern.label,
        severity: pattern.severity,
        file: filePath,
        line: lineNumberAt(content, match.index),
        match: redact(raw),
        rawLength: raw.length,
      });
    }
  }

  // High-entropy fallback for unlabeled secrets (min 20 chars, entropy > 4.5)
  const entropyRegex = /['"]([A-Za-z0-9+/=_\-]{20,})['"]/g;
  let entMatch;
  while ((entMatch = entropyRegex.exec(content)) !== null) {
    const raw = entMatch[1];
    if (isLikelyPlaceholder(raw)) continue;
    if (shannonEntropy(raw) < 4.5) continue;
    if (/^(true|false|null|undefined|password|secret|example)$/i.test(raw)) continue;

    const key = `high-entropy:${filePath}:${entMatch.index}`;
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      id: 'high-entropy',
      label: 'High-Entropy String (possible secret)',
      severity: 'medium',
      file: filePath,
      line: lineNumberAt(content, entMatch.index),
      match: redact(raw),
      rawLength: raw.length,
      entropy: Number(shannonEntropy(raw).toFixed(2)),
    });
  }

  scanConsoleLeaks(content, filePath, findings, seen);

  return findings;
}

function walkFiles(dir, ignorePatterns, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
    if (matchesIgnore(rel, ignorePatterns)) continue;
    if (entry.isDirectory()) {
      walkFiles(full, ignorePatterns, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const binary = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.exe', '.dll', '.so', '.dylib', '.bin']);
  return !binary.has(ext);
}

function scanFile(filePath) {
  if (!isTextFile(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return scanContent(content, rel);
  } catch (e) {
    return [];
  }
}

function scanDirectory(rootDir = process.cwd()) {
  const ignorePatterns = loadIgnorePatterns(rootDir);
  const files = walkFiles(rootDir, ignorePatterns);
  const findings = [];
  for (const file of files) {
    findings.push(...scanFile(file));
  }
  return findings;
}

function scanGitDiff(rootDir = process.cwd()) {
  try {
    const diff = execSync('git diff HEAD', { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const staged = execSync('git diff --cached', { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const combined = diff + '\n' + staged;
    return scanContent(combined, '<git-diff>');
  } catch (e) {
    return [];
  }
}

function scanGitHistory(rootDir = process.cwd(), maxCommits = 500) {
  const findings = [];
  const seen = new Set();

  try {
    const log = execSync(`git log -p -${maxCommits}`, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    });

    const parts = log.split(/^commit ([a-f0-9]{40})/m);
    for (let i = 1; i < parts.length; i += 2) {
      const sha = parts[i].slice(0, 7);
      const block = parts[i + 1] || '';

      const addedLines = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.slice(1))
        .join('\n');

      for (const finding of scanContent(addedLines, `<git-history:${sha}>`)) {
        const key = `${finding.id}:${finding.line}:${finding.match}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ ...finding, commit: sha });
      }
    }
  } catch (e) {
    // not a git repo or git unavailable
  }

  return findings;
}

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
};

function formatFindings(findings) {
  if (findings.length === 0) {
    return `${colors.green}${colors.bold}No secret leaks detected.${colors.reset}`;
  }

  const lines = [`Found ${findings.length} potential secret leak(s):\n`];
  for (const f of findings) {
    let severityColor = colors.reset;
    if (f.severity === 'critical') severityColor = colors.red + colors.bold;
    else if (f.severity === 'high') severityColor = colors.yellow + colors.bold;
    else if (f.severity === 'medium') severityColor = colors.cyan;

    const commit = f.commit ? ` [commit ${f.commit}]` : '';
    lines.push(`  [${severityColor}${f.severity.toUpperCase()}${colors.reset}] ${colors.bold}${f.label}${colors.reset}${commit}`);
    lines.push(`    ${colors.gray}${f.file}:${f.line}${colors.reset} → ${colors.red}${f.match}${colors.reset}`);
  }
  return lines.join('\n');
}

function getEnvVarNameForPattern(id) {
  const mapping = {
    'aws-access-key': 'AWS_ACCESS_KEY_ID',
    'aws-secret-key': 'AWS_SECRET_ACCESS_KEY',
    'github-pat': 'GITHUB_TOKEN',
    'github-oauth': 'GITHUB_TOKEN',
    'github-app': 'GITHUB_APP_TOKEN',
    'gitlab-pat': 'GITLAB_TOKEN',
    'openai-key': 'OPENAI_API_KEY',
    'anthropic-key': 'ANTHROPIC_API_KEY',
    'stripe-key': 'STRIPE_SECRET_KEY',
    'twilio-key': 'TWILIO_AUTH_TOKEN',
    'sendgrid-key': 'SENDGRID_API_KEY',
    'slack-token': 'SLACK_BOT_TOKEN',
    'npm-token': 'NPM_TOKEN',
    'google-api-key': 'GOOGLE_API_KEY',
    'jwt-secret': 'JWT_SECRET',
    'oauth-client-secret': 'OAUTH_CLIENT_SECRET',
    'hardcoded-password': 'PASSWORD',
    'database-url': 'DATABASE_URL',
  };
  return mapping[id] || null;
}

function updateEnvExample(rootDir) {
  const examplePath = path.join(rootDir, '.env.example');
  let content = '';
  if (fs.existsSync(examplePath)) {
    content = fs.readFileSync(examplePath, 'utf8');
  }

  const envVarRegex = /(?:process\.env\.([A-Z0-9_]+)|os\.environ\.get\(['"]([A-Z0-9_]+)['"]\))/g;
  const foundVars = new Set();

  const ignorePatterns = loadIgnorePatterns(rootDir);
  const files = walkFiles(rootDir, ignorePatterns);

  for (const file of files) {
    if (!isTextFile(file) || file.endsWith('.env.example') || file.endsWith('.env')) continue;
    try {
      const fileContent = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = envVarRegex.exec(fileContent)) !== null) {
        foundVars.add(match[1] || match[2]);
      }
    } catch (e) {}
  }

  let modified = false;
  for (const envVar of foundVars) {
    if (!content.includes(`${envVar}=`)) {
      content += `\n# Added by SecretKeeper\n${envVar}=your_${envVar.toLowerCase()}_here\n`;
      modified = true;
    }
  }

  if (modified || !fs.existsSync(examplePath)) {
    fs.writeFileSync(examplePath, content.trim() + '\n', 'utf8');
  }
}

function fixFile(filePath) {
  if (!isTextFile(filePath)) return false;
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    const ext = path.extname(filePath).toLowerCase();
    const isPython = ext === '.py';

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      const envVar = getEnvVarNameForPattern(pattern.id);
      if (!envVar) continue;

      const replacement = isPython ? `os.environ.get('${envVar}')` : `process.env.${envVar}`;

      content = content.replace(pattern.regex, (fullMatch, group1) => {
        const raw = group1 || fullMatch;
        if (isLikelyPlaceholder(raw)) return fullMatch;
        modified = true;
        if (group1) {
          return fullMatch.replace(group1, replacement);
        }
        return replacement;
      });
    }

    if (modified) {
      // Cleanup: strip quotes surrounding process.env.VAR or os.environ.get('VAR') references
      content = content.replace(/['"]process\.env\.([A-Z0-9_]+)['"]/g, 'process.env.$1');
      content = content.replace(/['"]os\.environ\.get\(['"]([A-Z0-9_]+)['"]\)['"]/g, "os.environ.get('$1')");

      fs.writeFileSync(filePath, content, 'utf8');
      updateEnvExample(process.cwd());
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

module.exports = {
  PATTERNS,
  CONSOLE_LOG_PATTERNS,
  scanContent,
  scanFile,
  scanDirectory,
  scanGitDiff,
  scanGitHistory,
  formatFindings,
  shannonEntropy,
  isLikelyPlaceholder,
  redact,
  loadIgnorePatterns,
  matchesIgnore,
  fixFile,
  updateEnvExample,
};
