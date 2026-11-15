---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-shapes': patch
'@adatechnology/game-test-room': patch
'@adatechnology/game-vehicles': patch
'@adatechnology/game-vehicles-three': patch
'@adatechnology/game-player': patch
'@adatechnology/game-characters-three': patch
---

Spec 008 (fases 1–3 até a T3.8): motor físico Jolt Physics como opção do kit, desligado por padrão.

- Pacotes novos: `game-physics` (contrato do motor, fila de despertar, medidor de custo) e `game-physics-jolt` (adaptador do Jolt). O Jolt é escolhido por `physics`; sem ele, o solver próprio segue como hoje.
- Entulho de explosão opcional (`blastDebris`): as peças despertam em lotes, com o mínimo e o máximo ajustados pelo custo medido na máquina.
- Colisores fiéis ao desenho:
  - a caixa só vale quando as faces estão cobertas;
  - se as faces não estão cobertas, a peça colide pelos triângulos (batentes e molduras não são mais placas maciças).
- Portas e janelas sem peças nascendo umas dentro das outras.
- Fiação e canos se soltam em trechos (`segmentLimits`), cortados em lajes e paredes.
- O chão é montado ao longo do caminho de peças rápidas.
- Os estilhaços de granada sorteiam por alvo: um objeto novo na cena não muda mais onde eles caem.
- A mão empurra a porta que se afasta, em vez de seguir a folha (spec 004).
