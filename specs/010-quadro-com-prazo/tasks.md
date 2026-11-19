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
> 🤖 Modelo: `sonnet` (T0.3 é 🧠 — `opus`)

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
  juntos explicarem menos da metade.

## Fase 1 — Orçamento único pelo prazo do quadro
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 — `opus`, validar com `architect` antes de implementar; T1.4 → `haiku`)

- **T1.1 🧠** Desenho do prazo (D1, D3, D4) em `specs/010-quadro-com-prazo/design-prazo.md`: assinatura nova de `createFrameBudget` e do
  `createScheduler` (`targetMs`, estimativa do render, teto), como o `WorkBudget` desconta, e a tabela de todas as filas com fase,
  prioridade, `minEveryFrames` e reserva. Inclui a lista fechada dos relógios próprios (os do P1 mais o que
  `rg -n "performance\.now\(\)" packages/*/src` mostrar usado como prazo de trabalho adiado).
- **T1.2** `game-runtime`: prazo do quadro em `budget.ts` e `scheduler.ts` conforme a T1.1. Teste com relógio falso: simulação que gasta 10 ms
  de um alvo de 16,6 deixa no máximo o que sobra; `stats()` mostra o prazo e o gasto; a guarda de fome ainda roda uma unidade. API antiga
  (`budgetMs`) continua valendo como teto. Aceite: `pnpm --filter @adatechnology/game-runtime test`.
- **T1.3** `createStaticBatcher` (`game-render-three/src/static-batcher.ts`) expõe `deferredQueue()` com `attach`/`detach`; sem registro,
  drena por dentro com `budgetMs` como hoje. `checkDeferredQueue` no teste. De passagem, a comparação de matriz por malha juntada
  (`static-batcher.ts:211-217`) deixa de criar closure por quadro.
- **T1.4** Ids e prioridades novos em `game-contracts/src/frame.ts` (lotes estáticos, sombra da casa, lotes do veículo, destroços assentados,
  filme de fluido, oclusão do áudio, caixas estáticas, `prefit`), exatamente os da tabela da T1.1. Mecânica.
- **T1.5** Migrar para fila, um commit por dono, cada um com `checkDeferredQueue`: `house/shadow-batches.ts`, `vehicle-lod.ts`,
  `settled-batches.ts`, `renderer.ts` (`STATIC_REFRESH_SLICE_MS`, `PREFIT_SLICE_MS`), `film/manager.ts`, `occlusion-tracker.ts`, a
  suavização do amassado do veículo, e os `BATCH_BUDGET_MS` das áreas de teste (animais, personagens).
- **T1.6** A sala registra todas as filas no `scheduler.budget` e passa o `alvoMs` do monitor; `BATCH_BUDGET_MS` sai do `room.ts`. O
  `WorkBudget` recebe `tier` e teto do host (D4).
- **T1.7** Guarda: regra `own-frame-clock` no `tools/kit-audit` (constante `*_BUDGET_MS`/`*_SLICE_MS` ou `performance.now()` comparado com
  prazo fora de `game-runtime`), com lista de exceções vazia. Aceite: `node tools/kit-audit/audit.mjs --check` (C3).
- **T1.8** Medir (gate 5) e conferir a C2 na tempestade do `perf.mjs` (`budget.stats()` por quadro). Print da sala com os contadores.

## Fase 2 — Um passo fixo só e desenho interpolado
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 — `opus`)

- **T2.1 🧠** Lista fechada (D6) em `design-passo-fixo.md`: cada chamada de `simulateBeforeModules` e `simulateAfterModules`
  (`room.ts:4153` em diante) classificada como passo fixo ou quadro, com o motivo; o mesmo para os módulos de área que simulam.
  Decide o que acontece com `fastForward` (10 repetições) e com os cenários síncronos (`run.exact`).
- **T2.2** Teste de equivalência antes de mover: a mesma cena (explosão no sobrado, fogo, fluido derramado) simulada com `dt = 1/60` por
  quadro hoje e depois da mudança dá o mesmo hash de eventos e de estado. Fica no CI.
