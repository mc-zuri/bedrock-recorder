// Scene positions — exports coordinates for every pre-built scene in the
// shared scenes world. Ported from v2 `recorder/src/fixtures2/scene_positions.ts`.

import { SimulationBuilder } from '../builder.js';

export const SCENES = {
  flat:               { x: 0, z: 0,    viewZ: -31 },
  waterPool:          { x: 0, z: 100,  viewZ: -11 },
  waterHalfPool:      { x: 0, z: 200,  viewZ: -11 },
  lavaPool:           { x: 0, z: 300,  viewZ: -11 },
  lavaHalfPool:       { x: 0, z: 400,  viewZ: -11 },
  flatPit:            { x: 0, z: 500,  viewZ: -16 },
  iceSurface:         { x: 0, z: 600,  viewZ: -11 },
  packedIceSurface:   { x: 0, z: 700,  viewZ: -11 },
  blueIceSurface:     { x: 0, z: 800,  viewZ: -11 },
  soulSandSurface:    { x: 0, z: 900,  viewZ: -11 },
  soulSoilSurface:    { x: 0, z: 1000, viewZ: -11 },
  honeySurface:       { x: 0, z: 1100, viewZ: -11 },
  slimeSurface:       { x: 0, z: 1200, viewZ: -11 },
  ladderWall:         { x: 0, z: 1300, viewZ:  -6 },
  cobwebField:        { x: 0, z: 1400, viewZ:  -9 },
  berryBushField:     { x: 0, z: 1500, viewZ:  -9 },
  powderSnowField:    { x: 0, z: 1600, viewZ:  -9 },
  bubbleUpColumn:     { x: 0, z: 1700, viewZ: -11 },
  bubbleDownColumn:   { x: 0, z: 1800, viewZ: -11 },
  collisionWalls:     { x: 0, z: 1900, viewZ: -16 },
  sneakEdgePlatform:  { x: 0, z: 2000, viewZ:  -8 },
  stairsArea:         { x: 0, z: 2100, viewZ: -16 },
  fenceArea:          { x: 0, z: 2200, viewZ: -16 },
  slabArea:           { x: 0, z: 2300, viewZ: -11 },
  ceilingRoom:        { x: 0, z: 2400, viewZ: -11 },
  scaffoldingTower:   { x: 0, z: 2500, viewZ:  -6 },
  vineWall:           { x: 0, z: 2600, viewZ: -11 },
  parkour:            { x: 0, z: 2700, viewZ:  -1 },
  containers:         { x: 0, z: 2800, viewZ:  -1 },
  oneBlockTunnel:     { x: 0, z: 2900, viewZ: -16 },
  slideWall:          { x: 0, z: 3000, viewZ: -11 },
} as const;

export type SceneName = keyof typeof SCENES;

export function scenePos(name: SceneName): { x: number; z: number; viewZ: number } {
  return SCENES[name];
}

/**
 * The world-prep view position for a scene — `(x, 0, z + viewZ)`. This is
 * exactly where the player stood while `shared_world_setup` filled the scene's
 * blocks, so chunks within render distance are guaranteed loaded once you
 * teleport here.
 *
 * Use as the `sceneAnchor` argument to `SimulationBuilder.sceneTestCase()` so
 * each fixture's preamble lands at a *per-scene* safe spot, not a fixed
 * global one. With `safeZoneYOffset` (default 32), the resulting safe-zone
 * teleport puts the player at `(x, 32, z + viewZ)` — clear of structures,
 * same chunk column as the scene.
 */
export function sceneAnchor(
  scene: { x: number; z: number; viewZ: number },
): { x: number; y: number; z: number } {
  return { x: scene.x, y: 0, z: scene.z + scene.viewZ };
}

/**
 * Teleport to a scene and wait for chunks to load. Use once at the start of
 * each scene's test block to avoid per-test chunk-load latency.
 *
 * `${PLAYER}` substitution happens at execute time; fixtures don't need to
 * thread the username through.
 */
export function preloadScene(
  scene: { x: number; z: number; viewZ: number },
  y = 0,
  yaw = 0,
): ReturnType<SimulationBuilder['build']> {
  return new SimulationBuilder()
    .waitFor('player_auth_input', 50)
    .teleport(scene.x, y, scene.z + scene.viewZ - 1, yaw, 0)
    .waitFor('player_auth_input', 4)
    .waitFor('player_auth_input', 10)
    .waitUntilChunksLoaded()
    .waitUntilChunksLoaded()
    .waitFor('player_auth_input', 10)
    .command('effect ${PLAYER} resistance 9999 255 true')
    .build();
}
