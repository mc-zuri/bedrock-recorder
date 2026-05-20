// Fixture: Teleportation
// Teleport while moving, velocity preservation, position snapping, rapid chains.
//
// Ported from v2 `recorder/src/fixtures2/18_teleportation.ts`.
// The v2 file had `walkTpIncreasing` returning a fixture mis-named
// `v2_core_coverage`; here we drop that confusion and expose only the
// canonical `v2_teleportation` fixture name.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const S = SCENES.flat;
const ANCHOR = sceneAnchor(S);
const flatPos: Pos = { x: S.x, y: 0, z: S.z };

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos = flatPos,
  yaw = 0,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos,
      yaw,
      sceneAnchor: ANCHOR,
      run,
    })
    .build();
}

function tpWhileWalking() {
  return mkSeq('tp_while_walking', 'Walk forward, mid-walk teleport (+10 x)', (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', 10)
      .teleport(flatPos.x + 10, flatPos.y, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 10)
      .keyUp('w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function tpWhileSprinting() {
  return mkSeq('tp_while_sprinting', 'Sprint forward, mid-sprint teleport (+10 x)', (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', 10)
      .teleport(flatPos.x + 10, flatPos.y, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 10)
      .keyUp('ctrl', 'w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function tpDuringJump() {
  return mkSeq('tp_during_jump', 'Jump+walk, teleport mid-air (+10 x, +2 y)', (b) =>
    b.keyDown('w', 'space')
      .waitFor('player_auth_input', 5)
      .keyUp('space')
      .teleport(flatPos.x + 10, flatPos.y + 2, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 10)
      .keyUp('w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function tpSamePos() {
  return mkSeq('tp_same_pos_while_moving', 'Sprint, teleport to same pos (velocity reset)', (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', 10)
      .teleport(flatPos.x, flatPos.y, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 10)
      .keyUp('ctrl', 'w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function tpToHeight() {
  return mkSeq('tp_to_height_100', 'Teleport to y=100', (b) =>
    b.teleport(flatPos.x, 100, flatPos.z, 0, 0)
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function rapidTeleports() {
  return mkSeq('tp_rapid_chain', 'Four teleports in quick succession', (b) =>
    b.teleport(flatPos.x + 1, flatPos.y, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 3)
      .teleport(flatPos.x + 2, flatPos.y, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 3)
      .teleport(flatPos.x + 3, flatPos.y, flatPos.z, 0, 0)
      .waitFor('player_auth_input', 3)
      .teleport(flatPos.x, flatPos.y, flatPos.z, 0, 0)
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function walkTpIncreasing(yOffset = 0, waitTicks = 10) {
  return new SimulationBuilder()
    .sceneTestCase({
      name: `walk_tp_increasing_y${yOffset}`,
      description: `Walk forward, teleport +8 to +800 blocks ahead in increments of 8 (y+${yOffset})`,
      startPos: { x: flatPos.x, y: flatPos.y + yOffset, z: flatPos.z - 500 },
      yaw: 0,
      sceneAnchor: ANCHOR,
      run: (b) => {
        b.keyDown('w').waitFor('player_auth_input', 20);
        for (let dist = 8; dist <= 800; dist += 8) {
          b.command(`/tp \${PLAYER} 100 ~ ~${dist}`).waitUntilTeleportHandled(waitTicks);
        }
        return b.keyUp('w').waitFor('player_auth_input', 10);
      },
    })
    .build();
}

function buildTeleportationFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  seqs.push(tpWhileWalking());
  seqs.push(tpWhileSprinting());
  seqs.push(tpDuringJump());
  seqs.push(tpSamePos());
  seqs.push(tpToHeight());
  seqs.push(rapidTeleports());
  seqs.push(walkTpIncreasing(0, 10));

  return {
    name: 'v2_teleportation',
    description: 'Mid-motion teleports, velocity reset, rapid chains, walk+increasing-tp sweep',
    sequences: seqs,
  };
}

registerFixture(buildTeleportationFixture());
