import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSupported,
  __setProtocolVersionsForTest,
  UnsupportedClientVersionError,
} from './version-registry.js';

test('assertSupported: throws when protocol version not in installed list', () => {
  __setProtocolVersionsForTest(['1.21.0', '1.26.3']);
  assert.throws(
    () => assertSupported('1.26.13.1', {
      protocolVersion: '999.99',
      bdsVersion: '1.26.14.1',
      worldName: 'test',
      templateWorldPath: '',
      scenesWorldPath: '',
    }),
    UnsupportedClientVersionError,
  );
});

test('assertSupported: passes when protocol version is known', () => {
  __setProtocolVersionsForTest(['1.21.0', '1.26.3', '26.10']);
  assert.doesNotThrow(() =>
    assertSupported('1.26.13.1', {
      protocolVersion: '26.10',
      bdsVersion: '1.26.14.1',
      worldName: 'test',
      templateWorldPath: '',
      scenesWorldPath: '',
    }),
  );
});

test('assertSupported: when probe fails, warns and continues (does not throw)', () => {
  __setProtocolVersionsForTest(null);
  assert.doesNotThrow(() =>
    assertSupported('1.26.13.1', {
      protocolVersion: '26.10',
      bdsVersion: '1.26.14.1',
      worldName: 'test',
      templateWorldPath: '',
      scenesWorldPath: '',
    }),
  );
});
