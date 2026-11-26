# @adatechnology/game-urban-three

## 0.5.5

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0
  - @adatechnology/game-urban@0.7.0
  - @adatechnology/game-render-three@0.4.5

## 0.5.4

### Patch Changes

- b3670e1: A chuva não passa por nada que tenha teto. Além das casas, agora alimentam o `RainCover` do host: os carros, ônibus e caminhões (`createVehicleRainCover` em `game-vehicles`, a cabine do `cabinEnclosure` mais o teto e as janelas que sobraram; caçamba aberta, moto, barco, avião, helicóptero e trator ficam descobertos; teto arrancado, para-brisa quebrado ou furo de 30 cm ou mais deixam a chuva entrar; o carro em movimento só gira o retângulo e a versão só sobe a cada 1 m ou 5 graus, `createVehicleRainCovers` em `game-vehicles-three` liga isso ao host), os prédios, torres de vigia, contêineres e barracas do `game-urban` (`builder.covers`, fora de `scene()`, então nada do que é desenhado muda; a área de teste e o distrito de referência alimentam o host) e, nas casas, a edícula, a sauna, a casinha de cachorro e o banheiro externo do lote (`createItemRainCover`). O `game-contracts` ganha `createFootprintRainCover` (retângulos girados que se movem) e `createFixedFootprintRainCover` (retângulos fixos respondidos por uma grade). Copas de árvore não seguram a chuva.
- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0
  - @adatechnology/game-urban@0.6.0
  - @adatechnology/game-render-three@0.4.4

## 0.5.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0
  - @adatechnology/game-render-three@0.4.3
  - @adatechnology/game-urban@0.5.4

## 0.5.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-render-three@0.4.2
  - @adatechnology/game-urban@0.5.3

## 0.5.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-render-three@0.4.1
  - @adatechnology/game-urban@0.5.1

## 0.5.0

### Minor Changes

