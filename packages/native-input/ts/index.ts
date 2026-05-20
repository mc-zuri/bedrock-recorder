import { setTimeout as sleep } from 'node:timers/promises';
import * as path from 'node:path';
import { Keys, resolveKey, type KeyName, type VirtualKey } from './keys.js';
import {
  INPUT_KEYBOARD, INPUT_MOUSE,
  KEYEVENTF, MOUSEEVENTF, WHEEL_DELTA,
  type MouseButton, type NativeInput,
} from './types.js';

interface NativeAddon {
  sendInput(inputs: NativeInput[], count: number): number;
  getForegroundWindowTitle(): string;
  setForegroundFilter(substring: string | null): void;
}

// Load the compiled addon. The .node binary lives at build/Release/native_input.node,
// resolved relative to this compiled file in dist/.
function loadAddon(): NativeAddon {
  const addonPath = path.join(__dirname, '..', 'build', 'Release', 'native_input.node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(addonPath) as NativeAddon;
}

const buttonFlags: Record<MouseButton, { down: number; up: number }> = {
  left:   { down: MOUSEEVENTF.LEFTDOWN,   up: MOUSEEVENTF.LEFTUP   },
  right:  { down: MOUSEEVENTF.RIGHTDOWN,  up: MOUSEEVENTF.RIGHTUP  },
  middle: { down: MOUSEEVENTF.MIDDLEDOWN, up: MOUSEEVENTF.MIDDLEUP },
};

function keyboardInput(vk: number, dwFlags: number): NativeInput {
  return { type: INPUT_KEYBOARD, wVk: vk, wScan: 0, dwFlags, time: 0, dwExtraInfo: 0 };
}

function mouseInput(opts: Partial<Omit<NativeInput & { type: 0 }, 'type'>>): NativeInput {
  return {
    type: INPUT_MOUSE,
    dx: opts.dx ?? 0,
    dy: opts.dy ?? 0,
    mouseData: (opts as { mouseData?: number }).mouseData ?? 0,
    dwFlags: (opts as { dwFlags?: number }).dwFlags ?? 0,
    time: 0,
    dwExtraInfo: 0,
  };
}

export interface InputControllerOptions {
  /** Substring of the foreground window title that gates input. Default: "Minecraft". Pass null to disable. */
  foregroundFilter?: string | null;
}

export class InputController {
  private readonly addon: NativeAddon;

  constructor(opts?: InputControllerOptions) {
    this.addon = loadAddon();
    if (opts && 'foregroundFilter' in opts) {
      this.addon.setForegroundFilter(opts.foregroundFilter ?? null);
    }
  }

  // ─── Foreground gate ──────────────────────────────────────────────────────

  setForegroundFilter(substring: string | null): void {
    this.addon.setForegroundFilter(substring);
  }

  getForegroundWindowTitle(): string {
    return this.addon.getForegroundWindowTitle();
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────

  keyDown(key: KeyName | VirtualKey): void {
    const vk = resolveKey(key);
    this.addon.sendInput([keyboardInput(vk, KEYEVENTF.KEYDOWN)], 1);
  }

  keyUp(key: KeyName | VirtualKey): void {
    const vk = resolveKey(key);
    this.addon.sendInput([keyboardInput(vk, KEYEVENTF.KEYUP)], 1);
  }

  keyDownMultiple(keys: (KeyName | VirtualKey)[]): void {
    const inputs = keys.map((k) => keyboardInput(resolveKey(k), KEYEVENTF.KEYDOWN));
    this.addon.sendInput(inputs, inputs.length);
  }

  keyUpMultiple(keys: (KeyName | VirtualKey)[]): void {
    const inputs = keys.map((k) => keyboardInput(resolveKey(k), KEYEVENTF.KEYUP));
    this.addon.sendInput(inputs, inputs.length);
  }

  async tap(key: KeyName | VirtualKey, ms = 16): Promise<void> {
    this.keyDown(key);
    await sleep(ms);
    this.keyUp(key);
  }

  // ─── Mouse ───────────────────────────────────────────────────────────────

  mouseDown(button: MouseButton = 'left'): void {
    this.addon.sendInput([mouseInput({ dwFlags: buttonFlags[button].down })], 1);
  }

  mouseUp(button: MouseButton = 'left'): void {
    this.addon.sendInput([mouseInput({ dwFlags: buttonFlags[button].up })], 1);
  }

  mouseClick(button: MouseButton = 'left'): void {
    const { down, up } = buttonFlags[button];
    this.addon.sendInput([
      mouseInput({ dwFlags: down }),
      mouseInput({ dwFlags: up }),
    ], 2);
  }

  /** Relative mouse move (MOUSEEVENTF_MOVE, no ABSOLUTE flag). */
  mouseMove(dx: number, dy: number): void {
    this.addon.sendInput([mouseInput({ dx, dy, dwFlags: MOUSEEVENTF.MOVE })], 1);
  }

  /** `delta` is in WHEEL_DELTA units (positive=forward/up, negative=back/down). */
  mouseWheel(delta: number): void {
    this.addon.sendInput([
      mouseInput({ mouseData: delta * WHEEL_DELTA, dwFlags: MOUSEEVENTF.WHEEL }),
    ], 1);
  }

  // ─── Escape hatch ────────────────────────────────────────────────────────

  /** Forward a pre-built batch of INPUT structs. */
  raw(inputs: NativeInput[]): number {
    return this.addon.sendInput(inputs, inputs.length);
  }
}

export { Keys, resolveKey } from './keys.js';
export type { KeyName, VirtualKey } from './keys.js';
export {
  INPUT_KEYBOARD, INPUT_MOUSE, INPUT_HARDWARE,
  KEYEVENTF, MOUSEEVENTF, WHEEL_DELTA,
} from './types.js';
export type { MouseButton, NativeInput, NativeMouseInput, NativeKeyboardInput, NativeHardwareInput } from './types.js';
