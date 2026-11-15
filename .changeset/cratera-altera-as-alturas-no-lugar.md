---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-destruction-three': patch
---

No modo Jolt, o chão que se deforma passa a ter as alturas do ladrilho alteradas no lugar, em vez de refazer o ladrilho todo. O chão resultante é o mesmo de um ladrilho recém-assentado.

`game-physics`: `PhysicsWorld.updateHeights(id, region, heights)` e o tipo `HeightRegion`. Troca no lugar as alturas de um retângulo de um corpo estático de campo de alturas; devolve `false`, sem mudar nada, quando a engine não pode (não é campo de alturas, retângulo fora dele, altura fora da faixa com que o campo foi feito), e quem chama dá ao corpo uma forma nova (`setShape`).

`game-physics-jolt`: `JoltWorld.updateHeights` sobre `HeightFieldShape::SetHeights`, com o retângulo alargado ao bloco do Jolt, as amostras acrescentadas escritas dos valores exatos (nunca relidas), a memória do wasm liberada e o broadphase avisado. O Jolt também requantiza os blocos à esquerda e acima dos escritos (até 4,4e-5 m por escrita, 1,8 mm em 50): quem escreve o mesmo campo várias vezes refaz a forma de vez em quando.

`game-destruction-three`: o ladrilho marcado por `groundChanged` lê de novo só as amostras da região avisada (mais 25 cm), não toca no motor se nada ali mudou, escreve no campo só o retângulo que mudou (até metade do campo, quatro vezes seguidas; depois a forma é refeita dos valores exatos) e refaz o sólido sob o campo só quando as alturas mudaram.
