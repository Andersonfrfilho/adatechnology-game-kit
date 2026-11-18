---
'@adatechnology/game-crowd': minor
---

Enable the contact/pressure worker by default (`physics.worker` is now `'auto'` instead of `'off'`).

When a `Worker` can be made (browser with `import.meta.url`, or a custom `workerFactory`), the contact and the pressure run one step behind in a worker, freeing the main thread. When it cannot (Node without a factory, the IIFE build, or a restricted context), the package falls back to the in-thread path silently — same behavior as the previous `'off'` default.

The worker uses the same solver functions as the inline path, so the results are deterministic and identical (see `tests/physics/worker-equivalence.test.ts`).
