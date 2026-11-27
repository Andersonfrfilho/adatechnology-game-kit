# @adatechnology/game-physics

## 0.7.1

### Patch Changes

- 717951a: `velocityIterations` documenta o piso: abaixo de 20 iterações o kit não garante os critérios de energia; o `KIT_WORLD` usa 32.

## 0.7.0

### Minor Changes

- 3b5f3be: Com o laço do motor, o módulo da multidão da sala cria os agentes como cápsulas cinemáticas e as portas como folhas numa dobradiça que cede, e solta tudo ao sair; o carro físico da sala atropela a multidão (`createRunOver`, o agente derrubado vai a `Crowd.knockDown`). Os dois módulos se encontram pelo canal novo `PhysicsServices.channel(name)` (`CROWD_AGENTS_CHANNEL`), em qualquer ordem. Com `hordeThread` ou sem serviços (`own`) nada muda.

## 0.6.0

### Minor Changes

- e4a9d0e: feat(physics): `SeamWorld.readAwakeBounds` lista os corpos dinâmicos acordados e os personagens (caixa e velocidade horizontal); o chão do motor (`game-destruction-three`, `engine-ground-follow.ts`) segue todo corpo que não é das peças: ladrilho que falta embaixo é feito na hora, o da frente vai ao worker, e o ladrilho que ninguém pediu há 600 atualizações e sem corpo em cima sai do mundo.

## 0.5.0

### Minor Changes

- 4afbea0: feat(host): `ModuleHost.physics` e `ModuleHost.workers`; `createPhysicsServices`/`isPhysicsServices` no game-physics; `KitWorldPhysics.services` e `physicsHostOf` no preset; opção `workers` em `createTestRoom`.

## 0.4.0

### Minor Changes

- cf37f9c: feat(physics): `createBlastQuery` (fragmentos, corpos no raio e linha de visada de uma explosão) e `createSensorVolumes` (esferas que avisam quem entra e sai).
- cefa5d9: feat(physics): `createImpactReader` (o golpe mais forte de cada corpo no quadro, sem alocação por linha de contato); feat(destruction-three): `contactHits` no renderizador liga o golpe do motor numa parte fixa a `hitPart` blunt.

## 0.3.0

### Minor Changes

- 7e40a5b: Controlador de personagem atrás do contrato (spec 008, T4.1). `game-physics` ganha `createCharacter`, `moveCharacter`, `pushCharacter`, `readCharacter`, `teleportCharacter`, `characterSupported` e `removeCharacter` (sobe degrau de 18 cm, rampa de 30 graus, empurra caixa de 30 kg, é empurrado); `game-physics-jolt` os implementa com o `CharacterVirtual` por `CharacterId`; `game-player` aceita `PlayerWorld.controller` e traz `createPhysicsController`. Sem controlador o jogador anda pela grade como antes.

  Segurar, soltar e arremessar (T4.2): `grabBody` em `game-physics` (cinemático varrido contra o que é fixo, sem atravessar parede; solta como dinâmico e varrido) e `setContinuous` no contrato.

## 0.2.0

### Minor Changes

- b0a370f: O chão que o motor põe sob as peças custa menos, sem mudar o chão nem o que as peças fazem sobre ele.

  `game-terrain`: `Terrain.heightRange(minX, maxX, minZ, maxZ)` devolve os limites exatos da altura do terreno sobre um retângulo, lidos nos vértices que ele cobre (a altura entre vértices é uma mistura dos quatro ao redor), ou `null` quando o retângulo sai do terreno.

  `game-destruction-three`: com `terrainRangeAt` (opção do renderizador e do sistema de peças), um ladrilho que o terreno prova plano é assentado como laje sem ler as 25 921 amostras; qualquer relevo sob ele, uma cratera de um vértice inclusive, faz a leitura inteira como antes. `blastGroundTiles` (padrão 0, desligado: medido, 48 ladrilhos moveram cerca de 24 ms para o quadro da explosão e não melhoraram o pior quadro) assenta, na explosão, essa quantidade de ladrilhos ao alcance dela, os mais próximos primeiro, antes de as peças que ela solta precisarem deles. O sólido sob uma cratera refeito por uma mudança do chão reaproveita os cascos que a mudança não tocou.

  `game-physics`, `game-physics-jolt`: `ShapeDesc` composto aceita `reuseHulls`; o corpo guarda os cascos convexos da forma atual e a próxima forma dele pega os que são iguais bit a bit, em vez de montá-los de novo. Guarda só os cascos da forma atual, então a memória não cresce com as mudanças.

  `game-test-room`: a sala passa o `terrainRangeAt` do terreno dela.

