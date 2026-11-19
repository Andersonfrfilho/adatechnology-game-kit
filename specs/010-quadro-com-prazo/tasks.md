# Tasks — Spec 010, quadro com prazo

Leia `spec.md`, `plan.md` e `specs/regras/15-quadro-e-desempenho.md` antes de começar. Uma task por vez, na ordem. Trabalhe num worktree
próprio (`../adatechnology-game-kit-wt/<nome>`), nunca na pasta compartilhada.

Cada task responde: **Mecânica?** (o que fazer está todo descrito) e **Aceite por comando?** (um comando diz se passou). Duas vezes "sim" →
`haiku`. 🧠 = task que produz decisão herdada por outras.

## Gates de toda task

1. Typecheck dos pacotes tocados (`pnpm --filter <pacote> typecheck`) e `pnpm -r typecheck` ao fim de cada fase.
2. Testes sem GPU dos pacotes tocados (`pnpm --filter <pacote> test`); arquivos de golden sem diff (`git status` limpo neles).
3. Lint dos arquivos alterados; `pnpm check:layers`; `node tools/kit-audit/audit.mjs --check`.
4. Falha "pré-existente" só se compara com a `origin/main` atual, nunca com a base da branch.
5. Task que muda tempo de quadro: medição do `plan.md` ("Medição") antes e depois, tabela e JSON no `evidence.md`. Sem tabela, não fecha.
6. Commit isolado por task; uma linha no `evidence.md` com o que foi feito, o comando do aceite e o resultado.
7. `wc -l packages/game-test-room/src/room.ts` não cresce (5.620 em 2026-11-18).

## Fase 0 — Régua
> 🤖 Modelo: `sonnet` (T0.3 é 🧠 — `opus`; T0.4 → `sonnet`)

- **T0.1** Variante padrão no portão. Em `tools/gpu/room-explosion.mjs`, a variante usada quando `ROOM_EXPLOSION_VARIANTS` não vem passa a ser
  a que a página usa por padrão (`jolt-d4-worker`, ritmada); `jolt-d4` continua disponível pelo nome. Atualizar o cabeçalho do arquivo e o
  comentário em `perf-gate.mjs`. Aceite: `node --check` nos dois e o teste em `tools/gpu/tests`.
- **T0.2** Medir e gravar a régua (gate 5): `blast`, `hammer` e `crater`, 1x e 4x, `ROOM_EXPLOSION_FRAME_PARTS=1`, 5 rodadas, na
  `origin/main`. Gravar `medicoes/regua-<commit>.json` e, no `evidence.md`, as duas tabelas (estágios da física e resto do quadro) com p99,
  pior quadro e os três piores quadros divididos por rótulo. Junto, três contagens tiradas na mesma página (instrumentação temporária, não
  commitada): chamadas de `solveStructure` por explosão, quadros com 0, 1 e 2+ passos fixos, e a soma por quadro do tempo gasto pelos
  relógios próprios da tabela P1 do `spec.md`.
- **T0.3 🧠** Ler a régua contra P1, P2 e P3. Escrever no `evidence.md` quanto do pior quadro cada causa explica e confirmar ou trocar a ordem
  das fases e a meta C8. **Parar e perguntar ao dono** se um módulo fora da lista explicar mais de um terço do pior quadro, ou se P1, P2 e P3
  juntos explicarem menos da metade. **Fechada em 2026-11-19** com as decisões do dono (`evidence.md`, "Decisões do dono"): C8 nova, ordem
  P1 → P3 → P2, passo `h = 1/120`, f0 na meta (T0.4).

- **T0.4** A régua cobre o quadro 0 inteiro (decisão do dono, 2026-11-19: o f0 entra na meta). Em `tools/gpu/room-explosion.mjs`, abrir o
  relógio do f0 antes de `room.blastAt`/`room.world.hit`, para o `world.explode`/`hit` síncrono (e os `solveStructure`) caírem nele, mantendo
  a coluna antiga (`wakeFrame`) para comparar com a T0.2. Dar dono ao `rest` do f0 com `FRAME_LABELS` novos: `flush()` do fim do quadro
  (`room.ts:770`), `updatePresent`, o próprio `explode`/`hit` e os relógios próprios sem rótulo (lotes da sala, `vehicleHit`, caixas estáticas,
  oclusão do áudio), medidos pelo lado da sonda; gancho em `packages/` só se inevitável, sem custo fora da medição, e sem crescer
  `room.ts`. Nenhum padrão síncrono muda. Aceite: `node --check`, testes de `tools/gpu/tests`, gates e uma medição igual à da T0.2 gravada em
  `medicoes/regua-t04-<commit>.json`, com o f0 dividido por rótulo no `evidence.md`.

