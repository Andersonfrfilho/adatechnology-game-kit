# Evidence — Spec 010

## T0.1 — room-explosion gate measures the page default (jolt-d4-worker)

- `tools/gpu/room-explosion.mjs`: new `DEFAULT_VARIANT = 'jolt-d4-worker'` is the default of `ROOM_EXPLOSION_VARIANTS`, the default of `ROOM_EXPLOSION_STAGE_VARIANT` and the only gated variant (blocks on regression; `jolt-d4` is now a reference row, still selectable by name). Pacing already follows `groundWorker=1`.
- A base report without `jolt-d4-worker` cells does not crash: a missing base cell is "not a regression" (`cellRegressed(cell, undefined)`).
- Comments updated in `room-explosion.mjs` and `tools/gpu/perf-gate.mjs`; test added in `tools/gpu/tests/room-explosion-verdict.test.mjs`.
- `node --check tools/gpu/room-explosion.mjs && node --check tools/gpu/perf-gate.mjs`: pass.
- `node --test tools/gpu/tests/*.test.mjs`: 40 pass, 0 fail.
- `node tools/kit-audit/audit.mjs --check`: 0 new, 11 known pending, 15 allowed.
- `pnpm check:layers`: not run to completion, `depcruise` not installed in this worktree (no node_modules); the change touches no `packages/*/src`.
- No GPU measurement run.
