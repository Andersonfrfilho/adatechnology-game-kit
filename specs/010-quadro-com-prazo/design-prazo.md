# Desenho do prazo do quadro (T1.1, D1, D3, D4)

Lido no código em 2026-11-19, base `dd23c22ff` mais o diff não commitado da T0.4 (`systemProbe`). Decide o que T1.2 a T1.10 implementam.
**T1.1 validada pelo `architect` em 2026-11-19 (APPROVE WITH CHANGES, todas aplicadas abaixo) e pelas decisões A a D do dono da mesma data.**
Nada aqui muda um padrão síncrono (D2): sem `frameStartMs` o orçamento é a cota de hoje, sem host cada fila drena por dentro como hoje.

## 1. `createFrameBudget` e `createScheduler`

### Modos

| Modo | Quando | Comportamento |
|---|---|---|
| `quota` (hoje) | `targetMs` ausente **ou** o quadro não traz `frameStartMs` | Igual ao `budget.ts` atual: `ms` cheios por quadro, reservas, **dívida**, guarda de fome. Os testes atuais de `budget.test.ts` e os ~170 arquivos de teste, a sala headless (`scheduler.frame(dt, { render: false, exact: true })`, `room.ts:5236`) e os goldens por `advance()` ficam sem mudança. |
| `deadline` (novo) | `targetMs` definido **e** o quadro traz `frameStartMs` | `ms` vira **teto**. O que as filas podem gastar é o que sobra até o prazo do quadro, entre o piso e o teto (fórmula abaixo). **Sem dívida** (o prazo de cada quadro já desconta o que o anterior gastou a mais, pelo relógio). |

**Quem dá o início do quadro: o laço.** `startLoop` (`game-runtime/src/loop.ts:12-20`) passa o `nowMs` do `requestAnimationFrame` como
`FrameRunOptions.frameStartMs` em `scheduler.frame(...)`. O modo `deadline` vale **só** para quadro com `frameStartMs`; todo outro quadro
(headless, `advance()`, teste, cenário) segue na cota de hoje, mesmo com `targetMs` definido. O `frameStartMs` e o `clock()` do orçamento
precisam ser da mesma base: o agendador converte (`clock() − (clock() no onFrame − nowMs)`), ou o laço passa também o `clock()` lido no mesmo
instante; a T1.2 escolhe e testa com relógio falso.

### Assinaturas (compatíveis: só campos opcionais novos)

```ts
// game-runtime/src/budget.ts
export interface FrameBudgetOptions {
  readonly ms?: number                 // hoje: cota. Em modo deadline: teto. Default 4 (como hoje)
  readonly targetMs?: number           // novo: liga o modo deadline. Ausente = quota
  readonly minMs?: number              // novo: piso do modo deadline. Default 1 (DEFAULT_MIN_BUDGET_MS)
  readonly clock?: () => number
  readonly onError?: (...) => void
}

// game-runtime/src/types.ts, FrameBudget
ms: number                            // teto (deadline) ou cota (quota), mutável como hoje
targetMs: number | undefined          // novo, mutável: o host troca ao mudar o monitor/limite de FPS (144 Hz -> 6,94)
beginFrame(frameStartMs?: number): void // novo argumento opcional: com ele (e targetMs), o quadro é deadline; sem ele, quota
recordRender(ms: number): void        // novo: o agendador informa o tempo da fase render; alimenta a média móvel
readonly mode: 'quota' | 'deadline'   // novo, do quadro corrente: deadline só com targetMs E frameStartMs

// game-runtime/src/types.ts, FrameRunOptions
readonly frameStartMs?: number        // novo: preenchido por startLoop (rAF nowMs); ausente em room.update, advance(), testes

// game-runtime/src/types.ts, SchedulerOptions
readonly budgetMs?: number            // hoje: cota (default 4). Com targetMs: teto
readonly targetMs?: number            // novo: repassado ao FrameBudget
readonly minBudgetMs?: number         // novo: piso, repassado como minMs
```

O agendador (`scheduler.ts`): em `begin()` chama `budget.beginFrame(options.frameStartMs)`; depois de `runPhase('render', …)` chama
`budget.recordRender(runner.phaseMs.render)` **só se a amostra vale** (seção abaixo). Quadro com `render: false` (headless, `room.update`) não
chama `recordRender` e, sem `frameStartMs`, nem entra no modo deadline. `advance()` continua `unbounded` (cenários e goldens não leem prazo).

### Fórmula (modo deadline)

