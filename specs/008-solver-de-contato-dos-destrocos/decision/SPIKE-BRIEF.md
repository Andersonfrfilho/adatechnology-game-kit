# Spike: debris contact solver — rewrite vs Rapier

## Problem (established, do not re-derive)
`packages/game-destruction-three/src/pieces.ts` (`PieceSystem`) moves loose debris pieces in `integrate`
(ground + corner supports, friction, topple) and only afterwards, in `collide` (once per update), fixes
box-vs-box overlap by position (`separatePair`, `piece-contacts.ts` SAT/OBB, `applyPushes`, `slideApart`,
`propped`/`proppedAt` clamp). Consequences traced at 74774f11:
1. a piece only touching a support (`if (resting) return`) gets no prop → falls into it next step → lifted back;
2. the `propped` overlap support has no friction and no turning; push acts one slab at a time → can launch;
3. detection one step late → a piece riding a sinking support is lifted back every frame;
4. ground moving under pieces (soft-ground slide, `game-terrain` `updateSlides`) amplifies it.
Four local patches (H1–H4, patches in this folder) only moved which seeds fail.

## Owner's target (item 6)
Debris pushed apart **without being launched**: per piece, cumulative upward displacement caused by contact
resolution ≤ 3.5 cm and no upward velocity > 0.05 m/s after a contact resolution. Also CLAUDE.md §12: nothing
broken floats, no invisible collider (`shownBoxes`), resting pieces sleep, what was on top falls when support goes,
Coulomb friction (static/dynamic), topple when COM leaves support.

## Acceptance harness (same in both spikes)
- `deepening-bowl-repro.test.ts` (this folder): 1.2 m sheet onto four tilted 0.63×0.30×0.04 plates in a bowl
  deepening 0.25→0.45 m over 2 s, `wakeRegion` every frame. Turn it into a clean vitest test (no debug wrappers).
  At 74774f11, 4/16 seeds fail at dt 0.05. Must pass **16/16 seeds at dt 0.05 and dt 1/60**.
- Existing: `separate-pair.test.ts` (11), `sheet-on-clutter.test.ts`, `pieces-edge.test.ts` (box half under a
  table), all game-destruction-three and game-destruction tests, game-floorplan-three tests (base failures at the
  release base: baseboard, house_gas_explodes, blast-presentation hash 5e54ccfa — already failing before this branch).
- Room scenes (http://127.0.0.1:4281 serves rodada10-destrocos — do NOT use; serve your own worktree's
  `examples/test-room/dist` on your assigned port): probes `../shots/i21_blast.js`, `../shots/i21_hammer.js`,
  runner `node ../probe.mjs '<url>' '<js>' out.png`.

## Measurements to report (table)
| metric | baseline 74774f11 | your prototype |
- bowl: seeds failing at dt 0.05 / 1/60, max cumulative lift, max post-contact vy
- room blast + hammer, 3 runs each: max cumulative lift, launches, rise above spawn
- cost: ms per `update` with 160 pieces resting + 40 moving (node microbenchmark, median of 200 updates)
- bundle: size delta of the test-room build (gzip) and of the package dist
- determinism: same seed + fixed dt → identical result? (yes/no)
- integration surface: which public API / hooks / goldens change; what of our logic (material, load path,
  `shownBoxes`, `onBrokenChecked`, sleep/wake, `contacts` per part, crater/groundAt, fragments cap 160) had to
  be adapted or is lost
- risk list and estimated effort to production quality

## Rules
Prototype quality is fine (it is a spike), but: TypeScript, no `any`, no GPU tests in commits; commit locally on
your spike branch, never push. Do not touch other worktrees. Don't spend effort on goldens beyond reporting which
change. Same step failing twice → write it down and move on.
