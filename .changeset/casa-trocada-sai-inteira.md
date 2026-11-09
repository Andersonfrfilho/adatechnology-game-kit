---
'@adatechnology/game-vfx': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-three': patch
'@adatechnology/game-test-room': patch
---

Trocar a planta na bancada de casas não deixa mais nada da casa anterior no mundo. Os pedaços que se soltaram dela continuavam no mundo da destruição (invisíveis, colidindo e queimando), com o fogo, os fragmentos, as marcas no chão e as partículas que eram deles; a sala os guardava na lista de peças soltas.

- `game-vfx`: `FireOptions.source`, `ExplosionOptions.source` e `SpriteSpawnOptions.source` dizem para quem um efeito foi feito, e `VfxWorld.clearSource(source)` tira de uma vez o fogo, as chamas, a fumaça, as brasas, o que a explosão jogou e os sprites dele.
- `game-destruction-three`: os efeitos que o renderer faz para um objeto levam o id dele; `release(objectId)` tira do mundo os pedaços que se soltaram do objeto e todos os efeitos dele e dos pedaços (fogo, som do fogo, vazamentos, eventos na fila, fragmentos, marcas, ferragem, partículas), e desfaz a ligação; `releasePieces(objectId)` faz o mesmo mantendo a ligação (reset). `onReleased` avisa o host dos pedaços que saíram.
- `game-floorplan-three`: a casa descartada (`dispose`, troca de planta, `clear`) chama `release`, e o `reset` chama `releasePieces`; a vista de rombo libera as formas dos tijolos ao sair.
- `game-test-room`: a sala esquece os pedaços que o renderer soltou.
