# @adatechnology/game-urban-three

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
