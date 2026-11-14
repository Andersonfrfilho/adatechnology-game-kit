# Decision memo: one physics engine for the kit (Jolt vs Rapier)

I ran nothing new. I recomputed the bowl and room numbers from the raw files and read the adapter code in both worktrees. Cases 2–7 are taken from each report and its raw log, not re-run.

## 1. Decision

**Adopt Jolt (`jolt-physics`, wasm-compat single-thread), conditional on a one-week gate (section 3, B1) before any production work.**

Jolt loses the case that started this (the bowl) and wins or ties most of the rest. What decides it is the kind of blocker each engine has, not the score.

- **Rapier's blockers are missing API in the JS bindings.** Sleep thresholds, limits on multibody joints, joint force read-back and contact modification are not reachable from JavaScript (Rapier report §3). Its own advocate concludes it is viable "only if the kit maintains a fork or patch of the JS bindings". These gaps hit ragdolls, sleep and breakable joints, which a GTA-like kit needs most.
- **Jolt's blockers are geometry and tuning with untried remedies.** Solid ground, the ragdoll stabilizer, rolling resistance in the adapter and heap size are each a bounded experiment.
- **Sleep.** In the bench Jolt has 160/160 resting pieces asleep; Rapier has 32/200. In the room Jolt ends with 25–37 of 36/37 asleep; Rapier 15–32.
- **§12 Coulomb.** Jolt sets static or dynamic friction per contact from slip speed (`packages/game-physics-jolt/src/index.ts:643-649`). Rapier switches one coefficient per piece (`packages/game-destruction-three/src/engine-pieces.ts:416-422`), so a piece sliding on one support and held by another gets one answer for both.
- **Ragdoll.** Jolt settles asleep at 2.5–3.2 s with a transient ankle overshoot. Rapier is erratic: 8 iterations is worse than 4 (drift 162 mm vs 64 mm, 8 m/s after the shot), and 3 of 5 settings rest only after 7 s or never.
- **Room.** Same probe, final settings: Jolt has fewer launches (19–24 vs 42–60) and less rise above spawn (0.04–0.06 m vs 0.13–0.17 m).
- **World streaming.** 2,000 static colliders: Jolt adds in 7–10 ms and removes in 0.9 ms; Rapier 15–27 ms and 28–50 ms.
- **Bundle.** +0.96 MB gzip vs +1.66 MB.

**Where Rapier wins:**
- The bowl, clearly: 3/128 failures against 42/128.
- Cascade p99: about 3 ms at 448 bodies against 7.6 ms at 318.
- Grenade rest, and debris bench p90.

**Correction to the Jolt report.** It says "where nothing falls through, Jolt is clean". That holds only for 10 iterations at dt 0.05. With 20 iterations, runs with no fall-through still fail:
- dt 0.05: C2 up to 4.3 cm, C3 up to 6.9 cm.
- dt 1/60: C2 up to 44 cm, C3 up to 9.1 cm.

So tunnelling is not the only bowl defect, and Jolt is worse at 1/60 than at 0.05. More steps should not be worse; that suggests a stepping or ground-rebuild problem in the seam, which I have not confirmed.

## 2. Side by side

### Bowl, reconciled

Common metric: runs (64 seeds × 2 dt = 128) failing C2, C3, C4 or fall-through. C1 is left out because Rapier's test does not assert it and the two spikes define it differently (Jolt: summed kg·m over all pieces; Rapier: per-group metres).

| Configuration | dt 0.05 | dt 1/60 | Total | Fell through |
|---|---|---|---|---|
| Own solver (Jolt harness, includes C1) | 45/64 | 37/64 | 82/128 | 0 |
| Jolt, 10 iterations (includes C1) | 16/64 | 26/64 | 42/128 | 16 at dt 0.05; not recorded at 1/60 |
| Jolt, 20 iterations (includes C1) | 13/64 | 22/64 | 35/128 | 8 + 10 |
| Jolt, 20 iterations (C2–C4 + fell only) | 12/64 | 18/64 | 30/128 | 8 + 10 |
| Jolt, 240 Hz (includes C1) | 8/64 | 19/64 | 27/128 | run hit `Aborted(OOM)` four times |
| Rapier default (C2–C4) | 0/64 | 3/64 | 3/128 | none (all asleep) |
| Rapier, 8 iterations (C2–C4) | 0/64 | 0/64 | 0/128 | none |
| Rapier, step 1/120 (C2–C4) | 0/64 | 0/64 | 0/128 | none |

