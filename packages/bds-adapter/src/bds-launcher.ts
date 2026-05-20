import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
// minecraft-bedrock-server ships no types; we use a few methods at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const bedrockServer: any = require('minecraft-bedrock-server');
import type { BdtConfig, VersionConfig } from './config.js';

const isWindows = os.platform() === 'win32';
const serverExe = isWindows ? 'bedrock_server.exe' : 'bedrock_server';

export interface BdsHandle {
  host: string;
  port: number;
  version: string;
  stop(): Promise<void>;
  sendCommand(command: string): Promise<void>;
  waitForOutput(pattern: RegExp, timeoutMs?: number): Promise<string>;
}

export interface BdsLaunchOptions {
  config: BdtConfig;
  versionConfig: VersionConfig;
  /** Override the BDS listen port. Default 19190. */
  port?: number;
  /** When false, skip the auto-download even if BDS is missing. Default true. */
  autoDownload?: boolean;
  /** Override the world template path for this run. Falls back to versionConfig.templateWorldPath. */
  templateWorldPath?: string;
  /**
   * Directory containing bundled behavior-pack subdirectories. Each
   * `<dir>/<pack>/` is copied to BDS's `development_behavior_packs/<pack>/`
   * before launch. BDS auto-loads anything in that folder.
   */
  behaviorPacksDir?: string;
  /** Timeout for "server started" detection. Default 60s. */
  startupTimeoutMs?: number;
}

/**
 * Launch vanilla Bedrock Dedicated Server. Auto-downloads via
 * `minecraft-bedrock-server` on first run; subsequent runs reuse the install
 * at `<bdsPaths.base>/bds-${bdsVersion}`. World template (if set on
 * versionConfig) is copied into `worlds/<worldName>/` before launch.
 */
export async function launchBds(opts: BdsLaunchOptions): Promise<BdsHandle> {
  const { config, versionConfig } = opts;
  const port = opts.port ?? 19190;
  const autoDownload = opts.autoDownload ?? true;
  const startupTimeoutMs = opts.startupTimeoutMs ?? 60_000;

  const bdsPath = path.join(config.bdsPaths.base, `bds-${versionConfig.bdsVersion}`);

  if (autoDownload) {
    await ensureBdsInstalled(versionConfig.bdsVersion, bdsPath);
  }

  const exePath = path.join(bdsPath, serverExe);
  if (!fs.existsSync(exePath)) {
    throw new Error(
      `BDS executable not found at ${exePath}. ` +
      'Set autoDownload: true or install BDS manually.',
    );
  }

  // World template — copy into the server's worlds directory if specified.
  const templatePath = opts.templateWorldPath ?? versionConfig.templateWorldPath;
  if (templatePath && fs.existsSync(templatePath)) {
    const serverWorldPath = path.join(bdsPath, 'worlds', versionConfig.worldName);
    fs.rmSync(serverWorldPath, { recursive: true, force: true });
    fs.cpSync(templatePath, serverWorldPath, { recursive: true });
    console.log(`[bdt] copied template world ${templatePath} → ${serverWorldPath}`);
  }

  // Bundled behavior packs — copy each `behavior_packs/<name>/` from the
  // repo into BDS's `development_behavior_packs/<name>/`, which BDS
  // auto-loads at startup. Required for fixtures that fire scriptevents
  // (e.g. `scriptevent test:equip_enchanted …` for Soul Speed boots).
  const repoBpDir = opts.behaviorPacksDir;
  if (repoBpDir && fs.existsSync(repoBpDir)) {
    const targetRoot = path.join(bdsPath, 'development_behavior_packs');
    fs.mkdirSync(targetRoot, { recursive: true });
    for (const name of fs.readdirSync(repoBpDir)) {
      const src = path.join(repoBpDir, name);
      if (!fs.statSync(src).isDirectory()) continue;
      const dst = path.join(targetRoot, name);
      fs.rmSync(dst, { recursive: true, force: true });
      fs.cpSync(src, dst, { recursive: true });
      console.log(`[bdt] installed behavior pack '${name}' → ${dst}`);
    }
  }

  writeServerProperties(bdsPath, {
    port,
    worldName: versionConfig.worldName,
  });

  console.log(`[bdt] launching BDS at ${exePath}`);
  const child = spawn(exePath, [], {
    cwd: bdsPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  const ctx = wireStdio(child);

  await waitForServerReady(child, ctx, startupTimeoutMs);

  return makeHandle(child, ctx, port, versionConfig.bdsVersion);
}

// ─── internals ──────────────────────────────────────────────────────────────

async function ensureBdsInstalled(version: string, bdsPath: string): Promise<void> {
  if (fs.existsSync(path.join(bdsPath, serverExe))) return;
  console.log(`[bdt] BDS ${version} not found at ${bdsPath}, downloading...`);
  fs.mkdirSync(path.dirname(bdsPath), { recursive: true });

  let downloadVersion = version;
  if (!downloadVersion || downloadVersion === 'latest') {
    const versions = await bedrockServer.getLatestVersions();
    const platformVersions = isWindows ? versions.windows : versions.linux;
    downloadVersion = platformVersions?.version4 || platformVersions?.version3;
    if (!downloadVersion) throw new Error('Failed to discover latest BDS version');
  }

  const parentDir = path.dirname(bdsPath);
  await bedrockServer.downloadServer(downloadVersion, {
    root: parentDir,
    path: `bds-${downloadVersion}`,
  });

  // Normalize the install directory name if the downloader produced a different one.
  const npmCreatedDir = path.resolve(path.join(parentDir, `bds-${downloadVersion}`));
  const targetDir = path.resolve(bdsPath);
  const same = isWindows
    ? npmCreatedDir.toLowerCase() === targetDir.toLowerCase()
    : npmCreatedDir === targetDir;
  if (!same && fs.existsSync(npmCreatedDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.renameSync(npmCreatedDir, targetDir);
  }
  console.log(`[bdt] BDS ${downloadVersion} installed at ${bdsPath}`);
}

function writeServerProperties(bdsPath: string, opts: { port: number; worldName: string }): void {
  const propsPath = path.join(bdsPath, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    console.warn(`[bdt] server.properties not found at ${propsPath}; the server may use defaults.`);
    return;
  }
  let content = fs.readFileSync(propsPath, 'utf8');
  const updates: Record<string, string | number | boolean> = {
    'server-port': opts.port,
    'server-portv6': opts.port + 1,
    'level-name': opts.worldName,
    gamemode: 'creative',
    difficulty: 'peaceful',
    'allow-cheats': true,
    'online-mode': false,
    'enable-lan-visibility': false,
    'default-player-permission-level': 'operator',
    'content-log-file-enabled': true,
    'content-log-level': 'verbose',
    'player-position-acceptance-threshold': 100,
    'player-movement-action-direction-threshold': 0,
    'client-side-chunk-generation-enabled': false,
  };
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    content = regex.test(content) ? content.replace(regex, newLine) : `${content}\n${newLine}`;
  }
  fs.writeFileSync(propsPath, content);
}

interface StdioContext {
  outputBuffer: string[];
  outputListeners: Array<{
    pattern: RegExp;
    resolve: (m: string) => void;
    reject: (e: Error) => void;
  }>;
}

function wireStdio(child: ChildProcess): StdioContext {
  const ctx: StdioContext = { outputBuffer: [], outputListeners: [] };
  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stdout.write(text);
    let consumed = false;
    for (let i = ctx.outputListeners.length - 1; i >= 0; i--) {
      const listener = ctx.outputListeners[i]!;
      if (listener.pattern.test(text)) {
        ctx.outputListeners.splice(i, 1);
        listener.resolve(text);
        consumed = true;
      }
    }
    if (!consumed) {
      ctx.outputBuffer.push(text);
      if (ctx.outputBuffer.length > 100) ctx.outputBuffer.shift();
    }
  });
  child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
  return ctx;
}