- 10f2df0: No modo Jolt, o chão que se deforma passa a ter as alturas do ladrilho alteradas no lugar, em vez de refazer o ladrilho todo. O chão resultante é o mesmo de um ladrilho recém-assentado.

  `game-physics`: `PhysicsWorld.updateHeights(id, region, heights)` e o tipo `HeightRegion`. Troca no lugar as alturas de um retângulo de um corpo estático de campo de alturas; devolve `false`, sem mudar nada, quando a engine não pode (não é campo de alturas, retângulo fora dele, altura fora da faixa com que o campo foi feito), e quem chama dá ao corpo uma forma nova (`setShape`).

  `game-physics-jolt`: `JoltWorld.updateHeights` sobre `HeightFieldShape::SetHeights`, com o retângulo alargado ao bloco do Jolt, as amostras acrescentadas escritas dos valores exatos (nunca relidas), a memória do wasm liberada e o broadphase avisado. O Jolt também requantiza os blocos à esquerda e acima dos escritos (até 4,4e-5 m por escrita, 1,8 mm em 50): quem escreve o mesmo campo várias vezes refaz a forma de vez em quando.

  `game-destruction-three`: o ladrilho marcado por `groundChanged` lê de novo só as amostras da região avisada (mais 25 cm), não toca no motor se nada ali mudou, escreve no campo só o retângulo que mudou (até metade do campo, quatro vezes seguidas; depois a forma é refeita dos valores exatos) e refaz o sólido sob o campo só quando as alturas mudaram.

- 51c7f3d: O trabalho que uma explosão deixa (grupos soltos a cortar em peças, fragmentos a soltar, entulho a acordar) pode correr num orçamento de quadro em **unidades de trabalho**, nunca em tempo (spec 008, T3.8aa). Desligado por padrão: sem a opção nada muda.

  `game-physics`: `WorkBudget` (o árbitro: `budgetMs` × `unitsPerMs` / `tier` unidades por quadro, padrões 4 ms, 100 e 1, e `maxWaitFrames` 12, decisão do dono em 2026-11-16), `WorkQueue` (trabalho guardado como dado, por prioridade e chave estável, ao menos um por quadro, o que esperou o teto sai de qualquer jeito; salva e carrega) e `WORK_KINDS` (a ordem fixa em que as filas tiram do orçamento). `WakeQueue.release` aceita `limit`.

  `game-destruction-three`: `RendererOptions.workBudget` (`ExplosionWorkOptions`: as opções do `WorkBudget` mais `costs`, padrões em `WORK_UNIT_DEFAULTS`). Os eventos aplicam no próprio quadro (clarão, poeira, trincas); cada grupo solto espera numa fila, o mais perto do `focus` primeiro, desenhado e sólido no objeto até a vez dele; fragmentos e a fila de despertar tiram do mesmo orçamento. `splitWorkUnits` estima o custo de um corte pelo tamanho do trabalho, sem contar caixas já ajustadas.

  `game-test-room`: `debris.workBudget` (o jogador é a câmera); a página da sala lê `?workBudget=4`.

