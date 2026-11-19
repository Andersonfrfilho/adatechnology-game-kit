---
'@adatechnology/game-contracts': patch
'@adatechnology/game-destruction': patch
'@adatechnology/game-test-room': patch
---

O tiro num veículo não percorre mais a cena inteira para achar a normal da superfície. `DestructionWorld.shoot` agora devolve a normal traçada (`HitResult.normal`, da `surfaceRay` do corpo) e a sala usa essa normal para o empurrão do tiro, em vez de re-raycastar todos os triângulos do corpo — o quadro do tiro na porta de um sedã caía de ~24 ms para ~2 ms.

A faísca do impacto (`impact_*`) entra no aquecimento da sala, então o primeiro tiro não paga os buffers da faísca em jogo.
