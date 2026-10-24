# @adatechnology/game-floorplan

## 0.2.0

### Minor Changes

- 6314632: The finds of the floorplan come from the item catalog. `FloorplanOptions` takes `day` and `region` and the contents extension passes them (with `place`, `footprint` and `key`) in the query; `FindsProvider.findsFor` may return `null` ("not mine") and an empty array is now an answer, with `engine.findsAnswer` for packs that have their own default. `game-items`: `createFindsProvider` takes `placeAliases`, `poolPlaces` and `unknownContainers: 'pass'`. `game-items-goods`: `createGoodsFindsProvider(catalog)` for `engine.registerFindsProvider`, with the furniture categories of the floorplan packs bound to the house pools of the visor.
- b018548: Novo `@adatechnology/game-floorplan-rural` 0.1.0 (spec 001, T2.2f): casa de madeira americana (wood frame), chalé de montanha, cabana de troncos, barraco e camping com barracas, com estilo e paleta `rural`, bibliotecas de slots, itens, nomes en / pt-BR e a marca `region: 'br'`. As 375 plantas gravadas da página do time conferem lista por lista. O motor ganha `TemplateDef.config` (vai para `result.config`), `Plan.options` e `engine.paletteStyles`; o passe de decoração do residencial põe lampiões nos planos sem rede (`power: 'offgrid'`).
- 35fa212: Regras do Visor de casas 3D no motor de plantas (spec 001, T2.2b): raio do jogador de 0,24 m na grade de caminho, folgas de porta e janela por modelo, janelas distribuídas no trecho de parede, regra de janela com armário aéreo e box (`windowHeight`, `overhead`), vaga de carro com folga do motorista, caminho para toda porta externa, caixa de correio, abajur, estados com ao menos uma janela tapada. Novos ganchos: `registerResultExtension` (com `seedKey`), `registerFindsProvider`/`findsFor`, `registerViewerLayer` e as opções `playerRadius` e `carClearance`. O tipo de mobília passa a se chamar `FurnitureDef`. As plantas dos 12 modelos deixam de ser iguais às do porte antigo (propositalmente) e passam a conferir com a página do time.
- eeb9f4e: Silhuetas de longe (LOD) como dados de geometria, sem three (spec 001, T2.5a): `createTwoStoreyHouse`, `createSlabHouse`, `createColonialHouse`, `createChalet`, `createCompanyHouse`, `createStiltHouse`, `createFarmhouse`, `createDetachedHouse` e `createCityBuilding` devolvem as peças (caixa arredondada, prisma, cilindro, linha, placa), as janelas e a pegada de cada tipologia da Galeria do Vale Cinzento, com o mesmo gerador semeado da página. Os 16 casos conferem com o golden da galeria (hash de cena, Node 22 e 24). A cerca da casa de empresa acompanha a casa (a página a deixa na origem).

### Patch Changes

- 483844f: New package: the structure of every plan from `@adatechnology/game-floorplan` (spec 001, T2.2c). Construction systems (masonry, wood frame, log, improvised, canvas),
  `result.structure` with every part that carries load and what it rests on (foundation, floors, walls, bond beams and plates, pillars, porch posts, trusses or
  rafters, roof, stairs, water tank), `toDestructibleSpec` sized from the loads at rest so a house holds the loss of one pillar and falls with two, and the "Structure"
  layer of the 2D viewer. With `wallDetail: 'coarse'` the structure and the spec are equal to the Visor de casas 3D in 900 recorded plans.

## 0.1.0

### Minor Changes

- 2ec2d1d: Initial release (0.1.0): seeded procedural floor plan engine (plans, lots, slots, seeded fill, colour-harmony palette, state plugins, urban zoning, en / pt-BR locales) and an offline 2D viewer, ported to TypeScript with English naming.
