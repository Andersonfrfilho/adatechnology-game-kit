# Spec 010 — Quadro com prazo: régua, orçamento único, passo fixo e custo por peça acordada

Origem: análise de arquitetura e desempenho de 2026-11-18, pedida pelo dono. Ela achou que os planos de desempenho (specs 005, 006, 008 e 009)
pararam no meio e que os ~30 PRs `perf(...)` mais recentes atacaram sintomas (pintura de parede, lotes, sombra). O pior quadro continua vindo
de três causas de estrutura que nenhum deles toca, e nenhuma delas tem número registrado no repositório. Regra que fica: `CLAUDE.md` §15 e
[`specs/regras/15-quadro-e-desempenho.md`](../regras/15-quadro-e-desempenho.md).

## Problema

Medido em 2026-11-17 ([`docs/medicoes/jolt-multithread.md`](../../docs/medicoes/jolt-multithread.md)): o passo do Jolt gasta 0,25 a 0,55 ms de
um update de 2 a 3 ms; o p99 do update (13 a 17 ms) e o pior quadro (24 a 38 ms) vêm do lado JS. Lido no código em 2026-11-18:

| # | Causa | Onde (main de 2026-11-18) |
|---|---|---|
| P0 | **Não há régua.** A divisão do quadro por módulo só existe em descrições de PR marcadas "indicativo" (carga 4 a 9 ou GL por software). O portão mede `jolt-d4` (`groundWorker=0`), que nenhuma página usa por padrão | `tools/gpu/room-explosion.mjs` (`VARIANTS`), `specs/008-motor-fisico-jolt/evidence.md` |
| P1 | **Os orçamentos se somam.** O `FrameBudget` começa todo quadro com 8 ms cheios, sem descontar o que a simulação já gastou, e por fora dele correm relógios próprios: lotes da sala (1 ms por lote), sombra da casa (2 ms por casa), lotes do veículo (2 ms por veículo), destroços assentados (2 ms), filme de fluido (1,2 ms), oclusão do áudio (1 ms), caixas estáticas (1 ms), `prefit` (1 ms), suavização do amassado (2,5 ms) | `game-runtime/src/budget.ts:31`, `game-test-room/src/room.ts:162` e `:4068`, `game-floorplan-three/src/house/shadow-batches.ts:12`, `game-vehicles-three/src/vehicle-lod.ts:13`, `game-destruction-three/src/settled-batches.ts:29` e `renderer.ts:107`/`:131`, `game-fluids-three/src/film/manager.ts:16`, `game-audio/src/occlusion-tracker.ts:60` |
| P2 | **A simulação tem dois relógios e o desenho não interpola.** O agendador tem acumulador e `alpha`; o `PhysicsLoop` tem outro acumulador e outro `alpha`. A sala roda tudo em `lateSimulate` com o `dt` do quadro (`world.update(dt)`, `renderer.update(dt)`), a fase `fixedSimulate` só tem a bancada da multidão, e ninguém lê nenhum dos dois `alpha` | `game-runtime/src/scheduler.ts:60-76`, `game-physics/src/loop.ts:64-83`, `game-test-room/src/room.ts:4153-4171` e `:5533` |
| P3 | **O custo por quadro é por peça viva, não por peça acordada**, e a estrutura é resolvida de novo a cada parte perdida. `prepare` percorre a lista de peças várias vezes com `links.get`, `measure()` roda duas vezes por quadro sobre todas, `readBack` chama o wasm (`isSleeping`) por peça dormindo, `readPose`/`readVelocity` cruzam o wasm ~17 vezes por corpo, `syncTransforms` decompõe a matriz de todo objeto ligado; `partLost` chama `solveStructure` + `recomputeGroups` no objeto inteiro a cada parte, embora o adiamento (`o.dirty`) já exista | `game-destruction-three/src/engine-pieces.ts:472-517` e `:1416-1423`, `pieces.ts:418-456`, `renderer.ts:1263-1296`, `game-physics-jolt/src/world.ts:459-482`, `game-destruction/src/world.ts:3020-3029`, `:1259`, `:5216`, `:5364` |

