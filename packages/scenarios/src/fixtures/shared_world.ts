// Shared world setup fixture — builds all 28 scenes in one superflat world.
// Each scene is at a different Z offset (100-block spacing). Player teleports
// through each area while issuing fill/setblock commands so BDS materializes
// the scene blocks.
//
// Run once to build the world, then snapshot the BDS world dir to a template
// path (see `bdt snapshot-world`). Subsequent physics fixture runs copy that
// template to BDS before launch, guaranteeing deterministic block geometry.
//
// Ported from v2 `recorder/src/fixtures2/shared_world.ts` (626 lines).

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { registerFixture } from './registry.js';

// Scene positions — each scene's origin offset
// viewZ = Z offset from origin where player stands to observe (1 block outside min Z edge)
const SCENES = {
  flat:               { x: 0, z: 0,    viewZ: -31 },  // extends -30 to +30
  waterPool:          { x: 0, z: 100,  viewZ: -11 },  // extends -10 to +10
  waterHalfPool:      { x: 0, z: 200,  viewZ: -11 },  // extends -10 to +10
  lavaPool:           { x: 0, z: 300,  viewZ: -11 },  // extends -10 to +10
  lavaHalfPool:       { x: 0, z: 400,  viewZ: -11 },  // extends -10 to +10
  flatPit:            { x: 0, z: 500,  viewZ: -16 },  // extends -15 to +15
  iceSurface:         { x: 0, z: 600,  viewZ: -11 },  // extends -10 to +10
  packedIceSurface:   { x: 0, z: 700,  viewZ: -11 },  // extends -10 to +10
  blueIceSurface:     { x: 0, z: 800,  viewZ: -11 },  // extends -10 to +10
  soulSandSurface:    { x: 0, z: 900,  viewZ: -11 },  // extends -10 to +10
  soulSoilSurface:    { x: 0, z: 1000, viewZ: -11 },  // extends -10 to +10
  honeySurface:       { x: 0, z: 1100, viewZ: -11 },  // extends -10 to +10
  slimeSurface:       { x: 0, z: 1200, viewZ: -11 },  // extends -10 to +10
  ladderWall:         { x: 0, z: 1300, viewZ: -6 },   // extends -5 to +5
  cobwebField:        { x: 0, z: 1400, viewZ: -9 },   // extends -8 to +5
  berryBushField:     { x: 0, z: 1500, viewZ: -9 },   // extends -8 to +5
  powderSnowField:    { x: 0, z: 1600, viewZ: -9 },   // extends -8 to +5
  bubbleUpColumn:     { x: 0, z: 1700, viewZ: -11 },  // extends -10 to +10
  bubbleDownColumn:   { x: 0, z: 1800, viewZ: -11 },  // extends -10 to +10
  collisionWalls:     { x: 0, z: 1900, viewZ: -16 },  // extends -15 to +15
  sneakEdgePlatform:  { x: 0, z: 2000, viewZ: -8 },   // extends -7 to +7
  stairsArea:         { x: 0, z: 2100, viewZ: -16 },  // extends -15 to +15
  fenceArea:          { x: 0, z: 2200, viewZ: -16 },  // extends -15 to +15
  slabArea:           { x: 0, z: 2300, viewZ: -11 },  // extends -10 to +10
  ceilingRoom:        { x: 0, z: 2400, viewZ: -11 },  // extends -10 to +10
  scaffoldingTower:   { x: 0, z: 2500, viewZ: -6 },   // extends -5 to +5
  vineWall:           { x: 0, z: 2600, viewZ: -11 },  // extends -10 to +10
  parkour:            { x: 0, z: 2700, viewZ: -1 },   // extends 0 to +15
  containers:         { x: 0, z: 2800, viewZ: -1 },   // row of 19 containers at z=2801
  oneBlockTunnel:     { x: 0, z: 2900, viewZ: -16 },  // 1-block-high tunnel, crouch-only
  slideWall:          { x: 0, z: 3000, viewZ: -11 },  // long wall with 1-block step for slide+jump
} as const;

// Y offset: ground is y=-1, y=0 is air where player stands
const OY = -1;

// Helper: offset fill command coordinates (applies OY to all Y values)
function fill(b: SimulationBuilder, ox: number, oz: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  block: string): SimulationBuilder {
  return b.command(`fill ${ox + x1} ${OY + y1} ${oz + z1} ${ox + x2} ${OY + y2} ${oz + z2} ${block}`);
}

// Helper: offset setblock command (applies OY to Y value)
function setblock(b: SimulationBuilder, ox: number, oz: number,
  x: number, y: number, z: number,
  block: string): SimulationBuilder {
  return b.command(`setblock ${ox + x} ${OY + y} ${oz + z} ${block}`);
}

// ─── Scene Build Functions ───────────────────────────────────────────

// 0. flat — 60×60 stone platform
function buildFlat(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -30, 0, -30, 30, 0, 30, 'stone');
}