- Adding C1 at 1 mm, Rapier fails 10/128 at default, 4/128 at 8 iterations and 1/128 at 1/120. "All 128 pass" is true only without C1.
- Rapier's three default failures are a 141 kg sheet levering a 7 kg plate. That is a momentum transfer, not created energy.

### Room, same probe (`A-probes/blast.js`, `hammer.js`), three runs each

| Metric | Own | Jolt final | Rapier final |
|---|---|---|---|
| Blast max lift (m) | 0.22–0.60 | 0.044 / 0.048 / 0.087 | 0.044 / 0.068 / 0.118 |
| Blast pieces lifted > 3.5 cm | 11–13 | 1 / 1 / 6 | 2 / 3 / 4 |
| Blast launches (rest launches) | 33–45 (1–9) | 19–22 (8–9) | 42–60 (23–39) |
| Blast max rise above spawn (m) | 0.09 | 0.038 | 0.13–0.17 |
| Blast asleep of 36 | 34–36 | 25 / 25 / 35 | 17 / 22 / 32 |
| Hammer max lift (m) | 0.05–0.25 | 0.034–0.037 | 0.02 / 0.06 / 0.17 |
| Hammer rise above spawn (m) | 0.02–0.07 | 0.05–0.06 | 0.13–0.14 |
| Hammer asleep of 37 | 37 | 32 / 36 / 37 | 15 / 22 / 25 |
| Fastest upward speed from rest (m/s) | 0.05–0.34 | 0.25–0.85 | 0.35–1.97 |

The C2 energy column exists only in Rapier's probe (2–7 pieces over 3.5 cm on blast), so Jolt has no room C2 number. SwiftShader, three runs, not deterministic.

### Per case

