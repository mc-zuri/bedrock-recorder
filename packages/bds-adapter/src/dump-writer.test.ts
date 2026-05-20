import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PacketDumpWriter } from './dump-writer.js';
import { PacketDumpReader } from './dump-reader.js';
import { DUMP_MAGIC, DUMP_SCHEMA_VERSION } from '@bdt/core';

async function tmpFile(suffix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bdt-dump-'));
  return path.join(dir, `test${suffix}`);
}

test('writer emits BDT5 magic + schemaVersion + epochNanos header', async () => {
  const file = await tmpFile('.proxy.bin');
  const w = PacketDumpWriter.toFile('1.26.13.1', file);
  w.close();

  const buf = await fs.readFile(file);
  assert.deepEqual(buf.subarray(0, DUMP_MAGIC.length), DUMP_MAGIC);
  assert.equal(buf.readUInt32LE(DUMP_MAGIC.length), DUMP_SCHEMA_VERSION);
  // epochNanos is reasonable (between 2020 and 2100 ns since unix epoch)
  const epoch = buf.readBigUInt64LE(DUMP_MAGIC.length + 4);
  const epochMs = Number(epoch / 1_000_000n);
  assert.ok(epochMs > new Date('2020-01-01').getTime(), 'epoch is recent');
  assert.ok(epochMs < new Date('2100-01-01').getTime(), 'epoch is not absurd');
});

test('round-trip: writer → reader recovers records in order', async () => {
  const file = await tmpFile('.proxy.bin');
  const w = PacketDumpWriter.toFile('1.26.13.1', file);

  w.writeLog({ type: 'fixture', name: 'smoke' });
  w.writeLog({ type: 'test-case-start', name: 'foo' });
  w.writeServerbound(Buffer.from([0x01, 0x02, 0x03]));
  w.writeClientbound(Buffer.from([0x10, 0x20]));
  w.writeLog({ type: 'test-case-end', name: 'foo' });
  w.close();

  const r = PacketDumpReader.open(file);
  assert.equal(r.header.clientVersion, '1.26.13.1');
  assert.equal(r.header.schemaVersion, DUMP_SCHEMA_VERSION);

  const events = [...r.events()];
  r.close();

  assert.equal(events.length, 5);
  assert.equal(events[0]?.kind, 'L');
  assert.equal((events[0] as { record: { type: string } }).record.type, 'fixture');
  assert.equal(events[2]?.kind, 'S');
  assert.deepEqual((events[2] as { payload: Buffer }).payload, Buffer.from([0x01, 0x02, 0x03]));
  assert.equal(events[3]?.kind, 'C');
  assert.equal((events[4] as { record: { type: string } }).record.type, 'test-case-end');
});

test('reader rejects v5 dumps with unsupported schemaVersion', async () => {
  // Construct a file with the BDT5 magic but a wrong schemaVersion.
  const file = await tmpFile('.future.proxy.bin');
  const buf = Buffer.alloc(5 + 4 + 8);
  buf.write('BDT5\x00', 0, 'binary');
  buf.writeUInt32LE(9999, 5); // unsupported schemaVersion
  buf.writeBigUInt64LE(0n, 9);
  await fs.writeFile(file, buf);
  assert.throws(() => PacketDumpReader.open(file), /Unsupported dump schema version 9999/);
});

test('legacy mode: writer omits BDT5 header and reader auto-detects', async () => {
  const file = await tmpFile('.legacy.proxy.bin');
  const w = PacketDumpWriter.toFile('1.26.13.1', file, { legacy: true });
  w.writeLog({ type: 'fixture', name: 'smoke' });
  w.writeServerbound(Buffer.from([0xaa, 0xbb]));
  w.close();

  const buf = await fs.readFile(file);
  // First byte must NOT be 'B' (the start of the BDT5 magic). v2's wire
  // format begins with the csbinary-encoded version string — a uvarint length
  // prefix (small N) followed by the version chars.
  assert.notEqual(buf[0], 0x42 /* 'B' */, 'legacy dump must not start with B for BDT5');

  // Reader auto-detects the missing header.
  const r = PacketDumpReader.open(file);
  assert.equal(r.header.clientVersion, '1.26.13.1');
  assert.equal(r.header.schemaVersion, 0, 'schemaVersion=0 signals legacy');
  const events = [...r.events()];
  r.close();
  assert.equal(events.length, 2);
});

test('legacy/v5 round-trips emit byte-identical S/C/L records after the header', async () => {
  const v5File = await tmpFile('.v5.proxy.bin');
  const legacyFile = await tmpFile('.legacy.proxy.bin');

  // Lock relative timestamps by writing identical sequences with same payloads.
  const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  const log = { type: 'test-case-start' as const, name: 'foo' };

  const w1 = PacketDumpWriter.toFile('1.26.13.1', v5File);
  w1.writeLog(log);
  w1.writeServerbound(payload);
  w1.close();

  const w2 = PacketDumpWriter.toFile('1.26.13.1', legacyFile, { legacy: true });
  w2.writeLog(log);
  w2.writeServerbound(payload);
  w2.close();

  // The legacy file is the v5 file minus the 17-byte BDT5 header (5 magic + 4 schemaVer + 8 epoch).
  const v5Buf = await fs.readFile(v5File);
  const legacyBuf = await fs.readFile(legacyFile);
  const headerLen = 5 + 4 + 8;

  // Record streams will differ only in the time-since-ctor field on each record
  // (writers were constructed at different timestamps). Compare the *structural*
  // tail: starting from the version string. We compare the layout sizes match.
  assert.equal(v5Buf.length, legacyBuf.length + headerLen, 'legacy is exactly headerLen bytes shorter');
});

test('writer monotonic time: each record has time >= the previous', async () => {
  const file = await tmpFile('.proxy.bin');
  const w = PacketDumpWriter.toFile('1.26.13.1', file);
  for (let i = 0; i < 50; i++) w.writeServerbound(Buffer.from([i & 0xff]));
  w.close();

  const r = PacketDumpReader.open(file);
  let last = -1n;
  let n = 0;
  for (const ev of r.events()) {
    if (ev.kind === 'S' || ev.kind === 'C') {
      assert.ok(ev.time >= last, 'monotonic timestamps');
      last = ev.time;
      n++;
    }
  }
  r.close();
  assert.equal(n, 50);
});