// 1. waterPool — full pool, stone walls, water y=-10 to y=0
function buildWaterPool(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -15, -10, -10, 15, -10, 10, 'stone');
  // Stone walls (4 sides)
  fill(b, ox, oz, -15, -10, -10, -15, 0, 10, 'stone'); // west
  fill(b, ox, oz, 15, -10, -10, 15, 0, 10, 'stone');   // east
  fill(b, ox, oz, -15, -10, -10, 15, 0, -10, 'stone');  // north
  fill(b, ox, oz, -15, -10, 10, 15, 0, 10, 'stone');    // south
  // Water fill
  fill(b, ox, oz, -14, -9, -9, 14, 0, 9, 'water');
}

// 2. waterHalfPool — same size as full pool, left half air, right half water
function buildWaterHalfPool(b: SimulationBuilder, ox: number, oz: number) {
  // Full pool shell (same as waterPool)
  fill(b, ox, oz, -15, -10, -10, 15, -10, 10, 'stone');  // floor
  fill(b, ox, oz, -15, -10, -10, -15, 0, 10, 'stone');    // west wall
  fill(b, ox, oz, 15, -10, -10, 15, 0, 10, 'stone');      // east wall
  fill(b, ox, oz, -15, -10, -10, 15, 0, -10, 'stone');     // north wall
  fill(b, ox, oz, -15, -10, 10, 15, 0, 10, 'stone');       // south wall
  // Clear entire interior with air first
  fill(b, ox, oz, -14, -9, -9, 14, 0, 9, 'air');
  // Fill right half with water (X 0 to 14)
  fill(b, ox, oz, 0, -9, -9, 14, 0, 9, 'water');
}

// 3. lavaPool — full pool, stone walls, lava y=-10 to y=0
function buildLavaPool(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -15, -10, -10, 15, -10, 10, 'stone');
  fill(b, ox, oz, -15, -10, -10, -15, 0, 10, 'stone');
  fill(b, ox, oz, 15, -10, -10, 15, 0, 10, 'stone');
  fill(b, ox, oz, -15, -10, -10, 15, 0, -10, 'stone');
  fill(b, ox, oz, -15, -10, 10, 15, 0, 10, 'stone');
  fill(b, ox, oz, -14, -9, -9, 14, 0, 9, 'lava');
}

// 4. lavaHalfPool — same size as full pool, left half air, right half lava
function buildLavaHalfPool(b: SimulationBuilder, ox: number, oz: number) {
  // Full pool shell (same as lavaPool)
  fill(b, ox, oz, -15, -10, -10, 15, -10, 10, 'stone');  // floor
  fill(b, ox, oz, -15, -10, -10, -15, 0, 10, 'stone');    // west wall
  fill(b, ox, oz, 15, -10, -10, 15, 0, 10, 'stone');      // east wall
  fill(b, ox, oz, -15, -10, -10, 15, 0, -10, 'stone');     // north wall
  fill(b, ox, oz, -15, -10, 10, 15, 0, 10, 'stone');       // south wall
  // Clear entire interior with air first
  fill(b, ox, oz, -14, -9, -9, 14, 0, 9, 'air');
  // Fill right half with lava (X 0 to 14)
  fill(b, ox, oz, 0, -9, -9, 14, 0, 9, 'lava');
}

// 5. flatPit — stone floor + central 2-wide trench 5 deep
function buildFlatPit(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -15, 0, -15, 15, 0, 15, 'stone');
  // Dig central trench (2 wide on X: -1 to 0, full Z length, 5 deep)
  fill(b, ox, oz, -1, -4, -15, 0, 0, 15, 'air');
  // Stone floor at bottom of trench
  fill(b, ox, oz, -1, -5, -15, 0, -5, 15, 'stone');
  // Additional 1-wide gap for squeeze tests
  fill(b, ox, oz, 5, -4, -15, 5, 0, 15, 'air');
  fill(b, ox, oz, 5, -5, -15, 5, -5, 15, 'stone');
}

// 6. iceSurface — stone border + ice runway
function buildIceSurface(b: SimulationBuilder, ox: number, oz: number) {
  // Stone border
  fill(b, ox, oz, -20, 0, -10, 20, 0, 10, 'stone');
  // Ice runway (inner area)
  fill(b, ox, oz, -19, 0, -9, 19, 0, 9, 'ice');
}

// 7. packedIceSurface
function buildPackedIceSurface(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -20, 0, -10, 20, 0, 10, 'stone');
  fill(b, ox, oz, -19, 0, -9, 19, 0, 9, 'packed_ice');
}

// 8. blueIceSurface
function buildBlueIceSurface(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -20, 0, -10, 20, 0, 10, 'stone');
  fill(b, ox, oz, -19, 0, -9, 19, 0, 9, 'blue_ice');
}

// 9. soulSandSurface — 20×20 soul sand + stone border
function buildSoulSandSurface(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -10, 0, -10, 10, 0, 10, 'stone');
  fill(b, ox, oz, -9, 0, -9, 9, 0, 9, 'soul_sand');
}

