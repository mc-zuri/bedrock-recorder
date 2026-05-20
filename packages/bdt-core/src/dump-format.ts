/**
 * `.proxy.bin` file layout (v5):
 *
 *   ┌───────────────────────── HEADER (new in v5) ──────────────────────────┐
 *   │ magic        : char[5]    "BDT5\x00"                                  │
 *   │ schemaVersion: uint32_le  1                                           │
 *   │ epochNanos   : uint64_le  wall-clock anchor at writer ctor            │
 *   ├───────────────────────── v2-COMPATIBLE BODY ──────────────────────────┤
 *   │ clientVersion: c-string   utf-8, e.g. "1.26.13.1"                     │
 *   │ record*                   stream of S/C/L records, see below          │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 *   Record (one per packet/log entry):
 *     kind  : char       'S' | 'C' | 'L'
 *     time  : int64_le   ns since writer construction (relative)
 *     S/C   : { length: int32_le, payload: bytes[length] }
 *     L     : { jsonLen: int32_le, json: utf-8 bytes }
 *
 * Bump `DUMP_SCHEMA_VERSION` on any change. Downstream readers must check
 * the version and refuse unknown values rather than silently misinterpret.
 */

import type { Vec3, WorldScene } from './scene.js';

export const DUMP_MAGIC = Buffer.from('BDT5\x00', 'binary');
export const DUMP_SCHEMA_VERSION = 1 as const;

export type DumpRecordKind = 'S' | 'C' | 'L';

export interface DumpHeader {
  schemaVersion: number;
  epochNanos: bigint;
  clientVersion: string;
}

/**
 * L-record payloads we emit. Extractors switch on `type`.
 *
 * Notes for future extractor work:
 *   - `description` lets the extractor stamp the generated test file's `describe`
 *     block. v2 extractor ignores it (forward-compat).
 *   - `preamble-start` / `preamble-end` bracket setup work (teleport, clear
 *     inventory, apply effects). The packets between them are *recorded* but
 *     extractors should skip them when generating fixtures. The v2 extractor
 *     reads this as a free-form L-record (ignored); v5-aware extractors can
 *     use it to draw scenario boundaries that don't pollute the PAI stream.
 *   - We never re-bracket preambles as `test-case-start { preload: true }`.
 *     PAI captured during a preamble lives in the *gap between* test cases
 *     and is naturally ignored by the extractor's case-windowing pass.
 */
export type LogRecord =
  | { type: 'fixture'; name: string; description?: string }
  | {
      type: 'test-case-start';
      name: string;
      scene?: WorldScene;
      startPos?: Vec3;
      preload?: boolean;
      description?: string;
      meta?: Record<string, unknown>;
    }
  | { type: 'test-case-end'; name: string }
  | { type: 'preamble-start'; name: string; description?: string }
  | { type: 'preamble-end'; name: string }
  | { type: 'note'; message: string }
  | { type: string; [k: string]: unknown };
