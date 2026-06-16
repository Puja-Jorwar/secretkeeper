#!/usr/bin/env node
// SecretKeeper — Claude Code SessionStart activation hook

const { getDefaultMode } = require('./secretkeeper-config');
const { getSecretkeeperInstructions } = require('./secretkeeper-instructions');
const { scanGitDiff, formatFindings } = require('./secretkeeper-scanner');
const {
  clearMode,
  isCodex,
  setMode,
  writeHookOutput,
} = require('./secretkeeper-runtime');

const mode = getDefaultMode();

if (mode === 'off') {
  clearMode();
  writeHookOutput('SessionStart', 'off', isCodex ? '' : 'OK');
  process.exit(0);
}

try {
  setMode(mode);
} catch (e) {
  // best-effort
}

let output = getSecretkeeperInstructions(mode);

// Deterministic scan of current diff on session start
const diffFindings = scanGitDiff(process.cwd());
if (diffFindings.length > 0) {
  output += '\n\n## Scanner Alert (deterministic)\n\n';
  output += 'The SecretKeeper scanner found secrets in your current git diff:\n\n';
  output += formatFindings(diffFindings);
  output += '\n\nFix these before committing. Replace literals with environment variables.';
}

writeHookOutput('SessionStart', mode, output);
