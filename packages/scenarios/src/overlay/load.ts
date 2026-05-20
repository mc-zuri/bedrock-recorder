import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseOverlay, type Overlay } from './schema.js';
import { expandOverlay } from './expand.js';
import type { SimulationSequence } from '../builder.js';

/** Read an overlay JSON file and parse+validate it. */
export async function readOverlayFile(filePath: string): Promise<Overlay> {
  const raw = await fs.readFile(filePath, 'utf8');
  return parseOverlay(JSON.parse(raw));
}

/** Convenience: read+expand in one call. */
export async function loadOverlay(filePath: string): Promise<SimulationSequence> {
  return expandOverlay(await readOverlayFile(filePath));
}

/**
 * Discover all `*.overlay.json` files under a directory. Used by the CLI's
 * `list-overlays` and `record --overlay <name>` commands.
 */
export async function discoverOverlays(dir: string): Promise<Array<{ name: string; path: string }>> {
  const out: Array<{ name: string; path: string }> = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.overlay.json')) continue;
      const filePath = path.join(dir, entry.name);
      const overlay = await readOverlayFile(filePath);
      out.push({ name: overlay.name, path: filePath });
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return out;
}
