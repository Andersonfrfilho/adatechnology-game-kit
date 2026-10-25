---
name: game-vehicles
description: Use quando precisar de carro, veículo, moto, caminhão, ônibus, tanque, barco, avião ou helicóptero procedural em three.js, com dano por zona (faixas 0 a 100), vidro que trinca, peças que soltam, capotagem, fogo e explosão. É o motor sem conteúdo; a frota pronta está em game-vehicles-fleet.
---

# @adatechnology/game-vehicles

## Objetivo
Motor procedural de veículos para three.js: carroceria, vidros, faróis, rodas, interior, capô e motor, zonas de dano com saúde de 0 a 100 em
cinco faixas visuais, fluidos, partículas, capotagem e explosões, mais widgets de mapa de danos. Determinístico (mesma entrada, mesmos vértices).
O motor **não tem conteúdo** (frota, combustíveis, cenários e textos vêm de packs/plugins). `three` é peer só de tipos: o host passa o `THREE`.

## Quando usar e quando não usar
- Use para construir, danificar, queimar, explodir ou desmontar um veículo, e para registrar um veículo novo (`kit.register`).
- Para ter os 69 veículos prontos, instale também `@adatechnology/game-vehicles-fleet`; não redesenhe veículo que já existe lá.
- Não coloque conteúdo de um jogo específico (sangue, horda, placa do jogo) aqui: fica no repositório do jogo (regra 2 do `CLAUDE.md`).
- Condução (física) ainda não existe no pacote; ver "O que vem pela migração".

## Como usar
```ts
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'

const kit = createVehicleKit({ THREE, locale: 'pt-BR' }) // 'en' é o padrão

kit.register({ key: 'meteor', name: 'Meteor 1', group: 'Prototypes', fuel: 'flex', hood: true }, (c) => {
  kit.car(c, {
    W: 1.74, col: '#c23b22', bottomY: 0.3, noseY: 0.62, tailY: 0.8,
    lower: [[-2.0, 0.32, 0.05], [-2.05, 0.95, 0.12], [1.3, 0.98, 0.2], [2.05, 0.75, 0.2], [2.08, 0.35, 0.08]],
    arches: [[1.3, 0.31, 0.37], [-1.25, 0.31, 0.37]],
    gh: { rb: -1.75, rt: -1.2, ft: 0.35, fb: 1.2, belt: 0.98, roof: 1.48, Wg: 1.62, k: 0.18, pillars: [-0.45, -1.2] },
    hl: { style: 'wedge', w: 0.36, h: 0.1 }, tl: { style: 'bar' }, grille: { style: 'seven' },
    interior: { rows: 2, col: '#2c2d30' }, hood: { motor: 'v8' },
    wheels: [[1.3, 0.31, 0.2], [-1.25, 0.31, 0.2, { spokes: 6 }]],
  })
})

const c = kit.build('meteor', 'intact')      // contexto; c.root vai para a cena
scene.add(c.root)
// dano: reconstruir com saúde por zona
scene.remove(c.root); kit.dispose(c)
const hurt = kit.build('meteor', 'intact', { health: { hood: 38, windshield: 0 }, flags: { burnt: true } })
scene.add(hurt.root)
kit.tick(hurt, dt)                            // partículas, fluidos, capô, capotagem, explosões
```
Eixos: **+x é a frente**, +y para cima, +z a direita (motorista em z negativo), chão em y = 0, metros.

Contrato de destruição (tiro, fogo, explosão, desmontar), segundo o `DestructibleImpl` de `game-contracts`:
```ts
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
const item = buildVehicleItem(kit, 'meteor')
const car = createVehicleDestructible(kit, item.vehicle, { id: 'meteor_1', frame: item.root })
car.hit({ type: 'ballistic', point, direction, energy: 500, caliber: 9 })
car.status() // { canStart, lightsOn, canDrive, brakeFactor, steerPull, flatTyres, ... }
```

