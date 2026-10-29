# @adatechnology/game-floorplan-commercial

## 3.0.0

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

### Patch Changes

- 5af569f: Skyscrapers are limited to 60 storeys by default (owner, 2026-10-25), configurable. `game-floorplan-structure`: `SKYSCRAPER_MAX_STOREYS` (60), the
  default `range` is `[20, 60]` and `SkyscraperOptions.range` raises it. The office and residential tower presets follow it, and the zone `zt` is now 60
  storeys and 240 m. `game-urban`: `towers.maxStoreys` (default 60), per-preset `minStoreys`/`maxStoreys` and `towerPresetOf`.

  `skyscraperLayout` sizes the bays by the wind (`sizeForWind`, default on, above 180 m): a 60-storey tower passes H/500 (1/521) with 14.5 m bays; `false` keeps the raw layout.

- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [89807ec]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [5af569f]
  - @adatechnology/game-floorplan-structure@1.1.0
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-floorplan-residential@3.0.0

## 2.0.0

### Minor Changes

- 7b9df31: Interiores completos do comércio (spec 001, T2.5b): `supermarket` (caixas, gôndolas, padaria, açougue com câmara fria, estoque, escritório com cofre), `drugstore` (balcão de dispensação, sala de manipulação, depósito de controlados com geladeira de vacinas e cofre) e `gun_shop` (armas longas, vitrine, bancada de recarga, troféus, depósito blindado e estande de tiro com quatro raias). Cada modelo declara `place` e `construction` e traz o programa da cena da Galeria do Vale Cinzento (cômodos, medidas e equipamentos); `interiorFindsHints` lista o que cada lugar pode guardar (os pinos de achado da galeria) para o provedor de achados. `market` e `pharmacy` passam a ter `place`. Textos em en e pt-BR.
- a1cf679: Interiores dos prédios públicos (spec 001, T2.5c): `police_station` (recepção, sala do delegado, salão dos policiais, duas celas com grade, arsenal, vestiário, depósito de evidências e pátio de viaturas), `emergency_room` (pronto-socorro com macas, carrinho de emergência e cilindros de oxigênio; alas de internação A e B e UTI) e `school` (biblioteca, refeitório, cozinha da merenda, corredor de armários, sala de aula com lousa e 16 carteiras, quadra). Uso `institutional` (zona ZC passa a aceitá-lo). `buildingLot` monta o lote de cada prédio.
- 35cee78: Interiores do posto, da igreja e da metalúrgica (spec 001, T2.5d): `gas_station` (loja de conveniência com corredores e geladeiras, banheiro externo, troca de óleo com elevador e tambores; pista com três ilhas de bombas e quatro colunas da cobertura), `church` (salão paroquial, nave com 14 bancos, altar com cruz, sacristia, armário de doações e torre do sino) e `metalworks` (prensas, porta-pallets, linha de produção, forno, empilhadeira, tambores, refeitório, vestiário e escritório do mezanino). A metalúrgica declara uso `industrial` (zona ZI).
- fddedd3: Fazenda no pacote comercial (spec 001, T2.5e): modelo `farm` com a casa sede (sala, cozinha com fogão a lenha, quarto com cama e rede) e, no lote, varanda com pilares, poço, galinheiro, curral, celeiro, silo, galpão de máquinas, dois tratores, espantalho e dez fardos. Estilo `farm` próprio (cercas de arame, chão de terra, cores de fazenda em `regions/br`), uso `agricultural` e zona `za` (agrícola) na região `br`. O pacote comercial não depende do rural.

### Patch Changes

- 35fa212: Regras do Visor de casas 3D no motor de plantas (spec 001, T2.2b): raio do jogador de 0,24 m na grade de caminho, folgas de porta e janela por modelo, janelas distribuídas no trecho de parede, regra de janela com armário aéreo e box (`windowHeight`, `overhead`), vaga de carro com folga do motorista, caminho para toda porta externa, caixa de correio, abajur, estados com ao menos uma janela tapada. Novos ganchos: `registerResultExtension` (com `seedKey`), `registerFindsProvider`/`findsFor`, `registerViewerLayer` e as opções `playerRadius` e `carClearance`. O tipo de mobília passa a se chamar `FurnitureDef`. As plantas dos 12 modelos deixam de ser iguais às do porte antigo (propositalmente) e passam a conferir com a página do time.
- Updated dependencies [6314632]
- Updated dependencies [b018548]
- Updated dependencies [e755d75]
- Updated dependencies [483844f]
- Updated dependencies [35fa212]
- Updated dependencies [eeb9f4e]
  - @adatechnology/game-floorplan@0.2.0
  - @adatechnology/game-floorplan-residential@2.0.0

## 1.0.0

### Minor Changes

- 2ec2d1d: Initial release (0.1.0): market and pharmacy templates, shop catalogue and the commercial and industrial zones of the br region, ported to TypeScript with English naming and en / pt-BR locales.

### Patch Changes

- Updated dependencies [2ec2d1d]
- Updated dependencies [2ec2d1d]
  - @adatechnology/game-floorplan@0.1.0
  - @adatechnology/game-floorplan-residential@1.0.0
