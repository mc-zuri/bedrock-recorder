// Fixture: Elytra / Gliding
// Equip elytra, jump from height, glide, boost with firework.
//
// Ported from v2 `recorder/src/fixtures2/10_elytra.ts`. Setup (equip elytra +
// fireworks) lands inside each test case's recording window via `sceneTestCase`
// so the resulting fixture captures the inventory + armor packets.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

const S = SCENES.flat;
const ANCHOR = sceneAnchor(S);

function equipElytra(b: SimulationBuilder): SimulationBuilder {
  return b
    .command('replaceitem entity ${PLAYER} slot.armor.chest 0 elytra')
    .command('replaceitem entity ${PLAYER} slot.hotbar 0 firework_rocket 64');
}

function glide(
  label: string,
  height: number,
  yaw: number,
  pitch: number,
  keys: string[] = [],
  withBoost = false,
): SimulationSequence {
  const yawLbl = `${yaw}`.replace('-', 'neg');
  const pitchLbl = `${pitch}`.replace('-', 'neg');
  // Match v2's exact naming: firework-boost cases use `elytra_boost_…`,
  // not `elytra_glide_…_boost`, so the extractor produces files named
  // `elytra_boost_h<h>_y<y>_p<p>.test.js` (target expectations).
  const baseLabel = withBoost ? 'boost' : label;
  const name = `elytra_${baseLabel}_h${height}_y${yawLbl}_p${pitchLbl}`;
  const desc =
    `Elytra ${label} from y=${height}, yaw=${yaw}, pitch=${pitch}` +
    (keys.length ? `, holding [${keys.join('+')}]` : '') +
    (withBoost ? ', firework boost' : '');

  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description: desc,
      setupDescription: 'equip elytra + 64 fireworks',
      startPos: { x: S.x, y: height, z: S.z },
      yaw,
      pitch,
      sceneAnchor: ANCHOR,
      setup: equipElytra,
      run: (b) => {
        // Bedrock elytra doesn't auto-deploy. The player has to be IN AIR
        // (not standing on a block) and press jump once. Sequence:
        //   1. 3 PAI ticks of free-fall — confirms we're airborne (the
        //      post-teleport handshake also resolves in this window).
        //   2. tap space — deploys the elytra. Without this the recording
        //      captures pure gravity, not gliding.
        //   3. 5 PAI ticks for the deploy to settle (gliding flag flips).
        b.waitFor('player_auth_input', 3);
        b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space');
        b.waitFor('player_auth_input', 5);

        if (withBoost) {
          b.mouseClick('right').waitFor('player_auth_input', 40);
        } else if (keys.length > 0) {
          b.keyDown(...keys).waitFor('player_auth_input', 40).keyUp(...keys);
        } else {
          b.waitFor('player_auth_input', 40);
        }
        return b.waitFor('player_auth_input', 10);
      },
    })
    .build();
}

function buildElytraFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  // Basic glide
  seqs.push(glide('glide', 300, 0, 0));

  // Pitch variations
  for (const p of [-60, -30, -10, 0, 10, 30]) {
    seqs.push(glide('glide_pitch', 200, 0, p));
  }
  // Yaw variations
  for (const y of [0, 45, 90, 180]) {
    seqs.push(glide('glide_yaw', 200, y, -10));
  }
  // Glide with forward
  for (const p of [-30, 0, 30]) {
    seqs.push(glide('glide_forward', 200, 0, p, ['w']));
  }
  // Strafe
  seqs.push(glide('glide_strafeL', 200, 0, -10, ['a']));
  seqs.push(glide('glide_strafeR', 200, 0, -10, ['d']));
  // Sprint
  seqs.push(glide('glide_sprint', 200, 0, -10, ['ctrl', 'w']));

  // Firework boost
  for (const p of [-30, 0, 30]) {
    seqs.push(glide('glide', 200, 0, p, [], true));
  }

  // Pitch sweep
  for (let p = -80; p <= 80; p += 90) {
    seqs.push(glide('pitch_sweep', 200, 0, p));
  }
  // Yaw sweep
  for (let y = 0; y < 360; y += 90) {
    seqs.push(glide('yaw_sweep', 200, y, -15));
  }

  return {
    name: 'v2_elytra',
    description: 'Elytra gliding from height, yaw/pitch sweep, firework boost',
    sequences: seqs,
  };
}

registerFixture(buildElytraFixture());
