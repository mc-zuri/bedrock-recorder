# Dev scripts

One-off diagnostic utilities used during development. None of these are
part of the user-facing `bdt` CLI — they're tools you reach for when
something looks weird in a recording.

Run any of them with `npx tsx scripts/dev/<name>.ts <args>` from the
repo root (the workspace already has `tsx` installed).

| Script | What it does |
|---|---|
| `inspect-pai.ts` | Sample the first few `player_auth_input` packets from a `.proxy.bin` so you can see the actual field names `bedrock-protocol` produces for the protocol version. |
| `scan-chunk-names.ts` | Tally clientbound packet names in a dump — useful when adding a new chunk-related wait predicate. |
| `scan-handled-teleport.ts` | Scan a `.proxy.bin` for PAIs with `handled_teleport=true`. Helps debug post-teleport state. |
| `verify-dump.ts` | Print a dump's BDT5 header (schema version + client version). Smoke test for the writer. |
| `list-test-cases.ts` | Walk every registered fixture, print every `testCaseStart` name. Useful to cross-check against the recorded output. |

Stable enough to keep around, niche enough to not warrant top-level
placement.
