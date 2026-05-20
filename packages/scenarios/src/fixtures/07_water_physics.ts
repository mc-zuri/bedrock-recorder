// Fixture: Water Physics
// Submerged, surface, entry/exit, gravity, depth strider, dolphin grace.
//
// Ported from v2 `recorder/src/fixtures2/07_water_physics.ts`. Setup applies
// water_breathing inside the recording window so the fixture captures the
// attribute_set packets that arrive from the effect change.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const WP = SCENES.waterPool;
const WHP = SCENES.waterHalfPool;
const ANCHOR_WP = sceneAnchor(WP);
const ANCHOR_WHP = sceneAnchor(WHP);

function applyWaterBreathing(b: SimulationBuilder): SimulationBuilder {
  return b.command('effect ${PLAYER} water_breathing 9999 0 true');
}

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos,
  yaw = 0,
  pitch = 0,
  anchor: Pos = ANCHOR_WP,
  setupDescription = 'apply water_breathing',
  setup: (b: SimulationBuilder) => SimulationBuilder = applyWaterBreathing,
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

function submergedMove(label: string, keys: string[], ticks: number, depth: number, yaw = 0, pitch = 0) {
  const yawLbl = `${yaw}`.replace('-', 'neg');
  const pitchLbl = `${pitch}`.replace('-', 'neg');
  return mkSeq(
    `water_sub_${label}_d${Math.abs(depth)}_y${yawLbl}_p${pitchLbl}`,
    `Submerged ${label} depth=${depth} yaw=${yaw} pitch=${pitch}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitFor('player_auth_input', 3),
    { x: WP.x, y: depth, z: WP.z },
    yaw, pitch,
  );
}

function swimUp(depth: number) {
  return mkSeq(
    `water_swim_up_d${Math.abs(depth)}`,
    `Swim up from depth ${depth}`,
    (b) =>
      b.keyDown('space')
        .waitFor('player_auth_input', 60)
        .keyUp('space')
        .waitFor('player_auth_input', 3),
    { x: WP.x, y: depth, z: WP.z },
  );
}

function swimDown(depth: number) {
  return mkSeq(
    `water_swim_down_d${Math.abs(depth)}`,
    `Swim down from depth ${depth}`,
    (b) =>
      b.keyDown('shift')
        .waitFor('player_auth_input', 30)
        .keyUp('shift')
        .waitFor('player_auth_input', 3),
    { x: WP.x, y: depth, z: WP.z },
  );
}

function waterEntry(label: string, keys: string[], ticks: number) {
  return mkSeq(
    `water_entry_${label}`,
    `Walk into water (half-pool), ${label}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitFor('player_auth_input', 30),
    { x: WHP.x - 5, y: 0, z: WHP.z },
    90, 0,
    ANCHOR_WHP,
  );
}

function waterExit(label: string, keys: string[]) {
  return mkSeq(
    `water_exit_${label}`,
    `Walk out of water (half-pool), ${label}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', 70)
        .keyUp(...keys)
        .waitFor('player_auth_input', 3),
    { x: WHP.x + 3, y: -3, z: WHP.z },
    270, 0,
    ANCHOR_WHP,
  );
}

function waterGravity(height: number) {
  return mkSeq(
    `water_gravity_h${height}`,
    `Fall into water pool from y=${height}`,
    (b) => b.waitUntilStable().waitFor('player_auth_input', 1),
    { x: WP.x, y: height, z: WP.z },
  );
}

function depthStriderMove(level: number, ticks: number) {
  const enchant = `{"minecraft:enchantable":{"slot":"armor_feet"},"minecraft:enchantments":{"value":{"depth_strider":${level}}}}`;
  return mkSeq(
    `water_depth_strider_${level}_${ticks}t`,
    `Walk submerged with Depth Strider ${level}, ${ticks}t`,
    (b) =>
      b.keyDown('w')
        .waitFor('player_auth_input', ticks)
        .keyUp('w')
        .waitFor('player_auth_input', 7),
    { x: WP.x, y: -5, z: WP.z },
    0, 0,
    ANCHOR_WP,
    `equip diamond_boots with Depth Strider ${level}, apply water_breathing`,
    (b) =>
      b.command(`replaceitem entity \${PLAYER} slot.armor.feet 0 diamond_boots 1 ${enchant}`)
        .command('effect ${PLAYER} water_breathing 9999 0 true'),
  );
}

function surfaceSwim(label: string, keys: string[], ticks: number, yaw = 0) {
  return mkSeq(
    `water_surface_${label}_y${yaw}`,
    `Surface ${label} on water, yaw=${yaw}`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitFor('player_auth_input', 3),
    { x: WP.x, y: 0, z: WP.z },
    yaw,
  );
}

function buildWaterPhysicsFixture(): Fixture {
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
  seqs.push(surfaceSwim('walk', ['w'], 70));
  seqs.push(surfaceSwim('sprint', ['ctrl', 'w'], 90));
  seqs.push(surfaceSwim('sneak', ['shift', 'w'], 70));

  // Entry/exit
  seqs.push(waterEntry('walk', ['w'], 30));
  seqs.push(waterEntry('sprint', ['ctrl', 'w'], 30));
  seqs.push(waterExit('walk', ['w']));
  seqs.push(waterExit('sprint', ['ctrl', 'w']));

  // Gravity
  for (const h of [1, 3, 5, 10]) seqs.push(waterGravity(h));

  // Yaw × pitch sweep
  const yaws = [15];
  const pitches = [-45, -60, -70, -90, -30, 0, 30];
  for (const yaw of yaws) {
    for (const pitch of pitches) {
      seqs.push(submergedMove('walk', ['w'], 70, -5, yaw, pitch));
      seqs.push(submergedMove('walk', ['ctrl', 'w'], 70, -5, yaw, pitch));
    }
  }
  for (const yaw of yaws) {
    for (const pitch of pitches) {
      seqs.push(submergedMove('sprint', ['ctrl', 'w'], 30, -5, yaw, pitch));
    }
  }

  // Depth sweep
  for (let d = -2; d >= -8; d--) seqs.push(submergedMove('walk', ['w'], 30, d));

  // Depth strider
  for (let level = 1; level <= 3; level++) seqs.push(depthStriderMove(level, 40));

  // State transitions
  const subPos: Pos = { x: WP.x, y: -5, z: WP.z };
  seqs.push(mkSeq('water_walk_to_sprint', 'Walk → sprint transition in water', (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', 15)
      .keyDown('ctrl')
      .waitFor('player_auth_input', 15)
      .keyUp('ctrl', 'w')
      .waitFor('player_auth_input', 3),
    subPos));

  seqs.push(mkSeq('water_walk_to_sneak', 'Walk → sneak transition in water', (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', 15)
      .keyUp('w')
      .keyDown('shift', 'w')
      .waitFor('player_auth_input', 15)
      .keyUp('shift', 'w')
      .waitFor('player_auth_input', 3),
    subPos));

  seqs.push(mkSeq('water_sprint_to_stop', 'Sprint → stop in water', (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', 20)
      .keyUp('ctrl', 'w')
      .waitFor('player_auth_input', 30),
    subPos));

  return {
    name: 'v2_water_physics',
    description: 'Water physics: submerged, surface, entry/exit, gravity, depth strider, transitions',
    sequences: seqs,
  };
}

registerFixture(buildWaterPhysicsFixture());
