# Spike A: rewriting the contact solver inside PieceSystem

Branch `spike/piece-solver-rewrite` (worktree `adatechnology-game-kit-wt/spike-solver`), from 74774f11. Local commits only:
`b8c84bd5` (the solver) and `675e4b8c` (precomputed masses, friction on two tangents, determinism test).

## What was built
- New `src/piece-solver.ts` (413 lines). `pieces.ts` was restructured (now 1770 lines; it was 1499).
- **The loop now runs substep by substep for all moving pieces together** (`substeps`). Before, `integrate` ran all of one body's substeps, and `collide` then fixed overlaps once per update. Each substep now does, in order:
  1. gravity;
  2. find contacts **before the move**;
  3. one **sequential-impulse solve** over the whole contact set (10 passes; normal impulse, Coulomb friction on two tangents, angular response);
  4. move;
  5. a **position pass** (NGS, 4 rounds) over all contacts together. This is a split impulse, so no velocity is ever used to push a piece out of an overlap;
  6. the support logic as before (topple, tipping, rolling resistance, damping).
- **Ground and fixed-top contacts** use the same sample points as before: corners, edge points over a step, `contacts`, round rims. They are now speculative: the gap is allowed to close by at most `sep` per substep.
  - The side-of-step stop and the floor under an overhang are kept.
  - The full post-move ground projection now only runs above `STEP` (3 cm). Shallower ground penetration is fixed by the position pass, together with the piece-to-piece contacts.
- **Box-to-box contacts** (`boxManifold`):
  - SAT with a margin, so pairs up to 1 cm apart plus the distance they close in the substep get speculative contacts.
  - Face contacts use reference-face/incident-face clipping (Sutherland-Hodgman). Crossed edges use the closest points between the two edges.
  - It runs on `partBoxes`. Both bodies receive the impulse, so the lower piece now feels the upper piece's weight.
  - Sleeping or held pieces are treated as static. They wake when hit faster than 1 m/s.
- **Kept unchanged:**
  - Deep overlaps (`> LIFT_DEPTH + closing·dt`, chunks born inside each other) still go through `separatePair` → `slideApart` along the ground.
  - Round pieces still use `knock` and stand on piece tops one-sidedly.
  - Sleep, wake, `wakeAbove`, `wakeUnsupported`, `restPoints`, `maxAwake`, sweep/slam, landing events.
  - `partBoxes`, and therefore `shownBoxes`, `onBrokenChecked`, `contacts` per part, `groundAt`/crater, `staticTopAt`, the 160-fragment cap.
- **Removed:** `propped`/`proppedAt`, the shallow branch of `separatePair`, `turnAboutCentre`.
- **Tried and switched off (measured):**
  - **Warm start between pieces** (matched by position, as Bullet does). Lift drops to millimetres, but impulses carried across a wedge kick pieces up at 0.2–0.4 m/s when the contact set changes.
  - **Bottom-up contact ordering.** It converges stacks better, and more pieces then ride up the ramps formed by other pieces.

## How things were measured
The brief's harness hooks `applyPushes`/`separatePair`, which no longer exist in A, so a neutral metric was used.
- **Definition (`tests/lift-measure.ts`):** around every `update`, for every piece:
  - **lift** = the rise of the centre of mass beyond what its own upward speed carries it, summed per piece;
  - **up** = an upward speed the update gave a piece that it did not have before.

  Gravity only removes upward speed, so both can only come from contacts — ground contacts included.
- Pass rule per seed: lift ≤ 3.5 cm and up ≤ 0.05 m/s for every piece.
- Room probes: `A-probes/{blast,hammer}.js` measure the same thing around `r.update`. They skip each piece's first 2 updates after it spawns. `restLaunches` counts up-events of pieces that were not falling faster than 0.3 m/s, which excludes landing bounces.
- Baseline and A were measured with the same harness.

## Metrics

