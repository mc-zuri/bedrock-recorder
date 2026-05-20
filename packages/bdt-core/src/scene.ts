/**
 * Pre-built scene presets that live in the shared scenes world.
 * Adding a new preset is a two-step change:
 *   1. add the literal here
 *   2. add a build routine in @bdt/scenarios that constructs the scene
 */
export type ScenePreset =
  | 'flat'
  | 'water_pool'
  | 'water_half_pool'
  | 'lava_pool'
  | 'lava_half_pool'
  | 'flat_pit'
  | 'ice_surface'
  | 'packed_ice_surface'
  | 'blue_ice_surface'
  | 'soul_sand_surface'
  | 'soul_soil_surface'
  | 'honey_surface'
  | 'slime_surface'
  | 'ladder_wall'
  | 'cobweb_field'
  | 'berry_bush_field'
  | 'powder_snow_field'
  | 'bubble_up_column'
  | 'bubble_down_column'
  | 'collision_walls'
  | 'sneak_edge_platform'
  | 'stairs_area'
  | 'fence_area'
  | 'slab_area'
  | 'ceiling_room'
  | 'scaffolding_tower'
  | 'vine_wall';

export interface WorldScene {
  preset: ScenePreset;
  /** Optional per-instance parameters (e.g. liquid depth, stair shape) */
  params?: Record<string, unknown>;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BlockDef {
  pos: Vec3;
  type: string;
  states?: Record<string, string | number | boolean>;
}