## Fase 1 — Orçamento único pelo prazo do quadro
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 — `opus`, **validada pelo `architect` em 2026-11-19**; T1.4 → `haiku`; T1.9 → `sonnet`; T1.10 → `sonnet`)

- **T1.1 🧠** Desenho do prazo (D1, D3, D4) em `specs/010-quadro-com-prazo/design-prazo.md`: assinatura nova de `createFrameBudget` e do
  `createScheduler` (`targetMs`, estimativa do render, teto), como o `WorkBudget` desconta, e a tabela de todas as filas com fase,
  prioridade, `minEveryFrames` e reserva. Inclui a lista fechada dos relógios próprios (os do P1 mais o que
  `rg -n "performance\.now\(\)" packages/*/src` mostrar usado como prazo de trabalho adiado).
- **T1.2** `game-runtime`: prazo do quadro em `budget.ts`, `scheduler.ts` e `loop.ts` conforme a T1.1. `startLoop` passa o `nowMs` do rAF como
  `FrameRunOptions.frameStartMs`; o modo deadline é **opt-in por quadro** (só com `targetMs` e `frameStartMs`), todo outro quadro (headless,
  `advance()`, ~170 testes) fica na cota de hoje, com dívida; no deadline não há dívida. Classe `mustDrain` (`destruction.events`,
  `floorplan.breach-cut`): drena inteira fora do prazo, contada à parte (`mustDrainSpentMs`). Reservas saem do piso no `drain('present')` e
  `register` recusa Σ reservas > `minMs`. Estimativa do render com amostra grampeada em `[0, targetMs]`, pulando quadro em que o pacer pulou o
  render ou o aquecimento rodou. Testes com relógio falso: os 19 casos da seção 7 do `design-prazo.md`, incluindo a C2 reescrita
  (`spent ≤ max(restante, piso) + 1 unidade que cruza + Σ forçadas`, sem `mustDrain`; emenda da seção 9). API antiga (`budgetMs`) continua
  como teto. Aceite: `pnpm --filter @adatechnology/game-runtime test`.
- **T1.3** Filas de lote **uma por dono**, não por instância: `static-batcher.ts` (`game-render-three`) ganha
  `createStaticBatchQueue({ id })` (rodízio entre os batchers, como `createCreaseQueue`) e `createStaticBatcher(…, { queue })`. Unidade = o
  chunk que já existe (`maxVertices`, `:142-155`), **sem fatiar por vértice**. Medir o lote do veículo na régua e tentar, nesta ordem: laço de
  cópia mais rápido (`copyAttribute` por `getX` por vértice, `:240-260`; alocações por grupo, `:315-329`) e `HIT_BATCH_VERTICES` menor. Fatiar
  só se a régua com carga baixa ainda mostrar a unidade acima do orçamento (então as 4 garantias do `design-prazo.md` seção 5). Sem fila, drena
  por `drainDetached` com `budgetMs` como hoje. `checkDeferredQueue` no teste. De passagem, a comparação de matriz por malha juntada
  (`:211-217`) deixa de criar closure por quadro.
- **T1.4** Ids e prioridades novos em `game-contracts/src/frame.ts` (lotes estáticos, sombra da casa, lotes do veículo, destroços assentados,
  filme de fluido, oclusão do áudio, caixas estáticas, `prefit`), exatamente os da tabela da T1.1, mais `drainDetached` e o campo `mustDrain` das opções de registro. Mecânica.
- **T1.5** Migrar para fila, um commit por dono, cada um com `checkDeferredQueue`: `house/shadow-batches.ts`, `vehicle-lod.ts`,
  `settled-batches.ts`, `renderer.ts` (`STATIC_REFRESH_SLICE_MS`, `PREFIT_SLICE_MS`), `film/manager.ts`, `occlusion-tracker.ts`, a
  suavização do amassado do veículo, e os `BATCH_BUDGET_MS` das áreas de teste (animais, personagens). Toda fila nova tem o padrão sem host
  por `drainDetached` (D2). `STATIC_REFRESH_SLICE_MS` vira contagem fixa por `update` (decisão D: não é fila; **parar e perguntar** se um
  hash de eventos mudar). Quando o `prefit` tiver fila própria, `destruction.events` para de somar `prefitLeft()` no `pending` (`renderer.ts:451`).
- **T1.6** A sala registra todas as filas no `scheduler.budget` e passa o `alvoMs` do monitor; `BATCH_BUDGET_MS` sai do `room.ts`. O
  `WorkBudget` recebe `tier` e teto do host (D4). `destruction.events` e `floorplan.breach-cut` registradas como `mustDrain` (decisão A).
