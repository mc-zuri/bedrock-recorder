// Fixture: Prismarine-Bedrock Physics Regression Suite
//
// Minimal scenarios for prismarine-bedrock's physics test harness. Each test
// case isolates a single physics primitive on a clean surface so divergences
// show up clearly.
//
// Ported from v2 `recorder/src/fixtures2/30_prismarine_physics.ts` (1235 lines).
// All cases now run through `sceneTestCase` so each starts from a per-scene
// safe-zone teleport with chunks pre-loaded; long-fall / cobweb / berry-bush
// cases that v2 hand-applied resistance to no longer need to — the helper's
// preamble does it already.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const ANCHORS = {
  flat: sceneAnchor(SCENES.flat),
  collisionWalls: sceneAnchor(SCENES.collisionWalls),
  sneakEdgePlatform: sceneAnchor(SCENES.sneakEdgePlatform),
  slabArea: sceneAnchor(SCENES.slabArea),
  stairsArea: sceneAnchor(SCENES.stairsArea),
  ceilingRoom: sceneAnchor(SCENES.ceilingRoom),
  iceSurface: sceneAnchor(SCENES.iceSurface),
  packedIceSurface: sceneAnchor(SCENES.packedIceSurface),
  blueIceSurface: sceneAnchor(SCENES.blueIceSurface),
  honeySurface: sceneAnchor(SCENES.honeySurface),
  slimeSurface: sceneAnchor(SCENES.slimeSurface),
  soulSandSurface: sceneAnchor(SCENES.soulSandSurface),
  soulSoilSurface: sceneAnchor(SCENES.soulSoilSurface),
  ladderWall: sceneAnchor(SCENES.ladderWall),
  scaffoldingTower: sceneAnchor(SCENES.scaffoldingTower),
  vineWall: sceneAnchor(SCENES.vineWall),
  waterPool: sceneAnchor(SCENES.waterPool),
  lavaPool: sceneAnchor(SCENES.lavaPool),
  cobwebField: sceneAnchor(SCENES.cobwebField),
  berryBushField: sceneAnchor(SCENES.berryBushField),
  powderSnowField: sceneAnchor(SCENES.powderSnowField),
  bubbleUpColumn: sceneAnchor(SCENES.bubbleUpColumn),
  bubbleDownColumn: sceneAnchor(SCENES.bubbleDownColumn),
  fenceArea: sceneAnchor(SCENES.fenceArea),
  flatPit: sceneAnchor(SCENES.flatPit),
};

const flatPos: Pos = { x: SCENES.flat.x, y: 0, z: SCENES.flat.z };
const dropPos: Pos = { x: SCENES.flat.x, y: 20, z: SCENES.flat.z };

function mkSeq(
  name: string,
  description: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos = flatPos,
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

// ─── flat scene ────────────────────────────────────────────────────────

const fallNoInput = () => mkSeq('pb_fall_no_input',
  'Fall from y=20 with no input — gravity + y-decay + onGround latch',
  (b) => b.waitFor('player_auth_input', 40).waitUntilStable(10),
  dropPos);

const walkForward30Stop20 = () => mkSeq('pb_walk_forward_30_stop_20',
  'Walk forward 30 ticks, release, settle 20 — ground accel + friction',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitFor('player_auth_input', 20).waitUntilStable(10));

const walkYawRotate = () => mkSeq('pb_walk_yaw_rotate',
  'Walk forward while yaw rotates 0→90° via mouseMove — camera-relative accel',
  (b) => {
    b.keyDown('w');
    for (let i = 0; i < 60; i++) b.mouseMove(5, 0).waitFor('player_auth_input', 1);
    return b.keyUp('w').waitUntilStable(10).waitFor('player_auth_input', 5);
  });

const walkJump = () => mkSeq('pb_walk_jump',
  'Walk + tap space every 12t × 3 — jump velocity + gravity timing',
  (b) => {
    b.keyDown('w');
    for (let i = 0; i < 3; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 11);
    }
    return b.keyUp('w').waitUntilStable(10).waitFor('player_auth_input', 5);
  });

