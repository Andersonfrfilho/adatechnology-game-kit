# @adatechnology/game-floorplan-residential

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
