# @adatechnology/game-terrain

## 0.9.7

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-contracts@0.43.0

## 0.9.6

### Patch Changes

- Updated dependencies [9412886]
  - @adatechnology/game-contracts@0.42.0

## 0.9.5

### Patch Changes

- d7fa717: A cratera de uma carga no chão usa a energia real da carga. Os `specificEnergy` do solo são de joules reais (1 kg de TNT = 4,184 MJ; a granada de 800 kJ, a carga de contato de 4,2 MJ), mas o mundo de destruição entregava ao terreno o `energy` da escala de dano do arsenal (0,24 kg = 200 kJ): toda cratera saía com 1/5 da energia. `applyHit` explosivo agora lê `hit.tnt` vezes `TNT_JOULES` (exportado de `game-contracts`) quando o golpe traz `hasCharge` (novo em `Hit`: o mundo de destruição o marca quando a explosão recebeu `charge.tnt`, como a sala faz com toda carga do arsenal); sem carga dita, segue o `energy`. O PG-7V (0,45 kg) passa de 0,19 m para 0,39 m de fundo no solo do quintal.

  Os canos enterrados da casa (esgoto da NBR 8160 e águas pluviais da NBR 10844) quebram com cratera como a rede da rua: `createHouseBuriedPipes` (`game-floorplan-three`) lê o estágio de instalações e pergunta a `breachOf` de `game-urban`; o cano que a bacia alcança aparece no buraco, o que ela corta até a linha de centro quebra (vão) e vaza (`leakOfPipe`, novo em `game-urban`). `ModuleHost` ganha `onCrater` e `addTap` (`HostTap`), que a sala implementa com o terreno e o `game-fluids`; a área de casas liga os dois.

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0

## 0.9.4

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0

## 0.9.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0

## 0.9.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.9.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.9.0

### Minor Changes

- b0a370f: O chão que o motor põe sob as peças custa menos, sem mudar o chão nem o que as peças fazem sobre ele.

  `game-terrain`: `Terrain.heightRange(minX, maxX, minZ, maxZ)` devolve os limites exatos da altura do terreno sobre um retângulo, lidos nos vértices que ele cobre (a altura entre vértices é uma mistura dos quatro ao redor), ou `null` quando o retângulo sai do terreno.

  `game-destruction-three`: com `terrainRangeAt` (opção do renderizador e do sistema de peças), um ladrilho que o terreno prova plano é assentado como laje sem ler as 25 921 amostras; qualquer relevo sob ele, uma cratera de um vértice inclusive, faz a leitura inteira como antes. `blastGroundTiles` (padrão 0, desligado: medido, 48 ladrilhos moveram cerca de 24 ms para o quadro da explosão e não melhoraram o pior quadro) assenta, na explosão, essa quantidade de ladrilhos ao alcance dela, os mais próximos primeiro, antes de as peças que ela solta precisarem deles. O sólido sob uma cratera refeito por uma mudança do chão reaproveita os cascos que a mudança não tocou.

  `game-physics`, `game-physics-jolt`: `ShapeDesc` composto aceita `reuseHulls`; o corpo guarda os cascos convexos da forma atual e a próxima forma dele pega os que são iguais bit a bit, em vez de montá-los de novo. Guarda só os cascos da forma atual, então a memória não cresce com as mudanças.

  `game-test-room`: a sala passa o `terrainRangeAt` do terreno dela.

- ca2dac7: Amortecimento de rolamento por material: além da resistência ao rolamento (C_rr), cada material da peça (`surfaceOf`: vidro e aço 0,02/s, madeira 0,4/s, borracha 0,3/s, tecido 1/s) e cada chão (`TerrainMaterial.rollingDamping`: concreto 0,3/s, cerâmica 0,1/s, grama 1,5/s, areia 2/s, lama 3/s) tiram uma parte do giro por segundo, e os dois se somam: a garrafa rola mais no piso liso, a tora para logo na grama. Cerâmica e madeira de piso passam a ter C_rr 0,008 e 0,01 (antes o 0,015 padrão). Contrato: `Rolling.damping` e `Material.rollingDamping`; o adaptador Jolt aplica os dois em todo corpo com `rolling` (`rollingImpulse`), e o `saveState` guarda o amortecimento. Terreno: `rollingDampingAt`. Renderizador: `terrainRollingDampingAt` (a sala de teste liga ao terreno). Em rampa a peça continua rolando, e um impulso a acorda e ela volta a rolar. Medição na sala: `examples/test-room/rolling-test.mjs`.

### Patch Changes

- 1807dd8: O terreno que assenta avisa o motor: o entulho que pousa sobe o chão (2 a 8 cm, a 5 a 13 m do evento) sem emitir `onDeform`, e os ladrilhos de chão do motor físico ficavam até 80 mm abaixo do chão desenhado, com o que dormia em cima enterrado. Agora cada atualização que assenta entulho emite um único `onDeform` com a região dos vértices que subiram (nunca um por vértice). `fill` também avisa de onde tirou a terra, e `reset`, `setLayout` e `load` avisam que o chão inteiro mudou.
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

## 0.8.1

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0

## 0.8.0

### Minor Changes

- 91bbed8: Water splashes by weapon and by charge: `createWaterEffects` (game-vfx) with a profile per class of round (pistol, rifle, battle rifle, sniper, buckshot, slug...) and per explosive (TNT and kind), ricochet off grazing shots, trails of bubbles, columns, domes, shock rings, waves that push what floats, rain of drops, mist and foam, all with lives and pool limits; `createWaterEffectsLayer` (game-vfx-three) draws them instanced. A `pond` ground 1.4 m deep (game-terrain) in the ground area; impact-fuzed rounds go off on the water and thrown charges sink (`ExplosiveBody.isTriggeredBy`); the test room splashes every shot where it crosses water, skips grazing ones off it, draws blasts under or over water (no fireball under it) and adds `blastAt(explosive, point)`.

