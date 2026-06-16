#!/usr/bin/env node
// Shared SecretKeeper instruction builder for hooks and plugins.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./secretkeeper-config');

const INDEPENDENT_MODES = new Set(['scan', 'audit', 'history']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'secretkeeper', 'SKILL.md');

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
      if (tableLabel) {
        const labelMode = normalizeMode(tableLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      const exampleLabel = line.match(/^-\s*([^:]+):\s*/);
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      return true;
    })
    .join('\n');
}

function getFallbackInstructions(mode) {
  return (
    'SECRETKEEPER MODE ACTIVE — level: ' + mode + '\n\n' +
    'You are a paranoid security engineer who has seen every credential leak in production. ' +
    'Never hardcode secrets. Ever.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift. Off only: "stop secretkeeper" / "normal mode".\n\n' +
    'Current level: **' + mode + '**. Switch: `/secretkeeper lite|full|ultra`.\n\n' +
    '## Before Any Code\n\n' +
    '1. Does this touch credentials, tokens, or keys? Use environment variables.\n' +
    '2. Am I about to write a literal API key, password, or connection string? Stop. Use `process.env.X` / `os.environ`.\n' +
    '3. Is there a `.env.example` with placeholder values? Create one if missing.\n' +
    '4. Are secrets in `.gitignore`? Verify before writing.\n' +
    '5. Run the scanner mentally: would SecretKeeper flag this?\n\n' +
    '## Rules\n\n' +
    '- No hardcoded API keys, passwords, JWT secrets, OAuth client secrets, or private keys.\n' +
    '- Use environment variables or secret managers (Vault, AWS Secrets Manager, etc.).\n' +
    '- Never log secrets. Redact in error messages.\n' +
    '- Mark env var names with a `secretkeeper:` comment when non-obvious.\n\n' +
    '## When NOT to block\n\n' +
    'Test fixtures explicitly in `.secretkeeperignore`, documented example placeholders, ' +
    'and values the user explicitly asked to keep as literals.\n\n' +
    'The only secret in code is the one that never gets written.'
  );
}

function getSecretkeeperInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;

  if (INDEPENDENT_MODES.has(configuredMode)) {
    return (
      'SECRETKEEPER MODE ACTIVE — level: ' + configuredMode +
      '. Behavior defined by /secretkeeper-' + configuredMode + ' command.'
    );
  }

  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;

  try {
    return (
      'SECRETKEEPER MODE ACTIVE — level: ' + effectiveMode + '\n\n' +
      filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), effectiveMode)
    );
  } catch (e) {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = {
  filterSkillBodyForMode,
  getFallbackInstructions,
  getSecretkeeperInstructions,
};
