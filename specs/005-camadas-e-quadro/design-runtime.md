# Desenho — `@adatechnology/game-runtime` (T4.1)

Desenho da API e da migração para a T4.1 da spec 005 (decisão D3 do [`plan.md`](plan.md)). Escrito em 2026-10-31, depois do merge de
`perf/explosion-frame-budget` (as filas adiadas citadas aqui são as daquela branch, ver [`docs/desempenho-explosoes.md`](../../docs/desempenho-explosoes.md)).
O `architect` validou a primeira versão com **APPROVE WITH CHANGES**; esta é a revisão com as mudanças pedidas.

## Revisão 2 (2026-10-31)

Segunda passada do `architect` (APPROVE WITH CHANGES), conferida contra `room.ts`:

| Item | O que mudou | Seção |
|---|---|---|
| R-a | `room.update(dt)` não passa por limite nem encaixe: os chamadores passam 0,1 a 0,4 s (`examples/test-room/test.mjs:129,132`, `examples/interactables-test-area/test.mjs:222,297`, `examples/weather-test-area/test.mjs:57`, `game-test-room/tests/bench.test.ts:248,322`). Nova opção `FrameRunOptions.exact` (sem limite, sem encaixe, sem teto de subpassos, um `lateSimulate` com o `dt` dado), usada por `room.update` | §3.2, §6, §8 (commit 1) |
| R-b | A verificação de luzes de 250 ms roda hoje em **todo** quadro do laço, com ou sem cenário (`room.ts:3830-3837`), e nunca dentro do `step`. Ela vai para o começo de `render` (ordem −1000) e pula quando `ctx.scripted` | §6, §8 (commit 1) |
| R-c | `advance` reproduz o `step` (`room.ts:3330-3340`) passo a passo: `n = max(1, round(seconds/dt))`, `stepSim(dt)` sem `timeScale` (`s = 1`), `push.step`/`doors.step`/`followHeld` com `dt` mesmo pausado, `present` da sala não faz nada; novo `ctx.simulated` separa o quadro de cenário (`simulate: false`) do `advance` | §3.2, §6, §8 (commit 3) |

## Revisão 2026-10-31

Mudanças pedidas pela revisão do `architect` (opus, conferida contra o código) e onde estão neste documento:

| Item | O que mudou | Seção |
|---|---|---|
| Erro 5 | Linhas do laço corrigidas (`room.ts:3817-3852`); `pump(2.5)` é **por veículo** (`impl.ts:986`), não global; a soma dos orçamentos soltos passa a ter um termo por veículo | §1 |
| R1 | Migração reordenada para 1 → 2 → 5 → 3 → 4 → 6 → 7 (os cenários passam pelo agendador **antes** de `onFrame` e a drenagem saírem do `stepSim`); cada commit verde sozinho, com a lista do que o prova | §8 |
| R2 | `ctx.scripted` no `advance` reproduz o `step` de hoje (`player.update(0)`, sem `useTool`/`kickLight`/`pushByPlayer`/`stepAvatar`/HUD); `advance` zera o acumulador e deixa `alpha = 0` | §3.2, §6, §8 (commit 3) |
| R3 | A verificação de luzes de 250 ms e o `warmUp` só existem quando a sala é dona do laço (`ownsLoop`), nunca para host que chama `room.update` | §8 (commit 1) |
| R4 | Entrada que muda a simulação vira **comando** consumido no próximo tick de `fixedSimulate`; regra: uma `DeferredQueue` nunca carrega trabalho de simulação | §3.4 |
| R5 | A fila se liga ao orçamento em `budget.register` (`attach`/`detach`), nunca como efeito colateral de um getter; sem registro, a drenagem interna de hoje continua; padrão síncrono intacto | §2.1, §5 |
| R6 | `pending()` da fila de `crease` é 0 no quadro do rasgo; uma fila agregada `vehicles.crease`, em rodízio pelos visuais vivos | §2.1, §5 |
| R7 | `reserveMs` por fila (`audio.voices` 1 ms): o áudio nunca morre de fome na tempestade; a questão do áudio em `idle` está decidida | §2.1, §4, Perguntas |
| R8 | D3 do `plan.md` alinhado: destruição e reboco em `present`, vozes e `crease` em `idle` | `plan.md` D3 |
| Risco: cadeia | Elos da reação em cadeia contados em ticks dentro de `fixedSimulate`, com teto determinístico por tick; só a apresentação passa pelo orçamento | §3.4, `tasks.md` Fase 4 |
| Opcional | `DEFERRED_PRIORITY` no `game-contracts`; `T` encaixado em `h` quando a diferença é ≤ 0,25 ms; interpolação obrigatória para movimento visível do passo fixo; sistemas de `present` que precisam de tempo real leem `ctx.realDt` | §2.1, §3.1, §3.2 |

## 1. O que existe hoje e o que este pacote substitui

| Hoje | Onde | Problema |
|---|---|---|
| Laço da sala: `requestAnimationFrame` → verificação de luzes de 250 ms (`lightsKey` → `warmUp`) → `update(min(0.05, realDelta))` (se não há cenário rodando) → `applyCamera` → `gl.render` → `pinPrograms` | `game-test-room/src/room.ts:3817-3852` (`loop`), só quando `ownRenderer` (`ownsLoop = true`) | Só a sala tem laço; cada jogo reinventa a ordem |
| `update(dt)`: jogador, empurrão, portas, chute, avatar, uso da ferramenta (tempo real), depois `stepSim(dt * timeScale)`, depois avatar, HUD, log, métricas | `room.ts:2743-2785` | Entrada e simulação no mesmo bloco, sem fase |
| `stepSim(dt)`: animações, explosivos, contêineres, `world.update` ×`reps`, fluidos, `renderer.update`, terreno, `vfx.update`, ferramentas, ouvinte do áudio, **depois** os `onFrame` dos módulos, traçadores e `flush()` | `room.ts:2698-2741` | Os módulos rodam depois do vfx e dos adaptadores: um quadro de atraso; `dt` variável quebra o determinismo por semente |
| `step(seconds)` dos cenários: passo de 1/60 (ou 1/30 acima de 6 s), síncrono: `seating.update`, `player.update(0)`, `push.step`, `doors.step`, `followHeld`, `stepSim` | `room.ts:3330-3341` | Caminho paralelo ao laço, com outra ordem (sem `kickLight`, `pushByPlayer`, `useTool`, `stepAvatar`, HUD) |
| `ModuleHost.onFrame(update)` | `game-contracts/src/module.ts:288-289` | Sem fase nem ordem |
| Fila de vozes do áudio, 2 ms por fatia, latência máxima de 250 ms, agendada por `MessageChannel` entre quadros | `game-audio/src/webaudio/engine-queue.ts` | Orçamento próprio, fora do quadro |
| Eventos da destruição, `eventBudgetMs` (padrão `Infinity`; a sala passa 8, `room.ts:277`), e fatias (`slices`: destroços e grupos soltos) | `game-destruction-three/src/renderer.ts` (`drainQueue`, `runSlices`) | Orçamento próprio, dentro de `renderer.update` |
| `crease` do veículo: `pump(budgetMs = 2.5)` **por veículo**, chamado no fim do `update` de cada `DestructibleImpl` de veículo | `game-vehicles/src/destructible/visual.ts:426`, chamado por `impl.ts:986` | Orçamento próprio, multiplicado pelo número de veículos com trabalho |
| Pintura do reboco lascado, `paintBudgetMs` (padrão `Infinity`; a área das casas passa 4) | `game-floorplan-three/src/destruction/breach.ts:413` (`flush`) | Orçamento próprio |

