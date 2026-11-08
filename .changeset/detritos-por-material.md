---
'@adatechnology/game-destruction': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-destruction-three': patch
---

O que cada material solta em tiro e explosão vem do material: `debrisLook`, `debrisFamily`, `debrisColor`, `dustColor` e `fragmentTone` (game-destruction) dizem, para cada material e evento (tiro, spall, estágios 1 a 3, ferragem exposta, fratura, explosão, colapso), o tipo de detrito, a cor, a poeira e a marca. Os efeitos de estágio e colapso do game-vfx passam a ser por família (`stage_crack_<família>`, `breach_dust_<família>`, `collapse_dust_<família>`, com `debrisColor`/`dustColor` em `values`), e `rebar_expose` solta lascas e pó de concreto com ferrugem em vez de lascas de madeira. O renderer passa a família e a cor da peça a esses efeitos, lança o estágio 1 do ponto do tiro (não da raiz do objeto) e pinta os detritos de fratura na cor do material. Antes, um tiro de AK na viga de concreto soltava lascas marrons de madeira.
