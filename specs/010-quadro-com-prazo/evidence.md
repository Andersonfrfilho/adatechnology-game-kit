# Evidence — Spec 010

## T0.1 — room-explosion gate measures the page default (jolt-d4-worker)

- `tools/gpu/room-explosion.mjs`: new `DEFAULT_VARIANT = 'jolt-d4-worker'` is the default of `ROOM_EXPLOSION_VARIANTS`, the default of `ROOM_EXPLOSION_STAGE_VARIANT` and the only gated variant (blocks on regression; `jolt-d4` is now a reference row, still selectable by name). Pacing already follows `groundWorker=1`.
- A base report without `jolt-d4-worker` cells does not crash: a missing base cell is "not a regression" (`cellRegressed(cell, undefined)`).
- Comments updated in `room-explosion.mjs` and `tools/gpu/perf-gate.mjs`; test added in `tools/gpu/tests/room-explosion-verdict.test.mjs`.
- `node --check tools/gpu/room-explosion.mjs && node --check tools/gpu/perf-gate.mjs`: pass.
- `node --test tools/gpu/tests/*.test.mjs`: 40 pass, 0 fail.
- `node tools/kit-audit/audit.mjs --check`: 0 new, 11 known pending, 15 allowed.
- `pnpm check:layers`: not run to completion, `depcruise` not installed in this worktree (no node_modules); the change touches no `packages/*/src`.
- No GPU measurement run.

## T0.2 — régua na variante padrão (jolt-d4-worker)

### Condições

- Commit medido: `feb400220` (HEAD de `spec/010-quadro-com-prazo`). Os pacotes são os da `origin/main` `5666a43d6`: `git diff 5666a43d6 HEAD -- packages` é vazio (a branch só mexe em docs e `tools/gpu`). A `origin/main` andou depois disso; esta régua é a de `5666a43d6`.
- Build limpo antes (`pnpm build`, página `examples/test-room/dist/test-room.html` refeita); `git status` limpo durante a medição, nenhuma instrumentação.
- Na tomada (carregador ligado; antes, na bateria, o portão se recusou a medir), GPU de verdade (Intel Core Ultra 9 275HX, Chrome 157), sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, começou às 23:46 com carga de 1 minuto em 0,96.
- Comando: `ROOM_EXPLOSION_KINDS=blast,hammer,crater ROOM_EXPLOSION_THROTTLES=1,4 ROOM_EXPLOSION_FRAME_PARTS=1 ROOM_EXPLOSION_ROUNDS=5 ROOM_EXPLOSION_OUT=specs/010-quadro-com-prazo/medicoes/regua-feb400220.json flock ... node tools/gpu/perf-gate.mjs room-explosion`. Variante `jolt-d4-worker` (padrão da página, ritmada), 660 quadros de 1/60 s por rodada. JSON: `medicoes/regua-feb400220.json`. Saída bruta do portão: ver o JSON; o portão saiu com 0 e "no regression" (sem base).
- Carga de 1 minuto lida ao fim de cada rodada: de 1,55 a 3,4 em quase tudo. Acima de 4: 1x blast rodada 2 (4,0, o limite) e, a 4x, hammer rodada 1 (10,11) e crater rodada 1 (5,69). Esses dois últimos podem pesar no `max` a 4x (hammer 17 contra 10 a 12,5 nas outras rodadas). `p99` é a mediana das rodadas e não se mexe com isso.
- As rodadas de tempo são 5. A passagem dos estágios (que gera os "piores quadros" abaixo) é uma passagem à parte do portão, com 3 rodadas; os 10 piores quadros por célula, juntados nas 3 rodadas, estão no JSON (`worstFrames`). Os três de cada célula abaixo são os três maiores deles.
- Quadro 0 (o que aplica a explosão, `f0`) fica fora de `p99` e `max` da Tabela A (spec 008 §11), mas entra nos "piores quadros". Em `blast` e `crater` os três piores quadros a 1x e a 4x são todos o `f0`; em `hammer` a 1x são `f1`/`f2`.
- 1x e 4x de throttle são um proxy de CPU (CDP `setCPUThrottlingRate`), não hardware AMD.

### Tabela A: física (`physicsMs` por quadro: passo do laço Jolt, sistema de peças, fila de despertar)

`update p99` e `update max` são da atualização inteira da sala (física + resto), sem o desenho, sem o quadro 0. `physics p99` é a mediana das 5 rodadas; `physics max` e `wake`, a pior rodada.

| kind | throttle | physics p99 | physics max | wake (quadro 0) | quadros >5 ms (5 rodadas) | update p99 | update max |
|---|---|---|---|---|---|---|---|
| blast | 1x | 3 | 8.2 | 0.6 | 2 | 5.3 | 16.1 |
| hammer | 1x | 2.1 | 3.9 | 0.2 | 0 | 4.7 | 14.1 |
| crater | 1x | 4 | 6.8 | 0.6 | 12 | 6.1 | 19.1 |
| blast | 4x | 18.6 | 37.5 | 4.6 | 193 | 29.8 | 54.1 |
| hammer | 4x | 8.6 | 17 | 0.7 | 115 | 21.1 | 54.1 |
| crater | 4x | 17.5 | 29.5 | 2.4 | 210 | 33.6 | 50.4 |

#### Três piores quadros por célula, estágios da física (ms, exclusivos dos chamados; só os acima de 0,05)

| kind | throttle | rodada, quadro | update | physics | estágios |
|---|---|---|---|---|---|
| blast | 1x | r1 f0 | 28.9 | 0.8 | splitLoose 1.7, adoptSplit 1.7, rebuildHost 1.3, joltStep 0.1 |
| blast | 1x | r2 f0 | 28.3 | 0.8 | splitLoose 1.7, rebuildHost 1.5, adoptSplit 1.4, fitBoxes 0.1, joltStep 0.1 |
| blast | 1x | r3 f0 | 28.2 | 0.8 | splitLoose 2, adoptSplit 1.8, rebuildHost 1.2, fitBoxes 0.1 |
| hammer | 1x | r2 f2 | 14.2 | 3 | joltStep 0.5, readBack 0.5, waterAt 0.1 |
| hammer | 1x | r3 f2 | 12.8 | 3.5 | joltStep 0.7, readBack 0.5 |
| hammer | 1x | r1 f2 | 12.3 | 2.5 | joltStep 0.5, readBack 0.5 |
| crater | 1x | r3 f0 | 33.6 | 0.6 | splitLoose 2.1, adoptSplit 1.6, rebuildHost 1.3, fitBoxes 0.2 |
| crater | 1x | r2 f0 | 26.8 | 1 | groundRelease 0.1 |
| crater | 1x | r1 f0 | 26.4 | 0.8 | waterAt 0.1 |
| blast | 4x | r3 f0 | 107.9 | 2.6 | splitLoose 7.2, adoptSplit 6, rebuildHost 5.7, fitBoxes 0.4, joltStep 0.1 |
| blast | 4x | r1 f0 | 106.6 | 2.4 | adoptSplit 7.7, splitLoose 6.6, rebuildHost 4.7, fitBoxes 0.1 |
| blast | 4x | r2 f0 | 105 | 3.2 | splitLoose 10.9, adoptSplit 7.4, rebuildHost 4.9, fitBoxes 0.2 |
| hammer | 4x | r3 f3 | 39.3 | 6.1 | rebuildHost 5, joltStep 1.8, groundApply 0.1 |
| hammer | 4x | r1 f1 | 37.4 | 0.8 | adoptSplit 7.9, splitLoose 7.8, rebuildHost 5.7, fitBoxes 0.1 |
| hammer | 4x | r3 f1 | 35.2 | 0.8 | splitLoose 8, adoptSplit 7.3, rebuildHost 4.8, fitBoxes 0.6, readBack 0.5, joltStep 0.1 |
| crater | 4x | r1 f0 | 101.6 | 2.7 | joltStep 0.1 |
| crater | 4x | r2 f0 | 86.9 | 3.1 | readBack 0.1 |
| crater | 4x | r3 f0 | 84.5 | 3 | readBack 0.1 |


