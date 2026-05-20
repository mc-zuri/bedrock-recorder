// Fixture: Honey & Slime
// Walk, sprint, jump, bounce on honey/slime blocks.
//
// Ported from v2 `recorder/src/fixtures2/06_honey_slime.ts`.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };
type SurfaceType = 'honey' | 'slime';

const SURFACE_SCENES = {
  honey: SCENES.honeySurface,
  slime: SCENES.slimeSurface,
} as const;
const ANCHORS = {
  honey: sceneAnchor(SCENES.honeySurface),
  slime: sceneAnchor(SCENES.slimeSurface),
} as const;

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos,
  yaw = 0,
  anchor?: Pos,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos,
      yaw,
      sceneAnchor: anchor,
      // The block bounce on slime is exactly the physics we want to capture;
      // resistance is required so high falls don't kill the player mid-fixture.
      run,
    })
    .build();
}

function moveOnSurface(surface: SurfaceType, label: string, keys: string[], ticks: number): SimulationSequence {
  const s = SURFACE_SCENES[surface];
  return mkSeq(
    `${surface}_${label}_${ticks}t`,
    `${label} on ${surface} surface for ${ticks} ticks`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    { x: s.x, y: 0, z: s.z },
    0,
    ANCHORS[surface],
  );
}

function freeMoveOnSlime(): SimulationSequence {
  const s = SURFACE_SCENES.slime;
  return mkSeq(
    'slime_free_move',
    'Stand still on slime; observe passive bounce stabilization',
    (b) =>
      // v2 used a single waitFor(500). Each waitFor has a 15s safety timeout
      // and 500 ticks at ~20 PAI/s = ~25s, so split into chunks of 200.
      b.waitFor('player_auth_input', 200)
        .waitFor('player_auth_input', 200)
        .waitFor('player_auth_input', 100)
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    { x: s.x, y: 0, z: s.z },
    0,
    ANCHORS.slime,
  );
}

function jumpOnSurface(surface: SurfaceType): SimulationSequence {
  const s = SURFACE_SCENES[surface];
  return mkSeq(
    `${surface}_jump`,
    `Single jump on ${surface}`,
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space')
        .waitUntilStable(3)
        .waitFor('player_auth_input', 1),
    { x: s.x, y: 0, z: s.z },
    0,
    ANCHORS[surface],
  );
}

function fallOnSurface(surface: SurfaceType, height: number): SimulationSequence {
  const s = SURFACE_SCENES[surface];
  const pos = { x: s.x, y: height, z: s.z };
  if (surface === 'slime') {
    const bounceTicks = Math.max(60, height * 8);
    return mkSeq(
      `${surface}_fall_h${height}`,
      `Fall onto slime from y=${height}, observe bounce decay`,
      (b) => b.waitFor('player_auth_input', bounceTicks),
      pos,
      0,
      ANCHORS.slime,
    );
  }
  return mkSeq(
    `${surface}_fall_h${height}`,
    `Fall onto honey from y=${height}, observe slow descent`,
    (b) => b.waitUntilStable().waitFor('player_auth_input', 1),
    pos,
    0,
    ANCHORS.honey,
  );
}

function sprintJumpOnSurface(surface: SurfaceType, ticks: number): SimulationSequence {
  const s = SURFACE_SCENES[surface];
  return mkSeq(
    `${surface}_sprintJump_${ticks}t`,
    `Sprint+jump on ${surface} for ${ticks} ticks`,
    (b) =>
      b.keyDown('ctrl', 'w', 'space')
        .waitFor('player_auth_input', ticks)
        .keyUp('ctrl', 'w', 'space')
        .waitUntilStable(3)
        .waitFor('player_auth_input', 1),
    { x: s.x, y: 0, z: s.z },
    0,
    ANCHORS[surface],
  );
}

function sneakOnHoney(ticks: number): SimulationSequence {
  const s = SURFACE_SCENES.honey;
  return mkSeq(
    `honey_sneak_${ticks}t`,
    `Sneak walk on honey for ${ticks} ticks (reduced speed)`,
    (b) =>
      b.keyDown('shift', 'w')
        .waitFor('player_auth_input', ticks)
        .keyUp('shift', 'w')
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    { x: s.x, y: 0, z: s.z },
    0,
    ANCHORS.honey,
  );
}

function sneakFallOnSlime(height: number): SimulationSequence {
  const s = SURFACE_SCENES.slime;
  const pos = { x: s.x, y: height, z: s.z };
  const waitTicks = Math.max(40, height * 6);
  return mkSeq(
    `slime_sneak_fall_h${height}`,
    `Sneak-fall onto slime from y=${height}; sneak suppresses bounce`,
    (b) =>
      b.keyDown('shift')
        .waitFor('player_auth_input', waitTicks)
        .keyUp('shift')
        .waitFor('player_auth_input', 1),
    pos,
    0,
    ANCHORS.slime,
  );
}

function buildHoneySlimeFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  seqs.push(freeMoveOnSlime());

  for (const surface of ['honey', 'slime'] as SurfaceType[]) {
    seqs.push(moveOnSurface(surface, 'walk', ['w'], 20));
    seqs.push(moveOnSurface(surface, 'sprint', ['ctrl', 'w'], 20));
    seqs.push(jumpOnSurface(surface));
    seqs.push(sprintJumpOnSurface(surface, 20));
    for (const h of [3, 5, 10, 20]) {
      seqs.push(fallOnSurface(surface, h));
    }
  }

  // Honey-specific
  seqs.push(sneakOnHoney(20));
  seqs.push(moveOnSurface('honey', 'backward', ['s'], 10));

  // Slime-specific sneak suppression
  for (let h = 1; h <= 10; h++) {
    seqs.push(sneakFallOnSlime(h));
  }

  return {
    name: 'v2_honey_slime',
    description: 'Walk, sprint, jump, bounce on honey + slime blocks',
    sequences: seqs,
  };
}

registerFixture(buildHoneySlimeFixture());
