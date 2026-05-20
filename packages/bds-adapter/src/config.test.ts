import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, resolveVersionConfig } from './config.js';

const goodConfig = {
  defaultVersion: '1.26.13.1',
  versions: {
    '1.26.13.1': {
      protocolVersion: '26.10',
      bdsVersion: '1.26.14.1',
      worldName: 'template',
      templateWorldPath: './template',
      scenesWorldPath: './scenes',
    },
  },
  dumpDir: './dumps',
  relay: {
    host: '0.0.0.0',
    port: 19150,
    username: 'me',
    profilesFolder: './profiles',
  },
  bdsPaths: {
    base: './bds',
  },
};

test('parseConfig: accepts a well-formed config', () => {
  const cfg = parseConfig(goodConfig);
  assert.equal(cfg.defaultVersion, '1.26.13.1');
  assert.equal(cfg.bdsPaths.base, './bds');
});

test('parseConfig: rejects missing required fields', () => {
  const bad = { ...goodConfig } as Record<string, unknown>;
  delete bad.defaultVersion;
  assert.throws(() => parseConfig(bad));
});

test('resolveVersionConfig: returns the default version when none specified', () => {
  const cfg = parseConfig(goodConfig);
  const { version, cfg: vcfg } = resolveVersionConfig(cfg);
  assert.equal(version, '1.26.13.1');
  assert.equal(vcfg.protocolVersion, '26.10');
});

test('resolveVersionConfig: errors with the list of valid versions', () => {
  const cfg = parseConfig(goodConfig);
  assert.throws(
    () => resolveVersionConfig(cfg, 'nonexistent'),
    /Configured versions: 1\.26\.13\.1/,
  );
});
