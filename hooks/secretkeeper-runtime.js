#!/usr/bin/env node
// Shared runtime helpers for SecretKeeper hooks.

const fs = require('fs');
const path = require('path');
const { getClaudeDir } = require('./secretkeeper-config');

const isCodex = process.env.CODEX_PLUGIN_ROOT || process.env.CODEX_HOME;
const flagPath = path.join(getClaudeDir(), '.secretkeeper-active');

function setMode(mode) {
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, mode, 'utf8');
}

function clearMode() {
  try {
    fs.unlinkSync(flagPath);
  } catch (e) {
    // ignore
  }
}

function readMode() {
  try {
    return fs.readFileSync(flagPath, 'utf8').trim();
  } catch (e) {
    return null;
  }
}

function writeHookOutput(hookType, mode, context) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: hookType,
      additionalContext: context,
    },
  };

  if (isCodex) {
    process.stdout.write(context || '');
    return;
  }

  process.stdout.write(JSON.stringify(payload));
}

function writePostToolContext(context) {
  if (!context) {
    process.stdout.write('{}');
    return;
  }

  const payload = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: context,
    },
  };

  if (isCodex) {
    process.stdout.write(context);
    return;
  }

  process.stdout.write(JSON.stringify(payload));
}

module.exports = {
  isCodex: Boolean(isCodex),
  flagPath,
  setMode,
  clearMode,
  readMode,
  writeHookOutput,
  writePostToolContext,
};