- c8b5c71: Spec 008 (fases 1–3 até a T3.8): motor físico Jolt Physics como opção do kit, desligado por padrão.

  - Pacotes novos: `game-physics` (contrato do motor, fila de despertar, medidor de custo) e `game-physics-jolt` (adaptador do Jolt). O Jolt é escolhido por `physics`; sem ele, o solver próprio segue como hoje.
  - Entulho de explosão opcional (`blastDebris`): as peças despertam em lotes, com o mínimo e o máximo ajustados pelo custo medido na máquina.
  - Colisores fiéis ao desenho:
    - a caixa só vale quando as faces estão cobertas;
    - se as faces não estão cobertas, a peça colide pelos triângulos (batentes e molduras não são mais placas maciças).
  - Portas e janelas sem peças nascendo umas dentro das outras.
  - Fiação e canos se soltam em trechos (`segmentLimits`), cortados em lajes e paredes.
  - O chão é montado ao longo do caminho de peças rápidas.
  - Os estilhaços de granada sorteiam por alvo: um objeto novo na cena não muda mais onde eles caem.
  - A mão empurra a porta que se afasta, em vez de seguir a folha (spec 004).

- b37d94f: Spec 010, fases 1 e 3: passo fixo único e filas no prazo do quadro.

  - `game-physics`: `PhysicsLoop.stepFixed(steps)` roda passos inteiros vindos do agendador (`step(dt)` continua, com o próprio acumulador). **Quebra para quem implementa `PhysicsWorld`:** o membro `readActiveBodies(out)` passa a ser obrigatório (devolve só os corpos acordados).
  - `game-physics-jolt`: implementa `readActiveBodies`.
  - `game-render-three`: `createStaticBatchQueue` e a opção `queue` dos lotes estáticos, para o orçamento do quadro drenar a junção dos lotes.
  - `game-fluids-three`: `FilmManager.deferredQueue()`, a fila do filme de líquido no prazo do quadro; o tempo devido de um grid que sai é esquecido junto com ele.
  - `game-crowd`: o campo de fluxo passa a andar em células por passo (`cellsPerStep`) por padrão, não pelo relógio; `flow.ms` vale 0. Mesmo resultado em toda máquina.
  - `game-destruction-three`: `DestructionRenderer` ganha `interpolate`, `present`, `restoreStepPose`, `markMoved` e `deferredQueues` (desenho interpolado entre passos e filas registradas no orçamento); uma peça segurada pelo host (empurrar, carregar) é lida mesmo com o motor a dando como dormindo.
  - `game-test-room`: opção `frameTargetMs` (prazo do quadro); a pose do passo volta antes da fase `input`, para empurrar e carregar escreverem na pose do passo, não no desenho misturado do quadro anterior.
  - `game-destruction`: uma operação que lança exceção não passa estrutura e `detach` pela metade para a seguinte.

- ca2dac7: Amortecimento de rolamento por material: além da resistência ao rolamento (C_rr), cada material da peça (`surfaceOf`: vidro e aço 0,02/s, madeira 0,4/s, borracha 0,3/s, tecido 1/s) e cada chão (`TerrainMaterial.rollingDamping`: concreto 0,3/s, cerâmica 0,1/s, grama 1,5/s, areia 2/s, lama 3/s) tiram uma parte do giro por segundo, e os dois se somam: a garrafa rola mais no piso liso, a tora para logo na grama. Cerâmica e madeira de piso passam a ter C_rr 0,008 e 0,01 (antes o 0,015 padrão). Contrato: `Rolling.damping` e `Material.rollingDamping`; o adaptador Jolt aplica os dois em todo corpo com `rolling` (`rollingImpulse`), e o `saveState` guarda o amortecimento. Terreno: `rollingDampingAt`. Renderizador: `terrainRollingDampingAt` (a sala de teste liga ao terreno). Em rampa a peça continua rolando, e um impulso a acorda e ela volta a rolar. Medição na sala: `examples/test-room/rolling-test.mjs`.
