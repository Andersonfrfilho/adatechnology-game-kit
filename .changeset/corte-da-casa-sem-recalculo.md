---
'@adatechnology/game-destruction-three': minor
---

O quadro que corta a casa em peças deixa de recalcular o que não mudou, sem mudar o resultado. As caixas que `fitOrientedBoxes` ajusta a uma parte desenhada por uma faixa de uma malha unida são ajustadas antes do golpe, uma parte por vez, com no máximo 1 ms de cada quadro, e guardadas com os pontos e triângulos de onde saíram: quando a parte rompe, o corte lê as mesmas caixas (os mesmos números, bit a bit) em vez de ajustá-las; se o desenho mudou (um amassado), ajusta de novo. O cache é solto com o objeto (`unbind`, `dispose`). O hospedeiro da malha unida é reescrito uma vez por lote de `splitLoose`, não uma por peça.

`RendererOptions.fitBoxesAhead` (padrão ligado): desligado, as caixas são ajustadas quando a parte rompe, como antes.
