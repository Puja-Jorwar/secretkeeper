#!/usr/bin/env node
// SecretKeeper CLI — scan, audit, history

const path = require('path');
const {
  scanGitDiff,
  scanDirectory,
  scanGitHistory,
  formatFindings,
} = require('../hooks/secretkeeper-scanner');

const command = (process.argv[2] || 'scan').toLowerCase();
const rootDir = process.argv[3] ? path.resolve(process.argv[3]) : process.cwd();

function main() {
  let findings;

  switch (command) {
    case 'scan':
    case 'diff':
      findings = scanGitDiff(rootDir);
      console.log('SecretKeeper — diff scan\n');
      console.log(formatFindings(findings));
      process.exit(findings.length > 0 ? 1 : 0);
      break;

    case 'audit':
    case 'repo':
      findings = scanDirectory(rootDir);
      console.log('SecretKeeper — repo audit\n');
      console.log(formatFindings(findings));
      process.exit(findings.length > 0 ? 1 : 0);
      break;

    case 'history':
    case 'log':
      findings = scanGitHistory(rootDir);
      console.log('SecretKeeper — git history scan\n');
      console.log(formatFindings(findings));
      process.exit(findings.length > 0 ? 1 : 0);
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(`SecretKeeper — stop secret leaks

Usage:
  secretkeeper scan [dir]     Scan git diff (staged + unstaged)
  secretkeeper audit [dir]    Scan entire repository
  secretkeeper history [dir]  Scan git commit history

Environment:
  SECRETKEEPER_DEFAULT_MODE   Default agent mode (lite|full|ultra|off)

Exit codes:
  0 = no secrets found
  1 = secrets detected
`);
      process.exit(0);
      break;

    default:
      console.error(`Unknown command: ${command}\nRun: secretkeeper help`);
      process.exit(2);
  }
}

main();
