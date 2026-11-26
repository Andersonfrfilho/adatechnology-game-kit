# @adatechnology/game-render-three

## 0.4.5

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0

## 0.4.4

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0

## 0.4.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0

## 0.4.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.4.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.4.0

### Minor Changes

- 08c5801: Menos chamadas de desenho nos piores quadros da explosão da casa, sem mudar o que aparece na tela.

  - `createStaticBatcher` ganhou `shadowOnly`: as malhas continuam desenhadas sozinhas para a câmera e deixam de projetar sombra enquanto estão no lote; cada lote (só posições, um por lado que o passe de profundidade desenha) entra só no mapa de sombra. Malha com sombra que depende do material (recorte por mapa, planos de corte, deslocamento, material de profundidade próprio) continua projetando a própria. A malha que muda volta a projetar a própria sombra, do formato novo, no quadro em que muda. `maxVertices` divide um grupo grande em lotes menores, para cada um caber num quadro do orçamento.
  - Casa (`game-floorplan-three`): as peças paradas projetam a sombra de poucos lotes só de sombra (`createHouseShadowBatches`, ligado por padrão em `house.update`; `shadowBatches: false` desliga, e `?shadowBatches=0` na sala compara). Na sala, a sombra da estrutura caiu de 231 para 16 chamadas por quadro. Quando um quarto das peças volta a projetar sozinha (explosão, corte de andar), os lotes são refeitos do que ficou de pé depois de 2 s sem mudança.
  - Veículo atingido (`game-vehicles-three`): as peças paradas entram em lote logo no golpe, em pedaços de até 16k vértices, e só as que mudam saem; as que saíram voltam a um lote novo, no formato amassado, depois de 1,5 s sem mudança. Antes, o carro esperava 1,5 s desenhando peça por peça (~620 chamadas por quadro, com sombra) e depois juntava tudo de uma vez (16 a 22 ms num quadro). No sedã a 60 quadros por segundo: de 95 quadros acima de 300 chamadas para ~10, nenhuma atualização acima de ~6 ms, e 70 + 37 de sombra no fim (eram 67 + 34).

- b37d94f: Spec 010, fases 1 e 3: passo fixo único e filas no prazo do quadro.

  - `game-physics`: `PhysicsLoop.stepFixed(steps)` roda passos inteiros vindos do agendador (`step(dt)` continua, com o próprio acumulador). **Quebra para quem implementa `PhysicsWorld`:** o membro `readActiveBodies(out)` passa a ser obrigatório (devolve só os corpos acordados).
  - `game-physics-jolt`: implementa `readActiveBodies`.
  - `game-render-three`: `createStaticBatchQueue` e a opção `queue` dos lotes estáticos, para o orçamento do quadro drenar a junção dos lotes.
  - `game-fluids-three`: `FilmManager.deferredQueue()`, a fila do filme de líquido no prazo do quadro; o tempo devido de um grid que sai é esquecido junto com ele.
  - `game-crowd`: o campo de fluxo passa a andar em células por passo (`cellsPerStep`) por padrão, não pelo relógio; `flow.ms` vale 0. Mesmo resultado em toda máquina.
  - `game-destruction-three`: `DestructionRenderer` ganha `interpolate`, `present`, `restoreStepPose`, `markMoved` e `deferredQueues` (desenho interpolado entre passos e filas registradas no orçamento); uma peça segurada pelo host (empurrar, carregar) é lida mesmo com o motor a dando como dormindo.
  - `game-test-room`: opção `frameTargetMs` (prazo do quadro); a pose do passo volta antes da fase `input`, para empurrar e carregar escreverem na pose do passo, não no desenho misturado do quadro anterior.
  - `game-destruction`: uma operação que lança exceção não passa estrutura e `detach` pela metade para a seguinte.

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0

## 0.3.0

### Minor Changes

