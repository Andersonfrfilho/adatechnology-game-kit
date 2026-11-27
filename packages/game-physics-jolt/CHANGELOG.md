# @adatechnology/game-physics-jolt

## 0.7.3

### Patch Changes

- ecee246: As consultas do mundo Jolt (`overlapSphere`, `overlapShape`, `contactBodies`, `penetration`, `sphereCastAll`) deixam de guardar um resultado por triângulo no heap do wasm: um coletor de JS entrega cada acerto e fica com um por corpo (o mais próximo, no `sphereCastAll`). Antes, uma esfera de 12 m sobre o campo de alturas do chão retinha ~18 MB por mundo e o lançador na área de terreno abortava com `Aborted(OOM)`. As matrizes de posição das consultas passam a ser liberadas.

## 0.7.2

### Patch Changes

- Updated dependencies [f6e97fd]
  - @adatechnology/game-physics@0.9.0

## 0.7.1

### Patch Changes

- ac65e03: O andador com sombra não varre nem empurra o corpo que o mundo ignora com a sombra (`ignorePair`), e a sala ignora a sombra do jogador para a granada e as cápsulas que nascem da mão: a granada deixa de ser lançada de volta pela cápsula em que nasce.

## 0.7.0

### Minor Changes

- 837d7f0: O jogador no motor (TS.9a a TS.9f): `pushCharacter` respeita o eixo y (pulo) e `CharacterDesc.gravity?` (9,81); `setCharacterShape` (três posturas, false se penetrar); `CharacterDesc.shadow?` e `characterBody` (cápsula-sombra); `readCharacterGround`; personagens no `saveState`/`restoreState`; `createWalker` no `game-player`.

### Patch Changes

- Updated dependencies [837d7f0]
  - @adatechnology/game-physics@0.8.0

## 0.6.0

### Minor Changes

- 717951a: O adaptador descarta o contato fantasma na borda de uma laje plana estática (caixa de arestas vivas) quando o eixo de penetração inclina: um corpo rolando sobre a emenda de dois ladrilhos do chão mantém a velocidade.
- 717951a: O teto de giro do corpo dinâmico vai por tamanho: a velocidade de borda máxima (6 m/s) sobre o raio, nunca abaixo de 47 rad/s nem acima de um quarto de volta por passo fixo. Uma lata rolando a 2 m/s mantém o giro.

### Patch Changes

- Updated dependencies [717951a]
  - @adatechnology/game-physics@0.7.1

## 0.5.1

### Patch Changes

- Updated dependencies [3b5f3be]
  - @adatechnology/game-physics@0.7.0

## 0.5.0

### Minor Changes

- 5aa401f: A frota terrestre inteira fica dentro das faixas do banco de provas no Jolt (T6.2d): o adaptador reparte o torque do motor entre diferenciais e esteiras, mistura o atrito roda-chão pelo produto no pico (só nas rodas do veículo) e a esteira pede torque pleno para girar no lugar; a ficha ganha `physicsTorqueScale` (`PHYSICS_TORQUE_SCALE`), o tanque a potência real de um carro de combate e o ciclista a potência constante; a faixa do giro de esteira começa em 0 e a da bicicleta é a dos ciclistas reais (`accelerationSpanByType`); `FLEET_PHYSICS_SOURCES` guarda as fontes. O fator 1,3 da potência das motos saiu da ficha.

## 0.4.0

### Minor Changes

- e4a9d0e: feat(physics): `SeamWorld.readAwakeBounds` lista os corpos dinâmicos acordados e os personagens (caixa e velocidade horizontal); o chão do motor (`game-destruction-three`, `engine-ground-follow.ts`) segue todo corpo que não é das peças: ladrilho que falta embaixo é feito na hora, o da frente vai ao worker, e o ladrilho que ninguém pediu há 600 atualizações e sem corpo em cima sai do mundo.

### Patch Changes

- Updated dependencies [e4a9d0e]
  - @adatechnology/game-physics@0.6.0

## 0.3.2

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-physics@0.5.0

## 0.3.1

### Patch Changes

- Updated dependencies [cf37f9c]
- Updated dependencies [cefa5d9]
  - @adatechnology/game-physics@0.4.0

## 0.3.0

### Minor Changes

- 7e40a5b: Controlador de personagem atrás do contrato (spec 008, T4.1). `game-physics` ganha `createCharacter`, `moveCharacter`, `pushCharacter`, `readCharacter`, `teleportCharacter`, `characterSupported` e `removeCharacter` (sobe degrau de 18 cm, rampa de 30 graus, empurra caixa de 30 kg, é empurrado); `game-physics-jolt` os implementa com o `CharacterVirtual` por `CharacterId`; `game-player` aceita `PlayerWorld.controller` e traz `createPhysicsController`. Sem controlador o jogador anda pela grade como antes.

  Segurar, soltar e arremessar (T4.2): `grabBody` em `game-physics` (cinemático varrido contra o que é fixo, sem atravessar parede; solta como dinâmico e varrido) e `setContinuous` no contrato.

### Patch Changes

- Updated dependencies [7e40a5b]
  - @adatechnology/game-physics@0.3.0

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

- 85870f8: `createJoltEngine(options)` escolhe a build do Jolt: `single` (padrão, como antes) ou `multithread` (`wasm-compat-multithread`, precisa de
  página isolada por origem), com `workerThreads` e `contactCallbacks`. Worker threads com os callbacks JS de contato do kit são recusados
  (`JoltThreadingError`, `JOLT_WORKERS_WITH_JS_CALLBACKS`): o Jolt chama o listener a partir das threads de job, onde o objeto JS não existe, e o
  passo quebra. Medição em `docs/medicoes/jolt-multithread.md`.
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

### Patch Changes

- 737b677: Correções da auditoria do motor de física. `game-physics-jolt`: a regra "não colidir" entre dois corpos sai com o corpo removido (o Jolt reaproveita o número, e o próximo corpo herdava a regra: um caco caído sobre o poste parava dentro dele); a moto (duas rodas em linha) é lida com as suas 2 rodas e a roda motriz tem diferencial próprio; erro em `createBodies` não deixa mais corpos nem o vetor de ids no heap. `game-destruction-three`: uma peça que dormia no último passo do motor e é acordada e removida no mesmo quadro acorda o que estava em cima dela (§12); o teste da subida do chão mede a penetração real da ponta (8 mm, limite 1 cm); `pnpm test:jolt` roda os blocos só do modo Jolt, agora no CI.
- 3b22fa3: Latas e garrafas: o piso de massa da peça cai de 0,2 kg para `MIN_PIECE_MASS_KG` (20 g), então a lata vazia de 50 g pesa 50 g nos choques; a massa da peça cai com o líquido que sai (bebido, despejado ou vazado, na densidade do líquido) pelo novo `DestructionRenderer.setPieceMass`, e a inércia de giro acompanha; o líquido de dentro da lata gira só metade do que um sólido de mesma massa (`LIQUID_SPIN_COUPLING`), em vez de ser tratado como sólido.

  O corpo de um recipiente segurado (cinemático no Jolt) também guarda a massa nova e a recebe ao ser solto; os refits de quebra mantêm a massa sem o líquido que saiu; a perda é medida em kg com histerese de 10 g, na peça que guarda o líquido, e uma recarga soma massa.

- Updated dependencies [b0a370f]
- Updated dependencies [10f2df0]
- Updated dependencies [51c7f3d]
- Updated dependencies [c8b5c71]
- Updated dependencies [b37d94f]
- Updated dependencies [ca2dac7]
  - @adatechnology/game-physics@0.2.0
