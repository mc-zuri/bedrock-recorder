// Composite "bundle" fixtures that mirror v2 `main.ts` L218–244.
//
// Each entry in the array calls a v2 `runV2(...)` with a list of fixtures and
// a *bundle name* used as the `.proxy.bin` filename. In v5 each fixture is
// individually addressable through the registry, but we provide two bundles
// here for parity with the v2 recording flow:
//
//   - `v2_prismarine_physics_bundle`   → prismarine_physics + ground + elytra
//   - `v2_full_coverage_bundle`        → 12 fixtures matching v2's "core"
//
// The bundles import side-effect-registered fixtures via `getFixture()`, so
// they automatically pick up any sequence edits made in the source fixture
// files without any duplication.

import type { Fixture, SimulationSequence } from '@bdt/core';
import { getFixture, registerFixture } from './registry.js';

function concatSequences(...names: string[]): SimulationSequence[] {
  const out: SimulationSequence[] = [];
  for (const n of names) {
    const f = getFixture(n);
    out.push(...f.sequences);
  }
  return out;
}

// IMPORTANT: import the source fixtures first so they self-register, then
// build the bundle that re-uses their sequence lists.
import './01_ground_movement.js';
import './10_elytra.js';
import './30_prismarine_physics.js';
import './25_container.js';
import './00_core_coverage.js';
import './24_v11_coverage.js';
import './07a_ground_to_water.js';
import './08_lava_physics.js';
import './18_teleportation.js';
import './02_jump_mechanics.js';
import './03_air_movement.js';
import './06_honey_slime.js';
import './07_water_physics.js';
import './99b_extras.js';

function buildPrismarinePhysicsBundle(): Fixture {
  return {
    name: 'v2_prismarine_physics_bundle',
    description:
      'Bundle (v2 main.ts:218–223): prismarine_physics + v2_ground_movement + v2_elytra',
    sequences: concatSequences('prismarine_physics', 'v2_ground_movement', 'v2_elytra'),
  };
}

function buildFullCoverageBundle(): Fixture {
  // v2_containers is intentionally excluded — its only meaningful behavior
  // is "open inventory and wait", and we have no vision module to click
  // slots inside the GUI. The setblock/replaceitem/give setup commands are
  // covered by v2_v11_coverage and v2_core_coverage already. Bring it back
  // when Phase 2 (vision + UI automation) lands.
  return {
    name: 'v2_full_coverage_bundle',
    description:
      'Bundle (v2 main.ts:226–244, minus containers): ground_movement + core_coverage + elytra + v11 + sprint/walk_to_water + lava + teleportation + jump_mechanics + air_movement + honey_slime',
    sequences: concatSequences(
      'v2_ground_movement',
      'v2_core_coverage',
      'v2_elytra',
      'v2_v11_coverage',
      'sprint_ground_to_water',
      'walk_ground_to_water',
      'v2_lava_physics',
      'v2_teleportation',
      'v2_jump_mechanics',
      'v2_air_movement',
      'v2_honey_slime',
    ),
  };
}

/**
 * The everything-bundle: every registered physics fixture combined into a
 * single recording. Use this when you want one `.proxy.bin` covering the
 * full sweep — useful for prismarine-bedrock regression in one shot.
 *
 * Excludes:
 *   - `v2_containers` (needs Phase-2 vision module to drive slot clicks)
 *   - `shared_world_setup` / `shared_world_visit` (world-prep utilities,
 *     not physics tests)
 *   - `smoke` (sanity check only)
 *
 * Fixture order is debug-friendly: the most failure-prone fixtures
 * (continuous-motion physics — slime bounces, bubble columns, sticky
 * surfaces, sunk-into-fluid sweeps) run FIRST. Combined with
 * waitUntilStable's `onTimeout: 'proceed'` behavior, this means any
 * remaining bugs surface in the first few minutes instead of after an
 * hour of solid output.
 */
function buildAllBundle(): Fixture {
  return {
    name: 'v2_all',
    description:
      'Everything: prismarine_physics + all v2 fixtures (minus containers) + v2_water_physics + v2_extras. Fixtures with continuous-motion scenarios are placed first for faster debugging.',
    sequences: concatSequences(
      // ── Risky / fast-fail-canary fixtures first ────────────────────
      // honey_slime: slime bounce can ride past the 15s budget.
      'v2_honey_slime',
      // water/lava: deep fall + sink ride buoyancy through the budget.
      'v2_water_physics',
      'v2_lava_physics',
      // prismarine_physics: contains the bubble columns + slime falls +
      // many waitUntilStable-after-bounce cases. The single biggest fixture.
      'prismarine_physics',

      // ── Standard movement / ground / jump fixtures ─────────────────
      'v2_ground_movement',
      'v2_core_coverage',
      'v2_jump_mechanics',
      'v2_air_movement',
      'walk_ground_to_water',
      'sprint_ground_to_water',
      'v2_elytra',
      'v2_teleportation',
      'v2_v11_coverage',
      'v2_extras',
    ),
  };
}

registerFixture(buildPrismarinePhysicsBundle());
registerFixture(buildFullCoverageBundle());
registerFixture(buildAllBundle());
