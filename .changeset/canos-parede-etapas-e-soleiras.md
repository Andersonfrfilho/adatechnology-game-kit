---
'@adatechnology/game-floorplan-three': patch
---

Os canos escondidos na parede da casa feita por etapas (`constructionStages`, a casa da sala) saem em trechos como os da casa comum, e a soleira da porta de fora deixa de nascer dentro de quem a cerca.

Canos: o traçado de cada cômodo era uma só peça escondida (uma caixa de 8 m por dentro de paredes e móveis, que o motor empurrava para fora por segundos). Agora a casa por etapas e a comum usam o mesmo `layWallRun`: cortado em cada laje e parede que atravessa e em `segmentLimits.pipe`, um trecho por peça, `hostedIn` a laje ou parede em que está (um furo ali o mostra), preso por ela ou pelo trecho ao lado e ligado ao anterior, os 3 kg do traçado divididos pelo comprimento. `segmentLimits.pipe: Infinity` continua desenhando o traçado inteiro (golden do time). `drawnEnds` passa para `utilities/segments.ts` e é dividido com os drenos.

Soleira: nascia 4 cm dentro do chão e 1,4 cm dentro dos pilares, das vigas e dos batentes. Agora ocupa só o vão entre os batentes e livre das paredes, pilares e vigas, assenta no chão, com a base à altura da calçada.
