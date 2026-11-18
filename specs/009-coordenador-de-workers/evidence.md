# Evidência — Spec 009

## 2026-11-18 — Fase A (container, sem GPU)

- `pnpm --filter @adatechnology/game-workers test`: 15 passando, incluindo `worker_threads` (mesmos bytes; worker que morre é substituído).
- `game-crowd` `tests/physics/coordinator.test.ts`: 600 agentes, 300 passos, hash do estado igual ao protocolo `inline` sem worker, com
  worker a tempo (≥ 90% a tempo), com worker sempre atrasado e com `worker_threads` em latência 1 e 2. Suíte da multidão: 122 passando.
- `examples/crowd-test-area/test.mjs` (Chromium com GL por software): 3 workers sobem e conhecem `crowd.physics`; a horda passa por eles;
  todas as checagens da área passam. Com GL por software cada quadro leva ~1,8 s e todo passo cai no quadro principal (mesmo resultado):
  a fração a tempo é medida no helios (T5). Print: `examples/crowd-test-area/shots/crowd-workers-pt-BR.png`.

## T22: thread de simulação (2026-11-18, contêiner, Chromium com GL por software)

`node examples/crowd-test-area/sim-thread.mjs 1500` (página servida de `localhost` com COOP/COEP, 20 quadros medidos em cada modo):

| | Horda nesta thread | Horda na thread de simulação (`?sim=thread`) |
|---|---|---|
| Passo da multidão na thread principal, média | 9,27 ms | 0,52 ms (só copiar o retrato) |
| p99 | 105,5 ms | 11,3 ms |
| Passo na thread de simulação | n/a | 1,13 ms de média, 15 259 passos em 250 s (61/s), 0 atrasos descartados |

A thread anda no relógio dela (60 passos por segundo) enquanto o GL por software desenha um quadro em segundos: no fim ela já simulou um
minuto da horda sobre um jogador que não morre (o alvo espelhado só soma o dano), e parte dos agentes foi esmagada, por isso o print mostra
460. A medida no helios (GPU, trava `perf-measure.lock`, carga abaixo de 4) fica para a rodada com a 4280.

Testes byte a byte: `packages/game-workers/tests/sim-thread.test.ts` (laço inline contra `worker_threads`, com jobs aguardados em workers
aninhados) e `packages/game-crowd/tests/sim/horde-sim.test.ts` (horda de 400 agentes com física, 120 passos e uma explosão: mesmos bytes
na thread e no laço inline).
