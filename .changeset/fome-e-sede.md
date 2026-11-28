---
'@adatechnology/game-player': minor
'@adatechnology/game-test-room': minor
---

Fome e sede do jogador, e o efeito dos itens no corpo.

- `game-player`: porte do `needs` do jogo do time (fome e sede de 0 a 100, começam em 20, sobem no relógio do jogo, mais rápido correndo e mais devagar com vigor alto; acima de 90 tiram vida até a morte por fome e sede). `player.use(efeito)` aplica o efeito que o catálogo resolveu: comida e bebida pela saciedade e hidratação do item, analgésico cura, curativo estanca, álcool limpa a ferida, calmante tira o pânico. `createBodyVitals` dá o mesmo corpo a quem não usa `createPlayer`; o HUD ganha as barras de fome e sede e `createVitalsPanel` mostra a caixa do corpo sozinha.
- `game-test-room`: a sala tem esse corpo. Comer, beber (pelo litro e pela sede do líquido), tomar remédio e fazer curativo mudam vida, fome e sede; a caixa do corpo fica no canto de baixo à esquerda e a legenda diz quanto cada uma mudou (fome 20 → 12).
