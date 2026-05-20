/**
 * Placeholder substitution for command strings, applied by the executor at
 * runtime *just before* the command is sent to the relay.
 *
 * Convention: fixtures use `${PLAYER}` where v2 used `@a`. The executor
 * substitutes from `config.relay.username` so a recording made under one
 * Microsoft account replays cleanly on another.
 *
 *   v2:  .command('give @a diamond_sword 2')
 *   v5:  .command('give ${PLAYER} diamond_sword 2')
 *
 * Keep `@a` only when you genuinely need to target every connected player
 * (rare — the recorder is single-client by design).
 *
 * Why a placeholder instead of a programmatic builder method (e.g.
 * `.give('diamond_sword', 2)`)? Two reasons:
 *   1. The v2 catalog has hundreds of `.command(...)` strings; mechanical
 *      `@a` → `${PLAYER}` find-replace is a one-shot port.
 *   2. New Minecraft commands land between Bedrock releases. A template
 *      string never goes stale; a typed builder method does.
 */
export const PLAYER_VAR = 'PLAYER' as const;

const VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

export interface SubstitutionVars {
  /** The recorder's bedrock-protocol username, from `config.relay.username`. */
  PLAYER?: string;
  /** Free-form additional vars; the executor passes everything it has. */
  [key: string]: string | undefined;
}

/**
 * Replace `${VAR}` tokens with values from `vars`. Unknown tokens are left
 * as-is so that fixtures referencing future variables (added in a later
 * patch) don't silently degrade — the bedrock server will fail the command
 * loud and clear instead.
 */
export function substituteVars(template: string, vars: SubstitutionVars): string {
  return template.replace(VAR_PATTERN, (whole, name: string) => {
    const v = vars[name];
    return v === undefined ? whole : v;
  });
}
