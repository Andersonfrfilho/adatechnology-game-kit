---
'@adatechnology/game-workers': minor
---

O coordenador passa a deixar 16 jobs com cada worker por padrão (`IN_FLIGHT_PER_WORKER`, era 2): uma rajada de jobs do quadro (as telhas do chão de uma explosão) não espera mais vários quadros de ida e volta pela thread principal. Medido na sala: 139 de 163 telhas atrasadas com 2, nenhuma com 16.
