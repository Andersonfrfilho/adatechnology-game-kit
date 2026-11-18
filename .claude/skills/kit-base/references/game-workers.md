# @adatechnology/game-workers

The coordinator of every worker of a game: how many workers (by the machine's cores, or by hand), which lane each kind of job runs in (`sim`, `build`, `background`), priority and due frame, and the same kernel on the main thread when a worker is late or missing, so physics stays deterministic. Browser module workers, one-file pages (Blob URL), Node `worker_threads`, or none. Rule: CLAUDE.md §14.

API, uso e exemplos: `packages/game-workers/README.md`; testes em `packages/game-workers/tests/`. Contratos (`WorkerCoordinator`, `TaskKind`, `ResidentKind`, `WORKER_KIND_DEFAULTS`) em `packages/game-contracts/src/workers.ts`. Primeira categoria migrada: `crowd.physics` (`packages/game-crowd/src/physics/offload/kind.ts`).
