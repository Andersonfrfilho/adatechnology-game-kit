---
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-vegetation-three': patch
---

A peça que sai de um objeto (no carregamento, desde o #339, ou num golpe) é marcada como desenhada por `game-destruction-three` (`kind: 'piece'`): a auditoria "de onde vem cada peça desenhada" deixa de ver as peças feitas na carga como desenho sem origem. Os cenários da vegetação contam só os pedaços que saíram da própria planta: a pia e outros móveis da sala com um grupo solto na carga também criam `obj_N`, e o tiro de 9 mm e a cerca viva falhavam por contá-los.