### Tabela B: resto do quadro (`FRAME_LABELS`), mesmos três piores quadros


| kind | throttle | rodada, quadro | update | physics | rótulos (ms) | rest | módulos | renderCpu | gpuWait | gpu | calls | tris |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| blast | 1x | r1 f0 | 28.9 | 0.8 | destrEvents 5.1, stagesOut 4.7, world 1.1, matrices 1, audio 0.7, terrainMesh 0.3, vfxSim 0.1, vfxLayers 0.1 | 14.2 | #12:floorplan_area 0.4, #13:floorplan_area 0.1, #14:vehicles_area 0.1, #19:crowd_area 0.1, #20:crowd_area 0.1 | 8 | 0 | 0.3 | 925 | 382645 |
| blast | 1x | r2 f0 | 28.3 | 0.8 | stagesOut 4.7, destrEvents 3, world 1.1, matrices 1, audio 0.8, terrainMesh 0.4, settled 0.1, vfxSim 0.1, lights 0.1 | 15.1 | #12:floorplan_area 0.3, #13:floorplan_area 0.3, #14:vehicles_area 0.2, #11:weather_area 0.1, #19:crowd_area 0.1, #20:crowd_area 0.1 | 8.1 | 0 | 1.3 | 925 | 382645 |
| blast | 1x | r3 f0 | 28.2 | 0.8 | stagesOut 5.1, destrEvents 1.8, world 1.3, matrices 1.1, audio 0.8, terrainMesh 0.4, vfxSim 0.1, vfxLayers 0.1 | 15.8 | #12:floorplan_area 0.3, #13:floorplan_area 0.2, #19:crowd_area 0.2, #14:vehicles_area 0.1, #20:crowd_area 0.1 | 8 | 0 | 1.6 | 799 | 378985 |
| hammer | 1x | r2 f2 | 14.2 | 3 | fragments 5.4, audio 3.8, matrices 0.2, world 0.1, settled 0.1, syncXform 0.1, vfxSim 0.1, water 0.1, stagesOut 0.1 | 0.4 | #14:vehicles_area 0.2, #19:crowd_area 0.2, #1:weapons_area 0.1, #11:weather_area 0.1, #12:floorplan_area 0.1, #20:crowd_area 0.1 | 4.5 | 0 | 1.1 | 405 | 345998 |
| hammer | 1x | r3 f2 | 12.8 | 3.5 | fragments 4, audio 3, matrices 0.5, syncXform 0.1, partFx 0.1, vfxSim 0.1, vfxLayers 0.1 | 0.8 | #12:floorplan_area 0.2, #19:crowd_area 0.2, #14:vehicles_area 0.1, #16:vegetation 0.1 | 4.2 | 0 | 1.1 | 397 | 345508 |
| hammer | 1x | r1 f2 | 12.3 | 2.5 | fragments 3.9, audio 3.7, matrices 0.5, world 0.2, syncXform 0.1, vfxSim 0.1, vfxLayers 0.1 | 0.6 | #12:floorplan_area 0.2, #14:vehicles_area 0.2, #11:weather_area 0.1, #19:crowd_area 0.1 | 4.4 | 0 | 1.5 | 402 | 344140 |
| crater | 1x | r3 f0 | 33.6 | 0.6 | destrEvents 6.7, stagesOut 5.2, world 1.2, matrices 1, audio 0.9, terrainMesh 0.4, vfxLayers 0.1, lights 0.1 | 16.4 | #12:floorplan_area 0.3, #13:floorplan_area 0.2, #19:crowd_area 0.2, #11:weather_area 0.1, #14:vehicles_area 0.1, #20:crowd_area 0.1 | 8.1 | 0 | 2.6 | 832 | 382893 |
| crater | 1x | r2 f0 | 26.8 | 1 | destrEvents 7.3, world 1.5, matrices 1.2, terrainMesh 0.8, audio 0.7, vfxLayers 0.2, fluidView 0.1 | 13 | #12:floorplan_area 0.3, #13:floorplan_area 0.3, #14:vehicles_area 0.2, #11:weather_area 0.1, #20:crowd_area 0.1 | 7.4 | 0 | 1.4 | 812 | 380547 |
| crater | 1x | r1 f0 | 26.4 | 0.8 | destrEvents 7.6, world 1.1, matrices 1.1, audio 0.7, terrainMesh 0.6, explosives 0.1, destrOwn 0.1, vfxSim 0.1, vfxLayers 0.1, lights 0.1, stagesOut 0.1 | 12.8 | #12:floorplan_area 0.3, #13:floorplan_area 0.2, #14:vehicles_area 0.2, #20:crowd_area 0.2, #11:weather_area 0.1, #18:player_area 0.1 | 7.7 | 0 | 1.6 | 812 | 380547 |
| blast | 4x | r3 f0 | 107.9 | 2.6 | stagesOut 19.3, destrEvents 6.7, world 4.8, matrices 3.9, audio 2.7, terrainMesh 1.2, vfxLayers 1, settled 0.5, vfxSim 0.1 | 59.2 | #20:crowd_area 1.4, #12:floorplan_area 1.2, #14:vehicles_area 0.9, #19:crowd_area 0.9, #13:floorplan_area 0.8, #11:weather_area 0.6, #7:animals_area 0.1 | 33 | 0 | 6.2 | 810 | 379445 |
| blast | 4x | r1 f0 | 106.6 | 2.4 | stagesOut 19.1, destrEvents 5.6, matrices 5.5, world 4.6, audio 2.8, terrainMesh 1.4, settled 0.1, vfxSim 0.1 | 59.1 | #12:floorplan_area 2, #13:floorplan_area 1.3, #20:crowd_area 1.1, #18:player_area 0.7, #19:crowd_area 0.5, #6:characters_area 0.3 | 34.2 | 0 | 4.9 | 813 | 381301 |
| blast | 4x | r2 f0 | 105 | 3.2 | stagesOut 23.4, destrEvents 4.8, world 4.3, matrices 4.1, audio 2.3, terrainMesh 1.7, vfxLayers 0.7, lights 0.4, settled 0.2, vfxSim 0.2 | 54 | #19:crowd_area 1.6, #14:vehicles_area 1.4, #13:floorplan_area 1, #12:floorplan_area 0.8, #20:crowd_area 0.8, #11:weather_area 0.1 | 31.5 | 0 | 5.7 | 812 | 380949 |
| hammer | 4x | r3 f3 | 39.3 | 6.1 | fragments 12, destrEvents 5, stagesOut 5, audio 4.3, matrices 1, world 0.8, settled 0.1, partFx 0.1, vfxLayers 0.1 | 2.3 | #12:floorplan_area 1.3, #13:floorplan_area 0.6, #17:urban 0.3, #11:weather_area 0.1, #18:player_area 0.1, #19:crowd_area 0.1 | 19.1 | 0 | 2.7 | 410 | 344324 |
| hammer | 4x | r1 f1 | 37.4 | 0.8 | stagesOut 21.5, destrEvents 4.6, matrices 3.3, world 0.5, syncXform 0.1 | 2.6 | #12:floorplan_area 2, #19:crowd_area 1.4, #20:crowd_area 0.5, #3:weapons_area 0.1 | 18.4 | 0 | 0.5 | 369 | 342634 |
| hammer | 4x | r3 f1 | 35.2 | 0.8 | stagesOut 20.7, destrEvents 4.2, matrices 1.7, world 0.7, vfxLayers 0.5, lights 0.1 | 2.9 | #12:floorplan_area 1.1, #20:crowd_area 0.9, #19:crowd_area 0.8, #11:weather_area 0.4, #14:vehicles_area 0.4 | 18.4 | 0 | 2.6 | 369 | 342632 |
| crater | 4x | r1 f0 | 101.6 | 2.7 | destrEvents 21.6, world 4.7, audio 4.6, matrices 3.1, terrainMesh 1.2, vfxLayers 0.7, lights 0.7, settled 0.5 | 56.4 | #12:floorplan_area 1.5, #19:crowd_area 1.1, #20:crowd_area 1, #13:floorplan_area 0.9, #11:weather_area 0.7, #14:vehicles_area 0.1, #18:player_area 0.1 | 30.7 | 0 | 4.9 | 820 | 381035 |
| crater | 4x | r2 f0 | 86.9 | 3.1 | destrEvents 7.6, world 4.9, matrices 4.3, audio 3.9, terrainMesh 1, vfxSim 0.7, vfxLayers 0.5, syncXform 0.1, destrOwn 0.1 | 55.5 | #12:floorplan_area 1.5, #20:crowd_area 1.3, #13:floorplan_area 1, #14:vehicles_area 0.6, #0:weapons_area 0.4, #19:crowd_area 0.4 | 32.7 | 0 | 6.6 | 818 | 379531 |
| crater | 4x | r3 f0 | 84.5 | 3 | destrEvents 8.5, world 4.6, matrices 3.5, audio 2.6, terrainMesh 1.1, vfxLayers 0.5, vfxSim 0.2 | 55.7 | #12:floorplan_area 1.4, #13:floorplan_area 1.3, #14:vehicles_area 0.6, #20:crowd_area 0.6, #19:crowd_area 0.4, #11:weather_area 0.3, #1:weapons_area 0.2 | 30 | 0 | 5 | 808 | 380059 |

