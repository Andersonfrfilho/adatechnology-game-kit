# @adatechnology/game-floorplan-commercial

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
