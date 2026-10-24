# @adatechnology/game-vehicles-fleet

The fleet for [`@adatechnology/game-vehicles`](../game-vehicles): 69 procedural vehicles in ten groups, the fuels, the group names, the generic crash texts and
five ready-made damage scenarios. It is a content pack: install it into a kit and every vehicle is available to `kit.build(id, state)`.

## Install

```sh
pnpm add @adatechnology/game-vehicles @adatechnology/game-vehicles-fleet three
```

Browser without a bundler (the global is `GameVehiclesFleet`):

```html
<script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
<script src="https://unpkg.com/@adatechnology/game-vehicles/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-vehicles-fleet/dist/index.global.js"></script>
<script>
  const kit = GameVehicles.createVehicleKit({ THREE, locale: 'en' })
  GameVehiclesFleet.installFleet(kit)
  scene.add(kit.build('compact_hatch', 'damaged').group)
</script>
```

## Usage

```ts
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetPack, installFleet } from '@adatechnology/game-vehicles-fleet'

const kit = createVehicleKit({ THREE, locale: 'pt-BR' })
installFleet(kit)                                  // everything
// or: kit.plugin(fleetPack)                         // the same, as a plugin
// or: installFleet(kit, { groups: ['cars', 'air'], exclude: ['battle_tank'], scenarios: false })

const car = kit.build('compact_hatch', 'intact')   // states: 'intact' | 'damaged' | 'modified'
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `groups` | all ten | groups to install |
| `vehicles` | every vehicle of the groups | only these ids |
| `exclude` | none | ids to leave out |
| `scenarios` | `true` | register the five damage scenarios and make `front_crash` the default damage |

`createFleetPack(options)` returns a plugin with the options applied; `fleetPack` is the one with the defaults.

## Exports

- `fleetPack`, `createFleetPack`, `installFleet`, `version`
- per group: `motorcycles`, `cars`, `suvs`, `pickups`, `vans`, `heavy`, `agricultural`, `military`, `water`, `air` (arrays of vehicle ids), `fleetGroups`, `fleetGroupIds`, `fleetVehicleIds`
- `createScenarios`, `scenarioIds`
- `enLocale`, `ptBrLocale`
- `legacyVehicleSeeds`, `legacyZoneIds`, `legacyGlassLabels`, `legacyScenarioSeeds` (the original Portuguese ids; see below)

## Groups

| Group | Vehicles |
|---|---|
| `motorcycles` | 12 |
| `cars` | 15 |
| `suvs` | 4 |
| `pickups` | 4 |
| `vans` | 2 |
| `heavy` | 5 |
| `agricultural` | 1 |
| `military` | 8 |
| `water` | 7 (the group is marked as water in the kit) |
| `air` | 11 |

The ids of all 69 are in [MIGRATION.md](MIGRATION.md#vehicles) with their old keys and names.

## Scenarios

`front_crash`, `left_side_crash`, `rollover`, `abandoned` and `burnt`. They are generic: the damage depends only on the vehicle. The scenario of the original game
with the horde is not here.

## Locales

`src/locales/en.json` and `pt-BR.json` hold every text: group, fuel, scenario, vehicle (name, inspiration, description, seats, capacity, range...),
part, zone and pane labels, and the crash texts. The code has English ids only. `locale: 'pt-BR'` gives back the exact strings of the original
(the tests compare all of them).

## Faithful to the original

The original ids (and glass labels) seed the random streams of looks and damage, so the pack keeps them in `src/legacy-seeds.ts` and passes them to the kit
(`seedKey`, `seedId`, `registerLegacySeeds`). Because of that, the same vehicle in the same state is the same scene as before. The tests hold a digest
(hash of the scene graph lines) produced by the original code for each of the 69 vehicles intact, damaged and modified, the zone ids and pt-BR labels, and the
result of each scenario. All 69 match. Do not rename the values in `legacy-seeds.ts`.

## Left for the game adapter

The pack is generic, so these parts of the original plugin and vehicles stayed out. The game adds them with `kit.configure` and its own hooks:

- The texts of 14 zone effect keys: `panel`, `door`, `fender`, `side_panel`, `roof`, `lid`, `bumper`, `glass`, `windshield`, `underbody`, `deck`, `aircraft_cabin`,
  `exhaust` and `cab` (`zoneEffects`), and the part effect text `glass` (`partEffects`). They tie the damage to the story of the game. Until it sets them the
  kit falls back to the generic `panel` text.
- The story sentences of the descriptions of 16 vehicles: `electric_hatch`, `police_sedan`, `highway_police_sedan`, `commuter_motorcycle`, `trail_bike`,
  `monster_truck`, `ambulance`, `box_truck`, `armored_truck`, `battle_tank`, `single_engine_plane`, `step_through_scooter`, `cruiser`, `v8_coupe`,
  `light_attack_turboprop` and `attack_helicopter`. The pack keeps the part about the vehicle; the pt-BR strings are the original minus those sentences.
- The `fx` arrays of the game effects that were attached to zones.
- The horde: its scenario, the `horde` flag (torn mirrors, bite marks) and the `frontBlood` flag with the windshield splat after a crash.
- Blood: the blood fluid, the impact stain (`impactStain`, `defaultSplat`) and the default-damage hook that adds it.
- The plate text `ZMB4D23` and the `who` text of the game.
- The other game-level texts of the original `plugin.js`.

## Português

Pacote de conteúdo com a frota do jogo: 69 veículos procedurais em dez grupos (motos, carros, SUVs, picapes, vans, caminhões e ônibus, agrícola, militares,
aquáticos e aéreos), os combustíveis, os nomes dos grupos, os textos genéricos de dano e cinco cenários de dano prontos. Ele usa o
`@adatechnology/game-vehicles`.

```js
const kit = GameVehicles.createVehicleKit({ THREE, locale: 'pt-BR' })
GameVehiclesFleet.installFleet(kit)                  // ou installFleet(kit, { groups: ["cars"] })
const carro = kit.build('compact_hatch', 'damaged')
```

Todo o texto em português fica em `src/locales/pt-BR.json`, exatamente como no original. Os ids antigos continuam semeando o visual e o dano, então cada
veículo sai idêntico ao original (os testes comparam hashes gerados pelo código original). O que é do jogo (zumbis, horda, sangue, placa ZMB) ficou de fora;
veja "Left for the game adapter". A tabela completa de nomes antigos e novos está em [MIGRATION.md](MIGRATION.md).

## Measurements, paint and design cards

`fleetDims(id)` (length, width, height in metres as the team measured them), `paintPalettes` and `paletteOf(group)` (13 civil colours and 5 military), `colorFromSeed(seed, palette)` (the same seed gives the same colour; number or text), `fleetStats(id)` (six 0-10 ratings, noise radius, top speed) and `fleetCard(id)` (the design card texts, Brazilian Portuguese). The data are JSON files in `src/data/` written by `tools/vehicles-catalog` from the team's Frota Leve and Frota pages.
