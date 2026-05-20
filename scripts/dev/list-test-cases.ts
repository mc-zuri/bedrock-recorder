// Walk every registered fixture, print every testCaseStart name.
import { listFixtures } from '@bdt/scenarios/dist/fixtures/index.js';

const names = new Set<string>();
for (const f of listFixtures()) {
  for (const seq of f.sequences) {
    for (const a of seq.actions) {
      if (a.type === 'testCaseStart') names.add(a.name);
    }
  }
}
for (const n of [...names].sort()) console.log(n);