// 10. soulSoilSurface — 20×20 soul soil + stone border
function buildSoulSoilSurface(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -10, 0, -10, 10, 0, 10, 'stone');
  fill(b, ox, oz, -9, 0, -9, 9, 0, 9, 'soul_soil');
}

// 11. honeySurface — 20×20 honey block + stone border
function buildHoneySurface(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -10, 0, -10, 10, 0, 10, 'stone');
  fill(b, ox, oz, -9, 0, -9, 9, 0, 9, 'honey_block');
}

// 12. slimeSurface — slime floor + drop platforms
function buildSlimeSurface(b: SimulationBuilder, ox: number, oz: number) {
  // Slime floor
  fill(b, ox, oz, -10, 0, -10, 10, 0, 10, 'slime');
  // Drop platforms at various heights (stone pillars with top platform)
  for (const [px, h] of [[3, 1], [5, 3], [7, 5], [9, 10], [-3, 20]] as const) {
    fill(b, ox, oz, px, 0, -5, px + 1, h, -4, 'stone');
    fill(b, ox, oz, px, h, -5, px + 1, h, -3, 'stone');
  }
}

// 13. ladderWall — stone wall + ladders on south face
function buildLadderWall(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -5, 0, -5, 5, 0, 5, 'stone');
  // Stone wall along X axis at z=5, 10 tall
  fill(b, ox, oz, -5, 1, 5, 5, 10, 5, 'stone');
  // Ladders on south face (z=4), facing north, attached to wall at z=5
  fill(b, ox, oz, -5, 1, 4, 5, 10, 4, 'ladder ["facing_direction"=2]');
}

// 14. cobwebField — cobwebs y=1 to y=5
function buildCobwebField(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -5, 0, -5, 5, 0, 5, 'stone');
  // Stone approach ramp at south
  fill(b, ox, oz, -5, 0, -8, 5, 0, -6, 'stone');
  // Cobwebs
  fill(b, ox, oz, -5, 1, -5, 5, 5, 5, 'web');
}

// 15. berryBushField — berry bushes at y=1
function buildBerryBushField(b: SimulationBuilder, ox: number, oz: number) {
  // Dirt floor (berry bushes require dirt/grass to stay placed)
  fill(b, ox, oz, -5, 0, -5, 5, 0, 5, 'dirt');
  // Stone approach
  fill(b, ox, oz, -5, 0, -8, 5, 0, -6, 'stone');
  // Berry bushes
  fill(b, ox, oz, -5, 1, -5, 5, 1, 5, 'sweet_berry_bush');
}

// 16. powderSnowField — powder snow y=0 to y=5, stone floor at y=-5
function buildPowderSnowField(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor at y=-5
  fill(b, ox, oz, -5, -5, -5, 5, -5, 5, 'stone');
  // Stone walkway at y=0 (approach)
  fill(b, ox, oz, -5, 0, -8, 5, 0, -6, 'stone');
  // Powder snow
  fill(b, ox, oz, -5, -4, -5, 5, 5, 5, 'powder_snow');
}

// 17. bubbleUpColumn — half-pool, soul sand bottom, water 8 deep
function buildBubbleUpColumn(b: SimulationBuilder, ox: number, oz: number) {
  // Left dry ground
  fill(b, ox, oz, -10, 0, -10, 0, 0, 10, 'stone');
  // Right pool floor
  fill(b, ox, oz, 0, -8, -10, 10, -8, 10, 'stone');
  // Right pool walls
  fill(b, ox, oz, 0, -8, -10, 10, 0, -10, 'stone');  // north
  fill(b, ox, oz, 0, -8, 10, 10, 0, 10, 'stone');     // south
  fill(b, ox, oz, 10, -8, -10, 10, 0, 10, 'stone');   // east
  // Soul sand bottom (must be placed before water for bubble columns)
  fill(b, ox, oz, 1, -8, -9, 9, -8, 9, 'soul_sand');
  b.waitFor('player_auth_input', 2);
  // Water above soul sand
  fill(b, ox, oz, 1, -7, -9, 9, 0, 9, 'water');
}

// 18. bubbleDownColumn — half-pool, magma bottom, water 8 deep
function buildBubbleDownColumn(b: SimulationBuilder, ox: number, oz: number) {
  fill(b, ox, oz, -10, 0, -10, 0, 0, 10, 'stone');
  fill(b, ox, oz, 0, -8, -10, 10, -8, 10, 'stone');
  fill(b, ox, oz, 0, -8, -10, 10, 0, -10, 'stone');
  fill(b, ox, oz, 0, -8, 10, 10, 0, 10, 'stone');
  fill(b, ox, oz, 10, -8, -10, 10, 0, 10, 'stone');
  fill(b, ox, oz, 1, -8, -9, 9, -8, 9, 'magma');
  b.waitFor('player_auth_input', 2);
  fill(b, ox, oz, 1, -7, -9, 9, 0, 9, 'water');
}

