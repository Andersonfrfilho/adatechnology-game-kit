---
'@adatechnology/game-terrain': patch
'@adatechnology/game-contracts': minor
'@adatechnology/game-urban': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-test-room': minor
---

A cratera de uma carga no chão usa a energia real da carga. Os `specificEnergy` do solo são de joules reais (1 kg de TNT = 4,184 MJ; a granada de 800 kJ, a carga de contato de 4,2 MJ), mas o mundo de destruição entregava ao terreno o `energy` da escala de dano do arsenal (0,24 kg = 200 kJ): toda cratera saía com 1/5 da energia. `applyHit` explosivo agora lê `hit.tnt` (que o mundo sempre preenche) vezes `TNT_JOULES` (exportado de `game-contracts`); sem `tnt`, segue o `energy`. O PG-7V (0,45 kg) passa de 0,19 m para 0,39 m de fundo no solo do quintal.

Os canos enterrados da casa (esgoto da NBR 8160 e águas pluviais da NBR 10844) quebram com cratera como a rede da rua: `createHouseBuriedPipes` (`game-floorplan-three`) lê o estágio de instalações e pergunta a `breachOf` de `game-urban`; o cano que a bacia alcança aparece no buraco, o que ela corta até a linha de centro quebra (vão) e vaza (`leakOfPipe`, novo em `game-urban`). `ModuleHost` ganha `onCrater` e `addTap` (`HostTap`), que a sala implementa com o terreno e o `game-fluids`; a área de casas liga os dois.
