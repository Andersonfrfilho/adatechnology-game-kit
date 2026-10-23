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

Before any page script runs, the recorder installs the seeded environment: `Math.random` is seeded, `Date.now` and `performance.now`
are frozen and only move through `advance`, and `requestAnimationFrame` is queued and only runs when the capture calls
`GoldenTool.stepFrames(count, frameMs)`. 
**Not frozen** (a capture must not depend on them, or the golden will not repeat): `new Date()` without arguments, `setTimeout` /
`setInterval` timers, `crypto.getRandomValues` / `crypto.randomUUID`, `requestIdleCallback`, and anything the network or the GPU decides
(the recorder refuses external requests, but a page that reacts to a failed one still differs). `Math.random`, `Date.now`,
`performance.now` and `requestAnimationFrame` are the ones the recorder controls.

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

## Tests

`pnpm --filter @adatechnology/golden-tool test` covers the seeded PRNG, the determinism installer, the scene hash (stable across runs,
changes with a vertex, a color, a transform or a name) and the event recorder and diff.
