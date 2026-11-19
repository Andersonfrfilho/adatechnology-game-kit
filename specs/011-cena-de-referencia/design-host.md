# T1.1 — Desenho do host do mundo (`createKitWorld`)

Status: proposta, a validar com o agente `architect` antes da T1.3. Lido em `origin/main` de 2026-11-18 (`room.ts` com 5.620 linhas).

## 1. O que a leitura achou

A sala faz três coisas misturadas no mesmo arquivo:

| Camada | O que é | Linhas aproximadas | Um jogo precisa? |
|---|---|---|---|
| **Mundo** | renderer, cena, câmera; mundo de destruição; terreno e chão; fluidos e filme; áudio e oclusão; luzes, aquecimento e pools; efeitos e água; física (Jolt); renderizador da destruição; agendador, filas, compassador e laço | ~600 | Sim, igual em todo jogo |
| **Ação do jogador** | tiro (`fireShots` 2527), golpe (`stepStrikes` 2791), explosivos (`createExplosives` 2932), item na mão (`followHeld` 3417), uso de item (`updateItemUse` 3585), recipientes (`syncContainers` 4108), andar e empurrar (`stepWalk` 4154, `footing` 858, `blockers` 804) | ~1.500 | Sim, com escolhas de jogo (teclas, inventário) |
| **Sala** | catálogo e `spawn`, tampos e apoios do cenário (`restingTops`, `holderBoxes`), painel, log, bancada, métricas, cenários, carga de módulos, áreas, avatar | ~3.500 | Não |

Duas ligações ficam **fora do `room.ts`** e também são de mundo:

- **O motor Jolt é criado pela página** (`examples/test-room/build.mjs` 104–122: `createJoltEngine`, `KIT_WORLD`, `createPhysicsLoop`, recuo para a build single). Nenhum jogo acha isso no SDK.
- **O coordenador de workers e a porta do chão** são montados no `main.js` da sala (`createKitWorkers`, `createCoordinatorGroundPort`).

Conclusão: o `createKitWorld` cobre a camada **Mundo** mais as duas ligações da página. A **Ação do jogador** é uma segunda peça
(seção 6), sem a qual a cena não atira. A **Sala** continua na sala.

## 2. Onde mora

- **`game-kit-defaults`, entrada própria `./world`** (`@adatechnology/game-kit-defaults/world`). Ele já é L5 (composição) e pode importar
  núcleos e adaptadores. A entrada separada evita que quem só quer os dados do preset (`defaultVehicleFleet`) puxe three, Jolt e os adaptadores.
- **Um arquivo por ligação** em `packages/game-kit-defaults/src/world/`, cada um com até 200 linhas:

| Arquivo | Monta | Vem de (hoje) |
|---|---|---|
| `view.ts` | `WebGLRenderer` (se o jogo não deu), cena, câmera, `resize`, sombra, tone mapping | `room.ts` 263–296 |
| `ground.ts` | terreno, desenho do terreno, `groundAt` composto, impl do chão registrada no mundo, `onDeform` → acordar região | 371–381, 610–615 |
| `destruction.ts` | `createDestruction` e o renderizador da destruição com física, efeitos, chão e workers | 320–321, 489–527 |
| `liquids.ts` | fluidos, desenho dos fluidos, filme e ponte do filme, efeitos de água | 383–386, 486–488, 625–637 |
| `sound.ts` | motor de áudio com oclusão, som da destruição, amostras do kit e do jogo | 427–461 |
| `effects.ts` | `createVfxRenderer` com `groundAt`, `marklessAt`, `cratersAt` | 469–484 |
| `render-budget.ts` | `LightBudget`, `ProgramWarmup`, pools, sondas de aquecimento de cada adaptador, efeitos aquecidos | 463–467, 4780–4824 |
| `physics.ts` | motor Jolt (build, threads, recuo), `KIT_WORLD`, `createPhysicsLoop`; ou `'own'` | `build.mjs` 104–122 |
| `workers.ts` | `createKitWorkers` e porta do chão | `main.js` 32–55, 119–124 |
| `frame.ts` | agendador, registro das filas, fases do mundo, compassador, `startLoop`, checagem das luzes | 4068–4072, 5545–5600 |
| `create-kit-world.ts` | junta tudo e devolve o `KitWorld` | — |

## 3. API proposta