| Grandeza | Definição |
|---|---|
| `frameStart` | `clock()` em `beginFrame` (o agendador abre antes da fase `input`, então simulação, física, `WorkBudget` e sistemas de `present` já estão descontados quando a drenagem começa) |
| `renderEstimateMs` | média móvel exponencial do `phaseMs.render`, peso `RENDER_ESTIMATE_WEIGHT = 0.125`; o primeiro valor medido semeia a média; antes dele, 0 |
| amostra do render | `clamp(phaseMs.render, 0, targetMs)`: um quadro travado (aba em segundo plano, GC) não infla a média. **Pula a amostra** quando o pacer pulou o render (`room.ts:5576`, `!pacer.ready()`) ou quando o aquecimento rodou (`room.ts:5561-5569`): nesses quadros o render medido não é o render típico |
| `allowanceMs` (A) | calculado uma vez no início de `drain('present')`: `clamp(frameStart + targetMs − renderEstimateMs − now, minMs, ms)`. **Sem dívida** |
| reservas | **saem do piso**, não de A, em `drain('present')` no modo deadline: o áudio (1 ms) é garantido mesmo com A no piso. `register` no modo deadline recusa Σ reservas > `minMs` (o piso); no modo quota segue o limite de hoje (metade de `ms`) |
| `drain('idle')` | o que sobrou de A, limitado pelo prazo real depois do render: `max(min(A − gastoNoPresent, frameStart + targetMs − now), minMs − gastoNoQuadro)`. O render medido de verdade substitui a estimativa; o piso vale para o quadro inteiro |
| dívida | **só no modo quota** (como hoje). No modo deadline não existe: o relógio real já a cobra no quadro seguinte |
| guarda de fome | igual a hoje (`minEveryFrames`, uma unidade com prazo já vencido); a unidade forçada conta em `forcedThisFrame` |
| `mustDrain` | seção 1b: fora de A |

### 1b. Classe `mustDrain` (decisão A do dono, 2026-11-19, D3 mantida)

`destruction.events` e `floorplan.breach-cut` são o efeito visível do golpe: drenam **por inteiro no quadro do golpe**, fora do prazo, como hoje.
Só lotes, sombra, filme, oclusão, amassado, `prefit` e as demais filas de `idle`/apresentação obedecem ao prazo.

| Ponto | Decisão |
|---|---|
| Marca | `register(queue, { …, mustDrain: true })` (campo novo de `DeferredQueueOptions`): a fila roda até acabar (`run(Infinity)`) no `drain('present')`, antes das demais, sem consultar A e sem virar dívida |
| Quem tem | só `destruction.events` e `floorplan.breach-cut`. A T1.4 fixa isso na tabela da seção 3; classe nova exige decisão do dono |
| Desconto | o gasto delas **é descontado** do que as outras filas recebem: A é calculado **depois** de elas rodarem (`now` já avançou). Golpe pesado deixa as filas de otimização no piso, e a guarda de fome as mantém andando |
| Estatística | contado à parte: `mustDrainSpentMs` e `QueueStats.mustDrain`. `spentMs`, `overMs` e a C2 medem **o resto** |
| Teste | seção 7, casos 16 e 17 |

### 1c. `nextUnitMs` (condicional à T1.9)

Extensão opcional do contrato (`game-contracts/src/frame.ts`) **só se a T1.9 a pedir** (consulta de oclusão grande que não se divide):

```ts
interface DeferredQueue {
  /** Estimativa (ms) da próxima unidade. Se o que sobra para a fila é menor, o orçamento não a chama neste quadro (conta como espera). */
  nextUnitMs?(): number | undefined
}
```

Se ficar: a **guarda de fome ignora `nextUnitMs`** (a unidade forçada roda mesmo assim, senão a fila passaria fome para sempre) e filas do
`WorkBudget` **não podem implementá-la** (o passo deles é determinístico e não depende de ms). Se a T1.9 dividir o custo no dono, o campo **não
entra**. Sem `nextUnitMs` (todas as filas de hoje), nada muda. `checkDeferredQueue` não muda.

### `stats()` (campos novos em `BudgetStats`, todos `readonly`)

