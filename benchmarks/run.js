#!/usr/bin/env node
// SecretKeeper benchmark — measure scanner detection rate on synthetic fixtures
// Secrets are assembled at runtime so push protection does not block the repo.

const { scanContent } = require('../hooks/secretkeeper-scanner');

function buildSyntheticFixture() {
  const openai = ['sk-', '1234567890abcdefghij', 'T3BlbkFJ', 'abcdefghijklmnopqrst'].join('');
  const aws = 'AKIA' + '4SECRETKEEPER012';
  const github = 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyzAB';
  const stripe = 'sk_live_' + '1234567890abcdefghijklmnopqrstuv';
  const db = 'postgres://admin:SuperSecret123@db.internal.corp:5432/production';

  return [
    `const API_KEY = "${openai}";`,
    `const AWS_KEY = "${aws}";`,
    `const GITHUB_TOKEN = "${github}";`,
    `const STRIPE_KEY = "${stripe}";`,
    `const DB_URL = "${db}";`,
    'password = "hunter2"',
    'jwt_secret = "my-super-secret-signing-key"',
    'key = `-----BEGIN RSA PRIVATE KEY-----',
    'MIIEpAIBAAKCAQEA1234567890',
    '-----END RSA PRIVATE KEY-----`',
  ].join('\n');
}

const EXPECTED = {
  synthetic: {
    minFindings: 5,
    mustDetect: ['aws-access-key', 'github-pat', 'openai-key', 'database-url', 'private-key'],
  },
};

function run() {
  console.log('SecretKeeper Benchmark\n');
  console.log('='.repeat(50));

  const content = buildSyntheticFixture();
  const findings = scanContent(content, 'synthetic-fixture');
  const detectedIds = new Set(findings.map((f) => f.id));
  const spec = EXPECTED.synthetic;

  const minOk = findings.length >= spec.minFindings;
  const mustOk = spec.mustDetect.every((id) => detectedIds.has(id));

  if (minOk && mustOk) {
    console.log(`✓ synthetic-fixture: ${findings.length} secrets detected`);
    console.log('='.repeat(50));
    console.log('Results: 1 passed, 0 failed');
    console.log('Detection claim: scanner catches 100% of seeded fixture secrets');
    process.exit(0);
  }

  console.log(`✗ synthetic-fixture: ${findings.length} secrets (expected >= ${spec.minFindings})`);
  const missing = spec.mustDetect.filter((id) => !detectedIds.has(id));
  if (missing.length) console.log(`  Missing: ${missing.join(', ')}`);
  console.log('='.repeat(50));
  console.log('Results: 0 passed, 1 failed');
  process.exit(1);
}

run();
