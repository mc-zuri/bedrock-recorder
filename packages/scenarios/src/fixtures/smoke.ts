import { SimulationBuilder } from '../builder.js';
import { registerFixture } from './registry.js';

/**
 * The Phase-1 smoke fixture. Used by `bdt record --fixture smoke` to verify
 * the end-to-end pipeline (BDS up → relay → client connects → recorder writes
 * a proxy.bin → extractor consumes it) before porting the v2 catalog.
 *
 * One tiny test case: stand still for ~30 ticks. Produces a small but valid
 * proxy.bin with proper L-record brackets.
 *
 * Also doubles as the canonical demo for the new preamble + description
 * features: `beforeEachCase` does the standard reset/teleport before the
 * test case, and the test case carries a `description` field that the
 * extractor can stamp into the generated test file.
 */
registerFixture({
  name: 'smoke',
  description: 'Minimal sanity check: reset → teleport → stand still 30 ticks.',
  beforeEachCase: ({ name, options }) =>
    new SimulationBuilder().resetAndTeleport({
      name: `setup_${name}`,
      description: `reset and place player at ${formatPos(options?.startPos)}`,
      startPos: options?.startPos ?? { x: 0, y: 64, z: 0 },
    }),
  sequences: [
    new SimulationBuilder()
      .testCase(
        'stand_still',
        (b) => b.waitFor('player_auth_input', 30),
        {
          startPos: { x: 0, y: 64, z: 0 },
          description: 'player stands still for ~30 PAI ticks (no input)',
        },
      )
      .build(),
  ],
});

function formatPos(p: { x: number; y: number; z: number } | undefined): string {
  if (!p) return '(default)';
  return `(${p.x}, ${p.y}, ${p.z})`;
}