// 19. collisionWalls — various wall arrangements
function buildCollisionWalls(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -15, 0, -15, 15, 0, 15, 'stone');
  // Perpendicular wall along Z (head-on collision)
  fill(b, ox, oz, 0, 1, 5, 0, 3, 10, 'stone');
  // Perpendicular wall along X
  fill(b, ox, oz, -10, 1, 0, -5, 3, 0, 'stone');
  // L-corner walls
  fill(b, ox, oz, 5, 1, -10, 10, 3, -10, 'stone');   // horizontal arm
  fill(b, ox, oz, 10, 1, -10, 10, 3, -5, 'stone');    // vertical arm
  // 2-high wall for airborne collision
  fill(b, ox, oz, -10, 1, 10, -5, 2, 10, 'stone');
  // Thin gap — two walls with 1-block gap
  fill(b, ox, oz, -15, 1, -5, -13, 3, -5, 'stone');
  fill(b, ox, oz, -11, 1, -5, -9, 3, -5, 'stone');
}

// 20. sneakEdgePlatform — elevated platform y=5, ladder access
function buildSneakEdgePlatform(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor below
  fill(b, ox, oz, -7, 0, -7, 7, 0, 7, 'stone');
  // Elevated platform at y=5
  fill(b, ox, oz, -5, 5, -5, 5, 5, 5, 'stone');
  // Ladder access on south side (z=-5 face, ladders at z=-6)
  fill(b, ox, oz, 0, 1, -5, 0, 5, -5, 'stone');
  fill(b, ox, oz, 0, 1, -6, 0, 5, -6, 'ladder ["facing_direction"=2]');
}

// 21. stairsArea — 4 directional staircases + corners + inverted
function buildStairsArea(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -15, 0, -15, 15, 0, 15, 'stone');

  // East-facing staircase (5 steps, going +X)
  for (let i = 0; i < 5; i++) {
    setblock(b, ox, oz, -10 + i, 1 + i, -10, `stone_stairs ["weirdo_direction"=0,"upside_down_bit"=false]`);
  }
  // West-facing staircase
  for (let i = 0; i < 5; i++) {
    setblock(b, ox, oz, 10 - i, 1 + i, -10, `stone_stairs ["weirdo_direction"=1,"upside_down_bit"=false]`);
  }
  // South-facing staircase (going +Z)
  for (let i = 0; i < 5; i++) {
    setblock(b, ox, oz, -10, 1 + i, -5 + i, `stone_stairs ["weirdo_direction"=2,"upside_down_bit"=false]`);
  }
  // North-facing staircase (going -Z)
  for (let i = 0; i < 5; i++) {
    setblock(b, ox, oz, -10, 1 + i, 10 - i, `stone_stairs ["weirdo_direction"=3,"upside_down_bit"=false]`);
  }

  // Inner corner stairs (L-shape, east + south)
  for (let i = 0; i < 3; i++) {
    setblock(b, ox, oz, 0 + i, 1 + i, 0, `stone_stairs ["weirdo_direction"=0,"upside_down_bit"=false]`);
    setblock(b, ox, oz, 0, 1 + i, 0 + i, `stone_stairs ["weirdo_direction"=2,"upside_down_bit"=false]`);
  }

  // Inverted (upside-down) stairs
  for (let i = 0; i < 5; i++) {
    setblock(b, ox, oz, 5 + i, 1 + i, 5, `stone_stairs ["weirdo_direction"=0,"upside_down_bit"=true]`);
  }

  // 1-block step-up platform
  fill(b, ox, oz, 5, 1, -5, 7, 1, -3, 'stone');
}

