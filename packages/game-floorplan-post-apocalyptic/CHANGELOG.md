# @adatechnology/game-floorplan-post-apocalyptic

## 2.0.0

### Minor Changes

- 35fa212: Regras do Visor de casas 3D no motor de plantas (spec 001, T2.2b): raio do jogador de 0,24 m na grade de caminho, folgas de porta e janela por modelo, janelas distribuídas no trecho de parede, regra de janela com armário aéreo e box (`windowHeight`, `overhead`), vaga de carro com folga do motorista, caminho para toda porta externa, caixa de correio, abajur, estados com ao menos uma janela tapada. Novos ganchos: `registerResultExtension` (com `seedKey`), `registerFindsProvider`/`findsFor`, `registerViewerLayer` e as opções `playerRadius` e `carClearance`. O tipo de mobília passa a se chamar `FurnitureDef`. As plantas dos 12 modelos deixam de ser iguais às do porte antigo (propositalmente) e passam a conferir com a página do time.
- a8ec404: Tenda de triagem militar (spec 001, T2.5e): modelo `triage_tent` (16 x 10 m, lados LIMPO e MORDIDO de 8 x 10 m com seis catres cada, seis caixas médicas e o cavalete de fuzis), estilo `military_camp` com paleta própria, `place: 'triage'`, construção `canvas` e `triageFindsHints` (os pinos de achado da galeria). Registrado por `register(engine)`; é modelo, não estado, porque a tenda não tem prédio hospedeiro.

### Patch Changes

- b018548: Novo `@adatechnology/game-floorplan-rural` 0.1.0 (spec 001, T2.2f): casa de madeira americana (wood frame), chalé de montanha, cabana de troncos, barraco e camping com barracas, com estilo e paleta `rural`, bibliotecas de slots, itens, nomes en / pt-BR e a marca `region: 'br'`. As 375 plantas gravadas da página do time conferem lista por lista. O motor ganha `TemplateDef.config` (vai para `result.config`), `Plan.options` e `engine.paletteStyles`; o passe de decoração do residencial põe lampiões nos planos sem rede (`power: 'offgrid'`).
- Updated dependencies [6314632]
- Updated dependencies [b018548]
- Updated dependencies [483844f]
- Updated dependencies [35fa212]
- Updated dependencies [eeb9f4e]
  - @adatechnology/game-floorplan@0.2.0

## 1.0.0

### Minor Changes

- 2ec2d1d: Initial release (0.1.0): fortified and abandoned house states as a state plugin, with their items, flags and a configurable seed distribution, plus the ported property test suite.

### Patch Changes

- Updated dependencies [2ec2d1d]
  - @adatechnology/game-floorplan@0.1.0
