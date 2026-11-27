---
"@adatechnology/game-destruction-three": patch
"@adatechnology/game-kit-defaults": patch
"@adatechnology/game-test-room": patch
---

Quatro defeitos do caminho do motor, achados ao tirar o `own` dos testes de sala. `game-destruction-three`: uma peça fixa que passa de caixa a malha (a chapa que entorta) ia para o lugar da caixa mais o centro dela, longe do que está desenhado (`EngineStatics.reshape` põe a malha na origem); o broad phase dos raios também encontra a caixa em volta das malhas de um objeto (uma copa de folhas fica até 1,2 m abaixo da caixa que o mundo testa, e o raio que só toca a caixa não achava o objeto); `heldIgnores` novo (opção do renderer e das peças): o corpo que a peça na mão atravessa. `game-kit-defaults`: `debris.heldIgnores` repassa a opção. `game-test-room`: o que o jogador carrega atravessa o corpo dele (uma peça mais larga que o alcance do braço o empurrava para fora), e as coisas que nascem sem posição se espalham em fileiras de cinco (a sexta em diante nascia em cima da primeira). Sem motor (`own`) nada muda.
