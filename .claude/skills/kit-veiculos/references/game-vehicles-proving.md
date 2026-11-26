# @adatechnology/game-vehicles-proving

Vehicle proving ground without three.js: measured tests (0-100, top speed, braking, turning circle, wet braking, mud) run on the semi-simulation driver, ranges by class and design card, visual checks signed off by a person, a certificate per vehicle and the list of approved vehicles a game lets in. Land, water and air. Knows nothing about any game.

API, uso e exemplos: `packages/game-vehicles-proving/README.md`; testes em `packages/game-vehicles-proving/tests/`.

## Banco de provas no motor (spec 008, T6.2b a T6.2d)
`startPhysicsRun` e `runTestOnPhysics` rodam os mesmos procedimentos no veículo do Jolt contra as mesmas faixas. A frota terrestre ainda não está inteira dentro delas (17 modelos fora no Jolt, T6.2d aberta; motivos e decisões do dono em `evidence.md`).
