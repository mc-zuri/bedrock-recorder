import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { findAndLoadConfig } from '@bdt/bds-adapter';

export async function configCommand(action: string): Promise<void> {
  if (action === 'show') {
    const { config, configPath } = await findAndLoadConfig();
    console.log(`# loaded from ${configPath}`);
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  if (action === 'init') {
    const target = path.join(process.cwd(), 'bdt.config.json');
    try {
      await fs.access(target);
      console.error(`Refusing to overwrite existing ${target}. Edit it manually.`);
      process.exitCode = 1;
      return;
    } catch {
      // file does not exist — proceed
    }
    // The example config sits at the monorepo root. Walk up from cwd looking for it.
    const example = await findExample(process.cwd());
    if (!example) {
      console.error(
        'Could not find bdt.config.example.json to copy. ' +
          'Are you inside a bedrock-tools-v5 checkout?',
      );
      process.exitCode = 1;
      return;
    }
    await fs.copyFile(example, target);
    console.log(`wrote ${target} (copied from ${example})`);
    return;
  }
  throw new Error(`Unknown config action '${action}'. Use 'show' or 'init'.`);
}

async function findExample(startDir: string): Promise<string | null> {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (true) {
    const candidate = path.join(dir, 'bdt.config.example.json');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}
