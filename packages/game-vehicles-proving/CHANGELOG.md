# @adatechnology/game-vehicles-proving

## 0.4.0

### Minor Changes

- 5aa401f: A frota terrestre inteira fica dentro das faixas do banco de provas no Jolt (T6.2d): o adaptador reparte o torque do motor entre diferenciais e esteiras, mistura o atrito roda-chão pelo produto no pico (só nas rodas do veículo) e a esteira pede torque pleno para girar no lugar; a ficha ganha `physicsTorqueScale` (`PHYSICS_TORQUE_SCALE`), o tanque a potência real de um carro de combate e o ciclista a potência constante; a faixa do giro de esteira começa em 0 e a da bicicleta é a dos ciclistas reais (`accelerationSpanByType`); `FLEET_PHYSICS_SOURCES` guarda as fontes. O fator 1,3 da potência das motos saiu da ficha.

### Patch Changes

- Updated dependencies [5aa401f]
  - @adatechnology/game-vehicles-driving@0.3.0

## 0.3.2

### Patch Changes

- Updated dependencies [e4a9d0e]
  - @adatechnology/game-physics@0.6.0
  - @adatechnology/game-vehicles-driving@0.2.31

## 0.3.1

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-contracts@0.43.0
  - @adatechnology/game-physics@0.5.0
  - @adatechnology/game-runtime@0.3.7
  - @adatechnology/game-vehicles-driving@0.2.30

## 0.3.0

### Minor Changes

- d75f761: Acceleration ratings of cars and SUVs follow the real 0-100 km/h of the model they are inspired by (class bands in the proving ground, sources in the fleet); the gearbox of the physics mapping gets realistic shift times.

### Patch Changes

- Updated dependencies [9412886]
- Updated dependencies [cf37f9c]
- Updated dependencies [cefa5d9]
- Updated dependencies [d75f761]
  - @adatechnology/game-contracts@0.42.0
  - @adatechnology/game-physics@0.4.0
  - @adatechnology/game-vehicles-driving@0.2.29
  - @adatechnology/game-runtime@0.3.6

## 0.2.5

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0
  - @adatechnology/game-runtime@0.3.5
  - @adatechnology/game-vehicles-driving@0.2.28

## 0.2.4

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0
  - @adatechnology/game-runtime@0.3.4
  - @adatechnology/game-vehicles-driving@0.2.27

## 0.2.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0
  - @adatechnology/game-runtime@0.3.3
  - @adatechnology/game-vehicles-driving@0.2.26

## 0.2.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-runtime@0.3.2
  - @adatechnology/game-vehicles-driving@0.2.25

## 0.2.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-runtime@0.3.1
  - @adatechnology/game-vehicles-driving@0.2.24

## 0.2.0

### Minor Changes

- df3fbd5: O banco de provas deixa de ter acumulador próprio (spec 010 T3.8): `ProvingRun.step(dt)` sai; o agendador anda a corrida com `stepFixed(STEPS_PER_TICK)` na fase `fixedSimulate` (e `advance(seconds)` para quem roda sozinho, sobre um agendador do `game-runtime`). O `time_scale` da área vira quantos tiques de passos cada tique roda. Mesma trajetória a 60 Hz.

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [f7de1ec]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-runtime@0.3.0
  - @adatechnology/game-vehicles-driving@0.2.23

## 0.1.13

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-vehicles-driving@0.2.22

## 0.1.12

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-vehicles-driving@0.2.21

## 0.1.11

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-vehicles-driving@0.2.20

## 0.1.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-vehicles-driving@0.2.19

## 0.1.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-vehicles-driving@0.2.18

## 0.1.8

### Patch Changes

- f3def9d: Correções da medição dos sons de veículo na sala:

  - `slideOfGrip(uso)`: o `state.slip` do motorista semi é quanto da aderência o pneu usa, não quanto ele escorrega. A pista passava esse número direto e
    a derrapagem tocava durante toda a aceleração (3 s de pneu cantando num hatch que não patina). Agora só canta perto do limite e escorrega de vez
    saturado (roda patinando ou travada).
  - `ProvingRun.input`: o que o procedimento do teste pede dos controles no último passo. A pista de testes tocava a frenagem de 100 a 0 com acelerador 1
    e sem freio, então nem o chiado das pastilhas nem a derrapagem soavam; agora passa freio, acelerador, RPM e aderência do teste (e o freio do
    cockpit, `Cockpit.brake`, ao dirigir).
  - `sound-probe.mjs` grava `set` e `stop` sobre o próprio laço do motor de áudio, em vez de trocar por um objeto só com os dois métodos.

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-vehicles-driving@0.2.17

## 0.1.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-vehicles-driving@0.2.16

## 0.1.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-vehicles-driving@0.2.15

## 0.1.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-vehicles-driving@0.2.14

## 0.1.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-vehicles-driving@0.2.13

## 0.1.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-vehicles-driving@0.2.12

## 0.1.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-vehicles-driving@0.2.11

## 0.1.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-vehicles-driving@0.2.10
