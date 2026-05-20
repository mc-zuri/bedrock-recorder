import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  findAndLoadConfig,
  parseConfig,
  resolveVersionConfig,
  assertSupported,
  PacketDumpWriter,
  RelayBridge,
  launchBds,
  runFixture,
  type BdtConfig,
  type VersionConfig,
  type BdsHandle,
} from '@bdt/bds-adapter';
import { InputController } from '@bdt/native-input';
import { getFixture, expandOverlay, loadOverlay } from '@bdt/scenarios';
import type { Fixture, SimulationSequence, BedrockPlayerLike } from '@bdt/core';
// Importing the fixture barrel registers every fixture in the process-global registry.
import '@bdt/scenarios/dist/fixtures/index.js';

export interface RecordOptions {
  fixture?: string[];
  overlay?: string[];
  client?: string;
  out?: string;
  config?: string;
  bdsAutodownload?: boolean;
  keepServer?: boolean;
  legacy?: boolean;
}

export async function recordCommand(opts: RecordOptions): Promise<void> {
  if (!opts.fixture?.length && !opts.overlay?.length) {
    throw new Error('Pass at least one --fixture <name> or --overlay <path>.');
  }

  const { config, configPath } = opts.config
    ? await loadConfigFromPath(opts.config)
    : await findAndLoadConfig();
  console.log(`[bdt] loaded config from ${configPath}`);

  const { version, cfg: vcfg } = resolveVersionConfig(config, opts.client);
  console.log(`[bdt] client version: ${version} (protocol ${vcfg.protocolVersion}, BDS ${vcfg.bdsVersion})`);
  assertSupported(version, vcfg);

  const outDir = opts.out ?? config.dumpDir;
  await fs.mkdir(outDir, { recursive: true });

  // Resolve fixtures (registry lookups + overlay expansions) up front so we
  // fail before launching BDS if a name is wrong.
  const fixturesToRun: Fixture[] = [];
  for (const name of opts.fixture ?? []) {
    fixturesToRun.push(getFixture(name));
  }
  for (const overlayPath of opts.overlay ?? []) {
    const seq = await loadOverlay(overlayPath);
    const base = path.basename(overlayPath).replace(/\.overlay\.json$/, '');
    fixturesToRun.push({ name: base, sequences: [seq as SimulationSequence] });
  }

  console.log('[bdt] launching BDS …');
  // The bundled behavior_packs/ dir lives next to bdt.config.json (which
  // findAndLoadConfig already located by walking up from cwd). On launch,
  // each pack subdir is copied into BDS's development_behavior_packs/.
  const behaviorPacksDir = path.join(path.dirname(configPath), 'behavior_packs');

  const bds = await launchBds({
    config,
    versionConfig: vcfg,
    autoDownload: opts.bdsAutodownload !== false,
    behaviorPacksDir,
  });

  const input = new InputController();
  const abort = new AbortController();
  installSignalHandlers(abort);

  try {
    for (const fixture of fixturesToRun) {
      try {
        await runOneFixture(fixture, version, vcfg, config, bds, input, outDir, abort, !!opts.legacy);
      } catch (err) {
        if (abort.signal.aborted) {
          console.log(`[bdt] fixture '${fixture.name}' aborted (likely client disconnected).`);
        } else {
          throw err;
        }
      }
    }
  } finally {
    if (!opts.keepServer) {
      console.log('[bdt] stopping BDS …');
      await bds.stop();
    }
  }
  console.log('[bdt] done.');
}

