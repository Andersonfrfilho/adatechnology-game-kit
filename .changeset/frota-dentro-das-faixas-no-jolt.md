---
"@adatechnology/game-physics-jolt": minor
"@adatechnology/game-vehicles-driving": minor
"@adatechnology/game-vehicles-proving": minor
"@adatechnology/game-vehicles-fleet": minor
---

A frota terrestre inteira fica dentro das faixas do banco de provas no Jolt (T6.2d): o adaptador reparte o torque do motor entre diferenciais e esteiras, mistura o atrito roda-chão pelo produto no pico (só nas rodas do veículo) e a esteira pede torque pleno para girar no lugar; a ficha ganha `physicsTorqueScale` (`PHYSICS_TORQUE_SCALE`), o tanque a potência real de um carro de combate e o ciclista a potência constante; a faixa do giro de esteira começa em 0 e a da bicicleta é a dos ciclistas reais (`accelerationSpanByType`); `FLEET_PHYSICS_SOURCES` guarda as fontes. O fator 1,3 da potência das motos saiu da ficha.
