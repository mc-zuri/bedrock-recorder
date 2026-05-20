// Scan a .proxy.bin for PAIs with handled_teleport=true.

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
  reader.readBytes(5);
  reader.readUInt32();
  reader.readUInt64();
}
const version = reader.readString();
console.log(`clientVersion: ${version}`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deserializer: any = createDeserializer(protocolVersion);
deserializer.proto.setVariable('ShieldItemID', 380);

let total = 0;
let handledTrue = 0;
let firstHandled: { idx: number; tick: bigint | number; time: bigint } | null = null;
let lastHandledIdx = -1;
const sampleTrueValues: unknown[] = [];

while (true) {
  let kind: string;
  try { kind = reader.readChar(); } catch { break; }
  const time = reader.readInt64();
  if (kind === 'L') { reader.readString(); continue; }
  if (kind !== 'S' && kind !== 'C') break;
  const length = reader.readInt32();
  const buffer = reader.readBytes(length);
  try {
    const parsed = deserializer.parsePacketBuffer(buffer);
    if (parsed.data.name === 'player_auth_input') {
      total++;
      const inputData = parsed.data.params.input_data;
      if (inputData?.handled_teleport === true) {
        handledTrue++;
        if (!firstHandled) firstHandled = { idx: total, tick: parsed.data.params.tick, time };
        lastHandledIdx = total;
        if (sampleTrueValues.length < 3) {
          sampleTrueValues.push({
            idx: total,
            tick: parsed.data.params.tick?.toString?.() ?? parsed.data.params.tick,
            position: parsed.data.params.position,
            handled_teleport: inputData.handled_teleport,
            _value: inputData._value,
          });
        }
      }
    }
  } catch {}
}
reader.close();
fh.close();
console.log(`Total PAIs: ${total}`);
console.log(`PAIs with handled_teleport=true: ${handledTrue}`);
if (firstHandled) {
  console.log('First handled-teleport PAI:', firstHandled);
  console.log('Last handled-teleport PAI index:', lastHandledIdx);
}
console.log('Sample:', JSON.stringify(sampleTrueValues, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
