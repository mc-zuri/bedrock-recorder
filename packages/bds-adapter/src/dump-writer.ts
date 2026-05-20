import * as fs from 'node:fs';
import { BinaryWriter, File, type IFile } from 'csbinary';
import {
  DUMP_MAGIC,
  DUMP_SCHEMA_VERSION,
  type LogRecord,
} from '@bdt/core';
import type { DumpSink } from './dump-sink.js';

/**
 * The canonical `.proxy.bin` writer. Wire format documented in
 * `@bdt/core/dump-format.ts`.
 *
 * Changes vs v2's `PackentDumpWriter`:
 *   - Renamed (PackentDumpWriter → PacketDumpWriter); typo'd filename gone.
 *   - Prefixes a 5-byte magic + uint32 schemaVersion + uint64 epochNanos header.
 *   - `writeLog(record)` takes a structured `LogRecord` (v2 took a free-form
 *     `(message, data)` pair). The wire bytes for L-records are unchanged —
 *     it's still a JSON string — but the public shape is type-safe.
 *   - Backed by a `DumpSink` so Phase 4 can swap in a non-file sink.
 */
export interface DumpWriterOptions {
  /**
   * When true, omit the BDT5 magic/schemaVersion/epochNanos header so the
   * file is byte-compatible with v2's existing `extract-physics-fixtures.ts`.
   * Use until the prismarine-bedrock extractor learns the new header.
   */
  legacy?: boolean;
}

export class PacketDumpWriter {
  private readonly sink: DumpSink;
  private readonly startTime = process.hrtime.bigint();

  constructor(sink: DumpSink) {
    this.sink = sink;
  }

  /** Convenience factory: write straight to a file at `filename`. */
  static toFile(clientVersion: string, filename: string, opts: DumpWriterOptions = {}): PacketDumpWriter {
    return new PacketDumpWriter(BinaryFileSink.open(clientVersion, filename, opts));
  }

  writeServerbound(buffer: Buffer): void {
    this.sink.writeServerbound(buffer, this.elapsed());
  }

  writeClientbound(buffer: Buffer): void {
    this.sink.writeClientbound(buffer, this.elapsed());
  }

  writeLog(record: LogRecord): void {
    this.sink.writeLog(record, this.elapsed());
  }

  writeNote(message: string): void {
    this.writeLog({ type: 'note', message });
  }

  flush(): void {
    this.sink.flush();
  }

  close(): void {
    this.sink.close();
  }

  private elapsed(): bigint {
    return process.hrtime.bigint() - this.startTime;
  }
}

/**
 * Produce a v2-style `message` string for the envelope. v2 used phrases like
 * "<name> started" / "<name> completed" / "fixture" / free-form notes. We
 * pick something reasonable per record type — extractors don't actually read
 * `message`, but it makes the dump human-readable when you grep the JSON.
 */
function describeLogRecord(record: LogRecord): string {
  switch (record.type) {
    case 'fixture':        return `fixture ${(record as { name?: string }).name ?? ''}`.trim();
    case 'test-case-start': return `${(record as { name?: string }).name ?? ''} started`;
    case 'test-case-end':   return `${(record as { name?: string }).name ?? ''} completed`;
    case 'preamble-start':  return `${(record as { name?: string }).name ?? ''} setup started`;
    case 'preamble-end':    return `${(record as { name?: string }).name ?? ''} setup completed`;
    case 'note':            return (record as { message?: string }).message ?? '';
    default:                return record.type;
  }
}

/** File-backed sink: writes BDT5 header + csbinary record stream. */
export class BinaryFileSink implements DumpSink {
  private readonly file: IFile;
  private readonly writer: BinaryWriter;
  private closed = false;

  private constructor(file: IFile, writer: BinaryWriter) {
    this.file = file;
    this.writer = writer;
  }

  static open(clientVersion: string, filename: string, opts: DumpWriterOptions = {}): BinaryFileSink {
    const file = File(fs.openSync(filename, 'w'));
    const writer = new BinaryWriter(file);

    if (!opts.legacy) {
      // BDT5 header — see @bdt/core/dump-format.ts.
      writer.writeBuffer(DUMP_MAGIC);
      writer.writeUInt32(DUMP_SCHEMA_VERSION);
      writer.writeUInt64(BigInt(Date.now()) * 1_000_000n); // ms→ns
    }
    // v2-compatible body starts here (or at offset 0 in legacy mode).
    writer.writeString(clientVersion);
    writer.flush();

    return new BinaryFileSink(file, writer);
  }

  writeServerbound(buffer: Buffer, time: bigint): void {
    // Sinks may receive in-flight packets after `close()` returns (the relay's
    // packet listener fires synchronously from the bedrock-protocol decryption
    // path). Silently drop those rather than crashing the process — the close
    // already committed everything we wanted to persist.
    if (this.closed) return;
    this.writer.writeChar('S');
    this.writer.writeInt64(time);
    this.writer.writeInt32(buffer.length);
    this.writer.writeBuffer(buffer);
    this.writer.flush();
  }

  writeClientbound(buffer: Buffer, time: bigint): void {
    if (this.closed) return;
    this.writer.writeChar('C');
    this.writer.writeInt64(time);
    this.writer.writeInt32(buffer.length);
    this.writer.writeBuffer(buffer);
    this.writer.flush();
  }

  writeLog(record: LogRecord, time: bigint): void {
    if (this.closed) return;
    // Wrap in v2's `{ message, data }` envelope so the existing
    // prismarine-bedrock extractor (and any v2 tooling) can read our dumps
    // unchanged. v2's extractor at extract-physics-fixtures.ts:679 reads
    // `rec.data.data.type` — i.e. the inner payload via `.data`.
    const message = describeLogRecord(record);
    const envelope = { message, data: record };
    this.writer.writeChar('L');
    this.writer.writeInt64(time);
    this.writer.writeString(JSON.stringify(envelope));
    this.writer.flush();
  }

  flush(): void {
    if (this.closed) return;
    this.writer.flush();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.writer.flush();
    this.file.close();
    this.writer.close();
  }
}
