// Fixture: Lava Physics
// Submerged movement, surface, entry/exit, gravity, with fire resistance.
//
// Ported from v2 `recorder/src/fixtures2/08_lava_physics.ts`. Setup applies
// fire_resistance + water_breathing inside the recording window so the
// generated fixture captures the resulting attribute updates.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const LP = SCENES.lavaPool;
const LHP = SCENES.lavaHalfPool;
const ANCHOR_LP = sceneAnchor(LP);
const ANCHOR_LHP = sceneAnchor(LHP);

function applyLavaSetup(b: SimulationBuilder): SimulationBuilder {
  return b
    .command('effect ${PLAYER} fire_resistance 9999 0 true')
    .command('effect ${PLAYER} water_breathing 9999 0 true');
}

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos,
  yaw = 0,
  pitch = 0,
  anchor: Pos = ANCHOR_LP,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos,
      yaw,
      pitch,
      sceneAnchor: anchor,
      setupDescription: 'apply fire_resistance + water_breathing',
      setup: applyLavaSetup,
      run,
    })
    .build();
}

function submergedMove(label: string, keys: string[], ticks: number, depth: number, yaw = 0, pitch = 0) {
  const yawLbl = `${yaw}`.replace('-', 'neg');
  const pitchLbl = `${pitch}`.replace('-', 'neg');
  return mkSeq(
    `lava_sub_${label}_d${Math.abs(depth)}_y${yawLbl}_p${pitchLbl}`,
    `Submerged ${label} d=${depth}, yaw=${yaw}, pitch=${pitch}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitFor('player_auth_input', 4),
    { x: LP.x, y: depth, z: LP.z },
    yaw, pitch,
  );
}

function swimUp(depth: number) {
  return mkSeq(
    `lava_swim_up_d${Math.abs(depth)}`,
    `Swim up from depth ${depth} (lava buoyancy)`,
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 30)
        .keyUp('space')
        .waitFor('player_auth_input', 4),
    { x: LP.x, y: depth, z: LP.z },
  );
}

function swimDown(depth: number) {
  return mkSeq(
    `lava_swim_down_d${Math.abs(depth)}`,
    `Swim down from depth ${depth}`,
    (b) =>
      b.keyDown('shift')
        .waitFor('player_auth_input', 30)
        .keyUp('shift')
        .waitFor('player_auth_input', 4),
    { x: LP.x, y: depth, z: LP.z },
  );
}

function lavaEntry(label: string, keys: string[], ticks: number) {
  return mkSeq(
    `lava_entry_${label}`,
    `Walk into lava (half-pool), ${label}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitFor('player_auth_input', 30),
    { x: LHP.x - 5, y: 0, z: LHP.z },
    90, 0,
    ANCHOR_LHP,
  );
}

function lavaExit(label: string, keys: string[]) {
  return mkSeq(
    `lava_exit_${label}`,
    `Walk out of lava (half-pool), ${label}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', 40)
        .keyUp(...keys)
        .waitFor('player_auth_input', 4),
    { x: LHP.x + 3, y: -3, z: LHP.z },
    270, 0,
    ANCHOR_LHP,
  );
}

function lavaGravity(height: number) {
  return mkSeq(
    `lava_gravity_h${height}`,
    `Fall into lava pool from y=${height}`,
    (b) => b.waitUntilStable().waitFor('player_auth_input', 1),
    { x: LP.x, y: height, z: LP.z },
  );
}

function surfaceSwim(label: string, keys: string[], ticks: number, yaw = 0) {
  return mkSeq(
    `lava_surface_${label}_y${yaw}`,
    `Surface ${label} on lava, yaw=${yaw}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitFor('player_auth_input', 4),
    { x: LP.x, y: 0, z: LP.z },
    yaw,
  );
}

function buildLavaPhysicsFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  // Submerged basic
  seqs.push(submergedMove('walk', ['w'], 40, -5));
  seqs.push(submergedMove('sprint', ['ctrl', 'w'], 40, -5));
  seqs.push(submergedMove('sneak', ['shift', 'w'], 40, -5));
  seqs.push(submergedMove('backward', ['s'], 40, -5));
  seqs.push(submergedMove('strafeL', ['a'], 40, -5));
  seqs.push(submergedMove('strafeR', ['d'], 40, -5));
  seqs.push(submergedMove('diagonal', ['w', 'a'], 40, -5));

  // Swim vertical
  seqs.push(swimUp(-5));
  seqs.push(swimUp(-8));
  seqs.push(swimDown(-2));
  seqs.push(swimDown(-5));

  // Surface
  seqs.push(surfaceSwim('walk', ['w'], 30));
  seqs.push(surfaceSwim('sprint', ['ctrl', 'w'], 30));
  seqs.push(surfaceSwim('sneak', ['shift', 'w'], 30));

  // Entry/exit
  seqs.push(lavaEntry('walk', ['w'], 30));
  seqs.push(lavaEntry('sprint', ['ctrl', 'w'], 30));
  seqs.push(lavaExit('walk', ['w']));
  seqs.push(lavaExit('sprint', ['ctrl', 'w']));

  // Gravity
  for (const h of [1, 3, 5, 10]) seqs.push(lavaGravity(h));

  // Yaw × pitch sweep
  const yaws = [221];
  const pitches = [-60, -30, 0, 30];
  for (const yaw of yaws) {
    for (const pitch of pitches) {
      seqs.push(submergedMove('walk', ['w'], 30, -5, yaw, pitch));
    }
  }
  for (const yaw of yaws) {
    for (const pitch of pitches) {
      seqs.push(submergedMove('sprint', ['ctrl', 'w'], 30, -5, yaw, pitch));
    }
  }

  // Depth sweep
  for (let d = -2; d >= -8; d--) seqs.push(submergedMove('walk', ['w'], 30, d));

  // State transitions
  seqs.push(mkSeq('lava_walk_to_sprint', 'Walk → sprint transition in lava', (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', 15)
      .keyDown('ctrl')
      .waitFor('player_auth_input', 15)
      .keyUp('ctrl', 'w')
      .waitFor('player_auth_input', 4),
    { x: LP.x, y: -5, z: LP.z }));

  seqs.push(mkSeq('lava_walk_to_sneak', 'Walk → sneak transition in lava', (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', 15)
      .keyUp('w')
      .keyDown('shift', 'w')
      .waitFor('player_auth_input', 15)
      .keyUp('shift', 'w')
      .waitFor('player_auth_input', 4),
    { x: LP.x, y: -5, z: LP.z }));

  seqs.push(mkSeq('lava_sprint_to_stop', 'Sprint → stop in lava', (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', 4)
      .keyUp('ctrl', 'w')
      .waitFor('player_auth_input', 30),
    { x: LP.x, y: -5, z: LP.z }));

  return {
    name: 'v2_lava_physics',
    description: 'Lava physics: submerged, surface, entry/exit, gravity, transitions',
    sequences: seqs,
  };
}

registerFixture(buildLavaPhysicsFixture());
