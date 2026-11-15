---
'@adatechnology/game-destruction-three': patch
---

`game-destruction-three`: o terreno que assenta (entulho que sobe o chão alguns mm) não levanta mais uma peça solta que só o toca por uma ponta. Antes, `EnginePieces.groundChanged` erguia a peça inteira pelo tanto que o canto de uma caixa ficava sob o chão novo, a partir de 5 mm e sem velocidade; o poste de 1 t, cuja ponta de fio de 11 m encontrava o entulho, ganhava de graça massa x g x subida (6 a 8 kg·m por atualização, o C1 da sala). Até 1 cm o contato do motor resolve a sobreposição sozinho; só uma subida maior é erguida pelo kit, como antes.