- 30a8199: Desenho das redes do bairro (spec 011, T2.8d). `game-urban/networks`: `distributionHardwareOf` (cruzeta e isoladores na faixa MT, trafo com buchas, grampo da BT, uma braçadeira por cabo de telecom, braço e luminária, olhal do estai, tudo lido das `slots`), `networkLampsOf` (o estado da lâmpada do #470 por nó `light`) e o `DistributionSpec` com `crossarm`, `insulators`, `bushings`, `lowVoltage`, `telecom` e `guy`. `game-urban-three`: `createUrbanThree(...).drawNetworks(networks, { isNight, lamps, surfaceAt, poles })` com mastros e ferragem instanciados, vãos fundidos por classe com catenária (`spans`: faixa de índices por vão), estai nos postes de esquina e fim de linha ancorado na calçada, LOD de longe em `LineSegments` (`setFocus`), luzes pelo `LightBudget` do host; cerca de 10 chamadas perto. `game-floorplan-three`: em `street: 'network'` a casa não desenha mais o ramal aéreo (é da rede). O poste `concrete_distribution` desenhado sozinho pelo registro continua o braço simples (golden da área de teste sem diff).

  Rua de verdade (revisão do dono): a MT corre por todo poste de rua do alimentador (cruzeta e 3 fases em todos), não só até o trafo. O ramal sai do poste em frente ao lote ou atravessa a rua em linha reta (no máximo `power.dropMaxSkew` = 30° da normal), nunca passa sobre outro lote, e cada poste leva no máximo `power.dropsPerPole` = 4 ramais; sem poste que sirva, o gerador acrescenta um na estação do lote. O `validateNetworks` ganha `frontages` (de `GeneratedNetworks.frontages`) e os códigos `drop_skewed`, `drop_off_frontage`, `drop_over_other_lot` e `pole_too_many_drops`; aviso novo `drop_off_practice`. O padrão de entrada em `street: 'network'` é um poste fino de concreto de 6 m (`NETWORK_POST`) com o ramal ancorado na face da rua, a caixa do medidor no pé (`meter.place: 'post'`) e o eletroduto descendo pela face: nenhum fio do topo do poste até outro ponto (o objeto `service_entrance` ganha a variante `network`).

### Patch Changes

- Updated dependencies [30a8199]
  - @adatechnology/game-urban@0.5.0

## 0.4.0

### Minor Changes

- 3a0d4fb: Postes de verdade à noite, tudo opcional (quem não liga as opções desenha igual a antes):

  - `game-urban`: o poste falhando (`flicker: true`) põe o mesmo `flickerPhase` (`flickerPhaseOf(x, z)`) na lente e na luz. As peças sem falha não mudam.
  - `game-urban-three`, `physicalLights: true` (com `lights`): a luz do poste recebe `physicalIntensityOf(part)` e o holofote `physicalIntensityOf(part, feixe)`. Os números do time foram afinados no r128 sem luz fisicamente correta; o fator faz o chão no pé do poste (ou onde o feixe bate) ficar tão claro quanto na página. Sem a opção, as fontes mantêm os números da página.
  - `game-urban-three`, `flickerLenses: true`: o poste falhando pisca a cabeça junto com a luz. A fase é arredondada para 4 grupos, com um material de lente por cor e grupo, e as duas seguem `flickerLevel` (`LAMP_FLICKER`). Assim a cabeça pisca mesmo sem luz real. Sem a opção, a lente fica acesa e a luz segue a fórmula da página (`sin(23t + x)`...), nos dois caminhos.
  - Exporta `physicalIntensityOf`, `flickerLevel`, `flickerGroupOf`, `flickerGroupPhase` e `LAMP_FLICKER`.

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [08c5801]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [b37d94f]
- Updated dependencies [f9d5dbc]
- Updated dependencies [3a0d4fb]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [a4637d8]
- Updated dependencies [b3fb084]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-render-three@0.4.0
  - @adatechnology/game-urban@0.4.0
  - @adatechnology/game-shapes-three@0.4.1

## 0.3.16

### Patch Changes

- Updated dependencies [6b829c7]
  - @adatechnology/game-shapes-three@0.4.0

## 0.3.15

### Patch Changes

- Updated dependencies [f4cf94f]
- Updated dependencies [33d2474]
- Updated dependencies [71b5bef]
  - @adatechnology/game-render-three@0.3.0

## 0.3.14

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-urban@0.3.13

## 0.3.13

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-urban@0.3.12

## 0.3.12

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-urban@0.3.11

## 0.3.11

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-urban@0.3.10

## 0.3.10

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-urban@0.3.9

## 0.3.9

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-urban@0.3.8

## 0.3.8

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-urban@0.3.7

## 0.3.7

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-urban@0.3.6

## 0.3.6

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-urban@0.3.5

## 0.3.5

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-urban@0.3.4

## 0.3.4

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-urban@0.3.3

## 0.3.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.3.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-urban@0.3.2

## 0.3.1

### Patch Changes

- fd68284: No `any` in the three.js adapters of interactables, vegetation and urban: they take three's own types (`typeof THREE`, `Object3D`, `IUniform`, `HTMLCanvasElement`). New exported types: `SwayMaterial` and `UrbanLight`.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-urban@0.3.1
  - @adatechnology/game-vegetation@0.2.1
  - @adatechnology/game-shapes-three@0.3.1

## 0.3.0

### Minor Changes

- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.
- 7abe6b1: `game-urban` has two new optional options (spec 005, D1 and D7): `createVehicleProvider({ ids })` and `createPlantProvider({ pickSpecies })` take the fleet and the species by option. Without them nothing changes: `ids` still defaults to `PARKED_VEHICLE_IDS` and the species still come from the `region` table of `game-vegetation-species`. The default is deprecated and will be removed in the next major; `PARKED_VEHICLE_IDS` and `region` are `@deprecated` too. Recommended path: `defaultUrbanProviders()` of `@adatechnology/game-kit-defaults`, or your own `ids` and `pickSpecies`.

  `game-urban-three`: `createPlantResolver({ toSpec })` and the `providers` and `plantSpec` options of `createUrbanTestModule` are new and optional; the defaults (`toSpec` of `game-vegetation-species`, the providers of `game-urban`) are deprecated and will be removed in the next major.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [7abe6b1]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-urban@0.3.0

## 0.2.9

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vehicles-three@0.4.0
  - @adatechnology/game-urban@0.2.8

## 0.2.8

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0
  - @adatechnology/game-vehicles-three@0.3.7

## 0.2.7

### Patch Changes

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
  - @adatechnology/game-urban@0.2.7
  - @adatechnology/game-vehicles-three@0.3.6

## 0.2.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-urban@0.2.6
  - @adatechnology/game-vehicles-three@0.3.5

## 0.2.5

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-vehicles-three@0.3.4
  - @adatechnology/game-urban@0.2.5

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-vehicles-three@0.3.3
  - @adatechnology/game-urban@0.2.4

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
- Updated dependencies [2e89152]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-vehicles-three@0.3.2
  - @adatechnology/game-urban@0.2.3

## 0.2.2

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vehicles-three@0.3.1
  - @adatechnology/game-urban@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [d64e58a]
  - @adatechnology/game-vehicles-three@0.3.0
  - @adatechnology/game-urban@0.2.1

## 0.2.0

### Minor Changes

- 3be5d21: Testes e ferramentas no three r160 (o pacote do three passa a pedir `>=0.160.0`); os goldens que o r160 muda foram regravados uma vez: torno dos pneus (ordem dos índices), cores misturadas no espaço linear, um tampo extrudado pelo earcut 2.2.4 e as cores do terreno urbano.

### Patch Changes

- a6d6e09: Planos, cilindros, cones, caixas (e a caixa arredondada), o prisma extrudado e as esferas de alcance da área de teste passam pelo `shapeGeometries` do game-shapes-three: mesmos bytes do three (goldens exatos), com cache por parâmetros.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [3be5d21]
- Updated dependencies [5af569f]
- Updated dependencies [dfb86ba]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-vehicles-three@0.2.0
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-urban@0.2.0
  - @adatechnology/game-shapes-three@0.1.1

## 0.1.0

### Minor Changes

- 8762b85: Módulo de teste da cidade (spec 001, T7.3e): `createUrbanTestModule` e `loadUrbanTestModule` põem na sala os cinco postes, a grade de ruas com quarteirão, um trecho de terreno e os dez bairros da amostra da Galeria como itens, com os catálogos do jogo (`urban: { packs, patch, remove }`). A bancada desenha qualquer bairro à frente do jogador com semente, fração de lampiões acesos, orçamento de luzes e, se pedido, os veículos da frota e as espécies da região; camadas do alcance das luzes e da caixa de cada amostra; métricas de chamadas, triângulos, luzes reais e instâncias; oito cenários `urban_*` (altura dos postes, orçamento de luzes, faixas, altura dos prédios, semente, lampiões queimados, terreno e provedores). `examples/urban-test-area` (global `UrbanArea`, `?area=urban`) e o módulo também na `interactables-test-area`.
- 528db5a: Novos pacotes `game-urban` e `game-urban-three` (spec 001, T7.3a): o padrão urbano da Galeria do Vale Cinzento. `game-urban` (sem three.js) traz os cinco postes (`led_double`, `concrete_arm`, `cast_iron`, `wood_crossarm`, `flood_tower`) com o orçamento de luzes do time (16 luzes reais por cena, contador que fica negativo como o `LB`), ruas com faixa a cada 5 m, calçadas, grade de ruas, quarteirões preenchidos com os prédios do `game-floorplan` pela mesma sequência de sorteio da página, e os adereços (cerca, barraca, pinheiro, árvore, contêiner, torre de vigia com holofote, sacos de areia, letreiro, fios); catálogos por registro (`packs`, `patch`, `remove`, `shapes`) e todos os números por opção. `game-urban-three` desenha as cenas em three.js (r128 ou mais nova): caixas de borda arredondada, instâncias, janelas acesas e apagadas, placas em canvas, luzes e as animações. `neighbourhoods` traz os dez padrões de bairro da amostra da Galeria (centro, subúrbio, bairro popular, rua histórica, industrial e porto, vila ferroviária, serra, palafitas, militar, rural) como dados com compositores, textos em pt-BR e en, marcadores e provedores de casa, veículo e planta. `terrain` traz o terreno por camadas (relevo, cidades niveladas, rios, lagos, floresta, cor dos vértices) e a malha para o desenho, com os números do Vale Cinzento fora do SDK (`game-slice/urban`). Teste de ouro contra 34 casos da página e contra a folha de amostra inteira (G-padrao) e contra a malha do terreno e `hW`/`forestF` da página (G-terrain) (hash da cena, listas de instâncias, sombras e materiais). `createVehicleProvider` e `createPlantProvider` (T7.3d) ligam os padrões à frota (`game-vehicles-fleet`) e às espécies (`game-vegetation-species`) por partes `placement`; `game-urban-three` as desenha com `createVehicleResolver` (veículo `lite`) e `createPlantResolver`. `game-floorplan` passa a exportar `boxRadius`.

### Patch Changes

- Updated dependencies [528db5a]
- Updated dependencies [0b3c030]
- Updated dependencies [54419e4]
- Updated dependencies [35c2caa]
- Updated dependencies [537b5b0]
- Updated dependencies [0aafb73]
- Updated dependencies [8d50353]
  - @adatechnology/game-urban@0.1.0
  - @adatechnology/game-floorplan@0.2.1
  - @adatechnology/game-vegetation@0.2.0
  - @adatechnology/game-vegetation-species@0.2.0
  - @adatechnology/game-vehicles-three@0.1.0