Somados, os orçamentos soltos chegam a `8 + 4 + 2 + 2,5 × V` ms por quadro no pior caso, com `V` veículos amassados ao mesmo tempo:
16,5 ms com um veículo (um quadro inteiro de 60 Hz) e 24 ms com quatro. O `game-runtime` junta tudo isso num dono só, e a fila do
`crease` passa a ser uma só para todos os veículos (§5).

## 2. Pacote

- **Nome:** `@adatechnology/game-runtime`, camada **L1**. Depende só de `game-contracts` (tipos). Sem three.js e sem DOM obrigatório.
- **Arquivos:** `src/phases.ts`, `src/scheduler.ts`, `src/budget.ts`, `src/clock.ts`, `src/commands.ts`, `src/loop.ts` (driver opcional de
  `requestAnimationFrame`), `src/types.ts`, `src/index.ts`. Cada arquivo abaixo de 200 linhas.
- **Exports:** `createScheduler`, `createFrameBudget` (também acessível por `scheduler.budget`), `createCommandBuffer`, `startLoop`,
  `FRAME_PHASES` e `DEFERRED_PRIORITY` (reexportados do contrato), os tipos.

### 2.1 O que vai para o `game-contracts` (L0)

Os núcleos e adaptadores precisam implementar uma fila adiada **sem** depender do runtime, e o `ModuleHost` precisa nomear a fase. Por
isso os tipos e as prioridades padrão moram no contrato, e o runtime só os implementa. `DEFERRED_PRIORITY` fica no contrato porque
quem registra (a área das casas, a de veículos) não depende do runtime.

```ts
// game-contracts/src/frame.ts
export const FRAME_PHASES = ['input', 'fixedSimulate', 'lateSimulate', 'present', 'render', 'idle'] as const
export type FramePhase = (typeof FRAME_PHASES)[number]

/**
 * Presentation work a system leaves for later frames, run in small units within a shared time budget.
 * Never simulation: nothing that consumes a seeded generator or decides an outcome may wait in a queue (see the runtime design §3.4).
 */
export interface DeferredQueue {
  /** Stable name for stats and logs (`audio.voices`, `destruction.events`). */
  readonly id: string
  /**
   * Units waiting. 0 means idle; the budget skips the queue without calling `run`. `frame` is the budget's frame counter: a queue may
   * report 0 for the rest of a frame (the crease queue does in the frame a panel was torn). Same value for repeated calls in one frame.
   */
  pending(frame?: number): number
  /**
   * Runs units in order until `clock() >= deadline`. Contract: when `pending() > 0` it runs **at least one** unit, even with a deadline
   * already past; it never runs a unit after it saw the deadline pass. Returns how many units it ran.
   */
  run(deadline: number, clock: () => number): number
  /** Runs everything now (synchronous step, clear, dispose). */
  flush(): void
  /**
   * Called by `budget.register`: from now on the owner stops draining on its own (no MessageChannel, no drain inside `update`).
   * Never called by a getter; a queue nobody registered keeps today's internal draining.
   */
  attach?(): void
  /** Called by the unregister function and by `budget.dispose`: the owner goes back to its internal draining. */
  detach?(): void
}

/** Where a module registers a deferred queue with the host's budget. */
export interface DeferredQueueOptions {
  /** Higher runs first. See DEFERRED_PRIORITY. */
  readonly priority: number
  /** `present` runs before the render (the work must show this frame); `idle` runs after it. Default `idle`. */
  readonly phase?: 'present' | 'idle'
  /** Starvation guard: the queue runs at least one unit every this many frames, even with the budget spent. Default 4. */
  readonly minEveryFrames?: number
  /** Milliseconds of every frame kept for this queue before the others share the rest (when it has work). Default 0. */
  readonly reserveMs?: number
}

/** Default priorities and reserves of the kit's queues; a host may override any of them. */
export const DEFERRED_PRIORITY = {
  'destruction.events': { priority: 300, phase: 'present' },
  'floorplan.breach-paint': { priority: 250, phase: 'present' },
  'audio.voices': { priority: 200, phase: 'idle', reserveMs: 1 },
  'vehicles.crease': { priority: 100, phase: 'idle' },
} as const satisfies Readonly<Record<string, DeferredQueueOptions>>
```

### 2.2 Extensão do `ModuleHost` (compatível)

```ts
export interface FrameOptions {
  /** Default `lateSimulate`, which is where every `onFrame` runs today. */
  readonly phase?: Exclude<FramePhase, 'render'>
  /** Lower runs first inside the phase; ties keep the order of registration. Default 0. */
  readonly order?: number
}

export interface ModuleHost {
  // ...
  /** Run every frame in the given phase (default `lateSimulate`) with the phase's seconds. Returns the unsubscribe function. */
  onFrame(update: (dt: number) => void, options?: FrameOptions): () => void
  /** Registers a deferred queue with the host's frame budget. Returns the function that takes it out. A host without a budget leaves it out. */
  defer?(queue: DeferredQueue, options: DeferredQueueOptions): () => void
}
```

- O segundo parâmetro é opcional: todo módulo de hoje compila e se comporta igual (D2).
- `render` não é aceito no `onFrame`: quem desenha é o host. Um módulo que precisa de algo depois do render usa `idle`.
- O `dt` que cada fase entrega está na tabela da seção 3.1.

## 3. Agendador

### 3.1 Fases

Ordem fixa por quadro. `T` é o tempo real do quadro já limitado e encaixado (seção 3.2), `s` é a escala de tempo (`timeScale`), `h = 1/60`.

| Fase | Quantas vezes | `dt` entregue | Pausado | O que mora aqui |
|---|---|---|---|---|
| `input` | 1 | `T` (sem escala) | roda | teclado e mouse, olhar do jogador, câmera, avatar; o que muda a simulação (tiro, uso, chute, empurrão) **vira comando** (§3.4) |
| `fixedSimulate` | 0 a `maxSubsteps` (4) | `h` | **não roda** | simulação determinística por semente: comandos da entrada, destruição, fluidos, multidão, explosivos, elos da reação em cadeia, corpo do jogador |
| `lateSimulate` | 1 | `T · s` | **não roda** | o que depende do resultado do passo fixo e ainda é simulação sem semente: animações, `onFrame` sem fase (o comportamento de hoje), vfx |
| `present` | 1 | `T · s` (0 se pausado) | roda | adaptadores copiam o estado para a cena (`renderer.update`, `sync`, luzes), fila adiada de `present`, HUD |
| `render` | 1 (pulada em `frame(dt, { render: false })`) | `T` | roda | `gl.render`, câmera de tremor (`applyCamera`), métricas |
| `idle` | 1 | `T` | roda | filas adiadas de `idle` (vozes, `crease`), tarefas de fundo |

- **Interpolação:** depois do passo fixo, `ctx.alpha = accumulator / h`, em `[0, 1)`. **Todo movimento visível produzido em
  `fixedSimulate` é interpolado em `present`** (posição anterior e atual do tick, misturadas por `alpha`): sem isso, a 144 Hz o objeto
  anda em degraus de 1/60 s e a 50 Hz ele engasga a cada seis quadros. É regra de revisão para todo sistema que for para o passo fixo
  (passo 6 da seção 8), não uma opção do adaptador. Quem só mostra estado discreto (furo, dano, cor) não interpola.
