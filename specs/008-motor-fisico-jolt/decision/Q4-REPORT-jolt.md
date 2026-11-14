Before vs after

| Measurement | Before (previous round) | After (final code, `c6c42d87`) |
|---|---|---|
| **Room blast ×3**: pieces over C2, spec ruler (max) | 0 / 0 / 0 (0.005 / 0.003 / 0.019) | 2 / 2 / 3 (0.063 / 0.186 / 0.109) |
| Room blast ×3: pieces over C2, gate ruler | 1 / 5 / 1 | 6 / 6 / 4 |
| Room blast ×3: `c2Max` (m) | 0.082 / 2.631 / 0.084 | 2.116 / 2.544 / 0.109 |
| Room blast ×3: asleep / total | 36/36 ×3 | 35/36, 36/36, 36/36 |
| Room blast ×3: seconds until all asleep after last outside input | 0.25 / 1.3 / 0.95 | never / 1.1 / 1.45 |
| **Room hammer ×3**: pieces over C2, spec ruler (max) | 0 / 1 / 0 (0.023 / 0.834 / 0.013) | 0 / 1 / 0 (0.011 / 1.079 / 0.004) |
| Room hammer ×3: pieces over C2, gate ruler | 1 / 1 / 1 | 4 / 4 / 4 |
| Room hammer ×3: `c2Max` (m) | 0.039 / 0.936 / 0.045 | 1.976 / 1.079 / 2.360 |
| Room hammer ×3: asleep / total | 32/37, 35/37, 37/37 | 37/37 ×3 |
| Room hammer ×3: seconds until all asleep after last outside input | never / never / 1.55 | 1.45 / 5.45 / 2.15 |
| Room: fall-through net (pieces put back on the ground) | 0 in all 6 | 215 (blast 1), 1 (hammer 2), 0 in the other 4 |
| **Bowl** at 20 iterations | 128/128, net 0 | 128/128, net 0 (worst C1 −0.018) |
| **Bench 160+40**, own: median / p90 / p99 (ms) | 0.73–0.84 / 1.22–1.54 / 1.79–2.91 | 0.65–0.70 / 0.90–0.97 / 1.50–2.11 |
| Bench, Jolt: median / p90 / p99 (ms) | 0.83–0.89 / 1.17–1.41 / 4.58–5.53 | 0.61–0.76 / 1.34–1.54 / 2.35–2.48 |
| Bench: collector pauses per 200 updates (over 1 ms), own | 15–18 (2–4) | 31–32 (1–3) |
| Bench: collector pauses per 200 updates (over 1 ms), Jolt | 5–6 (4–5, max 4.6 ms) | 3–5 (0–1, max 1.4 ms) |
| Bench: pieces asleep, own / Jolt | 160 / 159 of 160 | 160 / 159 of 160 |
| **B6 cold**: waking frame / p99 (ms) | 14.1–16.9 / 5.1–7.1 | 15.4–16.2 / 5.5–6.5 |
| **B6 warm** (9 runs): waking frame / p99 (ms) | 5.0–5.5 / 2.97–4.38 | 5.07–7.38 / 2.93–4.64 (median 3.38) |
| Bytes allocated by the kit–engine glue code (the seam) per update | 1,112,810 | 206,070–210,186 |
| `game-destruction-three` tests | 11 failing | the same 11, none new (386 pass) |
| `game-physics-jolt` tests | 22/22 | 22/22 |
| `game-destruction` tests | — | 529/529 |

Notes on these numbers:
- **Bench timing.** I re-ran the "before" bench the same day on the starting code, because the previous round never recorded collector pauses. Both before and after ran at 1-minute load under 3 (2.11–2.93).
- **Room load.** SwiftShader itself pushes load to 5–16 while the room runs; that is not another process.
- **An earlier room set was better.** Before the last two commits, the room gave spec-ruler C2 over 3.5 cm of 1/1/0 and 2/1/1, all asleep within 2.55 s of the last input in 6/6, and the net at 0. But that code failed the bowl 127/128 (seed 39 at dt 1/60, 3.2 mm of C1).
- **Why it is worse now.** The last two commits fixed the bowl but brought the fall-through back in the room. I could not get both at once.
- **No forbidden fixes.** No velocity clamp, forced sleep or outcome teleport. The one teleport is the brief's allowed "separate at creation", and it can lift a wedged piece as much as 1.4 m.

## Commits (local, none pushed, none with `--no-verify`)

Each fix has a test that fails on the old code. The refactor and the B6 change have none, since they change no behaviour.

- `72bb3a5e` **Split the Jolt adapter.** `index.ts` (1505 lines) is now 12 files, one per concern; the largest is the world class at about 630 lines.
- `c23470f6` **B6 test.** It runs in its own file and reports cold and warm runs separately.
- `f3187454` **Cause 3.** In the room the house's water tank changes its drawn box on 59 of 100 updates once it leaks. Each change used to destroy and rebuild the house's body and wake everything near the house. Now the house's shape is updated in place on the same body, and only bodies near boxes that changed are woken.
- `213878dc` **Cause 1.** The parked car is now a Jolt body made from its damage boxes (52 of them), read through a new typed method on the destruction world. It follows the car's moves and pose changes, and parts that break or come off are dropped.
- `cd953d64` **Cause 2.**
  - Piece collision shapes are fitted to what is drawn. The roof sheet is now one 2 cm plate instead of a 1.5 m tall box.
  - A piece made inside a fixed object is moved out of it immediately.