| Case | Jolt | Rapier | Winner | Comparable? |
|---|---|---|---|---|
| 1 Bowl | 42/128 fail, tunnelling | 3/128; 0/128 at 8 iterations | **Rapier** | Yes, after reconciling |
| 1 Room | table above | table above | **Jolt** | Yes |
| 1 Package tests | 15 of 347 fail | 21 of 344 fail | Jolt, slightly | Mostly: different rules rebuilt |
| 1 Rules lost | sleeping piece as fixed support | `maxAwake`, narrow-support topple, wake on ground change, per-contact Coulomb | **Jolt** | Yes |
| 1 Bench 160+40 median | 1.13–1.17 ms vs own 0.82–0.91 (1.4×); final settings 1.5–2.1 ms (about 1.8×, loaded) | 2.15–2.48 ms vs own 1.46–1.86 (1.3–1.5×) | Tie; both fail C7 | Ratios only: the "own" absolutes differ 2× between harnesses |
| 1 Bench p90 | 5.1 ms vs 1.5 (3.4×, ground tiles built on first touch) | 2.5–3.1 ms vs 2.0–3.2 (about 1×) | **Rapier** | Ratios only |
| 2 Ragdoll, single | asleep 2.5–3.2 s; ankle over limit by up to 0.9 rad for 17 frames | best setting: drift 21.6 mm, 0.08 rad over, asleep 3.0 s; erratic across settings | **Jolt** | Partly: Jolt reports no drift in mm |
| 2 Ragdoll, ×20 | 2.8 ms median | 1.4–1.6 ms | Rapier on cost | Yes, load noise |
| 3 Vehicle | `compact_hatch` 1,034 kg; curb roll 19°, asleep 7 s; 10 cars 0.15–0.25 ms | `midsize_sedan` 1,380 kg; curb roll 5°, never asleep while driven; 10 cars 0.05–0.09 ms | Tie on behaviour; Rapier on cost | No: different car, ramp and wheel model |
| 4 Kinematic agents 300 / 1,000 | 0.11 / 0.29 ms | 0.43–0.64 / 0.93–1.3 ms | Unknown | No: Rapier's scene includes 100 debris and the door |
| 4 Pile, 1,700-body ragdolls | 23 ms, never asleep | 8.7–16 ms, 0–17 asleep | Both fail | Yes |
| 4 Pile, 300-body chains | 3 ms, all asleep at 8.3 s | 0.9–1.5 ms, 90/300 asleep at 10 s | Jolt on rest, Rapier on cost | Yes |
| 4 LOD swap | 2.6–4.5 ms for 100 | 0.04–0.07 ms each (4–7 ms for 100) | Tie | Yes |
| 4 Door break | joint break impulse | inferred from contact force (no joint force API) | **Jolt** | Yes |
| 5 Cascade | 318 bodies; p99 7.6 ms, max 14.4 | 448 bodies; p99 2.6–3.7 ms | **Rapier** | Roughly: different scenes |
| 5 Contact events | per contact, struct-of-arrays, +136 B JS heap over 570 steps; impulse is an estimate | force events, real solved force; one wrapper allocated per event | Split | Yes |
| 6 1,000 first-hit rays | 1.6 ms (own 9.1) | 1.8–2.1 ms (own 14.3–14.9) | Tie | No: 3 houses vs 10 houses |
| 6 1,000 all-hit rays | 2.2 ms | 4.4 ms | Jolt, weakly | No: same reason |
| 6 Body created this frame | seen before a step | not seen until a step | **Jolt** | Yes |
| 7 50 character controllers | 0.14 ms | 0.65–0.93 ms | **Jolt** | Yes, load noise |
| 7 Grenade | rolls 30 m, never rests | at rest at 4.0 s | **Rapier** | Yes |
| 7 200 casings | none asleep at 5 s | 5/200 asleep at 5 s | Both fail | Yes |
| 7 2,000 statics add / remove | 7–10 / 0.9 ms | 15–27 / 28–50 ms | **Jolt** | Yes |
| 7 Save/load, 5 km precision | bit-identical; fine | bit-identical; fine | Tie | Yes |
| Determinism | Node, Chromium, Bun identical | cross-process identical | Jolt (more runtimes measured) | Yes |
| Bundle gzip | +959 KB | +1.66 MB | **Jolt** | Yes |
| Memory | fixed 128 MB heap, about 18 MB per world | growable | **Rapier** | Yes |
| Dependency (as reported, not verified by me) | MIT; one maintainer for the JS bindings; 2 open issues | Apache-2.0; JS repo archived into the main repo; 9-month release gap; 76 open issues | **Jolt** | Yes |
| Advocate's effort estimate | 5–7 weeks | 10–13 weeks plus a bindings patch | Jolt | Both optimistic |

## 3. Open blockers of Jolt and how to retire each

**B1 — Bowl (gate 0, one week, blocks everything).**
- Experiments, in order:
  1. Solid ground: Jolt's heightfield shape, or convex prisms per cell. Rapier's bowl passes on a heightfield with boxes at hard steps, so a non-triangle-soup ground is the first thing to copy.
  2. Lift pieces born inside the ground out at creation. Rapier needed this rule; the Jolt seam only slides deep overlaps apart.
  3. Explain why 1/60 is worse than 0.05.
