---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
---

Os tijolos que saem inteiros de uma parede caem na cor do tijolo, e não mais como placas laranja. Os blocos de uma parede de unidades assentadas se soltam pelas juntas, então a face deles é a do próprio tijolo, não o miolo quebrado. O fragmento ganhou `unit` e o material ganhou `visual.unitColor` (no tijolo, o mesmo vermelho dos tijolos que a parede mostra), e o renderizador usa essa cor. O concreto moldado continua com a cor do miolo.
