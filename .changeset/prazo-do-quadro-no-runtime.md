---
'@adatechnology/game-runtime': minor
'@adatechnology/game-contracts': minor
---

`game-runtime`: o orçamento do quadro ganha o modo de prazo, opcional por quadro. Com `targetMs` (opção do agendador ou `budget.targetMs`, mutável) e `FrameRunOptions.frameStartMs` (o `startLoop` passa o horário do `requestAnimationFrame`), as filas recebem o que sobra até o prazo menos a média móvel do render, entre o piso (`minBudgetMs`) e o teto (`budgetMs`), sem dívida. Quadro sem `frameStartMs` (headless, `advance`, testes) segue na cota de antes. `budget.stats()` ganha `mode`, `allowanceMs`, `renderEstimateMs`, `mustDrainSpentMs`, `overMs`, `forcedThisFrame` e `forcedMs`; `QueueStats` ganha `lastSpentMs` e `mustDrain`; `budget.skipRenderSample()` e `budget.recordRender()`. `game-contracts`: `DeferredQueueOptions.mustDrain` (fila que drena inteira fora do prazo).