`rest` é o que nenhum rótulo cobre (os closures da própria sala): em `blast` e `crater` o quadro 0 gasta de 12,8 a 16,4 ms nele a 1x e de 54 a 59 ms a 4x. `stagesOut` são estágios da tabela da física (`splitLoose`, `adoptSplit`, `rebuildHost`) chamados fora da física. O desenho é medido depois da atualização, não entra em `update`.

### Contagens (T0.2, instrumentação temporária, não commitada)

Tiradas por outra sessão na mesma página (`?solver=jolt&blastDebris=1&groundWorker=1`), uma rodada de 660 quadros por tipo, com contadores em `globalThis` revertidos depois (`git diff` em `packages/` vazio). **Carga de 1 minuto de 5,3 a 10,5 nessas rodadas: valem as contagens; os milissegundos são só indicativos.** O script e a saída bruta (`count.mjs`, `probe-count.txt`) ficaram só na pasta de rascunho da sessão, não no repositório.

1. Chamadas de `solveStructure` por explosão: `blast` 35 (em 1 quadro), `hammer` 33 (em 2 quadros), `crater` 39 (em 2 quadros).
2. Passos fixos por quadro (660 quadros por tipo, relógio fixo de 1/60 s):

| contador | 0 passos | 1 passo | 2 ou mais |
|---|---|---|---|
| agendador (`substepsLastFrame`) | 0 | 660 | 0 |
| `PhysicsLoop` (`frame.steps` lido ao fim da atualização) | 0 | 0 | 660 |

   O "2 ou mais" em todo quadro do `PhysicsLoop` **é um passo real de 120 Hz, não erro da sonda.** `KIT_WORLD` tem `fixedStep: 1/120` (`packages/game-physics/src/contract.ts:266`), a página cria `createPhysicsLoop(world)` com esse mundo (`examples/test-room/build.mjs:119`) e a sala chama `physicsLoop.step(dt)` com o `dt` do quadro (`room.ts:4179`); `loop.ts:72` faz `floor((acc + ε) / h)` com `h = 1/120`, o que dá exatamente 2 para `dt = 1/60`. A sonda só tem o balde "2+" e não distingue 2 de 3, mas com `dt` constante é 2. Ou seja, há dois acumuladores com dois passos diferentes na mesma página (1/60 s no agendador, 1/120 s no laço da física).
3. Soma por quadro dos relógios próprios da tabela P1 do `spec.md` (ms, indicativo; `p99` e `max` da soma por quadro, os três piores quadros e os totais nos 660 quadros):

| tipo | p99 | max | três piores quadros (índice, soma, divisão) |
|---|---|---|---|
| blast | 2,1 | 6,4 | 57: 6,4 (`vehicleHit` 6,3, `fluidFilm` 0,1); 55: 5,3 (`vehicleHit` 5,3); 56: 4,4 (`vehicleHit` 4,4) |
| hammer | 0,7 | 3,8 | 110: 3,8 (`settledBatch`); 80: 2,9 (`settledBatch`); 144: 2,8 (`settledBatch`) |
| crater | 2,7 | 9,2 | 10: 9,2 (`audioOcclusion`); 45: 9,2 (`vehicleHit` 7,1, `settledBatch` 1,8, `staticBoxes` 0,3); 0: 7,0 (`audioOcclusion`) |

| total em 660 quadros (ms) | blast | hammer | crater |
|---|---|---|---|
| `staticBoxes` | 19,1 | 21 | 23,1 |
| `fluidFilm` | 5,7 | 6 | 7 |
| `audioOcclusion` | 6,9 | 1,2 | 22,3 |
| `settledBatch` | 13,3 | 12,9 | 14,7 |
| `vehicleHit` | 20 | 0 | 18,8 |
| `prefit`, `roomBatch`, `dentSmoothing`, `vehicleFull`, `houseShadow` | 0 | 0 | 0 |

   `vehicleHit` é o lote do `static-batcher` com `maxVertices` (o LOD do veículo), e aparece numa cena de explosão de casa.

