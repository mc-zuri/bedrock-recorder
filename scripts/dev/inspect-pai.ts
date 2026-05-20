// Sample the first few player_auth_input packets from a .proxy.bin so we can
// see the actual field names bedrock-protocol produces for protocol 944.

import * as fs from 'node:fs';
import { BinaryReader, File } from 'csbinary';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDeserializer } = require('bedrock-protocol/src/transforms/serializer.js');

const file = process.argv[2] ?? 'D:/traces/1.26.13.1/1.26.13.1-smoke.proxy.bin';
const protocolVersion = process.argv[3] ?? '1.26.10';
const maxToShow = Number(process.argv[4] ?? 3);

const fh = File(fs.openSync(file, 'r'));
const reader = new BinaryReader(fh);

// Skip BDT5 header if present.
const magicProbe = Buffer.alloc(5);
fs.readSync(fs.openSync(file, 'r'), magicProbe, 0, 5, 0);
if (magicProbe.equals(Buffer.from('BDT5\x00', 'binary'))) {
  reader.readBytes(5);   // magic
  reader.readUInt32();   // schemaVersion
  reader.readUInt64();   // epochNanos
}

const version = reader.readString();
console.log(`clientVersion: ${version}`);
console.log(`Using protocolVersion: ${protocolVersion}`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deserializer: any = createDeserializer(protocolVersion);
deserializer.proto.setVariable('ShieldItemID', 380);

let shown = 0;
const sampled: unknown[] = [];

while (shown < maxToShow) {
  let kind: string;
  try { kind = reader.readChar(); } catch { break; }
  const time = reader.readInt64();

  if (kind === 'L') {
    const msg = reader.readString();
    void msg;
    continue;
  }
  if (kind !== 'S' && kind !== 'C') break;
  const length = reader.readInt32();
  const buffer = reader.readBytes(length);

  try {
    const parsed = deserializer.parsePacketBuffer(buffer);
    if (parsed.data.name === 'player_auth_input') {
      sampled.push(parsed.data.params);
      console.log(`\n=== PAI #${shown + 1} at t=${time}ns ===`);
      console.log('top-level keys:', Object.keys(parsed.data.params));
      const inputData = parsed.data.params.input_data ?? parsed.data.params.inputData;
      if (inputData) {
        console.log('input_data keys:', Object.keys(inputData).slice(0, 20).join(', '), `... (${Object.keys(inputData).length} total)`);
        const interesting: Record<string, unknown> = {};
        for (const k of Object.keys(inputData)) {
          if (/teleport|spawn|init|handled/i.test(k)) interesting[k] = (inputData as Record<string, unknown>)[k];
        }
        console.log('teleport/init/handled flags:', interesting);
      } else {
        console.log('NO input_data / inputData FIELD');
      }
      shown++;
    }
  } catch (err) {
    // skip undecodable packets
    void err;
  }
}

reader.close();
fh.close();
