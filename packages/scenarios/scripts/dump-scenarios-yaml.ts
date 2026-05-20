// Dumps one YAML file per testCase in a registered fixture.
//
// Each YAML captures the scenario's SimulationAction stream in a
// human-readable form, sibling to the .test.js fixtures emitted by
// extract-physics-fixtures.ts. The recorded .test.js is the OUTPUT (what
// happened); the YAML is the INPUT (what we asked the client to do).
//
// Usage:
//   tsx scripts/dump-scenarios-yaml.ts --fixture <name> --out <dir>
//
// Example:
//   tsx scripts/dump-scenarios-yaml.ts \
//       --fixture v2_all \
//       --out <consumer-repo>/tests/unit/bedrock/scenarios

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SimulationAction, TestCaseOptions, Vec3, WorldScene } from '@bdt/core';
import { getFixture } from '../src/fixtures/registry.js';
import '../src/fixtures/index.js';

function stripPrefix(name: string): string {
  return name.replace(/^[0-9._]+_/, '').replace(/^pb_/, '');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function isPreloadCase(opts?: TestCaseOptions): boolean {
  if (!opts) return false;
  if (opts.preload === true) return true;
  const meta = opts.meta ?? {};
  if ((meta as Record<string, unknown>).isPreload === true) return true;
  if ((meta as Record<string, unknown>).kind === 'preload') return true;
  return false;
}

// ── tiny YAML emitter (flow-style for actions, block-style for top level) ──

function yQuote(s: string): string {
  // double-quote and escape \ " and control chars
  return '"' + s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    + '"';
}

function yScalar(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return yQuote(String(v));
    return String(v);
  }
  if (typeof v === 'string') {
    // bare-emit identifiers + simple snake-case strings; quote anything else
    if (/^[A-Za-z_][A-Za-z0-9_./-]*$/.test(v) && !['true', 'false', 'null', 'yes', 'no'].includes(v)) {
      return v;
    }
    return yQuote(v);
  }
  // fall back to JSON for arrays/objects (still valid YAML flow)
  return JSON.stringify(v);
}

function yFlow(obj: Record<string, unknown>, keyOrder?: string[]): string {
  const keys = keyOrder ?? Object.keys(obj);
  const parts: string[] = [];
  for (const k of keys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      parts.push(`${k}: [${v.map((x) => yScalar(x)).join(', ')}]`);
    } else if (v && typeof v === 'object') {
      parts.push(`${k}: ${yFlow(v as Record<string, unknown>)}`);
    } else {
      parts.push(`${k}: ${yScalar(v)}`);
    }
  }
  return '{ ' + parts.join(', ') + ' }';
}

function actionToYamlFlow(a: SimulationAction): string {
  // waitUntil's predicate is a closure (non-serializable). Named helpers
  // (`waitUntilStable`, `waitUntilStopped`, `waitUntilTeleportHandled`)
  // tag the action with `kind` + `args` so we can emit a human-readable
  // form; raw `.waitUntil(predicate)` calls fall back to `<closure>`.
  if (a.type === 'waitUntil') {
    const flat: Record<string, unknown> = { type: a.type };
    if (a.onTimeout) flat.onTimeout = a.onTimeout;
    if (a.kind) {
      flat.kind = a.kind;
      if (a.args && Object.keys(a.args).length > 0) flat.args = a.args;
    } else {
      flat.predicate = '<closure>';
    }
    return yFlow(flat, ['type', 'onTimeout', 'kind', 'args', 'predicate']);
  }
  const flat: Record<string, unknown> = { ...a };
  return yFlow(flat);
}

function block(label: string, body: string, indent = ''): string {
  return `${indent}${label}:\n${body}`;
}

// ── segment fixture actions into (preamble?, testCase) windows ──

interface PreambleBlock {
  name: string;
  actions: SimulationAction[];
}

interface ScenarioWindow {
  name: string;
  options?: TestCaseOptions;
  preambles: PreambleBlock[];         // every preamble since the previous testCaseEnd
  actions: SimulationAction[];        // between testCaseStart and testCaseEnd
}

