---
'@adatechnology/game-vegetation-three': minor
---

Novo pacote `game-vegetation-three` (spec 001, T7.2c): `createVegetationTestModule` e `loadVegetationTestModule` põem na sala as 18 plantas do módulo do Viveiro (mangueiras de três tamanhos, ipê, coqueiro, bananeira, araucária, árvore morta, hibisco, cerca viva, rosa, girassol, três cactos, dois vasos, touceira) como itens do mundo de destruição padrão, com uma malha por peça, espessura real da madeira, juntas, âncoras e o clipe de vento, e as 13 provas `veg_*` da página do time, literais (machado nos troncos de 15 e 30 cm, junta tronco-galho, serra, machete, faca, 9 mm, isqueiro, caminhada na grama). A bancada planta o canteiro de 12 x 20 m (`scatterRulesFor` + `scatter` + `buildLot`) com semente, qualidade, detalhe, condição e estação, regula o vento e liga o caminhante que dobra as plantas; camadas de colisores, caixas das peças e eixos da madeira. `examples/vegetation-test-area` e o módulo também na `interactables-test-area`.
