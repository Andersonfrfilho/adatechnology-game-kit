---
'@adatechnology/game-destruction-three': patch
---

Um fragmento parado (tijolo, lasca, pedaço de reboco) só segura o que está sobre a área de chão que ele de fato cobre: o teste de apoio (`pileUnder`) passou da caixa que o envolve (muito maior para um pedaço comprido virado de lado) para o casco convexo dos oito cantos visto de cima. Antes, um pedaço pequeno ficava dormindo no ar sobre o canto vazio da caixa de outro.
