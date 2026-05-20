// Fixture: v11 Coverage — Soul Speed, Armor Fly (Elytra), Freeze Immune, Item Use.
// Covers the 4 ECS flags added in snapshot v11.
//
// Ported from v2 `recorder/src/fixtures2/24_v11_coverage.ts`. Per-case setup
// (enchanted boots / armor / hotbar items / effects) lands inside the
// recorded window so attribute and inventory packets are captured.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

type Pos = { x: number; y: number; z: number };

const ANCHOR_SOULSAND = sceneAnchor(SCENES.soulSandSurface);
const ANCHOR_SOULSOIL = sceneAnchor(SCENES.soulSoilSurface);
const ANCHOR_FLAT = sceneAnchor(SCENES.flat);
const ANCHOR_SNOW = sceneAnchor(SCENES.powderSnowField);

const soulSandPos: Pos = { x: SCENES.soulSandSurface.x, y: 0, z: SCENES.soulSandSurface.z };
const soulSoilPos: Pos = { x: SCENES.soulSoilSurface.x, y: 0, z: SCENES.soulSoilSurface.z };
const flat: Pos = { x: SCENES.flat.x, y: 0, z: SCENES.flat.z };
const highPos: Pos = { x: SCENES.flat.x, y: 200, z: SCENES.flat.z };
const snowApproach: Pos = { x: SCENES.powderSnowField.x, y: 0, z: SCENES.powderSnowField.z - 5 };
const snowCenter: Pos = { x: SCENES.powderSnowField.x, y: 1, z: SCENES.powderSnowField.z };

// ─── Soul Speed boots ──────────────────────────────────────────────────

function withEnchantedBoots(
  name: string,
  description: string,
  enchantment: string,
  level: number,
  run: (b: SimulationBuilder) => SimulationBuilder,
  pos: Pos,
  anchor: Pos,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos: pos,
      sceneAnchor: anchor,
      setupDescription: `equip diamond_boots with ${enchantment} ${level} via scriptevent`,
      setup: (b) => b.command(`scriptevent test:equip_enchanted Feet diamond_boots ${enchantment}:${level}`),
      run,
    })
    .build();
}

// ─── Hotbar item wrapper ───────────────────────────────────────────────

function withHotbarItem(
  name: string,
  description: string,
  item: string,
  run: (b: SimulationBuilder) => SimulationBuilder,
  pos: Pos,
  anchor: Pos = ANCHOR_FLAT,
): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos: pos,
      sceneAnchor: anchor,
      setupDescription: `equip hotbar slot 0 = ${item}`,
      setup: (b) => b.command(`replaceitem entity \${PLAYER} slot.hotbar 0 ${item}`),
      run,
    })
    .build();
}

// ─── Plain move ────────────────────────────────────────────────────────

function moveCase(name: string, description: string, keys: string[], ticks: number, pos: Pos, anchor: Pos): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name,
      description,
      startPos: pos,
      sceneAnchor: anchor,
      run: (b) =>
        b.keyDown(...keys)
          .waitFor('player_auth_input', ticks)
          .keyUp(...keys)
          .waitUntilStable()
          .waitFor('player_auth_input', 1),
    })
    .build();
}

