set shell := ["cmd", "/c"]

# ── Path configuration ─────────────────────────────────────────────────
# All paths below can be overridden by setting environment variables
# before invoking `just`. See README → "External tool layout" for what
# each one is and where to clone the upstream repos.
#
#   set BDT_DUMPS_ROOT=D:/elsewhere/dumps    && just record
#   set BDT_MFPU_REPO=D:/path/to/repo         && just fixtures

# Where recordings land. Per-version dumps go into BDT_DUMPS_ROOT/<version>/.
dumpRoot := env_var_or_default("BDT_DUMPS_ROOT", justfile_directory() + "/dumps")

# The consumer repo that hosts the generated .test.js + per-scenario YAMLs.
# Currently mineflayer-physics-utils (see README "Related projects").
mfpu     := env_var_or_default("BDT_MFPU_REPO",
                               justfile_directory() + "/../mineflayer-physics-utils")

# External tools the extract/report pipeline shells out to.
v2Rec    := env_var_or_default("BDT_V2_RECORDER",
                               justfile_directory() + "/../bedrock-tools-v2/packages/recorder")
analyzeBin := env_var_or_default("BDT_ANALYZE_BIN",
                                 justfile_directory() + "/../bedrock-oracle/tools/analyze-bin")
mergeJs  := env_var_or_default("BDT_MERGE_WORLDS",
                               justfile_directory() + "/../tools/merge-worlds/merge-worlds.js")

# ── Derived paths (don't override these directly; change mfpu) ─────────
version  := "1.26.13.1"
proto    := "1.26.0"
scen     := mfpu + "/tests/unit/bedrock/scenarios"
worlds   := mfpu + "/tests/fixtures/bedrock/worlds"
world    := mfpu + "/tests/fixtures/bedrock/world.json"

default:
    @just --list

# Drive the v2_all fixture against a live Minecraft client. You launch
# the client manually and connect to 127.0.0.1:19150 when the Relay opens.
# Produces <dumpDir>/<version>-v2_all.proxy.bin.
record version=version dumpDir=(dumpRoot / version):
    cd /d {{justfile_directory()}} && node packages/cli/dist/cli.js record --fixture v2_all --client {{version}} --out {{dumpDir}}

# Turn the recorded .proxy.bin into mocha .test.js + world.json +
# per-scenario YAMLs inside the consumer repo (default: mineflayer-physics-utils).
fixtures version=version dumpDir=(dumpRoot / version):
    cd /d {{v2Rec}} && npx tsx scripts/extract-physics-fixtures.ts {{dumpDir}}/{{version}}-v2_all.proxy.bin {{scen}} {{proto}} --harness ../../../helpers/bedrock/scenarioHarness --no-inputs
    if exist "{{worlds}}" rmdir /s /q "{{worlds}}"
    cd /d {{analyzeBin}} && npx tsx src/main.ts {{dumpDir}}/{{version}}-v2_all.proxy.bin {{worlds}}
    node {{mergeJs}} {{worlds}} {{world}}
    cd /d {{justfile_directory()}}/packages/scenarios && npx tsx scripts/dump-scenarios-yaml.ts --fixture v2_all --out {{scen}}
