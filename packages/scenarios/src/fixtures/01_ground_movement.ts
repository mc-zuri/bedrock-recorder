// Fixture: Ground Movement (flat surface)
// Walk, sprint, sneak, strafe, diagonal, transitions, yaw/tick sweeps.
//
// Ported from v2 `recorder/src/fixtures2/01_ground_movement.ts` (248 lines).
// Mechanical changes from v2:
//   - imports point at the new package layout
//   - `Fixture` comes from @bdt/core (not v2's fixtures/fixture.ts)
//   - registers itself via `registerFixture()` at import time
//   - removed the v2-era `wait` import from old.ts (dead code)
//   - no @a → ${PLAYER} substitution needed here (this fixture has no commands)

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, preloadScene } from './scene_positions.js';
import { registerFixture } from './registry.js';

const S = SCENES.flat;

interface Pos { x: number; y: number; z: number }

function mkSeq(
  name: string,
  fn: (b: SimulationBuilder) => SimulationBuilder,
  startPos: Pos = { x: S.x, y: 0, z: S.z },
  yaw = 0,
  pitch = 0,
): SimulationSequence {
  void pitch; // teleport currently disabled in v2; preserve the signature for parity
  return new SimulationBuilder()
    .waitFor('player_auth_input', 10)
    .testCase(
      name,
      (b) =>
        fn(
          b.waitFor('player_auth_input', 1)
            // v2 disabled the teleport here — see the comment in the original.
            // Kept disabled so recordings match v2's behavior exactly.
            .waitFor('player_auth_input', 7),
        ),
      { startPos },
    )
    .waitFor('player_auth_input', 1)
    .build();
}

function moveSeq(label: string, keys: string[], ticks: number, yaw = 0): SimulationSequence {
  return mkSeq(
    `${label}_${ticks}t`,
    (b) =>
      b.keyDown(...keys)
        .waitFor('player_auth_input', ticks)
        .keyUp(...keys)
        .waitUntilStable()
        .waitFor('player_auth_input', 1),
    undefined,
    yaw,
  );
}

