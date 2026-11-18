# @adatechnology/game-workers

The coordinator of every worker of a game: how many workers (by the machine's cores, or by hand), which lane each kind of job runs in (`sim`, `build`, `background`), priority and due frame, and the same kernel on the main thread when a worker is late or missing, so physics stays deterministic. Browser module workers, one-file pages (Blob URL), Node `worker_threads`, or none. Rule: CLAUDE.md §14.

API, uso e exemplos: `packages/game-workers/README.md`; testes em `packages/game-workers/tests/`. Contratos (`WorkerCoordinator`, `TaskKind`, `ResidentKind`, `WORKER_KIND_DEFAULTS`) em `packages/game-contracts/src/workers.ts`. Primeira categoria migrada: `crowd.physics` (`packages/game-crowd/src/physics/offload/kind.ts`).

Thread de simulação (spec 009, T22): `installSimThread` no arquivo do worker, `startSimThread` na página, `runSimInline` como referência e
fallback; memória compartilhada em `src/shared.ts` (buffer triplo de retratos, anel de comandos). Primeiro módulo: `hordeSimModule`
(`packages/game-crowd/src/sim/horde.ts`), na sala com `?sim=thread` (`examples/crowd-test-area/sim-thread.mjs` mede e grava os prints).

Para configurar um projeto (navegador, Electron, Node, celular), use a ferramenta `kit_workers` do MCP `game-kit` ou a tabela
"Choosing a setup by project" do README.