- **Tempo real em `present`:** o `dt` de `present` é escalado e é 0 pausado. Sistema de `present` que anima pelo relógio de parede
  (cursor, HUD que pisca, câmera livre, luz que esmaece no `LightBudget`) lê `ctx.realDt`.
- **Por que `present` vem antes de `render` e a fila de `present` existe:** os eventos da destruição e a pintura do reboco precisam
  aparecer no quadro em que aconteceram ("o furo aparece no primeiro quadro", `desempenho-explosoes.md`). As vozes e o `crease`
  podem esperar, por isso ficam em `idle`.

### 3.2 API

```ts
export interface FrameContext {
  /** Seconds this phase advances (see the phase table). */
  readonly dt: number
  /** Real seconds of this frame after the clamp and the snap, never scaled, not 0 when paused. */
  readonly realDt: number
  /** The fixed step, seconds (1/60 by default). */
  readonly fixedDt: number
  /** Accumulator / fixedDt after the fixed phase, in [0, 1). 0 inside and right after `advance`. */
  readonly alpha: number
  /** Frames since start. */
  readonly frame: number
  /** Fixed steps since start: the clock of everything seeded. */
  readonly tick: number
  /** Index of the substep inside this frame (fixedSimulate only), else 0. */
  readonly substep: number
  /** Simulated seconds since start (sum of the dt given to lateSimulate). */
  readonly simTime: number
  readonly paused: boolean
  /**
   * true inside `advance` (a scenario steps the world). Systems that today do not run in the room's `step` read it and skip
   * (`useTool`, `kickLight`, `pushByPlayer`, `stepAvatar`, HUD); the player's input system passes 0 to `player.update`.
   */
  readonly scripted: boolean
  /**
   * false in a frame run with `simulate: false` (the display frame while a scenario steps the world): `present` systems that today
   * live in the room's `update` (HUD, progress, `flushLog`, bench metrics, `reachAvatar`) skip, as `if (!scenarioRunning) update(dt)`
   * does today. true in every other frame and inside `advance`.
   */
  readonly simulated: boolean
}

export type SystemFn = (ctx: FrameContext) => void

export interface SystemOptions {
  readonly phase: FramePhase
  /** Lower first; ties keep the order of registration. Default 0. */
  readonly order?: number
  /** For stats and errors. */
  readonly id?: string
}

export interface SchedulerOptions {
  /** Default 1/60. */
  readonly fixedDt?: number
  /** Default 4. What is left after the last substep is dropped (`stats().droppedSeconds`). */
  readonly maxSubsteps?: number
  /** Real seconds of one frame are clamped to this. Default 0.25 (the room passes 0.05, its value today). */
  readonly maxFrameSeconds?: number
  /** A frame time within this many ms of a whole number of fixed steps is snapped to it. Default 0.25. 0 turns it off. */
  readonly snapMs?: number
  /** Frame budget for the deferred queues, ms. Default 4. */
  readonly budgetMs?: number
  /** Milliseconds clock; default `performance.now` (or `Date.now`). Tests inject a fake. */
  readonly clock?: () => number
  /** A system that throws: default logs once per system id and keeps the frame going. */
  readonly onError?: (error: unknown, system: { id: string; phase: FramePhase }) => void
}

export interface FrameRunOptions {
  /** false skips the render phase (headless tests, `room.update`). Default true. */
  readonly render?: boolean
  /** false skips input, fixedSimulate and lateSimulate (a scenario is stepping the world synchronously). Default true. */
  readonly simulate?: boolean
  /**
   * true: `realSeconds` is used as given. No `maxFrameSeconds` clamp, no snap, no `maxSubsteps` cap (every whole fixed step runs, the
   * remainder stays in the accumulator, nothing goes to `droppedSeconds`), one `input` with `dt = realSeconds` and one `lateSimulate`
   * with `dt = realSeconds · s`. For `room.update(dt)`, whose callers pass 0.1 to 0.4 s on purpose. Default false.
   */
  readonly exact?: boolean
}

export interface Scheduler {
  add(system: SystemFn, options: SystemOptions): () => void
  /** Runs one frame with `realSeconds` of wall time. */
  frame(realSeconds: number, options?: FrameRunOptions): void
  /**
   * Advances `seconds` of simulation synchronously, in steps of `dt` (default fixedDt), with no render, `ctx.scripted = true` and the
   * budget unbounded (every queue drained each step). Resets the accumulator before and after (`alpha = 0`). For scenarios and tests.
   */
  advance(seconds: number, options?: { readonly dt?: number }): void
  pause(): void
  resume(): void
  readonly paused: boolean
  /** 1 = real time, 0.25 = the room's slow motion. Scales fixedSimulate's accumulator and lateSimulate/present dt. */
  timeScale: number
  /** Forgets the accumulator and the last frame time (after the tab comes back, after a reset). */
  resetClock(): void
  readonly budget: FrameBudget
  /** Commands the input phase leaves for the next fixed tick (§3.4). */
  readonly commands: CommandBuffer
  stats(): SchedulerStats
  dispose(): void
}

export interface SchedulerStats {
  readonly frame: number
  readonly tick: number
  readonly substepsLastFrame: number
  readonly droppedSeconds: number
  /** Milliseconds per phase in the last frame. */
  readonly phaseMs: Readonly<Record<FramePhase, number>>
  readonly budget: BudgetStats
}

export function createScheduler(options?: SchedulerOptions): Scheduler

export interface LoopOptions {
  /** Default `globalThis.requestAnimationFrame` / `cancelAnimationFrame`; a host without them passes its own (tests, workers). */
  readonly requestFrame?: (callback: (nowMs: number) => void) => number
  readonly cancelFrame?: (handle: number) => void
  /** Called first in every frame with the unclamped real seconds (the room's metrics). */
  readonly onFrame?: (realSeconds: number) => void
  /** true: this frame only presents and renders (a scenario is stepping the world). */
  readonly skipSimulation?: () => boolean
}

/** Drives `scheduler.frame` from the display's frames; listens to `visibilitychange` when there is a document. Returns the stop function. */
export function startLoop(scheduler: Scheduler, options?: LoopOptions): () => void
```

**Regras de execução:**

- `add` durante um quadro vale **a partir do quadro seguinte**; `remove` durante um quadro marca o sistema como morto (ele não roda mais
  nem neste quadro), e a lista é compactada no fim da fase. Iterar nunca aloca.
- Ordem dentro da fase: `order` crescente e, no empate, ordem de registro (lista ordenada por inserção, sem `sort` por quadro).
- **Acumulador sem deriva:** o acumulador conta em ticks inteiros de microssegundos (`Math.round(seconds * 1e6)`), com `h` também em
  microssegundos, para que 60 quadros de `1/60` deem exatamente 60 passos (com `float`, `1/60` somado 60 vezes fica abaixo de 1 e
  perde um passo).
