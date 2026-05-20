// Fixture: v2_extras — coverage beyond the v2 main.ts L213-244 baseline.
//
// Adds creative-flight up/down variants, crouch-in-tunnel (1-block air gap),
// jump-into-wall at 0°/15°/30°/45° angles, slide-along-wall with a step-up
// section, and WASD sprint/sneak transitions in open ground.
//
// Two new scenes (`oneBlockTunnel`, `slideWall`) live in `shared_world.ts`
// — you must re-run `shared_world_setup` + `snapshot-world` before recording
// this fixture against a fresh BDS world.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const ANCHOR_FLAT = sceneAnchor(SCENES.flat);
const ANCHOR_TUNNEL = sceneAnchor(SCENES.oneBlockTunnel);
const ANCHOR_SLIDE = sceneAnchor(SCENES.slideWall);
const ANCHOR_WALLS = sceneAnchor(SCENES.collisionWalls);

// Common helper — all extras use the same setup pattern (no per-case
// effects), so this just shrinks the call sites.
function mk(
  name: string,
  description: string,
  startPos: Pos,
  yaw: number,
  pitch: number,
  anchor: Pos,
  run: (b: SimulationBuilder) => SimulationBuilder,
  setup?: (b: SimulationBuilder) => SimulationBuilder,
  setupDescription?: string,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos,
      yaw,
      pitch,
      sceneAnchor: anchor,
      setup,
      setupDescription,
      run,
    })
    .build();
}

// ───────────────────────────────────────────────────────────────────────
// 1. Creative flight — up / down / strafe / diagonal
// ───────────────────────────────────────────────────────────────────────

// Bedrock toggles fly mode via a fast double-tap of space. Hold the second
// tap, then control vertical with space (up) / shift (down) and horizontal
// with WASD. Each case asserts attribute changes (FlySpeed, MovementSpeed)
// and the resulting vertical/horizontal velocity profile.
const flat: Pos = { x: SCENES.flat.x, y: 0, z: SCENES.flat.z };

function doubleTapFlyEnable(b: SimulationBuilder): SimulationBuilder {
  return b
    .command('gamemode creative ${PLAYER}')
    .keyDown('space').waitFor('player_auth_input', 1).keyUp('space')
    .waitFor('player_auth_input', 3)
    .keyDown('space').waitFor('player_auth_input', 1).keyUp('space')
    .waitFor('player_auth_input', 5);
}

function creativeFlyUp(): SimulationSequence {
  return mk(
    'creative_fly_up_60t',
    'Creative: enable fly, hold space 60t — observe ascend curve',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      doubleTapFlyEnable(b)
        .keyDown('space').waitFor('player_auth_input', 60).keyUp('space')
        .waitFor('player_auth_input', 10),
  );
}

function creativeFlyDown(): SimulationSequence {
  return mk(
    'creative_fly_down_30t',
    'Creative: fly up first, then hold shift 30t to descend',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      doubleTapFlyEnable(b)
        .keyDown('space').waitFor('player_auth_input', 30).keyUp('space')
        .keyDown('shift').waitFor('player_auth_input', 30).keyUp('shift')
        .waitFor('player_auth_input', 10),
  );
}

function creativeFlyUpForward(): SimulationSequence {
  return mk(
    'creative_fly_up_forward',
    'Creative: ascend while pressing w (diagonal climb)',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      doubleTapFlyEnable(b)
        .keyDown('space', 'w').waitFor('player_auth_input', 40).keyUp('space', 'w')
        .waitFor('player_auth_input', 10),
  );
}

function creativeFlyUpStrafe(side: 'a' | 'd'): SimulationSequence {
  const label = side === 'a' ? 'left' : 'right';
  return mk(
    `creative_fly_up_strafe_${label}`,
    `Creative: ascend while strafing ${label}`,
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      doubleTapFlyEnable(b)
        .keyDown('space', side).waitFor('player_auth_input', 40).keyUp('space', side)
        .waitFor('player_auth_input', 10),
  );
}

function creativeFlyDiagonalWA(): SimulationSequence {
  return mk(
    'creative_fly_diagonal_up_w_a',
    'Creative: ascend while pressing w+a (diagonal forward-left climb)',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      doubleTapFlyEnable(b)
        .keyDown('space', 'w', 'a').waitFor('player_auth_input', 40).keyUp('space', 'w', 'a')
        .waitFor('player_auth_input', 10),
  );
}

