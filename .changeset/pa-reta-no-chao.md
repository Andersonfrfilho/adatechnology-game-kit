---
"@adatechnology/game-physics": patch
"@adatechnology/game-physics-jolt": patch
"@adatechnology/game-destruction-three": patch
"@adatechnology/game-test-room": patch
---

Uma peça de várias partes repousa reta no Jolt (T8.1). `game-physics`: `BodyDesc.keepPartContacts` (o corpo mantém os pontos de contato de cada parte, em vez de o motor juntar os das partes num remendo dos quatro melhores: uma lâmina a 11 mm do chão escondia os pontos do cabo e a pá afundava 7 mm). `game-physics-jolt`: a opção liga-se por corpo. `game-destruction-three`: o corpo de uma peça de mais de uma parte a pede. `game-test-room`: o chute das peças leves (`kickLight`) também vale com o motor. Sem motor (`own`) nada muda.