async function runOneFixture(
  fixture: Fixture,
  clientVersion: string,
  vcfg: VersionConfig,
  config: BdtConfig,
  bds: BdsHandle,
  input: InputController,
  outDir: string,
  abort: AbortController,
  legacy: boolean,
): Promise<void> {
  const signal = abort.signal;
  const filename = path.join(outDir, `${clientVersion}-${fixture.name}.proxy.bin`);
  console.log(`[bdt] recording → ${filename}${legacy ? ' (legacy/v2 wire format)' : ''}`);
  const writer = PacketDumpWriter.toFile(clientVersion, filename, { legacy });

  const relay = new RelayBridge({
    host: config.relay.host,
    port: config.relay.port,
    bdsHost: bds.host,
    bdsPort: bds.port,
    username: config.relay.username,
    profilesFolder: config.relay.profilesFolder,
    versionConfig: vcfg,
  });

  try {
    // Start the relay listener and wait for the user to connect from
    // Minecraft. Self-contained build — no auto-launch / DLL injection.
    const connectPromise = relay.start(writer);
    console.log(`[bdt] waiting for client on ${config.relay.host}:${config.relay.port} …`);
    console.log(`[bdt]    (in Minecraft: Servers → Add Server → 127.0.0.1:${config.relay.port})`);

    const connection = await connectPromise;
    console.log('[bdt] client connected; waiting for player to spawn in world …');

    // If the client closes its window (or otherwise drops the connection),
    // abort the AbortController. That propagates into every executor wait —
    // the fixture rejects, the outer finally block kills BDS + Minecraft.
    // Without this hook, a hung waitUntil-* keeps the recorder alive forever
    // even after the player has left.
    connection.done.then(() => {
      if (!signal.aborted) {
        console.log('[bdt] client disconnected; aborting fixture.');
        abort.abort();
      }
    });

    // The relay's `connect` event fires when the bedrock-protocol handshake
    // completes — that's BEFORE the player has actually spawned in the BDS
    // world. If we `op` too early, BDS replies "No targets matched selector"
    // because no player is online yet. Wait for the BDS log line that
    // confirms the spawn.
    await bds.waitForOutput(/Player Spawned/, 30_000);
    console.log('[bdt] player spawned; waiting for chunk silence before opping …');

    // Even after spawn, BDS continues streaming chunks around the player for
    // several seconds. Op + commands sent mid-chunk-stream may target an area
    // that isn't loaded yet. Wait for 2 s of silence on clientbound chunk
    // packets so the world is in a steady state before we touch it. 500 ms
    // was too tight — first scenarios sometimes ran while subchunks were
    // still arriving (player visibly mid-falling-through-air on tick 0).
    await waitForChunkSilence(connection.player, 2_000, 60_000);
    console.log('[bdt] chunks settled; sending op @a.');
    await bds.sendCommand('op @a');
    // Small grace period for the op grant to propagate to the client's
    // permission state before the fixture's first command_request flies.
    await new Promise((r) => setTimeout(r, 1500));

    // `${PLAYER}` resolves to `@s` (the command's executor). For
    // `command_request` packets originating from a player, `@s` = that
    // player. Keeps recordings portable across Microsoft accounts — no
    // hardcoded usernames in commands or teleports.
    await runFixture(fixture, connection, writer, input, { PLAYER: '@s' }, signal);

    console.log('[bdt] fixture complete; closing relay.');
  } catch (err) {
    // Log the real error here — without this, a downstream packet listener
    // hitting the closed writer in the finally below used to crash the
    // process synchronously, masking the actual fixture failure.
    if (!signal.aborted) {
      console.error(`[bdt] fixture '${fixture.name}' failed:`, err);
    }
    throw err;
  } finally {
    // ORDER MATTERS: close the relay BEFORE the writer so the relay's
    // serverbound/clientbound listeners detach before we yank the writer
    // out from under them. Otherwise an in-flight packet arriving between
    // these two lines would synchronously hit a closed BinaryWriter and
    // crash the process.
    relay.close();
    writer.close();
  }
}

async function loadConfigFromPath(p: string): Promise<{ config: BdtConfig; configPath: string }> {
  const abs = path.resolve(p);
  const raw = await fs.readFile(abs, 'utf8');
  return { config: parseConfig(JSON.parse(raw)), configPath: abs };
}

/**
 * Wait until `silenceMs` of no chunk-related clientbound packets have arrived.
 * Defensive about bedrock-protocol's event shape: the runtime emits
 * `(packet, des)` where the packet name lives on either `packet.name` or
 * `des.data.name` depending on the release. We check both.
 *
 * Throws on `timeoutMs` exceeded (so a misconfigured world doesn't hang the
 * recorder forever).
 */
function waitForChunkSilence(player: BedrockPlayerLike, silenceMs: number, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let silenceTimer: NodeJS.Timeout | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (timeout) clearTimeout(timeout);
      player.removeListener('clientbound', listener);
    };

    const proceed = () => {
      cleanup();
      resolve();
    };

    const resetTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(proceed, silenceMs);
    };

    const listener = (a?: { name?: string }, b?: { data?: { name?: string } }) => {
      const name = a?.name ?? b?.data?.name;
      // `network_chunk_publisher_update` is sent roughly every PAI tick — it's
      // metadata, not chunk data — so we deliberately don't reset for it.
      if (name === 'subchunk' || name === 'level_chunk') {
        resetTimer();
      }
    };

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Chunk silence not reached within ${timeoutMs}ms`));
    }, timeoutMs);

    player.on('clientbound', listener);
    resetTimer();
  });
}

function installSignalHandlers(abort: AbortController): void {
  const onSignal = (sig: string) => {
    console.log(`\n[bdt] received ${sig}; aborting…`);
    abort.abort();
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));
}