- **T2.3** `PhysicsLoop.stepFixed(steps)` em `game-physics/src/loop.ts` (D5); `step(dt)` passa a ser `stepFixed` com o próprio acumulador,
  para quem usa o laço sozinho. Teste: os dois caminhos dão a mesma sequência de `beforeStep`/`afterSteps`.
- **T2.4** A sala registra a simulação da T2.1 em `fixedSimulate` e o resto em `lateSimulate`; o `physicsLoop` é passado pelo agendador.
  Aceite: T2.2 verde, teste da ordem das fases (C4).
- **T2.5** Pose anterior e interpolação (D7) em `game-destruction-three`: peças (`pieces.ts`, `engine-pieces.ts`) e fragmentos
  (`fragments.ts`), atrás da opção `interpolate`. Teste: com `alpha` 0 e 1 a pose desenhada é a do passo anterior e a do atual; nenhuma
  alocação por quadro; a simulação não lê a pose desenhada.
- **T2.6** A sala liga `interpolate`. Teste C5 (60, 120 e 144 Hz, mesmo hash por passo). Regra §5 quando o que se move é o jogador ou a arma:
  conferir primeira e terceira pessoa com print.
- **T2.7** Medir (gate 5) e registrar também o histograma de passos por quadro a 60 e a 144 Hz.

## Fase 3 — Estrutura adiada e custo por peça acordada
> 🤖 Modelo: `sonnet` (T3.1 é 🧠 — `opus`, validar com `engenheiro-estrutural`)

- **T3.1 🧠** Estrutura adiada (D9) em `game-destruction/src/world.ts`: `partLost` (`:3020`) marca `o.dirty` e acumula as juntas abertas;
  a solução e os eventos de soltura saem uma vez por objeto no fim do `run()` (`:697-707`). Contador de `solveStructure` no teste da explosão
  de 4 MJ no sobrado (C7). **Parar e perguntar** se o hash de eventos de algum teste mudar: não regravar golden.
- **T3.2** `solveStructure` (`world.ts:1259-1310`) e `recomputeGroups` (`:883`) sem alocação por chamada: `edges`, `through`, `bending` e o
  union-find reaproveitados por objeto. Mesmo hash. De passagem: as três cópias de `objects` por `world.update` (`:5891-5893`) e a de
  `revealHostedIn` (`:3016`).
- **T3.3** Lista `awake` no sistema de peças (D8): `prepare` (`engine-pieces.ts:472-502`), `finish`/`readBack` (`:517`, `:1416`) e
  `measure` (`pieces.ts`) percorrem só as acordadas; o sono do motor lido em lote. Teste C6 com `world` falso que conta chamadas.
- **T3.4** `readPose` e `readVelocity` do adaptador (`game-physics-jolt/src/world.ts:459-482`) lendo do heap como `friction.ts` (`vec3At`),
  uma travessia por corpo. Teste: mesmos bytes do caminho antigo em 1.000 corpos.
- **T3.5** `syncTransforms` e os laços por objeto do `renderer.ts` (`:1083-1108`, `:1263-1296`) e do `fragments.update`
  (`fragments.ts:503-555`) só no que mudou no passo; `matrixAutoUpdate = false` em peça e objeto parado (com `discardObject3D` intacto, §8).
- **T3.6** Medir (gate 5) e a bancada da C6 (500 e 5.000 peças dormindo).

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
Modelos: Fase 0 → executor model=sonnet · T0.3 🧠 → opus · Fase 1 → executor model=sonnet · T1.1 🧠 → opus (validar com architect) ·
T1.4 → executor model=haiku · Fase 2 → executor model=sonnet · T2.1 🧠 → opus · Fase 3 → executor model=sonnet ·
T3.1 🧠 → opus (validar com engenheiro-estrutural) · Fase 4 → executor model=sonnet · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit + commit isolado, evidência em evidence.md.
Medição de tempo só com flock ~/.cache/adatechnology-game-kit/perf-measure.lock, carga abaixo de 4, na variante padrão; nunca no CI.
Pare e pergunte antes de: seguir depois da T0.3 se a régua desmentir a ordem, regravar qualquer golden ou hash de eventos,
mudar um padrão que hoje é síncrono, push e abertura de PR.
```
