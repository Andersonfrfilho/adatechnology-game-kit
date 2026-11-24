---
'@adatechnology/game-test-room': patch
---

A sala de teste monta o mundo pelo host do kit (`createKitWorldSync` de `@adatechnology/game-kit-defaults/world`, spec 011 T1.5): renderizador, cena, câmera, sol, chão, destruição, fluidos, som, efeitos, orçamento de desenho, agendador, filas, marca-passo e laço vêm do host, na mesma ordem. Saem as cópias da sala (`blast-pacing.ts`, `simulation-phases.ts`, `frame-queues.ts`, `sun-shadow.ts`, `graphics.ts`) e o sol do `arena.ts`. `TestRoomOptions` e `TestRoom` não mudam; `RoomGraphicsOptions` passa a ser o `KitWorldGraphicsOptions` do host.
