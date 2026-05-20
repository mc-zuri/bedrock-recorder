import { SimulationBuilder } from '../builder.js';

/**
 * Phase-1 primitive registry — intentionally minimal stubs so overlay/expand
 * tests can run. Task #7 ports v2's full sequence library and replaces these
 * stub bodies with the real implementations from automation-sequence.ts.
 *
 * Each primitive returns a `SimulationBuilder` (not a built sequence) so the
 * overlay expander can compose them via `builder.include()`.
 */

interface MovementArgs {
  yaw?: number;
  pitch?: number;
  ticks?: number;
}

export const primitives = {
  walk(args: MovementArgs): SimulationBuilder {
    const ticks = args.ticks ?? 28;
    return new SimulationBuilder()
      .waitFor('player_auth_input', 1)
      .keyDown('w')
      .waitFor('player_auth_input', ticks)
      .keyUp('w')
      .waitFor('player_auth_input', 5);
  },

  sprint(args: MovementArgs): SimulationBuilder {
    const ticks = args.ticks ?? 28;
    return new SimulationBuilder()
      .waitFor('player_auth_input', 1)
      .keyDown('ctrl', 'w')
      .waitFor('player_auth_input', ticks)
      .keyUp('ctrl', 'w')
      .waitFor('player_auth_input', 5);
  },

  sneak(args: MovementArgs): SimulationBuilder {
    const ticks = args.ticks ?? 28;
    return new SimulationBuilder()
      .waitFor('player_auth_input', 1)
      .keyDown('shift', 'w')
      .waitFor('player_auth_input', ticks)
      .keyUp('shift', 'w')
      .waitFor('player_auth_input', 5);
  },

  jump(): SimulationBuilder {
    return new SimulationBuilder()
      .waitFor('player_auth_input', 1)
      .keyDown('space')
      .waitFor('player_auth_input', 1)
      .keyUp('space')
      .waitFor('player_auth_input', 20);
  },
} as const;

export type PrimitiveName = keyof typeof primitives;
