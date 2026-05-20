import type { Fixture } from '@bdt/core';

/**
 * Process-global registry of fixtures. Each fixture file registers itself
 * via `registerFixture()` at import time. The CLI imports the fixture index,
 * which then re-exports every fixture file.
 *
 * Phase-1 stub: only the smoke fixture is registered until Task #8 ports
 * v2's fixtures2/ catalog.
 */

export const fixtureRegistry = new Map<string, Fixture>();

export function registerFixture(fixture: Fixture): void {
  if (fixtureRegistry.has(fixture.name)) {
    throw new Error(`Fixture '${fixture.name}' is already registered`);
  }
  fixtureRegistry.set(fixture.name, fixture);
}

export function getFixture(name: string): Fixture {
  const f = fixtureRegistry.get(name);
  if (!f) {
    throw new Error(
      `Unknown fixture '${name}'. Registered: ${[...fixtureRegistry.keys()].join(', ') || '(none)'}`,
    );
  }
  return f;
}

export function listFixtures(): readonly Fixture[] {
  return [...fixtureRegistry.values()];
}
