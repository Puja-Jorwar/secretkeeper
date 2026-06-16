// SecretKeeper — OpenCode plugin
//
// Injects ruleset into every chat's system prompt and persists mode switches.
// Add to opencode.json: { "plugin": ["./.opencode/plugins/secretkeeper.mjs"] }

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { getSecretkeeperInstructions } = require('../../hooks/secretkeeper-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/secretkeeper-config');
const { scanGitDiff, formatFindings } = require('../../hooks/secretkeeper-scanner');

const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.secretkeeper-active',
);

function readMode() {
  try {
    return normalizePersistedMode(fs.readFileSync(statePath, 'utf8').trim()) || getDefaultMode();
  } catch (e) {
    return getDefaultMode();
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

export default async ({ client } = {}) => {
  const log = (level, message) => {
    try {
      client && client.app && client.app.log({ body: { service: 'secretkeeper', level, message } });
    } catch (e) {}
  };

  return {
    'experimental.chat.system.transform': async (_input, output) => {
      const mode = readMode();
      if (mode === 'off') return;

      let instructions = getSecretkeeperInstructions(mode);

      const diffFindings = scanGitDiff(process.cwd());
      if (diffFindings.length > 0) {
        instructions += '\n\n## Scanner Alert\n\n' + formatFindings(diffFindings);
      }

      output.system.push(instructions);
    },

    'command.execute.before': async (input) => {
      if (!input || input.command !== 'secretkeeper') return;
      const mode = normalizePersistedMode((input.arguments || '').trim()) || getDefaultMode();
      writeMode(mode);
      log('info', 'secretkeeper ' + mode);
    },
  };
};