| Campo | Significado |
|---|---|
| `mode` | `'quota'` ou `'deadline'` |
| `ms` | (existe) teto ou cota |
| `targetMs` | prazo do quadro; `undefined` em quota |
| `allowanceMs` | A deste quadro (em quota, `ms` menos dívida) |
| `renderEstimateMs` | média móvel usada |
| `spentMs` | (existe) gasto das filas **sem** `mustDrain` no quadro |
| `mustDrainSpentMs` | gasto das filas `mustDrain` no quadro (fora da C2) |
| `overMs` | `max(0, spentMs − max(allowanceMs, minMs))`: a C2 exige `overMs ≤ (uma unidade que cruza o prazo por quadro) + Σ unidades forçadas` |
| `forcedThisFrame` | unidades da guarda de fome neste quadro, com o custo de cada uma (`forcedMs`) |

`QueueStats` ganha `lastSpentMs` (gasto da fila no último quadro), para a T0.4/T1.8 rotularem cada fila sem fazer diferença de acumulado.

## 2. `WorkBudget` da física (D4)

O `WorkBudget` (`game-physics/src/work-budget.ts`) só existe dentro do renderer da destruição (`renderer.ts:519`, `wake-queue.ts`), e roda
dentro do `run` da fila `destruction.events` (`runWork`, `renderer.ts:1182`). Na página padrão está desligado (`?workBudget=4` em
`examples/test-room/src/main.js:117`).

| Ponto | Decisão |
|---|---|
| Sem relógio | Continua em unidades (spec 008 E2). Nenhuma leitura de `clock` entra nele. |
| `tier` | Vem do host, uma vez por sessão: opção da sala (`debris.workBudget.tier`, default 1). Sem calibração automática nesta spec. |
| teto | O host passa `workBudget.budgetMs = min(DEFAULT_WORK_BUDGET_MS, budget.ms)`: o trabalho determinístico nunca passa do teto do quadro. |
| desconto (D1) | Automático: o `FrameBudget` mede o `run` de `destruction.events` (`runEntry`), que inclui o `WorkBudget`. Esse gasto sai de A antes das filas de prioridade menor e vira dívida se passar. Nada novo no `WorkBudget`. |
| determinismo registrado | Hoje, registrado, "o relógio do orçamento decide em que quadro o passo de trabalho roda" (`game-destruction-three/src/types.ts:101`). Correção: com `workBudget`, o host registra `destruction.events` com `minEveryFrames: 1`; a guarda de fome roda o passo todo quadro com pendência, e o `runWork` ignora o prazo (para em unidades). O mesmo quadro recebe o mesmo trabalho em toda máquina do mesmo `tier`. |
| C2 | Com `workBudget`, o passo de `destruction.events` conta como a "unidade" da C2 (determinística, limitada pelo teto). |

## 3. Tabela de todas as filas

Prioridade maior roda antes. `minEveryFrames` default 4. Reserva só no áudio (D3). `destruction.events` e `floorplan.breach-cut` são `mustDrain`
(seção 1b, decisão A): drenam por inteiro no quadro do golpe, fora de A. Os nomes novos entram em `DEFERRED_QUEUE_ID` e
`DEFERRED_PRIORITY` na T1.4, exatamente assim.

| id | constante | fase | prioridade | `minEveryFrames` | `reserveMs` | dono (arquivo) | estado |
|---|---|---|---|---|---|---|---|
| `destruction.events` | `DESTRUCTION_EVENTS` | present, `mustDrain` | 300 | 4 (1 com `workBudget`, seção 2) | — | `game-destruction-three/src/renderer.ts:450` | existe |
| `floorplan.breach-cut` | `BREACH_CUT` | present, `mustDrain` | 260 | 1 | — | `game-floorplan-three/src/destruction/breach.ts:167` | existe |
| `floorplan.breach-paint` | `BREACH_PAINT` | present | 250 | 4 | — | `breach.ts:144`, `:796` | existe |
| `audio.voices` | `AUDIO_VOICES` | idle | 200 | 4 | 1 | `game-audio/src/webaudio/engine-queue.ts:88` | existe |
| `audio.occlusion` | `AUDIO_OCCLUSION` | idle | 190 | 8 | — | `game-audio/src/occlusion-tracker.ts` (exposta por `engine-occlusion.ts`) | nova |
| `fluids.film` | `FLUID_FILM` | idle | 120 | 2 | — | `game-fluids-three/src/film/manager.ts` | nova |
| `vehicles.crease` | `VEHICLE_CREASE` | idle | 100 | 4 | — | `game-vehicles/src/destructible/crease-queue.ts:34` | existe |
| `vehicles.lod-batch` | `VEHICLE_LOD_BATCH` | idle | 90 | 4 | — | `game-vehicles-three/src/vehicle-lod.ts` | nova |
| `destruction.settled-batch` | `SETTLED_BATCH` | idle | 70 | 8 | — | `game-destruction-three/src/settled-batches.ts` | nova |
| `render.static-batch` | `STATIC_BATCH` | idle | 60 | 8 | — | lotes da sala: pool de `game-render-three/src/static-batcher.ts`, registrada em `room.ts` | nova |
| `animals.static-batch` | `ANIMALS_STATIC_BATCH` | idle | 60 | 8 | — | `game-animals-three/src/test-area/module.ts` | nova |
| `characters.static-batch` | `CHARACTERS_STATIC_BATCH` | idle | 60 | 8 | — | `game-characters-three/src/test-area/module.ts` | nova |
| `floorplan.shadow-batch` | `HOUSE_SHADOW_BATCH` | idle | 50 | 8 | — | `game-floorplan-three/src/house/shadow-batches.ts` | nova |
| `destruction.prefit` | `DESTRUCTION_PREFIT` | idle | 40 | 30 | — | `renderer.ts` (sai de dentro de `destruction.events`) | nova |
| `destruction.static-boxes` | — | — | — | — | — | **não é fila** (decisão D, seção 4b) | unidades |