// 22. fenceArea — fence/pane/iron bars in various bitmask combos
function buildFenceArea(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -15, 0, -15, 15, 0, 15, 'stone');

  // === Fence posts ===
  // Isolated fence post (mask 0)
  setblock(b, ox, oz, -12, 1, -12, 'oak_fence');
  // N-S straight line (3 posts)
  for (let z = -10; z <= -8; z++) setblock(b, ox, oz, -12, 1, z, 'oak_fence');
  // E-W straight line
  for (let x = -10; x <= -8; x++) setblock(b, ox, oz, x, 1, -12, 'oak_fence');
  // L-corner (south+east)
  setblock(b, ox, oz, -6, 1, -12, 'oak_fence');
  setblock(b, ox, oz, -5, 1, -12, 'oak_fence');
  setblock(b, ox, oz, -6, 1, -11, 'oak_fence');
  // T-junction
  setblock(b, ox, oz, -3, 1, -12, 'oak_fence');
  setblock(b, ox, oz, -2, 1, -12, 'oak_fence');
  setblock(b, ox, oz, -1, 1, -12, 'oak_fence');
  setblock(b, ox, oz, -2, 1, -11, 'oak_fence');
  // Cross (+) all 4 connections
  setblock(b, ox, oz, 2, 1, -12, 'oak_fence');
  setblock(b, ox, oz, 1, 1, -12, 'oak_fence');
  setblock(b, ox, oz, 3, 1, -12, 'oak_fence');
  setblock(b, ox, oz, 2, 1, -11, 'oak_fence');
  setblock(b, ox, oz, 2, 1, -13, 'oak_fence');

  // === Glass panes (same patterns, offset Z) ===
  setblock(b, ox, oz, -12, 1, -5, 'glass_pane');
  for (let z = -3; z <= -1; z++) setblock(b, ox, oz, -12, 1, z, 'glass_pane');
  for (let x = -10; x <= -8; x++) setblock(b, ox, oz, x, 1, -5, 'glass_pane');
  // L-corner
  setblock(b, ox, oz, -6, 1, -5, 'glass_pane');
  setblock(b, ox, oz, -5, 1, -5, 'glass_pane');
  setblock(b, ox, oz, -6, 1, -4, 'glass_pane');
  // T-junction
  setblock(b, ox, oz, -3, 1, -5, 'glass_pane');
  setblock(b, ox, oz, -2, 1, -5, 'glass_pane');
  setblock(b, ox, oz, -1, 1, -5, 'glass_pane');
  setblock(b, ox, oz, -2, 1, -4, 'glass_pane');
  // Cross
  setblock(b, ox, oz, 2, 1, -5, 'glass_pane');
  setblock(b, ox, oz, 1, 1, -5, 'glass_pane');
  setblock(b, ox, oz, 3, 1, -5, 'glass_pane');
  setblock(b, ox, oz, 2, 1, -4, 'glass_pane');
  setblock(b, ox, oz, 2, 1, -6, 'glass_pane');

  // === Iron bars (same patterns, offset Z) ===
  setblock(b, ox, oz, -12, 1, 2, 'iron_bars');
  for (let z = 4; z <= 6; z++) setblock(b, ox, oz, -12, 1, z, 'iron_bars');
  for (let x = -10; x <= -8; x++) setblock(b, ox, oz, x, 1, 2, 'iron_bars');
  // L-corner
  setblock(b, ox, oz, -6, 1, 2, 'iron_bars');
  setblock(b, ox, oz, -5, 1, 2, 'iron_bars');
  setblock(b, ox, oz, -6, 1, 3, 'iron_bars');
  // T-junction
  setblock(b, ox, oz, -3, 1, 2, 'iron_bars');
  setblock(b, ox, oz, -2, 1, 2, 'iron_bars');
  setblock(b, ox, oz, -1, 1, 2, 'iron_bars');
  setblock(b, ox, oz, -2, 1, 3, 'iron_bars');
  // Cross
  setblock(b, ox, oz, 2, 1, 2, 'iron_bars');
  setblock(b, ox, oz, 1, 1, 2, 'iron_bars');
  setblock(b, ox, oz, 3, 1, 2, 'iron_bars');
  setblock(b, ox, oz, 2, 1, 3, 'iron_bars');
  setblock(b, ox, oz, 2, 1, 1, 'iron_bars');

  // Fence-to-wall connections
  fill(b, ox, oz, 8, 1, -12, 8, 3, -12, 'stone');
  setblock(b, ox, oz, 7, 1, -12, 'oak_fence');
  setblock(b, ox, oz, 9, 1, -12, 'oak_fence');
}

// 23. slabArea — bottom/top slabs, steps, mixed
function buildSlabArea(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -10, 0, -10, 10, 0, 10, 'stone');
  // Bottom slab row (z=-5)
  fill(b, ox, oz, -8, 1, -5, 8, 1, -5, 'stone_block_slab');
  // Top slab row (z=-3) — top half
  fill(b, ox, oz, -8, 1, -3, 8, 1, -3, 'stone_block_slab ["top_slot_bit"=true]');
  // Slab steps — alternating bottom/top forming half-step staircase (z=0)
  for (let i = 0; i < 8; i++) {
    const topBit = i % 2 === 0 ? 'false' : 'true';
    setblock(b, ox, oz, -4 + i, 1, 0, `stone_block_slab ["top_slot_bit"=${topBit}]`);
  }
  // Elevated slabs at various heights
  setblock(b, ox, oz, -5, 2, 3, 'stone_block_slab');
  setblock(b, ox, oz, -3, 3, 3, 'stone_block_slab');
  setblock(b, ox, oz, -1, 4, 3, 'stone_block_slab');
  // Mixed: full block then slab
  fill(b, ox, oz, 3, 1, 3, 3, 1, 3, 'stone');
  setblock(b, ox, oz, 4, 1, 3, 'stone_block_slab');
  fill(b, ox, oz, 5, 1, 3, 5, 1, 3, 'stone');
}

