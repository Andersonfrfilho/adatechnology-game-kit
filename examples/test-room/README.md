# Test room page (`examples/test-room`)

`node build.mjs` builds `dist/test-room.html`; `node leak.mjs` is the memory check of CLAUDE.md §8. Both run by hand, never in CI (§9).

## `leak.mjs`: the memory check

Repeats one cycle per phase (scenarios, or opening areas, then `room.clear()`) and fails when what is left after each cycle keeps growing: WebGL
buffers, vertex arrays, textures, framebuffers and programs, canvases after a GC, listeners, intervals, the JS heap (a heap snapshot) and, on Jolt,
the bodies the adapter and Jolt hold and the wasm heap in use.

```bash
node leak.mjs                          # every phase except `vehicle`
LEAK_PHASE=craters node leak.mjs       # one phase, or several split by commas
LEAK_ROUNDS=3 LEAK_WARMUP=2            # measured and warm-up cycles
```

The report goes to `dist/leak*.json`; exit code 1 when a budget fails.

## The vehicle memory probe (`LEAK_PHASE=vehicle`, spec 008 T6.25)

The vehicle room has no crashing car yet, so the phase brings its own: `leak-vehicle.mjs` is bundled by `leak.mjs` (esbuild, the packages from
their sources) and run in the page against the room's Jolt world (`window.__joltWorld`). One cycle: the car is made (kit, hulls, crash parts,
chassis body), it drives into a wall at 15 m/s, takes damage, loses its parts, and is removed whole (chassis, part bodies, wall, ground, kit
objects). The phase runs 3 cars a cycle, 2 warm-up cycles and 3 measured ones, and fails when:

- the probe car loses fewer than 10 parts (the crash did not happen);
- the wasm heap in use (`wasmMB`) grows more than 0.25 MB a cycle, the JS heap (`heapMB`) more than 2 MB, or `joltBodies`/`joltSystemBodies` grow at all.

It only runs when asked for, because it needs Jolt (do not set `LEAK_SOLVER=own`) and builds a bundle of its own:

```bash
cd examples/test-room && node build.mjs && LEAK_PHASE=vehicle node leak.mjs
```

The command for the owner is task T8.5 of spec 008. Written without a browser run: the first run may need the probe adjusted.
