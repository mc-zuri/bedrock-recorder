#!/usr/bin/env node
import { Command } from 'commander';
import { recordCommand } from './commands/record.js';
import { listFixturesCommand, listOverlaysCommand } from './commands/list.js';
import { configCommand } from './commands/config.js';
import { snapshotWorldCommand } from './commands/snapshot-world.js';

const program = new Command();
program
  .name('bdt')
  .description('bedrock-tools-v5 — Minecraft Bedrock client automation + recorder')
  .version('0.1.0');

program
  .command('record')
  .description('Run a fixture (or overlay sweep) and write a .proxy.bin')
  .option('-f, --fixture <name...>', 'fixture name(s) to record (from the registry)')
  .option('-o, --overlay <path...>', 'overlay JSON file(s) to expand and record')
  .option('--client <ver>', 'client version (must be in bdt.config.json#versions)')
  .option('--out <dir>', 'output directory for .proxy.bin (overrides config.dumpDir)')
  .option('--config <path>', 'explicit bdt.config.json path (default: walk up from cwd)')
  .option('--no-bds-autodownload', 'skip BDS auto-download (assume installed)')
  .option('--keep-server', 'leave BDS running after recording completes')
  .option('--legacy', 'omit the BDT5 header (byte-compat with v2 extract-physics-fixtures.ts)')
  .action(recordCommand);

program
  .command('list-fixtures')
  .description('Print the names of all registered fixtures')
  .option('-f, --filter <substring>', 'only show names containing this substring')
  .action(listFixturesCommand);

program
  .command('list-overlays')
  .description('Discover *.overlay.json files in the scenarios package')
  .option('-d, --dir <path>', 'directory to scan (default: packages/scenarios/src/overlays)')
  .option('-f, --filter <substring>', 'only show overlays whose name contains this substring')
  .action(listOverlaysCommand);

program
  .command('config')
  .description('Inspect / scaffold bdt.config.json')
  .argument('<action>', 'show | init')
  .action(configCommand);

program
  .command('snapshot-world')
  .description('Copy the BDS world dir to a reusable template (used as the starting state for future recordings)')
  .option('--client <ver>', 'client version (defaults to config.defaultVersion)')
  .option('--from <path>', 'source dir (defaults to BDS’s world dir derived from config)')
  .option('--out <path>', 'destination template (defaults to versionConfig.templateWorldPath)')
  .option('--force', 'overwrite the destination if it already exists')
  .option('--config <path>', 'explicit bdt.config.json path (default: walk up from cwd)')
  .action(snapshotWorldCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  const e = err as Error;
  console.error(`\nError: ${e.message}`);
  if (process.env.BDT_DEBUG) console.error(e.stack);
  process.exitCode = 1;
});
