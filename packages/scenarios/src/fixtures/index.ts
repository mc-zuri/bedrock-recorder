// Importing this barrel registers every fixture in the process-global registry.
// Add new fixture files here as they are ported from v2's fixtures2/.
//
// Porting checklist for the remaining ~28 v2 fixtures:
//   1. Copy file from `bedrock-tools-v2/packages/recorder/src/fixtures2/NN_*.ts`
//   2. Replace imports: `simulation-builder.ts` → `../builder.js`,
//                       `fixtures/fixture.ts`   → `@bdt/core`,
//                       `scene_positions.ts`    → `./scene_positions.js`
//   3. Delete the v2 `wait` import from `old.ts` and any `?:` to it.
//   4. Find-replace `@a` → `${PLAYER}` for command target selectors (keep
//      `@a` only when you genuinely target every connected player).
//   5. Wrap the exported `get_*_fixture_v2()` with `registerFixture()` at
//      module scope so importing this barrel registers it.
//   6. Add the import line here.

import './smoke.js';
import './shared_world.js';
import './00_core_coverage.js';
import './01_ground_movement.js';
import './02_jump_mechanics.js';
import './03_air_movement.js';
import './06_honey_slime.js';
import './07_water_physics.js';
import './07a_ground_to_water.js';
import './08_lava_physics.js';
import './10_elytra.js';
import './18_teleportation.js';
import './24_v11_coverage.js';
import './25_container.js';
import './30_prismarine_physics.js';
import './99_v2_bundles.js';
import './99b_extras.js';

export { fixtureRegistry, registerFixture, getFixture, listFixtures } from './registry.js';