## Objetivo

O quadro tem um dono só para o tempo: tudo que é adiado cabe no que sobra do quadro, a simulação anda num passo só, o desenho interpola, e o
custo de um quadro depende do que está se mexendo. Cada ganho fica provado por uma tabela gravada, na configuração que a página usa.

## Critérios de aceite

| # | Critério | Como se prova |
|---|---|---|
| C1 | Existe uma régua gravada: tabela por módulo (`FRAME_LABELS` + estágios), na configuração padrão da página, com a trava e carga abaixo de 4, antes e depois de cada fase | `evidence.md` com o JSON ao lado em `specs/010-quadro-com-prazo/medicoes/`; `node tools/gpu/perf-gate.mjs room-explosion` com a variante padrão |
| C2 | Um orçamento só: o trabalho adiado de um quadro nunca passa do que sobrou até o prazo do quadro (fora a unidade mínima da guarda de fome) | teste do `game-runtime` com relógio falso; `budget.stats()` na tempestade do `perf.mjs`: 0 quadros com `spentMs` acima do prazo + 1 unidade |
| C3 | Nenhum relógio próprio de trabalho adiado fora do `game-runtime` | `node tools/kit-audit/audit.mjs --check` com a regra nova `own-frame-clock` (lista de exceções vazia no fim da fase 1) |
| C4 | Um acumulador só: o passo fixo da física é o do agendador; a sala simula em `fixedSimulate` | teste da ordem das fases no `game-runtime`; `rg "accumulator" packages/game-physics/src/loop.ts` vazio ou delegando; a sala registra `room.simulate` em `fixedSimulate` |
| C5 | O desenho interpola a pose das peças e dos fragmentos pelo `alpha` do agendador; a simulação não muda | teste: mesma sequência de `dt` a 60, 120 e 144 Hz dá o mesmo hash de estado por passo; print da sala a 144 Hz e a 60 Hz |
| C6 | Custo do update por quadro proporcional às peças acordadas: com N peças dormindo e 0 acordadas, o tempo do sistema de peças e as chamadas ao wasm não crescem com N | teste de contagem (`world` falso que conta chamadas): 0 chamadas por peça dormindo; bancada com 500 e 5.000 peças dormindo, diferença dentro do ruído |
| C7 | A estrutura é resolvida uma vez por objeto por `run()`, não uma vez por parte perdida, com o mesmo resultado | contador de `solveStructure` no teste da explosão do sobrado; mesmo hash de eventos; `tests/construction.test.ts` dos pacotes de tipologia; agente `engenheiro-estrutural` |
| C8 | Meta de tempo na régua (helios, variante padrão, 1x): p99 do update inteiro ≤ 8 ms e pior quadro ≤ 16,6 ms em `blast`, `crater` e `hammer`, fora do quadro de despertar; a 4x de throttle o pior quadro não piora em relação à régua da T0.2 | `evidence.md`, tabela final contra a T0.2. A T0.3 confirma a meta com o dono; se a régua mostrar outra causa dominante, a spec muda antes de seguir |
| C9 | Nada quebra para quem usa a API direto: goldens iguais, padrões síncronos como hoje | `pnpm test` dos pacotes tocados; arquivos de golden sem diff |

## Fora do escopo

- Ligar o Jolt como padrão da sala e apagar o solver próprio (spec 008, T3.9, T3.10 e T8.1). Esta spec mede e corrige o caminho Jolt e não
  piora o solver próprio; não investe nele.
- Dano do carro em fatias e geometria mais leve do sedã (spec 006, fases 4 a 6).
- Encolher o `room.ts` (spec 005, fase 6). Aqui ele só não pode crescer (§15).
- Mover a destruição para worker, WebGPU, `BatchedMesh`, SoA para `PartRT`: avaliados em 2026-11-18 e deixados para depois desta spec.
- Novas categorias de worker (spec 009): congeladas até a C8 fechar.
