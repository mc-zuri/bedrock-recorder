import type { LogRecord } from '@bdt/core';

/**
 * Abstraction over "where dump records go." The default sink is a binary
 * file (`BinaryFileSink` in dump-writer.ts), but Phase-4's direct-fixture
 * mode subscribes a `TapSink` in-process to skip the file roundtrip.
 *
 * Records arrive in the order written; the sink owns flushing and closing.
 */
export interface DumpSink {
  writeServerbound(buffer: Buffer, time: bigint): void;
  writeClientbound(buffer: Buffer, time: bigint): void;
  writeLog(record: LogRecord, time: bigint): void;
  flush(): void;
  close(): void;
}
