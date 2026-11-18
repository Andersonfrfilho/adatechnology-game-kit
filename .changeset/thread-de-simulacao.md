---
'@adatechnology/game-workers': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-crowd': minor
'@adatechnology/game-crowd-three': minor
---

Thread de simulação (spec 009, T22): `installSimThread`, `startSimThread` e `runSimInline` no `game-workers`, com memória compartilhada sem espera na página (buffer triplo de retratos e anel de comandos); `SimModule` no `game-contracts`; a horda como módulo (`hordeSimModule`) no `game-crowd`; a bancada da multidão com `hordeThread`. `run` de uma categoria `sim` sem worker roda no quadro principal (a thread de simulação aguarda os jobs).