Por que essas prioridades: o que aparece no quadro do golpe fica em `present` (D3); no `idle`, som antes de imagem (a voz atrasada se ouve,
o lote atrasado só custa chamadas de desenho), animação visível (filme, amassado) antes de lotes, sombra e `prefit` por último (otimizações
puras). `minEveryFrames` 8 a 30 nas filas de otimização: sem pressa, e a guarda de fome não força unidade grande a cada 4 quadros.

Quando `destruction.prefit` tiver fila própria, o `pending` de `destruction.events` (`renderer.ts:451`) **para de somar `prefitLeft()`**: senão a
fila `mustDrain` continuaria "pendente" por causa de trabalho que agora é de outra fila e nunca esvaziaria no quadro do golpe.

Formato das filas de lote (muda a forma da T1.3): **uma fila por dono, não por instância.** A sala tem um batcher por objeto e uma rua tem
dezenas de casas; registrar uma fila por instância enche a lista de entradas. `static-batcher.ts` ganha `createStaticBatchQueue({ id })`
(rodízio entre os batchers que acompanha, como `createCreaseQueue`), e `createStaticBatcher(…, { queue })` se junta a ela. Unidade = o **chunk
que o batcher já tem** (`maxVertices`, `static-batcher.ts:142-155`); a seção 5 trata o custo dele. O `update()` de cada batcher continua todo quadro com a parte que não é adiável: soltar a malha que
mudou (precisa valer antes do render deste quadro). Sem fila, `budgetMs` faz como hoje. Na sala, isso tira as junções da fase `render`
(`room.ts:5578`), o que também limpa a estimativa de render.

## 4. Lista fechada dos relógios próprios

Fonte: tabela P1 do `spec.md`, `rg -n "performance\.now\(\)" packages/*/src` e as constantes `*_BUDGET_MS`/`*_SLICE_MS`/`budgetMs`.

### 4a. Viram fila (T1.5)

