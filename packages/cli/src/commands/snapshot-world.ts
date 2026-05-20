import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  findAndLoadConfig,
  parseConfig,
  resolveVersionConfig,
  type BdtConfig,
} from '@bdt/bds-adapter';

export interface SnapshotWorldOptions {
  client?: string;
  config?: string;
  /** Destination template path. Default: versionConfig.templateWorldPath. */
  out?: string;
  /** Source — defaults to the BDS world dir derived from config + version. */
  from?: string;
  /** Allow overwriting an existing destination. */
  force?: boolean;
}

/**
 * Copy the BDS world directory to a reusable template path.
 *
 * Typical workflow:
 *   1. `bdt record --fixture shared_world_setup --client 1.26.13.1`
 *      → BDS materializes all 28 scenes and writes them to its world dir.
 *   2. `bdt snapshot-world --client 1.26.13.1`
 *      → copy that world dir to `versionConfig.templateWorldPath`.
 *   3. Subsequent `bdt record …` runs see `templateWorldPath` exists in
 *      config; `launchBds()` copies it into BDS's world dir on startup,
 *      guaranteeing every physics recording starts from the same blocks.
 */
export async function snapshotWorldCommand(opts: SnapshotWorldOptions): Promise<void> {
  const { config, configPath } = opts.config
    ? await loadConfigFromPath(opts.config)
    : await findAndLoadConfig();
  console.log(`[bdt] loaded config from ${configPath}`);

  const { version, cfg: vcfg } = resolveVersionConfig(config, opts.client);
  console.log(`[bdt] client version: ${version}`);

  const src = opts.from ?? path.join(config.bdsPaths.base, `bds-${vcfg.bdsVersion}`, 'worlds', vcfg.worldName);
  const dst = opts.out ?? vcfg.templateWorldPath;

  if (!fs.existsSync(src)) {
    throw new Error(
      `Source world not found at ${src}. Run a fixture against the live BDS first ` +
        `(e.g. 'bdt record --fixture shared_world_setup --client ${version}') so BDS has a world to snapshot.`,
    );
  }
  if (fs.existsSync(dst) && !opts.force) {
    throw new Error(
      `Destination ${dst} already exists. Pass --force to overwrite, or pick a different --out path.`,
    );
  }

  console.log(`[bdt] snapshotting ${src} → ${dst}`);
  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });

  // Report stats so the user sees that something real happened.
  const stats = summarize(dst);
  console.log(`[bdt] snapshot complete: ${stats.fileCount} files, ${formatBytes(stats.totalBytes)}`);
  console.log(
    `[bdt] future recordings for client ${version} will copy this template before BDS launch.`,
  );
}

async function loadConfigFromPath(p: string): Promise<{ config: BdtConfig; configPath: string }> {
  const abs = path.resolve(p);
  const raw = await fs.promises.readFile(abs, 'utf8');
  return { config: parseConfig(JSON.parse(raw)), configPath: abs };
}

interface DirStats { fileCount: number; totalBytes: number }
function summarize(dir: string): DirStats {
  const out: DirStats = { fileCount: 0, totalBytes: 0 };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = summarize(full);
      out.fileCount += sub.fileCount;
      out.totalBytes += sub.totalBytes;
    } else {
      out.fileCount++;
      try { out.totalBytes += fs.statSync(full).size; } catch {}
    }
  }
  return out;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  return `${(n / 1024 ** 3).toFixed(2)} GiB`;
}
