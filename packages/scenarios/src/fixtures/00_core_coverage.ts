// Fixture: Core Coverage
// One representative test per physics system — no sweeps. Quick smoke for
// initial coverage across all mechanics.
//
// Ported from v2 `recorder/src/fixtures2/00_core_coverage.ts`. The commented-
// out v11 boat / bubble-column / elytra cases are kept commented to match v2's
// behavior; reactivate by porting from v2 if you need them.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const ANCHORS = {
  flat: sceneAnchor(SCENES.flat),
  iceSurface: sceneAnchor(SCENES.iceSurface),
  soulSandSurface: sceneAnchor(SCENES.soulSandSurface),
  honeySurface: sceneAnchor(SCENES.honeySurface),
  slimeSurface: sceneAnchor(SCENES.slimeSurface),
  waterPool: sceneAnchor(SCENES.waterPool),
  waterHalfPool: sceneAnchor(SCENES.waterHalfPool),
  lavaPool: sceneAnchor(SCENES.lavaPool),
  ladderWall: sceneAnchor(SCENES.ladderWall),
  cobwebField: sceneAnchor(SCENES.cobwebField),
  powderSnowField: sceneAnchor(SCENES.powderSnowField),
  collisionWalls: sceneAnchor(SCENES.collisionWalls),
  sneakEdgePlatform: sceneAnchor(SCENES.sneakEdgePlatform),
  berryBushField: sceneAnchor(SCENES.berryBushField),
};

const flat: Pos = { x: SCENES.flat.x, y: 0, z: SCENES.flat.z };

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos,
  yaw = 0,
  pitch = 0,
  anchor: Pos = ANCHORS.flat,
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

function move(name: string, description: string, keys: string[], ticks: number, pos: Pos, anchor: Pos, yaw = 0): SimulationSequence {
  return mkSeq(
    name, description,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    pos, yaw, 0, anchor,
  );
}

function withEffect(
  name: string, description: string, effectCmd: string,
  run: (b: SimulationBuilder) => SimulationBuilder, pos: Pos, anchor: Pos,
): SimulationSequence {
  return mkSeq(
    name, description, run, pos, 0, 0, anchor,
    `apply effect: ${effectCmd}`,
    (b) => b.command(effectCmd),
  );
}

function withBoots(
  name: string, description: string, enchantJson: string,
  run: (b: SimulationBuilder) => SimulationBuilder, pos: Pos, anchor: Pos,
): SimulationSequence {
  return mkSeq(
    name, description, run, pos, 0, 0, anchor,
    `equip enchanted diamond_boots: ${enchantJson}`,
    (b) => b.command(`replaceitem entity \${PLAYER} slot.armor.feet 0 diamond_boots 1 0 ${enchantJson}`),
  );
}

function buildCoreCoverageFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  // ─── 1. Ground Movement ─────────────────────────────────────────────
  seqs.push(move('ground_walk_forward', 'Walk forward 20t', ['w'], 20, flat, ANCHORS.flat));
  seqs.push(move('ground_sprint_forward', 'Sprint forward 20t', ['ctrl', 'w'], 20, flat, ANCHORS.flat));
  seqs.push(move('ground_sneak_forward', 'Sneak forward 20t', ['shift', 'w'], 20, flat, ANCHORS.flat));
  seqs.push(move('ground_walk_backward', 'Walk backward 15t', ['s'], 15, flat, ANCHORS.flat));
  seqs.push(move('ground_strafe_left', 'Strafe left 15t', ['a'], 15, flat, ANCHORS.flat));
  seqs.push(move('ground_sprint_diagonal', 'Sprint diagonal w+a 20t', ['ctrl', 'w', 'a'], 20, flat, ANCHORS.flat));
  seqs.push(mkSeq('ground_decelerate', 'Walk 15t, release, observe deceleration',
    (b) => b.keyDown('w').waitFor('player_auth_input', 15).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    flat));
  seqs.push(mkSeq('ground_sprint_to_sneak', 'Sprint 10t → sneak 10t transition',
    (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 10).keyUp('ctrl').keyDown('shift')
      .waitFor('player_auth_input', 10).keyUp('shift', 'w').waitUntilStable().waitFor('player_auth_input', 1),
    flat));
  seqs.push(move('ground_walk_yaw90', 'Walk at yaw=90 (strafe equivalent)', ['w'], 20, flat, ANCHORS.flat, 90));

  // ─── 2. Jump Mechanics ──────────────────────────────────────────────
  seqs.push(mkSeq('jump_standing', 'Standing jump',
    (b) => b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitUntilStable(30).waitFor('player_auth_input', 1),
    flat));
  seqs.push(mkSeq('jump_walk', 'Walk+jump 15t',
    (b) => b.keyDown('w', 'space').waitFor('player_auth_input', 15).keyUp('w', 'space').waitUntilStable(30).waitFor('player_auth_input', 1),
    flat));
  seqs.push(mkSeq('jump_sprint', 'Sprint+jump 20t',
    (b) => b.keyDown('ctrl', 'w', 'space').waitFor('player_auth_input', 20).keyUp('ctrl', 'w', 'space').waitUntilStable(30).waitFor('player_auth_input', 1),
    flat));
  seqs.push(mkSeq('jump_bunny_hop', 'Bunny hop 40t',
    (b) => b.keyDown('w', 'space').waitFor('player_auth_input', 40).keyUp('w', 'space').waitUntilStable(30).waitFor('player_auth_input', 1),
    flat));

  // ─── 3. Air Movement ────────────────────────────────────────────────
  seqs.push(mkSeq('air_free_fall_h50', 'Free fall from y=50',
    (b) => b.waitUntilStable().waitFor('player_auth_input', 1),
    { x: flat.x, y: 50, z: flat.z }));
  seqs.push(mkSeq('air_fall_walk_h50', 'Fall from y=50 with walk',
    (b) => b.keyDown('w').waitUntilStable().keyUp('w').waitFor('player_auth_input', 5),
    { x: flat.x, y: 50, z: flat.z }));
  seqs.push(mkSeq('air_sprint_jump_momentum', 'Sprint+jump then release all (momentum)',
    (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 10).keyDown('space')
      .waitFor('player_auth_input', 1).keyUp('space', 'ctrl', 'w').waitUntilStable(3).waitFor('player_auth_input', 1),
    flat));

  // ─── 4. Ice ─────────────────────────────────────────────────────────
  const icePos: Pos = { x: SCENES.iceSurface.x, y: 0, z: SCENES.iceSurface.z };
  seqs.push(move('ice_walk', 'Walk on ice 30t', ['w'], 30, icePos, ANCHORS.iceSurface));
  seqs.push(move('ice_sprint', 'Sprint on ice 30t', ['ctrl', 'w'], 30, icePos, ANCHORS.iceSurface));
  seqs.push(mkSeq('ice_slide', 'Sprint then release on ice (slide)',
    (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 15).keyUp('ctrl', 'w').waitUntilStable().waitFor('player_auth_input', 1),
    icePos, 0, 0, ANCHORS.iceSurface));

  // ─── 5. Soul Sand ───────────────────────────────────────────────────
  const soulPos: Pos = { x: SCENES.soulSandSurface.x, y: 0, z: SCENES.soulSandSurface.z };
  seqs.push(move('soul_sand_walk', 'Walk on soul sand', ['w'], 20, soulPos, ANCHORS.soulSandSurface));
  seqs.push(move('soul_sand_sprint', 'Sprint on soul sand', ['ctrl', 'w'], 20, soulPos, ANCHORS.soulSandSurface));

  // ─── 6. Honey & Slime ───────────────────────────────────────────────
  const honeyPos: Pos = { x: SCENES.honeySurface.x, y: 0, z: SCENES.honeySurface.z };
  seqs.push(move('honey_walk', 'Walk on honey', ['w'], 20, honeyPos, ANCHORS.honeySurface));
  seqs.push(mkSeq('honey_jump', 'Jump on honey',
    (b) => b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitUntilStable(30).waitFor('player_auth_input', 1),
    honeyPos, 0, 0, ANCHORS.honeySurface));

  const slimePos: Pos = { x: SCENES.slimeSurface.x, y: 0, z: SCENES.slimeSurface.z };
  seqs.push(mkSeq('slime_bounce_h5', 'Fall on slime from y=5',
    (b) => b.waitUntilStable(30).waitFor('player_auth_input', 1),
    { x: slimePos.x, y: 5, z: slimePos.z }, 0, 0, ANCHORS.slimeSurface));
  seqs.push(mkSeq('slime_sneak_fall_h5', 'Sneak-fall on slime from y=5 (suppress bounce)',
    (b) => b.keyDown('shift').waitUntilStable(30).keyUp('shift').waitFor('player_auth_input', 1),
    { x: slimePos.x, y: 5, z: slimePos.z }, 0, 0, ANCHORS.slimeSurface));

  // ─── 7. Water ───────────────────────────────────────────────────────
  const waterSub: Pos = { x: SCENES.waterPool.x, y: -5, z: SCENES.waterPool.z };
  const waterSurf: Pos = { x: SCENES.waterPool.x, y: 0, z: SCENES.waterPool.z };
  const applyWB = (b: SimulationBuilder) => b.command('effect ${PLAYER} water_breathing 9999 0 true');

  seqs.push(mkSeq('water_sub_walk', 'Walk submerged 30t', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    waterSub, 0, 0, ANCHORS.waterPool, 'apply water_breathing', applyWB));
  seqs.push(mkSeq('water_sub_sprint', 'Sprint submerged 30t', (b) =>
    b.keyDown('ctrl', 'w').waitFor('player_auth_input', 30).keyUp('ctrl', 'w').waitUntilStable().waitFor('player_auth_input', 1),
    waterSub, 0, 0, ANCHORS.waterPool, 'apply water_breathing', applyWB));
  seqs.push(mkSeq('water_swim_up', 'Swim up 30t', (b) =>
    b.keyDown('space').waitFor('player_auth_input', 30).keyUp('space').waitFor('player_auth_input', 20),
    waterSub, 0, 0, ANCHORS.waterPool, 'apply water_breathing', applyWB));
  seqs.push(mkSeq('water_swim_down', 'Swim down 30t', (b) =>
    b.keyDown('shift').waitFor('player_auth_input', 30).keyUp('shift').waitFor('player_auth_input', 20),
    { x: waterSub.x, y: -2, z: waterSub.z }, 0, 0, ANCHORS.waterPool, 'apply water_breathing', applyWB));
  seqs.push(mkSeq('water_surface_walk', 'Walk on water surface', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    waterSurf, 0, 0, ANCHORS.waterPool, 'apply water_breathing', applyWB));
  seqs.push(mkSeq('water_gravity_h5', 'Fall into water from y=5', (b) =>
    b.waitUntilStable().waitFor('player_auth_input', 1),
    { x: waterSurf.x, y: 5, z: waterSurf.z }, 0, 0, ANCHORS.waterPool, 'apply water_breathing', applyWB));

  // Water entry/exit on half pool
  const whpDry: Pos = { x: SCENES.waterHalfPool.x - 5, y: 0, z: SCENES.waterHalfPool.z };
  const whpWet: Pos = { x: SCENES.waterHalfPool.x + 3, y: -3, z: SCENES.waterHalfPool.z };
  seqs.push(mkSeq('water_entry_walk', 'Walk into water from dry side', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 30),
    whpDry, 90, 0, ANCHORS.waterHalfPool, 'apply water_breathing', applyWB));
  seqs.push(mkSeq('water_exit_walk', 'Walk out of water', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 60).keyUp('w').waitFor('player_auth_input', 60),
    whpWet, 270, 0, ANCHORS.waterHalfPool, 'apply water_breathing', applyWB));

  // Depth strider 3
  seqs.push(withBoots(
    'water_depth_strider_3', 'Walk submerged with Depth Strider III',
    '{"minecraft:enchantable":{"slot":"armor_feet"},"minecraft:enchantments":{"value":{"depth_strider":3}}}',
    (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 20),
    waterSub, ANCHORS.waterPool,
  ));

  // ─── 8. Lava ────────────────────────────────────────────────────────
  const lavaSub: Pos = { x: SCENES.lavaPool.x, y: -5, z: SCENES.lavaPool.z };
  const applyLava = (b: SimulationBuilder) => b.command('effect ${PLAYER} fire_resistance 9999 0 true');

  seqs.push(mkSeq('lava_sub_walk', 'Walk submerged in lava 30t', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    lavaSub, 0, 0, ANCHORS.lavaPool, 'apply fire_resistance', applyLava));
  seqs.push(mkSeq('lava_swim_up', 'Swim up in lava 30t', (b) =>
    b.keyDown('space').waitFor('player_auth_input', 30).keyUp('space').waitFor('player_auth_input', 20),
    lavaSub, 0, 0, ANCHORS.lavaPool, 'apply fire_resistance', applyLava));

  // ─── 9. Creative Flight ─────────────────────────────────────────────
  const flyPos: Pos = { x: flat.x, y: 50, z: flat.z };
  seqs.push(mkSeq('flight_creative_forward', 'Double-tap space + walk forward (creative)', (b) =>
    b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 3)
      .keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 5)
      .keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 20),
    flyPos));
  seqs.push(mkSeq('flight_creative_ascend_descend', 'Creative flight ascend then descend', (b) =>
    b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 3)
      .keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 5)
      .keyDown('space').waitFor('player_auth_input', 15).keyUp('space')
      .keyDown('shift').waitFor('player_auth_input', 15).keyUp('shift').waitFor('player_auth_input', 20),
    flyPos));

  // ─── 10. Climbing (ladder) ──────────────────────────────────────────
  const ladderBase: Pos = { x: SCENES.ladderWall.x, y: 0, z: SCENES.ladderWall.z + 2 };
  seqs.push(mkSeq('ladder_ascend', 'Walk + jump into ladder, climb up', (b) =>
    b.keyDown('w', 'space').waitFor('player_auth_input', 30).keyUp('w', 'space').waitFor('player_auth_input', 20),
    ladderBase, 0, 0, ANCHORS.ladderWall));
  seqs.push(mkSeq('ladder_sneak_hold', 'Sneak on ladder (no slide)', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 10).keyUp('w').keyDown('shift')
      .waitFor('player_auth_input', 20).keyUp('shift').waitFor('player_auth_input', 10),
    ladderBase, 0, 0, ANCHORS.ladderWall));

  // ─── 11. Status Effects ─────────────────────────────────────────────
  seqs.push(withEffect('effect_speed1_walk', 'Walk with Speed I',
    'effect ${PLAYER} speed 30 0 true',
    (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    flat, ANCHORS.flat));
  seqs.push(withEffect('effect_slowness1_walk', 'Walk with Slowness I',
    'effect ${PLAYER} slowness 30 0 true',
    (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    flat, ANCHORS.flat));
  seqs.push(withEffect('effect_jump_boost1', 'Jump with Jump Boost I',
    'effect ${PLAYER} jump_boost 30 0 true',
    (b) => b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitUntilStable(30).waitFor('player_auth_input', 1),
    flat, ANCHORS.flat));
  seqs.push(withEffect('effect_levitation1', 'Levitation I',
    'effect ${PLAYER} levitation 5 0 true',
    (b) => b.waitFor('player_auth_input', 60).waitUntilStable().waitFor('player_auth_input', 1),
    flat, ANCHORS.flat));
  seqs.push(withEffect('effect_slow_falling_h20', 'Slow falling from y=20',
    'effect ${PLAYER} slow_falling 30 0 true',
    (b) => b.waitUntilStable().waitFor('player_auth_input', 1),
    { x: flat.x, y: 20, z: flat.z }, ANCHORS.flat));

  // ─── 12. Block Interactions ─────────────────────────────────────────
  const cobwebApproach: Pos = { x: SCENES.cobwebField.x, y: 0, z: SCENES.cobwebField.z - 7 };
  seqs.push(mkSeq('cobweb_walk_through', 'Walk through cobwebs', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w').waitFor('player_auth_input', 20),
    cobwebApproach, 0, 0, ANCHORS.cobwebField));

  const snowApproach: Pos = { x: SCENES.powderSnowField.x, y: 0, z: SCENES.powderSnowField.z - 7 };
  seqs.push(mkSeq('powder_snow_walk_in', 'Walk into powder snow', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 30),
    snowApproach, 0, 0, ANCHORS.powderSnowField));

  // ─── 13. Collision ──────────────────────────────────────────────────
  const wallPos: Pos = { x: SCENES.collisionWalls.x, y: 0, z: SCENES.collisionWalls.z + 3 };
  seqs.push(mkSeq('collision_wall_walk', 'Walk into collision wall', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w').waitFor('player_auth_input', 10),
    wallPos, 0, 0, ANCHORS.collisionWalls));

  // ─── 14. Sneak Edge ─────────────────────────────────────────────────
  const edgePos: Pos = { x: SCENES.sneakEdgePlatform.x, y: 5, z: SCENES.sneakEdgePlatform.z };
  seqs.push(mkSeq('sneak_edge_forward', 'Sneak forward off platform', (b) =>
    b.keyDown('shift', 'w').waitFor('player_auth_input', 90).keyUp('shift', 'w').waitFor('player_auth_input', 10),
    edgePos, 0, 0, ANCHORS.sneakEdgePlatform));

  // ─── 15. Pose Transitions ───────────────────────────────────────────
  seqs.push(mkSeq('pose_sneak_toggle', 'Stand→sneak→stand→sneak→stand cycle',
    (b) => b.keyDown('shift').waitFor('player_auth_input', 10).keyUp('shift').waitFor('player_auth_input', 10)
      .keyDown('shift').waitFor('player_auth_input', 10).keyUp('shift').waitFor('player_auth_input', 10),
    flat));

  // ─── 18. Knockback ──────────────────────────────────────────────────
  seqs.push(mkSeq('knockback_damage', 'Standing still, take 1 damage', (b) =>
    b.command('damage ${PLAYER} 1').waitUntilStable().waitFor('player_auth_input', 1),
    flat));

  // ─── 19. Teleportation ──────────────────────────────────────────────
  seqs.push(mkSeq('teleport_while_walking', 'Teleport while walking forward', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 10).teleport(flat.x + 10, flat.y, flat.z, 0, 0)
      .waitFor('player_auth_input', 15).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    flat));

  // ─── 20. Berry Bush ─────────────────────────────────────────────────
  const berryApproach: Pos = { x: SCENES.berryBushField.x, y: 0, z: SCENES.berryBushField.z - 7 };
  seqs.push(mkSeq('berry_bush_walk', 'Walk through berry bushes', (b) =>
    b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 20),
    berryApproach, 0, 0, ANCHORS.berryBushField));

  // ─── 22. Multi-System Compound ──────────────────────────────────────
  seqs.push(withEffect('compound_speed_on_ice', 'Walk on ice with Speed II',
    'effect ${PLAYER} speed 30 1 true',
    (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    icePos, ANCHORS.iceSurface));
  seqs.push(mkSeq('compound_sprint_jump_into_water', 'Sprint + jump from land into half-pool', (b) =>
    b.keyDown('ctrl', 'w', 'space').waitFor('player_auth_input', 50).keyUp('ctrl', 'w', 'space').waitFor('player_auth_input', 50),
    whpDry, 90, 0, ANCHORS.waterHalfPool));

  // ─── 23. Edge cases ─────────────────────────────────────────────────
  seqs.push(mkSeq('edge_opposing_ws', 'Press w+s simultaneously',
    (b) => b.keyDown('w', 's').waitFor('player_auth_input', 15).keyUp('w', 's').waitUntilStable().waitFor('player_auth_input', 1),
    flat));
  seqs.push(mkSeq('edge_1tick_walk', '1-tick walk (minimum input)',
    (b) => b.keyDown('w').waitFor('player_auth_input', 1).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    flat));

  return {
    name: 'v2_core_coverage',
    description: 'Core coverage — one representative case per physics system',
    sequences: seqs,
  };
}

registerFixture(buildCoreCoverageFixture());
