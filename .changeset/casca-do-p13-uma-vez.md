---
'@adatechnology/game-weapons-three': minor
---

A casca do P13 que voa na explosão é montada uma vez: `createWorldExplosiveShells(THREE, defId, items)` devolve cópias que dividem as geometrias e os materiais do modelo gasto (marcados como compartilhados; `discardObject3D` de uma cópia não libera nenhum deles, `dispose()` libera). A bancada de explosivos monta o modelo ao receber a sala e voa uma cópia em cada explosão, em vez de montar o modelo e materiais novos a cada uma.
