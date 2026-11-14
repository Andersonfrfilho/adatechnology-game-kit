# Gate 0 report: Jolt (worktree `engine-jolt`, branch `spike/engine-jolt`)

Five blockers pass: B1 (the bowl), B2 (rolling and sleep), B3 (ragdolls), B4 (heap) and C9 (memory returned). B6 (cascade tail) fails. B5 (cost) is mixed: the mean cost is fine, the worst frames are 2× ours.

I made eight local commits, none pushed, all without `--no-verify`. Two things to know about them:
- I amended the T4 commit (`11d7e369`) once, locally, to fix a type error I had committed in its test.
- T7 was committed before T4, so the order differs from the brief's.

Every number here comes from a fresh run today. Timings are in Node on this Intel machine; there is no AMD here.

## Results per blocker

| Blocker | Result | Numbers | Raw files | Commit |
|---|---|---|---|---|
| **T1**: why dt 1/60 was worse than 0.05 | **Explained** | See below. | `g0/t1.jsonl`, `g0/t3.jsonl`, traces `g0/trace-*.txt` | `1e772895` |
| **B1**: solid ground (T2) and lifting pieces made inside the ground (T3) | **PASS** | Bowl, 64 seeds × dt {0.05, 1/60} at 8, 10 and 20 iterations: **128/128 pass C2–C4 at every iteration count**. The fell-through net fired 0 times. No piece centre was ever under the ground; the closest any centre got was 3.7 cm above it, checked every update. Worst C2 is 2.5 cm, worst C3 1.7 cm, slowest sleep 2.05 s. On C2–C4, dt 1/60 is no worse than 0.05. **C1** (no energy created) fails 0/128 at 20 iterations, 3/128 at 10 (all at 1/60, excess 0.5–2.9 mm) and 8/128 at 8 (3 at 0.05, 5 at 1/60, up to 5.2 mm). So on C1 alone, 1/60 is slightly worse. At 240 Hz with 20 iterations: 128/128 pass, C1 0 failures, no OOM. Updating a changed 2 m ground tile costs a median of 0.59–0.81 ms (p90 1.0–1.3) against the 2.5 ms limit. | `gate0/bowl-it{20,10,8}.jsonl`, `gate0/bowl240-it20.jsonl` | `bae38e21`, `d45c5e7d`, `2aeb7ef4` |
| **B2**: rolling resistance and round bodies at rest (T5) | **PASS, thin margins** | Grenade modelled as the kit draws the M67 (body, fuze, spoon) with C_rr 0.015. Open floor: at rest at **4.83 s**, 6.37 m from where it first lands. Rapier's wall throw: at rest at 2.3 s, **7.61 m** from the throw. A perfect ball with C_rr 0.015 rolls for 14 s; that is reported, not asserted, because it is real physics. **200/200 casings asleep at 5 s**; without rolling resistance, 15/200. | test `extras.test.ts` (b) | `5cb73fcc` |
| **B3**: ragdolls (T6) | **PASS, chain pile only at the kit's sleep speed** | Jolt's own ragdoll, stabilised, with 20 velocity and 8 position passes: worst joint 0.28 rad past its limit, **2 frames** over 0.1 rad, **asleep at 3.12 s**. With the world's default passes (10/2) it is 20 frames over, so the extra passes are what makes it pass. 100 cheap bodies piled as engine ragdolls: **asleep at 9.47 s** at a sleep speed of 0.08 m/s (the room's world setting); step median 2.2 ms, p99 2.6, max 5.4. At Jolt's default sleep speed of 0.03, neither these nor the loose chains sleep within 10 s. | tests `ragdoll.test.ts`, `crowd.test.ts` | `130bcced` |
| **B4**: heap (T4) | **PASS** | Worst scene in one world: 2000 static colliders, the 500-body cascade, 100 ragdoll chains and the 160+40 debris, 3002 bodies in all. **Peak 21 MB of the fixed 128 MB (16%)**, the same in all 5 runs. The world itself holds about 19.7 MB of that, so the kit can afford one world, not one per test or per system. Tests now dispose their worlds after each test. Full `game-destruction-three` and `game-physics-jolt` suites ran with no OOM. **C9**: every created and disposed world returns the heap to the same byte count. Before my fix each world kept 24–40 bytes, because the assert handler made in its constructor was never destroyed. No custom wasm build is needed. | test `heap.test.ts` | `11d7e369` |
| **B6**: cascade tail (T7) | **FAIL** | 500 bodies woken in one frame, 3 runs: the waking frame takes **11.7–13.1 ms, p99 5.9–6.4 ms**, then the median is 0.5 ms. Spreading the blast's pushes along a 340 m/s front gives a waking frame of 6.3 ms and p99 4.2–5.1 ms. Spreading pushes cannot spread the waking: the wall is one group of touching bodies, and Jolt wakes all of them in the same step once one block moves. Our per-contact friction callback was about a third of the waking frame; with it switched off, the frame is 9.5 ms and p99 3.0. I cut its cost somewhat by looking bodies up by heap address (the frame went from ~14.6 to ~12.5 ms). | test `cascade.test.ts` case 5b | `8134e6de` |
| **B5**: cost (T8) | **Mixed** | Debris bench 160+40, own vs Jolt alternating, ×3, run once load was under 3: own **median 0.70–0.72 / p90 1.26–1.29 / p99 1.9–2.6 ms**; Jolt **1.00–1.07 / 1.43–1.47 / 4.1–5.4 ms**. That is about 1.45× on the median, 1.14× on p90 and 2× on p99. 160/160 resting pieces asleep for both. Jolt's p90 was 5.1 ms in the spike; ground tiles are no longer the cost. A second ×3 set taken while load was still decaying from the 240 Hz run gives the same picture. | `gate0/bench-quiet.jsonl` (the decaying-load set is `gate0/bench.jsonl`) | — |
| **Room probes** (blast and hammer ×3, with the C2 energy column) | Jolt now has a room C2 number | **Blast, Jolt**: pieces over C2 3.5 cm: 2 / 1 / 2 (max 0.20 m); asleep 36/36 every run; max lift 0.016–0.09 m; launches 17–24. **Blast, own**: 13 / 13 / 15 over C2 (max 0.54 m); max lift 0.34–0.45 m. **Hammer, Jolt**: 3 / 0 / 2 over C2 (max 0.11 m); asleep 36–37 of 37; max rise 0.064–0.073 m, against 0.021–0.029 m for own. Hammer rest launches up to 1.71 m/s on Jolt. SwiftShader, not deterministic. | `gate0/room/{own,jolt}.{blast,hammer}.{1,2,3}.out` | — |

