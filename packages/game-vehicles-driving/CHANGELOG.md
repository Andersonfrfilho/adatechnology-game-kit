# @adatechnology/game-vehicles-driving

## 0.2.0

### Minor Changes

- 4ed1cc7: Semissimulação de direção (spec 001, T7.1e): `createSemiSimDriver` com corpo rígido, mola e amortecedor por roda contra o chão, atrito de pneu longitudinal e lateral separados, câmbio automático com RPM, freio de mão que trava as traseiras, o registro de superfícies do documento da Frota (asfalto seco 1,0, molhado 0,75 com aquaplanagem acima de 90 km/h, terra 0,65, grama 0,55, lama 0,4 que atola quem não tem 4x4, sangue 0,5), o acoplamento do dano (pneu furado puxa, suspensão rola mais, motor abaixo de 30% falha), o consumo por RPM, carga e motor, `semiSpecFromStats` e as fórmulas de energia do atropelamento. Não há código do time: os números do documento são os testes.
- 5304161: Novo `@adatechnology/game-vehicles-driving` 0.1.0 (spec 001, T7.1d): `createArcadeDriver` é o carro dirigível do jogo extraído (aceleração, freio, ré, freio de mão, esterço, colisão por oito pontos, dano de batida, barulho, buzina e atropelamento), um passo puro sem three.js e sem jogo, com todos os números como opção e eventos para o anfitrião aplicar. Confere quadro a quadro com o `carUpdate` do jogo.
