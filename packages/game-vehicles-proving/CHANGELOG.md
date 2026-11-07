# @adatechnology/game-vehicles-proving

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