| Relógio | Arquivo:linha | Vira |
|---|---|---|
| Lotes da sala, `BATCH_BUDGET_MS = 1` por lote | `game-test-room/src/room.ts:162`, `:1279` | `render.static-batch` (T1.6 tira a constante do `room.ts`) |
| Lotes dos bichos, `BATCH_BUDGET_MS = 1` | `game-animals-three/src/test-area/module.ts:29`, `:69` | `animals.static-batch` |
| Lotes dos personagens, `BATCH_BUDGET_MS = 1` | `game-characters-three/src/test-area/module.ts:60`, `:199` | `characters.static-batch` |
| Junção do batcher, `performance.now() >= deadline` | `game-render-three/src/static-batcher.ts:173`, `:207` | a pool lê o `clock` do `run`; `budgetMs` fica só para o caminho sem fila |
| Sombra da casa, `HOUSE_SHADOW_BUDGET_MS = 2` | `game-floorplan-three/src/house/shadow-batches.ts:12`, `:38` | `floorplan.shadow-batch` |
| Lotes do veículo, `BATCH_BUDGET_MS = 2` | `game-vehicles-three/src/vehicle-lod.ts:13`, `:137`, `:175` | `vehicles.lod-batch` |
| Destroços assentados, `budgetMs: 2` | `game-destruction-three/src/settled-batches.ts:29`, `:165` | `destruction.settled-batch` |
| Filme de fluido, `DEFAULT_BUDGET_MS = 1.2`, `now() − start > budget` | `game-fluids-three/src/film/manager.ts:16`, `:249`, `:260` | `fluids.film`; unidade = avançar uma grade pelo `dt` acumulado dela (hoje a grade sem tempo **perde** o `dt` do quadro; na fila ela acumula) |
| Oclusão do áudio, `budgetMs: 1` | `game-audio/src/occlusion.ts:104`, `occlusion-tracker.ts:60`, `:90`, `:109` | `audio.occlusion`; unidade = uma consulta. Com a fila ligada, `add` não consulta na hora: começa pelo palpite e fica pendente (seção 5; `nextUnitMs` só se a T1.9 pedir) |
| `prefit`, `PREFIT_SLICE_MS = 1` | `game-destruction-three/src/renderer.ts:131`, `:2776` | `destruction.prefit` (fila própria no `idle`; `destruction.events` deixa de somar `prefitLeft()` no `pending`, `renderer.ts:451`; o `runPrefitWork` com `workBudget` continua em unidades dentro de `destruction.events`) |
| Suavização do amassado, `pump(budgetMs = 2.5)` | `game-vehicles/src/destructible/visual.ts:1374`, `:1381`, `:1384` | já é `vehicles.crease` quando registrada; o `pump` vira o caminho sem host (4c) |
| Relógio errado dentro da fila do amassado: `performance.now() > deadline` | `game-vehicles/src/geometry.ts:206`, `:238`; `tri-index.ts:80`; `crease-queue.ts:8` | `CreaseWork.runStep(deadline, clock)` e `step(deadline, clock)`: o prazo do orçamento com o relógio do orçamento (hoje o teste de relógio falso não alcança) |

### 4b. Afetam a física: viram unidades, não fila (§15, "fila só carrega apresentação")

| Relógio | Arquivo:linha | Vira |
|---|---|---|
| Caixas estáticas, `STATIC_REFRESH_SLICE_MS = 1` | `game-destruction-three/src/renderer.ts:107`, `:1454-1457` | **Decisão D (2026-11-19).** As caixas alimentam `staticSolids`/`staticTopAt` (`:1309`, `:1326`), que o motor usa como colisão: hoje a física depende da máquina. Vira `STATIC_REFRESH_PER_UPDATE` objetos medidos por `update` (contagem fixa, valor escolhido na T1.5 para cobrir a ronda de 0,5 s com a sala cheia). **Parar e perguntar** se o hash de eventos de algum teste mudar. |
| Campo de fluxo da multidão, `flowBudgetMs: 1`, `clock() − t0 > budget` | `game-crowd/src/crowd.ts:151`, `:413`, `:457`; `data/defaults.json:29` | **Decisão B (2026-11-19).** Já existe o modo em unidades (`cellsPerStep`, ligado por `physics.deterministic`); passa a ser o padrão, em task própria no fim da fase 1 (**T1.10**). **Parar e perguntar** se algum golden ou hash da multidão mudar. |

### 4c. Caminho sem host (D2): ficam, mas por um ponto só

Hoje cada dono tem seu `budgetMs` para drenar sozinho quando nenhum orçamento o registrou. Para a lista de exceções da C3 ficar vazia, esses
caminhos passam a chamar um único ajudante novo em `game-contracts/src/frame.ts`:

```ts
/** Drains a queue no budget registered (D2): runs it until `budgetMs` from now. The one place outside game-runtime that times deferred work. */
export function drainDetached(queue: DeferredQueue, budgetMs: number, clock?: () => number): number
```

| Caminho sem host | Arquivo:linha |
|---|---|
| eventos da destruição, `eventBudgetMs` | `game-destruction-three/src/renderer.ts:446`, `:1142` |
| vozes do áudio, `budgetMs ?? 2` | `game-audio/src/webaudio/engine-queue.ts:22`, `:42`, `:61` |
| pintura do rombo, `paintBudgetMs` (default `Infinity`, síncrono) | `game-floorplan-three/src/destruction/breach.ts:202`, `:785`, `:789` |
| amassado, `pump(2.5)` | `game-vehicles/src/destructible/visual.ts:1374` |
| junção sem fila, `budgetMs` | `game-render-three/src/static-batcher.ts:207` |

O padrão de cada um continua o de hoje (síncrono onde é síncrono). A regra `own-frame-clock` (T1.7) aceita `drainDetached` e
`clock() >= deadline` dentro de um `run(deadline, clock)`.