- f4cf94f: A primeira explosão não liga programa nem decodifica som no meio do jogo.

  - `createProgramWarmup`: no primeiro desenho do aquecimento, todo objeto que projeta sombra entra nos mapas de sombra (sem o recorte pela câmera da sombra; `shadowCasters: 'visible'` volta ao de antes). O three r160 só liga o programa de profundidade de um objeto quando a passada de sombra o desenha, e o `compile` nunca faz isso: a parede texturizada da calçada da casa, fora da caixa do sol na carga, ligava o programa `USE_MAP ... DEPTH_PACKING 3201` quando entrava na caixa, no meio do jogo.
  - `shadowCasterProbes(THREE)`: sondas que projetam sombra com material iluminado, com e sem textura, nos três lados; a sala registra.
  - `explosionEffectIds(explosions?)` do `game-vfx`: toda explosão do catálogo de efeitos. A sala aquece todas (antes, uma lista à mão de nove, sem o P13, o barril, o tanque do carro e os foguetes).
  - `AudioEngine.preload(ids)`: decodifica agora os arquivos desses sons (e das variantes de um conjunto), uma vez só. `blastSoundIds()` do `game-destruction-three`: o estrondo de cada família, o eco distante, a cauda em lugar fechado, o fogo e os destroços por material. A sala pré-carrega esses e o `water_splash` na primeira tecla ou clique.

- 33d2474: Destroço parado pode custar pouco (opcional: sem as opções nada muda). Orçamento de corpos acordados: acima de `maxAwakePieces` peças soltas (sugerido `SUGGESTED_MAX_AWAKE_PIECES`, 24), as mais antigas que já pararam (no chão, mais lentas que o limite de repouso, e a que está escorada só depois de manter a inclinação por 1,5 s) dormem onde estão, sem teletransporte; acima de `maxAwakeFragments` (sugerido 64) o mesmo vale para os fragmentos. A peça posta para dormir pelo orçamento guarda os pontos em que se apoiava e acorda quando qualquer um deles perde o apoio: a tábua escorada num degrau que sumiu cai, mesmo com o pé ainda no chão. Com `settledBatches` o destroço em repouso é desenhado em lote, um desenho por material (`createStaticBatcher` do `game-render-three`, que ganhou `materialKey` para juntar cópias iguais de um material): a colisão continua a de cada peça, e a peça atingida, acordada, amassada, escondida ou com qualquer evento volta a ser desenhada sozinha na hora. `settledBatchStats()` diz quantos lotes e quantas malhas. A sala de teste liga o desenho em lote; o orçamento fica desligado nela até decisão do dono (`debris.maxAwakePieces`/`maxAwakeFragments` ligam).

### Patch Changes

- 71b5bef: - `shadowCasterProbes`: cada sonda vem depois de uma sonda instanciada (e vice-versa). Na passada de sombra o three r160 desenha todos os objetos com um material de profundidade compartilhado e só escolhe o programa de novo quando o objeto troca entre comum e instanciado; seis sondas comuns em fila ficavam todas com o programa da primeira, e o `USE_MAP` da parede texturizada ligava no jogo, quando ela era desenhada logo depois dos destroços (instanciados) de uma explosão.
  - `FilmManager.warmUpProbes()`: o filme de combustível e sangue tem sondas para o aquecimento, com materiais que o gerenciador guarda até o `dispose`. Cada grade do filme liberava o próprio material, e o programa ia junto com a última; a próxima explosão que derramava combustível ligava de novo. A sala registra as sondas.

## 0.2.0

### Minor Changes

- 157b90d: The warmup draws each effect alone: `EffectWarmup.root` names the subtree the effect draws under, and for its frames every other drawable of the scene is hidden (lights, and whatever holds one, stay, so the program keys are the game's). `VfxRenderer.root` is the group every effect draws under; the test room passes it for the nine blasts it warms. The room was drawn in full 27 times per warmup only to warm the blasts: the second warmup of the room's load went from 62 s to 17 s with software GL, and the page opens in 71 s instead of 113 s.

## 0.1.0

### Minor Changes

- 41b9dd4: The horde draw cost (spec 005, D12). `createCrowdRenderer({ variety })` gets a level `budget` (bodies per mesh level, bodies on the ground included; a crowd packed near the camera pulls the level edges in, the nearest bodies draw first), an `adapt` loop that sizes it from the crowd's GPU time (`EXT_disjoint_timer_query_webgl2`, the frame time where there is none), `nearDepthPrepass` (the near level draws its depth first so the room's lights shade a pixel once) and `detailScale`/`gpuMs` read-outs. `createBodyBatch` and `createVariantBatches` take `depthPrepass` and return `batch.prepass`; add it to the scene next to `batch.mesh`. `game-render-three` gets `createFramePacer`, which holds the draw back while the GPU is a frame behind.
- 05fbba9: New package (L4): the `ThreeLib` type, `createLightBudget` (fixed light count, slots with priority and fades, leases, `seal`/`check`), `createProgramWarmup` (probes, effects, textures, anchors that keep programs linked, `linkedSince`), `createFog({ stable })`, and geometry and material pools. `three` is a peer dependency, never imported as a value.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