- **Encaixe do tempo do quadro:** o `requestAnimationFrame` entrega 16,4 ms, 16,9 ms, 16,6 ms num monitor de 60 Hz. Se `|T − k·h| ≤ snapMs`
  para algum inteiro `k ≥ 1` (0,25 ms por padrão), `T` vira `k·h` e a diferença vai para um resíduo que entra no quadro seguinte (a soma
  do tempo nunca muda). Sem isso, o acumulador oscila em volta de `h` e o quadro alterna 0 e 2 subpassos, o que aparece como tremor
  mesmo com interpolação.
- `frame(T)` com `T` acima de `maxFrameSeconds` é limitado antes de tudo. Depois de `maxSubsteps` passos, o resto do acumulador vai para
  `droppedSeconds`: a simulação fica mais lenta que o relógio, nunca entra em espiral.
- `frame(T, { exact: true })` pula as três coisas da regra acima (limite, encaixe, teto): o `dt` de quem chama é a verdade. `room.update(0.4)`
  continua sendo um `stepSim(0.4 · timeScale)`, como hoje. Quem chama com `exact` assume o custo de um `dt` grande (é só a API de teste e
  de host sem laço).
- **`advance(seconds, { dt })`, exatamente o `step` de hoje (`room.ts:3330-3340`):** `n = max(1, round(seconds / dt))` iterações, cada uma
  `input` (dt) → `fixedSimulate` → `lateSimulate` (dt, **sem** `timeScale`: `s = 1` dentro do `advance`, porque o `step` chama `stepSim(dt)`)
  → `present` → `idle`. `ctx.scripted = true`, `ctx.simulated = true`. A pausa do agendador é ignorada no `input` (o `step` chama
  `push.step(dt)`, `doors.step(dt)` e `followHeld(dt)` sem olhar `paused`) e respeitada em `lateSimulate` (o `stepSim` de hoje começa com
  `if (paused) return`). Em `fixedSimulate`, cada iteração roda `dt / h` passos (1 com `dt = 1/60`, 2 com `1/30`), sem acumulador.

### 3.3 Pausa e escala de tempo (mapa da sala)

| Sala hoje | No agendador |
|---|---|
| `paused` (`room.pause()`/`resume()`): `stepSim` não roda; `push.step(0)`, `doors.step(0)`, `stepAvatar(0)`; o jogador ainda olha | `scheduler.pause()`: `fixedSimulate` e `lateSimulate` não rodam; `input` roda com `realDt` e os sistemas da sala leem `ctx.paused` para passar 0 a empurrão, portas e avatar, como hoje |
| `setSlowMotion(on)`: `timeScale = 0.25` só no `stepSim`; jogador, empurrão e portas seguem em tempo real | `scheduler.timeScale = 0.25`: escala o acumulador do passo fixo e o `dt` de `lateSimulate`/`present`; `input` continua com `realDt` (igual a hoje) |
| `setFastForward(on)`: **não** é escala de tempo; repete `world.update` e `fluids.update` 10× com o mesmo `dt` | Fica como está, dentro do sistema da sala que chama `world.update` (`reps`). Não vira conceito do agendador: acelerar tudo também aceleraria vfx, áudio e animação, e isso mudaria os cenários que usam o modo rápido |

### 3.4 Determinismo por semente

- **Contrato:** todo sistema que consome o gerador com semente ou muda estado que decide resultado (dano, queda, contágio, posição de
  agente) roda em `fixedSimulate`. `lateSimulate` é para o que só depende do estado (animação, apresentação).
- **Entrada vira comando.** `input` roda uma vez por quadro com tempo real; se ele chamasse `useTool` direto, o tiro (dispersão com
  semente, `Hit`, dano) cairia em instantes diferentes a 30, 60 ou 144 Hz. Por isso o que a entrada faz que muda a simulação (tiro, uso,
  arremesso, chute, empurrão, abrir porta) é gravado em `scheduler.commands` com o tick em que vai valer (`ctx.tick + 1` do último passo
  rodado) e é consumido pelo sistema de comandos, **o primeiro** de `fixedSimulate` (ordem −10000), no próximo tick. Um quadro sem
  subpasso guarda o comando para o próximo quadro que tiver. A entrada contínua (gatilho apertado, empurrão segurado) vira um comando de
  estado (`hold: true`/`false`) que o sistema lê a cada tick, não um comando por quadro.

  ```ts
  export interface Command { readonly kind: string; readonly tick: number; readonly payload?: unknown }
  export interface CommandBuffer {
    /** From `input`: valid from the next fixed tick. */
    push(kind: string, payload?: unknown): void
    /** From the first fixedSimulate system: the commands of this tick, in push order. */
    take(tick: number): readonly Command[]
  }
  ```

- **O que a garantia diz:** a mesma semente e a **mesma sequência de comandos por tick** dão o mesmo estado no mesmo `tick`, a 30, 60
  ou 144 quadros por segundo (prova na seção 7). Ela não diz que a mesma pessoa apertando a mesma tecla em duas máquinas dá o mesmo jogo:
  o tick em que o comando cai depende do quadro em que o teclado foi lido. Replay e rede gravam comandos, não teclas.
- **Até a migração dos comandos** (passo 6 da seção 8), a sala continua chamando `useTool` em `input`; a garantia vale para os sistemas
  sem entrada (os cenários e o teste 4 da seção 7), e o documento não promete mais que isso.
- **Regra: uma `DeferredQueue` nunca carrega trabalho de simulação.** Uma fila é drenada conforme o tempo da máquina: se ela decidisse
  dano ou consumisse a semente, uma máquina lenta teria outro resultado. As quatro filas da seção 5 são só apresentação (desenhar o
  furo, pintar o reboco, montar a voz, suavizar normais). O `checkDeferredQueue` não consegue provar isso; a regra é de revisão, e o
  desenho de cada fila nova diz por que ela é apresentação.
- **Reação em cadeia** (Fase 4b): os elos (explosão que detona explosivo vizinho, corpo que cai e quebra) são contados em **ticks**
  dentro de `fixedSimulate`, com um teto determinístico de elos por tick (o que passa do teto vai para o tick seguinte, na ordem do
  evento). Só a apresentação de cada elo (efeito, luz, som, furo) passa pelo orçamento. Assim a cadeia dá o mesmo resultado em qualquer
  máquina, e uma tempestade de elos nunca vira um quadro de 100 ms de simulação.
- O `ctx.tick` é o relógio dos sistemas com semente. `simTime` é só para exibir.

## 4. `scheduler.budget`: um orçamento por quadro

```ts
export interface BudgetStats {
  readonly ms: number
  readonly spentMs: number
  /** Milliseconds the last frame went over; repaid by the next one (capped at one budget). */
  readonly debtMs: number
  readonly queues: ReadonlyArray<{ readonly id: string; readonly pending: number; readonly ranUnits: number; readonly spentMs: number; readonly framesWaiting: number; readonly forced: number }>
}

export interface FrameBudget {
  /** Milliseconds per frame shared by every queue. Default 4. */
  ms: number
  /** Calls `queue.attach?.()`; the returned function calls `queue.detach?.()` and takes it out. */
  register(queue: DeferredQueue, options: DeferredQueueOptions): () => void
  /** Drains the queues of one phase; the scheduler calls it, a host without the scheduler may too. */
  drain(phase: 'present' | 'idle'): void
  /** Every queue to empty, now (synchronous step, clear). */
  flushAll(): void
  /** Unbounded: every drain runs every queue to empty (scenarios, goldens). */
  unbounded: boolean
  stats(): BudgetStats
  /** Detaches every queue (each owner goes back to its internal draining). */
  dispose(): void
}

export function createFrameBudget(options?: { readonly ms?: number; readonly clock?: () => number }): FrameBudget
```

