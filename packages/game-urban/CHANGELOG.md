# @adatechnology/game-urban

## 0.5.3

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-floorplan@0.5.1

## 0.5.2

### Patch Changes

- Updated dependencies [32547af]
  - @adatechnology/game-floorplan@0.5.0

## 0.5.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-floorplan@0.4.1

## 0.5.0

### Minor Changes

- 30a8199: Desenho das redes do bairro (spec 011, T2.8d). `game-urban/networks`: `distributionHardwareOf` (cruzeta e isoladores na faixa MT, trafo com buchas, grampo da BT, uma braçadeira por cabo de telecom, braço e luminária, olhal do estai, tudo lido das `slots`), `networkLampsOf` (o estado da lâmpada do #470 por nó `light`) e o `DistributionSpec` com `crossarm`, `insulators`, `bushings`, `lowVoltage`, `telecom` e `guy`. `game-urban-three`: `createUrbanThree(...).drawNetworks(networks, { isNight, lamps, surfaceAt, poles })` com mastros e ferragem instanciados, vãos fundidos por classe com catenária (`spans`: faixa de índices por vão), estai nos postes de esquina e fim de linha ancorado na calçada, LOD de longe em `LineSegments` (`setFocus`), luzes pelo `LightBudget` do host; cerca de 10 chamadas perto. `game-floorplan-three`: em `street: 'network'` a casa não desenha mais o ramal aéreo (é da rede). O poste `concrete_distribution` desenhado sozinho pelo registro continua o braço simples (golden da área de teste sem diff).

  Rua de verdade (revisão do dono): a MT corre por todo poste de rua do alimentador (cruzeta e 3 fases em todos), não só até o trafo. O ramal sai do poste em frente ao lote ou atravessa a rua em linha reta (no máximo `power.dropMaxSkew` = 30° da normal), nunca passa sobre outro lote, e cada poste leva no máximo `power.dropsPerPole` = 4 ramais; sem poste que sirva, o gerador acrescenta um na estação do lote. O `validateNetworks` ganha `frontages` (de `GeneratedNetworks.frontages`) e os códigos `drop_skewed`, `drop_off_frontage`, `drop_over_other_lot` e `pole_too_many_drops`; aviso novo `drop_off_practice`. O padrão de entrada em `street: 'network'` é um poste fino de concreto de 6 m (`NETWORK_POST`) com o ramal ancorado na face da rua, a caixa do medidor no pé (`meter.place: 'post'`) e o eletroduto descendo pela face: nenhum fio do topo do poste até outro ponto (o objeto `service_entrance` ganha a variante `network`).

## 0.4.0

### Minor Changes

- f9d5dbc: `lampStateOf({ seed, x, z, shares: { lit, flicker } })`: escolhe por semente e pelo lugar quais postes acendem, quais falham (piscam) e quais estão queimados, sem tirar número do `b.random` da cena.
- 3a0d4fb: Postes de verdade à noite, tudo opcional (quem não liga as opções desenha igual a antes):

  - `game-urban`: o poste falhando (`flicker: true`) põe o mesmo `flickerPhase` (`flickerPhaseOf(x, z)`) na lente e na luz. As peças sem falha não mudam.
  - `game-urban-three`, `physicalLights: true` (com `lights`): a luz do poste recebe `physicalIntensityOf(part)` e o holofote `physicalIntensityOf(part, feixe)`. Os números do time foram afinados no r128 sem luz fisicamente correta; o fator faz o chão no pé do poste (ou onde o feixe bate) ficar tão claro quanto na página. Sem a opção, as fontes mantêm os números da página.
  - `game-urban-three`, `flickerLenses: true`: o poste falhando pisca a cabeça junto com a luz. A fase é arredondada para 4 grupos, com um material de lente por cor e grupo, e as duas seguem `flickerLevel` (`LAMP_FLICKER`). Assim a cabeça pisca mesmo sem luz real. Sem a opção, a lente fica acesa e a luz segue a fórmula da página (`sin(23t + x)`...), nos dois caminhos.
  - Exporta `physicalIntensityOf`, `flickerLevel`, `flickerGroupOf`, `flickerGroupPhase` e `LAMP_FLICKER`.

- a4637d8: `generateNetworks` em `@adatechnology/game-urban/networks`: as redes do bairro geradas do plano de cidade e dos lotes do site, como dado. Postes de um lado da rua a 0,4 m do meio-fio, vãos de 30 a 40 m na divisa dos lotes, longe de portão (`avoid`), poste de esquina e de fim de linha com estai, intermediário a 5 m da pista transversal; trafos pela demanda diversificada no centro de carga, MT só até eles, BT até 200 m para cada lado, ramal do poste mais próximo; luminária em todo poste; telecom com feixe de 3 a 5 cabos e alguns gatos sem medidor na periferia (pela semente); esgoto no eixo com PV em todo cruzamento e a cada 80 m até o interceptor da margem e a ETE na borda; galeria de drenagem com bocas de lobo nas esquinas e a cada 60 m até o muro de ala; água sob a calçada oposta com registro e hidrante no cruzamento. Regras de traçado em `rules.layout` (`DEFAULT_NETWORK_LAYOUT`), aresta nova `storm_gutter` (sarjeta, canal aberto) e poste `concrete_distribution` no registro com as faixas (`slots`). Poste a mais para o lote fora do alcance do ramal, esquina de T e esquinas ligadas por vão, circuito acima do maior trafo dividido, elevatória (`pumping_station`) onde o esgoto passaria de 4,5 m ou a galeria desceria abaixo do rio, ETE na borda sem rio; `warnings` diz o que foi assentado contra a regra por falta de lugar. Mesma entrada, mesmos bytes (spec 011, T2.8b).
- b3fb084: Entrada nova `@adatechnology/game-urban/networks`: as redes do bairro (energia MT e BT, iluminação, telecom, esgoto, drenagem, água) como dado, sem three.js. Tipos de nó e aresta, regras com `resolveNetworkRules` (folgas por classe, demanda diversificada e trafos, declividade, recobrimento, cruzamentos), faixas do poste de distribuição (`DEFAULT_POLE_SLOTS`, `checkPoleSlots`; `PoleSlots` e `DistributionSpec` no registro de postes), o grafo (`buildNetworkGraph`, `connectedNodes`, `circuitOf`) e `validateNetworks` com códigos estáveis em `NETWORK_VIOLATION`. O lado do lote é o `UtilityConnection` do `game-contracts`. Nada muda na saída de `createUrban` (spec 011, T2.8a).

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [f17aebb]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-floorplan@0.4.0
  - @adatechnology/game-vehicles-fleet@7.0.0

## 0.3.13

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-floorplan@0.3.13

## 0.3.12

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-floorplan@0.3.12

## 0.3.11

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-floorplan@0.3.11

## 0.3.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-floorplan@0.3.10

## 0.3.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-floorplan@0.3.9

## 0.3.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-floorplan@0.3.8

## 0.3.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-floorplan@0.3.7

## 0.3.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-floorplan@0.3.6

## 0.3.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-floorplan@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-floorplan@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-floorplan@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-floorplan@0.3.2

## 0.3.1

### Patch Changes

- 106c0f5: No `any` in the public types: `ShapeGenerator<TParams>`, `Composer<TParams>` and `PoleShapeBuilder<TSpec>` take the params type of the entry (a registry still holds entries with different params), and `Devtools.db` is a typed `MarksDatabase`.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9314e78]
- Updated dependencies [f5cc423]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-floorplan@0.3.1

