# T1.1 — Desenho do host do mundo (`createKitWorld`)

Status: **aprovado com mudanças pelo `architect` (2026-11-18); as nove mudanças obrigatórias estão aplicadas nesta versão** (marcadas
`[A1]`…`[A9]`). Lido em `origin/main` de 2026-11-18 (`room.ts` com 5.620 linhas); **linhas conferidas contra a `origin/main` de 2026-11-24
(`923fa511f`, `room.ts` com 5.615 linhas)** e trocadas pelas de hoje.

## 1. O que a leitura achou

A sala faz três coisas misturadas no mesmo arquivo:

| Camada | O que é | Um jogo precisa? |
|---|---|---|
| **Mundo** | renderer, cena, câmera; céu, sol e sombra; mundo de destruição; terreno e chão; fluidos e filme; áudio e oclusão; luzes, aquecimento e pools; efeitos e água; física (Jolt); renderizador da destruição; **os comportamentos de mundo que hoje leem a lista da sala** (impacto do que é arremessado, flutuação, peso no solo, fogo, golpe e fogo no chão, pegadas); agendador, filas, compassador e laço | Sim, igual em todo jogo |
| **Ação do jogador** | tiro, golpe, explosivos, pegar, segurar, arremessar, item na mão, uso de item, recipientes, andar e empurrar | Sim, com escolhas de jogo (teclas, inventário) |
| **Sala** | catálogo e `spawn`, tampos do cenário, painel, log, bancada, métricas, cenários, módulos, áreas, avatar, câmera de depuração | Não |

Duas ligações ficam **fora do `room.ts`** e também são de mundo: o motor Jolt (`examples/test-room/build.mjs` 89–122) e o coordenador de
workers com a porta do chão (`examples/test-room/src/main.js` 32–55, 117–126).

## 2. Onde mora e um arquivo por ligação

**`game-kit-defaults`, entrada `./world`** (`@adatechnology/game-kit-defaults/world`). É L5 (`L5_COMPOSITION`), sem regra que limite o que importa,
e nenhum dos adaptadores usados está em `D2_DEPRECATED_DEFAULTS`: o host não puxa conteúdo. **[A7]** A entrada nova precisa de duas coisas
para não fugir das checagens: o tsconfig gerado para o dependency-cruiser mapeia `@adatechnology/game-kit-defaults/world` para
`src/world/index.ts` (hoje só o nome raiz vai para `src`, e a subpasta cairia no `dist`, em `doNotFollow`), e o `tsup.config.ts` gera
`.d.ts` também para `src/world/index.ts`. O `game-physics-jolt` passa de dependência de desenvolvimento a dependência de produção do preset.

Cada arquivo em `packages/game-kit-defaults/src/world/` com até 200 linhas:

