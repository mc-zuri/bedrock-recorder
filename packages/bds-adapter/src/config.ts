import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

/**
 * Replaces v2's hardcoded `configs` object at `recorder/src/main.ts:115-152`.
 * Adding a new client version is now a JSON edit.
 */

export const versionConfigSchema = z.object({
  protocolVersion: z.string(),
  bdsVersion: z.string(),
  worldName: z.string(),
  templateWorldPath: z.string(),
  scenesWorldPath: z.string(),
});

export const bdtConfigSchema = z.object({
  defaultVersion: z.string(),
  versions: z.record(versionConfigSchema),
  dumpDir: z.string(),
  relay: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().positive().default(19150),
    username: z.string(),
    profilesFolder: z.string(),
  }),
  bdsPaths: z.object({
    base: z.string(),
  }),
});

export type VersionConfig = z.infer<typeof versionConfigSchema>;
export type BdtConfig = z.infer<typeof bdtConfigSchema>;

/**
 * Walk up from `startDir` to the filesystem root looking for the first
 * `bdt.config.json`. Returns the parsed config and where it was found.
 */
export async function findAndLoadConfig(startDir: string = process.cwd()): Promise<{
  config: BdtConfig;
  configPath: string;
}> {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (true) {
    const candidate = path.join(dir, 'bdt.config.json');
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      return { config: bdtConfigSchema.parse(JSON.parse(raw)), configPath: candidate };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    if (dir === root) {
      throw new Error(
        `Could not find bdt.config.json walking up from ${startDir}. ` +
          `Run 'bdt config init' to write a starter file, or copy bdt.config.example.json.`,
      );
    }
    dir = path.dirname(dir);
  }
}

/** Parse a config object without filesystem IO. Throws on validation errors. */
export function parseConfig(input: unknown): BdtConfig {
  return bdtConfigSchema.parse(input);
}

export function resolveVersionConfig(config: BdtConfig, version?: string): { version: string; cfg: VersionConfig } {
  const v = version ?? config.defaultVersion;
  const cfg = config.versions[v];
  if (!cfg) {
    throw new Error(
      `No version config for '${v}'. Configured versions: ${Object.keys(config.versions).join(', ')}`,
    );
  }
  return { version: v, cfg };
}
