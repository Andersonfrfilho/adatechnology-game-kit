---
'@adatechnology/game-destruction-three': patch
---

O empurrão que acaba com o equilíbrio de uma peça em base estreita passa a ser limitado pela inércia real dela (`holdPush`). A conta antiga tratava a peça como um
ponto: numa tábua deitada que toca o chão por um ponto durante um instante, as duas distâncias eram milímetros e o empurrão ia a milhares de rad/s² (uma tábua de
20 kg saía do repouso para 8 rad/s num quadro, sem ser atingida). A perna de 5 cm em pé continua tombando como antes.

O empurrão que começa o tombo do móvel que ficou em pé sobre pouco (`goOverIfBalanced`) é dado até onde a peça alcança naquela direção, não pelo seu maior lado: a
mesa comprida que tombava pela largura era empurrada a metros do próprio meio e saía girando (19,5 rad/s num quadro numa mesa de 4,4 m). Vale para toda peça: o
teste `broken-catalogue-spin` quebra cada móvel do catálogo parte por parte, em três tamanhos, e reprova a peça parada que ganha giro na quebra.