function waitForServerReady(child: ChildProcess, _ctx: StdioContext, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start within ${timeoutMs}ms`)), timeoutMs);
    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes('Server started') || text.includes('IPv4 supported')) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        // Small settle delay before clients connect.
        setTimeout(resolve, 500);
      }
    };
    child.stdout?.on('data', onData);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timer);
        reject(new Error(`Server exited with code ${code} before becoming ready`));
      }
    });
  });
}

function makeHandle(child: ChildProcess, ctx: StdioContext, port: number, version: string): BdsHandle {
  return {
    host: '127.0.0.1',
    port,
    version,
    async stop() {
      return new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.stdin?.write('stop\n');
        const timer = setTimeout(() => {
          forceKill(child);
          resolve();
        }, 5000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    async sendCommand(command: string) {
      if (!child.stdin) throw new Error('Server stdin not available');
      child.stdin.write(command + '\n');
    },
    async waitForOutput(pattern: RegExp, timeoutMs = 5000) {
      for (let i = 0; i < ctx.outputBuffer.length; i++) {
        if (pattern.test(ctx.outputBuffer[i]!)) {
          const match = ctx.outputBuffer[i]!;
          ctx.outputBuffer.splice(i, 1);
          return match;
        }
      }
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = ctx.outputListeners.findIndex((l) => l.resolve === resolve);
          if (idx !== -1) ctx.outputListeners.splice(idx, 1);
          reject(new Error(`Timeout waiting for pattern ${pattern}`));
        }, timeoutMs);
        ctx.outputListeners.push({
          pattern,
          resolve: (m) => { clearTimeout(timer); resolve(m); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        });
      });
    },
  };
}

function forceKill(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch {
    // already dead
  }
}

/** Best-effort: kill any running Minecraft.Windows.exe so a clean run starts. */
export function killMinecraftClient(): void {
  if (!isWindows) return;
  try {
    spawnSync('taskkill', ['/F', '/IM', 'Minecraft.Windows.exe'], { stdio: 'ignore' });
  } catch {
    // ignore
  }
}
