import { system, world, ItemStack, EquipmentSlot, EnchantmentType } from "@minecraft/server";

/**
 * Get a player by name, or return the first player if no name is provided.
 * @param {string} name
 * @returns {import("@minecraft/server").Player | undefined}
 */
function getPlayer(name) {
    const players = world.getAllPlayers();
    if (!name || name.trim() === "") return players[0];
    return players.find((p) => p.name === name) || players[0];
}

/**
 * Handle test:ping — verify the behavior pack is loaded.
 */
function handlePing() {
    console.warn("[TEST_PONG]");
}

/**
 * Handle test:inventory — return player inventory as JSON.
 * @param {string} message — player name
 */
function handleInventory(message) {
    const player = getPlayer(message);
    if (!player) {
        console.warn('[TEST_INVENTORY]{"error":"no player found"}');
        return;
    }

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) {
        console.warn('[TEST_INVENTORY]{"error":"no inventory component"}');
        return;
    }

    const items = [];
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) {
            items.push({
                slot: i,
                name: item.typeId.replace("minecraft:", ""),
                count: item.amount,
            });
        }
    }

    console.warn("[TEST_INVENTORY]" + JSON.stringify(items));
}

/**
 * Handle test:block_inventory — return block container inventory as JSON.
 * @param {string} message — "x y z"
 */
function handleBlockInventory(message) {
    const parts = message.trim().split(/\s+/);
    if (parts.length < 3) {
        console.warn('[TEST_BLOCK_INVENTORY]{"error":"expected x y z"}');
        return;
    }

    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const z = parseInt(parts[2], 10);

    const dimension = world.getDimension("overworld");
    const block = dimension.getBlock({ x, y, z });
    if (!block) {
        console.warn('[TEST_BLOCK_INVENTORY]{"error":"no block at position"}');
        return;
    }

    const container = block.getComponent("inventory")?.container;
    if (!container) {
        console.warn('[TEST_BLOCK_INVENTORY]{"error":"no inventory component on block"}');
        return;
    }

    const items = [];
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) {
            items.push({
                slot: i,
                name: item.typeId.replace("minecraft:", ""),
                count: item.amount,
            });
        }
    }

    console.warn("[TEST_BLOCK_INVENTORY]" + JSON.stringify({ position: { x, y, z }, items }));
}

/**
 * Handle test:give_enchanted — give an enchanted item to a player.
 * @param {string} message — "PlayerName itemId enchant1:level,enchant2:level"
 */
function handleGiveEnchanted(message) {
    const parts = message.trim().split(/\s+/);
    if (parts.length < 3) {
        console.warn('[TEST_GIVE_ENCHANTED]{"error":"expected PlayerName itemId enchantments"}');
        return;
    }

    const playerName = parts[0];
    const itemId = parts[1].startsWith("minecraft:") ? parts[1] : "minecraft:" + parts[1];
    const enchantStr = parts[2];

    const player = getPlayer(playerName);
    if (!player) {
        console.warn('[TEST_GIVE_ENCHANTED]{"error":"no player found"}');
        return;
    }

    const itemStack = new ItemStack(itemId, 1);

    const enchantable = itemStack.getComponent("minecraft:enchantable");
    if (!enchantable) {
        console.warn('[TEST_GIVE_ENCHANTED]{"error":"item is not enchantable"}');
        return;
    }

    const enchantments = enchantStr.split(",").map((e) => {
        const [type, level] = e.split(":");
        return { type, level: parseInt(level, 10) };
    });

    for (const ench of enchantments) {
        enchantable.addEnchantment({ type: new EnchantmentType(ench.type), level: ench.level });
    }

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) {
        console.warn('[TEST_GIVE_ENCHANTED]{"error":"no inventory component"}');
        return;
    }

    container.addItem(itemStack);
    console.warn("[TEST_GIVE_ENCHANTED]" + JSON.stringify({
        item: itemId.replace("minecraft:", ""),
        enchantments: enchantments,
    }));
}