| Arquivo | Monta | Vem de (hoje) |
|---|---|---|
| `view.ts` | `WebGLRenderer` (se o jogo não deu), cena, câmera, `resize` | `room.ts` 265–298 |
| `light.ts` **[A1]** | fundo, `HemisphereLight`, sol, `followSun`, sombra do sol por qualidade; expõe `world.sun` | `arena.ts` 178–197; `room.ts` 4170, 5468–5471 |
| `graphics.ts` **[A1]** | ajustes do jogador e tuner (`createRoomGraphics` sai de `game-test-room/src/graphics.ts`), ligados ao `world.sun` | `room.ts` 307–320 |
| `ground.ts` | terreno e desenho, impl do chão, `onDeform` → acordar região, chão composto (seção 3) | 373–383, 614–619 |
| `destruction.ts` | `createDestruction` e o renderizador da destruição com física, efeitos, chão e workers; os ganchos viram eventos (seção 3) | 322–323, 491–590 |
| `pieces.ts` **[A2]** | a lista das peças soltas do mundo, mantida pelos eventos `piece`/`released` do renderizador | `loose`, `onPiece`, `onReleased` 539–590 |
| `world-rules.ts` **[A2]** | **na T1.3, só os ganchos** `world.rules.use({ fire, beforePhysics })` (fogo na primeira repetição depois do `world.update`; antes do passo da física, depois dos fluidos). As regras em si (`updateFires`, `syncLiters`/`syncPieceMass` e o `simulationStamp`, `updateImpacts`, `updateWater`, `updateLoads`, `rockPlayer`, `dropStainsOffFallenTops`, `flush`, `syncContainers`, pegadas e seguidores) leem `entries` e `loose` da sala e ficam nela até a Fase 1b dar o registro de objetos a elas (seção 6) | 2302, 566–612, 3664, 3722–3779, 3768, 396 |
| `liquids.ts` | fluidos, desenho, filme e ponte do filme, efeitos de água | 385–388, 488–490, 629–641 |
| `sound.ts` | motor de áudio com `createRaycastOcclusion`, som da destruição, amostras do kit e do jogo | 429–463 |
| `effects.ts` | `createVfxRenderer` com `groundAt`, `marklessAt`, `cratersAt` | 471–486 |
| `render-budget.ts` | `LightBudget`, `ProgramWarmup`, pools, sondas de aquecimento, efeitos aquecidos | 465–469, 4776–4820 |
| `physics.ts` | motor Jolt (build, threads, recuo para single), `KIT_WORLD`, `createPhysicsLoop`; ou `'own'` | `build.mjs` 89–122 |
| `workers.ts` | `createKitWorkers` e porta do chão | `main.js` 32–55, 117–126 |
| `frame.ts` | agendador, pontos de registro ordenados, filas, compassador, laço, desenho | 4078–4081, 4149–4209, 5539–5595 |
| `blast-pacing.ts` | o marca-passo da explosão (spec 018 D2) e o `holdFixed` do agendador, ligado por padrão | `game-test-room/src/blast-pacing.ts`; `room.ts` 4079 |
| `reset.ts` **[A6]** | volta ao mundo e aos fluidos pristinos, registra o chão de novo, volta a semente do filme | 1739–1752 |
| `create-kit-world.ts` | junta tudo e devolve o `KitWorld` | — |

## 3. API

```ts
const world = await createKitWorld(THREE, {
  container,
  renderer?, scene?, camera?,
  world?, fluids?, audio?: false | AudioEngine | KitWorldAudioOptions,   // [A6] prontos, como `TestRoomOptions` aceita
  bounds, ground?: TerrainLayout,
  physics?: 'jolt' | 'own' | PhysicsLoop,     // padrão 'jolt'
  workers?: WorkerCoordinator | 0,
  quality?, graphics?: false | GraphicsOptions,
  debris?: KitWorldDebrisOptions,
  frame?: { budgetMs?: number; targetMs?: number; onError?: FrameErrorHandler },   // [A5]
  onEvent?: (event: WorldEvent) => void,       // [A2] relatos do mundo (pousou, afundou, pegou fogo); a sala manda para o log, o jogo para a UI
})

world.view; world.sun                          // [A1]
world.destruction.world; world.destruction.renderer
world.destruction.on('piece' | 'released' | 'loosened' | 'brokenChecked', handler)   // [A3]
world.destruction.shoveable(test)              // [A3] quem decide o que o sopro move (a sala: objetos soltos dela)
world.ground.terrain
world.ground.on('blow', handler)               // [A3] o `onBlow` do terreno
world.ground.addProvider((renderer) => provider)   // [A3] preguiçoso: recebe o renderizador já criado, o que quebra o ciclo groundAt ↔ shownBoxes
world.ground.at(x, z)
world.objects                                  // [A2/A8] registro de objetos do mundo (seção 6)
world.pieces                                   // [A2]
world.liquids; world.sound; world.effects; world.lights; world.physics; world.workers
world.frame.add(system, { phase: 'input' | 'fixedSimulate' | 'lateSimulate' | 'present' | 'render', order?, id })   // [A4] §4.1: faixas reservadas ao host
world.frame.beforeWorld(system); world.frame.afterWorld(system)   // §4.1: dentro da entrada única `room.simulate` (ordem 1000)
world.frame.repeat = 10                        // `fastForward`: muda em tempo de jogo, fogo só na primeira repetição
world.blastPacing                              // marca-passo da explosão (`begin`, `clear`, `isHolding`) ou `undefined` desligado; os explosivos recebem este
world.warmUp()
world.render({ beforeRender?, afterRender?, view?, extraPasses? })   // [A5] ou `render: false` no `start` e o host não desenha
world.start({ skipSimulation?, minFrameMs?, onFrame?, render?: boolean })   // [A5] devolve stop
world.random                                   // fluxo com semente do host (12345); o `reset` volta a semente, um fluxo dado pelo jogo fica como está
world.frame.on(slot, system)                   // dentro de `room.simulate-frame` e `room.simulate-end`: beforeFrame, afterSound, afterWaterView, afterFilm, afterFrame, beforePresent, afterPresent
world.reset()                                  // [A6] inclui `blastPacing.clear()`
world.dispose()
```