function decelerateSeq(walkTicks: number, waitTicks: number): SimulationSequence {
  return mkSeq(`decelerate_walk_${walkTicks}t_wait_${waitTicks}t`, (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', walkTicks)
      .keyUp('w')
      .waitFor('player_auth_input', waitTicks)
      .waitFor('player_auth_input', 1),
  );
}

function walkStopWalkSeq(w1: number, stop: number, w2: number): SimulationSequence {
  return mkSeq(`walk_${w1}t_stop_${stop}t_walk_${w2}t`, (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', w1)
      .keyUp('w')
      .waitFor('player_auth_input', stop)
      .keyDown('w')
      .waitFor('player_auth_input', w2)
      .keyUp('w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function opposingSeq(ticks: number): SimulationSequence {
  return mkSeq(`opposing_ws_${ticks}t`, (b) =>
    b.keyDown('w', 's')
      .waitFor('player_auth_input', ticks)
      .keyUp('w', 's')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function rapidDirectionSeq(): SimulationSequence {
  const dirs = ['w', 'a', 's', 'd', 'w', 'a', 's', 'd'];
  return mkSeq('rapid_direction_changes_30t', (b) => {
    for (const d of dirs) {
      b.keyDown(d).waitFor('player_auth_input', 3).keyUp(d);
    }
    return b.waitUntilStable().waitFor('player_auth_input', 1);
  });
}

function alternateSprintSeq(): SimulationSequence {
  return mkSeq('alternate_sprint_30t', (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', 5)
      .keyUp('ctrl')
      .waitFor('player_auth_input', 5)
      .keyDown('ctrl')
      .waitFor('player_auth_input', 5)
      .keyUp('ctrl')
      .waitFor('player_auth_input', 5)
      .keyDown('ctrl')
      .waitFor('player_auth_input', 5)
      .keyUp('ctrl')
      .waitFor('player_auth_input', 5)
      .keyUp('w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function sprintToSneakSeq(sprintT: number, sneakT: number): SimulationSequence {
  return mkSeq(`sprint_${sprintT}t_to_sneak_${sneakT}t`, (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', sprintT)
      .keyUp('ctrl')
      .keyDown('shift')
      .waitFor('player_auth_input', sneakT)
      .keyUp('shift', 'w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function sneakToSprintSeq(sneakT: number, sprintT: number): SimulationSequence {
  return mkSeq(`sneak_${sneakT}t_to_sprint_${sprintT}t`, (b) =>
    b.keyDown('shift', 'w')
      .waitFor('player_auth_input', sneakT)
      .keyUp('shift')
      .keyDown('ctrl')
      .waitFor('player_auth_input', sprintT)
      .keyUp('ctrl', 'w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function sprintStopSprintSeq(s1: number, stop: number, s2: number): SimulationSequence {
  return mkSeq(`sprint_${s1}t_stop_${stop}t_sprint_${s2}t`, (b) =>
    b.keyDown('ctrl', 'w')
      .waitFor('player_auth_input', s1)
      .keyUp('ctrl', 'w')
      .waitFor('player_auth_input', stop)
      .keyDown('ctrl', 'w')
      .waitFor('player_auth_input', s2)
      .keyUp('ctrl', 'w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function walkSprintWalkSeq(w1: number, sprint: number, w2: number): SimulationSequence {
  return mkSeq(`walk_${w1}t_sprint_${sprint}t_walk_${w2}t`, (b) =>
    b.keyDown('w')
      .waitFor('player_auth_input', w1)
      .keyDown('ctrl')
      .waitFor('player_auth_input', sprint)
      .keyUp('ctrl')
      .waitFor('player_auth_input', w2)
      .keyUp('w')
      .waitUntilStable()
      .waitFor('player_auth_input', 1),
  );
}

function buildGroundMovementFixture(): Fixture {
  const seqs: SimulationSequence[] = [preloadScene(SCENES.flat, 0, 90)];

  // Basic movements
  seqs.push(moveSeq('walkForward',  ['w'],          20));
  seqs.push(moveSeq('walkBackward', ['s'],          10));
  seqs.push(moveSeq('strafeLeft',   ['a'],          10));
  seqs.push(moveSeq('strafeRight',  ['d'],          10));
  seqs.push(moveSeq('diagonalFL',   ['w', 'a'],     20));
  seqs.push(moveSeq('diagonalFR',   ['w', 'd'],     20));

  // Sprint
  seqs.push(moveSeq('sprintForward',  ['ctrl', 'w'],      20));
  seqs.push(moveSeq('sprintBackward', ['ctrl', 's'],      20));
  seqs.push(moveSeq('sprintDiagonal', ['ctrl', 'w', 'a'], 20));

  // Sneak
  seqs.push(moveSeq('sneakForward',  ['shift', 'w'], 20));
  seqs.push(moveSeq('sneakBackward', ['shift', 's'], 20));

  // Special
  seqs.push(decelerateSeq(10, 30));
  seqs.push(walkStopWalkSeq(10, 5, 15));
  seqs.push(opposingSeq(20));
  seqs.push(rapidDirectionSeq());
  seqs.push(alternateSprintSeq());

  // Transitions
  seqs.push(sprintToSneakSeq(10, 10));
  seqs.push(sneakToSprintSeq(10, 10));
  seqs.push(sprintStopSprintSeq(10, 5, 10));
  seqs.push(walkSprintWalkSeq(10, 10, 10));

  // Walk tick sweep: 1-30 ticks
  for (let t = 1; t <= 30; t++) {
    seqs.push(moveSeq('walkForward', ['w'], t));
  }

  // Walk yaw sweep (narrow band to match v2)
  for (let y = -1; y <= 1; y += 1) {
    seqs.push(moveSeq(`walkYaw_${y}`, ['w'], 20, y));
  }

  // Sprint yaw sweep (narrow band to match v2)
  for (let y = 89; y <= 91; y += 1) {
    seqs.push(moveSeq(`sprintYaw_${y}`, ['ctrl', 'w'], 20, y));
  }

  // Walk-then-sneak combos
  for (let wt = 1; wt <= 10; wt++) {
    for (let st = 10; st <= 10; st++) {
      seqs.push(
        mkSeq(`walkThenSneak_w${wt}_s${st}`, (b) =>
          b.keyDown('w')
            .waitFor('player_auth_input', wt)
            .keyUp('w')
            .keyDown('shift', 'w')
            .waitFor('player_auth_input', st)
            .keyUp('shift', 'w')
            .waitUntilStable()
            .waitFor('player_auth_input', 1),
        ),
      );
    }
  }

  // Walk-then-sprint combos
  for (let wt = 1; wt <= 10; wt++) {
    for (let st = 10; st <= 10; st++) {
      seqs.push(
        mkSeq(`walkThenSprint_w${wt}_s${st}`, (b) =>
          b.keyDown('w')
            .waitFor('player_auth_input', wt)
            .keyDown('ctrl')
            .waitFor('player_auth_input', st)
            .keyUp('ctrl', 'w')
            .waitUntilStable()
            .waitFor('player_auth_input', 1),
        ),
      );
    }
  }

  return { name: 'v2_ground_movement', sequences: seqs };
}

registerFixture(buildGroundMovementFixture());
