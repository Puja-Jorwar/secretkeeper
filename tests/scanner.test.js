const { test, describe } = require('node:test');
const assert = require('assert');
const {
  scanContent,
  shannonEntropy,
  isLikelyPlaceholder,
  redact,
} = require('../hooks/secretkeeper-scanner');

describe('scanContent', () => {
  test('detects AWS access keys', () => {
    const findings = scanContent('const key = "AKIA4SECRETKEEPER012";');
    assert.ok(findings.some((f) => f.id === 'aws-access-key'));
  });

  test('detects GitHub PATs', () => {
    const token = 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyzAB';
    const findings = scanContent('token = "' + token + '"');
    assert.ok(findings.some((f) => f.id === 'github-pat'));
  });

  test('detects OpenAI keys', () => {
    const key = ['sk-', '1234567890abcdefghij', 'T3BlbkFJ', 'abcdefghijklmnopqrst'].join('');
    const findings = scanContent('OPENAI_API_KEY=' + key);
    assert.ok(findings.some((f) => f.id === 'openai-key'));
  });

  test('detects Stripe keys', () => {
    const key = 'sk_live_' + '1234567890abcdefghijklmnopqrstuv';
    const findings = scanContent('const stripe = "' + key + '";');
    assert.ok(findings.some((f) => f.id === 'stripe-key'));
  });

  test('detects database URLs with credentials', () => {
    const findings = scanContent('url = "postgres://user:secretpass@host:5432/db"');
    assert.ok(findings.some((f) => f.id === 'database-url'));
  });

  test('detects private keys', () => {
    const content = 'key = `-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----`';
    const findings = scanContent(content);
    assert.ok(findings.some((f) => f.id === 'private-key'));
  });

  test('detects hardcoded passwords', () => {
    const findings = scanContent('password = "hunter2"');
    assert.ok(findings.some((f) => f.id === 'hardcoded-password'));
  });

  test('detects JWT secrets', () => {
    const findings = scanContent('jwt_secret = "my-super-secret-signing-key"');
    assert.ok(findings.some((f) => f.id === 'jwt-secret'));
  });

  test('ignores placeholders', () => {
    const findings = scanContent('api_key = "your_api_key_here"');
    assert.equal(findings.length, 0);
  });

  test('ignores env var references', () => {
    const findings = scanContent('const key = process.env.OPENAI_API_KEY;');
    assert.equal(findings.length, 0);
  });
});

describe('helpers', () => {
  test('redacts values', () => {
    assert.equal(redact('abcdefghij'), 'abcd…ghij');
  });

  test('detects placeholders', () => {
    assert.ok(isLikelyPlaceholder('your_api_key_here'));
    assert.ok(!isLikelyPlaceholder('AKIA4SECRETKEEPER012'));
  });

  test('computes entropy', () => {
    assert.ok(shannonEntropy('aaaaaaaaaa') < 1);
    assert.ok(shannonEntropy('aB3$xY9!mN2@pQ7#wR4%') > 4);
  });
});

describe('benchmark fixture', () => {
  test('finds multiple secrets in synthetic fixture', () => {
    const openai = ['sk-', '1234567890abcdefghij', 'T3BlbkFJ', 'abcdefghijklmnopqrst'].join('');
    const github = 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyzAB';
    const content = [
      `const API_KEY = "${openai}";`,
      'const AWS_KEY = "AKIA' + '4SECRETKEEPER012";',
      `const GITHUB_TOKEN = "${github}";`,
      'url = "postgres://user:secretpass@host:5432/db"',
    ].join('\n');
    const findings = scanContent(content);
    assert.ok(findings.length >= 4, `Expected >= 4 findings, got ${findings.length}`);
  });
});