### Verificação

- `node tools/kit-audit/audit.mjs --check` e `node --test tools/gpu/tests/*.test.mjs`: `audit`: 0 novos, 11 pendentes conhecidos, 15 permitidos; testes de `tools/gpu`: 40 passam, 0 falham.

## T0.3 — leitura da régua contra P1, P2 e P3

Fonte: `medicoes/regua-feb400220.json` (T0.2, `worstFrames`, 10 piores quadros por célula nas 3 rodadas da passagem dos estágios) e as contagens da T0.2. Código lido só para dar dono a um rótulo. Script da conta na pasta de rascunho da sessão (não commitado).

### Como cada rótulo vira causa

| Causa | Rótulos e estágios | Base |
|---|---|---|
| P1 (orçamentos se somam, relógios próprios) | `destrEvents`, `audio`, `settled`, `film` | **Atribuição:** `destrEvents` é o `run` da `DeferredQueue` do renderer e `audio` o da fila de vozes, as duas no `FrameBudget` de 8 ms cheios (`room.ts:4081-4082`); `settled` (2 ms) e `film` (1,2 ms) são relógios próprios da tabela P1. Os relógios próprios sem rótulo (lotes da sala, `vehicleHit`, `staticBoxes`, oclusão) caem em `rest`/`modules` e não dá para separá-los na régua. |
| P2 (dois relógios, sem interpolação) | metade do `joltStep` | **Inferência:** o `PhysicsLoop` dá 2 passos de 1/120 por quadro de 1/60 (T0.2); um passo só de 1/60 custaria ~metade. A régua usa `dt` fixo de 1/60, então a outra parte de P2 (recuperar passos depois de quadro lento, falta de interpolação) **não aparece em ms**: é correção (C4, C5), não tempo. A outra metade do `joltStep` é o próprio Jolt e fica em "fora". |
| P3 (custo por peça viva, estrutura por parte perdida) | `physics − joltStep − estágios de chão` (`prepare`/`measure`/`readBack`/`bridgeReads`), `stagesOut` (`splitLoose`, `adoptSplit`, `rebuildHost`, `fitBoxes` fora da física), `syncXform`, `matrices`, `fragments`, `partFx`, `destrOwn`, `world` | **Atribuição** para `readBack`, `bridgeReads`, `syncXform`, `fragments.update` (citados no P3 e na T3.3–T3.5). **Inferência** para `stagesOut`: o renderer chama `splitLoose(objeto)` a cada evento `detach`/`collapse` (`renderer.ts:1570`, `:2120`), o espelho no desenho da estrutura refeita por parte perdida; nenhuma task da fase 3 cobre esse lado. **Inferência** para `matrices` e `world` (laços por objeto vivo, T3.2/T3.5), teto do que P3 pode tirar. |
| Fora | `rest` (closures da sala sem rótulo), `modules`, `vfxSim`, `vfxLayers`, `terrainMesh`, `water`, `lights`, `fluids`, `fluidView`, `explosives`, estágios de chão, metade própria do `joltStep` | `rest` no quadro 0 é o que nenhum rótulo cobre. **Inferência** (não medida): o `flush()` do fim do quadro (`room.ts:770`, narrador e um tratador por evento da explosão) e o `updatePresent` (log no DOM, HUD), mais os lotes com relógio próprio e o GC. |

**Buraco da régua (atribuição, lido no código):** o portão chama `room.blastAt` e `room.world.hit` **antes** de abrir o relógio do quadro (`tools/gpu/room-explosion.mjs:352-360`), e `world.explode`/`world.hit` rodam síncronos (`game-destruction/src/world.ts:5665`, `:5721`, `explosives.ts:429`). As 33 a 39 chamadas de `solveStructure` por explosão **não entram em nenhum quadro medido**. No jogo elas caem no quadro do clique ou do pavio. A régua subestima P3 no lado do mundo, e a C7 não aparece nela sem mudar o portão.

### Quanto cada causa explica (média dos 3 piores quadros da célula, ms e % do update)

| tipo | trava | quadros | update | P1 | P2 | P3 | fora (dos quais `rest`) | P1+P2+P3 |
|---|---|---|---|---|---|---|---|---|
| blast | 1x | f0 ×3 | 28,5 | 4,1 (14%) | 0,0 (0%) | 7,8 (27%) | 16,5 (58%; `rest` 15,0 = 53%) | **42%** |
| blast | 1x | sem f0 (r1 f2, r2 f1, r1 f1) | 16,1 | 6,6 (41%) | 0,4 (2%) | 6,7 (42%) | 2,4 (15%) | 85% |
| hammer | 1x | f2 ×3 (o f0 não está entre os 10 piores) | 13,1 | 3,5 (27%) | 0,3 (2%) | 7,5 (57%) | 1,8 (14%) | 86% |
| crater | 1x | f0 ×3 | 28,9 | 8,0 (28%) | 0,0 (0%) | 4,9 (17%) | 16,1 (56%; `rest` 14,1 = 49%) | **44%** |
| crater | 1x | sem f0 (r3 f2, r2 f3, r1 f2) | 16,6 | 7,2 (44%) | 0,5 (3%) | 6,2 (37%) | 2,7 (16%) | 84% |
| blast | 4x | f0 ×3 | 106,5 | 8,6 (8%) | 0,0 (0%) | 32,4 (30%) | 65,5 (62%; `rest` 57,4 = 54%) | **38%** |
| blast | 4x | sem f0 (r1 f15, r3 f2, r1 f17) | 38,9 | 3,0 (8%) | 7,7 (20%) | 12,5 (32%) | 15,7 (40%) | 60% |
| hammer | 4x | r3 f3, r1 f1, r3 f1 | 37,3 | 6,1 (16%) | 0,3 (1%) | 24,4 (65%) | 6,6 (18%) | 82% |
| crater | 4x | f0 ×3 | 91,0 | 16,4 (18%) | 0,0 (0%) | 11,3 (12%) | 63,2 (69%; `rest` 55,9 = 61%) | **31%** |
| crater | 4x | sem f0 (r2 f16, r2 f1, r3 f3) | 43,9 | 6,4 (15%) | 5,1 (12%) | 21,1 (48%) | 11,4 (26%) | 74% |

Detalhes que pesam:

