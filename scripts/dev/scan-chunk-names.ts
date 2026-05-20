// Tally clientbound packet names in a dump so we know what to listen for.
import * as fs from 'node:fs';
import { BinaryReader, File } from 'csbinary';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDeserializer } = require('bedrock-protocol/src/transforms/serializer.js');

const file = process.argv[2] ?? 'D:/traces/1.26.13.1/1.26.13.1-smoke.proxy.bin';
const protocolVersion = process.argv[3] ?? '1.26.10';

const fh = File(fs.openSync(file, 'r'));
const reader = new BinaryReader(fh);
const magicProbe = Buffer.alloc(5);
fs.readSync(fs.openSync(file, 'r'), magicProbe, 0, 5, 0);
if (magicProbe.equals(Buffer.from('BDT5\x00', 'binary'))) {
  reader.readBytes(5); reader.readUInt32(); reader.readUInt64();
}
reader.readString(); // version
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deserializer: any = createDeserializer(protocolVersion);
deserializer.proto.setVariable('ShieldItemID', 380);

const counts = new Map<string, number>();
while (true) {
  let kind: string;
  try { kind = reader.readChar(); } catch { break; }
  reader.readInt64();
  if (kind === 'L') { reader.readString(); continue; }
  if (kind !== 'S' && kind !== 'C') break;
  const length = reader.readInt32();
  const buf = reader.readBytes(length);
  if (kind !== 'C') continue;
  try {
    const parsed = deserializer.parsePacketBuffer(buf);
    const name = parsed.data.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  } catch {}
}
reader.close(); fh.close();
console.log('Clientbound packet name → count (sorted by count desc):');
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [n, c] of sorted) {
  const flag = /chunk|sub/i.test(n) ? '  ← CHUNK?' : '';
  console.log(`  ${c.toString().padStart(6)}  ${n}${flag}`);
}
