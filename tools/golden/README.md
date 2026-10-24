# @adatechnology/golden-tool

"Same as the original" for the migration of the team deliveries (spec 001, decision G3). It records what a team page does under a
seeded, frozen environment and lets a package test compare its SDK build against that recording, without a browser.

A golden holds, for one page and one seed:

- **events**: a sequence of `{ type, data }` entries (shot, reload, break, a crash scenario...), numbers rounded to 4 decimals;
- **scenes**: for each named three.js root, an object count, a hash and the lines the hash was computed from. A line is one node:
  type, name, visibility, local position / quaternion / scale, geometry type, vertex count, a hash of the positions and their bounding
  box, material type, color and opacity. Uuids are never read. Numbers are rounded (4 decimals by default).

The same code (`createGoldenRecord`) runs on both sides, so the two records are built by the same function and any difference is real.

## Where each side runs

| Side | Where | Why |
|---|---|---|
| Page (records the golden) | headless Chrome over CDP (`bin/record.mjs`) | The pages need real three.js, `window` globals and script order; happy-dom has no WebGL or canvas |
| SDK (compares) | vitest in Node, no browser | CI stays browserless; the golden is a JSON file committed next to the package test |

Recording is a manual step (run again only when the page or the capture changes); the JSON is the fixture.

## Record a golden from a page

```bash
pnpm build                      # the recorder injects dist/index.global.js into the page
node tools/golden/bin/record.mjs \
  --page specs/001-migracao-entregas-dos-times/artefatos/Xy9QydZTRyAfwxRMjzh1aT.html \
  --capture tools/golden/captures/vehicle-garage.js \
  --out packages/game-vehicles-fleet/tests/fixtures/team-golden/garage-hatch.json \
  --seed 1 --param key=hatch --param gameOnlyFlags=frontBlood \
  --three node_modules/.pnpm/three@0.128.0/node_modules/three/build/three.min.js \
  --ready "window.VehicleSDK && VehicleSDK.FLEET.length > 60"
```

| Flag | Meaning |
|---|---|
| `--page` | an artifact page (`artefatos/*.html`; its same-name folder is served as its assets) or any HTML file |
| `--capture` | a JS expression file evaluated after the page is ready; it must return a `GoldenRecord` (use `GoldenTool.createGoldenRecord`) |
| `--out` | where the golden JSON is written |
| `--seed` | integer seed for `Math.random` (default 1); also available to the capture as `__GOLDEN_PARAMS.seed` |
| `--param k=v` | extra values for the capture, read from `globalThis.__GOLDEN_PARAMS` |
| `--ready` | expression that becomes truthy when the page has built what the capture needs |
| `--three` | local three.js file served in place of the CDN URL; every other external request is refused, so recording is offline |
| `--addon` | a three.js `examples/js` script (OrbitControls, RoundedBoxGeometry...) served in place of its jsDelivr URL; repeat for each one the page loads |
| `--expose a,b,c` | for a page that keeps its functions inside an IIFE: the recorder adds, at the end of the page's last inline IIFE, accessors on `globalThis.GoldenExposed` (the getter reads the binding, the setter writes it, so a capture can also swap a `let`, for example the page's seeded random). A `const` can be read but not assigned. Use it in the `--ready` expression too (`GoldenExposed.sobrado`) |

Before any page script runs, the recorder installs the seeded environment: `Math.random` is seeded, `Date.now` and `performance.now`
are frozen and only move through `advance`, and `requestAnimationFrame` is queued and only runs when the capture calls
`GoldenTool.stepFrames(count, frameMs)`. 
**Not frozen** (a capture must not depend on them, or the golden will not repeat): `new Date()` without arguments, `setTimeout` /
`setInterval` timers, `crypto.getRandomValues` / `crypto.randomUUID`, `requestIdleCallback`, and anything the network or the GPU decides
(the recorder refuses external requests, but a page that reacts to a failed one still differs). `Math.random`, `Date.now`,
`performance.now` and `requestAnimationFrame` are the ones the recorder controls.