**Toda fila nova da seção 3 também tem o padrão sem host por `drainDetached`** (D2): é ele que faz o `budgetMs` do dono virar o caminho sem
fila. Linhas novas, além das cinco acima:

| Fila nova | Padrão sem host (`drainDetached` com…) |
|---|---|
| `render.static-batch`, `animals.static-batch`, `characters.static-batch` | o `budgetMs` do batcher (hoje 1 ms por lote; a sala sem fila continua igual) |
| `floorplan.shadow-batch` | `HOUSE_SHADOW_BUDGET_MS` (2 ms) como padrão, sem relógio novo no dono: a constante some quando a T1.7 passar, o valor vira o argumento |
| `vehicles.lod-batch` | `BATCH_BUDGET_MS` (2 ms), mesmo caso |
| `destruction.settled-batch` | `budgetMs: 2` do dono |
| `fluids.film` | `DEFAULT_BUDGET_MS = 1.2` |
| `audio.occlusion` | `budgetMs: 1` |
| `destruction.prefit` | `PREFIT_SLICE_MS = 1` |

**§15 e `drainDetached`:** `drainDetached` em `game-contracts/src/frame.ts` é a **única exceção sancionada** fora do `game-runtime` para "tempo de
trabalho adiado". A **T4.3** edita o texto da §15 (`specs/regras/15-quadro-e-desempenho.md`, "Um dono do tempo do quadro") para nomeá-lo; até lá a
regra `own-frame-clock` o aceita pelo nome.

### 4d. Fora da regra (não é prazo de trabalho adiado)

| Tipo | Arquivo:linha |
|---|---|
| Dono do tempo | `game-runtime/src/clock.ts`, `loop.ts` |
| `Date.now` fora do `performance.now` (a regra `own-frame-clock` precisa classificá-los) | `game-crowd/src/physics/offload/runner.ts:80-82`: **espera de worker** com limite (`WAIT_LIMIT_MS`), não fatia trabalho; §14, fora da regra. `game-vegetation-three/src/test-area/nursery.ts:194-196`: **medição** (`buildMs`), fora. `game-terrain-three/src/zone-layer.ts:116`: **animação** (fase da onda pelo relógio de parede), não prazo; fora. A T1.7 whitelista os três por arquivo e linha de contexto, com o motivo |
| Medição (só soma ms para estatística) | `game-physics/src/loop.ts:77`, `:83`; `game-contracts/src/impact-cost.ts:29`; `game-render-three/src/warmup.ts:237`; `game-crowd-three/src/renderer.ts:92`, `bench/module.ts:347`; `game-characters-three/src/test-area/crowd.ts:38`; `game-floorplan-three/src/interactables/bridge.ts:54`, `build/build.ts:116`; `film/manager.ts:277` (`simMs`) |
| Cadência ou temporizador (não fatia trabalho) | `game-weapons-three/src/laser-raycast.ts:63` (Hz do raio); `room.ts:5562` (`LIGHTS_CHECK_MS`), `:3809`/`:3836` (toque de empurrar); `player.ts:361`, `:383`; `furniture-push.ts:275`; `graphics.ts:121`, `:137`; `clotheslines.ts:9`; `interaction/state.ts:41`; `build.ts:292`, `:322`; `vehicle-lod.ts:57` e `shadow-batches.ts:33` (`*_REBATCH_AFTER_MS`, espera antes de rejuntar) |
| Bancada | `game-audio/src/bench/sound-check.ts:459` |
| Workers (§14, domínio do coordenador) | `game-workers/src/coordinator.ts:127` (contadores), `host.ts:5` (ms da tarefa), `sim-thread.ts:84-127` (ritmo da thread de simulação, fora do quadro principal) |

## 5. Unidade maior que o orçamento (ressalva da T0.3)

Um prazo não encolhe uma unidade. Cada caso tem dono:

| Unidade | Medido (T0.2) | Tratamento | Onde |
|---|---|---|---|
| Junção de um lote do LOD do veículo (`HIT_BATCH_VERTICES = 16384`, `vehicle-lod.ts:19`) | 6,3 ms num quadro | **Sem fatiar por vértice agora.** A unidade da fila é o chunk que o batcher já tem (`maxVertices`, `static-batcher.ts:142-155`). Primeiro **medir na régua** e tentar duas coisas baratas: (1) um laço de cópia mais rápido (`copyAttribute` lê por `getX` por vértice, `static-batcher.ts:240-260`; alocações por grupo, `:315-329`); (2) `HIT_BATCH_VERTICES` menor. Só se a régua, com carga baixa, ainda mostrar a unidade acima do orçamento, fatiar por vértice, e então valem **quatro garantias**: (a) a inversa da matriz calculada por fatia; (b) as malhas rechecadas na conclusão (podem ter mudado entre fatias); (c) a troca de camada e a inserção do lote no **mesmo** `run`; (d) `dispose` descarta a geometria meio construída (§8). Worker (§14) descartado: categorias novas congeladas até a C8. | T1.3 |
| Consulta de oclusão (`occlusion-tracker.ts:90` e `:109`: a primeira sempre roda) | até 9,2 ms em `crater` | (a) Com a fila, nenhuma consulta é obrigatória no `add` nem no `update`; roda na fila ou pela guarda (`minEveryFrames` 8). (b) O custo de uma consulta de 9,2 ms **não tem dono na régua**: a **T1.9** acha por que (o raio atravessa o mundo da destruição depois da cratera) e divide o custo no dono. `nextUnitMs` (seção 1c) só entra se a T1.9 não conseguir dividir. | T1.5 (a), **T1.9** (b) |
| `splitLoose`/`adoptSplit`/`rebuildHost` dentro de `destruction.events` | 4,7 a 6,9 ms a 1x | Não é P1: uma vez por objeto por drenagem (D9). | T2.1 |
| Passo do `WorkBudget` | limitado pelo teto | Determinístico por desenho (seção 2). | — |

A guarda de fome pode cair num quadro ruim com unidade grande, por isso `minEveryFrames` alto nas filas que têm unidade grande. A C2 desconta
essas unidades (seção 9).

## 6. Interação com o `systemProbe` da T0.4

Lido no diff não commitado (`phase-runner.ts`, `scheduler.ts`, `types.ts`): a sonda envolve cada **sistema** (`enter`/`leave`), não as
filas, porque `budget.drain` é chamado direto pelo agendador.

- O prazo não lê a sonda e a sonda não lê o prazo. Com a sonda ligada, o custo dela entra em `phaseMs.render` e no tempo antes do
  `drain('present')`: na medição as filas recebem um pouco menos, como receberiam com qualquer sistema mais lento. Sem sonda, custo zero.
- As filas aparecem na régua por `budget.stats().queues[].lastSpentMs` (campo novo), lido pela sonda ao fim do quadro. Proposta para a T0.4/T1.8:
  um rótulo por id de fila, mais `allowanceMs`, `overMs` e `renderEstimateMs` por quadro (prova da C2 na régua).
- Ordem de merge: a T1.2 parte da branch com a T0.4 commitada; `createPhaseRunner` ganha `probe` lá e nada aqui mexe nele.

## 7. Testes da T1.2 (relógio falso, `game-runtime/tests/budget.test.ts` e `scheduler.test.ts`)