- **Assíncrono** por causa do wasm do Jolt; com `physics: 'own'` resolve na hora.
- **Padrão com o ganho da spec 018 (2026-11-24, L18):** o host liga por padrão o que a página da sala liga na variante medida
  (`jolt-d4-worker`; a página liga marca-passo e chão no worker por padrão, Jolt e D4 só por parâmetro), e que o SDK não liga sozinho: Jolt (`physics: 'jolt'`), marca-passo da explosão (`blastPacing: {}`, hoje `game-test-room/src/blast-pacing.ts` e o
  `holdFixed` do agendador, `room.ts` 4079), política D4 dos destroços (`debris.blast`) e chão no worker (`debris.groundWorker` pela porta do
  coordenador, `createCoordinatorGroundPort`). Cada um desliga por opção (`blastPacing: false`...), para a sala manter os parâmetros de hoje.
  Regras (revisão do architect, 2026-11-24): **desligado é explícito** (`debris: { blast: false, groundWorker: false }`: hoje campo ausente
  é desligado, com o host passa a ser ligado; a T1.5 passa todos os campos); **chão no worker só com workers de verdade** (coordenador com
  `plan.total > 0`, como `main.js` 121; com `workers: 0` ou sem `Worker` no teste sem GPU fica desligado e o host diz isso em `world.info`);
  **o host só libera o que criou** (coordenador ou laço de física passado pelo jogo não é liberado no `dispose`); **o marca-passo nasce antes
  do agendador** (o `holdFixed` o lê, `room.ts` 4079). A sala passa o próprio `PhysicsLoop` da página (`window.__roomPhysics`), nunca
  `'jolt'`, para não montar outro motor com outra rosca e outro wasm.
- **Nenhuma opção inventada:** cada campo existe hoje em `TestRoomOptions`, na página ou numa chamada interna da sala.

## 4. Ordem do passo **[A4]**

O `simulateBeforeModules` (`room.ts` 4161–4209) intercala jogador, mundo e sala, e o `fastForward` repete o passo. Mudar essa ordem muda o hash de
eventos. O host publica pontos de registro com ordem fixa e um teste de ordem na T1.3:

| Ponto | Hoje roda ali |
|---|---|
| `beforeWorld` | andar, golpe, uso de item, explosivos, recipientes (ação do jogador) |
| mundo (do host) | `world.update`, fogo, fluidos, física, renderizador da destruição, regras de mundo |
| `afterWorld` | o que a sala faz depois do mundo e antes dos módulos |
| `afterRenderer` | os módulos e `simulateAfterModules` |
| `present` | luzes, filme, água |

A repetição do passo (`fastForward`, 10×) é opção do host (`repeat`), com a mesma regra de hoje: o fogo só na primeira repetição.

**[A9] Coordenação com a spec 010.** A T1.1 da 010 mudou a assinatura de `createFrameBudget`, a T3.3 trouxe o `stepFixed` (`e6ae1e950`) e a
T3.4 registrou a simulação da sala em `fixedSimulate` e o resto em `lateSimulate` (`7109f1cfa`). As três estão **feitas**
(`specs/010-quadro-com-prazo/tasks.md`), e a §4.1 é a ordem de hoje sobre elas. A vantagem continua: depois da T1.5, a 010 mexe em `world/frame.ts` (200 linhas), não
no `room.ts`.

### 4.1 A ordem de hoje, com o passo fixo da spec 010 (T1.3, 2026-11-24)