**Algoritmo de `drain(phase)`** (uma conta por quadro, dividida entre `present` e `idle`):

1. No início do quadro, `available = max(0, ms - debt)`; `debt = 0`. As **reservas** saem primeiro: para cada fila com `reserveMs > 0`
   e trabalho (`pending(frame) > 0`), `reserved[fila] = min(reserveMs, available)`, descontado de `available`. A soma das reservas não
   passa de metade do orçamento (o `register` recusa com erro uma reserva que estoure isso).
2. `present` gasta primeiro o que não é reservado; `idle` recebe o que sobrou. A conta é a mesma: uma fila de `present` com muito trabalho
   deixa `idle` sem a parte comum, e isso é desejado (o que aparece na tela vem antes das normais). Uma fila com reserva roda na sua
   fase com `reserva + parte comum que sobrar`.
3. Dentro da fase, as filas rodam por `priority` decrescente. Cada uma recebe `deadline = clock() + restante` e roda até o prazo.
4. **Garantia contra fome:** uma fila com trabalho que ficou `minEveryFrames` quadros sem rodar roda nesta vez mesmo com o orçamento
   gasto: chama-se `run(clock(), clock)`, e o contrato do `DeferredQueue` garante exatamente uma unidade. Conta em `forced`.
5. **Sobra carregada:**
   - o trabalho que não coube fica na fila e continua no quadro seguinte (é o comportamento de todas as filas de hoje);
   - o tempo que passou do teto (uma unidade grande) vira `debt` do quadro seguinte, limitado a um orçamento inteiro, para que um
     evento de 8 ms não seja seguido por mais 4 ms no quadro seguinte. A reserva é tirada antes da dívida ser cobrada da parte comum:
     a dívida nunca come a reserva.
6. `unbounded = true`: o passo 3 usa `deadline = Infinity`, as reservas não importam e a fome não existe.

**Prioridades padrão** (`DEFERRED_PRIORITY`, no `game-contracts`, sobrescrevível por opção):

| Fila | Fase | Prioridade | Reserva | Por quê |
|---|---|---|---|---|
| `destruction.events` (eventos e `slices`) | `present` | 300 | — | o furo e os destroços são o que o jogador vê |
| `floorplan.breach-paint` | `present` | 250 | — | o reboco lascado do mesmo evento |
| `audio.voices` | `idle` | 200 | 1 ms | a fila descarta o que passou de 250 ms; numa tempestade, `present` gastaria tudo e a garantia contra fome daria uma voz a cada 4 quadros, que é perder a explosão inteira no som. medido em `desempenho-explosoes.md`: ~74 vozes de uma granada em ~18 ms, cerca de 0,25 ms por voz, então 1 ms monta ~4 vozes por quadro e ~60 dentro da janela de 250 ms mesmo com `present` gastando o resto; o que passa disso é descartado pela latência, como hoje |
| `vehicles.crease` | `idle` | 100 | — | normais suaves de peça arrancada: até lá desenha com normais planas |

**O teto:** o padrão da biblioteca é 4 ms (D3). A sala começa a migração com `budgetMs: 8` (o maior orçamento de hoje, o dos
eventos) para que os números do `perf.mjs` fiquem iguais, e desce para 4 ms num commit próprio, só se o `perf.mjs` continuar dentro
de todos os orçamentos e o atraso das filas (`framesWaiting` máximo, novo no relatório) ficar abaixo de 15 quadros (250 ms).

## 5. Migração das filas adiadas (T4.2)

Regra que vem da lição dos goldens (`desempenho-explosoes.md`, "Os goldens: o que quase passou errado"): **o padrão continua
síncrono para quem usa a API direto.** Nenhuma opção existente muda de padrão.

**Ligar e desligar é do `register`, nunca de um getter.** Cada dono expõe a fila por um método sem efeito colateral (`deferredQueue()`
devolve sempre o mesmo objeto, e chamá-lo não muda nada). A drenagem interna só é desligada quando o orçamento chama `attach()`, dentro
de `budget.register`, e volta quando o orçamento chama `detach()` (na função devolvida pelo `register` e no `budget.dispose`). Uma fila
pedida e nunca registrada continua drenando sozinha, como hoje: esquecer o `register` nunca deixa trabalho parado.

| Fila | Opção de hoje (fica, com o mesmo padrão) | Fila nova | Com `attach` |
|---|---|---|---|
| Vozes do áudio | `createAudioEngine({ deferredStart: { budgetMs: 2, maxLatencyMs: 250 } })`, padrão desligado | `engine.deferredQueue(): DeferredQueue \| null` (`null` sem `deferredStart`) | A fila para de se agendar por `MessageChannel` (o `autoSchedule` do `createStartQueue` passa a ser um estado que `attach`/`detach` trocam); o `run(deadline)` é o laço do `drain` atual com o prazo recebido; o descarte por latência continua no relógio de parede |
| Eventos da destruição | `eventBudgetMs` (padrão `Infinity`) | `renderer.deferredQueue(): DeferredQueue` | `update(dt)` deixa de chamar `drainQueue`; `run(deadline)` = `runSlices` + aplicar eventos até o prazo, com o `sliceDeadline` igual ao prazo recebido (as fatias de destroços se dividem como hoje); `pending()` = eventos + fatias |
| `crease` dos veículos | `pump(budgetMs = 2.5)` chamado pelo `impl` de **cada** veículo | **uma** fila agregada `vehicles.crease`, criada pela composição dos veículos (`createCreaseQueue()` do `game-vehicles`), em que cada `VehicleVisual` vivo entra ao nascer e sai no `dispose` | Detalhe abaixo |
| Pintura do reboco | `paintBudgetMs` / `breachPaintBudgetMs` (padrão `Infinity`) | `breach.deferredQueue()`, exposto pela área das casas | `flush()` sem argumento deixa de pintar no `onFrame`; `run(deadline)` = o laço do `flush` com o prazo recebido. O caminho de emergência (`setTimeout` de `FOLLOW_FLUSH_FALLBACK_MS` com `flush(Infinity)`) fica |

**A fila agregada de `crease`:**

- Uma fila só, não uma por veículo: com uma por veículo, `V` filas de prioridade igual dividiriam o orçamento pela ordem de registro e o
  primeiro veículo levaria tudo. A agregada roda os visuais em **rodízio**: começa no seguinte ao último que rodou, roda um passo do
  `smoothing` (ou um pedaço do `warmIndexes`) de cada visual com trabalho e segue até o prazo. `pending()` = soma do trabalho dos visuais.
- **O quadro do rasgo fica de fora**, como hoje (`tornThisFrame`, `visual.ts:41`: "that frame already paid for the cut"). O `smoothLater`
  marca o visual; a primeira chamada de `pending(frame)` depois disso grava `holdFrame = frame` no visual, e `pending` conta 0 para
  ele enquanto `frame === holdFrame`. A primeira chamada acontece sempre no quadro do rasgo (o rasgo é simulação, a drenagem é depois),
  então o visual espera exatamente um quadro, quantos subpassos esse quadro tiver. Sem `frame` (o host sem agendador), vale o
  `tornThisFrame` de hoje.
