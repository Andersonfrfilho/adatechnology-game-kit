---
'@adatechnology/game-floorplan': minor
'@adatechnology/game-floorplan-residential': minor
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-interactables': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-interactables': minor
'@adatechnology/game-interactables-household': patch
'@adatechnology/game-interactables-three': minor
'@adatechnology/game-items-three': minor
---

Móveis sem z-fighting e layout com o espaço real de cada coisa: sofá, geladeira e cuba (e mais 14 móveis do household) sem faces no mesmo plano; portas e gavetas com a faixa de abertura livre (`opening`); criado-mudo ao lado da cabeceira (`beside`), também na edícula; quadro de luz, tomadas e interruptores com a caixa real na parede; cano de gás por cima das portas; gabinete ao lado da pia na altura do tampo; vaso de planta com a copa até onde a parede deixa; cabo só em tomada do mesmo lado da parede.

Plafon apagado em vidro branco leitoso, aceso emissivo. Conteúdo de gavetas, portas e prateleiras desenhado com o item real do catálogo (`createContainedItemModel`, `createContentsView`, `interactives.itemModel`), filho da parte que o leva desde o primeiro quadro, e cada item pegável com uma mão (`take` com `hands: 1`).

Os goldens do Visor de casas 3D e do adaptador da equipe seguem iguais com `visorLayout` (planta) e `visor` (adaptador).