## 0.7.4

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.7.3

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.7.2

### Patch Changes

- 6686e67: A launched round (rocket, 40 mm grenade) always goes off where it lands, on any ground, wall or object, however close: an impact before the arming
  distance detonates by default (`rules.explosives.unarmedImpact: 'detonate'`; `'dud'` keeps the real safety of the fuze). Two safety fuzes: a launched
  round that comes to rest goes off (`restSpeed`), and one that hits nothing self-destructs (`selfDestructSeconds`, 20 s). `sweepGround` reads the ground
  along the whole step, so a fast round cannot cross a heap, a kerb or a crater rim between two frames. The ground of the destruction world answers rays
  with its surface as it is now (`surfaceRay`), so a round fired into a crater goes off on its floor instead of in the air over the old flat level.

## 0.7.1

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.7.0

### Minor Changes

- 82f44ab: Uma cratera embaixo de uma casa tira o apoio da fundação: `GroundLoss` e o evento `subside` no contrato, `onGroundLoss` e `voidUnder` no terreno (cratera, laje que cede, areia que escorre), `world.groundLoss` na destruição (recalque com trinca da alvenaria pela distorção angular, baldrame que vence o vazio por flexão, peça que perde o apoio e cai pelo caminho de carga) e a sala ligando o terreno ao mundo.

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.6.0

### Minor Changes

- 3d53e28: A round's crater in the ground follows its calibre: `applyHit` passes the `caliber` of a ballistic hit on, and `strike` takes it (`TerrainStrike.caliber`). The energy is still the volume taken; the calibre shapes it, so for the same energy a 5.56 mm round goes deeper and opens less than a 12.7 mm one, and a crater is at least two and a half calibres across. On a tiled floor a pistol round cracks the tile and a rifle round goes on into the mortar of the subfloor.

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.5.2

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.5.1

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.5.0

### Minor Changes

- 018c556: `terrain.bear(loads)`: weight standing still on bare bars bends them, weights over the same hole add up, and a slab over a void gives way under what its bars cannot hold. The test room hands it the player and every resting piece.

## 0.4.0

### Minor Changes

- 45fd34d: Bare rock (`bedrock`) as a ground of its own, with a lot in the test room; the HUD names every ground profile. `cratersAt` of the effects: on rock, asphalt or a slab a blast leaves only soot, not a dirt crater.

## 0.3.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.3.1

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.3.0

### Minor Changes

- fb985db: A blast breaks a masonry wall only where it reaches: the units within the circle its reach cuts on the wall (by the cube root of the energy and of how much the wall resists) come out with a ragged edge, the units past it are loosened for the next blow, and what the hole leaves with nothing under it comes down (`unsupportedCells`: the triangle over the hole, all that hangs at a free end). The rest of the wall stands, and later shots and blasts keep cutting it. A blast loosens a long joint only over the stretch it breaks, so a grenade no longer opens the bed of a ten-metre wall and drops it whole. Everything a blast knocks out comes in one `chip` with `units` (new optional field), painted once by the house renderer. The ground takes the soot of a blast's fireball by its material (`fire.maxScorch`: concrete soots, turf chars).
- 78e76b0: More grounds to stand on, each with its own answer to a blow: mud, gravel, dry clay, snow, cobblestones, concrete pavers and shallow water. The room's default page lays a lot of every ground with its sign. Fixes the player standing twice as deep in a hole and twice as high on a heap.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.2.3

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.2.2

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.2.1

### Patch Changes

- 7b77aa7: Cost contract of `DestructibleImpl` (spec 005, D8): `describe()` and `state()` are O(1), allocation-free and cached between changes. `checkDestructible(impl, { cost: true })` measures 10 000 reads of each (new object per read, time and heap ceilings, all configurable). The character and the terrain now cache what they return; the values are the same.
- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.2.0

### Minor Changes

- e413341: Rigid ground cracks: concrete, asphalt, tile and stone open a star of lines around a bullet, a hammer or a blast, reaching with the cube root of the energy (about a metre from a grenade on a slab, half that on asphalt), kept in snapshots and drawn as one mesh (`TerrainMaterial.crack`, `Terrain.cracks`, `crackLines`).
  A contact charge breaks a rigid layer right through once it has enough for its thickness cubed (about 1 kg of TNT for a 12 cm reinforced slab), baring the bars, which take the same blow and let a slab over a void drop (`TerrainMaterial.breach`, `TerrainBlowResult.breached`).
- e413341: The inspector says what the floor under the aim is: the ground profile (Dirt, Concrete slab), the material exposed there and how deep it was dug (`terrainProfileName`, `InspectInfo.ground`).
  A floor laid anew (opening an area, a reset) is drawn whole in the same frame instead of showing holes to the sky until every chunk had its turn (`Terrain.dirtyChunkCount`).

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.1.2

### Patch Changes

- 53babb5: A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

  - `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
  - `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
  - `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
  - `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
  - `game-terrain`: clearing the marks starts their numbering again.

- 32529a1: A reset ground digs the same crater and throws the same clods as a new one: `reset` (and `setLayout`) start the ground's random stream over, and the clods count their ids from one again. Before, every reset went on from where the last blow left the stream, so the test room's scenarios that dig the floor came out different from one run to the next (`house_two_pillars` failed now and then).
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.1.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0

## 0.1.0

### Minor Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- 1821647: Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.
- 6d15aad: Bare rebar bends under blows and gives way; a slab over a void (`suspended_slab`) then opens onto the floor below.

### Patch Changes

- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0
