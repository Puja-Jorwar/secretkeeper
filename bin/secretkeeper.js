#!/usr/bin/env node
// SecretKeeper CLI — scan, audit, history

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const {
  scanGitDiff,
  scanDirectory,
  scanGitHistory,
  formatFindings,
  fixFile,
} = require('../hooks/secretkeeper-scanner');

const args = process.argv.slice(2);
const hasFix = args.some(arg => arg.toLowerCase() === '--fix');
const cleanArgs = args.filter(arg => arg.toLowerCase() !== '--fix');

const command = (cleanArgs[0] || 'scan').toLowerCase();
const rootDir = cleanArgs[1] ? path.resolve(cleanArgs[1]) : process.cwd();

function getChangedFiles(dir) {
  try {
    const diff = execSync('git diff --name-only HEAD', { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const staged = execSync('git diff --cached --name-only', { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const files = new Set(
      (diff + '\n' + staged)
        .split(/\r?\n/)
        .map(f => f.trim())
        .filter(f => f && fs.existsSync(path.join(dir, f)))
        .map(f => path.resolve(dir, f))
    );
    return Array.from(files);
  } catch (e) {
    return [];
  }
}

function main() {
  let findings;

  switch (command) {
    case 'scan':
    case 'diff':
      findings = scanGitDiff(rootDir);
      if (hasFix && findings.length > 0) {
        console.log('SecretKeeper — Applying auto-fixes to diff...\n');
        const changedFiles = getChangedFiles(rootDir);
        let fixedCount = 0;
        for (const file of changedFiles) {
          if (fixFile(file)) {
            fixedCount++;
            console.log(`  Fixed: ${path.relative(rootDir, file)}`);
          }
        }
        if (fixedCount > 0) {
          findings = scanGitDiff(rootDir);
        }
      }
      console.log('SecretKeeper — diff scan\n');
      console.log(formatFindings(findings));
      process.exit(findings.length > 0 ? 1 : 0);
      break;

    case 'audit':
    case 'repo':
      findings = scanDirectory(rootDir);
      if (hasFix && findings.length > 0) {
        console.log('SecretKeeper — Applying auto-fixes...\n');
                const filesToFix = new Set(findings.map(f => path.resolve(process.cwd(), f.file)));
        let fixedCount = 0;
        for (const file of filesToFix) {
          if (fixFile(file)) {
            fixedCount++;
            console.log(`  Fixed: ${path.relative(process.cwd(), file)}`);
          }
        }
        if (fixedCount > 0) {
          findings = scanDirectory(rootDir);
        }
      }
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
  secretkeeper scan [dir] [--fix]   Scan git diff (staged + unstaged) and optionally fix
  secretkeeper audit [dir] [--fix]  Scan entire repository and optionally fix
  secretkeeper history [dir]        Scan git commit history

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