- O `impl` continua chamando `vis.pump()` quando a fila agregada **não** está ligada (`attach` não foi chamado): o padrão de quem usa o
  veículo direto não muda. Ligada, o `pump()` só limpa o `tornThisFrame` e volta.
- A versão do atributo só muda no caminho espalhado (lição 1 dos goldens), que é este.

- **Quem registra:** a composição. A sala registra áudio e destruição (ela cria os dois). A área das casas e a área de veículos registram
  as suas pelo novo `host.defer?.(queue, options)`; um host sem orçamento não tem `defer`, e o módulo segue com o orçamento próprio de hoje.
- **Um jogo sem `game-runtime`** continua com as opções de hoje (`eventBudgetMs: 8` etc.) e nada muda para ele.
- As opções antigas de orçamento (`eventBudgetMs`, `pump(budgetMs)`, `paintBudgetMs`, `deferredStart.budgetMs`) **não** ficam
  `@deprecated` agora: são o caminho de quem não usa o agendador. Revisa-se na próxima major.

## 6. Casos de borda

| Caso | Comportamento |
|---|---|
| Aba escondida e volta (o `requestAnimationFrame` para; o primeiro `T` é de minutos) | `startLoop` escuta `visibilitychange` quando há `document` e chama `resetClock()` ao voltar; sem isso, o limite `maxFrameSeconds` e o teto de subpassos seguram o salto. O áudio suspende pelo próprio motor, como hoje |
| `dt` enorme no meio do jogo (GC, alerta do navegador) | Limitado a `maxFrameSeconds`; no máximo 4 subpassos; o resto vai para `droppedSeconds`. A sala passa `maxFrameSeconds: 0.05`, que é o `Math.min(0.05, realDelta)` de hoje |
| Pausa | `fixedSimulate` e `lateSimulate` não rodam; o acumulador não cresce (não há salto ao voltar); `present`, `render`, `idle` e as filas continuam (são apresentação de eventos que já aconteceram) |
| `step(seconds)` síncrono dos cenários | `scheduler.advance(seconds, { dt })`: zera o acumulador, roda em laço `input` → `fixedSimulate` (uma vez por `dt` quando `dt = h`) → `lateSimulate` → `present` → `idle`, **sem** `render`, com `ctx.scripted = true` e `budget.unbounded = true` durante a chamada, e zera o acumulador de novo no fim (`alpha = 0`: o quadro seguinte desenha o estado exato do último passo, sem misturar com o anterior). Com `scripted`, os sistemas da sala reproduzem o `step` de hoje (`room.ts:3330-3340`), na mesma ordem e com os mesmos argumentos: `n = max(1, round(seconds / dt))` iterações; em cada uma, `input` faz `seating.update()`, `player.update(0)`, `push.step(dt)`, `doors.step(dt)`, `followHeld(dt)` e nada mais (sem `kickLight`, `pushByPlayer`, `takeWish`, inclinação, `useTool`, `stepAvatar`, `frameStamp++`, `roomMetrics.frame`), **mesmo com `ctx.paused`** (o `step` não olha a pausa); `lateSimulate` chama `stepSim(dt)` com `s = 1` (o `step` ignora a câmera lenta) e não roda se pausado (o `if (paused) return` do `stepSim`); o `present` da sala **não faz nada** (sem `reachAvatar`, progresso, HUD, `flushLog`, métricas). Os comandos pendentes da entrada são descartados ao entrar no `advance` (o cenário dirige o mundo) |
| `step` com mais de 6 s (a sala usa `dt = 1/30`) | `advance(seconds, { dt: 1/30 })`. Enquanto a simulação estiver em `lateSimulate` (passos 1 a 4 da seção 8), o resultado é idêntico ao de hoje. Quando um sistema for para `fixedSimulate`, ele recebe dois passos de 1/60 por passo de 1/30, e os cenários longos são reavaliados naquele commit (seção 8, passo 6) |
| `room.update(dt)` público e `waitUntilReady` | `scheduler.frame(dt, { render: false, exact: true })`. **Sem limite e sem encaixe**: os chamadores passam 0,1 a 0,4 s de propósito (`test.mjs:129,132`, `interactables-test-area/test.mjs:222,297`, `weather-test-area/test.mjs:57`, `bench.test.ts:248,322`), e hoje isso é um `stepSim(dt · timeScale)` só; com `exact`, continua sendo um `lateSimulate` com esse `dt`. Não roda a verificação de luzes nem o `warmUp` (ela está em `render`, que `room.update` pula; §8, commit 1) |
| Cenário rodando enquanto o laço de tempo real gira (`scenarioRunning`) | `startLoop` aceita `skipSimulation: () => boolean` e, quando ele responde `true`, chama `frame(T, { simulate: false })`: `input`, `fixedSimulate` e `lateSimulate` são pulados, `present`, `render` e `idle` rodam, com `ctx.simulated = false` e `ctx.scripted = false`. O `present` da sala lê `ctx.simulated` e pula o que hoje mora no `update` (HUD, progresso, `flushLog`, métricas, `reachAvatar`): é o `if (!scenarioRunning) update(dt)` de hoje. A verificação de luzes (em `render`) **roda** nesses quadros, como hoje (`room.ts:3830-3837` roda antes do `if (!scenarioRunning)`) |
| Verificação de luzes de 250 ms (`lightsKey` → `warmUp`) | Sistema de `render`, ordem −1000 (antes de `applyCamera`), registrado só quando a sala é dona do laço, e pula quando `ctx.scripted`. Roda em todo quadro do laço, com ou sem cenário, como hoje; nunca dentro do `advance` (que não tem `render`, e a guarda cobre se um dia tiver) nem no `room.update` (`render: false`). Diferença de ordem: hoje ela roda antes do `update`; em `render` ela roda depois do `present` do mesmo quadro, então uma luz que um módulo cria no `update` é vista no mesmo quadro em vez de até 250 ms depois. Os contadores do `perf.mjs` não mudam (a verificação é a mesma, só mais cedo para a luz nova) |
| Sistema que lança erro | `onError` (padrão: um `console.error` por id de sistema e segue); um erro numa fase não pula as outras. Mesmo padrão do `drainQueue` de hoje |
| Sistema adicionado ou removido de dentro de outro sistema | Seção 3.2: entra no quadro seguinte; sai na hora |
| `advance` chamado de dentro de um sistema | Erro (`scheduler.advance: re-entrant call`); evita a recursão que hoje é possível chamando `step` dentro de `onFrame` |

## 7. Testes (vitest, relógio falso, sem DOM)

Arquivo `packages/game-runtime/tests/`:

1. **Ordem das fases:** sistemas que gravam `phase:order` num vetor; um quadro dá `input, fixed×n, late, present, render, idle`, e dentro
   da fase a ordem segue `order` e depois o registro. `render: false` pula só `render`.
2. **Teto de subpassos:** `frame(1)` com `maxFrameSeconds: 1` roda 4 passos e soma `1 - 4/60` em `droppedSeconds`; `frame(1/60)` 60 vezes
   roda exatamente 60 passos (prova do acumulador inteiro); `alpha` em `[0, 1)` e igual a `resto / h`.
3. **Encaixe:** quadros alternando 16,4 e 16,9 ms dão exatamente 1 subpasso cada; quadros de 20 ms (fora da janela) não são encaixados;
   a soma do tempo depois de 600 quadros é a mesma com e sem encaixe (o resíduo não se perde).
