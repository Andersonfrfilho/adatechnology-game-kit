---
'@adatechnology/game-floorplan-three': patch
---

A luz de fora não atravessa mais paredes nem portas fechadas. A máscara de luz por cômodo nunca chegava ao shader (o laço das luzes pontuais mora no include `lights_fragment_begin`, que o renderer abre depois do `onBeforeCompile`): agora o include é aberto antes da troca. `effectLights` passa a tratar a luz cujo ponto não está em cômodo nenhum (poste da rua, fogo no quintal) como luz de fora: ilumina o lado de fora das casas e, dentro, só os cômodos atrás de uma janela externa ou de uma porta externa aberta voltada para ela; `update(houses, camera)` aceita a câmera para escolher as casas mais próximas. `effectLights` dá a máscara aos materiais da casa mesmo sem `lighting()`, e o preenchimento fraco ("indireta falsa") fica só com as lâmpadas dos cômodos.