function segmentSequence(actions: readonly SimulationAction[]): ScenarioWindow[] {
  const out: ScenarioWindow[] = [];
  let pendingPreambles: PreambleBlock[] = [];
  let currentPreambleOpen: PreambleBlock | null = null;
  let currentCase: ScenarioWindow | null = null;
  for (const a of actions) {
    if (a.type === 'preambleStart') {
      currentPreambleOpen = { name: a.name, actions: [] };
      continue;
    }
    if (a.type === 'preambleEnd' && currentPreambleOpen) {
      pendingPreambles.push(currentPreambleOpen);
      currentPreambleOpen = null;
      continue;
    }
    if (a.type === 'testCaseStart') {
      currentCase = {
        name: a.name,
        options: a.options,
        preambles: pendingPreambles,
        actions: [],
      };
      pendingPreambles = [];
      continue;
    }
    if (a.type === 'testCaseEnd' && currentCase) {
      out.push(currentCase);
      currentCase = null;
      continue;
    }
    if (currentPreambleOpen) {
      currentPreambleOpen.actions.push(a);
    } else if (currentCase) {
      currentCase.actions.push(a);
    }
    // actions outside any window are dropped (warm-up / inter-case gaps)
  }
  return out;
}

// ── metadata extraction from setup commands ──
//
// Setup runs raw slash commands (gamemode / effect / replaceitem / scriptevent).
// Replayer harnesses don't parse command strings; they want semantic flags:
// "gamemode is creative", "active effects are X+Y", "feet armor is leather".
// We scan all preamble actions for known patterns and lift them into `meta:`.
// The original commands stay in their preamble for live-BDS replay fidelity.

interface ScenarioMeta {
  gamemode?: string;
  effects?: Record<string, { amplifier: number; duration: number }>;
  equipment?: Record<string, EquipSlot>;
}

interface EquipSlot {
  item: string;
  count?: number;
  enchants?: Record<string, number>;
}

const SLOT_ALIAS: Record<string, string> = {
  'armor.chest':  'chest',
  'armor.feet':   'feet',
  'armor.head':   'head',
  'armor.legs':   'legs',
  'weapon.offhand': 'offhand',
  'hotbar':       'hotbar',
};

const SCRIPTEVENT_SLOT_ALIAS: Record<string, string> = {
  'Feet':  'feet',
  'Chest': 'chest',
  'Head':  'head',
  'Legs':  'legs',
};

