---
'@adatechnology/game-floorplan-residential': minor
'@adatechnology/game-floorplan-rural': patch
---

Casa de laje de 1 a 3 andares (spec 001, T2.2g): `budget_slab_house` ganha `floorRange: [1, 3]`, as opções `floors` (padrão 1, igual à página do time) e `randomFloors` (sorteio uniforme da semente), andares de cima que repetem a planta com 2 quartos e banheiro, escada externa reta na margem esquerda (`result.config.sideStair`) e esperas de vergalhão na laje do topo em 60% das casas. O barraco do pacote rural marca a ligação clandestina (`gato`) em `result.config.power: 'tap'`.