4. **Independência da taxa de quadros:** um sistema fixo com gerador de semente (o `random` do `game-contracts`) e uma lista fixa de
   comandos por tick acumula um hash do estado; rodar 10 s em quadros de 1/30, 1/60, 1/144 e em quadros com jitter sorteado (8 a 40 ms)
   dá o mesmo hash no mesmo `tick`.
5. **Comandos:** um comando empurrado em `input` aparece no `take` do primeiro tick seguinte, nunca no mesmo tick; num quadro sem subpasso
   ele espera; dois comandos no mesmo quadro saem na ordem do `push`.
6. **Pausa e escala:** pausado, `fixedSimulate`/`lateSimulate` não rodam e `input` recebe `realDt`; `present` recebe `dt = 0` e
   `realDt > 0`; com `timeScale = 0.25`, 240 quadros de 1/60 dão 60 passos fixos e `lateSimulate` recebe `1/240`.
7. **Orçamento, prioridade:** três filas falsas em que cada unidade custa 1 ms no relógio falso; com 4 ms, a de prioridade maior roda 4
   unidades e as outras nenhuma.
8. **Orçamento, reserva:** uma fila de `present` sempre cheia e uma de `idle` com `reserveMs: 1`; a de `idle` roda 1 ms em todo quadro
   em que tem trabalho, e a dívida de uma unidade de 10 ms em `present` não a corta; `register` com reservas somando mais da metade do
   orçamento lança.
9. **Orçamento, fome:** a fila de prioridade baixa roda pelo menos uma unidade a cada `minEveryFrames` quadros, mesmo com a alta sempre
   cheia; `forced` conta essas vezes.
10. **Orçamento, sobra:** uma unidade de 10 ms gera `debt` de 4 ms (limitado a um orçamento); o quadro seguinte tem 0 ms comuns livres e
    só reservas e a garantia contra fome rodam.
11. **Orçamento, `present` antes de `idle`:** a conta é a mesma; `present` gasta primeiro.
12. **`attach`/`detach`:** `register` chama `attach` uma vez; a função devolvida chama `detach`; `budget.dispose` chama `detach` de
    todas; obter a fila (`deferredQueue()`) não chama nenhum dos dois.
13. **`pending(frame)`:** uma fila que devolve 0 num quadro não recebe `run` nesse quadro, nem pela garantia contra fome.
14. **`advance`:** `unbounded` e `scripted` durante a chamada e restaurados depois; nenhuma fila sobra com trabalho; `render` não roda;
    `alpha === 0` no quadro seguinte; comandos pendentes descartados; `advance(0.5, { dt: 1/60 })` roda 30 iterações e `advance(0.001)`
    roda 1 (`max(1, round(...))`); com `timeScale = 0.25`, `lateSimulate` recebe `dt` sem escala; pausado, `input` roda com `dt` e
    `lateSimulate` não roda.
15. **`exact`:** `frame(0.4, { exact: true })` com `maxFrameSeconds: 0.05` entrega `0.4` a `input` e `0.4 · s` a um único `lateSimulate`,
    roda todos os passos fixos inteiros, sem teto (com `h = 16 667 µs`, 23 passos e 16 659 µs de resto: `passos · h + resto = 400 000 µs`),
    e `droppedSeconds` fica 0; `frame(0.0166, { exact: true })` não é encaixado.
16. **Quadro de cenário:** `frame(T, { simulate: false })` dá `ctx.simulated = false` e `ctx.scripted = false` em `present` e `render`.
17. **Contrato do `DeferredQueue`:** um helper `checkDeferredQueue(queue)` no `game-contracts` (como o `checkDestructible`) prova que `run`
    com prazo passado roda exatamente uma unidade, que `pending` é estável dentro de um quadro e que `attach`/`detach` são idempotentes.
    As quatro filas da seção 5 passam nele.
18. **Remoção durante a iteração e reentrância** (seção 6).

Nos pacotes migrados (T4.2): o teste de cada fila prova que a mesma sequência de eventos, drenada pelo orçamento ilimitado, dá o
mesmo resultado que a opção síncrona de hoje (mesmo hash de cena, mesma versão de atributo); que sem `attach` a drenagem interna
continua; e, no `game-vehicles`, que a fila agregada não roda o visual no quadro do rasgo e reparte entre dois veículos em rodízio.

## 8. Migração do laço da sala, passo a passo

Ordem: **1 → 2 → 5 → 3 → 4 → 6 → 7**. Os cenários (`step`) passam pelo agendador (commit 5) **antes** de os `onFrame` e a drenagem
saírem de dentro do `stepSim` (commits 3 e 4). Na ordem antiga, o commit 3 tirava os `frameListeners` do `stepSim` enquanto o `step`
ainda chamava `stepSim` direto: os cenários de módulo ficariam sem os `onFrame` até o commit 5, e esse commit não estaria verde.

Cada commit é verde sozinho. Em todos: `pnpm --filter @adatechnology/game-test-room test`, `node examples/test-room/test.mjs` (todos os
cenários passam, mesmo veredito), `doors-test.mjs`, `push-test.mjs`, `push-collider-test.mjs` e `pushable-test.mjs`,
`node examples/test-room/perf.mjs` (CI) e os goldens sem diferença. Abaixo, o que **cada** commit prova a mais.

1. **Envelope sem mudança de comportamento.** A sala cria `createScheduler({ maxFrameSeconds: 0.05, budgetMs: 8, snapMs: 0 })` e registra:
   - `lateSimulate`, ordem 0: o `update(dt)` inteiro de hoje (a escala e a pausa continuam dentro dele);
   - `render`: `applyCamera` → `gl.render` → `pinPrograms` → `restoreCamera` → `roomMetrics.rendered()`;
   - **só quando a sala é dona do laço** (`ownRenderer`, o `ownsLoop` de hoje): `render`, ordem −1000, a verificação de luzes de 250 ms
     (`lightsKey` → `warmUp`), que pula quando `ctx.scripted`; e o `startLoop(scheduler, { onFrame: (real) => roomMetrics.frame(real), skipSimulation: () => scenarioRunning })`.
     Ela roda em todo quadro do laço, com ou sem cenário (hoje, `room.ts:3830-3837`, ela vem antes do `if (!scenarioRunning)`), e nunca
     no `step`. Um host que chama `room.update` não ganha verificação de luzes nem `warmUp`, como hoje (`room.update` pula `render`).
   - `room.update(dt)` → `scheduler.frame(dt, { render: false, exact: true })`: sem o limite de 0,05 s e sem encaixe, porque os chamadores
     passam 0,1 a 0,4 s (§6).
   - Neste commit o sistema único de `lateSimulate` é o `update(dt)` inteiro (pulado pelo `skipSimulation` durante o cenário, o
     `if (!scenarioRunning)` de hoje); a sala não tem sistema de `present`.
   - `snapMs: 0` neste commit: o encaixe muda o `dt` e entra no commit 2 com a prova dele.
   - Prova: `perf.mjs` dá os mesmos contadores (programas, buffers, draws) e, em `PERF_MODE=gpu`, p99 e pior quadro dentro do ruído
     da medição anterior (±0,5 ms); os quatro scripts de empurrão e portas (que usam `room.update` sem laço) passam sem mudança.