- `0fea652f` **Cause 4.** The seam now allocates 5× less per update. The main source was the kit's own bookkeeping, which ran twice per update in Jolt mode.
- `d10e9663` **Wedged pieces.** A piece created stuck between two fixed objects is lifted out of both.
- `dcfad8a2` **Car boxes trimmed.** The damage boxes reached 17 cm past the drawn car on each side and 14 cm above it. They are now cut to the box around the drawn meshes.
- `c6b4e2c7` then `c6c42d87` **Bowl fix.** A move by the kit (e.g. its slide-apart rule) that would push a piece deeper into a fixed object or the ground is now refused, and the piece stays where Jolt had it. This brought the bowl back to 128/128.

## Fixed

- **House rebuilds (cause 3):** fixed. The body is kept, and only boxes that changed wake pieces.
- **Collector pauses (cause 4):** fixed. Jolt now has 0–1 pauses over 1 ms per 200 updates, down from 4–5.
- **Car collider (cause 1):** the car is in Jolt, and a door leaning on it now sleeps.
- **Fat roof-sheet box (cause 2):** fixed. Pieces made inside fixed objects are also separated at creation.
- **Friction cost on the waking frame:** I could not reproduce the extra 1.5 ms. Measured warm, the friction pass costs about 0.2 ms. The contact callback costs 1.0–1.3 ms for 1380 contacts, and Jolt's own solve is about 4.4 ms.

## Not fixed

- **Fall-through in the room.** In the final code, pieces made deep in the ground sink through the one-sided height field. One blast run hit the net 215 times. Also checking against the ground's bodies at creation stopped the sinking in the room, but broke the bowl's seed 39. My last attempt was layGround before sync and a test; that test still failed, so I reverted it.
- **Car boxes still hold air.** Even trimmed, they are cut to the drawn car's bounding box, which the mirrors widen. Doors made by the wall the car is parked against still start inside them, get lifted up to 1.4 m, land on the car and gain energy (piece `obj_28`). Doing this properly needs boxes from the car's drawn meshes, which the vehicle package would have to provide through a new method.
- **Kit slide-apart rule.** Its moves still add energy (piece `obj_34`, about 0.15–0.6 m of the gain).
- **Other objects drawn but missing from Jolt.** Measured in the room:
  - The house's merged meshes: 329 of 351. Of those, 220 are walls and floors, 54 roof, 50 more in another merged group, 5 lot.
  - Its structural parts with no mesh of their own: beams, columns, rafters, lintels, slabs and pillars.
  - Meshes wider than 3 m: 3 in the house, 6 in `test_table`, 1 in `target_wall`.

## Go / no-go

| Target | Result |
|---|---|
| Room C2: 0 pieces over 3.5 cm (spec ruler), 6/6 runs | **No-go.** Met in 2/6. |
| Room C4: all asleep within 3 s of the last outside input, 6/6 runs | **No-go.** Met in 4/6 (one run never, one at 5.45 s). The earlier set met 6/6 but failed the bowl. |
| Cost ≤ 1.25× own median | **Go.** 0.91× (0.94–1.02× in the earlier set). |
| p99 ≤ 1.5× own | **No-go.** 1.50× on the median of runs; per pair 1.18×, 1.50×, 1.57×. The collector is no longer the cause. Final p90 rose to 1.34–1.54 ms from 0.81–1.04 at `c6b4e2c7`; I did not confirm whether the refused-move check in `c6c42d87` caused it. |
| B6 warm p99 ≤ 4 ms | **No-go as a firm bound.** Under 4 ms in 6/9 runs, median 3.38. Before this round it was 8/9 at lower load. Spreading the push over a 150 m/s front stays above 6 ms. |

## Raw files

Everything is in `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad/q4/`:
- `room-after/` (final, with `room-after.summary`), `room-after-clip1/` (the earlier, better set), `room-after-partial-c6c42d87/`, `room-after-among/`, `room-after-unclipped/`, each with per-run `.load` files
- `bench/bench.jsonl` and `b6/b6.jsonl`
- `bowl/bowl-final3-it20.jsonl`, the final code's bowl run (from the uncommitted tree just before `c6c42d87`; that commit added only its test)
- `prof/`: heap profiles `alloc-before`, `alloc-after2`, `alloc-after3` and the GC traces
- Diagnostics: `diag-trace*.json`, `car-boxes.js`, `classes-diag.out`, `statics-diag.blast.out`
- Package test logs: `dt3-*.log`, `pj-final.log`

The probe scripts are in the same folder: `room.js`, `run-room.sh`, `probe.mjs`, `diag-trace2.js`. The server on port 4286 is stopped.