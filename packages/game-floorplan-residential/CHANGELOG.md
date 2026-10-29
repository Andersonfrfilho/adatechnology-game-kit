# @adatechnology/game-floorplan-residential

## 4.0.0

### Patch Changes

- Updated dependencies [5b69fc2]
  - @adatechnology/game-floorplan-structure@1.2.0

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

## 2.0.0

### Minor Changes

- b018548: Novo `@adatechnology/game-floorplan-rural` 0.1.0 (spec 001, T2.2f): casa de madeira americana (wood frame), chalé de montanha, cabana de troncos, barraco e camping com barracas, com estilo e paleta `rural`, bibliotecas de slots, itens, nomes en / pt-BR e a marca `region: 'br'`. As 375 plantas gravadas da página do time conferem lista por lista. O motor ganha `TemplateDef.config` (vai para `result.config`), `Plan.options` e `engine.paletteStyles`; o passe de decoração do residencial põe lampiões nos planos sem rede (`power: 'offgrid'`).
- e755d75: Casa de laje de 1 a 3 andares (spec 001, T2.2g): `budget_slab_house` ganha `floorRange: [1, 3]`, as opções `floors` (padrão 1, igual à página do time) e `randomFloors` (sorteio uniforme da semente), andares de cima que repetem a planta com 2 quartos e banheiro, escada externa reta na margem esquerda (`result.config.sideStair`) e esperas de vergalhão na laje do topo em 60% das casas. O barraco do pacote rural marca a ligação clandestina (`gato`) em `result.config.power: 'tap'`.
- 35fa212: Regras do Visor de casas 3D no motor de plantas (spec 001, T2.2b): raio do jogador de 0,24 m na grade de caminho, folgas de porta e janela por modelo, janelas distribuídas no trecho de parede, regra de janela com armário aéreo e box (`windowHeight`, `overhead`), vaga de carro com folga do motorista, caminho para toda porta externa, caixa de correio, abajur, estados com ao menos uma janela tapada. Novos ganchos: `registerResultExtension` (com `seedKey`), `registerFindsProvider`/`findsFor`, `registerViewerLayer` e as opções `playerRadius` e `carClearance`. O tipo de mobília passa a se chamar `FurnitureDef`. As plantas dos 12 modelos deixam de ser iguais às do porte antigo (propositalmente) e passam a conferir com a página do time.

### Patch Changes

- Updated dependencies [6314632]
- Updated dependencies [b018548]
- Updated dependencies [483844f]
- Updated dependencies [35fa212]
- Updated dependencies [eeb9f4e]
  - @adatechnology/game-floorplan@0.2.0

## 1.0.0

### Minor Changes

- 2ec2d1d: Initial release (0.1.0): ten residential templates, furniture catalogue, slot libraries, decor pass and the br region with Brazilian zones, ported to TypeScript with English naming and en / pt-BR locales.

### Patch Changes

- Updated dependencies [2ec2d1d]
  - @adatechnology/game-floorplan@0.1.0