| # | Caso | Espera |
|---|---|---|
| 1 | Sem `targetMs` | Todo teste atual passa sem mudança; `stats().mode === 'quota'` |
| 2 | `targetMs` 16,6, teto 8, quadro com `frameStartMs`, simulação avança o relógio 10 ms, render estimado 3 | `allowanceMs` 3,6; fila de 1 ms por unidade gasta ≤ 3,6 + 1 unidade; `overMs ≤ 1` |
| 3 | Simulação 0, render 0 | `allowanceMs` = teto (8) |
| 4 | Simulação 20 ms (passou do prazo) | `allowanceMs` = piso (1); gasto ≤ max(A, piso) + 1 unidade que cruza |
| 5 | Média do render: quadros com render 2, 2, 2, 10 ms | `renderEstimateMs` segue a fórmula com peso 0,125; quadro `render: false` não a altera nem a desconta |
| 5b | Amostra robusta: render 500 ms (aba parada), 0 e −1; quadro com pacer que pulou o render; quadro com aquecimento | amostra grampeada em `[0, targetMs]`; os dois últimos não alteram a média |
| 6 | `idle` depois de render real maior que a estimativa (6 contra 2) | o `idle` recebe só até o prazo real; o piso vale para o quadro inteiro |
| 7 | Reserva do áudio, também com A no piso | 1 ms garantido para `audio.voices` (sai do piso); `register` no modo deadline recusa Σ reservas > `minMs` |
| 8 | Guarda de fome | fila de prioridade baixa sem sobra roda uma unidade a cada `minEveryFrames`; `forcedThisFrame` conta |
| 9 | Dívida | em quota, excesso de um quadro reduz o seguinte (como hoje); em deadline não há dívida e A nunca fica abaixo do piso |
| 10 | **Só se a T1.9 mantiver `nextUnitMs`:** `nextUnitMs` 5 com 3 de sobra | a fila não é chamada, `framesWaiting` sobe, roda na guarda **mesmo ignorando `nextUnitMs`** |
| 11 | `budget.targetMs` trocado em execução (16,6 → 6,94) | o quadro seguinte usa o novo prazo |
| 12 | Fila com `minEveryFrames: 1` e prazo esgotado (o caso do `WorkBudget`) | roda todo quadro com pendência |
| 13 | Propriedade C2 (seção 9) | 1.000 quadros com simulação e render aleatórios (semente fixa), filas com unidades de custo variado: todo quadro com `spentMs ≤ max(remaining, minMs) + (uma unidade que cruza o prazo) + Σ unidades forçadas`, sem contar `mustDrain` |
| 14 | `advance()` | ilimitado como hoje, prazo ignorado |
| 15 | `createScheduler({ budgetMs: 8 })` sem `targetMs` | idêntico a hoje; com `targetMs`, `stats().budget.targetMs` e `allowanceMs` presentes |
| 16 | Quadro **sem** `frameStartMs` (`frame(dt, { render: false, exact: true })`) com `targetMs` definido | cota de hoje, com dívida; `mode` do quadro `'quota'` |
| 17 | `mustDrain`: fila `destruction.events` com 20 ms de trabalho e prazo de 3 ms | drena por inteiro no `present`; `mustDrainSpentMs` 20; `spentMs`/`overMs` não a contam; A das demais cai ao piso; a guarda de fome mantém as outras andando |
| 18 | `startLoop` | `scheduler.frame` recebe `frameStartMs` = `nowMs` do rAF; com `minFrameMs` pulando o quadro, nada é chamado |
| 19 | `register` com Σ reservas > `minMs` no modo deadline | recusa |

Testes das outras tasks: cada fila nova com `checkDeferredQueue` e com o caminho sem host por `drainDetached` (T1.3, T1.5); `drainDetached` com relógio falso (T1.4); caixas estáticas
com contagem fixa dão o mesmo hash de passo com relógios diferentes (T1.5); `CreaseWork.runStep` respeita o relógio passado (T1.5).

## 8. Decisões do dono (2026-11-19, fechadas)

| # | Decisão | Onde entra |
|---|---|---|
| A | D3 mantida: `destruction.events` e `floorplan.breach-cut` drenam por inteiro no quadro do golpe, fora do prazo (`mustDrain`, seção 1b); só as filas de otimização e apresentação obedecem ao prazo | T1.2, T1.4, T1.6 |
| B | Campo de fluxo da multidão em unidades fixas (`cellsPerStep`) por padrão; parar e perguntar se golden ou hash da multidão mudar | T1.10 |
| C | Achar por que uma consulta de oclusão custa até 9,2 ms depois da cratera e dividir o custo no dono | T1.9 |
| D | Caixas estáticas (`renderer.ts:1454`) viram contagem fixa por `update`; parar e perguntar se um hash de eventos mudar | T1.5 |

Perguntas abertas: nenhuma. Parar e perguntar continua valendo para B e D se um hash mudar.

## 9. Emenda proposta à C2 (`spec.md`; **não editada aqui**)

Texto atual da C2: "o trabalho adiado de um quadro nunca passa do que sobrou até o prazo do quadro (fora a unidade mínima da guarda de fome)".
Impreciso em três pontos: unidade que cruza o prazo, várias unidades forçadas num quadro, e filas `mustDrain`. Texto proposto:

> **C2.** Um orçamento só: em quadro com prazo (`frameStartMs`), o trabalho adiado de um quadro, **fora as filas `mustDrain`**
> (`destruction.events`, `floorplan.breach-cut`), gasta `spent ≤ max(restante, piso) + no máximo uma unidade que cruza o prazo por quadro + Σ unidades forçadas pela guarda de fome`.
> Prova: teste do `game-runtime` com relógio falso e propriedade de 1.000 quadros; `budget.stats()` na tempestade do `perf.mjs` (`overMs`,
> `forcedThisFrame`, `mustDrainSpentMs`).

Quem aceita a emenda edita o `spec.md`; a T1.2 testa o texto novo.
