# Spike B — Rapier for loose-debris stepping (item 6)

Branch `spike/piece-solver-rapier` (worktree `adatechnology-game-kit-wt/spike-rapier`, from 74774f11), local commits:
4749202d (Rapier behind PieceSystem + bowl acceptance test), 21447f73 (kit rules over Rapier: deep overlaps apart along the ground, NARROW topple, wake on lost support),
468d243f (determinism test). The kit's own solver stays behind `solver: 'own'`, which also runs until the WASM is loaded. Both solvers were measured in one build and one harness:
a spike-only global `__PIECE_SOLVER__` (`PIECE_SOLVER=own` in vitest, a room init script) picks the solver. The bowl baseline was also taken on the untouched 74774f11 code.

## Verdict
Rapier solves the bowl (16/16 at both dt; max lift 3 mm against 30 cm on the baseline). The vy criterion passes only with a kit clamp on top.
**In the real room it is worse:** a hammer on the house lifts big chunks 0.6–0.9 m, and only about 40% of the debris is asleep after 11 s (baseline 97–100%).
20 of the 374 package tests fail, against 0 on the baseline outside the bowl. It costs about 1.5× CPU and +1.67 MB gzip. **Not recommended for production in this form.**

## Metrics (agnostic = COM rise / vy, the same for both solvers)
| metric | baseline 74774f11 | Rapier prototype |
|---|---|---|
| Bowl, brief's internal metric | 4/16 fail @0.05 (seeds 2,3,9,10: 6.8/8.8/4.3/6.3 cm), 0/16 @1/60; max post-contact vy 0.121 / 0.077 | n/a |
| Bowl, agnostic (rise ≤ 3.5 cm and vy ≤ 0.05) | 8/16 fail @0.05, 7/16 @1/60; max rise 29.9 / 22.0 cm; max vy 0.351 / 0.388 | **0/16, 0/16**; max rise 3.1 / 2.2 mm; max vy 0.049 (clamp) |
| Bowl, pure Rapier without the clamp | — | lift max 2.1 mm, but 8/32 fail on vy (max 0.195) |
| Room blast ×3, rise above spawn | 0.090 / 0.090 / 0.090 | 0.057 / 0.055 / 0.055 |
| Room blast, contact lift (max; pieces > 3.5 cm) | 0.56/0.58/0.21; 14/16/12 | 0.050/0.047/0.079; 5/3/5 |
| Room blast, launches (vy > 0.05 from ≤ 0.05) | 37/39/32 (own's landing bounce included) | 6/13/8, max 2.7 m/s |
| Room hammer ×3, rise above spawn | 0.030 / 0.031 / 0.029 | **0.641 / 0.843 / 0.302** (diagnostic run: 0.924) |
| Room hammer, contact lift | 0.07 / 0.15 / 0.13 | **0.59 / 0.58 / 0.13** |
| Room hammer, launches | 23/27/32 | 4/8/7, max 2.6 m/s |
| Room, internal metric (own only) | blast: up-disp 12.7 cm, 1 launch 0.102; hammer: 3.7 cm, 0 launches | n/a |
| Asleep at end (blast; hammer) | 35–36/36; 37/37 | **17–19/36; 7–19/37** |
| Cost: PieceSystem.update, 160 resting + 40 moving, median of 200 | 0.64 / 0.77 / 0.84 ms | 1.11 / 1.32 / 1.16 ms (~1.5×) |
| Bundle, test-room html | 16.06 MB / 5.88 MB gz | 20.44 / 7.54 → **+4.38 MB, +1.67 MB gz** |
| Bundle, package ESM (Rapier external) / IIFE | 320 KB (86.7 gz) / 0.81 MB (0.20 gz) | 343 KB (93.0 gz) / 5.29 MB (1.87 gz); the dependency's rapier.mjs is 4.2 MB (1.66 gz) |
| Init (async, node 24) | 0 | 43–127 ms |
| Determinism (same seed + fixed dt) | yes | yes (bit-identical test, deterministic-compat) |
| Package tests (374) | all pass outside the bowl | 354 pass / 20 fail |

## Kept / adapted / lost
- Mass: kept, via explicit mass and box inertia.
- Friction: geometric mean kept exactly (√μ with Multiply). **Static/dynamic Coulomb lost**: one coefficient (3 slope tests fail).
- What falls when support goes: kept via Rapier plus the kit's `wakeUnsupported`. A woken piece samples its ground again. "Can on a table whose legs all break" still fails.
- Colliders: `partBoxes` become a compound of cuboids (cylinder or ball for round pieces). Part `contacts` are no longer used.
- Ground: a `groundAt` heightfield in 4 m tiles of 0.1 m cells, laid lazily and re-sampled on wakeRegion or wake; flat tiles are cuboids. **FIX_INTERNAL_EDGES is mandatory**: without it, 0.79 m/s up in the bowl. **Hard steps in `groundAt` (tables, slabs) become ramps**: 2 edge tests fail, and this is the likely cause of the hammer climbs.
- staticTopAt: replaced by AABB fixed cuboids from staticNow(). The AABBs can be invisible colliders, against §12.
- sweep / onSlam: kept as a post-step correction.
- Sleep: owned by Rapier's islands. Forcing one body asleep made it sink and then pop up at 0.8 m/s. The thresholds are not exposed in the 0.21 bindings, so the 0.5 s sleep, calm and steady rules are lost. **The maxAwake budget and restPoints are broken** (3 tests).
- NARROW topple and `tip`: kept, using Rapier's solver contacts.
- Rolling resistance: an approximation; 9 round-piece tests fail.
- `onKnock` sound: lost.
- Hard landing: kept.
- Deep overlaps: kept and essential. Contact-hook filter plus `slideApart`/`boxesAlongGround`; without it a 0.6 m chunk climbs 0.54 m. **Gotcha: hooks only fire when step() gets an EventQueue.**
- No-launch clamp: added. vy from contacts is capped at max(vy before, 0.049). It caps speed, not position.
- Step size: 1/120 s. At 1/60 a 2 m drop sank 8 cm into the floor.
- `onBrokenChecked`, the fragment cap of 160: untouched.

## API / integration
New `initPiecePhysics`/`piecePhysicsReady`; options `solver`, `staticBoxes`, `pieceSolver`. The renderer passes `staticNow()`. Vitest needs a setupFiles that awaits the init; other packages' tests would otherwise silently run the old solver. Goldens (floorplan-three destruction, blast hash) will move; not run.

## Dependency
`@dimforge/rapier3d-deterministic-compat@0.21.0` (2026-09-25; 0.20.0 2026-08-08). Apache-2.0. Repo github.com/dimforge/rapier. Publisher sebcrozet (Dimforge), the same as rapier3d and rapier3d-compat, so it is official.
Why compat: the base64 WASM works in node, vitest, tsup and the single-file room with no loader config; the cost is +33% size and no streaming compile.
Why the deterministic build: cross-platform same-seed results (no SIMD). The SIMD build was not benchmarked.
Licence: Apache-2.0 is MIT-compatible, but the IIFE and the room inline it and must ship the LICENSE and NOTICE.

## Risks
1. Hard steps in `groundAt` become heightfield ramps (the room failure). The fix is cells ≤ 2.5 cm, or slabs sent as boxes, which changes the host contract.
2. Rapier's position-level push-out lifts things, so a velocity clamp can't enforce 3.5 cm.
3. Sleep and the budget can't be tuned through the bindings: pieces stay awake longer.
4. One friction coefficient, no rolling resistance, no knock events.
5. +1.67 MB gzip and async init.
6. Two worlds mirrored every frame: every outside write to a piece has to go through a diff (fragile).
7. The goldens have to be recalibrated.

## Effort
3–5 engineer-weeks, high risk:
- ground contract: 1 wk
- island-aware sleep and budget, or a patched build: 0.5–1 wk
- friction, round pieces and knocks: 1 wk
- per-pair and per-static lift guard, plus §12 and room re-validation: 1 wk
- licence, packaging and goldens: 0.5 wk
