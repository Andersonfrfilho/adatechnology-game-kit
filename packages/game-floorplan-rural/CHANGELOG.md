# @adatechnology/game-floorplan-rural

## 5.0.1

### Patch Changes

- 9314e78: Typed floorplan: `Json` is now `unknown`, and the plan records (`PlanDoor`, `PlanWall`, `PlanWindow`, `PlanGate`, `LotPath`, `Lot`, `Facade`), the resolved slots, the walkability grid (`WalkGrid`), the `placeOnFloor` options and the `generate` result (`FloorplanResult`) have their own types. Template-specific fields (`config`, `building`, extension outputs) are `unknown` and narrowed by the pack that writes them. Generated plans are unchanged.

## 5.0.0

### Patch Changes

- Updated dependencies [81bd9c0]
  - @adatechnology/game-floorplan@0.3.0
  - @adatechnology/game-floorplan-residential@6.0.0

## 4.0.0

### Patch Changes

- @adatechnology/game-floorplan-residential@5.0.0

## 3.0.0

### Patch Changes

- @adatechnology/game-floorplan-residential@4.0.0

## 2.0.0

### Patch Changes

- Updated dependencies [20cc300]
- Updated dependencies [5af569f]
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-floorplan-residential@3.0.0

## 1.0.0

### Minor Changes

- b018548: Novo `@adatechnology/game-floorplan-rural` 0.1.0 (spec 001, T2.2f): casa de madeira americana (wood frame), chalé de montanha, cabana de troncos, barraco e camping com barracas, com estilo e paleta `rural`, bibliotecas de slots, itens, nomes en / pt-BR e a marca `region: 'br'`. As 375 plantas gravadas da página do time conferem lista por lista. O motor ganha `TemplateDef.config` (vai para `result.config`), `Plan.options` e `engine.paletteStyles`; o passe de decoração do residencial põe lampiões nos planos sem rede (`power: 'offgrid'`).

### Patch Changes

- e755d75: Casa de laje de 1 a 3 andares (spec 001, T2.2g): `budget_slab_house` ganha `floorRange: [1, 3]`, as opções `floors` (padrão 1, igual à página do time) e `randomFloors` (sorteio uniforme da semente), andares de cima que repetem a planta com 2 quartos e banheiro, escada externa reta na margem esquerda (`result.config.sideStair`) e esperas de vergalhão na laje do topo em 60% das casas. O barraco do pacote rural marca a ligação clandestina (`gato`) em `result.config.power: 'tap'`.
- Updated dependencies [6314632]
- Updated dependencies [b018548]
- Updated dependencies [e755d75]
- Updated dependencies [483844f]
- Updated dependencies [35fa212]
- Updated dependencies [eeb9f4e]
  - @adatechnology/game-floorplan@0.2.0
  - @adatechnology/game-floorplan-residential@2.0.0