/**
 * Handle test:equip_enchanted — equip an enchanted item directly to an armor slot.
 * @param {string} message — "EquipSlot itemId enchant1:level[,enchant2:level]"
 * @param {import("@minecraft/server").Entity | undefined} sourceEntity — the player (for Entity source)
 */
function handleEquipEnchanted(message, sourceEntity) {
    const parts = message.trim().split(/\s+/);
    if (parts.length < 3) {
        console.warn('[TEST_EQUIP_ENCHANTED]{"error":"expected EquipSlot itemId enchantments"}');
        return;
    }

    const slotName = parts[0];
    const itemId = parts[1].startsWith("minecraft:") ? parts[1] : "minecraft:" + parts[1];
    const enchantStr = parts[2];

    const slotMap = {
        Head: EquipmentSlot.Head,
        Chest: EquipmentSlot.Chest,
        Legs: EquipmentSlot.Legs,
        Feet: EquipmentSlot.Feet,
        Mainhand: EquipmentSlot.Mainhand,
        Offhand: EquipmentSlot.Offhand,
    };

    const slot = slotMap[slotName];
    if (!slot) {
        console.warn('[TEST_EQUIP_ENCHANTED]{"error":"unknown slot: ' + slotName + ', expected Head/Chest/Legs/Feet/Mainhand/Offhand"}');
        return;
    }

    const player = sourceEntity || getPlayer("");
    if (!player) {
        console.warn('[TEST_EQUIP_ENCHANTED]{"error":"no player found"}');
        return;
    }

    const itemStack = new ItemStack(itemId, 1);

    const enchantable = itemStack.getComponent("minecraft:enchantable");
    if (!enchantable) {
        console.warn('[TEST_EQUIP_ENCHANTED]{"error":"item is not enchantable"}');
        return;
    }

    const enchantments = enchantStr.split(",").map((e) => {
        const [type, level] = e.split(":");
        return { type, level: parseInt(level, 10) };
    });

    for (const ench of enchantments) {
        enchantable.addEnchantment({ type: new EnchantmentType(ench.type), level: ench.level });
    }

    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) {
        console.warn('[TEST_EQUIP_ENCHANTED]{"error":"no equippable component"}');
        return;
    }

    equippable.setEquipment(slot, itemStack);
    console.warn("[TEST_EQUIP_ENCHANTED]" + JSON.stringify({
        slot: slotName,
        item: itemId.replace("minecraft:", ""),
        enchantments: enchantments,
    }));
}

/**
 * Handle test:spawn_villager — spawn a villager with a specific profession.
 * @param {string} message — "x y z profession"
 */
function handleSpawnVillager(message) {
    const parts = message.trim().split(/\s+/);
    if (parts.length < 4) {
        console.warn('[TEST_SPAWN_VILLAGER]{"error":"expected x y z profession"}');
        return;
    }

    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const z = parseInt(parts[2], 10);
    const profession = parts[3];

    const dimension = world.getDimension("overworld");
    const entity = dimension.spawnEntity("minecraft:villager_v2", { x, y, z });
    entity.triggerEvent("minecraft:become_" + profession);

    console.warn("[TEST_SPAWN_VILLAGER]" + JSON.stringify({
        profession,
        position: { x, y, z },
        entityId: entity.id,
    }));
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.sourceType !== "Server" && event.sourceType !== "Entity") return;

    switch (event.id) {
        case "test:ping":
            handlePing();
            break;
        case "test:inventory":
            handleInventory(event.message);
            break;
        case "test:block_inventory":
            handleBlockInventory(event.message);
            break;
        case "test:give_enchanted":
            handleGiveEnchanted(event.message);
            break;
        case "test:equip_enchanted":
            handleEquipEnchanted(event.message, event.sourceEntity);
            break;
        case "test:spawn_villager":
            handleSpawnVillager(event.message);
            break;
    }
});