function creativeFlyAscendDescend(): SimulationSequence {
  return mk(
    'creative_fly_ascend_descend_cycle',
    'Creative: ascend 20t, descend 20t, ascend 20t — verify cycle handling',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      doubleTapFlyEnable(b)
        .keyDown('space').waitFor('player_auth_input', 20).keyUp('space')
        .keyDown('shift').waitFor('player_auth_input', 20).keyUp('shift')
        .keyDown('space').waitFor('player_auth_input', 20).keyUp('space')
        .waitFor('player_auth_input', 10),
  );
}

// ───────────────────────────────────────────────────────────────────────
// 2. Crouching in a 1-block-high tunnel
// ───────────────────────────────────────────────────────────────────────
//
// The tunnel scene has 1 block of headroom (y=1 air, y=2 ceiling). Standing
// player AABB (~1.8 tall) doesn't fit. Tests:
//   - sneak-walk into tunnel (works)
//   - try to walk standing → head hits ceiling, can't enter
//   - strafe inside tunnel
//   - exit tunnel and stand back up

const tunnelEntry: Pos = { x: SCENES.oneBlockTunnel.x, y: 0, z: SCENES.oneBlockTunnel.z - 7 };
const tunnelInside: Pos = { x: SCENES.oneBlockTunnel.x, y: 0, z: SCENES.oneBlockTunnel.z + 0 };

function tunnelSneakWalkForward(): SimulationSequence {
  return mk(
    'tunnel_sneak_walk_forward',
    'Crouch + walk forward into 1-block-high tunnel for 30 ticks',
    tunnelEntry, 0, 0, ANCHOR_TUNNEL,
    (b) =>
      b.keyDown('shift').waitFor('player_auth_input', 4)
        .keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
        .waitFor('player_auth_input', 5).keyUp('shift')
        .waitFor('player_auth_input', 5),
  );
}

function tunnelSneakWalkBackward(): SimulationSequence {
  // Start inside the tunnel, walk backward (out)
  return mk(
    'tunnel_sneak_walk_backward',
    'Crouch + walk backward out of tunnel for 20 ticks',
    tunnelInside, 0, 0, ANCHOR_TUNNEL,
    (b) =>
      b.keyDown('shift').waitFor('player_auth_input', 4)
        .keyDown('s').waitFor('player_auth_input', 20).keyUp('s')
        .waitFor('player_auth_input', 5).keyUp('shift')
        .waitFor('player_auth_input', 5),
  );
}

function tunnelSneakStrafe(side: 'a' | 'd'): SimulationSequence {
  // Strafe perpendicular to tunnel axis — should hit the side walls
  const label = side === 'a' ? 'left' : 'right';
  return mk(
    `tunnel_sneak_strafe_${label}`,
    `Inside tunnel, crouch + strafe ${label} for 20 ticks (collides with side wall)`,
    tunnelInside, 0, 0, ANCHOR_TUNNEL,
    (b) =>
      b.keyDown('shift').waitFor('player_auth_input', 4)
        .keyDown(side).waitFor('player_auth_input', 20).keyUp(side)
        .waitFor('player_auth_input', 5).keyUp('shift')
        .waitFor('player_auth_input', 5),
  );
}

function tunnelWalkCollideCeiling(): SimulationSequence {
  return mk(
    'tunnel_walk_collide_ceiling',
    'Stand at tunnel entrance + walk forward (no crouch) — head hits ceiling, no entry',
    tunnelEntry, 0, 0, ANCHOR_TUNNEL,
    (b) =>
      b.keyDown('w').waitFor('player_auth_input', 30).keyUp('w')
        .waitFor('player_auth_input', 10),
  );
}

function tunnelSneakToWalkExit(): SimulationSequence {
  // Enter crouched, walk through, exit and stand back up
  return mk(
    'tunnel_sneak_to_walk_exit',
    'Crouch-walk through tunnel, then release sneak (stand back up)',
    tunnelEntry, 0, 0, ANCHOR_TUNNEL,
    (b) =>
      b.keyDown('shift').waitFor('player_auth_input', 4)
        .keyDown('w').waitFor('player_auth_input', 50)
        .keyUp('shift') // try to stand while still in tunnel — should fail until exit
        .waitFor('player_auth_input', 20)
        .keyUp('w')
        .waitFor('player_auth_input', 10),
  );
}

