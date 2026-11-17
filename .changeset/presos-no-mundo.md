---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-interactables': minor
'@adatechnology/game-interactables-household': minor
'@adatechnology/game-floorplan-three': minor
---

O que é preso no mundo real é preso no mundo da destruição: a casa carrega como um grupo só, e nada cai ou escorrega na carga. Novo tipo de junta `slide` (corrediça de gaveta, 100 de resistência, chave de fenda, 3 s) em `JointKind` e `JOINT_DEFAULTS`; as gavetas dos móveis do `game-interactables-household` passam de `clip` para `slide`. Na casa (`game-floorplan-three`), cada peça declara onde se prende (`holder`, ou `holdOn: 'floor' | 'wall'` com `holdJoint`): muro do lote e poste fincados no chão com a junta que `JOINT_BY_MATERIALS` dá contra concreto (tijolo e concreto: argamassa), soleira assentada no baldrame, portão e porta da caixa de correio na dobradiça do muro ao lado (`slide` no portão de correr), porta do box na parede do banheiro, portas e gavetas dos móveis no piso onde o móvel está (`hinge`/`slide`), eletroduto aparente grampeado na parede, botijão apoiado no piso (`resting`), cano fora da parede preso na laje em que entra; com o poste preso, a fiação pendura nele. Só cai quando essa junta quebra.