// 24. ceilingRoom — 2-high, 1.5-high rooms, 1-high tunnel
function buildCeilingRoom(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -10, 0, -10, 10, 0, 10, 'stone');

  // 2-high room (10×10, ceiling at y=3 means 2 blocks of air: y=1,y=2)
  fill(b, ox, oz, -10, 3, -10, -1, 3, -1, 'stone');   // ceiling
  fill(b, ox, oz, -10, 1, -10, -10, 3, -1, 'stone');   // west wall
  fill(b, ox, oz, -1, 1, -10, -1, 3, -1, 'stone');     // east wall
  fill(b, ox, oz, -10, 1, -10, -1, 3, -10, 'stone');   // north wall
  // south side open for entry

  // 1.5-high room (ceiling at y=2, slab on bottom of y=2 for 1.5 clearance)
  fill(b, ox, oz, 1, 2, -10, 10, 2, -1, 'stone');     // ceiling
  fill(b, ox, oz, 1, 1, -10, 1, 2, -1, 'stone');       // west wall
  fill(b, ox, oz, 10, 1, -10, 10, 2, -1, 'stone');     // east wall
  fill(b, ox, oz, 1, 1, -10, 10, 2, -10, 'stone');     // north wall

  // 1-high tunnel (ceiling at y=1)
  fill(b, ox, oz, -5, 1, 3, 5, 1, 7, 'stone');         // ceiling
  fill(b, ox, oz, -5, 1, 3, -5, 1, 7, 'stone');         // west wall
  fill(b, ox, oz, 5, 1, 3, 5, 1, 7, 'stone');           // east wall
  fill(b, ox, oz, -5, 1, 7, 5, 1, 7, 'stone');          // north wall (back)
}

// 25. scaffoldingTower — 3×3 scaffolding column 10 high
function buildScaffoldingTower(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -5, 0, -5, 5, 0, 5, 'stone');
  // Scaffolding column (3×3, y=1 to y=10)
  fill(b, ox, oz, -1, 1, -1, 1, 10, 1, 'scaffolding');
  // Stone platform at top
  fill(b, ox, oz, -2, 11, -2, 2, 11, 2, 'stone');
}

// 26. vineWall — vines, cave vines, twisting vines on stone wall
function buildVineWall(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor
  fill(b, ox, oz, -5, 0, -10, 5, 0, 10, 'stone');
  // Stone wall (along X at z=5, 10 tall, 20 long)
  fill(b, ox, oz, -10, 1, 5, 10, 10, 5, 'stone');

  // Section 1: Regular vines on south face (x=-10 to -4, z=4)
  fill(b, ox, oz, -10, 1, 4, -4, 10, 4, 'vine');

  // Section 2: Cave vines hanging from ceiling (x=-3 to 3)
  // Place stone ceiling at y=10, cave vines hang down
  fill(b, ox, oz, -3, 10, 3, 3, 10, 3, 'stone');
  for (let x = -3; x <= 3; x++) {
    for (let y = 3; y <= 9; y++) {
      setblock(b, ox, oz, x, y, 3, 'cave_vines');
    }
  }

  // Section 3: Twisting vines growing upward (x=4 to 10)
  for (let x = 4; x <= 10; x++) {
    for (let y = 1; y <= 8; y++) {
      setblock(b, ox, oz, x, y, 3, 'twisting_vines');
    }
  }
}

// 27. parkour — parkour1 course (16×18×16)
function buildParkour(b: SimulationBuilder, ox: number, oz: number) {
  // Bedrock floor 16×16 at y=0
  fill(b, ox, oz, 0, 0, 0, 15, 0, 15, 'bedrock');

  // First jump sequence (along z-axis at x=0)
  setblock(b, ox, oz, 0, 1, 15, 'gold_block');
  setblock(b, ox, oz, 0, 2, 12, 'diamond_block');
  setblock(b, ox, oz, 0, 3, 9, 'gold_block');

  // Second sequence (x=3)
  setblock(b, ox, oz, 3, 2, 12, 'gold_block');

  // Third sequence (x=5)
  setblock(b, ox, oz, 5, 1, 14, 'gold_block');
  setblock(b, ox, oz, 5, 2, 12, 'diamond_block');
  setblock(b, ox, oz, 5, 3, 10, 'gold_block');

  // Fourth sequence (x=7)
  setblock(b, ox, oz, 7, 2, 12, 'gold_block');

  // Main elevated platform area — walls at x=9
  fill(b, ox, oz, 9, 1, 5, 9, 5, 8, 'bedrock');
  fill(b, ox, oz, 9, 1, 10, 9, 3, 14, 'bedrock');

  // x=10 platforms
  fill(b, ox, oz, 10, 1, 5, 10, 2, 5, 'bedrock');
  setblock(b, ox, oz, 10, 1, 7, 'gold_block');
  fill(b, ox, oz, 10, 1, 8, 10, 2, 10, 'bedrock');
  fill(b, ox, oz, 10, 1, 11, 10, 1, 15, 'bedrock');
  fill(b, ox, oz, 10, 2, 14, 10, 3, 15, 'bedrock');
  fill(b, ox, oz, 10, 3, 5, 10, 5, 5, 'bedrock');
  fill(b, ox, oz, 10, 3, 8, 10, 5, 8, 'bedrock');

  // x=11 platforms
  fill(b, ox, oz, 11, 1, 5, 11, 1, 9, 'bedrock');
  setblock(b, ox, oz, 11, 1, 10, 'gold_block');
  fill(b, ox, oz, 11, 1, 11, 11, 1, 13, 'bedrock');
  setblock(b, ox, oz, 11, 1, 14, 'gold_block');
  setblock(b, ox, oz, 11, 1, 15, 'bedrock');
  fill(b, ox, oz, 11, 2, 5, 11, 2, 5, 'bedrock');
  fill(b, ox, oz, 11, 2, 8, 11, 2, 9, 'bedrock');
  setblock(b, ox, oz, 11, 2, 12, 'bedrock');
  setblock(b, ox, oz, 11, 2, 15, 'bedrock');
  fill(b, ox, oz, 11, 3, 5, 11, 3, 5, 'bedrock');
  fill(b, ox, oz, 11, 3, 8, 11, 3, 9, 'bedrock');
  setblock(b, ox, oz, 11, 3, 12, 'bedrock');
  setblock(b, ox, oz, 11, 3, 15, 'bedrock');
  fill(b, ox, oz, 11, 4, 5, 11, 5, 5, 'bedrock');
  fill(b, ox, oz, 11, 4, 8, 11, 5, 8, 'bedrock');

  // x=12 platforms
  fill(b, ox, oz, 12, 1, 5, 12, 4, 10, 'bedrock');
  fill(b, ox, oz, 12, 1, 11, 12, 1, 15, 'bedrock');
  fill(b, ox, oz, 12, 2, 14, 12, 3, 15, 'bedrock');
  setblock(b, ox, oz, 12, 5, 5, 'gold_block');
  fill(b, ox, oz, 12, 5, 6, 12, 5, 8, 'bedrock');

  // Wall at x=13
  fill(b, ox, oz, 13, 1, 10, 13, 3, 14, 'bedrock');

  // Vertical tower at x=15, z=0
  fill(b, ox, oz, 15, 1, 0, 15, 16, 0, 'bedrock');
  setblock(b, ox, oz, 15, 17, 0, 'emerald_block');
}