```ts
const world = await createKitWorld(THREE, {
  container,                        // onde o canvas entra
  renderer?, scene?, camera?,       // o jogo pode dar os seus
  bounds,                           // [minX, minZ, maxX, maxZ] do terreno
  ground?: TerrainLayout,           // camadas e zonas
  physics?: 'jolt' | 'own' | PhysicsLoop,   // padrão 'jolt' (direção da spec 008)
  workers?: WorkerCoordinator | 0,  // padrão: createKitWorkers automático
  audio?: false | KitWorldAudioOptions,
  quality?: Quality,
  graphics?: false | GraphicsOptions,
  debris?: KitWorldDebrisOptions,   // os mesmos campos de `TestRoomOptions.debris`
  frame?: { targetMs?: number },    // entra no orçamento único da spec 010
})

world.view        // { renderer, scene, camera, resize }
world.destruction // { world, renderer }
world.ground      // { terrain, at(x, z), addProvider(provider) }
world.liquids     // { fluids, view, film, water }
world.sound       // { audio, play(key, point, volume, detail?) } | null
world.effects     // vfx
world.lights      // LightBudget
world.physics     // PhysicsLoop | 'own'
world.workers     // WorkerCoordinator | null
world.frame       // scheduler: o jogo põe os seus sistemas nas fases
world.warmUp(): void
world.start(): () => void           // laço; devolve stop
world.dispose(): void               // tudo, conferido pelo leak.mjs
```

- **Assíncrono** porque o Jolt carrega wasm. Com `physics: 'own'` resolve na hora.
- **O chão composto** (`world.ground.addProvider`) é como a sala põe os seus tampos de mesa: `groundAt` = maior altura entre o terreno e
  cada provedor. A sala registra os `restingTops` como provedor; a cena registra lajes e pisos das casas.
- **Nenhuma opção nova inventada**: cada campo existe hoje em `TestRoomOptions` ou na página. O host só muda onde a montagem mora.

## 4. Fases do quadro que o host registra

| Fase | Sistema | Hoje |
|---|---|---|
| `fixedSimulate` (depois da spec 010 F2) / `lateSimulate` (até lá) | mundo de destruição, fluidos, física, renderizador da destruição, terreno | `simulateBeforeModules` 4151 |
| `present` | luzes (`lights.present`), filme, água | 5557 |
| `render` | checagem das luzes e reaquecimento, desenho, compassador | 5562–5590 |
| filas do orçamento | eventos da destruição, vozes do áudio e as filas novas da spec 010 | 4068–4072 |

**Coordenação com a spec 010:** as T1.6 e T2.4 da 010 mudam exatamente esses registros no `room.ts`. Se a T1.5 desta spec (a sala usa o
host) entrar antes delas, a 010 passa a mudar `world/frame.ts` em vez do `room.ts`, um arquivo de 200 linhas no lugar de um de 5.620. Por
isso o `frame.ts` nasce com um ponto único de registro (`registerWorldQueues(budget, adapters)`), e a forma do orçamento fica a da T1.1 da 010
quando ela existir.

## 5. Oclusão de áudio (T1.2)

`createWorldOcclusion` vai para o **`game-audio`** como `createRaycastOcclusion`. O tipo do mundo já é estrutural (`raycast` + `part`); a
única importação de fora é `RaycastOptions` do `game-destruction`, que vira um tipo estrutural local
(`{ skipLoose?: boolean; minObjectRadius?: number }`). Assim o `game-audio` continua dependendo só do `game-contracts`. A sala reexporta com o
nome antigo, marcado `@deprecated`, até a próxima major (A13 da spec 005). Os testes vão junto.

## 6. Ação do jogador: a segunda peça

O que a cena precisa para atirar, golpear, arremessar e explodir pela API pública hoje está nas ~1.500 linhas da tabela da seção 1. Isso não
cabe no host do mundo (é jogabilidade, com escolhas de jogo) e não cabe numa task. Proposta:

- **`createPlayerActions(world, { player, arsenal, hands })`** num pacote existente: `game-player` (núcleo, sem three) para a regra e
  `game-weapons-three` para o que desenha, conforme a regra de camadas. O dono exato sai do `kit_owner` na T1.6.
- Ela recebe o `KitWorld` e liga tiro, golpe, explosivos, item na mão e uso de item; teclas e inventário ficam com o jogo.
- Vira **fase 1b** da spec 011 (T1.6 a T1.9), entre o host e o esqueleto da cena. Sem ela, a cena da Fase 2 só anda e olha.

## 7. O que fica de fora do host

UI, log, painel, bancada, métricas da sala, cenários, carga de módulos e áreas, catálogo e `spawn`, avatar e a câmera da sala (`applyCamera`,
`debugView`, `moduleViews`). A câmera de jogo vem do `game-camera`, que a cena liga.

## 8. Riscos

- **O host engorda.** Gate: nenhum arquivo de `world/` passa de 200 linhas; ligação nova é arquivo novo.
- **A sala depende de detalhes que o host esconde** (ex.: `renderer.piece` dentro de `partStands`). Na T1.5 isso aparece como acesso a
  `world.destruction.renderer`: aceitável, porque é API pública do adaptador.
- **Duas físicas.** O host tem padrão `'jolt'` e a sala segue com `'own'` até a T3.9 da spec 008. A sala passa o seu padrão explicitamente; o
  host não muda o comportamento dela.
- **Goldens da sala.** A T1.5 só move montagem; a sala tem de dar os mesmos goldens e o mesmo hash de eventos.
