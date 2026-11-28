---
'@adatechnology/game-shapes': minor
'@adatechnology/game-interactables-three': minor
'@adatechnology/game-destruction-three': minor
---

A colisão vem das primitivas que o construtor desenha (spec 019). `generate({ solids: true })` lista em cada lote os sólidos de que ele foi assado
(`ShapeBatch.solids`: a caixa de cada primitiva, girada como foi desenhada); o mesh api do `game-interactables-three` grava a lista em
`mesh.userData.solids`; e o `game-destruction-three` segura a malha por ela, fixa e solta, sem ler vértice. Uma peça desenhada em volta do ar (casinha,
banco de pernas, pia) deixa de colidir como a caixa em volta de tudo. Malha sem a lista (casa, veículo) segue pelo caminho de antes.