// ───────────────────────────────────────────────────────────────────────
// 3. Jump-into-wall at angles (reuse collisionWalls scene)
// ───────────────────────────────────────────────────────────────────────
//
// The collisionWalls scene has a "perpendicular wall along Z": fill at
//   x=0,  y=1..3,  z=5..10  (scene-local)
// — 1 block thick in X, 6 blocks long in Z. Its broad face is normal to
// the X axis, so the head-on approach is *into +X*. In Bedrock's command
// yaw convention (0=south/+Z, 90=west/-X, 180=north/-Z, 270=east/+X), that
// is yaw=270. The wallApproach also lands at z=CW.z+7 so the player is
// centered on the wall's z-extent (5..10), not at its south edge.
//
// The label (`yaw0`, `yaw15`, ...) is *degrees off head-on*, not absolute
// yaw — the absolute is 270 + offset. So `_yaw15` means 15° rotated from
// head-on.

const HEAD_ON_YAW = 270;
const wallApproach: Pos = { x: SCENES.collisionWalls.x - 3, y: 0, z: SCENES.collisionWalls.z + 7 };

function jumpIntoWallAtAngle(offsetDeg: number): SimulationSequence {
  const yawLabel = offsetDeg.toString().replace('-', 'neg');
  const yaw = HEAD_ON_YAW + offsetDeg;
  return mk(
    `jump_into_wall_yaw${yawLabel}`,
    `Sprint+jump into perpendicular wall at ${offsetDeg}° off head-on (yaw=${yaw}) — observe horizontal-collision behavior`,
    wallApproach, yaw, 0, ANCHOR_WALLS,
    (b) =>
      b.keyDown('ctrl', 'w', 'space')
        .waitFor('player_auth_input', 25)
        .keyUp('ctrl', 'w', 'space')
        .waitUntilStable(15)
        .waitFor('player_auth_input', 5),
  );
}

function continuousJumpIntoWall(offsetDeg: number): SimulationSequence {
  // Constantly move forward + jump → bunny-hop INTO wall. Tests how jump
  // velocity preserves across repeated hits.
  const yawLabel = offsetDeg.toString().replace('-', 'neg');
  const yaw = HEAD_ON_YAW + offsetDeg;
  return mk(
    `bunny_hop_into_wall_yaw${yawLabel}`,
    `Bunny-hop (w+space held) into wall at ${offsetDeg}° off head-on (yaw=${yaw}) — observe slide while jumping`,
    wallApproach, yaw, 0, ANCHOR_WALLS,
    (b) =>
      b.keyDown('w', 'space')
        .waitFor('player_auth_input', 50)
        .keyUp('w', 'space')
        .waitUntilStable(15)
        .waitFor('player_auth_input', 5),
  );
}

// ───────────────────────────────────────────────────────────────────────
// 4. Slide-along-wall with a step-up section (slideWall scene)
// ───────────────────────────────────────────────────────────────────────
//
// The slideWall scene has a 3-high impassable wall at x=5 with a 1-high
// "step" section at z=-1..+1. Player starts west of the wall, walks +x,
// hits wall, slides along z, eventually finds the step and can step up
// onto it. Variants: walk, sprint, sprint-jump.

const slideStart: Pos = { x: SCENES.slideWall.x - 3, y: 0, z: SCENES.slideWall.z - 8 };

function slideAlongWall(label: string, run: (b: SimulationBuilder) => SimulationBuilder): SimulationSequence {
  return mk(
    `slide_${label}`,
    `slideWall: ${label} — sliding behavior + step-up at the gap`,
    slideStart, 90, 0, ANCHOR_SLIDE, // yaw=90 = facing +x = into wall
    run,
  );
}

function slideWalkRight(): SimulationSequence {
  return slideAlongWall('walk_right', (b) =>
    b.keyDown('w', 'd')
      .waitFor('player_auth_input', 50)
      .keyUp('w', 'd')
      .waitUntilStable(15)
      .waitFor('player_auth_input', 5));
}

function slideSprintRight(): SimulationSequence {
  return slideAlongWall('sprint_right', (b) =>
    b.keyDown('ctrl', 'w', 'd')
      .waitFor('player_auth_input', 50)
      .keyUp('ctrl', 'w', 'd')
      .waitUntilStable(15)
      .waitFor('player_auth_input', 5));
}

function slideSprintJumpRight(): SimulationSequence {
  return slideAlongWall('sprint_jump_right', (b) =>
    b.keyDown('ctrl', 'w', 'd', 'space')
      .waitFor('player_auth_input', 60)
      .keyUp('ctrl', 'w', 'd', 'space')
      .waitUntilStable(15)
      .waitFor('player_auth_input', 5));
}

