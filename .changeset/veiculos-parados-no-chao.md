---
'@adatechnology/game-vehicles': patch
'@adatechnology/game-vehicles-three': patch
---

Os veículos da sala repousam no chão no motor Jolt: helicópteros e aviões não tombam mais sobre a cauda, ônibus não empinam e os blindados não afundam.

- O centro de massa e os momentos do chassi passam a ser calculados no quadro do corpo (`partsInFrame`): as peças do modelo estão no espaço do desenho, que é girado
  um quarto de volta dentro da raiz, e o centro de massa caía de lado. A caixa do atropelamento (`runOverHalfOf`) usava os mesmos eixos trocados.
- Um cilindro por pneu desenhado (`tyreBoxesOf`), não um em volta da peça: o pneu de um eixo inteiro do ônibus e os seis pneus de um lado do 6x6 viravam um disco de
  1,2 a 2,3 m de raio que enterrava no chão. O raio é a metade da altura do pneu, medida pelos vértices.
- O chassi sintético (veículo sem zona de assoalho, como helicópteros e aviões) carrega o peso sobre o que o veículo pisa (`massCentre`, medido por `supportSpanOf`:
  esquis, trem de pouso, rodas), não no meio do comprimento inteiro com a cauda.
- O corpo nasce sobre o apoio: um pneu desenhado abaixo da origem da raiz não começa dentro do chão (não é cuspido nem amassa o carro no primeiro passo).