// 29. oneBlockTunnel — long stone corridor with 1 block of headroom.
// Standing player AABB (~1.8 tall) doesn't fit; player MUST crouch
// (sneak) to enter and traverse. Tests sneak-walk in confined space.
//
// Layout (scene-local coords, OY = -1 applied to all Y):
//   floor:    y=0 stone, full 30×30 area
//   tunnel:   z=-5..+20 along the +z axis, 3 blocks wide (x=-1..+1)
//             - ceiling at y=2 stone
//             - left wall at x=-2, y=1..2 stone
//             - right wall at x=+2, y=1..2 stone
//             - inside is 1 block tall (y=1 air, y=0 floor, y=2 ceiling)
//   approach: south of the tunnel (z<-5) is open flat ground for the
//             player to stand on before crouching.
function buildOneBlockTunnel(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor + walls + ceiling
  fill(b, ox, oz, -15, 0, -15, 15, 0, 20, 'stone');
  // Tunnel ceiling (only over the tunnel itself, x=-1..+1, z=-5..+20)
  fill(b, ox, oz, -1, 2, -5, 1, 2, 20, 'stone');
  // Tunnel side walls (also 2-blocks high so they extend up to ceiling)
  fill(b, ox, oz, -2, 1, -5, -2, 2, 20, 'stone'); // left wall
  fill(b, ox, oz, 2, 1, -5, 2, 2, 20, 'stone');   // right wall
  // Carve out the tunnel interior (just to be safe — fill with air)
  fill(b, ox, oz, -1, 1, -5, 1, 1, 20, 'air');
}

// 30. slideWall — long impassable wall along the +x face with one
// 1-block-high "step" section the player can step up onto. Tests
// "slide along wall until you find the spot you can climb" behavior.
//
// Layout:
//   floor:        y=0 stone -15..15 × -15..15
//   wall (south): x=5, y=1..3, z=-15..-2  (3-high impassable)
//   wall step:    x=5, y=1 only at z=-1..+1 (1-high — auto step-up)
//   wall (north): x=5, y=1..3, z=2..15    (3-high impassable)
//
// Player approaches from x=0 (or further left), walks +x into the wall,
// then strafes along z to find the step section. Sliding + sprint-jump
// behavior surfaces here clearly.
function buildSlideWall(b: SimulationBuilder, ox: number, oz: number) {
  // Floor
  fill(b, ox, oz, -15, 0, -15, 15, 0, 15, 'stone');
  // 3-high wall segments (south + north)
  fill(b, ox, oz, 5, 1, -15, 5, 3, -2, 'stone');
  fill(b, ox, oz, 5, 1, 2, 5, 3, 15, 'stone');
  // 1-high step section in the middle (z = -1..+1)
  fill(b, ox, oz, 5, 1, -1, 5, 1, 1, 'stone');
}

