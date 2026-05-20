import * as path from 'node:path';
import { listFixtures, discoverOverlays } from '@bdt/scenarios';
import '@bdt/scenarios/dist/fixtures/index.js';

export async function listFixturesCommand(opts: { filter?: string }): Promise<void> {
  const fixtures = listFixtures().filter((f) =>
    opts.filter ? f.name.includes(opts.filter) : true,
  );
  if (fixtures.length === 0) {
    console.log('(no fixtures registered)');
    return;
  }
  for (const f of fixtures) {
    const desc = f.description ? ` — ${f.description}` : '';
    console.log(`${f.name}${desc}`);
  }
}

export async function listOverlaysCommand(opts: { dir?: string; filter?: string }): Promise<void> {
  const dir = opts.dir ?? defaultOverlayDir();
  const overlays = await discoverOverlays(dir);
  const filtered = overlays.filter((o) =>
    opts.filter ? o.name.includes(opts.filter) : true,
  );
  if (filtered.length === 0) {
    console.log(`(no overlays found in ${dir})`);
    return;
  }
  for (const o of filtered) {
    console.log(`${o.name}  (${path.relative(process.cwd(), o.path)})`);
  }
}

function defaultOverlayDir(): string {
  // The overlay JSONs ship inside @bdt/scenarios' source tree. From the
  // compiled CLI's perspective, that's two levels up under packages/.
  return path.resolve(__dirname, '..', '..', '..', 'scenarios', 'src', 'overlays');
}
