const { test, describe } = require('node:test');
const assert = require('assert');
const { getSecretkeeperInstructions } = require('../hooks/secretkeeper-instructions');
const { normalizeMode, getDefaultMode, DEFAULT_MODE } = require('../hooks/secretkeeper-config');

describe('secretkeeper-instructions', () => {
  test('returns instructions for full mode', () => {
    const text = getSecretkeeperInstructions('full');
    assert.ok(text.includes('SECRETKEEPER MODE ACTIVE'));
    assert.ok(text.includes('full'));
  });

  test('returns instructions for ultra mode', () => {
    const text = getSecretkeeperInstructions('ultra');
    assert.ok(text.includes('SECRETKEEPER MODE ACTIVE'));
  });

  test('handles scan mode as independent', () => {
    const text = getSecretkeeperInstructions('scan');
    assert.ok(text.includes('secretkeeper-scan'));
  });
});

describe('secretkeeper-config', () => {
  test('normalizes modes', () => {
    assert.equal(normalizeMode('FULL'), 'full');
    assert.equal(normalizeMode('invalid'), null);
  });

  test('has full as default', () => {
    assert.equal(DEFAULT_MODE, 'full');
    assert.equal(getDefaultMode(), 'full');
  });
});
