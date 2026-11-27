---
"@adatechnology/game-player": patch
"@adatechnology/game-test-room": patch
---

Andar não arrasta móvel pesado (T8.1). `game-player`: `PLAYER_WALK_PUSH_NEWTONS` (100 N, a ordem da força de empurrar sustentada da ISO 11228-2 para um homem). `game-test-room`: o corpo da sala usa essa força como `strength` do walker (`EngineBody.pushNewtons`), de modo que um sofá de 28 kg (atrito 115 N) para o jogador e uma cadeira leve cede; a caminhada por `moveBy` registra o esbarrão (`bump`) como no `own`.

`game-player`: `footRestHeight` (o repouso de um pé redondo sobre o chão). `game-test-room`: o teleporte do jogador no motor põe o corpo onde a cápsula de fato repousa (bacia côncava: alguns milímetros acima do centro), não onde o chão está no centro.
