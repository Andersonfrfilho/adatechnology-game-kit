---
'@adatechnology/game-destruction-three': patch
---

Os estilhaços desenhados em instância usam um material próprio (um gêmeo por material de estilhaço, copiado de novo quando o material é marcado para atualizar e liberado no `dispose`), em vez de dividir o material com a malha comum do mesmo estilhaço e com os lotes. Com o material dividido, o three.js refazia a chave do programa (`getProgram`) a cada desenho que alternava malha comum e instância.
