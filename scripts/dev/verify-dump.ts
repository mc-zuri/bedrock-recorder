import { PacketDumpReader } from '@bdt/bds-adapter';

const file = process.argv[2] ?? 'fixtures-out/1.26.13.1-smoke.proxy.bin';
const r = PacketDumpReader.open(file);
console.log('header:', { schemaVersion: r.header.schemaVersion, clientVersion: r.header.clientVersion });
let n = 0;
for (const ev of r.events()) {
  n++;
  if (ev.kind === 'L') {
    console.log(`  L #${n}:`, ev.record.type, JSON.stringify(ev.record).slice(0, 120));
  } else {
    console.log(`  ${ev.kind} #${n}: ${(ev as { payload: Buffer }).payload.length} bytes`);
  }
}
r.close();
console.log(`total records: ${n}`);
