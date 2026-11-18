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

## T7: chão da cratera pelo coordenador da sala (2026-11-18, contêiner, 4 threads, Chromium com GL por software)

Sala `?area=floorplan&solver=jolt&blastDebris=1` (coordenador da página, 3 workers: 1 `sim`, 2 `build`), casa `single_storey_a`, C4 no chão
solto ao lado da casa, 120 atualizações de 1/60 s com ritmo de 60 por segundo; `GroundSchedule.stats` e `workers.stats()` no fim:

| `inFlightPerWorker` | Telhas pedidas | Do worker a tempo | Feitas no quadro principal | Fila (soma) |
|---|---|---|---|---|
| 2 (antigo padrão) | 163 | 24 | 139 | 682 s |
| 16 | 153 | 153 | 0 | 1,7 ms |
| padrão novo (16) | 126 | 126 | 0 | 1,8 ms |

Com 2 por worker uma explosão pede dezenas de telhas de uma vez e elas só saem da fila quando a thread principal lê uma resposta, uma vez
por quadro num quadro ocupado: a rajada leva vários quadros de ida e volta e perde a atualização marcada. O padrão do coordenador passou
para 16 (`IN_FLIGHT_PER_WORKER`); a prioridade continua valendo para o que fica na fila. Antes desta medida o pacote `game-test-room`
construído estava velho e a sala nem entregava a porta ao motor: o `room-explosion` anterior (`jolt-d4-worker`) mediu o chão no quadro
principal. Print: `examples/test-room/shots/ground-coordinator-crater.png` (os destroços da parede assentados no chão feito pelo worker).