A spec 010 trocou o `simulateBeforeModules` por fases do agendador do `game-runtime` (`input`, `fixedSimulate`, `lateSimulate`, `present`,
`render`), registradas pela sala em `simulation-phases.ts` (`registerSimulationPhases`, `room.ts` 5538) e com o marca-passo segurando os
tiques (`holdFixed`, `room.ts` 4079). Os pontos de registro do host passam a ser **ordens dentro dessas fases**, não um passo próprio: o
`world.frame.add(system, { slot })` vira `scheduler.add(system, { phase, order })` com faixas reservadas.

| Fase / ordem | Quem | Hoje (`room.ts`) |
|---|---|---|
| `input`, −100000 | host: pose do passo restaurada, modo estrutural no tique | `simulation-phases.ts` 39–41 |
| `input`, 0 | jogo: entrada (teclas, mouse); no roteiro, `seating`, `player.update(0)`, empurrar, portas, item na mão | 5526–5537 |
| `fixedSimulate`, −100000 / −1000 | host: pose restaurada; eventos estruturais antes do passo | `simulation-phases.ts` 42, 52–54 |
| `fixedSimulate`, 1000, **`beforeWorld`** | ação do jogador: andar (`stepWalkPlan`), golpe, animações, uso de item, explosivos, recipientes | `simulateFixed` 4153–4161 |
| `fixedSimulate`, 1000, **mundo** | host: `world.update` (×`repeat`, fogo só na primeira), fluidos, litros, `stepFixed` do Jolt, renderizador da destruição, fogo no chão, água | 4162–4174 |
| `fixedSimulate`, 1000, **`afterWorld`** | regras de mundo e o que a sala faz depois do mundo: impactos, água, balanço do jogador, cargas, manchas, `flush` | 4175–4180 |
| `fixedSimulate`, 2000 | host: eventos estruturais do tique | `simulation-phases.ts` 59–61 |
| `lateSimulate`, −1000, **`frame`** | host: sol, som da destruição, terreno, efeitos, água, pegadas, fluidos, filme, ouvinte; jogo: armas na mão | `simulateFrame` 4184–4209 |
| `lateSimulate`, 0 | módulos do jogo (os da sala) | `afterRenderer` de antes |
| `lateSimulate`, 1000, **`frameEnd`** | traçantes e `vfx.present` | `simulateAfterModules` 4212–4228 |
| `present`, −1000 / 0 / 10 | host: pose desenhada (alpha), luzes; sala: `updatePresent` | `simulation-phases.ts` 44–49; 5539–5545 |
| `render`, −1000 / 0 | host: checagem de luzes e desenho (`gl.render`, camada de 1ª pessoa, vistas extras, `graphics`, compassador) | 5552–5586 |

Linhas que a tabela acima não mostra e que vão junto: o marca-passo (`blast-pacing.ts` 49–67: `input` −1.000.000 `room.blast-pacing-scripted`,
`fixedSimulate` −1.000.000 `step-start` e 1999 `blast-pacing-begin`, `lateSimulate` −2000 `slice`), a pose restaurada no `lateSimulate` −100000
(`simulation-phases.ts` 43) e os sistemas dos módulos (`onFrame`, `room.ts` 4687–4697), que escolhem fase e ordem; no empate vale a ordem de
registro (`game-runtime/src/phases.ts`), e um módulo em `fixedSimulate` 1000 roda depois do `room.simulate`.

`beforeWorld`, mundo e `afterWorld` continuam **uma entrada só** (`room.simulate`, ordem 1000), como hoje, por três motivos: (a) o caminho
antigo, em que um `dt` que não é tique roda `hooks.fixed(dt, false)` no `lateSimulate` −1000 e chama `physicsLoop.step(dt)` em vez de
`stepFixed` (`simulation-phases.ts` 62–65, `room.ts` 4169–4170): três entradas precisariam desse desvio cada uma; (b) hoje um erro para o resto
do passo, e entradas separadas continuariam depois de uma falhar; (c) módulos em ordem 1000 precisam ficar depois do `afterWorld`.

**O que a T1.3 move sem mudar** (senão o hash muda): `STEPS_PER_TICK` e `MAX_TICKS_PER_FRAME` (`simulation-phases.ts` 4–6),
`maxFrameSeconds: 0.05`, `resolveSimulationTick`, a chamada `registerFrameQueues` (`room.ts` 4080; a ordem de registro das filas decide o empate
de prioridade) e **os ids `room.*`** dos sistemas, que o teste de ordem, as tabelas por módulo (§15) e o `onError` usam. O teste de ordem da
T1.3 compara a lista de ids e ordens do agendador do host com a da sala de hoje.

