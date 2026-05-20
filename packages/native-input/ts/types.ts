// Win32 INPUT struct flavors, as JS objects. Mirrors the C++ wrappers in input.cpp.

export const INPUT_MOUSE = 0;
export const INPUT_KEYBOARD = 1;
export const INPUT_HARDWARE = 2;

// MOUSEEVENTF_* flags
export const MOUSEEVENTF = {
  MOVE:          0x0001,
  LEFTDOWN:      0x0002,
  LEFTUP:        0x0004,
  RIGHTDOWN:     0x0008,
  RIGHTUP:       0x0010,
  MIDDLEDOWN:    0x0020,
  MIDDLEUP:      0x0040,
  WHEEL:         0x0800,
  HWHEEL:        0x1000,
  ABSOLUTE:      0x8000,
} as const;

// KEYEVENTF_* flags
export const KEYEVENTF = {
  KEYDOWN:       0x0000,
  EXTENDEDKEY:   0x0001,
  KEYUP:         0x0002,
  UNICODE:       0x0004,
  SCANCODE:      0x0008,
} as const;

export const WHEEL_DELTA = 120;

export interface NativeMouseInput {
  type: typeof INPUT_MOUSE;
  dx: number;
  dy: number;
  mouseData: number;
  dwFlags: number;
  time: number;
  dwExtraInfo: number;
}

export interface NativeKeyboardInput {
  type: typeof INPUT_KEYBOARD;
  wVk: number;
  wScan: number;
  dwFlags: number;
  time: number;
  dwExtraInfo: number;
}

export interface NativeHardwareInput {
  type: typeof INPUT_HARDWARE;
  uMsg: number;
  wParamL: number;
  wParamH: number;
}

export type NativeInput = NativeMouseInput | NativeKeyboardInput | NativeHardwareInput;

export type MouseButton = 'left' | 'right' | 'middle';