const sneakForward = () => mkSeq('pb_sneak_forward',
  'Sneak forward 30 ticks — SNEAK_INPUT_SCALE',
  (b) => b.keyDown('shift', 'w').waitFor('player_auth_input', 30).keyUp('shift', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const sprintForward = () => mkSeq('pb_sprint_forward',
  'Sprint forward 30 ticks — 1.3× multiplier + sprint preservation',
  (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 30).keyUp('ctrl', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const sprintJump5x = () => mkSeq('pb_sprint_jump_5x',
  'Sprint + tap space × 5 — SPRINT_JUMP_BOOST + sprint across air ticks',
  (b) => {
    b.keyDown('ctrl', 'w');
    for (let i = 0; i < 5; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 7);
    }
    return b.keyUp('ctrl', 'w').waitUntilStable(10).waitFor('player_auth_input', 5);
  });

const sprintJumpYawRotate = () => mkSeq('pb_sprint_jump_yaw_rotate',
  'Sprint + jump + yaw rotate — air-control yaw math',
  (b) => {
    b.keyDown('ctrl', 'w');
    for (let i = 0; i < 5; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space');
      for (let j = 0; j < 7; j++) b.mouseMove(15, 0).waitFor('player_auth_input', 1);
    }
    return b.keyUp('ctrl', 'w').waitUntilStable(10).waitFor('player_auth_input', 5);
  });

const walkBackward = () => mkSeq('pb_walk_backward', 'Walk backward (s) — input.z = -1',
  (b) => b.keyDown('s').waitFor('player_auth_input', 30).keyUp('s')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const strafeLeft = () => mkSeq('pb_strafe_left', 'Strafe left (a) — input.x ≠ 0',
  (b) => b.keyDown('a').waitFor('player_auth_input', 30).keyUp('a')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const strafeRight = () => mkSeq('pb_strafe_right', 'Strafe right (d)',
  (b) => b.keyDown('d').waitFor('player_auth_input', 30).keyUp('d')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const walkDiagonalWA = () => mkSeq('pb_walk_diagonal_wa',
  'Walk diagonal w+a — input length > 1, normalized',
  (b) => b.keyDown('w', 'a').waitFor('player_auth_input', 30).keyUp('w', 'a')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const walkDiagonalWD = () => mkSeq('pb_walk_diagonal_wd', 'Walk diagonal w+d',
  (b) => b.keyDown('w', 'd').waitFor('player_auth_input', 30).keyUp('w', 'd')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const walkBackwardDiagonalSA = () => mkSeq('pb_walk_diagonal_sa', 'Walk diagonal s+a',
  (b) => b.keyDown('s', 'a').waitFor('player_auth_input', 30).keyUp('s', 'a')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const forwardThenBackward = () => mkSeq('pb_forward_then_backward', 'Walk forward 20t, then backward 20t',
  (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w')
    .keyDown('s').waitFor('player_auth_input', 20).keyUp('s')
    .waitUntilStable(10).waitFor('player_auth_input', 5));

const jumpInPlace = () => mkSeq('pb_jump_in_place', 'Jump in place × 3 — pure vertical impulse',
  (b) => {
    for (let i = 0; i < 3; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 14);
    }
    return b.waitUntilStable(10).waitFor('player_auth_input', 5);
  });

const walkWhileFalling = () => mkSeq('pb_walk_while_falling',
  'Walk while falling — AIR_ACCEL_WALK + air friction',
  (b) => b.keyDown('w').waitFor('player_auth_input', 35).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  dropPos);

const sprintWhileFalling = () => mkSeq('pb_sprint_while_falling',
  'Sprint while falling — AIR_ACCEL_SPRINT',
  (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 35).keyUp('ctrl', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  dropPos);

const sneakWhileFalling = () => mkSeq('pb_sneak_while_falling',
  'Sneak while falling — sneak input scale + air accel',
  (b) => b.keyDown('shift', 'w').waitFor('player_auth_input', 35).keyUp('shift', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  dropPos);

const fallFromHigh = () => mkSeq('pb_fall_from_high',
  'Fall from y=80 — long-fall path',
  (b) => b.waitFor('player_auth_input', 120).waitUntilStable(20).waitFor('player_auth_input', 5),
  { x: SCENES.flat.x, y: 80, z: SCENES.flat.z });

// ─── collisionWalls scene ──────────────────────────────────────────────

const CW = SCENES.collisionWalls;
const wallApproachPos: Pos = { x: CW.x - 3, y: 0, z: CW.z + 7 };
const cornerWalkPos:   Pos = { x: CW.x + 7, y: 0, z: CW.z - 8 };
const gapSqueezePos:   Pos = { x: CW.x - 12, y: 0, z: CW.z - 8 };
const wallAirbornePos: Pos = { x: CW.x - 8, y: 0, z: CW.z + 7 };

const wallWalkPerp = () => mkSeq('pb_wall_walk_perp',
  'Walk straight into wall — horizontalCollision, vel.x/z → 0',
  (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  wallApproachPos, 270, 0, ANCHORS.collisionWalls);

const wallWalkAngled30 = () => mkSeq('pb_wall_walk_angled_30',
  'Walk into wall at 30° — partial-axis clip (X hits, Z survives)',
  (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  wallApproachPos, 240, 0, ANCHORS.collisionWalls);

const wallSprintAir = () => mkSeq('pb_wall_sprint_air',
  'Sprint into wall mid-jump — air friction (0.91) path',
  (b) => b.keyDown('ctrl', 'w', 'space').waitFor('player_auth_input', 1).keyUp('space')
    .waitFor('player_auth_input', 20).keyUp('ctrl', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  wallApproachPos, 270, 0, ANCHORS.collisionWalls);

const wallWalkCorner = () => mkSeq('pb_wall_walk_corner',
  'Walk into a corner — two-axis simultaneous clip',
  (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  cornerWalkPos, 225, 0, ANCHORS.collisionWalls);

const wallWalkThinGap = () => mkSeq('pb_wall_walk_thin_gap',
  'Walk through narrow gap — AABB squeeze',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  gapSqueezePos, 0, 0, ANCHORS.collisionWalls);

const jumpOverAirborneWall = () => mkSeq('pb_jump_over_airborne_wall',
  'Walk + jump over airborne wall',
  (b) => b.keyDown('w').waitFor('player_auth_input', 10).keyDown('space')
    .waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 20)
    .keyUp('w').waitUntilStable(10).waitFor('player_auth_input', 5),
  wallAirbornePos, 0, 0, ANCHORS.collisionWalls);

// ─── sneakEdgePlatform scene ───────────────────────────────────────────

const SE = SCENES.sneakEdgePlatform;
const edgePlatformPos: Pos = { x: SE.x, y: 5, z: SE.z + 4 };

const sneakToEdge = () => mkSeq('pb_sneak_to_edge',
  'Sneak forward off platform edge — SneakMovementSystem clamp',
  (b) => b.keyDown('shift', 'w').waitFor('player_auth_input', 80).keyUp('shift', 'w')
    .waitFor('player_auth_input', 10),
  edgePlatformPos, 0, 0, ANCHORS.sneakEdgePlatform);

const walkOffEdge = () => mkSeq('pb_walk_off_edge',
  'Walk off platform edge (no sneak) — onGround true→false transition',
  (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  edgePlatformPos, 0, 0, ANCHORS.sneakEdgePlatform);

const sprintOffEdge = () => mkSeq('pb_sprint_off_edge',
  'Sprint off edge — sprint preservation across ground→air',
  (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 25).keyUp('ctrl', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  edgePlatformPos, 0, 0, ANCHORS.sneakEdgePlatform);

// ─── slabArea / stairsArea / ceilingRoom ───────────────────────────────

const stepUpSlab = () => mkSeq('pb_step_up_slab',
  'Walk onto bottom slab — step-up (slab=0.5, stepHeight=0.6)',
  (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.slabArea.x - 3, y: 0, z: SCENES.slabArea.z - 7 }, 0, 0, ANCHORS.slabArea);

const walkUpStairs = () => mkSeq('pb_walk_up_stairs',
  'Walk up stairs — repeated step-ups',
  (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.stairsArea.x - 12, y: 0, z: SCENES.stairsArea.z - 10 }, 270, 0, ANCHORS.stairsArea);

const jumpIntoCeiling = () => mkSeq('pb_jump_into_ceiling',
  'Jump into low ceiling — vel.y zeroed mid-jump',
  (b) => b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.ceilingRoom.x - 5, y: 0, z: SCENES.ceilingRoom.z - 5 }, 0, 0, ANCHORS.ceilingRoom);

// ─── friction surfaces ────────────────────────────────────────────────

const walkOnIce = () => mkSeq('pb_walk_on_ice',
  'Walk on ice — slip=0.98, large accel + low friction',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.iceSurface.x, y: 0, z: SCENES.iceSurface.z }, 0, 0, ANCHORS.iceSurface);

const walkOnPackedIce = () => mkSeq('pb_walk_on_packed_ice',
  'Walk on packed ice — slip=0.98 (separate friction lookup)',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.packedIceSurface.x, y: 0, z: SCENES.packedIceSurface.z }, 0, 0, ANCHORS.packedIceSurface);

const walkOnBlueIce = () => mkSeq('pb_walk_on_blue_ice',
  'Walk on blue ice — slip=0.989, max slipperiness',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  { x: SCENES.blueIceSurface.x, y: 0, z: SCENES.blueIceSurface.z }, 0, 0, ANCHORS.blueIceSurface);

// honey
const honeyWalkPos: Pos = { x: SCENES.honeySurface.x, y: 0, z: SCENES.honeySurface.z };
const honeyFallPos: Pos = { x: SCENES.honeySurface.x, y: 20, z: SCENES.honeySurface.z };

const walkOnHoney = () => mkSeq('pb_walk_on_honey',
  'Walk on honey — friction=0.4 (sticky)',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  honeyWalkPos, 0, 0, ANCHORS.honeySurface);

const fallOntoHoney = () => mkSeq('pb_fall_onto_honey',
  'Fall onto honey from y=20',
  (b) => b.waitFor('player_auth_input', 50).waitUntilStable(15).waitFor('player_auth_input', 5),
  honeyFallPos, 0, 0, ANCHORS.honeySurface);

const jumpOnHoney = () => mkSeq('pb_jump_on_honey',
  'Jump on honey × 3 — reduced jump',
  (b) => {
    for (let i = 0; i < 3; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 14);
    }
    return b.waitUntilStable(10).waitFor('player_auth_input', 5);
  }, honeyWalkPos, 0, 0, ANCHORS.honeySurface);

const sprintOntoHoney = () => mkSeq('pb_sprint_onto_honey',
  'Sprint onto honey — sprint+sticky transition',
  (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 30).keyUp('ctrl', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  honeyWalkPos, 0, 0, ANCHORS.honeySurface);

// slime
const slimeWalkPos: Pos = { x: SCENES.slimeSurface.x, y: 0, z: SCENES.slimeSurface.z };
const slimeFallPos: Pos = { x: SCENES.slimeSurface.x, y: 20, z: SCENES.slimeSurface.z + 5 };
const slimeFallHighPos: Pos = { x: SCENES.slimeSurface.x, y: 40, z: SCENES.slimeSurface.z + 5 };

const walkOnSlime = () => mkSeq('pb_walk_on_slime',
  'Walk on slime — friction=0.8',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  slimeWalkPos, 0, 0, ANCHORS.slimeSurface);

const fallOntoSlime = () => mkSeq('pb_fall_onto_slime',
  'Fall onto slime from y=20 — bounce',
  (b) => b.waitFor('player_auth_input', 60).waitUntilStable(20).waitFor('player_auth_input', 5),
  slimeFallPos, 0, 0, ANCHORS.slimeSurface);

const fallOntoSlimeHigh = () => mkSeq('pb_fall_onto_slime_high',
  'Fall onto slime from y=40 — larger bounce decay',
  (b) => b.waitFor('player_auth_input', 100).waitUntilStable(25).waitFor('player_auth_input', 5),
  slimeFallHighPos, 0, 0, ANCHORS.slimeSurface);

const jumpOnSlime = () => mkSeq('pb_jump_on_slime',
  'Jump on slime × 3 — amplified bounce',
  (b) => {
    for (let i = 0; i < 3; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 14);
    }
    return b.waitUntilStable(10).waitFor('player_auth_input', 5);
  }, slimeWalkPos, 0, 0, ANCHORS.slimeSurface);

const jumpAndSneakOnSlime = () => mkSeq('pb_jump_and_sneak_on_slime',
  'Jump + sneak on slime — sneak suppresses bounce',
  (b) => {
    b.keyDown('shift');
    for (let i = 0; i < 3; i++) {
      b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space').waitFor('player_auth_input', 14);
    }
    return b.keyUp('shift').waitUntilStable(10).waitFor('player_auth_input', 5);
  }, slimeWalkPos, 0, 0, ANCHORS.slimeSurface);

const sneakWalkOnSlime = () => mkSeq('pb_sneak_walk_on_slime',
  'Sneak walk on slime',
  (b) => b.keyDown('shift', 'w').waitFor('player_auth_input', 30).keyUp('shift', 'w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  slimeWalkPos, 0, 0, ANCHORS.slimeSurface);

// soul sand/soil
const walkOnSoulSand = () => mkSeq('pb_walk_on_soul_sand',
  'Walk on soul sand — friction=0.4 + top-surface slowdown',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.soulSandSurface.x, y: 0, z: SCENES.soulSandSurface.z }, 0, 0, ANCHORS.soulSandSurface);

const walkOnSoulSoil = () => mkSeq('pb_walk_on_soul_soil',
  'Walk on soul soil',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  { x: SCENES.soulSoilSurface.x, y: 0, z: SCENES.soulSoilSurface.z }, 0, 0, ANCHORS.soulSoilSurface);

// ─── ladder / scaffolding / vine ──────────────────────────────────────

const ladderApproachPos: Pos = { x: SCENES.ladderWall.x, y: 1, z: SCENES.ladderWall.z };

const climbLadderUp = () => mkSeq('pb_climb_ladder_up',
  'Climb ladder up — horizontalCollision triggers isClimbable',
  (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  ladderApproachPos, 0, 0, ANCHORS.ladderWall);

const climbLadderJumpOff = () => mkSeq('pb_climb_ladder_jump_off',
  'Climb ladder, then walk back off — gravity resumes',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .keyDown('s').waitFor('player_auth_input', 15).keyUp('s')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  ladderApproachPos, 0, 0, ANCHORS.ladderWall);

const SC = SCENES.scaffoldingTower;
const scaffBase: Pos = { x: SC.x, y: 1, z: SC.z };
const scaffHigh: Pos = { x: SC.x, y: 8, z: SC.z };
const scaffTop:  Pos = { x: SC.x, y: 11, z: SC.z };

const climbScaffoldingUp = () => mkSeq('pb_climb_scaffolding_up',
  'Climb scaffolding up (space ascends inside)',
  (b) => b.keyDown('space').waitFor('player_auth_input', 30).keyUp('space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  scaffBase, 0, 0, ANCHORS.scaffoldingTower);

const climbScaffoldingDown = () => mkSeq('pb_climb_scaffolding_down',
  'Climb scaffolding down (shift descends)',
  (b) => b.keyDown('shift').waitFor('player_auth_input', 40).keyUp('shift')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  scaffHigh, 0, 0, ANCHORS.scaffoldingTower);

const scaffoldingHover = () => mkSeq('pb_scaffolding_hover',
  'Hover inside scaffolding (no input)',
  (b) => b.waitFor('player_auth_input', 40).waitUntilStable(15).waitFor('player_auth_input', 5),
  scaffHigh, 0, 0, ANCHORS.scaffoldingTower);

const jumpOffScaffoldingTop = () => mkSeq('pb_jump_off_scaffolding_top',
  'Walk off top of scaffolding',
  (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  scaffTop, 0, 0, ANCHORS.scaffoldingTower);

const VW = SCENES.vineWall;
const vineApproachPos: Pos = { x: VW.x - 7, y: 1, z: VW.z };
const vineOnPos:       Pos = { x: VW.x - 7, y: 5, z: VW.z + 4 };

const climbVineUp = () => mkSeq('pb_climb_vine_up',
  'Climb vine up',
  (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  vineApproachPos, 0, 0, ANCHORS.vineWall);

const vineHangSlowFall = () => mkSeq('pb_vine_hang_slow_fall',
  'Hang on vine (no input) — vine slow-fall',
  (b) => b.waitFor('player_auth_input', 50).waitUntilStable(15).waitFor('player_auth_input', 5),
  vineOnPos, 0, 0, ANCHORS.vineWall);

// ─── water / lava ─────────────────────────────────────────────────────

const WP = SCENES.waterPool;
const waterSubPos: Pos = { x: WP.x, y: -2, z: WP.z };
const waterEntryPos: Pos = { x: WP.x, y: 0, z: WP.z - 12 };
const waterFallPos:  Pos = { x: WP.x, y: 20, z: WP.z };
const waterSurfPos:  Pos = { x: WP.x, y: 0, z: WP.z };

const applyWaterBreathing = (b: SimulationBuilder) => b.command('effect ${PLAYER} water_breathing 9999 0 true');
const applyLavaSafety = (b: SimulationBuilder) =>
  b.command('effect ${PLAYER} fire_resistance 9999 0 true').command('effect ${PLAYER} water_breathing 9999 0 true');

const walkIntoWater = () => mkSeq('pb_walk_into_water', 'Walk into water — entry transition',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterEntryPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const swimUpInWater = () => mkSeq('pb_swim_up_in_water',
  'Swim up submerged — FLUID_BUOYANCY_Y branch',
  (b) => b.keyDown('space').waitFor('player_auth_input', 30).keyUp('space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const sinkInWater = () => mkSeq('pb_sink_in_water', 'Sink in water (no input) — passive fluid gravity',
  (b) => b.waitFor('player_auth_input', 40).waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const fallIntoWater = () => mkSeq('pb_fall_into_water', 'Fall into water from y=20',
  (b) => b.waitFor('player_auth_input', 60).waitUntilStable(20).waitFor('player_auth_input', 5),
  waterFallPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const swimForwardSubmerged = () => mkSeq('pb_swim_forward_submerged', 'Walk forward submerged',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const swimDiagonalSubmerged = () => mkSeq('pb_swim_diagonal_submerged', 'w+space submerged',
  (b) => b.keyDown('w', 'space').waitFor('player_auth_input', 30).keyUp('w', 'space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const floatOnWaterSurface = () => mkSeq('pb_float_on_water_surface', 'Float on water surface (no input)',
  (b) => b.waitFor('player_auth_input', 40).waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSurfPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const swimUpAt45 = () => mkSeq('pb_swim_up_at_45', 'Walk submerged at pitch=-45',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, -45, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const swimDownAt45 = () => mkSeq('pb_swim_down_at_45', 'Walk submerged at pitch=+45',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, 45, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

const swimSprintForward = () => mkSeq('pb_swim_sprint_forward', 'Sprint submerged',
  (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 30).keyUp('ctrl', 'w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  waterSubPos, 0, 0, ANCHORS.waterPool,
  'apply water_breathing', applyWaterBreathing);

// lava
const LP = SCENES.lavaPool;
const lavaSubPos: Pos = { x: LP.x, y: -2, z: LP.z };
const lavaEntryPos: Pos = { x: LP.x, y: 0, z: LP.z - 12 };
const lavaFallPos:  Pos = { x: LP.x, y: 20, z: LP.z };

const walkIntoLava = () => mkSeq('pb_walk_into_lava', 'Walk into lava',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  lavaEntryPos, 0, 0, ANCHORS.lavaPool,
  'apply fire_resistance + water_breathing', applyLavaSafety);

const swimUpInLava = () => mkSeq('pb_swim_up_in_lava', 'Swim up in lava',
  (b) => b.keyDown('space').waitFor('player_auth_input', 30).keyUp('space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  lavaSubPos, 0, 0, ANCHORS.lavaPool,
  'apply fire_resistance + water_breathing', applyLavaSafety);

const sinkInLava = () => mkSeq('pb_sink_in_lava', 'Sink in lava (no input)',
  (b) => b.waitFor('player_auth_input', 40).waitUntilStable(15).waitFor('player_auth_input', 5),
  lavaSubPos, 0, 0, ANCHORS.lavaPool,
  'apply fire_resistance + water_breathing', applyLavaSafety);

const fallIntoLava = () => mkSeq('pb_fall_into_lava', 'Fall into lava from y=20',
  (b) => b.waitFor('player_auth_input', 60).waitUntilStable(20).waitFor('player_auth_input', 5),
  lavaFallPos, 0, 0, ANCHORS.lavaPool,
  'apply fire_resistance + water_breathing', applyLavaSafety);

// ─── cobweb / berry / powder snow ──────────────────────────────────────

const CWF = SCENES.cobwebField;
const cobwebApproachPos: Pos = { x: CWF.x, y: 0, z: CWF.z - 8 };
const cobwebInsidePos:   Pos = { x: CWF.x, y: 3, z: CWF.z };
const cobwebFallPos:     Pos = { x: CWF.x, y: 30, z: CWF.z };

const walkIntoCobweb = () => mkSeq('pb_walk_into_cobweb', 'Walk into cobweb — velocity slowdown',
  (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  cobwebApproachPos, 0, 0, ANCHORS.cobwebField);

const fallIntoCobweb = () => mkSeq('pb_fall_into_cobweb', 'Fall into cobweb from y=30',
  (b) => b.waitFor('player_auth_input', 80).waitUntilStable(20).waitFor('player_auth_input', 5),
  cobwebFallPos, 0, 0, ANCHORS.cobwebField);

const jumpInCobweb = () => mkSeq('pb_jump_in_cobweb', 'Jump inside cobweb — reduced vertical impulse',
  (b) => b.keyDown('space').waitFor('player_auth_input', 30).keyUp('space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  cobwebInsidePos, 0, 0, ANCHORS.cobwebField);

const BBF = SCENES.berryBushField;
const berryBushApproachPos: Pos = { x: BBF.x, y: 0, z: BBF.z - 8 };

const walkIntoBerryBush = () => mkSeq('pb_walk_into_berry_bush', 'Walk into berry bush — slow + damage',
  (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  berryBushApproachPos, 0, 0, ANCHORS.berryBushField);

const PSF = SCENES.powderSnowField;
const powderSnowApproachPos: Pos = { x: PSF.x, y: 0, z: PSF.z - 8 };
const powderSnowInsidePos:   Pos = { x: PSF.x, y: -2, z: PSF.z };

const walkIntoPowderSnow = () => mkSeq('pb_walk_into_powder_snow', 'Walk into powder snow — sink',
  (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  powderSnowApproachPos, 0, 0, ANCHORS.powderSnowField);

const jumpOutOfPowderSnow = () => mkSeq('pb_jump_out_of_powder_snow', 'Jump out of powder snow',
  (b) => b.keyDown('space').waitFor('player_auth_input', 40).keyUp('space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  powderSnowInsidePos, 0, 0, ANCHORS.powderSnowField);

const sinkInPowderSnow = () => mkSeq('pb_sink_in_powder_snow', 'Sink in powder snow (no input)',
  (b) => b.waitFor('player_auth_input', 50).waitUntilStable(15).waitFor('player_auth_input', 5),
  powderSnowInsidePos, 0, 0, ANCHORS.powderSnowField);

// ─── bubble columns ────────────────────────────────────────────────────

const BUC = SCENES.bubbleUpColumn;
const BDC = SCENES.bubbleDownColumn;

// Bubble columns push the player continuously — velocity never satisfies
// `waitUntilStable`'s "two-consecutive-stable-ticks" predicate inside the
// column. Pattern: ride the column for 60 ticks, then walk forward to
// exit it, THEN wait for stability (now achievable once out of the push).
const bubbleColumnUpRise = () => mkSeq('pb_bubble_column_up_rise',
  'Rise through bubble-up column then walk out to stabilize',
  (b) =>
    b.waitFor('player_auth_input', 60)        // ride the up-column
      .keyDown('w').waitFor('player_auth_input', 20).keyUp('w')  // exit
      .waitUntilStable(10)                     // now stabilizes outside
      .waitFor('player_auth_input', 5),
  { x: BUC.x + 5, y: -7, z: BUC.z }, 0, 0, ANCHORS.bubbleUpColumn,
  'apply water_breathing', applyWaterBreathing);

const bubbleColumnDownDescend = () => mkSeq('pb_bubble_column_down_descend',
  'Descend through bubble-down column then walk out to stabilize',
  (b) =>
    b.waitFor('player_auth_input', 60)        // ride the down-column
      .keyDown('w').waitFor('player_auth_input', 20).keyUp('w')  // exit
      .waitUntilStable(10)
      .waitFor('player_auth_input', 5),
  { x: BDC.x + 5, y: 0, z: BDC.z }, 0, 0, ANCHORS.bubbleDownColumn,
  'apply water_breathing', applyWaterBreathing);

// ─── fence / pit ───────────────────────────────────────────────────────

const FA = SCENES.fenceArea;
const fenceApproachPos: Pos = { x: FA.x - 12, y: 0, z: FA.z - 14 };

const walkIntoFence = () => mkSeq('pb_walk_into_fence', 'Walk into fence — collision blocks',
  (b) => b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
    .waitUntilStable(10).waitFor('player_auth_input', 5),
  fenceApproachPos, 0, 0, ANCHORS.fenceArea);

const jumpAtFence = () => mkSeq('pb_jump_at_fence', 'Walk+jump at fence — clear or fail',
  (b) => b.keyDown('w', 'space').waitFor('player_auth_input', 1).keyUp('space')
    .waitFor('player_auth_input', 25).keyUp('w').waitUntilStable(10).waitFor('player_auth_input', 5),
  fenceApproachPos, 0, 0, ANCHORS.fenceArea);

const FP = SCENES.flatPit;
const pitEdgePos:   Pos = { x: FP.x + 4, y: 1, z: FP.z };
const pitInsidePos: Pos = { x: FP.x - 0.5, y: -4, z: FP.z };

const walkIntoPit = () => mkSeq('pb_walk_into_pit', 'Walk strafe into pit edge — drop',
  (b) => b.keyDown('a').waitFor('player_auth_input', 40).keyUp('a')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  pitEdgePos, 0, 0, ANCHORS.flatPit);

const jumpOutOfPit = () => mkSeq('pb_jump_out_of_pit', 'Jump out of flatPit',
  (b) => b.keyDown('space').waitFor('player_auth_input', 1).keyUp('space')
    .waitUntilStable(15).waitFor('player_auth_input', 5),
  pitInsidePos, 0, 0, ANCHORS.flatPit);

// ─── Fixture wrapper ──────────────────────────────────────────────────

function buildPrismarinePhysicsFixture(): Fixture {
  const seqs: SimulationSequence[] = [
    fallNoInput(),
    walkForward30Stop20(),
    walkYawRotate(),
    walkJump(),
    sneakForward(),
    sprintForward(),
    sprintJump5x(),
    sprintJumpYawRotate(),
    walkBackward(),
    strafeLeft(),
    strafeRight(),
    walkDiagonalWA(),
    walkDiagonalWD(),
    walkBackwardDiagonalSA(),
    forwardThenBackward(),
    jumpInPlace(),
    walkWhileFalling(),
    sprintWhileFalling(),
    sneakWhileFalling(),
    fallFromHigh(),

    wallWalkPerp(), wallWalkAngled30(), wallSprintAir(),
    wallWalkCorner(), wallWalkThinGap(), jumpOverAirborneWall(),

    sneakToEdge(), walkOffEdge(), sprintOffEdge(),

    stepUpSlab(), walkUpStairs(), jumpIntoCeiling(),

    walkOnIce(), walkOnPackedIce(), walkOnBlueIce(),

    walkOnHoney(), fallOntoHoney(), jumpOnHoney(), sprintOntoHoney(),

    walkOnSlime(), fallOntoSlime(), fallOntoSlimeHigh(),
    jumpOnSlime(), jumpAndSneakOnSlime(), sneakWalkOnSlime(),

    walkOnSoulSand(), walkOnSoulSoil(),

    climbLadderUp(), climbLadderJumpOff(),

    climbScaffoldingUp(), climbScaffoldingDown(),
    scaffoldingHover(), jumpOffScaffoldingTop(),

    climbVineUp(), vineHangSlowFall(),

    walkIntoWater(), swimUpInWater(), sinkInWater(), fallIntoWater(),
    swimForwardSubmerged(), swimDiagonalSubmerged(), floatOnWaterSurface(),
    swimUpAt45(), swimDownAt45(), swimSprintForward(),

    walkIntoLava(), swimUpInLava(), sinkInLava(), fallIntoLava(),

    walkIntoCobweb(), fallIntoCobweb(), jumpInCobweb(),

    walkIntoBerryBush(),

    walkIntoPowderSnow(), jumpOutOfPowderSnow(), sinkInPowderSnow(),

    bubbleColumnUpRise(), bubbleColumnDownDescend(),

    walkIntoFence(), jumpAtFence(),

    walkIntoPit(), jumpOutOfPit(),
  ];

  return {
    name: 'prismarine_physics',
    description: 'Prismarine-Bedrock physics regression suite — one focused case per primitive',
    sequences: seqs,
  };
}

registerFixture(buildPrismarinePhysicsFixture());
