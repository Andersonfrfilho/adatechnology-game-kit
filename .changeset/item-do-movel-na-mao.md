---
'@adatechnology/game-contracts': minor
'@adatechnology/game-interactables': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-test-room': minor
---

O item tirado de um móvel vai para a mão: `ModuleHost.takeInHand` (`HostTakenItem`) leva o item com as mãos que ele pede; o `take` de um item guardado diz qual é (`Interactable.itemType`); a área de casas entrega o item ao apertar E, e a sala fecha a mão nele com a regra de mãos e coldre (uma mão: a arma fica na outra). A sala passa a respeitar as mãos que a peça pede em vez de deduzi-las da massa.
