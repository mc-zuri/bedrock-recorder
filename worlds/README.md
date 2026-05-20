# Bundled world templates

Pre-built BDS world directories used as starting state for recordings.
The BDS launcher copies the directory pointed to by
`versionConfig.templateWorldPath` into BDS's `worlds/<worldName>/` before
each run, so every recording starts from a deterministic, fixed world.

## `beta_flat_1.26.0/`

A flat world for Minecraft Bedrock client `1.26.13.1`. Beta-API
experiments are enabled — required for setup commands that use
`scriptevent test:equip_enchanted …` (Soul Speed boots, etc.).

The `.mcworld` archive sibling (`beta_flat_1.26.0.mcworld`) is the same
world packaged for direct import into a Minecraft client (drag-and-drop
in the *Worlds* tab). The extracted directory form is what BDS loads.

## Adding your own template

1. Build the world in Minecraft (or copy from `<bdsBase>/bds-<ver>/worlds/<name>/`).
2. Drop the directory under `worlds/<your_name>/`.
3. Point your `bdt.config.json` at it:
   ```jsonc
   "templateWorldPath": "./worlds/your_name",
   "worldName": "your_name"
   ```
4. Re-run `bdt record …` — the launcher will copy your dir into BDS's
   worlds/ on every run.

If you want to seed the template by recording a setup fixture (e.g.
`shared_world_setup`), use `bdt snapshot-world` after the recording to
copy the resulting BDS world back here.