2. **Separar entrada e simulação.** `update` vira três sistemas:
   - `input`: `seating`, `player.update`, empurrão, portas, chute, avatar, inclinação, uso da ferramenta, `followHeld` (ainda chamadas
     diretas; os comandos são o passo 6);
   - `lateSimulate`: `stepSim(ctx.dt)`;
   - `present`: `reachAvatar`, progresso, HUD, `flushLog`, métricas da bancada (leem `ctx.realDt`, como o `hudAcc += dt` de hoje);
     pula quando `!ctx.simulated` (quadro do laço durante cenário), que é o `if (!scenarioRunning) update(dt)` de hoje.
   - Pausa e câmera lenta passam a ser `scheduler.pause()`/`timeScale`, e o sistema de `input` lê `ctx.paused` para passar 0 ao
     empurrão, às portas e ao avatar. `setFastForward` continua no `stepSim`. `snapMs` passa ao padrão (0,25).
   - Prova: `game-test-room/tests/room.test.ts` ("pause and walk": a pausa para a simulação e não o log), `doors.test.ts`,
     `push-scenery.test.ts` e `avatar.test.ts` passam sem mudança; `push-test.mjs` e `doors-test.mjs` passam; um teste novo da sala
     liga `setSlowMotion(true)` e prova que o jogador anda em tempo real e o mundo a 1/4; `perf.mjs` igual. O `step` ainda chama
     `stepSim` direto.
3. **(antigo 5) Cenários pelo agendador.** `step(seconds)` → `scheduler.advance(seconds, { dt: seconds > 6 ? 1/30 : 1/60 })`. Os sistemas
   de `input` e `present` da sala leem `ctx.scripted` e reproduzem exatamente o `step` de hoje (seção 6): `n = max(1, round(seconds/dt))`
   iterações de `seating.update()`, `player.update(0)`, `push.step(dt)`, `doors.step(dt)`, `followHeld(dt)` (sem olhar a pausa) e
   `stepSim(dt)` (sem `timeScale`; o `stepSim` ainda sai cedo se pausado); sem `kickLight`/`pushByPlayer`/`useTool`/`stepAvatar`; o
   `present` da sala retorna logo (sem `reachAvatar`, progresso, HUD, `flushLog`, métricas). O `present` dos quadros do laço durante o
   cenário (`simulate: false`) também pula, por `ctx.simulated = false`. A drenagem continua dentro do `stepSim` (`renderer.update` com
   `eventBudgetMs: 8`); o `advance` liga `budget.unbounded`, que ainda não tem fila, então nada muda nesse ponto.
   - Prova: `test.mjs` com o **mesmo** veredito em todos os cenários e o mesmo log de comportamento (o `test.mjs` grava o log em
     `shots/`; o commit compara o log antes e depois e mostra que não mudou). Nenhuma correção de comportamento entra aqui: se um
     cenário depender de `stepAvatar` ou do HUD no `step`, isso vira um commit separado depois, com o veredito que muda.
4. **(antigo 3) `onFrame` com fase.** O `stepSim` se divide em `lateSimulate` ordem −1000 (tudo até o ouvinte do áudio) e ordem +1000
   (traçadores e `flush()`). Os `frameListeners` viram sistemas `lateSimulate` ordem 0 por padrão, ou na fase pedida. A ordem relativa
   de hoje fica igual: módulos depois do vfx e antes do `flush`. Como o `step` já é `advance`, os cenários continuam vendo os `onFrame`.
   - Prova: os cenários dos módulos que usam `onFrame` (casas, veículos, armas, multidão, clima) dão o mesmo veredito; teste do pacote
     com um módulo falso que registra `onFrame` com e sem fase e grava a ordem.
5. **(antigo 4) Orçamento.** A sala registra `audio.deferredQueue()` e `renderer.deferredQueue()` com `budget.register` (o `attach` desliga
   a drenagem interna) e tira o `eventBudgetMs: 8` das opções do renderer. A sala implementa `host.defer`. A área das casas e a de
   veículos registram as suas (`floorplan.breach-paint` e a agregada `vehicles.crease`). Os 8 ms passam a ser divididos.
   - Prova: `test.mjs` com o mesmo veredito (o `advance` drena tudo com `unbounded`, então os cenários ficam **mais** determinísticos que
     hoje); `perf.mjs` em CI com os mesmos contadores; em GPU, a tempestade (`storm`) e `after_storm` sem quadro a mais acima do orçamento
     e `framesWaiting` máximo por fila no relatório; a ação `voice_storm` da bancada de áudio (`game-audio/src/bench/module.ts:266`) e a
     tempestade com o número de vozes tocadas e descartadas no relatório, comparado com o de antes do commit (a reserva de 1 ms segura isso).
6. **Passo fixo, um sistema por commit** (fora do aceite da T4.1; vale para a Fase 4b): primeiro os **comandos** (`useTool`, `kickLight`,
   `pushByPlayer`, abrir porta passam a `scheduler.commands`), depois `world.update` + `updateFires` + `fluids.update`, depois
   `explosives.update`, depois o `game-crowd`, cada um com a interpolação do que ele move na tela (§3.1). Cada commit mostra que os
   cenários que usam aquele sistema dão o mesmo resultado (com `dt = 1/60` o resultado é igual por construção: um passo por quadro) e
   lista os cenários longos que mudaram com 1/30 → 2×1/60.
7. **Teto de 4 ms.** `budgetMs` da sala de 8 para 4, só se o `perf.mjs` mantiver os orçamentos e `framesWaiting` máximo < 15.

O `room.ts` não encolhe nesta task (isso é a Fase 6); ele só perde o laço e ganha os registros.

## Aceite

```bash
pnpm --filter @adatechnology/game-runtime typecheck && pnpm --filter @adatechnology/game-runtime test
pnpm --filter @adatechnology/game-contracts test          # FRAME_PHASES, DEFERRED_PRIORITY, DeferredQueue, checkDeferredQueue
pnpm --filter @adatechnology/game-audio test && pnpm --filter @adatechnology/game-destruction-three test \
  && pnpm --filter @adatechnology/game-vehicles test && pnpm --filter @adatechnology/game-floorplan-three test
git diff --exit-code -- 'packages/*/tests/fixtures'       # goldens iguais
pnpm build && node examples/test-room/build.mjs && node examples/test-room/test.mjs
node examples/test-room/perf.mjs                          # CI: 0 programas, buffers e draws no orçamento
PERF_MODE=gpu node examples/test-room/perf.mjs            # máquina com GPU: nenhum orçamento a mais estourado
pnpm check:layers                                         # game-runtime em L1, só game-contracts
grep -n "requestAnimationFrame" packages/game-test-room/src/room.ts   # vazio: o laço é do runtime
```

## Perguntas em aberto

- **Fila de vozes dentro do quadro ou entre quadros: decidido.** As vozes vão para `idle`, dentro do callback do quadro, com
  `reserveMs: 1` (§4). Uma conta só, testável com relógio falso, e a reserva tira o risco que motivava a pergunta (a tempestade gastar o
  orçamento e o som morrer de fome). Não existe `drainIn: 'task'`. O caminho por `MessageChannel` continua para quem usa o motor de
  áudio sem orçamento (sem `attach`). O commit 5 da seção 8 mede; se o p99 da tempestade em GPU piorar mais que o ruído (±0,5 ms), a
  correção é ajustar a reserva, não voltar para tarefa.
