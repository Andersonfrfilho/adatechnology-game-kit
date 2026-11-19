---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-render-three': minor
'@adatechnology/game-fluids-three': minor
'@adatechnology/game-crowd': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-destruction': patch
---

Spec 010, fases 1 e 3: passo fixo único e filas no prazo do quadro.

- `game-physics`: `PhysicsLoop.stepFixed(steps)` roda passos inteiros vindos do agendador (`step(dt)` continua, com o próprio acumulador). **Quebra para quem implementa `PhysicsWorld`:** o membro `readActiveBodies(out)` passa a ser obrigatório (devolve só os corpos acordados).
- `game-physics-jolt`: implementa `readActiveBodies`.
- `game-render-three`: `createStaticBatchQueue` e a opção `queue` dos lotes estáticos, para o orçamento do quadro drenar a junção dos lotes.
- `game-fluids-three`: `FilmManager.deferredQueue()`, a fila do filme de líquido no prazo do quadro; o tempo devido de um grid que sai é esquecido junto com ele.
- `game-crowd`: o campo de fluxo passa a andar em células por passo (`cellsPerStep`) por padrão, não pelo relógio; `flow.ms` vale 0. Mesmo resultado em toda máquina.
- `game-destruction-three`: `DestructionRenderer` ganha `interpolate`, `present`, `restoreStepPose`, `markMoved` e `deferredQueues` (desenho interpolado entre passos e filas registradas no orçamento); uma peça segurada pelo host (empurrar, carregar) é lida mesmo com o motor a dando como dormindo.
- `game-test-room`: opção `frameTargetMs` (prazo do quadro); a pose do passo volta antes da fase `input`, para empurrar e carregar escreverem na pose do passo, não no desenho misturado do quadro anterior.
- `game-destruction`: uma operação que lança exceção não passa estrutura e `detach` pela metade para a seguinte.
