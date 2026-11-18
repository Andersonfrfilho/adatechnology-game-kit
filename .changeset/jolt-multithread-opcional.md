---
'@adatechnology/game-physics-jolt': minor
---

`createJoltEngine(options)` escolhe a build do Jolt: `single` (padrão, como antes) ou `multithread` (`wasm-compat-multithread`, precisa de
página isolada por origem), com `workerThreads` e `contactCallbacks`. Worker threads com os callbacks JS de contato do kit são recusados
(`JoltThreadingError`, `JOLT_WORKERS_WITH_JS_CALLBACKS`): o Jolt chama o listener a partir das threads de job, onde o objeto JS não existe, e o
passo quebra. Medição em `docs/medicoes/jolt-multithread.md`.