Captures for the houses (spec 001, T2.2a), with where their goldens go:

| Capture | Page | Golden |
|---|---|---|
| `floorplan-plans.js` | Visor de casas 3D (`PlantasSDK.gerar`, every template x seeds 1-25 x 3 states; one event per plan with a hash per list) | `packages/game-floorplan-post-apocalyptic/tests/fixtures/team-golden/vc3-plans.json` (+ `vc3-plans-detail.json`, the readable rows of seed 1); it lives with the stack test because the engine package cannot depend on its content packs |
| `floorplan-structure.js` | same (`estrutura`, `Casa3DSDK.specDe` coarse and `vedacao`, utilities) | `specs/001-migracao-entregas-dos-times/goldens/vc3-structure.json` (+ detail), staged until `game-floorplan-structure` exists |
| `house-area.js` | Sala de testes, area "Casas e prédios" (the 6 scenarios on the page's destruction world, every world event) | `specs/.../goldens/house-area.json`, staged until the destruction work (T2.3b) consumes it |
| `gallery-silhouettes.js` | Galeria do Vale Cinzento, with `--expose` (house and building silhouettes, scene hash) | `specs/.../goldens/gallery-silhouettes.json`, staged for `game-floorplan-three` (T2.5a) |

Capture for the items (spec 001, T3.2b):

| Capture | Page | Golden |
|---|---|---|
| `items-showcase.js` | Itens do Vale Cinzento (`artefatos/NKmkGZ2Lvcd96mp6Nyksds.html`): the 24 builders of `MODELS` hashed as they return (before the page's 1.55 normalisation) and the materials of each at the three wear stages | `packages/game-items-three/tests/fixtures/team-golden/items-showcase.json` |

```bash
CHROME_BIN=<chrome> node tools/golden/bin/record.mjs --page specs/001-migracao-entregas-dos-times/artefatos/NKmkGZ2Lvcd96mp6Nyksds.html \
  --capture tools/golden/captures/items-showcase.js --out packages/game-items-three/tests/fixtures/team-golden/items-showcase.json --seed 1 \
  --three node_modules/.pnpm/three@0.128.0/node_modules/three/build/three.min.js --ready "window.THREE"
```

`specs/001-migracao-entregas-dos-times/goldens/README.md` has the exact command of each one. `GoldenTool.hashText` (FNV-1a) is what a capture and a package test use to put a
whole list in one event value.

A capture file may use `GoldenTool.createEventRecorder()` to log events and
`GoldenTool.createGoldenRecord({ name, seed, events, scenes })` to return the result.

## Compare an SDK build in a package test

Add `"@adatechnology/golden-tool": "workspace:*"` to the package `devDependencies`, then:

```ts
import { assertMatchesGolden, createEventRecorder, createGoldenRecord, withDeterminism } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import golden from './fixtures/team-golden/garage-hatch.json'

const sdk = withDeterminism({ seed: (golden as GoldenRecord).seed }, () => {
  const recorder = createEventRecorder()
  recorder.record('scenario', { id: 'front_crash' /* same data the capture records */ })
  return createGoldenRecord({ name: 'garage-hatch', seed: 1, events: recorder.events(), scenes: { intact: buildRoot() } })
})
assertMatchesGolden(golden as GoldenRecord, sdk) // throws with the first differing events and nodes
```

`diffGolden(expected, actual)` returns the same messages as an array, for `expect(...).toEqual([])`. A real example, with the page
capture beside it: `packages/game-vehicles-fleet/tests/team-golden.test.ts` and `captures/vehicle-garage.js`.

Keep the capture and the SDK test symmetric: the same states, the same events, the same seed. Content that only the game adds
(for example blood) is left out of the page capture with `--param`, as `gameOnlyFlags` does, because it lives in the game repository.

## Hashes must not depend on the Node version

A hash that passes on Node 22 and fails on Node 24 is a bug in the golden, not in the SDK. What changed between them is the last bit of
`Math.pow` and `**` (V8 12 -> 13); `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `exp`, `log`, `sqrt` and `cbrt` are the same on both.
three.js centripetal curves call `pow`, and a closed `TubeGeometry` on a nearly straight path turns that bit into a twist of the ring (up to
8e-4 on a 9 mm tube in `midsize_sedan`), so rounding to 3 or 4 decimals cannot absorb it: a rounded hash flips whenever a value sits near a boundary.

- `installDeterminism` / `withDeterminism` also install `portablePow` (only `+ - * /`, `exp` and `log`, which agree on both versions), and a test
  that does not use them calls `installPortableMath()` in its setup file (the fleet does, in `tests/setup.ts`). The recorder installs it in the page
  too, so a page recording and an SDK build compute the same bits.
- Never use `**` with a fractional exponent in code that feeds a golden; it cannot be replaced.
- `tests/portable-math.test.ts` fingerprints `portablePow` and every native `Math` function the goldens rely on. If it fails on a new Node,
  that Node changed a function: install a portable version of it the same way, then re-record and regenerate once, checking both Node 22 and the new one.
- Before committing a regenerated fixture, run its tests on two Node versions (CI runs the goldens on 22 and 24). Keep a 1 mm test: a
  vertex or a transform moved by 0.001 must still change the hash (`scene-hash.test.ts`, `game-vehicles-fleet/tests/digest.test.ts`).

## Tests

`pnpm --filter @adatechnology/golden-tool test` covers the seeded PRNG, the determinism installer, the scene hash (stable across runs,
changes with a vertex, a color, a transform or a name) and the event recorder and diff.

## Audio traces (spec 001, Phase 6)

Sound is compared by what the code asks WebAudio to do, not by the audio: `createAudioRecorder()` is a fake `AudioContext` that logs every node
created, every property and parameter set (`setValueAtTime`, ramps, `.value =`), every connection, start and stop, and summarises each buffer as an
FNV-1a checksum per channel. Numbers are rounded to 10 decimals; `diffAudioTrace(expected, actual, { tolerance })` (default 1e-9) lists what differs and
`assertAudioTraceMatches` throws with it. `recorder.AudioContext` is what a page reads as `window.AudioContext`; `currentTime` starts at 0 so every
logged time is relative to the call (`setTime` moves it), and `clearEntries()` drops the setup so a trace holds only the sound.

The team's own routines are run for real. `@adatechnology/golden-tool/team-audio` cuts them literally from the page text (`cutFunction`,
`cutBetween`; the names `boom`, `AC`... also exist elsewhere in `jogo.js`, so each cut is the one that touches `AC`) and runs them in a Node `vm`
with `Math.random` seeded and `Math.pow` portable (Node 22 and 24 give the same bytes):

```bash
pnpm build && node tools/golden/bin/record-audio.mjs [--seed 1]   # writes tools/golden/fixtures/audio/*.json
```

| Fixture | Source | Cases |
|---|---|---|
| `fixtures/audio/game-audio.json` | `artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js` (`audioInit`, `noise`, `sfx`, `loopSet`, `grito`, `voz`, `bichoSom`, `boom`, `chiado`, `buzina`) | 12 classes at 0/10/60/120/160 m, the four loops at three levels, `grito`, `voz`, the four animal calls, `boom`, `chiado`, `buzina` (111) |
| `fixtures/audio/art-scene-audio.json` | `sources/arte__cena-de-arte.js` L1303-1372 (`initAudio` chain and the 31 `sfx.*`) | the chain, then each sound at three positions (85) |

Each case holds `setup` (run first), `call`, the `seed` and the `trace`; the header holds the SHA-256 of every cut, so a changed source is noticed. A
case runs in its own context with the seed, so the order of random draws is part of the trace: the noise buffer is filled first (one draw per sample),
then the start offsets. An SDK `realize(plan)` must produce the same entries for the same call (Cena cases record after the chain: `clearEntries`).
`cut-source` (`cutLiteral`, `cutDeclaration`, `cutFunction`, `cutBetween`, `cutLines`, `evaluateSlice`) is the same file the other phases use.
