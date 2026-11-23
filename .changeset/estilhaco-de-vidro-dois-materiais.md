---
'@adatechnology/game-destruction-three': patch
---

O estilhaço de vidro usa dois materiais, um para as faces de trás e outro para as da frente, e desenha as de trás primeiro (no `onBeforeRender` do material da frente), como o three.js desenha um material transparente `DoubleSide`. Antes o three trocava o `side` do mesmo material duas vezes por desenho e subia o `version`, o que refazia a busca do programa (`getParameters`) em todo desenho de todo estilhaço. A sombra continua das duas faces (`shadowSide`) e o programa das faces de trás é aquecido junto com as outras peças.
