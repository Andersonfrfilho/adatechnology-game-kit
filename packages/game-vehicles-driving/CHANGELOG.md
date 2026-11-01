# @adatechnology/game-vehicles-driving

## 0.2.7

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.2.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.2.5

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.2.1

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0

## 0.2.0

### Minor Changes

- 4ed1cc7: Semissimulação de direção (spec 001, T7.1e): `createSemiSimDriver` com corpo rígido, mola e amortecedor por roda contra o chão, atrito de pneu longitudinal e lateral separados, câmbio automático com RPM, freio de mão que trava as traseiras, o registro de superfícies do documento da Frota (asfalto seco 1,0, molhado 0,75 com aquaplanagem acima de 90 km/h, terra 0,65, grama 0,55, lama 0,4 que atola quem não tem 4x4, sangue 0,5), o acoplamento do dano (pneu furado puxa, suspensão rola mais, motor abaixo de 30% falha), o consumo por RPM, carga e motor, `semiSpecFromStats` e as fórmulas de energia do atropelamento. Não há código do time: os números do documento são os testes.
- 5304161: Novo `@adatechnology/game-vehicles-driving` 0.1.0 (spec 001, T7.1d): `createArcadeDriver` é o carro dirigível do jogo extraído (aceleração, freio, ré, freio de mão, esterço, colisão por oito pontos, dano de batida, barulho, buzina e atropelamento), um passo puro sem three.js e sem jogo, com todos os números como opção e eventos para o anfitrião aplicar. Confere quadro a quadro com o `carUpdate` do jogo.