function parseSetupMeta(preambles: PreambleBlock[], actions: readonly SimulationAction[]): ScenarioMeta {
  const meta: ScenarioMeta = {};
  const commands: string[] = [];
  for (const p of preambles) {
    for (const a of p.actions) {
      if (a.type === 'command') commands.push(a.command);
    }
  }
  // Also scan the recorded actions — some scenarios switch gamemode or apply
  // an effect as the first action (creative_fly_*, mid-scenario effect apply).
  // From the harness's POV these define the scenario's initial mode just as
  // much as a preamble command would.
  for (const a of actions) {
    if (a.type === 'command') commands.push(a.command);
  }
  for (const raw of commands) {
    // Strip an optional leading "/" and the `${PLAYER}` token so the
    // remaining shape is `<verb> <args…>` regardless of how it was authored.
    const cmd = raw.replace(/^\//, '').trim();
    const tokens = cmd.split(/\s+/);

    // gamemode <mode> ${PLAYER}
    if (tokens[0] === 'gamemode' && tokens[1]) {
      meta.gamemode = tokens[1];
      continue;
    }
    // effect ${PLAYER} clear   →  drop every effect
    // effect ${PLAYER} <name>  →  remove that one (we omit; rare)
    // effect ${PLAYER} <name> <dur> <amp> [true]
    if (tokens[0] === 'effect' && tokens[1] === '${PLAYER}') {
      if (tokens[2] === 'clear') { delete meta.effects; continue; }
      if (tokens.length >= 5) {
        const name = tokens[2];
        const duration = parseInt(tokens[3] ?? '0', 10);
        const amplifier = parseInt(tokens[4] ?? '0', 10);
        // The recorder applies `resistance 9999 255 true` to every scenario
        // as a fall-safety helper (giveResistance default on sceneTestCase).
        // It's not test intent — skip it. Any other resistance is real.
        if (name === 'resistance' && amplifier === 255 && duration === 9999) continue;
        if (Number.isFinite(duration) && Number.isFinite(amplifier)) {
          (meta.effects ??= {})[name] = { amplifier, duration };
        }
      }
      continue;
    }
    // replaceitem entity ${PLAYER} slot.<slot> <slotnum> <item> [count] [data] [nbt…]
    if (tokens[0] === 'replaceitem' && tokens[1] === 'entity' && tokens[2] === '${PLAYER}') {
      const slotRaw = (tokens[3] ?? '').replace(/^slot\./, '');
      const slot = SLOT_ALIAS[slotRaw] ?? slotRaw;
      const item = tokens[5];
      if (!item) continue;
      const slotEntry: EquipSlot = { item };
      const countNum = parseInt(tokens[6] ?? '', 10);
      if (Number.isFinite(countNum) && countNum > 1) slotEntry.count = countNum;
      // Anything after token[6] may be an NBT blob containing enchants.
      const nbtStart = cmd.indexOf('{');
      if (nbtStart >= 0) {
        const nbt = cmd.slice(nbtStart);
        const enchMatch = nbt.matchAll(/"([a-z_]+)":\s*(\d+)/g);
        for (const m of enchMatch) {
          // Skip the {"slot":"armor_feet"} kind of structural keys.
          if (m[1] === 'slot' || m[1] === 'value') continue;
          (slotEntry.enchants ??= {})[m[1]] = parseInt(m[2], 10);
        }
      }
      (meta.equipment ??= {})[slot] = slotEntry;
      continue;
    }
    // scriptevent test:equip_enchanted <Slot> <item> <enchant:level>[ <enchant:level>…]
    if (tokens[0] === 'scriptevent' && tokens[1] === 'test:equip_enchanted') {
      const slot = SCRIPTEVENT_SLOT_ALIAS[tokens[2] ?? ''] ?? tokens[2]?.toLowerCase();
      const item = tokens[3];
      if (!slot || !item) continue;
      const slotEntry: EquipSlot = { item };
      for (let i = 4; i < tokens.length; i++) {
        const m = /^([a-z_]+):(\d+)$/.exec(tokens[i]);
        if (m) (slotEntry.enchants ??= {})[m[1]] = parseInt(m[2], 10);
      }
      (meta.equipment ??= {})[slot] = slotEntry;
      continue;
    }
    // clear ${PLAYER}  →  no-op for metadata (default empty inventory)
  }
  return meta;
}

function metaIsEmpty(m: ScenarioMeta): boolean {
  return (
    !m.gamemode &&
    (!m.effects || Object.keys(m.effects).length === 0) &&
    (!m.equipment || Object.keys(m.equipment).length === 0)
  );
}

// Collapse adjacent `wait { event: 'player_auth_input', count: N }` actions
// at the end of the actions[] list — the recorder appends `postActionTicks`
// after the scenario's own trailing wait, which produces two adjacent waits.
// Merging only at the tail keeps in-scenario pauses (which carry timing
// intent) untouched.
function mergeTrailingWaits(actions: SimulationAction[]): SimulationAction[] {
  if (actions.length < 2) return actions;
  const out = actions.slice();
  while (out.length >= 2) {
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    if (
      last.type === 'wait' && last.event === 'player_auth_input' &&
      prev.type === 'wait' && prev.event === 'player_auth_input'
    ) {
      out[out.length - 2] = { type: 'wait', event: 'player_auth_input', count: prev.count + last.count };
      out.pop();
    } else {
      break;
    }
  }
  return out;
}

// ── emit ──

function emitYaml(scenario: ScenarioWindow): string {
  const cleanName = stripPrefix(scenario.name);
  const lines: string[] = [];
  lines.push(`scenario: ${yScalar(cleanName)}`);
  lines.push(`originalName: ${yScalar(scenario.name)}`);
  if (scenario.options?.description) {
    lines.push(`description: ${yScalar(scenario.options.description)}`);
  }
  const scene: WorldScene | undefined = scenario.options?.scene;
  if (scene) {
    lines.push(`scene: ${yFlow(scene as unknown as Record<string, unknown>)}`);
  }
  const startPos: Vec3 | undefined = scenario.options?.startPos;
  if (startPos) {
    lines.push(`startPos: ${yFlow(startPos as unknown as Record<string, unknown>, ['x', 'y', 'z'])}`);
  }
  if (scenario.options?.preload) lines.push(`preload: true`);

  const meta = parseSetupMeta(scenario.preambles, scenario.actions);
  if (!metaIsEmpty(meta)) {
    lines.push('meta:');
    if (meta.gamemode) lines.push(`  gamemode: ${yScalar(meta.gamemode)}`);
    if (meta.effects && Object.keys(meta.effects).length > 0) {
      lines.push('  effects:');
      for (const [name, e] of Object.entries(meta.effects)) {
        lines.push(`    ${yScalar(name)}: ${yFlow(e as unknown as Record<string, unknown>, ['amplifier', 'duration'])}`);
      }
    }
    if (meta.equipment && Object.keys(meta.equipment).length > 0) {
      lines.push('  equipment:');
      for (const [slot, e] of Object.entries(meta.equipment)) {
        lines.push(`    ${yScalar(slot)}: ${yFlow(e as unknown as Record<string, unknown>, ['item', 'count', 'enchants'])}`);
      }
    }
  }

  for (const p of scenario.preambles) {
    lines.push(`${yScalar(p.name)}:`);
    if (p.actions.length === 0) {
      lines.push('  []');
    } else {
      for (const a of p.actions) lines.push(`  - ${actionToYamlFlow(a)}`);
    }
  }
  lines.push('actions:');
  const mergedActions = mergeTrailingWaits(scenario.actions);
  if (mergedActions.length === 0) {
    lines.push('  []');
  } else {
    for (const a of mergedActions) lines.push(`  - ${actionToYamlFlow(a)}`);
  }
  return lines.join('\n') + '\n';
}

// ── CLI ──

const rawArgs = process.argv.slice(2);
let fixtureName: string | undefined;
let outDir: string | undefined;
let includePreload = false;
let patchTestJs = true; // default ON — patch sibling .test.js with the same meta
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--fixture') { fixtureName = rawArgs[++i]; continue; }
  if (a === '--out') { outDir = rawArgs[++i]; continue; }
  if (a === '--include-preload') { includePreload = true; continue; }
  if (a === '--no-patch-test-js') { patchTestJs = false; continue; }
  console.error(`unknown arg: ${a}`);
  process.exit(2);
}
if (!fixtureName || !outDir) {
  console.error('usage: dump-scenarios-yaml --fixture <name> --out <dir> [--include-preload] [--no-patch-test-js]');
  process.exit(2);
}