## 0.3.0

### Minor Changes

- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 7abe6b1: `game-urban` has two new optional options (spec 005, D1 and D7): `createVehicleProvider({ ids })` and `createPlantProvider({ pickSpecies })` take the fleet and the species by option. Without them nothing changes: `ids` still defaults to `PARKED_VEHICLE_IDS` and the species still come from the `region` table of `game-vegetation-species`. The default is deprecated and will be removed in the next major; `PARKED_VEHICLE_IDS` and `region` are `@deprecated` too. Recommended path: `defaultUrbanProviders()` of `@adatechnology/game-kit-defaults`, or your own `ids` and `pickSpecies`.

  `game-urban-three`: `createPlantResolver({ toSpec })` and the `providers` and `plantSpec` options of `createUrbanTestModule` are new and optional; the defaults (`toSpec` of `game-vegetation-species`, the providers of `game-urban`) are deprecated and will be removed in the next major.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [81bd9c0]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-floorplan@0.3.0
  - @adatechnology/game-vehicles-fleet@6.0.0

## 0.2.8

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vehicles-fleet@5.0.0

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

## 0.2.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.5

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.1

### Patch Changes

- @adatechnology/game-vehicles-fleet@4.0.0

## 0.2.0

### Minor Changes

- 20cc300: Skyscraper typology (T10 §11), built from the tower systems, soil, piles and wind of the earlier steps. `game-floorplan-structure`: `buildSkyscraper`,
  `skyscraperLayout`, `SKYSCRAPER_DEFAULTS` (storeys, height, bays, facade, plant floor every N, damper, wind, soil, piles, all options), `pilesFor` and
  `PILE_DEFAULTS` (piles sized by the load and the soil), `addPunchedFacade`, relay mechanical floors in `buildTower` (`mechanical.every`), and the room-level
  plan helpers `towerPlate`, `towerFloors`, `exteriorWindows`. `game-floorplan-commercial`: the `office_tower` template (`officeTowerTemplate`,
  `OFFICE_TOWER_DEFAULTS`, `buildOfficeTower`), the `office_open` library. `game-floorplan-residential`: the `residential_tower` template, the `living_tower`
  library and the zone `zt` (towers, 80 storeys, 320 m). Both packs now depend on `game-floorplan-structure` (peer). `game-urban`: opt-in `towers` option
  (`createUrban({ towers })`, off by default and then byte-identical): tall buildings of the block or avenue drawn as towers of the office and residential
  presets, with `minHeight`, `presets`, `mast` and a `provider`; the pack `TOWER_PATTERNS` adds the `financial_district` avenue. `game-destruction`:
  `verticalBarCount`, so a wall or column holds in tension every bar its spacing puts in (the drawn cage is capped; the capacity was not following it, and
  the walls of the core of a tall tower failed in tension). `game-floorplan`: the walkability grid tests only the walls near the room (same result, a tower
  floor no longer costs seconds).
