---
'@adatechnology/game-player': minor
'@adatechnology/game-test-room': patch
---

O corpo que anda em passos fixos deixa de tremer: `createStepPose` (game-player) guarda os dois últimos passos e mistura pelo `alpha` do agendador, e o distrito de referência desenha o corpo e a câmera por ele (a 144 Hz o corpo andava 0 ou 2 passos por quadro, variação de 118% na velocidade desenhada). Na sala, o braço da câmera em terceira pessoa volta a se afastar da parede (o `dt` da recuperação era sempre 0) e o olho sobe uma soleira ou borda de laje em poucos quadros, em vez de um salto de 4,5 cm.