Raw files are under `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad/item6-escalation/` (`gate0/…`) and `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad/g0/`.

## T1: why 1/60 looked worse than 0.05

It was not a stepping bug. I traced the worst seeds update by update, then confirmed each cause with an A/B run.

1. **The memo's "runs with no fall-through still fail" were net re-lifts.** The old jsonl had no fell-through counter, and "lowest" was only read at the end, after the net had already put the piece back. Seed 31 at 1/60 (the 44 cm C2 case) is a plate falling through and being lifted back about 0.35 m.
2. **The main cause: the bowl's plates spawn with corners 1–4 cm inside the ground.** The ground is a one-sided surface, so those corners catch on its sides and the plates sink, fall through, or get spiked upward. Which seeds this hits shifts chaotically with dt. A/B on 28 seeds, height-field ground, without the lift: 7/28 fail at each dt and 3–4 fall through. With the lift: 0 and 1 fail.
3. **One bug in our kit layer:** the narrow-support topple rule restarted its "steady" timer whenever the contact points flickered at rest. This kept leaning plates pushed and awake forever and caused the C4 (sleep) failures at 1/60. Fixed.
4. **Rebuilding the ground as a new body every update** threw away the engine's contact cache, three times as often at 1/60. An A/B on the new ground shows no measurable effect, but the ground is now kept on the same bodies anyway.

The fall-through itself (a piece made through a one-sided surface sinking) is documented engine behaviour, so there is no engine repro for it. I did find a different, real engine issue in T5:

**Upstream issue for Jolt:** any body whose principal moments of inertia are below about 1e-6 kg·m² gets a 1 m sphere's inertia (0.4·m) instead of its own. A 4 g 9 mm casing came out at 1.6e-3 instead of 1.5e-7, about 10,000× too much, which is why no casing ever slept. Pure-Jolt repro: a cylinder of radius 5 mm and half-height 9.5 mm with mass 0.004 reports an inverse inertia of 625 on every axis. Our adapter now creates every dynamic body with its inertia 1e6× larger and writes the true value back right after.

## Go / no-go per blocker

- **B1: GO.** Two caveats. The new ground is a height field, which is still one-sided; only the step boxes are solid. The pass holds because pieces are never made inside the ground and the contacts stay warm. Nothing in the gate needed the net, a velocity clamp or forced sleep: the net fired 0 times, and the bowl uses no sleep budget. C1 is not clean at 8–10 iterations, so 20 is the safe setting.
- **B2: GO**, with thin margins (4.83 s against 5 s, 7.61 m against 8 m). The pass depends on modelling the grenade as drawn and on the rolling-resistance rule. One package test now fails: a standing can on a 10° ramp creeps 2.14 cm in 2 s against a 2 cm limit. The old kit rule hid this by damping its linear speed.
- **B3: GO with conditions.** It needs 20 velocity / 8 position passes on ragdolls. The pile sleeps only at sleep speed 0.08, and only just in time (9.47 s of 10).
- **B4 / C9: GO.**
- **B6: NO-GO** as written. The next options are moving the per-contact friction rule into a custom wasm build, or accepting a one-frame spike of about 12 ms when a large connected group wakes.
- **B5: Partial.** About 1.45× our median cost and 2× our p99. I could not set absolute budgets without an AMD run.
- **Overall: conditional GO.** B1, which blocked everything, passes. B6 fails, and the per-contact JavaScript friction callback is the shared cause behind the B5 and B6 spikes. That decision should go to the owner before phase 1.

## Package tests

- **`game-destruction-three`:** 14 fail. The spike had 15. Two fixed (wake-region; heavy can into a light one), one new (the standing can above). All the ground-related tests pass. The `engine-ground` tests were rewritten for the height field and step boxes, keeping the same promises.
- **`game-physics-jolt`:** all 17 tests in 8 files pass, including the new heap test and the cascade-tail case.
- **Seam bug, not fixed:** calling `setShape` on a dynamic body makes Jolt recompute its mass from the shape's density, so a piece that breaks loses the mass the kit gave it.

## Not verified

AMD, Firefox, ARM, the nightly GPU suite, the `leak.mjs` wasm probe, and the room on real GPU hardware (the probes ran on SwiftShader).

## Files

All in `/home/miyazaki/Documents/personal/adatechnology-game-kit-wt/engine-jolt/packages/`:
- `game-destruction-three/src/engine-ground.ts`
- `game-destruction-three/src/engine-pieces.ts`
- `game-physics-jolt/src/index.ts`
- `game-physics/src/index.ts`
- `game-physics-jolt/tests/heap.test.ts`