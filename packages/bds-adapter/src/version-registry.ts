/**
 * Bridges our client-version strings (e.g. "1.26.13.1") to:
 *   - the bedrock-protocol `protocolVersion` it expects ("26.10")
 *   - the BDS server version to download/launch
 *
 * Replaces v2's hardcoded `configs` object at `recorder/src/main.ts:115-152`.
 *
 * `assertSupported(version)` fails *loudly* before we spin up BDS — better than
 * letting `bedrock-protocol`'s Relay silent-downgrade on a partial match.
 */

import type { VersionConfig } from './config.js';

// 3-state cache:
//   undefined          → not yet probed
//   null               → probed, failed (or test-injected "probe failed")
//   string[]           → probed, succeeded
let cachedProtocolVersions: string[] | null | undefined;

/**
 * Probe the bedrock-protocol installation for known protocol versions.
 * Returns null if the file isn't present in this layout (older releases vary).
 */
function loadProtocolVersions(): string[] | null {
  if (cachedProtocolVersions !== undefined) return cachedProtocolVersions;
  try {
    // bedrock-protocol's options.js exports a `Versions` map (Minecraft
    // version string → numeric protocol). Probe it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const opts = require('bedrock-protocol/src/options.js') as { Versions?: Record<string, number> };
    if (opts.Versions) {
      cachedProtocolVersions = Object.keys(opts.Versions);
      return cachedProtocolVersions;
    }
  } catch {
    // fall through
  }
  cachedProtocolVersions = null;
  return null;
}

/**
 * For tests:
 *   - `string[]` → pretend the probe returned this list
 *   - `null`     → pretend the probe failed (returns null, function skips check)
 *   - `undefined` → reset cache so the next call re-probes for real
 */
export function __setProtocolVersionsForTest(list: string[] | null | undefined): void {
  cachedProtocolVersions = list;
}

export class UnsupportedClientVersionError extends Error {
  constructor(clientVersion: string, protocolVersion: string, known: string[] | null) {
    const knownStr = known ? `\nKnown protocol versions in your bedrock-protocol install: ${known.join(', ')}` : '';
    super(
      `Client version '${clientVersion}' requested protocolVersion '${protocolVersion}', which is not listed in your installed bedrock-protocol.${knownStr}\n` +
        `Either pin a bedrock-protocol release that includes this version, or update bdt.config.json so the protocolVersion matches an installed one.`,
    );
    this.name = 'UnsupportedClientVersionError';
  }
}

/**
 * Verify the configured `protocolVersion` is one bedrock-protocol can speak.
 * Returns silently on success, throws `UnsupportedClientVersionError` on miss.
 *
 * When the probe can't load bedrock-protocol's versions file (older releases),
 * we *log a warning and continue* — better than blocking the user from a working
 * recording over a metadata probe.
 */
export function assertSupported(clientVersion: string, config: VersionConfig): void {
  const known = loadProtocolVersions();
  if (known === null) {
    console.warn(
      `[bdt] Could not probe bedrock-protocol's versions.json. Skipping the version check; ` +
      `if the Relay errors with "Unknown version", check your bedrock-protocol install.`,
    );
    return;
  }
  if (!known.includes(config.protocolVersion)) {
    throw new UnsupportedClientVersionError(clientVersion, config.protocolVersion, known);
  }
}
