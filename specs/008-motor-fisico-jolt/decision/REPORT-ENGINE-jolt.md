# Spike: Jolt Physics as the kit's single rigid-body engine

## Verdict

**Jolt is the stronger engine for everything except the debris case the spike started from, and it does not yet pass that one.**

- **Strong:** vehicles, crowd, chain reaction, queries, determinism, save/load and bundle size are all good, several clearly better than Rapier (spike B) or our own code. Rays are 5.7× faster than our current ray path. Simulation results were bit-identical in Node, Chromium and Bun (Bun runs JavaScriptCore, the engine inside Safari).
- **Debris, room:** with the final settings Jolt is far better than the baseline and close to spike A and B (table below).
- **Debris, bowl:** C1–C3 nearly pass, but **C6 fails**. In 8–16 of 64 seeds at dt 0.05, a 4 cm plate pinned under the 142 kg sheet gets pushed through the ground and falls forever. The ground is a one-sided triangle mesh with nothing solid underneath, and the 18:1 mass ratio crushes the plate through it. More solver iterations, 240 Hz stepping or a cap on push-out reduce it but never remove it. A counted "fell through" net catches it, but its re-lift breaks C1–C3.
- **Fix to try next:** a solid ground (convex prisms per cell, or a thick heightfield). This is the open item before Jolt can carry debris.

## Dependency and build

- **Package:** `jolt-physics@1.1.1`, published by jrouwe (author of Jolt), repo github.com/jrouwe/JoltPhysics.js, MIT.
  - 588 stars, 2 open issues, last push 2026-10-29.
  - Releases every 2–6 weeks in 2024–25; 1.0.0 on 2025-12-28, then 1.0.1 and 1.1.0 (July 2026) and 1.1.1 (2026-10-23).
  - Issues get closed within days. One maintainer for the JS bindings.
- **Variant chosen:** `wasm-compat`, single-threaded, with the wasm inlined in the JS file.
  - It is the only variant that loads in node, vitest and the single-file room without loader setup.
  - The multithread build needs SharedArrayBuffer (COOP/COEP headers on every host), and the repo says it doesn't work in Safari or with JS callbacks. Our per-contact friction rule is a JS callback.
  - Bundlers need `external: ['node:module']` for it.
- **Determinism flag:** the npm build is *not* compiled with `CROSS_PLATFORM_DETERMINISTIC`. Issue #301 (closed 2026-10-29) found that a build with the flag aborted at startup, and the fix is not released yet. Results were identical anyway, because all three runtimes run the same wasm binary (details under Measurements).

## What was built

- **`packages/game-physics`** — the engine-agnostic contract (types only, plus one helper).
  - Shapes: box, sphere, capsule, cylinder, convex, triangle mesh, heightfield, and compound shapes whose children carry our part id.
  - Collision layers, a pair table and ragdoll groups.
  - Joints: fixed, hinge and swing-twist, each with a break impulse.
  - A raycast vehicle.
  - Queries: all hits along a ray, first hit, sphere overlap, sphere cast, filtered by layer.
  - Contact events in a reused struct-of-arrays (no allocation per contact), with an impulse estimate per contact.
  - Sensors, per-body contact points, ignored pairs, dynamic↔kinematic switching, a fixed-step `step(dt)`, and memory/dispose.
