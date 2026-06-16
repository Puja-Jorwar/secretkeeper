#!/usr/bin/env node
// SecretKeeper — PostToolUse hook
// Scans files AFTER the agent writes/edits them. Does not block writes.
// Injects findings into agent context so it fixes leaks before continuing.

const fs = require('fs');
const path = require('path');
const { getDefaultMode, normalizeMode } = require('./secretkeeper-config');
const { scanFile, formatFindings } = require('./secretkeeper-scanner');
const { readMode, writePostToolContext } = require('./secretkeeper-runtime');

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.java', '.kt', '.php',
  '.vue', '.svelte', '.json', '.yaml', '.yml',
  '.toml', '.env', '.sh', '.bash', '.ps1',
  '.cs', '.rs', '.swift', '.dart',
]);

function getActiveMode() {
  return normalizeMode(readMode()) || getDefaultMode();
}

function extractFilePath(event) {
  const input = event.tool_input || event.toolInput || {};
  return input.file_path || input.filePath || input.path || null;
}

function isScannableFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || ext === '';
}

function buildFixMessage(filePath, findings, mode) {
  const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const header =
    'SECRETKEEPER POST-WRITE SCAN — fix these before continuing.\n' +
    `File: ${rel}\n` +
    'Do NOT leave hardcoded secrets or console.log leaks in this file.\n\n';

  const body = formatFindings(findings);

  const footer =
    mode === 'lite'
      ? '\n\nAction (lite): report these leaks to the user and suggest fixes.'
      : mode === 'ultra'
        ? '\n\nAction (ultra): fix ALL findings in this file immediately. ' +
          'Remove console.log of secrets/tokens/keys. Replace hardcoded secrets with env vars. ' +
          'Do not proceed to other tasks until this file is clean.'
        : '\n\nAction (full): fix ALL findings in this file now. ' +
          'Remove console.log of sensitive data. Replace hardcoded secrets with env vars and update .env.example.';

  return header + body + footer;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input || '{}');
    const toolName = event.tool_name || event.toolName || '';

    if (!/^(Write|Edit|MultiEdit)$/i.test(toolName)) {
      process.stdout.write('{}');
      return;
    }

    const mode = getActiveMode();
    if (mode === 'off') {
      process.stdout.write('{}');
      return;
    }

    const filePath = extractFilePath(event);
    if (!isScannableFile(filePath)) {
      process.stdout.write('{}');
      return;
    }

    const findings = scanFile(filePath);
    if (findings.length === 0) {
      process.stdout.write('{}');
      return;
    }

    writePostToolContext(buildFixMessage(filePath, findings, mode));
  } catch (e) {
    process.stdout.write('{}');
  }
});