// 28. containers — row of 19 GUI-bearing blocks. Lifted from v2
// `25_container.ts:29-47` so the template world has them pre-placed.
// Stone platform underneath so the player can stand next to them.
function buildContainers(b: SimulationBuilder, ox: number, oz: number) {
  // Stone floor 22 wide × 4 deep, covering x=-1..20 and z=0..3
  fill(b, ox, oz, -1, 0, 0, 20, 0, 3, 'stone');

  // Containers in a row at z=2 (= oz + 2 absolute)
  setblock(b, ox, oz,  1, 1, 2, 'dispenser');
  setblock(b, ox, oz,  2, 1, 2, 'crafting_table');
  setblock(b, ox, oz,  3, 1, 2, 'furnace');
  setblock(b, ox, oz,  4, 1, 2, 'blast_furnace');
  setblock(b, ox, oz,  5, 1, 2, 'smoker');
  setblock(b, ox, oz,  6, 1, 2, 'anvil');
  setblock(b, ox, oz,  7, 1, 2, 'enchanting_table');
  setblock(b, ox, oz,  8, 1, 2, 'brewing_stand');
  setblock(b, ox, oz,  9, 1, 2, 'grindstone');
  setblock(b, ox, oz, 10, 1, 2, 'loom');
  setblock(b, ox, oz, 11, 1, 2, 'stonecutter_block');
  setblock(b, ox, oz, 12, 1, 2, 'smithing_table');
  setblock(b, ox, oz, 13, 1, 2, 'barrel');
  setblock(b, ox, oz, 14, 1, 2, 'chest');
  setblock(b, ox, oz, 15, 1, 2, 'trapped_chest');
  setblock(b, ox, oz, 16, 1, 2, 'ender_chest');
  setblock(b, ox, oz, 18, 1, 2, 'hopper');
  setblock(b, ox, oz, 19, 1, 2, 'dropper');
  setblock(b, ox, oz, 20, 1, 2, 'cartography_table');
}

// ─── Build function registry ─────────────────────────────────────────

const BUILD_FUNCTIONS: Record<string, (b: SimulationBuilder, ox: number, oz: number) => void> = {
  flat: buildFlat,
  waterPool: buildWaterPool,
  waterHalfPool: buildWaterHalfPool,
  lavaPool: buildLavaPool,
  lavaHalfPool: buildLavaHalfPool,
  flatPit: buildFlatPit,
  iceSurface: buildIceSurface,
  packedIceSurface: buildPackedIceSurface,
  blueIceSurface: buildBlueIceSurface,
  soulSandSurface: buildSoulSandSurface,
  soulSoilSurface: buildSoulSoilSurface,
  honeySurface: buildHoneySurface,
  slimeSurface: buildSlimeSurface,
  ladderWall: buildLadderWall,
  cobwebField: buildCobwebField,
  berryBushField: buildBerryBushField,
  powderSnowField: buildPowderSnowField,
  bubbleUpColumn: buildBubbleUpColumn,
  bubbleDownColumn: buildBubbleDownColumn,
  collisionWalls: buildCollisionWalls,
  sneakEdgePlatform: buildSneakEdgePlatform,
  stairsArea: buildStairsArea,
  fenceArea: buildFenceArea,
  slabArea: buildSlabArea,
  ceilingRoom: buildCeilingRoom,
  scaffoldingTower: buildScaffoldingTower,
  vineWall: buildVineWall,
  parkour: buildParkour,
  containers: buildContainers,
  oneBlockTunnel: buildOneBlockTunnel,
  slideWall: buildSlideWall,
};

// ─── Main fixture ────────────────────────────────────────────────────

function buildSharedWorldSetupFixture(): Fixture {
  const sequences: SimulationSequence[] = [];

  for (const [name, pos] of Object.entries(SCENES)) {
    const buildFn = BUILD_FUNCTIONS[name];
    if (!buildFn) continue;

    const b = new SimulationBuilder();
    // Teleport to ground level (y=0, feet on ground at y=-1), outside the scene
    b.teleport(pos.x, 0, pos.z + pos.viewZ, 0, 0);
    b.waitFor('player_auth_input', 40);
    // Log which scene we're building (lands in the dump as a 'note' L-record)
    b.log(`Building scene: ${name} at x=${pos.x} z=${pos.z}`);
    // Run the scene's fill/setblock commands
    buildFn(b, pos.x, pos.z);
    // Let blocks settle, then observe so chunks fully persist
    b.waitFor('player_auth_input', 20);
    b.waitFor('player_auth_input', 60);

    sequences.push(b.build());
  }

  return { name: 'shared_world_setup', sequences };
}

function buildVisitFixture(): Fixture {
  // Same scene list, no fill commands — just teleports + chunk-load waits.
  // Useful for verifying a snapshotted template world has all 28 scenes intact.
  const sequences: SimulationSequence[] = [];
  for (const [, pos] of Object.entries(SCENES)) {
    const b = new SimulationBuilder();
    b.teleport(pos.x, 0, pos.z + pos.viewZ, 0, 0);
    b.waitUntilChunksLoaded();
    b.waitFor('player_auth_input', 40);
    sequences.push(b.build());
  }
  return { name: 'shared_world_visit', sequences };
}

registerFixture(buildSharedWorldSetupFixture());
registerFixture(buildVisitFixture());