- **T1.7** Guarda: regra `own-frame-clock` no `tools/kit-audit` (constante `*_BUDGET_MS`/`*_SLICE_MS` ou `performance.now()` comparado com
  prazo fora de `game-runtime`), com lista de exceções vazia (aceita `drainDetached`; classifica os `Date.now` de `crowd/offload/runner.ts`,
  `nursery.ts` e `zone-layer.ts` como espera de worker, medição e animação). Aceite: `node tools/kit-audit/audit.mjs --check` (C3).
- **T1.8** Medir (gate 5) e conferir a C2 (texto emendado) na tempestade do `perf.mjs` (`budget.stats()` por quadro: `overMs`, `forcedThisFrame`,
  `mustDrainSpentMs`). Print da sala com os contadores.
- **T1.9** (decisão C do dono) Achar por que uma consulta de oclusão do áudio custa até 9,2 ms depois da cratera (o raio atravessa o mundo da
  destruição; `occlusion-tracker.ts:90`, `:109`): perfilar a `query` na régua, achar o dono do custo (índice refeito, travessia de objetos) e
  dividir o custo nele (trabalho fatiado ou incremental no dono). Só se não der, `nextUnitMs` opcional em `DeferredQueue` (guarda de fome o
  ignora; filas do `WorkBudget` não o implementam). Aceite: medição (gate 5) com a consulta p99 abaixo de 1 ms em `crater`; testes do dono.
- **T1.10** (decisão B do dono) Campo de fluxo da multidão em unidades por padrão: `cellsPerStep` no lugar de `flowBudgetMs`/`clock() − t0`
  (`game-crowd/src/crowd.ts:413`, `:457`; `data/defaults.json:29`). **Parar e perguntar** se algum golden ou hash da multidão mudar. Aceite:
  testes do `game-crowd` e dos pacotes que o usam, goldens sem diff, e o relógio do fluxo fora da tabela P1.


## Fase 2 — Estrutura adiada e custo por peça acordada
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 — `opus`, validar com `engenheiro-estrutural`)

- **T2.1 🧠** Estrutura adiada (D9) em `game-destruction/src/world.ts`: `partLost` (`:3020`) marca `o.dirty` e acumula as juntas abertas;
  a solução e os eventos de soltura saem uma vez por objeto no fim do `run()` (`:697-707`). Contador de `solveStructure` no teste da explosão
  de 4 MJ no sobrado (C7). **Mesma regra no desenho** (decisão do dono, 2026-11-19): `splitLoose`, `adoptSplit` e `rebuildHost` do
  `game-destruction-three/src/renderer.ts` (`:1570`, `:2120`, rótulo `stagesOut`) rodam uma vez por objeto por drenagem de eventos, não uma vez
  por evento `detach`/`collapse`; é o maior rótulo de P3 no golpe (4,7 a 6,9 ms a 1x). **Parar e perguntar** se o hash de eventos de algum teste
  mudar: não regravar golden.
- **T2.2** `solveStructure` (`world.ts:1259-1310`) e `recomputeGroups` (`:883`) sem alocação por chamada: `edges`, `through`, `bending` e o
  union-find reaproveitados por objeto. Mesmo hash. De passagem: as três cópias de `objects` por `world.update` (`:5891-5893`) e a de
  `revealHostedIn` (`:3016`).
- **T2.3** Lista `awake` no sistema de peças (D8): `prepare` (`engine-pieces.ts:472-502`), `finish`/`readBack` (`:517`, `:1416`) e
  `measure` (`pieces.ts`) percorrem só as acordadas; o sono do motor lido em lote. Teste C6 com `world` falso que conta chamadas.
- **T2.4** `readPose` e `readVelocity` do adaptador (`game-physics-jolt/src/world.ts:459-482`) lendo do heap como `friction.ts` (`vec3At`),
  uma travessia por corpo. Teste: mesmos bytes do caminho antigo em 1.000 corpos.
- **T2.5** `syncTransforms` e os laços por objeto do `renderer.ts` (`:1083-1108`, `:1263-1296`) e do `fragments.update`
  (`fragments.ts:503-555`) só no que mudou no passo; `matrixAutoUpdate = false` em peça e objeto parado (com `discardObject3D` intacto, §8).
- **T2.6** Medir (gate 5) e a bancada da C6 (500 e 5.000 peças dormindo).

## Fase 3 — Um passo fixo só e desenho interpolado
> 🤖 Modelo: `sonnet` (T3.1 é 🧠 — `opus`, validar com `engenheiro-estrutural`)