/**
 * Splice `meta: { ... }` into the .test.js's `makeHarness({...})` call so
 * the harness can drive gliding/effects/armor/soulSpeed from scenario data
 * instead of regex-matching the scenario name. Safe-no-op if the file
 * doesn't exist (synthetic scenarios) or already has a `meta:` property
 * (we overwrite it to keep things in sync with the YAML).
 */
function metaToJsLiteral(m: ScenarioMeta): string {
  // Build a JS object literal (single-line) — JSON.stringify gives valid JS too.
  return JSON.stringify(m);
}

function patchTestJsMeta(testJsPath: string, meta: ScenarioMeta): boolean {
  if (!fs.existsSync(testJsPath)) return false;
  const src = fs.readFileSync(testJsPath, 'utf8');
  const literal = metaToJsLiteral(meta);
  // Strip any existing `, meta: {...}` first so re-running doesn't accumulate.
  let next = src.replace(/,\s*meta:\s*\{[\s\S]*?\}(?=\s*\}\s*\))/g, '');
  // Insert before the closing `})` of the makeHarness call. The current
  // template is single-line: `makeHarness({ version: "…", scenario: '…', softFailures: true })`.
  const re = /(makeHarness\(\{[^}]*?)(\s*\}\))/;
  if (!re.test(next)) return false;
  next = next.replace(re, `$1, meta: ${literal}$2`);
  if (next === src) return false;
  fs.writeFileSync(testJsPath, next);
  return true;
}

const fixture = getFixture(fixtureName);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const wrote: string[] = [];
const skipped: string[] = [];
let patched = 0;

for (const seq of fixture.sequences) {
  const windows = segmentSequence(seq.actions);
  for (const w of windows) {
    if (!includePreload && isPreloadCase(w.options)) {
      skipped.push(`${w.name} (preload)`);
      continue;
    }
    const cleanName = stripPrefix(w.name);
    const slug = sanitizeFilename(cleanName);
    const ymlPath = path.join(outDir, slug + '.yml');
    fs.writeFileSync(ymlPath, emitYaml(w));
    wrote.push(`${w.name} -> ${path.basename(ymlPath)}`);

    if (patchTestJs) {
      const meta = parseSetupMeta(w.preambles, w.actions);
      if (!metaIsEmpty(meta)) {
        const testJsPath = path.join(outDir, slug + '.test.js');
        if (patchTestJsMeta(testJsPath, meta)) patched++;
      }
    }
  }
}

console.log(`wrote ${wrote.length} YAML files to ${outDir}`);
if (patchTestJs) console.log(`patched ${patched} .test.js files with meta`);
if (skipped.length > 0) console.log(`skipped ${skipped.length} (preload windows)`);