## API principal
| Função/tipo | Para que serve |
|---|---|
| `createVehicleKit({ THREE, locale?, document?, plugins? })` | Cria um kit independente (registro, caches, configuração); um por jogo ou teste |
| `kit.register(spec, build)`, `kit.find`, `kit.fleet` | Registrar e achar veículos |
| `kit.build(key, state?, zoneState?)`, `dispose`, `tick`, `settle` | Ciclo de vida; estados `'intact'`, `'damaged'`, `'modified'` |
| `kit.zonesOf`, `applyZones`, `zoneScenario`, `zoneOverall`, `zoneAt`, `bandOf` | Zonas de dano e faixas (`intact` 76-100 ... `torn_off` 0) |
| `kit.impact`, `zoneImpact`, `explode`, `blastDamage`, `roll`, `setHood` | Eventos de dano |
| `kit.splat`, `puddle`, `wipe`, `spawn`, `burst`, `addEmitter` | Fluidos e partículas |
| `kit.car`, `shell`, `addGlass`, `headlight`, `interior`, `makeHood`, `truckCab`, `tracks`... | Construtores de peças |
| `kit.configure`, `plugin`, `scenario`, `defineFluid`, `on` | Content packs e plugins |
| `kit.ui.damageMap`, `bandButtons`, `legend`, `healthBar`, `scenarioButtons` | Widgets DOM/SVG do mapa de danos |
| `registerLocale`, `resolveStrings`, `listLocales`, `createTranslate` | Textos (en e pt-BR embutidos, resto cai no inglês) |
| `createVehicleDestructible`, `buildVehicleItem`, `buildVehicleModel`, `JOINT_RULES` | Contrato de destruição |
| `createVehicleDestructible(..., { fuel?, ignition? })` | tanque furado só vaza; acende com faísca de munição dura no aço, munição incendiária ou traçante, fogo perto ou explosão (`Hit.ignition` do `game-weapons`), ponderado pelo nível do tanque (`fuel` 0 a 1: quase vazio acende mais); depois segue o fogo e a explosão. Números em `IgnitionRules` do `game-contracts` |
| `registerLegacySeeds`, `LEGACY_ZONE_IDS`, `legacyZoneId` | Sementes dos ids antigos em português |

## Compõe com
- Usa só tipos de `@adatechnology/game-contracts` (destruição); não depende do mundo de destruição padrão.
- Recebe conteúdo de `@adatechnology/game-vehicles-fleet` (frota, combustíveis, cenários).
- A cidade (`game-urban`, futuro) deve usar estes veículos; o jogo só junta.

## Ambiente de teste
`packages/game-vehicles/example/`: exemplo de arquivo único offline, gerado por `pnpm build && pnpm --filter @adatechnology/game-vehicles example:build`
em `example/dist/vehicles-example.html` (`?lang=pt-BR` troca o idioma). Ainda não há `examples/vehicles-test-area` (V5).

## Cuidados
- Os campos do spec do carro têm nomes curtos herdados (`W`, `col`, `gh`, `hl`, `tl`); use a tabela do README, não invente nomes.
- Os construtores de baixo nível recebem e devolvem objetos three com tipagem frouxa.
- `kit.build` devolve o contexto, não um grupo: a cena recebe `c.root` (o README da frota ainda escreve `.group`, o que está errado).
- Não renomeie ids com sementes antigas sem usar `seedId`/`seedKey`/`registerLegacySeeds`: o visual muda.

## O que vem pela migração (spec 001)
- V2: a garagem do artefato entra completa; a comparação a fundo com o SDK é a 1ª tarefa da fase de veículos (motor = SDK).
- V3: modo leve de veículos entra em `game-vehicles-three` (pacote novo, ainda não existe).
- V4: condução como dois modos do SDK, arcade primeiro, depois semi-simulação.
- V5: módulos de teste (8 itens, 11 cenários) viram `examples/vehicles-test-area`.
- S1: motor e rotor sonoros ficam no `game-vehicles-three`, sobre `game-audio`.