Passo único `h = 1/120` (decisão do dono, 2026-11-19): o agendador adota o `fixedStep` do `KIT_WORLD` (`game-physics/src/contract.ts:266`); o
comportamento da física e os goldens não mudam. O valor desta fase é correção (C4, C5, 144 Hz), não ms.

- **T3.1 🧠** Lista fechada (D6) em `design-passo-fixo.md`: cada chamada de `simulateBeforeModules` e `simulateAfterModules`
  (`room.ts:4153` em diante) classificada como passo fixo ou quadro, com o motivo; o mesmo para os módulos de área que simulam.
  Decide o que acontece com `fastForward` (10 repetições) e com os cenários síncronos (`run.exact`). Fixa `h = 1/120` no agendador.
- **T3.2** Teste de equivalência antes de mover: a mesma cena (explosão no sobrado, fogo, fluido derramado) simulada com `dt = 1/60` por
  quadro (dois passos de 1/120) hoje e depois da mudança dá o mesmo hash de eventos e de estado. Fica no CI.
- **T3.3** `PhysicsLoop.stepFixed(steps)` em `game-physics/src/loop.ts` (D5); `step(dt)` passa a ser `stepFixed` com o próprio acumulador,
  para quem usa o laço sozinho. Teste: os dois caminhos dão a mesma sequência de `beforeStep`/`afterSteps`.
- **T3.4** A sala registra a simulação da T3.1 em `fixedSimulate` e o resto em `lateSimulate`; o `physicsLoop` é passado pelo agendador.
  Aceite: T3.2 verde, teste da ordem das fases (C4).
- **T3.5** Pose anterior e interpolação (D7) em `game-destruction-three`: peças (`pieces.ts`, `engine-pieces.ts`) e fragmentos
  (`fragments.ts`), atrás da opção `interpolate`. Teste: com `alpha` 0 e 1 a pose desenhada é a do passo anterior e a do atual; nenhuma
  alocação por quadro; a simulação não lê a pose desenhada.
- **T3.6** A sala liga `interpolate`. Teste C5 (60, 120 e 144 Hz, mesmo hash por passo). Regra §5 quando o que se move é o jogador ou a arma:
  conferir primeira e terceira pessoa com print.
- **T3.7** Medir (gate 5) e registrar também o histograma de passos por quadro a 60 e a 144 Hz.

## Fase 4 — Fechamento
> 🤖 Modelo: `sonnet` (revisão final → `code-reviewer` `sonnet`)

- **T4.1** Régua final nas mesmas condições da T0.2; tabela antes e depois no `evidence.md` (C8). Uma rodada com `PERF_MODE=gpu` do
  `perf.mjs` para conferir que tempestade, `dense_horde` e `chain_horde` não pioraram contra a `origin/main`.
- **T4.2** Documentação: `docs/desempenho-explosoes.md` (seção nova com as três causas e os números), README do `game-runtime` (prazo, filas,
  passo fixo, interpolação) e a referência da skill `kit-base`. Riscar em `docs/desempenho-explosoes.md` a pendência "a ordem do quadro não
  tem dono".
- **T4.3** Conferir a regra §15 contra o que foi entregue e ajustar o texto se algum nome mudou; atualizar no `tasks.md` das specs 005, 008 e
  009 as tasks que esta spec fechou ou tornou obsoletas (T4.1 passo 6/7 da 005; a nota de `jolt-d4` na 008).

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/010-quadro-com-prazo/ (leia spec.md, plan.md, tasks.md e
specs/regras/15-quadro-e-desempenho.md antes de começar). Uma task por vez, na ordem do tasks.md, num worktree próprio.
Modelos: Fase 0 → executor model=sonnet (T0.4 incluída) · T0.3 🧠 → opus · Fase 1 → executor model=sonnet · T1.1 🧠 → opus (validar com architect) ·
T1.4 → executor model=haiku · Fase 2 → executor model=sonnet · T2.1 🧠 → opus (validar com engenheiro-estrutural) · Fase 3 → executor model=sonnet ·
T3.1 🧠 → opus · Fase 4 → executor model=sonnet · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit + commit isolado, evidência em evidence.md.
Medição de tempo só com flock ~/.cache/adatechnology-game-kit/perf-measure.lock, carga abaixo de 4, na variante padrão; nunca no CI.
Ordem das fases: 1 (P1) → 2 (estrutura e peça acordada, P3) → 3 (passo 1/120 e interpolação, P2).
Pare e pergunte antes de: seguir depois da T0.3 se a régua desmentir a ordem, regravar qualquer golden ou hash de eventos,
mudar um padrão que hoje é síncrono, push e abertura de PR.
```