function buildV11CoverageFixture(): Fixture {
  const seqs: SimulationSequence[] = [];

  // 1. Soul Speed on soul sand
  for (const level of [1, 2, 3]) {
    seqs.push(withEnchantedBoots(
      `soul_speed_${level}_walk_sand`,
      `Walk on soul sand with Soul Speed ${level} boots`,
      'soul_speed', level,
      (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
      soulSandPos, ANCHOR_SOULSAND,
    ));
    seqs.push(withEnchantedBoots(
      `soul_speed_${level}_sprint_sand`,
      `Sprint on soul sand with Soul Speed ${level} boots`,
      'soul_speed', level,
      (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 25).keyUp('ctrl', 'w').waitUntilStable().waitFor('player_auth_input', 1),
      soulSandPos, ANCHOR_SOULSAND,
    ));
  }
  // Soul Speed III on soul soil
  seqs.push(withEnchantedBoots(
    'soul_speed_3_walk_soil', 'Walk on soul soil with Soul Speed III boots',
    'soul_speed', 3,
    (b) => b.keyDown('w').waitFor('player_auth_input', 25).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
    soulSoilPos, ANCHOR_SOULSOIL,
  ));
  seqs.push(withEnchantedBoots(
    'soul_speed_3_sprint_soil', 'Sprint on soul soil with Soul Speed III boots',
    'soul_speed', 3,
    (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 25).keyUp('ctrl', 'w').waitUntilStable().waitFor('player_auth_input', 1),
    soulSoilPos, ANCHOR_SOULSOIL,
  ));
  // Baseline (no boots)
  seqs.push(moveCase('soul_sand_no_enchant_walk', 'Walk on soul sand with no boots (baseline)', ['w'], 20, soulSandPos, ANCHOR_SOULSAND));

  // 2. Armor Fly (Elytra)
  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'elytra_equipped_walk',
    description: 'Walk on ground with elytra equipped (armor_fly flag set, not gliding)',
    startPos: flat,
    sceneAnchor: ANCHOR_FLAT,
    setupDescription: 'equip elytra in chest slot',
    setup: (b) => b.command('replaceitem entity ${PLAYER} slot.armor.chest 0 elytra'),
    run: (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w').waitUntilStable().waitFor('player_auth_input', 1),
  }).build());

  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'elytra_glide_h200',
    description: 'Glide from y=200 (elytra deploys passively at angle)',
    startPos: highPos,
    pitch: -10,
    sceneAnchor: ANCHOR_FLAT,
    setupDescription: 'equip elytra',
    setup: (b) => b.command('replaceitem entity ${PLAYER} slot.armor.chest 0 elytra'),
    run: (b) => b.waitFor('player_auth_input', 55),
  }).build());

  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'elytra_glide_forward_h200',
    description: 'Glide from y=200 with forward input',
    startPos: highPos,
    pitch: -15,
    sceneAnchor: ANCHOR_FLAT,
    setupDescription: 'equip elytra',
    setup: (b) => b.command('replaceitem entity ${PLAYER} slot.armor.chest 0 elytra'),
    run: (b) =>
      b.waitFor('player_auth_input', 15)
        .keyDown('w').waitFor('player_auth_input', 40).keyUp('w')
        .waitFor('player_auth_input', 10),
  }).build());

  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'elytra_firework_boost',
    description: 'Glide with firework boost',
    startPos: highPos,
    pitch: -10,
    sceneAnchor: ANCHOR_FLAT,
    setupDescription: 'equip elytra + 64 fireworks',
    setup: (b) =>
      b.command('replaceitem entity ${PLAYER} slot.armor.chest 0 elytra')
       .command('replaceitem entity ${PLAYER} slot.hotbar 0 firework_rocket 64'),
    run: (b) =>
      b.waitFor('player_auth_input', 15)
        .mouseClick('right')
        .waitFor('player_auth_input', 50),
  }).build());

  // No elytra walk (baseline)
  seqs.push(moveCase('no_elytra_walk', 'Walk on ground with no elytra (baseline)', ['w'], 15, flat, ANCHOR_FLAT));

  // 3. Freeze Immune (leather armor on powder snow)
  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'freeze_immune_leather_walk',
    description: 'Walk into powder snow with full leather armor (freeze_immune flag set)',
    startPos: snowApproach,
    sceneAnchor: ANCHOR_SNOW,
    setupDescription: 'equip full leather armor',
    setup: (b) =>
      b.command('replaceitem entity ${PLAYER} slot.armor.head 0 leather_helmet')
       .command('replaceitem entity ${PLAYER} slot.armor.chest 0 leather_chestplate')
       .command('replaceitem entity ${PLAYER} slot.armor.legs 0 leather_leggings')
       .command('replaceitem entity ${PLAYER} slot.armor.feet 0 leather_boots'),
    run: (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w').waitFor('player_auth_input', 20),
  }).build());

  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'freeze_immune_leather_stand',
    description: 'Stand on powder snow with leather boots (does not sink)',
    startPos: snowCenter,
    sceneAnchor: ANCHOR_SNOW,
    setupDescription: 'equip full leather armor',
    setup: (b) =>
      b.command('replaceitem entity ${PLAYER} slot.armor.head 0 leather_helmet')
       .command('replaceitem entity ${PLAYER} slot.armor.chest 0 leather_chestplate')
       .command('replaceitem entity ${PLAYER} slot.armor.legs 0 leather_leggings')
       .command('replaceitem entity ${PLAYER} slot.armor.feet 0 leather_boots'),
    run: (b) => b.waitFor('player_auth_input', 40),
  }).build());

  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'no_leather_powder_snow',
    description: 'Walk into powder snow with no armor (sinks into snow)',
    startPos: snowApproach,
    sceneAnchor: ANCHOR_SNOW,
    run: (b) => b.keyDown('w').waitFor('player_auth_input', 40).keyUp('w').waitFor('player_auth_input', 20),
  }).build());

  // 4. Item Use slowdown
  seqs.push(withHotbarItem('item_use_bow_walk', 'Draw bow while walking (item_use_slowdown flag)',
    'bow 1',
    (b) => b.keyDown('w').waitFor('player_auth_input', 5).mouseClick('right').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 10),
    flat,
  ));
  seqs.push(withHotbarItem('item_use_shield_walk', 'Raise shield while walking',
    'shield 1',
    (b) => b.keyDown('w').waitFor('player_auth_input', 5).mouseClick('right').waitFor('player_auth_input', 30).keyUp('w').waitFor('player_auth_input', 10),
    flat,
  ));

  // Eating while walking
  seqs.push(new SimulationBuilder().sceneTestCase({
    name: 'item_use_eat_walk',
    description: 'Eat cooked beef while walking (hunger effect makes player hungry first)',
    startPos: flat,
    sceneAnchor: ANCHOR_FLAT,
    setupDescription: 'apply hunger 255; give 64 cooked_beef in hotbar 0',
    setup: (b) =>
      b.command('effect ${PLAYER} hunger 30 255 true')
       .command('replaceitem entity ${PLAYER} slot.hotbar 0 cooked_beef 64'),
    run: (b) =>
      b.keyDown('w').waitFor('player_auth_input', 5)
        .mouseClick('right').waitFor('player_auth_input', 40)
        .keyUp('w').waitFor('player_auth_input', 10),
  }).build());

  // Baseline: no item
  seqs.push(moveCase('no_item_use_walk', 'Walk with no item in use (baseline)', ['w'], 20, flat, ANCHOR_FLAT));

  // Sprint with bow draw (sprint cancels when item use starts)
  seqs.push(withHotbarItem('item_use_bow_sprint', 'Draw bow while sprinting (sprint cancels)',
    'bow 1',
    (b) => b.keyDown('ctrl', 'w').waitFor('player_auth_input', 5).mouseClick('right').waitFor('player_auth_input', 30).keyUp('ctrl', 'w').waitFor('player_auth_input', 10),
    flat,
  ));

  return {
    name: 'v2_v11_coverage',
    description: 'v11 ECS flags: Soul Speed, Armor Fly (elytra), Freeze Immune (leather), Item Use slowdown',
    sequences: seqs,
  };
}

registerFixture(buildV11CoverageFixture());
