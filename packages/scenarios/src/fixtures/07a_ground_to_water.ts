// Fixtures: walk_ground_to_water / sprint_ground_to_water.
//
// Ported from v2 `recorder/src/fixtures/walk-ground-to-water-fixture.ts` and
// `sprint_ground_to_water-fixture.ts`. The v2 versions built a pool
// dynamically via `fill` commands; v5 reuses the static `waterHalfPool`
// scene from `shared_world_setup` (build-once world template).
//
// The test approaches the static half-pool at a fixed yaw with various
// pitches and walks/sprints into the water.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const WHP = SCENES.waterHalfPool;
const ANCHOR = sceneAnchor(WHP);

function getStartPos(yaw: number, distance: number, anchor: Pos): Pos {
  const rad = (yaw * Math.PI) / 180;
  return {
    x: anchor.x - Math.round(Math.sin(rad) * distance),
    y: 0,
    z: anchor.z - Math.round(Math.cos(rad) * distance),
  };
}

function walkCase(yaw: number, pitch: number): SimulationSequence {
  const startPos = getStartPos(yaw, 4, { x: WHP.x, y: 0, z: WHP.z });
  // v2 walk variant keeps the raw minus sign in pitch (`pitch_-15`),
  // matching the target file names exactly. Do NOT replace `-` with `neg` here.
  const name = `ground_to_water_walk_yaw_${yaw}_pitch_${pitch}`;

  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description: `Walk from ground into half-water-pool, yaw=${yaw}, pitch=${pitch}`,
      setupDescription: 'apply water_breathing for safety',
      startPos,
      yaw,
      pitch,
      sceneAnchor: ANCHOR,
      setup: (b) => b.command('effect ${PLAYER} water_breathing 9999 0 true'),
      run: (b) =>
        b.keyDown('w')
          .waitFor('player_auth_input', 150)
          .keyUp('w')
          .waitFor('player_auth_input', 20),
    })
    .build();
}

function sprintCase(yaw: number, pitch: number): SimulationSequence {
  const startPos = getStartPos(yaw, 10, { x: WHP.x, y: 0, z: WHP.z });
  // v2 sprint variant: name ends with a trailing `_0` (`...yaw_neg14_0`) and
  // applies the `-` → `neg` replacement after concatenation. Match exactly.
  const name = `ground_to_water_sprint_pitch_${pitch.toString()}_yaw_${yaw}_0`
    .replace(/-(\d)/g, 'neg$1');

  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description: `Sprint from ground into half-water-pool, yaw=${yaw}, pitch=${pitch}`,
      setupDescription: 'apply water_breathing for safety',
      startPos,
      yaw,
      pitch,
      sceneAnchor: ANCHOR,
      setup: (b) => b.command('effect ${PLAYER} water_breathing 9999 0 true'),
      run: (b) =>
        b.keyDown('ctrl', 'w')
          .waitFor('player_auth_input', 120)
          .keyUp('ctrl', 'w')
          .waitFor('player_auth_input', 20),
    })
    .build();
}

const PITCH_VALUES = [45, -89, -75, -60, -45, -30, -15, 0, 15, 30, 60, 75, 89];

function buildWalkGroundToWaterFixture(): Fixture {
  const seqs: SimulationSequence[] = [];
  const yaw = 19;
  for (const pitch of PITCH_VALUES) seqs.push(walkCase(yaw, pitch));
  return {
    name: 'walk_ground_to_water',
    description: 'Walk from ground into water half-pool — yaw=19, pitch sweep',
    sequences: seqs,
  };
}

function buildSprintGroundToWaterFixture(): Fixture {
  const seqs: SimulationSequence[] = [];
  const yaw = -14;
  for (const pitch of PITCH_VALUES) seqs.push(sprintCase(yaw, pitch));
  return {
    name: 'sprint_ground_to_water',
    description: 'Sprint from ground into water half-pool — yaw=-14, pitch sweep',
    sequences: seqs,
  };
}

registerFixture(buildWalkGroundToWaterFixture());
registerFixture(buildSprintGroundToWaterFixture());
