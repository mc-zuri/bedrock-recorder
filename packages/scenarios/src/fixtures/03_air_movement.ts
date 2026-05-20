// Fixture: Air Movement
// Free fall, fall with input, air control, momentum preservation.
//
// Ported from v2 `recorder/src/fixtures2/03_air_movement.ts`. Per-case setup
// re-applies resistance (the preamble in sceneTestCase already gives it, but
// kept here in case someone runs a single test case in isolation).

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };
const S = SCENES.flat;
const ANCHOR_FLAT = sceneAnchor(S);
const ANCHOR_PIT = sceneAnchor(SCENES.flatPit);

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos,
  yaw = 0,
  pitch = 0,
  anchor: Pos = ANCHOR_FLAT,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos,
      yaw,
      pitch,
      sceneAnchor: anchor,
      run,
    })
    .build();
}

function freeFall(height: number): SimulationSequence {
  return mkSeq(
    `free_fall_h${height}`,
    `Free fall (no input) from y=${height}`,
    (b) => b.waitUntilStable().waitFor('player_auth_input', 1),
    { x: S.x, y: height, z: S.z },
  );
}

function fallWithWalk(height: number): SimulationSequence {
  return mkSeq(
    `fall_walk_h${height}`,
    `Fall from y=${height} with forward walk held`,
    (b) =>
      b.keyDown('w')
        .waitUntilStable()
        .keyUp('w')
        .waitFor('player_auth_input', 5),
    { x: S.x, y: height, z: S.z },
  );
}

function fallWithSprint(height: number): SimulationSequence {
  return mkSeq(
    `fall_sprint_h${height}`,
    `Fall from y=${height} with sprint forward held`,
    (b) =>
      b.keyDown('ctrl', 'w')
        .waitUntilStable()
        .keyUp('ctrl', 'w')
        .waitFor('player_auth_input', 5),
    { x: S.x, y: height, z: S.z },
  );
}

function airStrafe(direction: 'a' | 'd'): SimulationSequence {
  const label = direction === 'a' ? 'left' : 'right';
  return mkSeq(
    `air_strafe_${label}`,
    `Jump then strafe ${label} in air`,
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space')
        .keyDown(direction)
        .waitUntilStable(3)
        .keyUp(direction)
        .waitFor('player_auth_input', 1),
    { x: S.x, y: 0, z: S.z },
  );
}

function airSprint(): SimulationSequence {
  return mkSeq(
    'air_sprint_forward',
    'Jump then sprint forward in air',
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space')
        .keyDown('ctrl', 'w')
        .waitUntilStable(3)
        .keyUp('ctrl', 'w')
        .waitFor('player_auth_input', 1),
    { x: S.x, y: 0, z: S.z },
  );
}

function sprintJumpMomentum(sprintT: number): SimulationSequence {
  return mkSeq(
    `sprint_jump_momentum_${sprintT}t`,
    `Sprint ${sprintT}t, jump, release all (momentum test)`,
    (b) =>
      b.keyDown('ctrl', 'w')
        .waitFor('player_auth_input', sprintT)
        .keyDown('space')
        .waitFor('player_auth_input', 1)
        .keyUp('space', 'ctrl', 'w')
        .waitUntilStable(3)
        .waitFor('player_auth_input', 1),
    { x: S.x, y: 0, z: S.z },
  );
}

function walkOffEdge(): SimulationSequence {
  return mkSeq(
    'walk_off_edge',
    'Walk forward off flatPit edge',
    (b) =>
      b.keyDown('w')
        .waitFor('player_auth_input', 20)
        .keyUp('w')
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    { x: SCENES.flatPit.x - 3, y: 0, z: SCENES.flatPit.z },
    90,
    0,
    ANCHOR_PIT,
  );
}

function sprintOffEdge(): SimulationSequence {
  return mkSeq(
    'sprint_off_edge',
    'Sprint forward off flatPit edge',
    (b) =>
      b.keyDown('ctrl', 'w')
        .waitFor('player_auth_input', 20)
        .keyUp('ctrl', 'w')
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    { x: SCENES.flatPit.x - 5, y: 0, z: SCENES.flatPit.z },
    90,
    0,
    ANCHOR_PIT,
  );
}

function fallWithDirection(height: number, yaw: number, pitch: number): SimulationSequence {
  const yawLbl = `${yaw}`.replace('-', 'neg');
  const pitchLbl = `${pitch}`.replace('-', 'neg');
  return mkSeq(
    `fall_dir_h${height}_y${yawLbl}_p${pitchLbl}`,
    `Fall from y=${height} with walk + yaw=${yaw}, pitch=${pitch}`,
    (b) =>
      b.keyDown('w')
        .waitUntilStable()
        .keyUp('w')
        .waitFor('player_auth_input', 5),
    { x: S.x, y: height, z: S.z },
    yaw,
    pitch,
  );
}

function buildAirMovementFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  for (const h of [10, 50, 300]) seqs.push(freeFall(h));
  for (const h of [10, 100]) seqs.push(fallWithWalk(h));
  for (const h of [10, 50]) seqs.push(fallWithSprint(h));

  seqs.push(airStrafe('a'));
  seqs.push(airStrafe('d'));
  seqs.push(airSprint());

  seqs.push(sprintJumpMomentum(5));
  seqs.push(sprintJumpMomentum(10));
  seqs.push(sprintJumpMomentum(20));

  seqs.push(walkOffEdge());
  seqs.push(sprintOffEdge());

  // Direction sweep (kept narrow to match v2)
  for (const yaw of [0, 135]) {
    for (const pitch of [0]) {
      seqs.push(fallWithDirection(50, yaw, pitch));
    }
  }

  // Free-fall height sweep 5,10,...,100
  for (let h = 5; h <= 100; h += 5) seqs.push(freeFall(h));

  // Fall+walk yaw sweep at h=30
  for (let y = 0; y < 100; y += 90) {
    seqs.push(
      mkSeq(
        `fall_walk_h30_yaw${y}`,
        `Fall from y=30 with walk, yaw=${y}`,
        (b) =>
          b.keyDown('w')
            .waitUntilStable()
            .keyUp('w')
            .waitFor('player_auth_input', 5),
        { x: S.x, y: 30, z: S.z },
        y,
        0,
      ),
    );
  }
  // Fall+sprint yaw sweep at h=30
  for (let y = 0; y < 100; y += 90) {
    seqs.push(
      mkSeq(
        `fall_sprint_h30_yaw${y}`,
        `Fall from y=30 with sprint, yaw=${y}`,
        (b) =>
          b.keyDown('ctrl', 'w')
            .waitUntilStable()
            .keyUp('ctrl', 'w')
            .waitFor('player_auth_input', 5),
        { x: S.x, y: 30, z: S.z },
        y,
        0,
      ),
    );
  }

  return {
    name: 'v2_air_movement',
    description: 'Free fall, fall-with-input, air control, momentum preservation',
    sequences: seqs,
  };
}

registerFixture(buildAirMovementFixture());
