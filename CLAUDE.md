# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bitfocus Companion module for the BrightLink BL-8X8-HDBT-HD20 HDMI/HDBaseT matrix. See [README.md](./README.md) for the feature list and [companion/HELP.md](./companion/HELP.md) for the user-facing action/feedback/variable reference.

## Commands

Package manager is **yarn 4** (`packageManager` in package.json, `nodeLinker: node-modules`). A stray `package-lock.json` exists from an npm run — do not use npm here.

```bash
yarn install
yarn package                      # esbuild bundle -> pkg/ and <name>-<version>.tgz, for sideloading into Companion
yarn lint                         # eslint + prettier (tabs, single quotes, no semicolons, printWidth 120)
yarn lint:raw --fix .             # autofix
yarn companion-module-check       # validates companion/manifest.json against the base schema
```

There is **no test suite** — `yarn test` is a placeholder that exits 1. Verify changes against a real matrix, or against the emulator in [BLMatrixServer](https://github.com/ntbutler87/BLMatrixServer), which implements the documented API.

`yarn package` ships only `LICENSE`, `main.js`, `package.json` and `companion/`. `docs/` is **not** packaged, so links in HELP.md must be absolute URLs or they break in Companion's help pane.

## module-api 2.x

This module targets `@companion-module/base` 2.x. Most Companion modules and the official JS template online are still 1.x, so **do not copy entrypoint or definition patterns from other modules without checking the version**. The differences that matter here:

| 1.x | 2.x (what this repo uses) |
|---|---|
| `runEntrypoint(Class, scripts)` | `export default Class` + `export const UpgradeScripts` — Companion imports the entrypoint and reads those two names |
| `setVariableDefinitions([{ variableId, name }])` | object keyed by variable id: `{ [id]: { name } }` |
| `setPresetDefinitions(presets)`, preset `category` | `setPresetDefinitions(structure, presets)` — sections are a separate array of `{ id, name, definitions: [presetId] }` |
| preset `type: 'button'` | `type: 'simple'` |
| bare `checkFeedbacks()` checks all | `checkAllFeedbacks()`; `checkFeedbacks(...ids)` for specific ones |
| `await context.parseVariablesInString(v)` | Companion resolves variables and expressions **before** the callback; option values arrive as plain numbers/strings |
| upgrade script options are raw values | options are wrapped `{ value, isExpression }` |

`upgrade.js` is an **index-stable array**: Companion records how far each install has been upgraded. Never delete or reorder entries — replace obsolete ones with `EmptyUpgradeScript` (slots 0 and 1 are already no-ops left from the generic-http fork this module started as).

## Architecture

`index.js` holds the instance class and the poll loop; everything else is a pure builder that takes the instance (`self`) and returns definitions.

**Device constraints drive the whole design.** The matrix never pushes changes and never acknowledges a command (`POST /video.set` returns empty 200 regardless). So: `initPolling()` runs `pollMatrixStatus()` on a timer, and `sendCommands()` re-polls immediately after every write. `device.js` isolates the two HTTP calls; note the `all_dat.get` cache-buster concatenates onto the path with **no `?`**.

**`matrix.js` is the parser** for the 160-segment `all_dat.get` response, written against [docs/API_SPEC.md](./docs/API_SPEC.md) (vendored from BLMatrixServer; fix it upstream and re-copy rather than editing the two apart). `statusSchema` is a template — `createStatus()` `structuredClone`s it, because one Companion install can hold several instances that must not share port state.

**Definitions are rebuilt from live device state.** Dropdown choices and preset labels use the port and scene names read off the matrix, which is why `fields.js`, `actions.js`, `feedbacks.js` and `presets.js` all take `self`. `applyStatus()` compares `labelsFingerprint()` against the previous poll and calls the full `updateDefinitions()` only when a name changed; otherwise it just pushes new variable values. Adding anything that embeds a device-supplied label means it must be covered by that fingerprint.

## Hardware gotchas these files encode

Getting these wrong produces a panel that reports nothing connected while pictures are on screen. §4 of the API spec has the captured evidence.

- **`VO:` is the only routing field.** HDMI output N and HDBT output N are **one logical output** and always switch together, but have separate names, EDIDs and hot-plug state. `parseSwitchBlock` writes routing to both halves.
- **Inputs: use `sig`, never `pw5v`.** `pw5v` reads 1 on every port on this hardware, including empty ones.
- **Outputs: use `hpd` OR'd with the `oed_*` EDID readback, never `sig`.** Output `sig` is 0 on ports that are driving a display. `hasDisplay()` in matrix.js implements the test; `outputHasDisplay()` ORs the two halves for per-output indicators.
- Within segments 0–47 the index means different things per field — `VO:`/`AO:` are output-indexed, `E:`/`AI:` are input-indexed — so the parser matches by regex key, not position.
- Status blocks 136–159 are positional: only port 1 of each block carries its label.
- Port names may contain spaces, are capped at 12 characters, and cannot contain `;`, `:` or `#` (response and command delimiters, with no escaping). `sanitisePortName` in actions.js enforces this.

## Repo state

`git remote origin` still points at `bitfocus/companion-module-generic-http`, the module this was forked from. The repository URL declared in package.json and the manifest (`bitfocus/companion-module-brightlink-bl_8x8_hdbt_hd20`) does not exist yet — it is the intended destination, not a live remote.