function slideSprintJumpLeft(): SimulationSequence {
  // Start further north, slide -z into the step from the other side
  const startLeft: Pos = { x: SCENES.slideWall.x - 3, y: 0, z: SCENES.slideWall.z + 8 };
  return mk(
    'slide_sprint_jump_left',
    'slideWall: sprint-jump while strafing -z (from north side toward step)',
    startLeft, 90, 0, ANCHOR_SLIDE,
    (b) =>
      b.keyDown('ctrl', 'w', 'a', 'space')
        .waitFor('player_auth_input', 60)
        .keyUp('ctrl', 'w', 'a', 'space')
        .waitUntilStable(15)
        .waitFor('player_auth_input', 5),
  );
}

// ───────────────────────────────────────────────────────────────────────
// 5. WASD sprint/sneak transitions in open ground (flat scene)
// ───────────────────────────────────────────────────────────────────────

function sprintToSneakJump(): SimulationSequence {
  return mk(
    'sprint_to_sneak_jump',
    'Sprint forward, jump, mid-air engage sneak, land — observe pose-change tick + AABB shrink',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      b.keyDown('ctrl', 'w')
        .waitFor('player_auth_input', 10)
        .keyDown('space')
        .waitFor('player_auth_input', 2)
        .keyUp('space')
        .keyDown('shift')
        .waitFor('player_auth_input', 15)
        .keyUp('shift', 'ctrl', 'w')
        .waitUntilStable(10)
        .waitFor('player_auth_input', 5),
  );
}

function sneakToSprintToSneak(): SimulationSequence {
  return mk(
    'sneak_to_sprint_to_sneak',
    'Alternate sneak→sprint→sneak forward — observe ground-speed transitions',
    flat, 0, 0, ANCHOR_FLAT,
    (b) =>
      b.keyDown('shift', 'w').waitFor('player_auth_input', 10)
        .keyUp('shift').keyDown('ctrl').waitFor('player_auth_input', 10)
        .keyUp('ctrl').keyDown('shift').waitFor('player_auth_input', 10)
        .keyUp('shift', 'w').waitUntilStable(10)
        .waitFor('player_auth_input', 5),
  );
}

function wasdBurstTest(): SimulationSequence {
  return mk(
    'wasd_burst_test',
    'Alternate w/a/s/d in rapid bursts of 4 ticks each — input-debounce stress',
    flat, 0, 0, ANCHOR_FLAT,
    (b) => {
      for (const k of ['w', 'a', 's', 'd', 'w', 'd', 's', 'a']) {
        b.keyDown(k).waitFor('player_auth_input', 4).keyUp(k);
      }
      return b.waitUntilStable(10).waitFor('player_auth_input', 5);
    },
  );
}

// ───────────────────────────────────────────────────────────────────────
// Fixture
// ───────────────────────────────────────────────────────────────────────

function buildExtrasFixture(): Fixture {
  const seqs: SimulationSequence[] = [
    // Creative flight
    creativeFlyUp(),
    creativeFlyDown(),
    creativeFlyUpForward(),
    creativeFlyUpStrafe('a'),
    creativeFlyUpStrafe('d'),
    creativeFlyDiagonalWA(),
    creativeFlyAscendDescend(),

    // Tunnel crouch
    tunnelSneakWalkForward(),
    tunnelSneakWalkBackward(),
    tunnelSneakStrafe('a'),
    tunnelSneakStrafe('d'),
    tunnelWalkCollideCeiling(),
    tunnelSneakToWalkExit(),

    // Jump into wall at angles
    jumpIntoWallAtAngle(0),
    jumpIntoWallAtAngle(15),
    jumpIntoWallAtAngle(30),
    jumpIntoWallAtAngle(45),
    continuousJumpIntoWall(0),
    continuousJumpIntoWall(30),

    // Slide along wall + step-up
    slideWalkRight(),
    slideSprintRight(),
    slideSprintJumpRight(),
    slideSprintJumpLeft(),

    // WASD sprint/sneak transitions
    sprintToSneakJump(),
    sneakToSprintToSneak(),
    wasdBurstTest(),
  ];

  return {
    name: 'v2_extras',
    description:
      'Extras: creative fly up/down, tunnel crouch (1-block headroom), jump-into-wall at 0°/15°/30°/45°, slide-along-wall with step-up, WASD transitions',
    sequences: seqs,
  };
}

registerFixture(buildExtrasFixture());
