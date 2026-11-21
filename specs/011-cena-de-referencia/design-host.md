# T1.1 — Desenho do host do mundo (`createKitWorld`)

Status: **aprovado com mudanças pelo `architect` (2026-11-18); as nove mudanças obrigatórias estão aplicadas nesta versão** (marcadas
`[A1]`…`[A9]`). Lido em `origin/main` de 2026-11-18 (`room.ts` com 5.620 linhas).

## 1. O que a leitura achou

A sala faz três coisas misturadas no mesmo arquivo:

| Camada | O que é | Um jogo precisa? |
|---|---|---|
| **Mundo** | renderer, cena, câmera; céu, sol e sombra; mundo de destruição; terreno e chão; fluidos e filme; áudio e oclusão; luzes, aquecimento e pools; efeitos e água; física (Jolt); renderizador da destruição; **os comportamentos de mundo que hoje leem a lista da sala** (impacto do que é arremessado, flutuação, peso no solo, fogo, golpe e fogo no chão, pegadas); agendador, filas, compassador e laço | Sim, igual em todo jogo |
| **Ação do jogador** | tiro, golpe, explosivos, pegar, segurar, arremessar, item na mão, uso de item, recipientes, andar e empurrar | Sim, com escolhas de jogo (teclas, inventário) |
| **Sala** | catálogo e `spawn`, tampos do cenário, painel, log, bancada, métricas, cenários, módulos, áreas, avatar, câmera de depuração | Não |

Duas ligações ficam **fora do `room.ts`** e também são de mundo: o motor Jolt (`examples/test-room/build.mjs` 104–122) e o coordenador de
workers com a porta do chão (`examples/test-room/src/main.js` 32–55, 119–124).

## 2. Onde mora e um arquivo por ligação

**`game-kit-defaults`, entrada `./world`** (`@adatechnology/game-kit-defaults/world`). É L5 (`L5_COMPOSITION`), sem regra que limite o que importa,
e nenhum dos adaptadores usados está em `D2_DEPRECATED_DEFAULTS`: o host não puxa conteúdo. **[A7]** A entrada nova precisa de duas coisas
para não fugir das checagens: o tsconfig gerado para o dependency-cruiser mapeia `@adatechnology/game-kit-defaults/world` para
`src/world/index.ts` (hoje só o nome raiz vai para `src`, e a subpasta cairia no `dist`, em `doNotFollow`), e o `tsup.config.ts` gera
`.d.ts` também para `src/world/index.ts`. O `game-physics-jolt` passa de dependência de desenvolvimento a dependência de produção do preset.

Cada arquivo em `packages/game-kit-defaults/src/world/` com até 200 linhas:

| Arquivo | Monta | Vem de (hoje) |
|---|---|---|
| `view.ts` | `WebGLRenderer` (se o jogo não deu), cena, câmera, `resize` | `room.ts` 263–296 |
| `light.ts` **[A1]** | fundo, `HemisphereLight`, sol, `followSun`, sombra do sol por qualidade; expõe `world.sun` | `arena.ts` 178–197; `room.ts` 4180, 5474–5477 |
| `graphics.ts` **[A1]** | ajustes do jogador e tuner (`createRoomGraphics` sai de `game-test-room/src/graphics.ts`), ligados ao `world.sun` | `room.ts` 305–318 |
| `ground.ts` | terreno e desenho, impl do chão, `onDeform` → acordar região, chão composto (seção 3) | 371–381, 610–615 |
| `destruction.ts` | `createDestruction` e o renderizador da destruição com física, efeitos, chão e workers; os ganchos viram eventos (seção 3) | 320–321, 489–586 |
| `pieces.ts` **[A2]** | a lista das peças soltas do mundo, mantida pelos eventos `piece`/`released` do renderizador | `loose`, `onPiece`, `onReleased` 535–586 |
| `world-rules.ts` **[A2]** | impacto do arremessado, flutuação, peso no solo, fogo e manchas queimando, golpe e fogo no chão, pegadas; sobre a lista de `pieces.ts` e os objetos registrados (seção 6) | 2297, 562–608, 3664, 3722–3779, 3768, 394 |
| `liquids.ts` | fluidos, desenho, filme e ponte do filme, efeitos de água | 383–386, 486–488, 625–637 |
| `sound.ts` | motor de áudio com `createRaycastOcclusion`, som da destruição, amostras do kit e do jogo | 427–461 |
| `effects.ts` | `createVfxRenderer` com `groundAt`, `marklessAt`, `cratersAt` | 469–484 |
| `render-budget.ts` | `LightBudget`, `ProgramWarmup`, pools, sondas de aquecimento, efeitos aquecidos | 463–467, 4780–4824 |
| `physics.ts` | motor Jolt (build, threads, recuo para single), `KIT_WORLD`, `createPhysicsLoop`; ou `'own'` | `build.mjs` 104–122 |
| `workers.ts` | `createKitWorkers` e porta do chão | `main.js` 32–55, 119–124 |
| `frame.ts` | agendador, pontos de registro ordenados, filas, compassador, laço, desenho | 4068–4078, 4151–4213, 5545–5600 |
| `reset.ts` **[A6]** | volta ao mundo e aos fluidos pristinos, registra o chão de novo, volta a semente do filme | 1734–1747 |
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
world.frame.add(system, { slot: 'beforeWorld' | 'afterWorld' | 'afterRenderer' | 'present', order? })   // [A4]
world.warmUp()
world.render({ beforeRender?, afterRender?, view?, extraPasses? })   // [A5] ou `render: false` no `start` e o host não desenha
world.start({ skipSimulation?, minFrameMs?, onFrame?, render?: boolean })   // [A5] devolve stop
world.reset()                                  // [A6]
world.dispose()
```

- **Assíncrono** por causa do wasm do Jolt; com `physics: 'own'` resolve na hora.
- **Nenhuma opção inventada:** cada campo existe hoje em `TestRoomOptions`, na página ou numa chamada interna da sala.

## 4. Ordem do passo **[A4]**

O `simulateBeforeModules` (`room.ts` 4163–4213) intercala jogador, mundo e sala, e o `fastForward` repete o passo. Mudar essa ordem muda o hash de
eventos. O host publica pontos de registro com ordem fixa e um teste de ordem na T1.3:

| Ponto | Hoje roda ali |
|---|---|
| `beforeWorld` | andar, golpe, uso de item, explosivos, recipientes (ação do jogador) |
| mundo (do host) | `world.update`, fogo, fluidos, física, renderizador da destruição, regras de mundo |
| `afterWorld` | o que a sala faz depois do mundo e antes dos módulos |
| `afterRenderer` | os módulos e `simulateAfterModules` |
| `present` | luzes, filme, água |

A repetição do passo (`fastForward`, 10×) é opção do host (`repeat`), com a mesma regra de hoje: o fogo só na primeira repetição.

**[A9] Coordenação com a spec 010.** A T1.1 da 010 muda a assinatura de `createFrameBudget`, a T2.1 classifica cada chamada do passo em fixo ou
quadro e a T2.3 troca `step` por `stepFixed`. Por isso **a T1.3 desta spec só começa depois da T1.1 e da T2.1 da 010**. Até lá esta seção é a
ordem de hoje; a T1.3 a reescreve com a classificação da 010. A vantagem continua: depois da T1.5, a 010 mexe em `world/frame.ts` (200 linhas), não
no `room.ts`.

## 5. Oclusão de áudio (T1.2, feita)

`createRaycastOcclusion` no `game-audio`, com o filtro do raio como tipo estrutural; o `game-audio` depende só do `game-contracts`. A função nunca
foi exportada pela sala: não há reexportação deprecada.

## 6. Registro de objetos e ação do jogador **[A2, A8]**

As regras de mundo (seção 2) e a ação do jogador leem hoje `entries`, `loose`, `spawn`, `removeEntry` e `bag`, que são da sala. Extrair qualquer
uma sem um registro comum é reescrever. Por isso:

- **`world.objects`**: o registro de objetos do mundo, com entrar, sair, segurar, soltar e achar por id ou por ponto; o mundo e a ação leem só ele.
  A sala passa a registrar os objetos dela ali (o catálogo e o `spawn` continuam da sala).
- **Porto de relato** (`onEvent`): o que hoje é `action(...)` e `log` (27 chamadas só em 2520–3660) sai como evento tipado; quem escreve texto e
  UI é a sala ou o jogo.
- **Tamanho real:** 2406–3660 têm ~1.250 linhas e 804–925 mais ~120, além dos arquivos irmãos (`explosives.ts` 633, `player.ts` 724,
  `door-open.ts` 651, `furniture-push.ts` 290, `furniture-carry.ts` 168, `shovel.ts` 108, `dual-reload.ts` 93, sons 183): **3.000 a 4.000
  linhas**. Os piores pontos são `pickUpTool`/`respawnSaved`/`putDownTool` (3220–3310), `grab`/`throwHeld` (3313–3395) e as opções do
  `createExplosives` (2932–2964).
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