- Go: 128/128 on C2–C4, zero pieces below ground with the net counter at zero (`engine-pieces.ts:438-444`), at 8, 10 and 20 iterations, with 1/60 no worse than 0.05. Ground update no more than about 2.5 ms per changed tile (Rapier's measured cost).
- If it fails: stop and switch to Rapier, accepting the bindings patch. The contract package limits the swap to the adapter and the debris seam. Do not ship the net as the fix.

**B2 — Rolling resistance and rest of round bodies.**
- Experiment: move the kit's existing rolling-resistance rule from the debris seam into the adapter as a per-body option.
- Go: grenade at rest within 5 s and within 8 m; at least 95% of 200 casings asleep at 5 s.
- If it fails: the kit deactivates bodies under a size and speed threshold after a fixed time.

**B3 — Ragdoll limits and piles.**
- Experiment: Jolt's ragdoll API with its stabilizer (not tried in the spike).
- Go: no joint more than 0.1 rad over its limit for more than 3 frames; asleep within 4 s; 100 bodies piled as chains asleep within 10 s at no more than 4 ms.
- The 1,700-body full-ragdoll pile fails on both engines. Treat it as a design rule: piles are chains or capsules.
- If it fails: per-ragdoll damping plus kit-forced sleep when the whole ragdoll is slow.

**B4 — Fixed 128 MB heap.** The 240 Hz bowl run aborted with OOM four times (`jolt-bowl-240-b.log`), so this is measured, not theoretical.
- Experiment: one shared world; measure peak heap in the worst scene (city block, 500-body cascade, 100 chains); make tests dispose worlds.
- Go: peak under 50% of the heap; full test suite with no OOM.
- If it fails: build the wasm ourselves with a larger or growable heap. That is a build flag, not a code fork, but it adds a build pipeline we own.

**B5 — Cost.**
- Experiment: build ground tiles off the hot path; re-measure alone on a quiet machine and on AMD.
- Go: the absolute budgets of the revised C7 (section 4).
- If it fails: profile the per-contact JS friction callback. If it dominates, fall back to per-body friction switching, which loses per-contact Coulomb, or move the rule into a custom wasm build.

**B6 — Cascade tail.** p99 7.6 ms and max 14.4 ms at 318 bodies is over half a 60 Hz frame.
- Go: 500 bodies woken in one frame, p99 at most 4 ms.
- If it fails: stagger waking across frames in the kit.

**B7 — Not measured at all.** AMD, weak CPUs, Firefox, ARM, the nightly GPU suite, `leak.mjs` (it cannot see wasm memory today), and the cross-platform-deterministic build (not yet released). Each needs one run before merge.

## 4. C1–C8 for an engine-based debris system

- **C1 — keep, redefine once.** Measure per contact island, in metres of energy height, excluding updates with an external input (ground change, blow, net). The two spikes measured different things; spec 008 must fix one implementation.
- **C2 — change.** Keep 3.5 cm, but a gain counts as a launch only if the island did not pay for it, that is, if C1 is also violated for that island in that episode. The Rapier lever case shows that a real engine transfers momentum the old solver never did.
- **C3 — keep, add C3b.** Keep the 3.5 cm cap on position-correction lift. Add a hard rule: nothing ends below the ground, and the fell-through net fires zero times in tests.
- **C4 — keep for the bowl; set separately for the room.** Bowl: 100% asleep within 3 s. Room: neither engine reaches 100% in 3 runs, so the room number needs a five-run measurement after sleep tuning. The data cannot set it today.
- **C5 — change.** "All current tests pass" cannot hold: 7 tests use a sleeping piece as a fixed ramp, 4 encode the old solver's impulse tolerances, 2 use a top that exists only as a function. Replace it with a named list of §12 behaviours, one test each, and a recorded reason for every rewritten test.
- **C6 — change.** Sweep engine knobs instead of `SOLVER_PASSES`: 8, 10 and 20 iterations, the push-out limit ±50%, dt 1/30, 0.05, 1/60 and 1/144, over 64 seeds. Require that more work is never worse. Add a 20:1 mass-ratio stack and a five-piece stack.
- **C7 — replace.** A ratio to a solver that will be deleted is not a lasting gate. Use absolute budgets per scenario (debris 160+40, cascade of 500, 20 ragdolls, 10 cars, 1,000 agents), median and p99, on a named hardware tier, enforced by the nightly perf gate. Keep 1.25× against the own solver only as a transitional check while both run. The absolute numbers cannot be set from load-21 data.
- **C8 — keep, strengthen.** Add cross-runtime (Node, Chromium, Bun, Firefox) and bit-identical save/restore.
- **New C9 — memory (§8).** The wasm heap returns to the same byte count after create/dispose cycles; `leak.mjs` gains a wasm probe.
- **New C10 — no solver switch mid-game.** The engine is loaded before any world exists.

## 5. Plan

Total: **about 11–14 engineer-weeks** for the whole kit. The advocate's 5–7 weeks omits goldens, the rewritten tests, nightly GPU validation and the first-use surprises of ragdoll and vehicle APIs.

| Phase | Content | Effort | Model |
|---|---|---|---|
| 0 Gate | B1, B4, quiet-machine and AMD re-measure, same scenes for both engines where this memo says "not comparable" | 1 wk | `sonnet`; go/no-go review `opus` |
| 1 Architecture 🧠 | Final `game-physics` contract; one world per game; async init; step order (crowd → physics → damage); layers; part-id tags; ground contract (furniture out of `groundAt`, tops as drawn meshes); events to damage; rewrite spec 008; decision record | 4 days | `opus`/`fable` |
| 2 Contract and adapter | Production packages, dispose tests, licence text, pinned dependency | 1.5 wk | `sonnet`; scaffolding, README and skills `haiku` |
| 3 Debris | Ground, statics, §12 rules, rewritten tests, revised criteria; goldens last | 2–2.5 wk | `sonnet`; goldens `haiku` |
| 4 Queries | Broadphase under `surfaceRay`, multi-hit, blast, sensors | 1 wk | `sonnet` |
| 5 Ragdoll and crowd bodies | B3, LOD policy, pile rule 🧠 | 1.5–2 wk | `sonnet`; pile policy `opus` |
| 6 Vehicles | Map arcade driving onto wheeled vehicle 🧠; sleep rule | 1.5–2 wk | `sonnet`; mapping decision `opus` |
| 7 Controller, props, joints | Player and NPC controller, held and thrown objects, B2, interactable joints | 1–2 wk | `sonnet` |
| 8 Removal and validation | Delete own solver, docs, room validation, nightly GPU, `leak.mjs` | 1 wk | `haiku` mechanical, `sonnet` validation |

**Risks:**
- Gate 0 fails and the decision reopens to Rapier.
- The JS friction callback caps performance and blocks the multithread build.
- One maintainer for the JS bindings; mitigate by pinning and vendoring the wasm.
- Goldens recalibrated late can hide unrelated regressions.
- Two solvers coexist during phases 3–7.

**Before anything merges to main:**
1. Gate 0 passed and recorded.
2. Owner approved the revised C1–C10.
3. Engine path behind a switch, own solver as default until phase 3 gates pass.
4. No browser or GPU test in CI.
5. Nightly GPU suite and `leak.mjs` (with the wasm probe) green on the branch, run by hand.
6. One AMD measurement.
7. Strict TypeScript, no `any`.
8. Lockfile committed and licence text shipped.

**Where the data is insufficient:**
- Absolute milliseconds (both spikes ran together).
- Cases 3, 4 and 6 (different scenes).
- Room C2 for Jolt.
- Room sleep target.
- Anything on AMD, Firefox or ARM.
- Dependency facts dated 2026, which I took from the reports.

## References

Raw files are in `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad/item6-escalation/`:
- `jolt-bowl-64-it20.jsonl`, `jolt-bowl-64-v3-it10.jsonl`, `jolt-bowl-64-a.log`, `jolt-bowl-64-b.log`, `jolt-bowl-it20-a.log`, `jolt-bowl-it20-b.log`, `jolt-bowl-240-a.log` — Jolt bowl counts
- `jolt-bowl-240-b.log` — the four `Aborted(OOM)` lines
- `R-bowl64-default.txt`, `R-bowl64-it8.txt`, `R-bowl64-step120.txt` — Rapier bowl counts
- `J-probes/final.*.out`, `R-probes/final.rapier.*.out`, `R-probes/final.own.*.out` — room table
- `bench.jsonl`, `R-cases.txt` — bench and cases 2–7

Code:
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt/packages/game-physics-jolt/src/index.ts:643-649` — per-contact static/dynamic friction and restitution
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt/packages/game-destruction-three/src/engine-pieces.ts:438-444` — fell-through net
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt/packages/game-destruction-three/src/engine-pieces.ts:227` — thin pieces already use continuous collision, so CCD is not the missing fix
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt/packages/game-destruction-three/src/engine-ground.ts:92` — one-sided ground triangles
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt/packages/game-destruction-three/tests/bowl-energy.test.ts` — Jolt bowl asserts C1–C4, lowest and net
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-rapier/packages/game-destruction-three/src/engine-pieces.ts:416-422` — per-piece friction switch
- `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-rapier/packages/game-destruction-three/tests/engine-bowl.test.ts` — Rapier bowl asserts C2, C3, C4 only