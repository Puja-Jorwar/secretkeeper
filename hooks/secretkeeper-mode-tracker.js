#!/usr/bin/env node
// SecretKeeper — track /secretkeeper mode switches from user prompts

const { normalizePersistedMode } = require('./secretkeeper-config');
const { setMode, clearMode, writeHookOutput } = require('./secretkeeper-runtime');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim();

    const match = prompt.match(/^\/secretkeeper(?:\s+(\S+))?/i);
    if (!match) {
      process.stdout.write(JSON.stringify({}));
      return;
    }

    const mode = normalizePersistedMode(match[1] || 'full') || 'full';
    if (mode === 'off') {
      clearMode();
    } else {
      setMode(mode);
    }

    writeHookOutput('UserPromptSubmit', mode, '');
  } catch (e) {
    process.stdout.write(JSON.stringify({}));
  }
});
