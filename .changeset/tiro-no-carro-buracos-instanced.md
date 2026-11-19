---
'@adatechnology/game-vehicles': patch
---

Um tiro de 9 mm na porta de um carro parado deixava uma chamada de desenho nova por furo, que nunca voltava: cada tiro criava uma malha de furo solta, e a sala só agrupa as malhas que já existiam no spawn. O quadro do tiro também dava um pico de 30–60 ms (o primeiro, pior), por alocar o material e a textura do furo na hora.

Os furos agora são desenhados por `InstancedMesh`: uma malha instanciada por (peça que carrega o furo × material), então uma porta cheia de furos vira uma chamada só, e o furo continua indo junto com a porta quando ela abre. N furos viram 1 chamada, não N.

Teste de regressão em `game-vehicles/tests/hole-draw-calls.test.ts` (roda no CI, sem GPU): dez tiros na porta somam dez furos e uma única chamada de desenho a mais.