**Hash de referência** (passo 0, `evidence.md`): 1819424859 sem marca-passo no tique 90; com marca-passo, 3822996173 é o último tique de 90
quadros (75 tiques, 15 quadros segurados), não o tique 90. A comparação entre caminhos é pelo tempo do mundo, com o comparador da spec 018
(`detcmp.cjs`) e a consulta `&solver=jolt&blastDebris=1&groundWorker=1`. A T1.5 grava também uma referência da página padrão (`own`, sem D4).

## 5. Oclusão de áudio (T1.2, feita)

`createRaycastOcclusion` no `game-audio`, com o filtro do raio como tipo estrutural; o `game-audio` depende só do `game-contracts`. A função nunca
foi exportada pela sala: não há reexportação deprecada.

## 6. Registro de objetos e ação do jogador **[A2, A8]**

As regras de mundo (seção 2) e a ação do jogador leem hoje `entries`, `loose`, `spawn`, `removeEntry` e `bag`, que são da sala. Extrair qualquer
uma sem um registro comum é reescrever. Por isso:

- **`world.objects`**: o registro de objetos do mundo, com entrar, sair, segurar, soltar e achar por id ou por ponto; o mundo e a ação leem só ele.
  A sala passa a registrar os objetos dela ali (o catálogo e o `spawn` continuam da sala).
- **Porto de relato** (`onEvent`): o que hoje é `action(...)` e `log` (27 chamadas só em 2525–3660) sai como evento tipado; quem escreve texto e
  UI é a sala ou o jogo.
- **Tamanho real:** 2411–3660 têm ~1.250 linhas e 808–929 mais ~120, além dos arquivos irmãos (`explosives.ts` 659, `blast-pacing.ts` 70, `player.ts` 724,
  `door-open.ts` 651, `furniture-push.ts` 290, `furniture-carry.ts` 168, `shovel.ts` 108, `dual-reload.ts` 93, sons 183): **3.000 a 4.000
  linhas**. Os piores pontos são `pickUpTool`/`respawnSaved`/`putDownTool` (3220–3310), `grab`/`throwHeld` (3313–3395) e as opções do
  `createExplosives` (2933–2964).
- **Onde mora:** a regra (sem three) no núcleo dono (`game-player` e `game-weapons`, pelo `kit_owner`); o que desenha **em L5, na entrada
  `game-kit-defaults/player`**, porque usa `fluids-three`, `terrain-three` e `destruction-three` juntos, e um `-three` de domínio não pode compor
  esses (`no-domain-adapter-to-adapter`; o `game-weapons-three` só compõe `vfx-three` e `items-three`).

## 7. O que fica de fora do host

UI, log, painel, bancada, métricas da sala, cenários, módulos e áreas, catálogo e `spawn`, avatar, `debugView` e `applyCamera`. As vistas extras dos
módulos (`moduleViews`) e a camada de primeira pessoa entram como `extraPasses` do `render`.

## 8. Recursos fora do bundle

O wasm do Jolt (o `moduleUrl` é relativo à página) e as amostras de som (`./sfx/`) são servidos ao lado da página. O README da cena diz como servir
os dois; o host recebe as URLs por opção (`physics.moduleUrl`, `audio.samplesBaseUrl`).

## 9. Riscos

- **O host engorda.** Nenhum arquivo de `world/` passa de 200 linhas; ligação nova é arquivo novo.
- **Hash de eventos muda na migração da sala** (ordem do passo). O teste de ordem da T1.3 e os goldens da sala na T1.5 seguram isso; mudou, para e
  pergunta.
- **Duas físicas:** o host tem padrão `'jolt'`; a sala passa `'own'` explicitamente até a T3.9 da spec 008.
- **A Fase 1b é grande** (3.000 a 4.000 linhas). Se passar de 2 semanas, a cena da Fase 2 entra só com andar, olhar e explosivos roteirizados pelo
  cenário (`src/test/`), e o tiro do jogador vem depois.