- 5af569f: Skyscrapers are limited to 60 storeys by default (owner, 2026-10-25), configurable. `game-floorplan-structure`: `SKYSCRAPER_MAX_STOREYS` (60), the
  default `range` is `[20, 60]` and `SkyscraperOptions.range` raises it. The office and residential tower presets follow it, and the zone `zt` is now 60
  storeys and 240 m. `game-urban`: `towers.maxStoreys` (default 60), per-preset `minStoreys`/`maxStoreys` and `towerPresetOf`.

  `skyscraperLayout` sizes the bays by the wind (`sizeForWind`, default on, above 180 m): a 60-storey tower passes H/500 (1/521) with 14.5 m bays; `false` keeps the raw layout.

- dfb86ba: City plans (zoning): `urban.cities` with the registries of district kinds (22) and city plans (6: metropolis, regional city, port city, rail town, country town, mountain village), `layout(plan, { maxFloors, locale })` with `districtAt` (the last district wins) and the grid of `blocks` of a district, `stats` by kind and `fillBlock`, which fills a block through `block.fill` with the heights of its storeys. Opt-in data: nothing is drawn unless called. Options `cities.maxFloors` (60) and `districtKinds` / `cityPlans` under `packs`, `patch` and `remove`.

### Patch Changes

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
- Updated dependencies [3be5d21]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-vehicles-fleet@3.0.0

## 0.1.0

### Minor Changes

- 528db5a: Novos pacotes `game-urban` e `game-urban-three` (spec 001, T7.3a): o padrão urbano da Galeria do Vale Cinzento. `game-urban` (sem three.js) traz os cinco postes (`led_double`, `concrete_arm`, `cast_iron`, `wood_crossarm`, `flood_tower`) com o orçamento de luzes do time (16 luzes reais por cena, contador que fica negativo como o `LB`), ruas com faixa a cada 5 m, calçadas, grade de ruas, quarteirões preenchidos com os prédios do `game-floorplan` pela mesma sequência de sorteio da página, e os adereços (cerca, barraca, pinheiro, árvore, contêiner, torre de vigia com holofote, sacos de areia, letreiro, fios); catálogos por registro (`packs`, `patch`, `remove`, `shapes`) e todos os números por opção. `game-urban-three` desenha as cenas em three.js (r128 ou mais nova): caixas de borda arredondada, instâncias, janelas acesas e apagadas, placas em canvas, luzes e as animações. `neighbourhoods` traz os dez padrões de bairro da amostra da Galeria (centro, subúrbio, bairro popular, rua histórica, industrial e porto, vila ferroviária, serra, palafitas, militar, rural) como dados com compositores, textos em pt-BR e en, marcadores e provedores de casa, veículo e planta. `terrain` traz o terreno por camadas (relevo, cidades niveladas, rios, lagos, floresta, cor dos vértices) e a malha para o desenho, com os números do Vale Cinzento fora do SDK (`game-slice/urban`). Teste de ouro contra 34 casos da página e contra a folha de amostra inteira (G-padrao) e contra a malha do terreno e `hW`/`forestF` da página (G-terrain) (hash da cena, listas de instâncias, sombras e materiais). `createVehicleProvider` e `createPlantProvider` (T7.3d) ligam os padrões à frota (`game-vehicles-fleet`) e às espécies (`game-vegetation-species`) por partes `placement`; `game-urban-three` as desenha com `createVehicleResolver` (veículo `lite`) e `createPlantResolver`. `game-floorplan` passa a exportar `boxRadius`.

### Patch Changes

- Updated dependencies [528db5a]
- Updated dependencies [54419e4]
- Updated dependencies [5718964]
- Updated dependencies [1ea43bd]
  - @adatechnology/game-floorplan@0.2.1
  - @adatechnology/game-vegetation-species@0.2.0
  - @adatechnology/game-vehicles-fleet@2.0.0