- **Maior rótulo de P3 no golpe:** `stagesOut` (`splitLoose` + `adoptSplit` + `rebuildHost`): 4,7 a 6,9 ms a 1x (f0 de `blast`/`crater`, f1 de `hammer`) e 19 a 23 ms a 4x. Depois vêm `fragments` (2,4 a 5,4 ms a 1x, 12 ms a 4x) e `matrices` (~1 ms a 1x, 3 a 5,5 ms a 4x).
- **P2 só pesa a 4x:** nos quadros de assentamento (f14 a f21) o `joltStep` vai a 17–28 ms (1,1 a 1,5 ms a 1x). Metade disso é o teto de P2. **O ganho existe só se o passo único for de 1/60.** Se o agendador adotar 1/120 (o `fixedStep` de hoje do `KIT_WORLD`), P2 não tira nenhum ms.
- **p99 do update** (a régua não divide o p99 por rótulo; os p99 da física e do update não são do mesmo quadro, então é teto): a física é 3,0 de 5,3 ms (57%) em `blast`, 2,1 de 4,7 (45%) em `hammer` e 4,0 de 6,1 (66%) em `crater` a 1x. Com o passo do Jolt em 0,25–0,55 ms (medição de 2026-11-17), quase toda essa física é P3 e P2 fica em ≤0,3 ms (inferência). A 4x a física é 18,6/29,8 (62%), 8,6/21,1 (41%) e 17,5/33,6 (52%), com P2 até ~40% dela nos quadros de assentamento (inferência). O resto do p99 (1,3 a 2,6 ms a 1x) não tem dono na régua.

### Surpresas das contagens

- **`vehicleHit` 6,3 ms num quadro de explosão de casa** (f55–f57 de `blast`, carga de 5 a 10, ms indicativo). É o lote do LOD do veículo (`static-batcher` com `maxVertices`, relógio próprio de 2 ms) juntando de novo o carro parado que a explosão acertou. Passou 3× do próprio orçamento: uma junção é uma unidade só, maior que o relógio. Migrar para fila (T1.5) não divide a unidade. Pela §15 ("trabalho pesado e pontual"), precisa ser fatiada ou ir para worker. Na régua (carga baixa) esses quadros não estão entre os 10 piores de nenhuma célula a 1x (o 10º de `blast` é 9,9 ms), então não mexem no pior quadro a 1x.
- **`audioOcclusion` 9,2 ms em `crater`** (f0 e f10 da contagem). A primeira consulta de cada `add`/`update` do rastreador sempre roda (`occlusion-tracker.ts:90` com `costMs` indefinido, `:109` com `queries === 0`). Ela é um raio pelo mundo da destruição depois da cratera, e o `budgetMs` de 1 ms não limita uma unidade. Na régua, o rótulo `audio` (a fila de vozes; que o início da voz chama `tracker.add` é inferência, via `engine-occlusion.ts:84`) dá **5,5 a 7,9 ms nos piores quadros sem f0 de `blast` e `crater` a 1x**: é o maior rótulo isolado do quadro que a C8 mede. Contei em P1, mas o orçamento único sozinho não o reduz, porque a guarda de fome ainda roda uma unidade. Contado como "fora", só o r2 f3 de `crater` (`audio` 7,9 de 16,6 ms, 48%) passa de um terço.

### C8 contra a régua

- **A 1x a C8 como está escrita já está quase cumprida.** p99 do update: 5,3, 4,7 e 6,1 ms (meta 8): **cumprida nos três**. Pior quadro do update sem f0: `blast` 16,1 (cumprida, folga de 0,5), `hammer` 14,1 (cumprida), `crater` 19,1 (não cumprida: uma rodada de cinco; a mediana dos máximos por rodada é 16,5). Do jeito que está, a meta a 1x vale quase nada para a spec.
- O que o jogador sente a 1x e a C8 não mede:
  - o quadro 0 (update de 28 a 34 ms, mais 7,4 a 8,1 ms de `renderCpu`);
  - o quadro inteiro sem f0 (update mais `renderCpu`): `blast` 16,3 + 5,7 = 22,0, `hammer` 14,2 + 4,5 = 18,7, `crater` 17,2 + 6,2 = 23,4 ms.
- **Proposta de C8** (decisão do dono):
  1. a 1x, pior quadro inteiro (update mais `renderCpu`) sem f0 ≤ 16,6 ms, mantendo o p99 do update ≤ 8 ms como não regressão;
  2. a 4x, p99 do update ≤ 16,6 ms (hoje 21,1 a 33,6) e pior quadro não pior que a T0.2 (54,1 / 54,1 / 50,4);
  3. se o dono quiser o f0 na meta, update do f0 ≤ 16,6 ms a 1x (hoje 28 a 34), o que exige antes dar dono ao `rest` do f0.

### Ordem das fases

Proposta: **1 orçamento único (P1), 2 estrutura adiada e custo por peça acordada (P3), 3 passo fixo e interpolação (P2).** Hoje a ordem é 1 P1, 2 P2, 3 P3.

- **P1 fica em primeiro.** `destrEvents` mais `audio` são 27 a 44% do pior quadro sem f0 a 1x, e o prazo é a base onde a D9 apoia o adiamento. Ressalva: o ganho do `audio` exige mudar a regra da primeira consulta da oclusão, que não está em nenhuma task.
- **P3 sobe para segundo.** É a maior causa em todas as células sem f0 (37 a 57% a 1x, 32 a 65% a 4x). Proposta de escopo: a T3.1 (ou uma T3.x nova) também passa a juntar `splitLoose`/`adoptSplit`/`rebuildHost` uma vez por objeto por drenagem, em vez de uma vez por evento `detach`, que é o maior rótulo de P3 (`stagesOut`).
- **P2 desce para terceiro.** Explica 2 a 3% a 1x, e os 12 a 20% a 4x dependem de escolher `h` = 1/60, decisão de qualidade da física que a D5 não toma. O valor de P2 é correção (C4, C5, 144 Hz), não ms.
- **Tarefa de régua antes da fase 1 (proposta T0.4).**
  - Rotular o `rest` do quadro 0: `flush()`, `updatePresent`, os lotes com relógio próprio sem rótulo.
  - Abrir o relógio do f0 antes do `blastAt`/`world.hit`, para o `solveStructure` aparecer.
  - Manter a coluna antiga para comparar com a T0.2.

### Veredito

**Parar e perguntar ao dono.** No pior quadro de verdade (f0 de `blast` e `crater`) as duas condições de parada valem:

- **(a)** algo fora de P1/P2/P3 explica mais de um terço do pior quadro: o `rest` sem rótulo dá 53% em `blast` e 49% em `crater` a 1x.
- **(b)** P1+P2+P3 juntos explicam menos da metade: 42% em `blast` e 44% em `crater` a 1x; 38% e 31% a 4x.

No quadro que a C8 mede (sem f0), nenhuma das duas vale: P1+P2+P3 dão 84 a 86% a 1x. Mesmo assim a C8 já está quase cumprida a 1x, e o `audio` sozinho passa de um terço num quadro de `crater`.

Decisões pedidas ao dono:

1. O f0 entra na meta, ou a spec segue só com os quadros sem f0?
2. Qual C8 vale: a proposta acima ou outra?
3. A ordem P1 → P3 → P2 e a T0.4 de régua.
4. O `h` do passo único: 1/60 ou 1/120.

## Decisões do dono (2026-11-19)

Respostas às quatro perguntas da T0.3:

1. **Quadro 0 conta na meta.** Nova task de régua T0.4 antes da fase 1: relógio do f0 aberto antes do `blastAt`/`world.hit` e `rest` com dono.
2. **C8 nova** (a proposta da T0.3): a 1x, pior quadro inteiro (update mais `renderCpu`) sem f0 ≤ 16,6 ms e update do f0 ≤ 16,6 ms; a 4x, p99 do update ≤ 16,6 ms e pior quadro não pior que a T0.2 (54,1 / 54,1 / 50,4); p99 do update ≤ 8 ms a 1x fica como não regressão.
3. **Ordem P1 → P3 → P2.** Fase 2 vira estrutura adiada e custo por peça acordada, com a T2.1 estendida a `splitLoose`/`adoptSplit`/`rebuildHost` uma vez por objeto por drenagem (mantida a parada se o hash de eventos mudar); fase 3 vira passo fixo e desenho interpolado.
4. **Passo único `h = 1/120`:** o agendador adota o `fixedStep` do `KIT_WORLD`; física e goldens não mudam; o valor de P2 é correção (C4, C5, 144 Hz), não ms. D5 e D6 do `plan.md` atualizadas.

## T0.4 — a régua cobre o quadro 0 inteiro

### O que mudou

- `tools/gpu/room-explosion.mjs`: o relógio do f0 abre **antes** de `room.blastAt` (ou do `room.world.hit` do martelo), então `world.explode`/`hit` e seus `solveStructure` entram no `update` do quadro. `ROOM_EXPLOSION_F0_CLOCK=late` volta ao relógio da T0.2. O quadro de cada chamada leva `actionMs` (tempo de parede da chamada): a coluna da T0.2 é `updateMs − actionMs`. Física, percentis e a Tabela A não mudam (o quadro 0 fica fora deles).
- Rótulos novos em `FRAME_LABELS`: `action` (a chamada sem `explode`), `explode` (`world.explode`/`world.hit`, com os `solveStructure` dentro), `vfxPresent`, `queues` (filas do orçamento do quadro sem rótulo próprio: o delta de `spentMs` de cada uma em `frameStats().budget.queues`; por fila no campo `queues` do quadro) e um por sistema do agendador, tempo próprio sem os rótulos chamados por baixo: `sysInput`, `sysSimulate`, `sysSimulateEnd` (tracers e o `flush()` do fim do quadro), `sysPresent` (`updatePresent`: log no DOM e HUD), `sysLights`, `sysOther`.
- Gancho em `packages/`: `scheduler.systemProbe` (`game-runtime`, `enter(id)`/`leave(id)` em volta de cada sistema; sem sonda custa uma leitura de propriedade por sistema, teste em `scheduler.test.ts`, changeset `regua-cobre-o-quadro-zero.md`) e `frameParts.scheduler` na sala, **na mesma linha** que já existia: `room.ts` continua com 5.620 linhas (`origin/main` 5.621). Nenhum padrão síncrono mudou.
- Testes: `node --test tools/gpu/tests/*.test.mjs` 42 passam (2 novos); `node --check` nos dois scripts; `pnpm --filter @adatechnology/game-runtime test` 41 passam; typecheck de `game-runtime` e `game-test-room`; `pnpm check:layers` sem violação nova; `node tools/kit-audit/audit.mjs --check` 0 novos; `pnpm build` ok; nenhum golden tocado.

### Condições

- Commit medido `f7de1ecfa` (código desta task; a página foi refeita pelo próprio portão no início da corrida, às 08:28, antes de qualquer edição de outra sessão em `game-runtime`). Pacotes iguais aos da T0.2 fora o gancho. Na tomada, carga de 1 minuto 1,69 no início, sob `flock`, mesma configuração da T0.2 (`blast,hammer,crater`, 1x e 4x, `FRAME_PARTS=1`, 5 rodadas, `jolt-d4-worker`). JSON: `medicoes/regua-t04-f7de1ecfa.json`. Portão: sem regressão, 0 erros de página.

### Quadro 0 por rótulo (ms; média dos 3 piores quadros 0 de cada célula; `rest` = update − física − rótulos)

| tipo | trava | update f0 inteiro | chamada (`actionMs`) | update sem a chamada | T0.2 update f0 | `rest` T0.2 → agora |
|---|---|---|---|---|---|---|
| blast | 1x | 72,1 | 42,4 | 29,7 | 28,5 | 15,0 → −0,1 |
| crater | 1x | 71,2 | 44,5 | 26,7 | 28,9 | 14,1 → 0,0 |
| blast | 4x | 287,2 | 178,3 | 108,9 | 106,5 | 57,4 → −0,4 |
| crater | 4x | 260,7 | 164,8 | 95,9 | 91,0 | 55,9 → 0,1 |

Coluna "update sem a chamada" bate com a T0.2 (26,7 a 29,7 contra 28,5 e 28,9 a 1x): as duas réguas são comparáveis.

| rótulo | blast 1x | crater 1x | blast 4x | crater 4x |
|---|---|---|---|---|
| `explode` (`world.explode`, `solveStructure` dentro) | **35,8** | **37,6** | **148,1** | **139,6** |
| `queues` (filas sem rótulo; só `floorplan.breach-cut`) | 11,6 | 9,8 | 45,4 | 37,7 |
| `action` (resto da chamada, `explosives.blastAt`) | 5,9 | 6,4 | 27,0 | 22,4 |
| `stagesOut` | 4,9 | 0 | 15,5 | 0 |
| `destrEvents` | 3,5 | 7,4 | 6,2 | 20,8 |
| `matrices` | 1,7 | 1,5 | 8,6 | 6,4 |
| `sysSimulate` / `sysSimulateEnd` / `sysInput` / `sysPresent` | 1,4 / 1,0 / 1,3 / 0,5 | 1,4 / 1,0 / 0,8 / 0,5 | 6,8 / 4,5 / 3,5 / 1,9 | 5,8 / 4,5 / 3,9 / 1,9 |
| `world`, `modules`, `audio`, `terrainMesh` | 1,2, 1,2, 0,9, 0,5 | 1,1, 1,3, 1,0, 0,4 | 5,2, 5,3, 2,8, 1,2 | 4,7, 5,0, 2,4, 1,4 |

Filas no f0 (ms): `floorplan.breach-cut` 11,6 / 9,8 / 45,4 / 37,7, `destruction.events` 8,4 / 7,4 / 21,7 / 20,9, `audio.voices` 0,9 / 1,0 / 2,8 / 2,4 (as duas últimas já estão em `destrEvents` e `audio`).

Martelo (f0 = primeira pancada, fora dos 10 piores; o pior é o f1, a segunda pancada): 1x `explode` 26 a 29 ms de 38 a 41 ms de update, `stagesOut` 5,5 a 6,1; 4x `explode` 89 a 97 de 123 a 138, `stagesOut` 20 a 24.

### O que sobra em `rest`

