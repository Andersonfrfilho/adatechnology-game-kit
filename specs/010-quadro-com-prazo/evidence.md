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
