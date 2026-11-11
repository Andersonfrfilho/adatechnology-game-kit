# @adatechnology/game-vehicles-driving

Driving for vehicles, without three.js and without a game: an arcade driver (the game's car: acceleration, braking, handbrake, steering, corner collision, crash damage, noise, run-over of bodies) and a semi-simulation driver (suspension, tyre friction, gearbox, surfaces, damage coupling, consumption). Knows nothing about any game.

API completa: `packages/game-vehicles-driving/README.md`.

## Quando usar e quando não usar
- Use para: andar com um carro numa cena, bater, atropelar, fazer barulho que a horda ouve.
- Não use para: desenhar o carro (`game-vehicles-three`) nem para o dano por zona (`game-vehicles`).

## Como usar
```ts
const driver = createArcadeDriver()
const { state, events } = driver.step({ throttle: 1, brake: 0, steer: 0.5, handbrake: false }, dt, { blocked, bodies })
```

## API principal
| Export | Para que serve |
|---|---|
| `createArcadeDriver(opções)` | motorista arcade; `spec` com todos os números do jogo (aceleração 5,5, freio 12, ré 3, máxima 17 m/s, esterço 0,55) |
| `vehicleCorners(spec, x, z, yaw)` | os oito pontos que o jogo testa contra paredes |
| `runOver(velocidade, regras)` | `push`, `knock` ou `kill` (3 e 8 m/s) |
| `createSemiSimDriver(spec)` | semissimulação: suspensão por roda, pneu, câmbio, freio de mão, superfícies, dano que muda a direção, consumo |
| `createSurfaces`, `surfaceGrip` | registro de superfícies (com packs, patch e remove) e aderência com aquaplanagem |
| `semiSpecFromStats(stats, corpo)` | spec a partir das notas da ficha de projeto (`fleetStats`) |
| `impactEnergy`, `bodyDamage`, `vehicleDamageFromImpact`, `speedLoss` | fórmulas de atropelamento do documento (seção 08) |
| tipos `DriveInput`, `DriverState`, `DrivingWorld`, `DrivingEvent` | o contrato |

## Compõe com
`game-vehicles-fleet` (`fleetStats` para os números por veículo), `game-vehicles-three` (o desenho), `game-infection`/multidão (os corpos entram por `world.bodies`).

## Ambiente de teste
`vehicles-test-area`: cenários de direção arcade e semi.

## Cuidados
- Unidades em metros, segundos e radianos; guinada 0 aponta para +x e a frente é `(cos yaw, -sin yaw)`.
- O motorista só emite eventos: dano, sangue, som e câmera são do anfitrião.
- Sem `Math.random`.
- A semissimulação não tem código do time: os números do documento da Frota são os testes; o passo interno é de 1/240 s.
