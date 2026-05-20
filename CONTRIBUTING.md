# Contributing to bedrock-tools-v5

Thanks for considering a patch. The repo is small and the moving parts
are mostly testable in isolation, so contributing is usually quick. This
doc is the minimum you need to make changes confidently.

## Setup

```pwsh
# Clone, then once from the repo root:
npm install      # installs deps + builds the C++ native addon
npm run build    # compiles every TS package to dist/

# Sanity check
npm test         # ~55 unit tests, no live client needed
```

If `npm install` fails on the native addon, you're missing Visual Studio
Build Tools or Python. See `docs/TROUBLESHOOTING.md`.

## Workspace layout

See [README.md](README.md) → "What's in the box". The packages form an
acyclic graph; `bdt-core` has zero runtime deps and everything else flows
through it.

## Where tests live

| Package | Test runner | Pattern |
|---|---|---|
| `native-input` | `node --test` | `dist/*.test.js` (smoke check loads the addon, validates `Keys`) |
| `scenarios`    | `node --test` | `dist/**/*.test.js` (builder, executor, overlay expander, util) |
| `bds-adapter`  | `node --test` | `dist/**/*.test.js` (config, version-registry, dump-writer round-trip, beforeEachCase) |

Run all of them with `npm test` from the repo root. Tests must compile
first (TypeScript), so each package's `test` script is `tsc && node
--test`. There's no live BDS or Minecraft client in any of these.

For end-to-end verification with a live client, see
[docs/SMOKE_TEST.md](docs/SMOKE_TEST.md).

## Adding a new fixture

See [docs/FIXTURE_AUTHORING.md](docs/FIXTURE_AUTHORING.md). Short version:

1. Create `packages/scenarios/src/fixtures/<NN>_<name>.ts`.
2. Build it with `SimulationBuilder.sceneTestCase({ … })` — that handles
   the safe-zone teleport, preamble bracketing, and recorded-window
   slicing for you.
3. `registerFixture(buildXxx())` at the bottom of the file.
4. Add `import './fixtures/NN_name.js';` to
   `packages/scenarios/src/fixtures/index.ts` so the side-effect register
   fires when the CLI loads.
5. `npm run build && bdt list-fixtures` to verify the name appears.

## Code style

- TypeScript strict mode throughout. No `any` in new code without a
  comment explaining why.
- Comments explain **why**, not what. If the line is non-obvious, write
  the constraint or invariant — not a paraphrase of the code.
- Don't add error handling, validation, or fallbacks for cases that can't
  happen given the surrounding contract. Trust internal code.
- Avoid hardcoded paths or per-machine values in source. Tracked code
  should run identically on any contributor's machine.

## Don't leak personal info into commits

When sharing diffs, double-check for:

- Your Microsoft / Xbox gamertag.
- `C:\Users\<you>\...` paths.
- `D:\projects\...` or any other workspace-shaped absolute path.
- Real BDS save data (worlds with player coords).

Run the path-guard before pushing:

```pwsh
bash scripts/check-paths.sh
```

CI runs the same script — fails the build if a forbidden token appears
in tracked files.

## Commit messages

Short imperative subject (`fix waitUntilStable…`). Body when the *why*
isn't obvious from the diff — e.g. a quirk of bedrock-protocol, a Bedrock
client behaviour, an edge case in the recorder.

## Reporting issues

Useful issues include:

- Minecraft client version + BDS version (`bdt config show`).
- Console output up to the failure (Relay close, BDS exit code, etc.).
- The `.proxy.bin` if relevant — these are small enough to attach.