| metric | baseline 74774f11 | A (rewrite) |
|---|---|---|
| bowl, neutral metric: seeds failing at dt 0.05 / dt 1/60 (of 16) | 8 / 7 | **2 / 1** |
| bowl, max lift (any piece) | 0.299 m | **0.037 m** |
| bowl, max post-contact upward speed | 0.388 m/s | **0.128 m/s** |
| bowl, brief's original hook metric (baseline only) | 7 / 3 failing; max lift 0.088, up 0.121 | n/a (hooks gone) |
| sheet-on-clutter, neutral metric (seeds 40/41/43): lift / up | 0.135/0.001, 0.100/0.031, 0.021/0.004 (2 fail) | 0.060/0.016, 0.007/0.033, 0.023/0.053 (2 fail, smaller) |
| room blast, 3 runs: max lift | 0.565 / 0.276 / 0.155 | **0.083 / 0.023 / 0.031** |
| room blast: pieces with lift > 3.5 cm | 15 / 13 / 14 | **1 / 0 / 0** |
| room blast: up-events from rest (count, max m/s) | 6 (0.344), 5 (0.157), 4 (0.344) | 11 (**1.168**), 10 (0.402), 9 (0.323) — **worse** |
| room blast: max rise above spawn | 0.090 m | 0.063 m |
| room blast: asleep at the end | 36/36 | **34/36** (2 still awake after 11 s) |
| room hammer, 3 runs: max lift | 0.102 / 0.080 / 0.092 | **0.033 / 0.028 / 0.014** |
| room hammer: pieces with lift > 3.5 cm | 6 / 9 / 8 | **0 / 0 / 0** |
| room hammer: up-events from rest (count, max m/s) | 4, 3, 2 (0.344) | 4, 8, 4 (0.296 / 0.515 / 0.381) |
| room hammer: asleep at the end | 37/37 | 35/37 |
| cost: `update` with 160 resting + 40 moving, median of 200 (node) | ~1.9 ms (5 runs: 1.58–2.00) | ~3.2 ms (3.13–3.38); 6.3 ms before the masses were precomputed |
| package dist `index.js` | 319 965 B (gzip 86 722) | 340 034 B (gzip 92 398): **+20 KB, +5.7 KB gzip** |
| test-room.html | gzip 5 877 355 | gzip 5 880 883: **+3.5 KB gzip** |
| determinism (same seed, fixed dt) | yes | **yes** (`tests/determinism.test.ts`) |

## Tests (A, current HEAD)
- **game-destruction-three:** 369 pass, 7 fail.
  - 3 bowl seeds (above).
  - 2 sheet-on-clutter seeds. That test now uses the neutral metric; the baseline fails 2 of the same 3 seeds.
  - `pieces-tipping` "door whose mesh is off the root origin falls flat": after landing it rocks for about 2 s and only starts to topple at about 2.2 s, so it is not flat at 3 s.
  - `separate-pair` "0.6 m deep chunk": a 2 mm drift in z, where the test allows 0.5 mm.
- **game-destruction:** 529/529 pass.
- **game-floorplan-three:** 829 pass, 6 fail on both A and baseline 74774f11 — the same 6 tests on each side: baseboard, house_gas_explodes, blast-presentation, and the goldens destruction/breach, spall and fracture. I did not compare hashes, so the goldens may fail with different values. They need recalibrating anyway, because the debris now ends up in different places.

## Integration surface
- **Public API unchanged.** `PieceSystem` keeps its public methods.
- Internal `PieceBody` loses `propped`/`proppedAt`. `warm` is still used for ground contacts and is now cleared on sleep.
- **Behavioural changes callers will see:**
  - the lower piece now carries the weight of what is on it (it used to be one-sided);
  - a sleeping piece hit faster than 1 m/s by a box wakes;
  - `onKnock` now also fires for box-to-box hits of 2 m/s or more;
  - static vs dynamic friction between two pieces is decided with landing in the static cone.
- **Goldens that change:** the floorplan destruction goldens (breach, spall, fracture) and the blast-presentation hash, plus anything that snapshots debris positions.

## Risks
1. **It does not meet the target as specified.**
   - Lift is fixed: no more centimetre-scale climbing anywhere, bowl or room.
   - But a converged rigid-body solver produces real upward speeds: pieces ride up ramps formed by other pieces, and plates wedged between the ground and a 142 kg sheet push up.
   - The room shows more "up from rest" events than baseline, with a worst case of 1.17 m/s. The old system could not do this, because it never lifted anything by velocity.
   - If "no upward speed > 0.05 m/s from any contact" is a hard rule, a physical solver violates it by design, and a cap or clamp would be needed.
2. **Results are chaotic with respect to tuning.** With 10 passes the bowl fails 3/32; with 6, 8, 15, 20 or 40 passes it fails 17, 8, 7, 8 and 11 of 32. Production needs a scenario sweep, not one tuned constant.
3. **No warm start between pieces**, so stack convergence relies on 10 passes. Stacks heavier than a 7:1 mass ratio will sag or jitter, absorbed by the position pass. Making warm start work needs persistent manifolds with stable feature ids, and handling wedge jamming.
4. **Cost is about 1.7×** on the bench. It grows with the number of contacts × passes × substeps (6 substeps at dt 0.05). There is no island splitting and no early exit for converged contacts.
5. **Two pieces were still awake at the end of the room blast** (sleep regression). The door rocks longer after landing.
6. The SAT edge bias and the clipping have no unit tests yet, apart from the scenario tests.

## Estimated effort to production quality
About **2–3 weeks** for one person:
- persistent manifold and warm start, and fixing the wedge kick: 3–4 days;
- sleep and islands, plus the door/rocking regression: 2 days;
- a performance pass (allocation-free inner loops, islands): 2–3 days;
- unit tests for the manifold, recalibrating goldens, room validation (all cameras irrelevant here; blast, hammer, slide): 3–4 days;
- deciding and enforcing the "upward speed" rule (cap vs physical): 1 day plus an owner decision.

**Main risk:** most of that time goes into tuning a hand-written solver that a library such as Rapier already solves. Compare with spike B before investing.
