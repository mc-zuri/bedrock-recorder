// Fixture: Containers
// Place a row of GUI blocks, give the player items and armor, open inventory.
//
// Ported from v2 `recorder/src/fixtures2/25_container.ts`. Setup commands
// (setblock × 19, replaceitem × 4 armor, give × N inventory items) all land
// *inside* the recorded testCase window so the fixture captures the inventory
// + container interaction packets.

import { SimulationBuilder } from '../builder.js';
import type { Fixture, SimulationSequence } from '@bdt/core';
import { SCENES, sceneAnchor } from './scene_positions.js';
import { registerFixture } from './registry.js';

const S = SCENES.containers;
const ANCHOR = sceneAnchor(S);
// Containers row sits at z=2801 (one block north of scene origin)
const CONTAINER_Z = S.z + 1;

function applyContainerSetup(b: SimulationBuilder): SimulationBuilder {
  // Place 19 GUI blocks in a row
  const blocks = [
    'dispenser', 'crafting_table', 'furnace', 'blast_furnace', 'smoker',
    'anvil', 'enchanting_table', 'brewing_stand', 'grindstone', 'loom',
    'stonecutter_block', 'smithing_table', 'barrel', 'chest', 'trapped_chest',
    'ender_chest', /* skip x=17 */ 'hopper', 'dropper', 'cartography_table',
  ];
  const xPositions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20];
  for (let i = 0; i < blocks.length; i++) {
    b.command(`setblock ${xPositions[i]} 0 ${CONTAINER_Z} ${blocks[i]}`);
  }
  b.command('xp 5000L ${PLAYER}').waitFor('player_auth_input', 1);

  // Armor (full netherite)
  for (const slot of ['head', 'chest', 'legs', 'feet'] as const) {
    const piece = slot === 'head' ? 'helmet' :
                  slot === 'chest' ? 'chestplate' :
                  slot === 'legs'  ? 'leggings' : 'boots';
    b.command(`replaceitem entity \${PLAYER} slot.armor.${slot} 0 netherite_${piece}`)
     .waitFor('player_auth_input', 1);
  }

  // Soul-speed enchanted boots via scriptevent (re-equips feet)
  b.command(`scriptevent test:equip_enchanted Feet diamond_boots 'soul_speed_3_sprint_soil':3`)
   .waitFor('player_auth_input', 1);

  // Inventory items
  const items: Array<[string, number]> = [
    ['oak_wood', 64], ['emerald', 64], ['lapis_lazuli', 64], ['diamond_sword', 2],
    ['coal', 64], ['raw_copper', 64], ['raw_iron', 64], ['book', 64],
    ['cod', 64], ['salmon', 64], ['chest', 64], ['salmon', 64],
    ['fermented_spider_eye', 64], ['breeze_rod', 64], ['glass_bottle', 64],
    ['water_bucket', 2], ['filled_map', 1], ['empty_map', 1], ['paper', 1],
  ];
  for (const [item, count] of items) {
    b.command(`give \${PLAYER} ${item} ${count}`).waitFor('player_auth_input', 1);
  }
  return b;
}

function buildContainerSeq(): SimulationSequence {
  return new SimulationBuilder()
    .sceneTestCase({
      name: 'containers_open_inventory',
      description: 'Place 19 GUI blocks, give full netherite armor + diverse inventory, then open the inventory screen',
      setupDescription: 'place 19 GUI blocks; equip full netherite armor + soul_speed III boots; give 19 stackable items + diamond_sword',
      startPos: { x: S.x, y: 0, z: S.z },
      yaw: 0,
      sceneAnchor: ANCHOR,
      setup: applyContainerSetup,
      setupSettleTicks: 8,  // 19 setblock + 19 give + 4 armor packets need time to flow
      run: (b) => {
        b.keyDown('e')
          .waitFor('player_auth_input', 1)
          .keyUp('e');
        // Want ~24s of inventory-open observation — but each waitFor has a
        // 15s safety timeout. At ~20 PAI/s, one chunk of 200 ticks = ~10s,
        // well inside the per-wait timeout. Three chunks ≈ ~30s total.
        b.waitFor('player_auth_input', 200);
        b.waitFor('player_auth_input', 200);
        b.waitFor('player_auth_input', 80);
        return b;
      },
    })
    .build();
}

function buildContainersFixture(): Fixture {
  return {
    name: 'v2_containers',
    description: 'Place GUI blocks, equip full kit, open inventory — captures container/transaction packets',
    sequences: [buildContainerSeq()],
  };
}

registerFixture(buildContainersFixture());