- **`packages/game-physics-jolt`** — the adapter. It frees every Jolt object it creates (CLAUDE.md §8). Behaviour that differs from Jolt's defaults:
  - **Static/dynamic friction kept (§12):** Jolt has one friction coefficient per body. A per-contact callback sets the static coefficient while the contact point slips under 2 cm/s and the dynamic one above that.
  - **Restitution** is mixed by geometric mean, as the kit always has (Jolt's default takes the larger).
  - **Extras outside the contract:** a character controller, save/restore of physics state.
- **`game-destruction-three`** — `PieceSystem` now steps through the contract (`engine-pieces.ts`, `engine-ground.ts`).
  - **No solver switch mid-game:** the host awaits the wasm before creating the renderer, and the room boot does the same. `?solver=own` (room) or `PIECE_SOLVER=own` (tests) runs the baseline in the same build.
  - **Ground:** built from `groundAt` as triangles that keep hard steps — no 10 cm ramp. Cells are 5 cm, cut down to 1.25 cm where a step crosses them; vertical faces join cells, and tiles, at different levels. Unit-tested.
  - **Statics:** each drawn mesh's own box, turned as drawn (not axis-aligned boxes), rebuilt only when an object's boxes actually change.
  - **Kit rules kept on top:** deep overlaps slide apart along the ground, wall sweep, hard landing, rolling resistance, knock sounds from contact events, the narrow-support topple rule (from the engine's contact points), the `maxAwake` budget with rest points, a re-check of the ground under sleeping pieces, and the "fell through" net.

## Measurements

### Case 1 — debris

**Bowl, energy criteria C1–C4 (DECISION-fable §2), 64 seeds:**

| | dt 0.05: seeds failing | dt 1/60: seeds failing |
|---|---|---|
| baseline (own solver) | 45 | 37 |
| Jolt, 10 iterations | 16 — all of them fell through the ground | 26 |
| Jolt, 20 iterations | 13 (8 fell through) | 22 (10 fell through) |
| Jolt, 240 Hz | 8 (net fired) | 14 of 56 (run cut short) |

- Where nothing falls through, Jolt is clean: largest energy gain (C2) 3.2 cm, largest lift (C3) 3.3 cm at dt 0.05. Baseline: 25 cm and 39 cm.
- **C6 (all 64 seeds × both dt):** fails, for the reason above.
- **C8 (determinism):** passes — same seed gives the same hash across separate processes.
- Raw data: `jolt-bowl-64-*.jsonl` in the escalation folder.

**Room (spike A's `blast.js` / `hammer.js` probes, swiftshader software GL, same build):**

| | blast max lift | blast pieces lifted > 3.5 cm | blast asleep at end | hammer max lift | hammer rise above spawn | hammer asleep at end |
|---|---|---|---|---|---|---|
| baseline | 0.30 / 0.33 / 0.60 | 10–13 | 36/36 | 0.06–0.17 | ≤ 0.07 | 37/37 |
| Jolt default | 0.30–0.45 | 2–9 | 26–35 | 0.07–0.26 | 0.27–0.46 | 32–37 |
| **Jolt final** (20 iterations, push-out ≤ 2 mm per iteration) | **0.044 / 0.048 / 0.087** | **1–6** | 25–35 | **0.034–0.037** | **0.05–0.06** | 32–36 |

For reference: spike A had blast 0.023–0.083 and hammer 0.014–0.033 max lift; spike B had blast 0.047–0.079, and on the hammer 0.13–0.59 max lift with 0.30–0.84 m rise.

**Package tests (`game-destruction-three`, 347 tests):** baseline passes all; Jolt passes 331 and fails 15.
- **7 — unphysical setups:** the test lays a board on one end, marks it asleep and uses it as a fixed ramp. An engine lets it fall. Coulomb itself was checked separately on a real static slope: μ 0.4 on 25° slides 0.42 m in 1 s (0.47 expected), μ 0.5 holds.
- **4 — can-collision tolerances:** written for our own impulse code (restitution 0.78 vs 0.82, 0.6 mm sink from Jolt's penetration slop).
- **2 — top that exists only as a function:** the support is a `staticTopAt` answer, not a drawn mesh; an engine cannot make a collider from a height function.
- **1 — timeout:** the lone-leg test is slower on the engine path.
- **1 — wake-region:** "a sleeping piece falls to the new ground by itself" failed in the full-suite run; the later ground re-check made it pass when re-run in its own file.

**Cost (160 resting + 40 moving pieces, `renderer.update`):**
- Baseline: 0.82–0.91 ms median.
- Jolt with 10 iterations: 1.13–1.17 ms (1.4×).
- Jolt final settings: 1.5–2.1 ms (about 1.8×), measured while the browser probes were running in parallel, so somewhat inflated.
- p90 is about 5 ms: ground tiles built the first time a piece flies onto them. In production the ground should come from the terrain mesh, with in-place height updates, instead of sampling `groundAt`.

### Case 2 — ragdoll (17 segments, `describeBody(createRig(GUIDE))`)

- **Drop:** dropped from 2 m onto stairs plus a box, then hit by a 9 mm shot (2.74 N·s). Nothing exploded, all segments asleep at 2.5–3.2 s.
- **Joint limits:** the ankle overshoots its 0.5 rad cone by up to 0.9 rad for 17 frames at the landing, then comes back. More iterations reduce this but do not remove it. Jolt's own ragdoll stabilizer (`RagdollSettings.Stabilize`) was not tried.
- **Cost:** 20 ragdolls cost 2.8 ms median, 3.3 ms p90; all asleep at 8.1 s.

### Case 3 — vehicle (`compact_hatch`, 1 034 kg, real dimensions, Jolt's wheeled vehicle)

| test | result |
|---|---|
| 60 km/h into a 30 cm curb | bumper hits the curb, car bounces back, max roll 19°, asleep at 7 s |
| 60 km/h up a one-sided ramp | rolls over and rests on its side at 3.7 s |
| 10 cars driving | 0.15–0.25 ms median |

- A car that is spawned already moving needs its wheels spun to match and a gear set, or it skids or engine-brakes to a stop.
- A car stays awake while a wheel in the air still turns, so the kit has to put it to sleep by its own rule.
- **Mapping from game-vehicles-driving:** its controls become `SetDriverInput`; its tuning becomes wheel friction curves, a torque curve and gear ratios; the chassis is an ordinary body, and damage zones stay ours as tagged compound children.

### Case 4 — crowd

- **Agents:** 300 / 1 000 kinematic agents moved every frame cost 0.11 / 0.29 ms per step. A door on a breakable hinge gives way at 2.3 s.
- **100 bodies piled against a wall:**

| | bodies | ms per step | asleep |
|---|---|---|---|
| full ragdolls | 1 700 | 23 | never, within 10 s |
| cheap chains (torso + head + legs) | 300 | 3 | at 8.3 s |

- **LOD:** swapping all 100 to single capsules takes 2.6–4.5 ms (one frame).
- **Filters:** layer pair table, broadphase layers and group filters were all exercised.

### Case 5 — chain reaction

- The gas cylinder goes off at 1.38 s, triggered from the contact events (impulse > 150 N·s), and wakes 318 bodies in one frame.
- **Step time after the cascade:** median 0.57 ms, p90 4.4 ms, p99 7.6 ms, max 14.4 ms.
- **Contact events:** up to 84 per step, each with point, normal, closing speed, both user values, both part tags and an impulse estimate. Jolt does not hand back the solved impulse when a contact is added, so the impulse is estimated.
- **Allocation:** JS heap grew +136 B over 570 steps (no per-frame allocations); the wasm heap grew +312 KB and stayed stable.
- **Determinism:** same result in-process and across processes.

### Case 6 — ballistics and queries (3 houses, 10 cars, 300 moving agents)

| query | Jolt | our current `DestructionWorld.raycast` |
|---|---|---|
| 1 000 first-hit rays | **1.6 ms** | 9.1 ms |
| 1 000 all-hits rays, sorted, with user value + part tag | 2.2 ms | — (no multi-hit query) |
| one blast: 300 fragment rays + sphere overlap + line-of-sight rays | 0.4 ms | — |
| 200 sphere casts (1 cm) | 1.3 ms | — |

- A ray along the crowd's front row returns all 30 agents, nearest first.
- Queries find sleeping bodies, kinematic bodies moved this frame, and a body created this frame before any step.
- A smoke sensor reported 13 enter and 13 leave events as the crowd walked through.
- The engine is only the broad phase; the final hit stays on our drawn surface (`surfaceRay`, CLAUDE.md §7).

### Case 7 — small demos

| demo | result |
|---|---|
| character controller | climbs 18 cm stairs and a 30° ramp, pushes a 30 kg crate; 50 controllers cost 0.14 ms |
| pick up / throw | works |
| grenade | bounces twice, then **rolls 30 m and never rests**: Jolt has no rolling resistance |
| 200 shell casings with continuous collision | none under the floor; none asleep after 5 s (same rolling-resistance gap) |
| 2 000 static colliders | added in 7–10 ms, removed in 0.9 ms, 288 B each |
| 5 km from origin | behaves the same as at the origin |
| save → run → load → run | bit-identical |

### Bundle, init, memory

- **Bundle:** Jolt plus adapter is 959 KB gzipped (the room grows by about the same; spike B's Rapier added 1.67 MB).
- **Init:** asynchronous, about 25 ms import + 62 ms instantiate in Node.
- **Memory:** the npm build has a **fixed 128 MB wasm heap** (no growth). A world costs about 18 MB, so about 6 fit, and the kit must share **one world** per game. 30 create/dispose cycles returned to the same byte count.

### Determinism (C8, cross-runtime)

A 300-body pile hashes to the same value in Node 24, Chromium 145 and Bun 1.3. The bowl and cascade hashes are identical across separate processes. Not checked: ARM, Firefox.

## Our rules: kept, changed, lost

- **Kept:** mass and inertia (including round pieces' own k), static/dynamic Coulomb, colliders from drawn parts (no invisible collider), what falls when its support goes, topple of a narrow support, deep overlaps sliding apart, wall sweep, hard landing, knock sound, rolling resistance, sleep budget, crater/`groundAt` (as geometry), the 160-fragment cap.
- **Changed:**
  - A sleeping piece is no longer a fixed support.
  - The `tip` push is no longer needed (pieces stand on their drawn parts).
  - Tops must be drawn meshes, not `staticTopAt` answers.
  - The ground is geometry.
- **Lost / ours to add:** the bowl tunnelling (open); rolling resistance and sleep for every round body and for vehicles.

## Effort and risk to production (whole kit)

**Estimate: 5–7 engineer-weeks.**

| work | time |
|---|---|
| solid ground built from terrain mesh/heightfield (fixes the tunnelling) | 1–1.5 wk |
| debris rules, tests and goldens ported | 1.5 wk |
| ragdolls through Jolt's ragdoll API plus LOD | 1 wk |
| vehicles mapped from the arcade model | 1 wk |
| crowd and query integration | 0.5–1 wk |
| one shared world, memory budget, worker option | 0.5 wk |
| room validation, plus the nightly GPU suite once integrated | 1 wk |

**Main risks:**
1. Thin heavy-loaded bodies tunnel through one-sided ground.
2. The fixed 128 MB heap.
3. The multithread build is unusable with our JS contact callbacks.
4. One maintainer for the JS bindings.
5. No published cross-platform-deterministic build (measured identical anyway).
6. The per-contact JS friction callback (its cost is already inside the step times above).

## Not verified

- AMD or weak CPUs (no AMD here; all costs are CPU-side).
- Firefox, ARM.
- `game-floorplan-three` goldens, `perf.mjs` and `leak.mjs` with Jolt.
- Jolt's ragdoll and heightfield update paths.
- Room runs are swiftshader, 3 runs each, and not deterministic.

---

Key files (repo: `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt`):
- `packages/game-physics/src/index.ts`
- `packages/game-physics-jolt/src/index.ts`
- `packages/game-physics-jolt/tests/` — ragdoll, vehicle, crowd, cascade, queries, extras
- `packages/game-destruction-three/src/engine-pieces.ts`
- `packages/game-destruction-three/src/engine-ground.ts`
- `packages/game-destruction-three/tests/bowl-energy.ts`
- `examples/test-room/build.mjs` (Jolt boot)

Raw results are in `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad/item6-escalation/`:
- bowl: `jolt-bowl-64-*.jsonl`, `own-bowl-64.jsonl`
- room probes: `J-probes/*.out`
- bench: `bench.jsonl`
- test logs: `jolt-pkg-tests-final.log`, `own-pkg-tests.log`

The cross-runtime determinism probe is in `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad/jolt-det/`.