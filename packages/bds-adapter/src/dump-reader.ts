import * as fs from 'node:fs';
import { BinaryReader, File } from 'csbinary';
import { DUMP_MAGIC, DUMP_SCHEMA_VERSION, type DumpHeader, type LogRecord } from '@bdt/core';

export type DumpEvent =
  | { kind: 'S'; time: bigint; payload: Buffer }
  | { kind: 'C'; time: bigint; payload: Buffer }
  | { kind: 'L'; time: bigint; record: LogRecord };

/**
 * Streaming reader for `.proxy.bin` files. Mirrors the writer's wire format.
 * Yields records lazily so the caller can early-exit (e.g. for fixture extraction).
 */
export class PacketDumpReader {
  private constructor(
    private readonly file: ReturnType<typeof File>,
    private readonly reader: BinaryReader,
    readonly header: DumpHeader,
  ) {}

  /**
   * Open a dump file. Auto-detects:
   *   - v5 BDT5 header (skipped, metadata exposed on `header`)
   *   - v2 legacy stream (no header — version string at offset 0)
   */
  static open(filename: string): PacketDumpReader {
    // Probe the first 5 bytes for the BDT5 magic without consuming the stream.
    const fd = fs.openSync(filename, 'r');
    const probe = Buffer.alloc(DUMP_MAGIC.length);
    fs.readSync(fd, probe, 0, probe.length, 0);
    fs.closeSync(fd);

    const fileHandle = File(fs.openSync(filename, 'r'));
    const reader = new BinaryReader(fileHandle);

    if (probe.equals(DUMP_MAGIC)) {
      // v5 format with full header
      reader.readBytes(DUMP_MAGIC.length); // consume magic
      const schemaVersion = reader.readUInt32();
      if (schemaVersion !== DUMP_SCHEMA_VERSION) {
        reader.close();
        fileHandle.close();
        throw new Error(
          `Unsupported dump schema version ${schemaVersion} (this build expects ${DUMP_SCHEMA_VERSION})`,
        );
      }
      const epochNanos = reader.readUInt64();
      const clientVersion = reader.readString();
      return new PacketDumpReader(fileHandle, reader, { schemaVersion, epochNanos, clientVersion });
    }

    // v2 legacy format — version string at offset 0, no header metadata.
    const clientVersion = reader.readString();
    return new PacketDumpReader(fileHandle, reader, {
      schemaVersion: 0,
      epochNanos: 0n,
      clientVersion,
    });
  }

  *events(): Generator<DumpEvent> {
    while (true) {
      let kind: string;
      try {
        kind = this.reader.readChar();
      } catch {
        // EOF
        return;
      }
      if (kind === 'S' || kind === 'C') {
        const time = this.reader.readInt64();
        const length = this.reader.readInt32();
        const payload = this.reader.readBytes(length);
        yield { kind, time, payload };
      } else if (kind === 'L') {
        const time = this.reader.readInt64();
        const json = this.reader.readString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = JSON.parse(json) as any;
        // Accept either the v2-style envelope `{message, data}` or a flat
        // LogRecord (for backwards compat with earlier v5 dumps).
        const record: LogRecord =
          parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object'
            ? (parsed.data as LogRecord)
            : (parsed as LogRecord);
        yield { kind: 'L', time, record };
      } else {
        throw new Error(`Unknown record kind '${kind}' at offset (unknown)`);
      }
    }
  }

  close(): void {
    this.reader.close();
    this.file.close();
  }
}
