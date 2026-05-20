# `bdt.config.json` reference

The recorder walks up from cwd looking for `bdt.config.json`. A starter
file lives at the repo root as `bdt.config.example.json` — copy and edit.

The full schema is enforced by zod in `@bdt/bds-adapter/src/config.ts`;
unknown fields error loudly, missing required fields fail at parse.

## Top-level

```jsonc
{
  "defaultVersion": "1.26.13.1",
  "versions":       { /* see below */ },
  "dumpDir":        "./dumps",
  "relay":          { /* see below */ },
  "bdsPaths":       { /* see below */ }
}
```

| Field | Type | Purpose |
|---|---|---|
| `defaultVersion` | string | The key in `versions` used when `--client` isn't passed. |
| `versions` | `Record<string, VersionConfig>` | One entry per supported client version. |
| `dumpDir` | string | Default `--out` for `bdt record`. |
| `relay` | object | bedrock-protocol Relay settings (host, port, username, profilesFolder). |
| `bdsPaths` | object | Where BDS is installed. |

## `versions[<name>]`

```jsonc
"1.26.13.1": {
  "protocolVersion":   "1.26.10",                     // bedrock-protocol's version key
  "bdsVersion":        "1.26.14.1",                    // BDS download version
  "worldName":         "template",                      // BDS level-name
  "templateWorldPath": "./worlds/template",
  "scenesWorldPath":   "./worlds/scenes"
}
```

| Field | Purpose |
|---|---|
| `protocolVersion` | The key in bedrock-protocol's `Versions` map (in `node_modules/bedrock-protocol/src/options.js`). For Minecraft client `1.26.13.1`, the closest supported is `1.26.10` (protocol 944). |
| `bdsVersion` | The BDS server release to download/launch. May differ from the client version (e.g. client `1.26.13.1` paired with BDS `1.26.14.1`). |
| `worldName` | `level-name=` in `server.properties`. Also the dir name under `worlds/`. |
| `templateWorldPath` | If this path exists, `launchBds()` copies it into BDS's `worlds/<worldName>/` before launch. Use with `bdt snapshot-world` for deterministic recordings. |
| `scenesWorldPath` | Reserved for the build-once scenes world (currently informational). |

## `relay`

```jsonc
"relay": {
  "host":           "0.0.0.0",
  "port":           19150,
  "username":       "YOUR_GAMERTAG",
  "profilesFolder": "./profiles"
}
```

| Field | Purpose |
|---|---|
| `host` | Relay listen address. `0.0.0.0` accepts any interface. |
| `port` | Relay listen port. The client connects here; the relay forwards to BDS at `127.0.0.1:19190`. |
| `username` | The username the relay presents to BDS. **Not** the player's Microsoft login name — that's set by the client. (The BDS log shows both: "Player connected: <login>", "Player Spawned: <relay-username>".) |
| `profilesFolder` | bedrock-protocol stashes a per-username profile (skin, identity) here. |

`${PLAYER}` substitution in fixtures resolves to `@s` (the executor of the
command), **not** `relay.username`. Recordings stay portable across logins.

## `bdsPaths`

```jsonc
"bdsPaths": {
  "base": "./bds"
}
```

| Field | Purpose |
|---|---|
| `base` | BDS install root. Final path is `{base}/bds-{bdsVersion}/`. `minecraft-bedrock-server` auto-downloads here on first run. |

## Loading order

```
bdt record --config <p>      → use that file
bdt record (no --config)     → walk up from cwd for bdt.config.json
                              → error if not found (with a hint to run `bdt config init`)
```

The example file is loaded only by `bdt config init` (which copies it to
`./bdt.config.json`). It's not a fallback at runtime.

## Verifying

```pwsh
bdt config show
# Prints the discovered path and the merged-with-defaults JSON.
```

`bdt record` also calls `assertSupported(version, versionConfig)` at startup
which probes bedrock-protocol's `Versions` map and fails loudly if your
`protocolVersion` isn't listed.
