// Fixture: Jump Mechanics
// Normal jumps, sprint jumps, jump boost, surface jumps, bunny hops.
//
// Ported from v2 `recorder/src/fixtures2/02_jump_mechanics.ts`.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const ANCHOR_FLAT = sceneAnchor(SCENES.flat);
const ANCHOR_HONEY = sceneAnchor(SCENES.honeySurface);
const ANCHOR_SLIME = sceneAnchor(SCENES.slimeSurface);
const ANCHOR_CEILING = sceneAnchor(SCENES.ceilingRoom);
const ANCHOR_STAIRS = sceneAnchor(SCENES.stairsArea);
const ANCHOR_LADDER = sceneAnchor(SCENES.ladderWall);
const ANCHOR_PIT = sceneAnchor(SCENES.flatPit);

const flatPos: Pos = { x: SCENES.flat.x, y: 0, z: SCENES.flat.z };

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos = flatPos,
  yaw = 0,
  pitch = 0,
  anchor: Pos = ANCHOR_FLAT,
  setupDescription?: string,
  setup?: (b: SimulationBuilder) => SimulationBuilder,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos,
      yaw,
      pitch,
      sceneAnchor: anchor,
      setupDescription,
      setup,
      run,
    })
    .build();
}

function normalJump() {
  return mkSeq('jump_normal', 'Standing jump in place', (b) =>
    b.keyDown('space')
      .waitFor('player_auth_input', 1)
      .keyUp('space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function walkJump(ticks: number) {
  return mkSeq(`jump_walk_${ticks}t`, `Walk+jump for ${ticks} ticks`, (b) =>
    b.keyDown('w', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('w', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function sprintJump(ticks: number) {
  return mkSeq(`jump_sprint_${ticks}t`, `Sprint+jump for ${ticks} ticks`, (b) =>
    b.keyDown('ctrl', 'w', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('ctrl', 'w', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function sprintThenJump(sprintT: number) {
  return mkSeq(`sprint_${sprintT}t_then_jump`, `Sprint ${sprintT}t to build speed, then jump`, (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', sprintT)
      .keyDown('space')
      .waitFor('player_auth_input', 1)
      .keyUp('space')
      .waitFor('player_auth_input', 15)
      .keyUp('ctrl', 'w')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function sprintJumpDiag(ticks: number) {
  return mkSeq(`jump_sprint_diag_${ticks}t`, `Sprint+jump diagonal (ctrl+w+a+space) ${ticks}t`, (b) =>
    b.keyDown('ctrl', 'w', 'a', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('ctrl', 'w', 'a', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function jumpBackward(ticks: number) {
  return mkSeq(`jump_backward_${ticks}t`, `Jump backward ${ticks}t`, (b) =>
    b.keyDown('s', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('s', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function jumpSneak(ticks: number) {
  return mkSeq(`jump_sneak_${ticks}t`, `Jump while sneaking ${ticks}t`, (b) =>
    b.keyDown('shift', 'w', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('shift', 'w', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function jumpStrafe(ticks: number) {
  return mkSeq(`jump_strafe_${ticks}t`, `Jump while strafing ${ticks}t`, (b) =>
    b.keyDown('a', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('a', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function runningJump(walkT: number) {
  return mkSeq(`running_jump_walk_${walkT}t`, `Walk ${walkT}t then jump`, (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', walkT)
      .keyDown('space')
      .waitFor('player_auth_input', 1)
      .keyUp('space')
      .waitFor('player_auth_input', 15)
      .keyUp('w')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function bunnyHop(ticks: number) {
  return mkSeq(`bunny_hop_${ticks}t`, `Walk+space held ${ticks}t (bunny hop)`, (b) =>
    b.keyDown('w', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('w', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function sprintBunnyHop(ticks: number) {
  return mkSeq(`sprint_bunny_hop_${ticks}t`, `Sprint+space held ${ticks}t`, (b) =>
    b.keyDown('ctrl', 'w', 'space')
      .waitFor('player_auth_input', ticks)
      .keyUp('ctrl', 'w', 'space')
      .waitUntilStable(30)
      .waitFor('player_auth_input', 30),
  );
}

function jumpBoost(level: number) {
  return mkSeq(
    `jump_boost_${level + 1}`,
    `Standing jump with Jump Boost ${level + 1}`,
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space')
        .waitUntilStable(30)
        .waitFor('player_auth_input', 5),
    flatPos,
    0, 0,
    ANCHOR_FLAT,
    `apply jump_boost level ${level + 1}`,
    (b) => b.command(`effect \${PLAYER} jump_boost 30 ${level} true`),
  );
}

function sprintJumpBoost(level: number) {
  return mkSeq(
    `sprint_jump_boost_${level + 1}`,
    `Sprint+jump with Jump Boost ${level + 1}`,
    (b) =>
      b.keyDown('ctrl', 'w', 'space')
        .waitFor('player_auth_input', 20)
        .keyUp('ctrl', 'w', 'space')
        .waitUntilStable(30)
        .waitFor('player_auth_input', 5),
    flatPos,
    0, 0,
    ANCHOR_FLAT,
    `apply jump_boost level ${level + 1}`,
    (b) => b.command(`effect \${PLAYER} jump_boost 30 ${level} true`),
  );
}

function jumpOnHoney() {
  return mkSeq(
    'jump_on_honey',
    'Jump on honey block (reduced jump height)',
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space')
        .waitUntilStable(30)
        .waitFor('player_auth_input', 5),
    { x: SCENES.honeySurface.x, y: 0, z: SCENES.honeySurface.z },
    0, 0,
    ANCHOR_HONEY,
  );
}

function jumpOnSlime() {
  return mkSeq(
    'jump_on_slime',
    'Jump on slime block (amplified bounce)',
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space')
        .waitUntilStable(30)
        .waitFor('player_auth_input', 5),
    { x: SCENES.slimeSurface.x, y: 0, z: SCENES.slimeSurface.z },
    0, 0,
    ANCHOR_SLIME,
  );
}

function fallOnSlime(height: number) {
  return mkSeq(
    `fall_on_slime_h${height}`,
    `Fall onto slime from y=${height}, observe bounce`,
    (b) => b.waitUntilStable(30).waitFor('player_auth_input', 5),
    { x: SCENES.slimeSurface.x, y: height, z: SCENES.slimeSurface.z },
    0, 0,
    ANCHOR_SLIME,
  );
}

function jumpNearCeiling() {
  return mkSeq(
    'jump_near_ceiling_2h',
    'Jump under low ceiling — velocity should zero on impact',
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .waitUntilStable(30)
        .keyUp('space')
        .waitFor('player_auth_input', 5),
    { x: SCENES.ceilingRoom.x - 5, y: 0, z: SCENES.ceilingRoom.z - 5 },
    0, 0,
    ANCHOR_CEILING,
  );
}

function jumpUpStairs() {
  return mkSeq(
    'jump_up_stairs',
    'Walk+jump up stairs',
    (b) =>
      b.keyDown('w', 'space')
        .waitFor('player_auth_input', 40)
        .keyUp('w', 'space')
        .waitUntilStable(30)
        .waitFor('player_auth_input', 5),
    { x: SCENES.stairsArea.x, y: 0, z: SCENES.stairsArea.z - 2 },
    0, 0,
    ANCHOR_STAIRS,
  );
}

function jumpToLadder() {
  return mkSeq(
    'jump_to_ladder',
    'Walk+jump and catch ladder',
    (b) =>
      b.keyDown('w', 'space')
        .waitFor('player_auth_input', 15)
        .keyUp('space')
        .waitFor('player_auth_input', 30)
        .keyUp('w')
        .waitFor('player_auth_input', 30),
    { x: SCENES.ladderWall.x, y: 0, z: SCENES.ladderWall.z + 2 },
    0, 0,
    ANCHOR_LADDER,
  );
}

function jumpOverPit() {
  return mkSeq(
    'jump_over_pit',
    'Sprint-jump across flatPit',
    (b) =>
      b.keyDown('ctrl', 'w', 'space')
        .waitFor('player_auth_input', 15)
        .keyUp('ctrl', 'w', 'space')
        .waitUntilStable(30)
        .waitFor('player_auth_input', 5),
    { x: SCENES.flatPit.x - 3, y: 0, z: SCENES.flatPit.z },
    -90, 0,
    ANCHOR_PIT,
  );
}

function buildJumpMechanicsFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  seqs.push(normalJump());
  seqs.push(walkJump(15));
  seqs.push(sprintJump(20));
  seqs.push(sprintThenJump(5));
  seqs.push(sprintThenJump(10));
  seqs.push(sprintJumpDiag(20));

  seqs.push(jumpBackward(15));
  seqs.push(jumpSneak(15));
  seqs.push(jumpStrafe(15));
  seqs.push(runningJump(5));
  seqs.push(runningJump(10));

  seqs.push(bunnyHop(40));
  seqs.push(bunnyHop(60));
  seqs.push(sprintBunnyHop(40));

  for (let level = 0; level < 3; level++) {
    seqs.push(jumpBoost(level));
    seqs.push(sprintJumpBoost(level));
  }

  seqs.push(jumpOnHoney());
  seqs.push(jumpOnSlime());
  seqs.push(fallOnSlime(3));
  seqs.push(fallOnSlime(5));
  seqs.push(fallOnSlime(10));

  seqs.push(jumpNearCeiling());
  seqs.push(jumpUpStairs());
  seqs.push(jumpToLadder());
  seqs.push(jumpOverPit());

  return {
    name: 'v2_jump_mechanics',
    description: 'Normal/sprint/sneak/strafe jumps, jump boost, surface + structural jumps',
    sequences: seqs,
  };
}

registerFixture(buildJumpMechanicsFixture());