Nada: `rest` do f0 cai de 14 a 15 ms (1x) e 56 a 57 ms (4x) para entre −0,4 e 0,1 ms. O `rest` da T0.2 era, a 1x: `breach-cut` 10 a 12 ms (fila do `floorplan`, drenada pelo orçamento do quadro fora de qualquer sistema), o resto da chamada `action` (6 ms) e a própria sobra dos sistemas (`sysSimulate`, `sysSimulateEnd`, `sysInput`, `sysPresent`: 3 a 4,5 ms no total). O `flush()` e o `updatePresent` que a T0.3 apontou são só ~1 ms e ~0,5 ms a 1x. Os relógios próprios dos lotes (sala, `vehicleHit`, caixas estáticas, oclusão) **não têm rótulo próprio**: ficam dentro de `sysSimulate`/`sysSimulateEnd`/`modules`, que juntos dão 3 a 4 ms a 1x, e nada na régua os separa sem gancho por objeto (a sala os guarda em closures). Não afetam a conclusão: nenhum passa de 1,5 ms no f0.

### Surpresas

- **A chamada síncrona domina o f0: `explode` é 50% do update do quadro (35 a 38 ms a 1x, 140 a 148 ms a 4x), maior que tudo que a T0.3 tinha como causa.** Com o `solveStructure` dentro, o update do f0 inteiro vai de 28 para **71 a 72 ms a 1x** (260 a 287 ms a 4x). Contra a C8 nova (f0 ≤ 16,6 ms a 1x) a meta é 4,3 vezes menor que o número de hoje.
- `floorplan.breach-cut` (10 a 12 ms no f0, 38 a 45 a 4x) era o grosso do `rest` da T0.2 e fica fora das fases P1/P2/P3 como escritas: é fila `mustDrain` (a T1.1 já a trata à parte), mas seu custo por unidade é do `floorplan`, não do orçamento.
- `action` (6 ms a 1x, 22 a 30 a 4x) é o que `explosives.blastAt` faz além de `world.explode`; sem dono nas fases.
- Tabela A (física) não muda: o portão fechou sem regressão contra a mesma `origin/main`.

## T1.2

`game-runtime`: modo de prazo opcional por quadro (`targetMs` + `frameStartMs`, sem dívida, estimativa do render, reservas do piso, classe `mustDrain` contada à parte, campos novos em `stats()`); `startLoop` passa o `nowMs` do rAF. `DeferredQueueOptions.mustDrain` entrou em `game-contracts` só porque o `game-runtime` não compila sem ele (o resto é T1.4). Base de tempo: o orçamento aceita `frameStartMs` até um `targetMs` antes do relógio (conta o atraso do callback); fora disso (outra base) lê como "agora". Aceite: `pnpm --filter @adatechnology/game-runtime test` → 61 passam (20 novos em `tests/deadline.test.ts`, com a C2 em 1.000 quadros); `game-contracts` 115 e `game-test-room` 465 passam; typecheck, lint, `check:layers` e `kit-audit --check` sem novidade; `room.ts` segue com 5.620 linhas.

## T1.4

`game-contracts/src/frame.ts`: 9 ids e prioridades novos da tabela da seção 3 (`minEveryFrames` incluído), `drainDetached` (seção 4c) exportado pelo `index.ts`, 4 testes em `tests/frame.test.ts`. Comandos: `pnpm --filter @adatechnology/game-contracts build`, `... typecheck`, `... test`, `npx eslint` nos 3 arquivos, `pnpm check:layers`, `node tools/kit-audit/audit.mjs --check`. Resultado: build ok; typecheck sem erro; test 119 passam (115 antes, +4); eslint sem problema; check:layers sem violação nova; kit-audit 0 novos fora do SDK dono. Commit `bd8d087af`.

## Decisão do dono (2026-11-19): medir só no fim

- As medições de tempo por fase (T1.8, T2.6, T3.7) passam para uma régua única na T4.1, nas mesmas condições da T0.2/T0.4, comparada com as duas.
- Cada fase entra na branch da spec como merge próprio; se a régua final não fechar a C8 ou piorar algo, mede-se nos merges de fase para achar a causa.
- Por fase continuam as contagens que não dependem de máquina quieta: chamadas de `solveStructure` (C7), chamadas ao wasm por peça dormindo (C6), `kit-audit --strict-clocks` (C3) e o tempo de CPU indicativo de `world.explode` (base da decisão da meta do f0).
## T2.1 — estrutura resolvida uma vez por objeto por operação (D9)

Commits `0ab57d2c9` (mundo), `3297b8875` (renderer), `e3a9ee846` (contrato e changeset), `39098fcd2` (goldens). Contrato do `detach.groups` mudou por decisão do dono (2026-11-19): grupos do fim da operação.

- **O quê:** `partLost`, `wearJoints`, `hingeDrop`, `giveAtCut`, `revealHosted`, `slideOffResting`, solo cedendo e `disassemble` guardam a mudança (`loosened`); `solveStructure` + `recomputeGroups` rodam uma vez por objeto no fim do `run()` ou antes de quem lê cargas no meio (viga/laje no `bendByBlast` e no `failPart`, `exposeRebar`, `stepObject`, `stepSoil`, `stepWind`, `undermine`, `flushCollapse`). No renderer, `onFracture` solta os grupos (`splitLoose`) antes do `loosenIfFootless`: a separação não depende da ordem detach/fracture.
- **`splitLoose`/`adoptSplit`/`rebuildHost`:** já rodavam uma vez por objeto por drenagem (126 `detach`/`collapse` da explosão do sobrado viram 1 `splitGroups` de 32 grupos no f0); sem mudança.
- **Contagem (explosão de 4 MJ no sobrado, `blast-presentation`):** `solveStructure` 174 → 39 por `explode` (1 objeto). Teste C7: `game-floorplan-three/tests/structure-solves.test.ts` (≤ 39).
- **CPU do `world.explode` (Node, indicativo, mediana de 7, máquina com outras sessões):** 112,6 ms → 33,4 ms.
- **Mesmo resultado:** `serialize()` e estado do objeto idênticos ao de antes; mesmos 907 eventos; só os `detach` mudam de lugar e de `groups`.
- **Regravados (decisão do dono):** `game-destruction/tests/fixtures/wall-golden/house-scenarios.json` (mesmos 589 eventos, outra ordem); `game-floorplan-three/tests/fixtures/exact-floorplan.json` `destruction/breach` `ead9c9f0` → `f510262a` e `destruction/fracture` `2a37b871` → `a81d197b`; `blast-presentation` `RECORDED_BLAST_OUTCOME` `93a1e0f3c34c88e06bd1dfb2e60359c63c024479` → `e71103813d3baabcf1bb8820b65333fbe9ebc659`. Nada mais mudou.
- **Comandos (sob `flock ~/.cache/adatechnology-game-kit/cpu.lock`):** `game-destruction` `vitest run` 578/578; `game-destruction-three` `vitest run` 607 passed / 195 skipped (inclui `shelf-swings-on-hinge`, sem mudar o teste) e `pnpm test:jolt` 102 passed / 3 skipped (o `test:jolt` **não** inclui `shelf-swings-on-hinge`); `game-floorplan-three` `exact-golden`, `blast-presentation`, `split-rebuild-identity`, `z-fighting-houses`, `structure-solves` 82/82; `construction.test.ts` residential 21, commercial 13, rural 11, post-apocalyptic 56; `typecheck` de contracts, destruction, destruction-three e floorplan-three; eslint dos arquivos mudados sem erro; `pnpm check:layers` sem violação nova; `node tools/kit-audit/audit.mjs --check` 0 novos. `room.ts` intacto.
- **Pendência anterior à T2.1:** `shelf-swings-on-hinge` falha com `PIECE_SOLVER=jolt` (linha 77) já na base `1cb39c001`; fica para uma task própria.

