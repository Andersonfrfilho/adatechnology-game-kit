---
"@adatechnology/game-destruction": minor
"@adatechnology/game-destruction-three": minor
"@adatechnology/game-vfx": minor
"@adatechnology/game-floorplan-three": patch
---

A quina de pilar e parede quebra como obra:

- `game-destruction`: um membro moldado (peça com `reinforcement`) dentro da caixa de uma parede de unidades (o pilar que fecha a ponta da parede, a verga, a cinta) tira da parede os tijolos daquele lugar, e o tiro, o golpe e o raio que caem ali (também no reboco por cima) vão para o membro.
- `game-vfx`: `PIECES_DRAWN_VARIABLE`; com ela os efeitos de rombo e desabamento soltam só a poeira, sem os blocos de enfeite (até 1 m) que jogam numa cena sem pedaços de verdade.
- `game-destruction-three`: os efeitos de evento vão com `piecesDrawn` (o renderer já desenha os pedaços); `BindOptions.marksOn` põe as marcas de uma peça sem malha própria nas malhas das peças que a desenham.
- `game-floorplan-three`: o pilar sem malha própria leva as marcas nas paredes em que está.
