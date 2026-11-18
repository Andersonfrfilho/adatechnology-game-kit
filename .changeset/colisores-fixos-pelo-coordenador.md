---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-kit-defaults': minor
---

Colisores fixos pelo coordenador de workers (spec 009, T10): `staticCollidersKind` (`destruction.static-colliders`, faixa `build`) com o núcleo puro `measureStaticPart`, que agora mede também no quadro principal; `RendererOptions.workers` (e `debris.workers` na sala) entrega as peças ao coordenador, opt-in porque a medida da sala não pagou. O preset hospeda a categoria.