### T2.1 — segunda revisão estrutural (2026-11-19)

- **STALE_STRUCTURE_READ** (`51e6dcc9d`): `undermine` resolve a estrutura a cada volta do laço dos apoios, e `spanOpening`, `breakOver` e `crackOver` também, para a laje que caiu por `hingeDrop` não deixar a próxima viga baldrame da mesma perda ser julgada com a carga de antes. Teste `game-destruction/tests/ground-loss-drop.test.ts`: mesmas partes perdidas, cargas e recalques do código de `1cb39c001`. Nos 48 cenários testados a v1 já dava o mesmo resultado: o teste guarda a regressão, não reproduz uma divergência.
- **CONTRACT_MISMATCH** (`4c7de12b9`, opção A, decisão do dono para toda operação): todo `detach` sai no fim do `run()` de profundidade 1, depois do último settle e do `flushCollapse`, com os grupos finais. Teste em `structure-solves.test.ts`: cada `ev.groups` igual a `state().groups` no fim da explosão de 4 MJ no sobrado. `solveStructure` segue em 39.
- **Regravados** (`48a6c6afe`): `house-scenarios` e `gate-rpg-collapse` (mesmos eventos, outra ordem); `split-cache-identity` `c7802280…f0c8` → `290b168b…a5d7` (serialize, raios, splits e eventos iguais); `exact-floorplan` `destruction/breach` `f510262a` → `2ef1cab7`, `destruction/fracture` `a81d197b` → `b2fd7663`; `RECORDED_BLAST_OUTCOME` `e7110381…c659` → `6a4a72aa533489232b4094f3b1ec417c65652e9d`.
- **Não regravado:** `exact-floorplan` `destruction/spall` (`3454857a`, dá `dd89703c` na rodada completa): o dono pede comparação nó a nó da cena com a base antes. Até lá o `exact-golden` falha só nesse caso.

### T2.1 — terceira revisão estrutural (2026-11-19)

- **TEST_NOT_GUARDING:** `ground-loss-drop.test.ts` refeito. A parede de tijolos fica sobre duas vigas baldrame em linha (`gb_a` e `gb_c`); a laje que cai por `hingeDrop` pesava sobre as duas. `gb_c` é julgada na mesma perda com a carga depois da queda (1,35 t, não cerca de 5,4 t). Afunda 0,81843 mm, como no código de `1cb39c001`. Sem o `settleStructure` no começo da volta de `undermine`, afunda 0,81865 mm, e o teste falha (diferença de 2,2e-7 m contra a tolerância de 5e-11).
- **CONTRACT_MISMATCH:** o doc do `detach` em `game-contracts` e o changeset dizem que a garantia vale para o mundo do `createDestruction`. Os outros `DestructibleImpl` continuam com um `detach` por junta: veículos com os grupos daquele momento, personagens só com a peça que saiu (`[[segmento, ...caídos]]`).
- **TEST_GAP:** `structure-solves.test.ts` ganhou um `hitPart` e uma perda de solo aplicada no `update`, com a mesma checagem de grupos e de ordem da explosão.
- **Spall regravado** (decisão do dono): `exact-floorplan` `destruction/spall` `3454857a` → `dd89703c` (rodada completa do golden). O renderer recebe os eventos do golpe antes de separar as peças e passa a desenhar o amassado de 25 mm do conduíte e as cores dos lascados.
- **Pendências anteriores, fora desta spec:**
  - `conduit:conduit_outlet19` (plástico) com 1445,8 kg de massa e 86749 de vida máxima, já em `1cb39c001`. Ponto de partida: `game-floorplan-three/src/utilities/electrical.ts:113` (`pieceRecord`).
  - As juntas que `openOver`/`loseGround` abrem numa volta de `undermine` só entram no `loosened` no fim do laço (`world.ts:2484`). A base faz o mesmo.

- **Comandos (sob `flock ~/.cache/adatechnology-game-kit/cpu.lock`):** `game-destruction` `vitest run` 578/578; `game-destruction-three` `vitest run` 607 passed / 195 skipped e `pnpm test:jolt` 102 passed / 3 skipped (inclui `shelf-swings-on-hinge`, sem mudar o teste); `game-floorplan-three` `exact-golden`, `blast-presentation`, `split-rebuild-identity`, `z-fighting-houses`, `structure-solves` 82/82; `construction.test.ts` residential 21, commercial 13, rural 11, post-apocalyptic 56; `typecheck` de contracts, destruction, destruction-three e floorplan-three; eslint dos arquivos mudados sem erro; `pnpm check:layers` sem violação nova; `node tools/kit-audit/audit.mjs --check` 0 novos. `room.ts` intacto.

## T2.2 — `solveStructure` e `recomputeGroups` sem alocação por chamada

Commit do mundo: ver `git log` (`perf(destruction): solveStructure e grupos sem alocação por chamada`). `world.ts`: rascunho do mundo (`ufParent`, `supportedRoot`, `bendingScratch`, listas e peças de `edges`/`through` reaproveitadas), `find`/`union` no nível do mundo, `revealHostedIn` e as três passadas de `world.update` com vetor reaproveitado (instantâneo por passada, igual à cópia de antes). Sobram as alocações de `solveSupports`/`distributeLoads` (pacote `game-load-path`) e as do resultado (`o.st.groups`).

- **Mesmo hash:** `exact-golden`, `blast-presentation`, `structure-solves` (39), `split-rebuild-identity` 51/51 sem regravar nada; `game-destruction` `vitest run` 578/578; `tsc --noEmit` do pacote limpo; eslint sem erro.
- **Medição (indicativa, Node em `vitest`, `world.explode` 4 MJ no sobrado, mediana de 7, load médio 6 a 8 com outras sessões):** antes 386 ms, depois 324 a 387 ms em 3 rodadas (dentro do ruído; o 33,4 ms da T2.1 foi medido por outro caminho e não é comparável). `heapUsed` por `explode`: 44,3 MB antes, 32 a 39 MB depois.

## T4.2 e T4.3 — documentação e regra

- `9c5c7287e`: `docs/desempenho-explosoes.md` (seção da spec 010, pendência "a ordem do quadro não tem dono" riscada), README do `game-runtime` (filas, passo fixo, interpolação), referência da skill `kit-base`, regra §15 (exceção única `drainDetached`, gate `--strict-clocks`, `mustDrain`, R2), `tasks.md` das specs 005, 008, 009 e 010 (pendências listadas). Só documentação; sem build nem teste.
- A ligação task → commit no `tasks.md` da 010 foi tirada do log (mensagens com o número da task), não auditada.
