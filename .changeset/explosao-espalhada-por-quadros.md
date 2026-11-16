---
'@adatechnology/game-physics': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

O trabalho que uma explosão deixa (grupos soltos a cortar em peças, fragmentos a soltar, entulho a acordar) pode correr num orçamento de quadro em **unidades de trabalho**, nunca em tempo (spec 008, T3.8aa). Desligado por padrão: sem a opção nada muda.

`game-physics`: `WorkBudget` (o árbitro: `budgetMs` × `unitsPerMs` / `tier` unidades por quadro, padrões 4 ms, 100 e 1, e `maxWaitFrames` 12, decisão do dono em 2026-11-16), `WorkQueue` (trabalho guardado como dado, por prioridade e chave estável, ao menos um por quadro, o que esperou o teto sai de qualquer jeito; salva e carrega) e `WORK_KINDS` (a ordem fixa em que as filas tiram do orçamento). `WakeQueue.release` aceita `limit`.

`game-destruction-three`: `RendererOptions.workBudget` (`ExplosionWorkOptions`: as opções do `WorkBudget` mais `costs`, padrões em `WORK_UNIT_DEFAULTS`). Os eventos aplicam no próprio quadro (clarão, poeira, trincas); cada grupo solto espera numa fila, o mais perto do `focus` primeiro, desenhado e sólido no objeto até a vez dele; fragmentos e a fila de despertar tiram do mesmo orçamento. `splitWorkUnits` estima o custo de um corte pelo tamanho do trabalho, sem contar caixas já ajustadas.

`game-test-room`: `debris.workBudget` (o jogador é a câmera); a página da sala lê `?workBudget=4`.
