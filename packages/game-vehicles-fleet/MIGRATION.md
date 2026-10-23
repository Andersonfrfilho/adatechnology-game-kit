# Migration from the Portuguese fleet

`@adatechnology/game-vehicles-fleet` is the port of the 69 vehicles of the Portuguese game (`zombiada/frota/*.js`) and of the generic part of its plugin
(`zombiada/plugin.js`: fuels, groups, effect texts and the ready-made damage scenarios). It is built on
[`@adatechnology/game-vehicles`](../game-vehicles/MIGRATION.md), which holds the renames of the SDK itself (kit members, build context calls, meta keys,
part kinds, zone types, particle names...). This file lists what is specific to the fleet.

For the same vehicle, state and zone health the scene is identical to the original: the test suite compares a digest of every vehicle (intact, damaged
and modified), its zones and parts with their pt-BR names, and the result of each scenario against digests produced by the original code.

- Every id and name in the code is English; Portuguese lives only in `src/locales/pt-BR.json` (and in `src/legacy-seeds.ts`, which keeps the original
  ids that seed the random streams).
- Vehicles, zones and panes were renamed, but their **original ids still seed the look and the damage** (`seedKey`, `seedId`, `registerLegacySeeds`),
  so nothing looks different. Never rename the values in `legacy-seeds.ts`.

Contents: [Setup](#setup) - [Vehicles](#vehicles) - [Groups](#groups) - [Fuels](#fuels) - [Plugin configuration](#plugin-configuration) -
[Scenarios](#scenarios) - [Spec fields](#spec-fields) - [Zone ids](#zone-ids) - [Zone effect keys](#zone-effect-keys) - [Part kinds](#part-kinds) -
[Locale keys](#locale-keys) - [Pane labels](#pane-labels) - [Part, zone and pane labels](#part-zone-and-pane-labels) - [Left for the game](#left-for-the-game)

## Setup

| Old | New |
|---|---|
| `<script src="zombiada/plugin.js">` | `GameVehiclesFleet.fleetPack` (plugin object), or `GameVehiclesFleet.installFleet(kit, options)` |
| ten `<script src="zombiada/frota/frota-*.js">` in a fixed order | Installed in that order by the pack. The water/air helpers (`ZG.EA`) and the plane helpers (`ZG.GH`) became the shared helpers of the install context; nothing is global any more |
| `window.ZG` / `VehicleSDK` | `createVehicleKit({ THREE, locale })` of `@adatechnology/game-vehicles` |
| everything registered, always | `options.groups`, `options.vehicles`, `options.exclude`, `options.scenarios`, or the arrays `motorcycles`, `cars`, `suvs`, ... |

```js
// before
VehicleSDK.plugin(zombiadaPlugin)       // plugin.js, zombie flags and blood included
// ...ten frota-*.js scripts register the vehicles...
const c = VehicleSDK.build('hatch', 'danificado')

// after
const kit = GameVehicles.createVehicleKit({ THREE, locale: 'pt-BR' })
GameVehiclesFleet.installFleet(kit)
const c = kit.build('compact_hatch', 'damaged')
```

Saved games: vehicle ids, zone ids (the keys of `zs.h` / `zoneState.health`) and build states are renamed. Translate stored data once with the tables
below; `legacyVehicleSeeds` (new id to old id) and `legacyZoneIds` are exported for that.

## Vehicles

Old key (`k`) to new id. Names are the pt-BR / English display names (parody names are the same in both unless they hold a Portuguese word).

| Old key | New id | Group | pt-BR name | English name |
|---|---|---|---|---|
| `hatch` | `compact_hatch` | `cars` | Ônyx | Ônyx |
| `taxi` | `taxi` | `cars` | Ônyx Plus Táxi | Ônyx Plus Taxi |
| `popular` | `entry_hatch` | `cars` | Kwyd | Kwyd |
| `eletrico` | `electric_hatch` | `cars` | Dolfin | Dolfin |
| `seda` | `midsize_sedan` | `cars` | Corola | Corola |
| `viatura` | `police_sedan` | `cars` | Cruzi Patrulha | Cruzi Patrol |
| `viatura-prf` | `highway_police_sedan` | `cars` | Cruzi Rodoviária | Cruzi Highway |
| `bicicleta` | `bicycle` | `motorcycles` | Monarca Barra Circular | Monarch Circular Bar |
| `scooter` | `scooter` | `motorcycles` | PXC 160 | PXC 160 |
| `moto` | `commuter_motorcycle` | `motorcycles` | Titã 160 | Titan 160 |
| `trail` | `trail_bike` | `motorcycles` | Brós 160 | Brós 160 |
| `bigtrail` | `adventure_bike` | `motorcycles` | GZ 1250 Aventura | GZ 1250 Adventure |
| `moto-prf` | `highway_police_bike` | `motorcycles` | GZ 1250 Rodoviária | GZ 1250 Highway |
| `quadri` | `quad_bike` | `motorcycles` | Grizzli 700 | Grizzli 700 |
| `fusca` | `beetle` | `cars` | Fusquinha 1300 | Fusquinha 1300 |
| `suvc` | `compact_suv` | `suvs` | T-Crux | T-Crux |
| `hibrido` | `hybrid_suv` | `suvs` | Corola Crux Híbrido | Corola Crux Hybrid |
| `compas` | `midsize_suv` | `suvs` | Compas Longitude | Compas Longitude |
| `suv` | `large_suv` | `suvs` | Hylux SW-4 | Hylux SW-4 |
| `strada` | `compact_pickup` | `pickups` | Estrada Cabine Dupla | Estrada Crew Cab |
| `touro` | `crossover_pickup` | `pickups` | Touro Ultra | Bull Ultra |
| `picape` | `midsize_pickup` | `pickups` | Hylux Cabine Dupla | Hylux Double Cab |
| `bigfoot` | `monster_truck` | `pickups` | Bigfut | Bigfut |
| `van` | `cargo_van` | `vans` | Sprinta Furgão | Sprinta Van |
| `ambulancia` | `ambulance` | `vans` | Ducatto Resgate | Ducatto Rescue |
| `bau` | `box_truck` | `heavy` | Delivéri 11.180 Baú | Delivéri 11.180 Box |
| `tanque` | `tanker_truck` | `heavy` | Constelação 24.280 Tanque | Constellation 24.280 Tanker |
| `onibus` | `school_bus` | `heavy` | ON Escolar | ON School |
| `urbano` | `city_bus` | `heavy` | Marcopólo Torino | Marcopólo Torino |
| `forte` | `armored_truck` | `heavy` | Atego Forte | Atego Armored |
| `trator` | `tractor` | `agricultural` | Massei 275 | Massei 275 |
| `marrua` | `light_4x4` | `military` | Maruá AM2 | Maruá AM2 |
| `worker` | `troop_truck` | `military` | Worqer 15.210 Militar | Worqer 15.210 Military |
| `guarani` | `apc_6x6` | `military` | Guaraní 6x6 | Guaraní 6x6 |
| `cascavel` | `armored_car_6x6` | `military` | Cascável EE-9 | Cascável EE-9 |
| `leopardo` | `battle_tank` | `military` | Leopardo 1A5 | Leopard 1A5 |
| `blackhawk` | `transport_helicopter` | `military` | Falcão Negro HM-2 | Black Falcon HM-2 |
| `voadeira` | `river_skiff` | `water` | Levfort Marajó | Levfort Marajó |
| `lancha` | `speedboat` | `water` | Foker 240 | Foker 240 |
| `pesqueiro` | `fishing_boat` | `water` | Traineira Esperança | Hope Trawler |
| `monomotor` | `single_engine_plane` | `air` | Sesna 172 | Sesna 172 |
| `agricola` | `crop_duster` | `air` | Ipanemá EMB-203 | Ipanemá EMB-203 |
| `heli` | `piston_helicopter` | `air` | Robinsom R44 | Robinsom R44 |
| `resgate` | `rescue_helicopter` | `air` | Esquillo AS350 | Esquillo AS350 |
| `bis` | `step_through_scooter` | `motorcycles` | Bis 125 | Bis 125 |
| `faze` | `naked_bike` | `motorcycles` | Fazê 250 | Fazê 250 |
| `ninja` | `sport_bike` | `motorcycles` | Ninjá 400 | Ninjá 400 |
| `fatboi` | `cruiser` | `motorcycles` | Fat Boi 114 | Fat Boi 114 |
| `cargo` | `delivery_bike` | `motorcycles` | Titã 160 Cargo | Titan 160 Cargo |
| `uno` | `boxy_hatch` | `cars` | Unno Mille | Unno Mille |
| `gol` | `family_hatch` | `cars` | Gól G5 | Gól G5 |
| `hb21` | `rideshare_hatch` | `cars` | HB-21 | HB-21 |
| `polo` | `turbo_hatch` | `cars` | Pólo | Pólo |
| `civico` | `fastback_sedan` | `cars` | Cívico | Cívico |
| `opala` | `classic_six_sedan` | `cars` | Opalla Comodoro | Opalla Comodoro |
| `mustang` | `v8_coupe` | `cars` | Mustangue GT | Mustangue GT |
| `jetski` | `jet_ski` | `water` | Si-Dú Spark | Si-Dú Spark |
| `veleiro` | `sailboat` | `water` | Veleiro Delta 26 | Delta 26 Sailboat |
| `bote` | `rescue_dinghy` | `water` | Zodiaque de resgate | Zodiaque Rescue |
| `patrulha` | `patrol_boat` | `water` | Lancha Patrulha | Patrol Boat |
| `paipa` | `tandem_trainer` | `air` | Paipa Cub | Paipa Cub |
| `bandeirante` | `regional_turboprop` | `air` | Bandeirantte EMB-110 | Bandeirantte EMB-110 |
| `caravana` | `amphibian_turboprop` | `air` | Caravana Anfíbio | Caravan Amphibian |
| `fenom` | `light_jet` | `air` | Fenom 100 | Fenom 100 |
| `tucano` | `light_attack_turboprop` | `military` | Super Tucanno | Super Tucanno |
| `r22` | `trainer_helicopter` | `air` | Robinsom R22 | Robinsom R22 |
| `jetranger` | `turbine_helicopter` | `air` | Bel 206 Jato | Bel 206 Jet |
| `h145` | `police_helicopter` | `air` | H-145 Águia | H-145 Eagle |
| `sabre` | `attack_helicopter` | `military` | Sabre AH-2 | Sabre AH-2 |

## Groups

The old groups were display names stored on each vehicle (`grp`); they are ids now, and the names are in the locale (`fleet.groups.<id>`).

| Old (`grp`) | New id | English name |
|---|---|---|
| Motos | `motorcycles` | Motorcycles |
| Carros | `cars` | Cars |
| SUVs | `suvs` | SUVs |
| Picapes e bigfoot | `pickups` | Pickups and monster trucks |
| Vans | `vans` | Vans |
| Caminhões e ônibus | `heavy` | Trucks and buses |
| Agrícola | `agricultural` | Agricultural |
| Militares | `military` | Military |
| Aquáticos | `water` | Watercraft |
| Aéreos | `air` | Aircraft |

`waterGroups: { 'Aquáticos': true }` is `waterGroups: { water: true }`; the default group `'Carros'` is `'cars'`.

## Fuels

| Old key | New id | English name |
|---|---|---|
| `nenhum` | `none` | No fuel |
| `gasolina` | `gasoline` | Gasoline |
| `etanol` | `ethanol` | Ethanol (alcohol) |
| `flex` | `flex` | Flex |
| `diesel` | `diesel` | Diesel |
| `eletrico` | `electric` | Electric |
| `hibrido` | `hybrid` | Hybrid |
| `avgas` | `avgas` | Aviation gasoline (AVGAS) |
| `qav` | `jet_fuel` | Jet fuel (Jet A-1) |

Fuel records `{ n, rend, val, onde, fx }` became `{ id, name, yield, shelfLife, where, effect }` in `kit.fuels` (locale keys `name`, `yield`, `shelf_life`,
`where`, `effect`). Vehicle `fuel` is the new id.

## Plugin configuration

| Old (`configure`) | New |
|---|---|
| `fuels`, `groups`, `waterGroups` | same names; ids and texts as above |
| `partFx` | `partEffects` (keys are the English part kinds) |
| `zoneFx` | `zoneEffects` (keys are the English effect keys; `{quem}` is `{who}`) |
| `scenarios`, `damagedScenario: 'frontal'` | `scenarios`, `damagedScenario: 'front_crash'` |
| `flags` (`frontBlood`, `horde`) | `flagEffects`: not in the pack, see [Left for the game](#left-for-the-game) |
| `fluids`, `impactStain`, `defaultSplat` (blood) | not in the pack |
| `defaultGroup: 'Carros'` | `defaultGroup: 'cars'` |
| `texts: { who, plate }` | not set by the pack (the engine has generic ones); `plate: 'ZMB4D23'` is the game's |
| `S.on('defaultDamage', frontBloodFx)`, `impact` wrapper for `noBlood` | not in the pack; the vehicles pass `noStain` |

## Scenarios

| Old id | New id | English name |
|---|---|---|
| `frontal` | `front_crash` | Front crash |
| `lateral` | `left_side_crash` | Left side crash |
| `capotado` | `rollover` | Rollover |
| `abandonado` | `abandoned` | Abandoned |
| `queimado` | `burnt` | Burnt |

The old ids still seed the random draws of each scenario (`seedId`). The sixth scenario of the original (an attack by the horde) and the flags
`frontBlood` and `horde` are not in the pack. Scenario definitions follow the engine renames (`n` is `name`, `X.cen` is `X.center`, ...).

## Spec fields

The register call changed from `{ k, grp, n, insp, ... }` to `{ key, group, name, inspired, ... }`. The texts come from the locale
(`fleet.vehicles.<id>.<field>`).

| Old | New | Where |
|---|---|---|
| `k` | `key` | spec |
| `grp` | `group` | spec |
| `n` | `name` | locale |
| `insp` | `inspired` | locale |
| `art` | `article` | locale |
| `c` | `category` | locale |
| `fuel` | `fuel` | spec |
| `d` | `description` | locale |
| `mass` | `mass` | spec |
| `r` | `noise` | spec |
| `seats` | `seats` | locale |
| `cap` | `capacity` | locale |
| `eff` | `efficiency` | locale |
| `auto` | `range` | locale |
| `vmax` | `maxSpeed` | spec |
| `skill` | `skill` | locale |
| `hood` | `hood` | spec |

## Zone ids

Zones the pack creates have English ids; the old id is kept as the seed of their random damage. The ids the engine derives itself (bumpers, doors,
fenders, hood, roof...) are in the [engine table](../game-vehicles/MIGRATION.md#zone-ids).

| Old id | New id |
|---|---|
| `mastro` | `mast` |
| `arma_proa` | `bow_weapon` |
| `armas_popa` | `stern_weapons` |
| `radar` | `radar` |
| `janela_traseira_esquerda` | `window_rear_left` |
| `janela_traseira_direita` | `window_rear_right` |
| `porta_embarque` | `boarding_door` |
| `teto_salao` | `saloon_roof` |
| `ar_cond` | `air_conditioner` |
| `arco` | `arch` |
| `empenagem` | `empennage` |
| `portas_t` | `rear_doors` |
| `fenestron` | `fenestron` |
| `guincho` | `winch` |
| `cabine_tropa` | `troop_cabin` |
| `estepe` | `spare_wheel` |
| `lona` | `canvas` |
| `cab_teto` | `cab_roof` |
| `rampa` | `ramp` |
| `tampa_motor` | `engine_cover` |
| `cesto` | `basket` |
| `pilone` | `pylon` |
| `bau` | `box` |
| `porta_carga` | `cargo_door` |
| `flutuadores` | `floats` |
| `canopi` | `canopy` |
| `armas` | `weapons` |
| `santoantonio` | `roll_bar` |
| `farois_teto` | `roof_lights` |
| `giroflex` | `beacon` |
| `barra` | `bar` |
| `motor_d` | `engine_right` |
| `motor_e` | `engine_left` |
| `helice_d` | `propeller_right` |
| `helice_e` | `propeller_left` |
| `asa_d` | `wing_right` |
| `asa_e` | `wing_left` |
| `farol_grade_d` | `grille_headlight_right` |
| `farol_grade_e` | `grille_headlight_left` |
| `mala_d` | `case_right` |
| `mala_e` | `case_left` |
| `porta_dianteira` | `front_door` |
| `porta_central` | `middle_door` |

Zone ids of lights and glass groups that the engine derives from the pack's parts:

| Old id | New id |
|---|---|
| `farol_e` | `headlight_left` |
| `farol_c` | `headlight_center` |
| `farol_d` | `headlight_right` |
| `lanterna_e` | `taillight_left` |
| `lanterna_c` | `taillight_center` |
| `lanterna_d` | `taillight_right` |
| `vidros_f` | `glass_front` |
| `vidros_e` | `glass_left` |
| `vidros_d` | `glass_right` |
| `vidros_t` | `glass_rear` |

## Zone effect keys

Zone `fxKey` values (and the keys of `zoneEffects`). The pack ships the texts of the keys marked "pack"; the others are texts that tie the damage to the
game, left to it (14 keys).

| Old | New | Texts |
|---|---|---|
| `cabineaero` | `aircraft_cabin` | game |
| `blindagem` | `armor` | pack |
| `eixo` | `axle` | pack |
| `bateria` | `battery` | pack |
| `parachoque` | `bumper` | game |
| `cabine` | `cab` | game |
| `cacamba` | `cargo_bed` | pack |
| `chassi` | `chassis` | pack |
| `conves` | `deck` | game |
| `porta` | `door` | game |
| `motor` | `engine` | pack |
| `escape` | `exhaust` | game |
| `carenagem` | `fairing` | pack |
| `paralama` | `fender` | game |
| `quadro` | `frame` | pack |
| `tanque` | `fuel_tank` | pack |
| `vidro` | `glass` | game |
| `guidao` | `handlebar` | pack |
| `farol` | `headlight` | pack |
| `capo` | `hood` | pack |
| `casco` | `hull` | pack |
| `trem` | `landing_gear` | pack |
| `tampa` | `lid` | game |
| `nariz` | `nose` | pack |
| `painel` | `panel` | game |
| `radiador` | `radiator` | pack |
| `teto` | `roof` | game |
| `rotor` | `rotor` | pack |
| `banco` | `seat` | pack |
| `lateral` | `side_panel` | game |
| `esqui` | `skid` | pack |
| `cauda` | `tail` | pack |
| `cone` | `tail_cone` | pack |
| `rotorcauda` | `tail_rotor` | pack |
| `lanterna` | `taillight` | pack |
| `lagarta` | `track` | pack |
| `torre` | `turret` | pack |
| `assoalho` | `underbody` | game |
| `arma` | `weapon` | pack |
| `roda` | `wheel` | pack |
| `parabrisa` | `windshield` | game |
| `asa` | `wing` | pack |

## Part kinds

| Old | New | Effect text |
|---|---|---|
| `farol` | `headlight` | pack |
| `lanterna` | `taillight` | pack |
| `vidro` | `glass` | game |
| `roda` | `wheel` | pack |
| `parachoque` | `bumper` | pack |
| `radiador` | `radiator` | pack |
| `motor` | `engine` | pack |
| `capo` | `hood` | pack |
| `tanque` | `fuel_tank` | pack |
| `bateria` | `battery` | pack |
| `casco` | `hull` | pack |
| `popa` | `stern` | pack |
| `helice` | `propeller` | pack |
| `rotor` | `rotor` | pack |
| `rotorcauda` | `tail_rotor` | pack |
| `trem` | `landing_gear` | pack |
| `lagarta` | `track` | pack |
| `arma` | `weapon` | - |
| `blindagem` | `armor` | pack |
| `cabine` | `cab` | - |
| `carenagem` | `fairing` | - |
| `cauda` | `tail` | - |
| `guidao` | `handlebar` | - |
| `torre` | `turret` | - |
| `traseira` | `rear` | - |
| `asa` | `wing` | pack |
| `carga` | `cargo` | pack |
| `explosao` | `explosion` | pack |
| `guincho` | `winch` | - |
| `estepe` | `spare_wheel` | - |
| `santoantonio` | `roll_bar` | - |
| `suspensao` | `suspension` | - |
| `sirene` | `siren` | - |
| `maca` | `stretcher` | - |
| `lataria` | `bodywork` | - |
| `rampa` | `ramp` | - |
| `tropa` | `troops` | - |
| `estacao` | `station` | - |
| `canhao` | `cannon` | - |
| `fuselagem` | `fuselage` | - |
| `aviônica` | `avionics` | - |
| `camera` | `camera` | - |
| `quilha` | `keel` | - |
| `mastro` | `mast` | - |

## Locale keys

The pack adds one top-level table, `fleet`, to the engine locales (`en`, `pt-BR`). Read it with `kit.t('fleet.<key>')`.

| Key | Content |
|---|---|
| `fleet.groups.<id>` | group names |
| `fleet.fuels.<id>.<name\|yield\|shelf_life\|where\|effect>` | fuel texts |
| `fleet.scenarios.<id>` | scenario names |
| `fleet.part_effects.<kind>` | effect text of a part kind (crash report) |
| `fleet.zone_effects.<key>` | five texts (one per damage band) |
| `fleet.vehicles.<id>.<field>` | name, inspired, article, category, description, seats, capacity, efficiency, range, skill |
| `fleet.labels.<key>` | labels of parts, panes and zones (the next sections) |
| `fleet.who.<key>` | who is hurt when a zone breaks ("whoever is on that side") |
| `fleet.texts.<key>` | lettering painted on a vehicle |
| `fleet.effects.<key>` | effect texts of individual zones |

## Pane labels

The original label of a glass pane seeds its random damage. Glass labels are keys now; the original label is registered with
`kit.registerLegacySeeds({ glassLabels })` (exported as `legacyGlassLabels`).

| Original label (pt-BR) | Key (`fleet.labels.<key>`) |
|---|---|
| Janelas da cabine boreste | `cabin_windows_starboard` |
| Janelas da cabine bombordo | `cabin_windows_port` |
| Para-brisa da casaria | `wheelhouse_windshield` |
| Janelas de boreste | `starboard_windows` |
| Janelas de bombordo | `port_windows` |
| Janela da porta | `door_window` |
| Janela do motorista | `driver_window` |
| Vidro traseiro (saída de emergência) | `rear_window_emergency_exit` |
| Para-brisa blindado | `armored_windshield` |
| Visor blindado direito | `right_armored_viewport` |
| Visor blindado esquerdo | `left_armored_viewport` |
| Visor traseiro | `rear_viewport` |
| Bolha do para-brisa | `windshield_bubble` |
| Janela da porta direita | `right_door_window` |
| Janela da porta esquerda | `left_door_window` |
| Janelas de queixo | `chin_windows` |
| Janela da porta dianteira direita | `front_right_door_window` |
| Janela da porta dianteira esquerda | `front_left_door_window` |
| Janela da porta traseira direita | `rear_right_door_window` |
| Janela da porta traseira esquerda | `rear_left_door_window` |
| Janela da porta do copiloto | `co_pilot_door_window` |
| Janela da porta do piloto | `pilot_door_window` |
| Janela da porta corrediça direita | `right_sliding_door_window` |
| Janela da porta corrediça esquerda | `left_sliding_door_window` |
| Bolha do artilheiro | `gunner_bubble` |
| Bolha do piloto | `pilot_bubble` |
| Janelas da cabine de tropa direita | `right_troop_cabin_windows` |
| Janelas da cabine de tropa esquerda | `left_troop_cabin_windows` |
| Periscópio do motorista | `driver_periscope` |
| Periscópio do atirador | `gunner_periscope` |
| Periscópio do comandante | `commander_periscope` |
| Bloco de visão esquerdo | `left_vision_block` |
| Bloco de visão direito | `right_vision_block` |
| Mira EMES-18 | `emes_18_sight` |
| Janelas das portas da cabine | `cab_door_windows` |
| Janelas dos artilheiros | `gunner_windows` |
| Janela dianteira direita | `front_window_right` |
| Janela dianteira esquerda | `front_window_left` |
| Vidro lateral traseiro direita | `rear_quarter_glass_right` |
| Vidro lateral traseiro esquerda | `rear_quarter_glass_left` |
| Janela da porta (direita) | `door_window_right` |
| Janela lateral esquerda | `left_side_window` |
| Janelinha traseira direita | `right_small_rear_window` |
| Janelinha traseira esquerda | `left_small_rear_window` |
| Claraboia | `skylight` |
| Janela da cabine de pilotagem direita | `right_flight_deck_window` |
| Janela da cabine de pilotagem esquerda | `left_flight_deck_window` |
| Janelas da cabine direita | `right_cabin_windows` |
| Janelas da cabine esquerda | `left_cabin_windows` |
| Janela lateral da cabine de pilotagem direita | `right_flight_deck_side_window` |
| Janela lateral da cabine de pilotagem esquerda | `left_flight_deck_side_window` |
| Canopi | `canopy` |
| Vidro da porta traseira direita | `right_rear_door_glass` |
| Vidro da porta traseira esquerda | `left_rear_door_glass` |
| Janela da porta corrediça | `sliding_door_window` |
| Janela do salão | `saloon_window` |
| Para-brisa direito | `right_windshield` |
| Para-brisa esquerdo | `left_windshield` |
| Janelas de vante da casaria | `deckhouse_forward_windows` |
| Janela de ré boreste | `starboard_aft_window` |
| Janela de ré bombordo | `port_aft_window` |
| Janela de vante boreste | `starboard_forward_window` |
| Janela de vante bombordo | `port_forward_window` |
| Janela traseira direita | `right_rear_window` |
| Janela traseira esquerda | `left_rear_window` |
| Vidro traseiro Omni-Vision | `omni_vision_rear_window` |
| Janela da cabine direita | `right_cabin_window` |
| Janela da cabine esquerda | `left_cabin_window` |
| Janela 1 | `window_1` |
| Janela 2 | `window_2` |
| Janela 3 | `window_3` |
| Janela 4 | `window_4` |
| Janela 5 | `window_5` |
| Janela 6 | `window_6` |
| Janela 7 | `window_7` |
| Janela 8 | `window_8` |
| Janela 9 | `window_9` |
| Janela 10 | `window_10` |
| Janela 11 | `window_11` |
| Janela 12 | `window_12` |

## Part, zone and pane labels

Every label that is shown (part labels, zone names, pane labels) became a key of `fleet.labels`. The pt-BR text is the original string. Keys are the
snake_case of the English text. Where one string appears in several vehicles the key is shared.

| Original text (pt-BR) | Key | English text |
|---|---|---|
| Motor a ar (traseiro) | `air_cooled_engine_rear` | Air-cooled engine (rear) |
| Turbina Allison 250 | `allison_250_turbine` | Allison 250 turbine |
| Casco de alumínio | `aluminium_hull` | Aluminium hull |
| Luz de fundeio (topo) | `anchor_light_top` | Anchor light (top) |
| Farol anticolisão | `anti_collision_light` | Anti-collision light |
| Farol anticolisão (barriga) | `anti_collision_light_belly` | Anti-collision light (belly) |
| Farol anticolisão (deriva) | `anti_collision_light_fin` | Anti-collision light (fin) |
| Farol anticolisão (cauda) | `anti_collision_light_tail` | Anti-collision light (tail) |
| Holofote no arco | `arch_spotlight` | Arch spotlight |
| Cofre blindado | `armored_vault` | Armored vault |
| Para-brisa blindado | `armored_windshield` | Armored windshield |
| Turbinas Arriel 2E | `arriel_2e_turbines` | Arriel 2E turbines |
| Turbina Arriel | `arriel_turbine` | Arriel turbine |
| Pneu {n}º eixo esquerdo | `axle_tire_n_left` | Left tire, axle {n} |
| Pneu {n}º eixo direito | `axle_tire_n_right` | Right tire, axle {n} |
| Baterias | `batteries` | Batteries |
| Caixa de baterias | `battery_box` | Battery box |
| Giroflex e sirene | `beacon_and_siren` | Beacon and siren |
| Tampa e assoalho da caçamba | `bed_lid_and_floor` | Bed lid and floor |
| Luz bicolor do bico | `bicolor_bow_light` | Bicolor bow light |
| Luz bicolor (verde) | `bicolor_light_green` | Bicolor light (green) |
| Luz bicolor (vermelha) | `bicolor_light_red` | Bicolor light (red) |
| Luz bicolor do púlpito (verde) | `bicolor_pulpit_light_green` | Bicolor pulpit light (green) |
| Luz bicolor do púlpito (vermelha) | `bicolor_pulpit_light_red` | Bicolor pulpit light (red) |
| Giroflex azul | `blue_beacon` | Blue beacon |
| Giroflex azul de resgate | `blue_rescue_beacon` | Blue rescue beacon |
| Porta de embarque | `boarding_door` | Boarding door |
| Carroceria e lona | `body_and_canvas` | Body and canvas |
| Metralhadora .50 da proa | `bow_50_machine_gun` | Bow .50 machine gun |
| Luz de proa (verde) | `bow_light_green` | Bow light (green) |
| Luz de proa (vermelha) | `bow_light_red` | Bow light (red) |
| Luzes de proa | `bow_lights` | Bow lights |
| Luzes de navegação de proa | `bow_navigation_lights` | Bow navigation lights |
| Chapa da proa | `bow_plate` | Bow plate |
| Motor boxer | `boxer_engine` | Boxer engine |
| Quilha de bulbo | `bulb_keel` | Bulb keel |
| Para-choque e quebra-mato | `bumper_and_bush_guard` | Bumper and bush guard |
| Para-choque e guincho | `bumper_and_winch` | Bumper and winch |
| Cabine | `cab` | Cab |
| Janelas das portas da cabine | `cab_door_windows` | Cab door windows |
| Teto da cabine | `cab_roof` | Cab roof |
| Janela da cabine | `cab_window` | Cab window |
| Cabine, porta-escada e janelas | `cabin_airstair_door_and_windows` | Cabin, airstair door and windows |
| Cabine e portas | `cabin_and_doors` | Cabin and doors |
| Cabine e portas corrediças | `cabin_and_sliding_doors` | Cabin and sliding doors |
| Cabine, portas e janelas | `cabin_doors_and_windows` | Cabin, doors and windows |
| Cabine, porta bipartida e janelas | `cabin_split_door_and_windows` | Cabin, split door and windows |
| Janelas da cabine bombordo | `cabin_windows_port` | Cabin windows, port |
| Janelas da cabine (bombordo) | `cabin_windows_port_side` | Cabin windows (port side) |
| Janelas da cabine boreste | `cabin_windows_starboard` | Cabin windows, starboard |
| Janelas da cabine (boreste) | `cabin_windows_starboard_side` | Cabin windows (starboard side) |
| Canhão | `cannon` | Cannon |
| Canoa e tambores de QAV | `canoe_and_jet_a_1_drums` | Canoe and Jet A-1 drums |
| Canopi | `canopy` | Canopy |
| Lona e arcos da carroceria | `canvas_and_body_bows` | Canvas and body bows |
| Capota de lona e para-brisa | `canvas_top_and_windshield` | Canvas top and windshield |
| Cesto de carga | `cargo_basket` | Cargo basket |
| Caçamba | `cargo_bed` | Cargo bed |
| Baú de carga | `cargo_box` | Cargo box |
| Porta de carga (esquerda) | `cargo_door_left` | Cargo door (left) |
| Casulo de carga | `cargo_pod` | Cargo pod |
| Tanque de carga (20.000 L) | `cargo_tank_20_000_l` | Cargo tank (20,000 L) |
| Motor diesel de centro | `centre_diesel_engine` | Centre diesel engine |
| Motor de centro (diesel) | `centre_engine_diesel` | Centre engine (diesel) |
| Janelas de queixo | `chin_windows` | Chin windows |
| Luz circular de popa | `circular_stern_light` | Circular stern light |
| Portas traseiras em concha | `clamshell_rear_doors` | Clamshell rear doors |
| Janela da porta do copiloto | `co_pilot_door_window` | Co-pilot door window |
| Cockpit, consoles e estofados | `cockpit_consoles_and_upholstery` | Cockpit, consoles and upholstery |
| Periscópio do comandante | `commander_periscope` | Commander periscope |
| Periscópios do comandante | `commander_periscopes` | Commander periscopes |
| Motor Continental A-65 | `continental_a_65_engine` | Continental A-65 engine |
| Convés e casaria | `deck_and_deckhouse` | Deck and deckhouse |
| Convés e grades do motor | `deck_and_engine_grilles` | Deck and engine grilles |
| Convés, cabine e cockpit | `deck_cabin_and_cockpit` | Deck, cabin and cockpit |
| Convés, casaria e mastros | `deck_deckhouse_and_masts` | Deck, deckhouse and masts |
| Janelas de vante da casaria | `deckhouse_forward_windows` | Deckhouse forward windows |
| Baú de entrega | `delivery_box` | Delivery box |
| Motores diesel (2 x C9) | `diesel_engines_2_x_c9` | Diesel engines (2 x C9) |
| Motores diesel e jatos d'água | `diesel_engines_and_water_jets` | Diesel engines and water jets |
| Tanque de diesel | `diesel_tank` | Diesel tank |
| Tanque de diesel (40 L) | `diesel_tank_40_l` | Diesel tank (40 L) |
| Tanques de diesel | `diesel_tanks` | Diesel tanks |
| Metralhadora de porta | `door_machine_gun` | Door machine gun |
| Metralhadoras de porta | `door_machine_guns` | Door machine guns |
| Janela da porta | `door_window` | Door window |
| Janela da porta (direita) | `door_window_right` | Door window (right) |
| Porta de carga dupla (esquerda) | `double_cargo_door_left` | Double cargo door (left) |
| Periscópios do motorista e do atirador | `driver_and_gunner_periscopes` | Driver and gunner periscopes |
| Periscópio do motorista | `driver_periscope` | Driver periscope |
| Periscópios do motorista e mira EMES-18 | `driver_periscopes_and_emes_18_sight` | Driver periscopes and EMES-18 sight |
| Blocos de visão do motorista | `driver_vision_blocks` | Driver vision blocks |
| Janela do motorista | `driver_window` | Driver window |
| Mira EMES-18 | `emes_18_sight` | EMES-18 sight |
| Empenagem e bequilha | `empennage_and_tail_wheel` | Empennage and tail wheel |
| Empenagem (deriva e profundor) | `empennage_fin_and_elevator` | Empennage (fin and elevator) |
| Motor | `engine` | Engine |
| Motor e transmissão | `engine_and_transmission` | Engine and transmission |
| Tampa do motor | `engine_cover` | Engine cover |
| Tampa e grade do motor | `engine_cover_and_grille` | Engine cover and grille |
| Tampa do motor (traseira) | `engine_cover_rear` | Engine cover (rear) |
| Grade e tampa do motor | `engine_grille_and_cover` | Engine grille and cover |
| Capô do motor e hélice | `engine_hood_and_propeller` | Engine hood and propeller |
| Motor (sob o assoalho) | `engine_under_the_floor` | Engine (under the floor) |
| Motores, filtros e supressores | `engines_filters_and_suppressors` | Engines, filters and suppressors |
| Porta de entrada | `entrance_door` | Entrance door |
| Torre ET-90 e teto | `et_90_turret_and_roof` | ET-90 turret and roof |
| Motor exposto e transmissão | `exposed_engine_and_transmission` | Exposed engine and transmission |
| Tanques externos | `external_tanks` | External tanks |
| Carenagem | `fairing` | Fairing |
| Fenestron | `fenestron` | Fenestron |
| Fenestron e deriva | `fenestron_and_fin` | Fenestron and fin |
| Tanque de traslado | `ferry_tank` | Ferry tank |
| Deriva e profundor | `fin_and_elevator` | Fin and elevator |
| Deriva e estabilizador | `fin_and_stabilizer` | Fin and stabilizer |
| Deriva, profundor e barbatanas | `fin_elevator_and_strakes` | Fin, elevator and strakes |
| Derivas e patim | `fins_and_skid` | Fins and skid |
| Derivas e estabilizador | `fins_and_stabilizer` | Fins and stabilizer |
| Hélice de cinco pás | `five_blade_propeller` | Five-blade propeller |
| Trem de pouso fixo | `fixed_landing_gear` | Fixed landing gear |
| Cabine de pilotagem | `flight_deck` | Flight deck |
| Cabine de pilotagem e portas dos pilotos | `flight_deck_and_pilot_doors` | Flight deck and pilot doors |
| Rodas dos flutuadores | `float_wheels` | Float wheels |
| Flutuadores | `floats` | Floats |
| Boias e casco | `floats_and_hull` | Floats and hull |
| Flutuadores e montantes | `floats_and_struts` | Floats and struts |
| Assoalho, banco e equipamento de resgate | `floor_seat_and_rescue_equipment` | Floor, seat and rescue equipment |
| Para-choque dianteiro | `front_bumper` | Front bumper |
| Porta dianteira | `front_door` | Front door |
| Carenagem frontal | `front_fairing` | Front fairing |
| Proteção frontal | `front_guard` | Front guard |
| Janela da porta dianteira esquerda | `front_left_door_window` | Front left door window |
| Suspensão dianteira esquerda | `front_left_suspension` | Front left suspension |
| Pneu dianteiro esquerdo | `front_left_tire` | Front left tire |
| Janela da porta dianteira direita | `front_right_door_window` | Front right door window |
| Suspensão dianteira direita | `front_right_suspension` | Front right suspension |
| Pneu dianteiro direito | `front_right_tire` | Front right tire |
| Escudo frontal | `front_shield` | Front shield |
| Pneu dianteiro | `front_tire` | Front tire |
| porta-malas dianteiro com estepe, tanque e macaco (o motor a ar fica atrás) | `front_trunk_with_spare_tyre_tank_and_jack_the_ai` | front trunk with spare tyre, tank and jack (the air-cooled engine is at the back) |
| Janela dianteira esquerda | `front_window_left` | Front left window |
| Janela dianteira direita | `front_window_right` | Front right window |
| Tanque de combustível | `fuel_tank` | Fuel tank |
| Tanque de combustível (na frente) | `fuel_tank_at_the_front` | Fuel tank (at the front) |
| Cabine envidraçada | `glazed_cabin` | Glazed cabin |
| Bolha do artilheiro | `gunner_bubble` | Gunner bubble |
| Periscópio do atirador | `gunner_periscope` | Gunner periscope |
| Janelas dos artilheiros | `gunner_windows` | Gunner windows |
| Câmera giroestabilizada | `gyro_stabilized_camera` | Gyro-stabilized camera |
| Guidão e painel | `handlebar_and_dashboard` | Handlebar and dashboard |
| Farol do guidão | `handlebar_headlight` | Handlebar headlight |
| Holofote no guidão | `handlebar_spotlight` | Handlebar spotlight |
| Farol | `headlight` | Headlight |
| Teto alto | `high_roof` | High roof |
| Capô, cilindros e hélice | `hood_cylinders_and_propeller` | Hood, cylinders and propeller |
| Capô, tremonha e hélice | `hood_hopper_and_propeller` | Hood, hopper and propeller |
| Tremonha (950 L) | `hopper_950_l` | Hopper (950 L) |
| Casco | `hull` | Hull |
| Bateria híbrida | `hybrid_battery` | Hybrid battery |
| Bateria híbrida (alta tensão) | `hybrid_battery_high_voltage` | Hybrid battery (high voltage) |
| Tanques integrais nas asas | `integral_wing_tanks` | Integral wing tanks |
| Motor IO-540 a etanol | `io_540_ethanol_engine` | IO-540 ethanol engine |
| Galão no esqui | `jerry_can_on_the_skid` | Jerry can on the skid |
| Tanque de QAV | `jet_a_1_tank` | Jet A-1 tank |
| Tanque de QAV (sob o banco traseiro) | `jet_a_1_tank_under_the_rear_seat` | Jet A-1 tank (under the rear seat) |
| Tanques de QAV | `jet_a_1_tanks` | Jet A-1 tanks |
| Farol de pouso e táxi | `landing_and_taxi_light` | Landing and taxi light |
| Faróis de pouso e táxi | `landing_and_taxi_lights` | Landing and taxi lights |
| Trem de pouso | `landing_gear` | Landing gear |
| Farol de pouso | `landing_light` | Landing light |
| Farol de pouso e holofote | `landing_light_and_spotlight` | Landing light and spotlight |
| Farol de pouso (asa esquerda) | `landing_light_left_wing` | Landing light (left wing) |
| Faróis de pouso | `landing_lights` | Landing lights |
| Visor blindado esquerdo | `left_armored_viewport` | Left armored viewport |
| Lateral da caçamba esquerda | `left_bed_side` | Left bed side |
| Lateral do baú esquerda | `left_box_side` | Left box side |
| Janela da cabine esquerda | `left_cabin_window` | Left cabin window |
| Janelas da cabine esquerda | `left_cabin_windows` | Left cabin windows |
| Luz diurna esquerda | `left_daytime_running_light` | Left daytime running light |
| Porta esquerda | `left_door` | Left door |
| Janela da porta esquerda | `left_door_window` | Left door window |
| Motor esquerdo e nacele | `left_engine_and_nacelle` | Left engine and nacelle |
| Motor esquerdo (nacele e pilone) | `left_engine_nacelle_and_pylon` | Left engine (nacelle and pylon) |
| Motor esquerdo (PT6A-34) | `left_engine_pt6a_34` | Left engine (PT6A-34) |
| Motor esquerdo (PW617F) | `left_engine_pw617f` | Left engine (PW617F) |
| Janela lateral da cabine de pilotagem esquerda | `left_flight_deck_side_window` | Left flight deck side window |
| Janela da cabine de pilotagem esquerda | `left_flight_deck_window` | Left flight deck window |
| Farol de neblina esquerdo | `left_fog_light` | Left fog light |
| Farol esquerdo | `left_headlight` | Left headlight |
| Roda do trem esquerda | `left_landing_gear_wheel` | Left landing gear wheel |
| Farol de pouso esquerdo | `left_landing_light` | Left landing light |
| Farol principal esquerdo | `left_main_headlight` | Left main headlight |
| Luz de navegação esquerda e giroflex vermelho | `left_navigation_light_and_red_beacon` | Left navigation light and red beacon |
| Luz de navegação esquerda (vermelha) | `left_navigation_light_red` | Left navigation light (red) |
| Mala esquerda | `left_pannier` | Left pannier |
| Hélice esquerda | `left_propeller` | Left propeller |
| Vidro da porta traseira esquerda | `left_rear_door_glass` | Left rear door glass |
| Vidro lateral traseiro esquerdo | `left_rear_quarter_glass` | Left rear quarter glass |
| Janela traseira esquerda | `left_rear_window` | Left rear window |
| Janela lateral esquerda | `left_side_window` | Left side window |
| Saia esquerda | `left_skirt` | Left skirt |
| Janela da porta corrediça esquerda | `left_sliding_door_window` | Left sliding door window |
| Janelinha traseira esquerda | `left_small_rear_window` | Left small rear window |
| Lanterna esquerda | `left_taillight` | Left taillight |
| Lagarta esquerda | `left_track` | Left track |
| Janelas da cabine de tropa esquerda | `left_troop_cabin_windows` | Left troop cabin windows |
| Pisca esquerdo | `left_turn_signal` | Left turn signal |
| Bloco de visão esquerdo | `left_vision_block` | Left vision block |
| Hélice de água esquerda | `left_water_propeller` | Left water propeller |
| Para-brisa esquerdo | `left_windshield` | Left windshield |
| Asa esquerda e foguetes | `left_wing_and_rockets` | Left wing and rockets |
| Cauda baixa e bequilha | `low_tail_and_tail_wheel` | Low tail and tail wheel |
| Cesto de bagagem | `luggage_basket` | Luggage basket |
| Motor Lycoming (4 cilindros) | `lycoming_engine_4_cylinders` | Lycoming engine (4 cylinders) |
| Motor Lycoming O-360 (exposto) | `lycoming_o_360_engine_exposed` | Lycoming O-360 engine (exposed) |
| Motor Lycoming O-540 | `lycoming_o_540_engine` | Lycoming O-540 engine |
| Casulo de metralhadora e bombas | `machine_gun_and_bomb_pod` | Machine gun and bomb pod |
| Rotor principal | `main_rotor` | Main rotor |
| Rotor principal (5 pás) | `main_rotor_5_blades` | Main rotor (5 blades) |
| Mastro e velas | `mast_and_sails` | Mast and sails |
| Mastro, retranca e velas | `mast_boom_and_sails` | Mast, boom and sails |
| Mastro, radar e antenas | `mast_radar_and_antennas` | Mast, radar and antennas |
| Luzes de mastro e de popa | `masthead_and_stern_lights` | Masthead and stern lights |
| Luz de mastro | `masthead_light` | Masthead light |
| Luz de mastro (motor) | `masthead_light_motoring` | Masthead light (motoring) |
| Luzes de mastro, popa e giroflex | `masthead_stern_and_beacon_lights` | Masthead, stern and beacon lights |
| Porta central | `middle_door` | Middle door |
| Motor diesel 10 hp (sob a escada) | `n_10_hp_diesel_engine_under_the_companionway` | 10 hp diesel engine (under the companionway) |
| Canhão de 105 mm | `n_105_mm_cannon` | 105 mm cannon |
| Tanque de 14 L | `n_14_l_tank` | 14 L tank |
| Tanque de 18,9 L | `n_18_9_l_tank` | 18.9 L tank |
| Canhão duplo de 23 mm | `n_23_mm_twin_cannon` | 23 mm twin cannon |
| Motor 250 | `n_250_engine` | 250 engine |
| 30 HP | `n_30_hp` | 30 HP |
| Tanque de 30 L | `n_30_l_tank` | 30 L tank |
| Metralhadoras .50 nas asas | `n_50_machine_guns_in_the_wings` | .50 machine guns in the wings |
| Canhão de 90 mm | `n_90_mm_cannon` | 90 mm cannon |
| motor diesel de 4 cilindros, aspirado | `naturally_aspirated_4_cylinder_diesel_engine` | naturally aspirated 4-cylinder diesel engine |
| Luzes de navegação e de mastro | `navigation_and_masthead_lights` | Navigation and masthead lights |
| Nariz e cabine de pilotagem | `nose_and_flight_deck` | Nose and flight deck |
| Nariz e para-brisa | `nose_and_windshield` | Nose and windshield |
| Nariz / aviônica | `nose_avionics` | Nose / avionics |
| Nariz (aviônica) e para-brisa | `nose_avionics_and_windshield` | Nose (avionics) and windshield |
| Nariz, cabine do artilheiro e canhão | `nose_gunner_cabin_and_cannon` | Nose, gunner cabin and cannon |
| Tanque no nariz (45 L) | `nose_tank_45_l` | Nose tank (45 L) |
| Nariz, turbina e hélice | `nose_turbine_and_propeller` | Nose, turbine and propeller |
| Vidro traseiro Omni-Vision | `omni_vision_rear_window` | Omni-Vision rear window |
| Posto do operador | `operator_station` | Operator station |
| Motor de popa | `outboard_motor` | Outboard motor |
| Luz de alcançado | `overtaking_light` | Overtaking light |
| Luz de alcançado (popa) | `overtaking_light_aft` | Overtaking light (aft) |
| Luz de alcançado (mastro) | `overtaking_light_mast` | Overtaking light (mast) |
| Luz de alcançado (haste) | `overtaking_light_pole` | Overtaking light (pole) |
| Cilindro de oxigênio | `oxygen_cylinder` | Oxygen cylinder |
| Cabine de passageiros e janelas | `passenger_cabin_and_windows` | Passenger cabin and windows |
| Bolha do piloto | `pilot_bubble` | Pilot bubble |
| Cabine do piloto | `pilot_cabin` | Pilot cabin |
| Janela da porta do piloto | `pilot_door_window` | Pilot door window |
| Janela de ré bombordo | `port_aft_window` | Port aft window |
| Giroflex azul bombordo | `port_blue_beacon` | Port blue beacon |
| Luz de proa bombordo (vermelha) | `port_bow_light_red` | Port bow light (red) |
| Janela de vante bombordo | `port_forward_window` | Port forward window |
| Luz de bordo de bombordo | `port_side_light` | Port side light |
| Luz de bordo bombordo (vermelha) | `port_side_light_red` | Port side light (red) |
| Janelas de bombordo | `port_windows` | Port windows |
| Tanque portátil | `portable_tank` | Portable tank |
| Hélice | `propeller` | Propeller |
| Turbina PT6A-114A | `pt6a_114a_turbine` | PT6A-114A turbine |
| Turbina PT6A-68C | `pt6a_68c_turbine` | PT6A-68C turbine |
| Holofote no púlpito | `pulpit_spotlight` | Pulpit spotlight |
| Pilone e estabilizador | `pylon_and_stabilizer` | Pylon and stabilizer |
| Pilones, foguetes e tanques externos | `pylons_rockets_and_external_tanks` | Pylons, rockets and external tanks |
| Vidro lateral traseiro | `quarter_glass` | Rear quarter glass |
| Radiador | `radiator` | Radiator |
| Rampa e porta traseira | `ramp_and_rear_door` | Ramp and rear door |
| Blindagem traseira (cantos e lanternas) | `rear_armor_corners_and_taillights` | Rear armor (corners and taillights) |
| Para-choque traseiro | `rear_bumper` | Rear bumper |
| Portas traseiras | `rear_doors` | Rear doors |
| Fuselagem traseira | `rear_fuselage` | Rear fuselage |
| Fuselagem traseira (entelada) | `rear_fuselage_fabric_covered` | Rear fuselage (fabric-covered) |
| Janela da porta traseira esquerda | `rear_left_door_window` | Rear left door window |
| Lateral traseira esquerda | `rear_left_side` | Rear left side |
| Suspensão traseira esquerda | `rear_left_suspension` | Rear left suspension |
| Pneu traseiro esquerdo | `rear_left_tire` | Rear left tire |
| Tampa traseira | `rear_lid` | Rear lid |
| Chapa traseira | `rear_plate` | Rear plate |
| Vidro lateral traseiro esquerda | `rear_quarter_glass_left` | Left rear quarter glass |
| Vidro lateral traseiro direita | `rear_quarter_glass_right` | Right rear quarter glass |
| Rampa traseira | `rear_ramp` | Rear ramp |
| Refletor traseiro | `rear_reflector` | Rear reflector |
| Janela da porta traseira direita | `rear_right_door_window` | Rear right door window |
| Lateral traseira direita | `rear_right_side` | Rear right side |
| Suspensão traseira direita | `rear_right_suspension` | Rear right suspension |
| Pneu traseiro direito | `rear_right_tire` | Rear right tire |
| Pneu traseiro | `rear_tire` | Rear tire |
| Pneu traseiro {n} esquerdo | `rear_tire_n_left` | Left rear tire {n} |
| Pneu traseiro {n} direito | `rear_tire_n_right` | Right rear tire {n} |
| Visor traseiro | `rear_viewport` | Rear viewport |
| Vidro traseiro | `rear_window` | Rear window |
| Vidro traseiro (saída de emergência) | `rear_window_emergency_exit` | Rear window (emergency exit) |
| Giroflex vermelho | `red_beacon` | Red beacon |
| Estação de armas remota | `remote_weapon_station` | Remote weapon station |
| Guincho de resgate | `rescue_winch` | Rescue winch |
| Visor blindado direito | `right_armored_viewport` | Right armored viewport |
| Lateral da caçamba direita | `right_bed_side` | Right bed side |
| Lateral do baú direita | `right_box_side` | Right box side |
| Janela da cabine direita | `right_cabin_window` | Right cabin window |
| Janelas da cabine direita | `right_cabin_windows` | Right cabin windows |
| Luz diurna direita | `right_daytime_running_light` | Right daytime running light |
| Porta direita | `right_door` | Right door |
| Janela da porta direita | `right_door_window` | Right door window |
| Motor direito e nacele | `right_engine_and_nacelle` | Right engine and nacelle |
| Motor direito (nacele e pilone) | `right_engine_nacelle_and_pylon` | Right engine (nacelle and pylon) |
| Motor direito (PT6A-34) | `right_engine_pt6a_34` | Right engine (PT6A-34) |
| Motor direito (PW617F) | `right_engine_pw617f` | Right engine (PW617F) |
| Janela lateral da cabine de pilotagem direita | `right_flight_deck_side_window` | Right flight deck side window |
| Janela da cabine de pilotagem direita | `right_flight_deck_window` | Right flight deck window |
| Farol de neblina direito | `right_fog_light` | Right fog light |
| Farol direito | `right_headlight` | Right headlight |
| Roda do trem direita | `right_landing_gear_wheel` | Right landing gear wheel |
| Farol de pouso direito | `right_landing_light` | Right landing light |
| Farol principal direito | `right_main_headlight` | Right main headlight |
| Luz de navegação direita e giroflex azul | `right_navigation_light_and_blue_beacon` | Right navigation light and blue beacon |
| Luz de navegação direita (verde) | `right_navigation_light_green` | Right navigation light (green) |
| Mala direita | `right_pannier` | Right pannier |
| Hélice direita | `right_propeller` | Right propeller |
| Vidro da porta traseira direita | `right_rear_door_glass` | Right rear door glass |
| Vidro lateral traseiro direito | `right_rear_quarter_glass` | Right rear quarter glass |
| Janela traseira direita | `right_rear_window` | Right rear window |
| Saia direita | `right_skirt` | Right skirt |
| Porta corrediça direita | `right_sliding_door` | Right sliding door |
| Janela da porta corrediça direita | `right_sliding_door_window` | Right sliding door window |
| Janelinha traseira direita | `right_small_rear_window` | Right small rear window |
| Lanterna direita | `right_taillight` | Right taillight |
| Lagarta direita | `right_track` | Right track |
| Janelas da cabine de tropa direita | `right_troop_cabin_windows` | Right troop cabin windows |
| Pisca direito | `right_turn_signal` | Right turn signal |
| Bloco de visão direito | `right_vision_block` | Right vision block |
| Hélice de água direita | `right_water_propeller` | Right water propeller |
| Para-brisa direito | `right_windshield` | Right windshield |
| Asa direita e foguetes | `right_wing_and_rockets` | Right wing and rockets |
| Santo-antônio | `roll_bar` | Roll bar |
| Arco de proteção e toldo | `roll_bar_and_awning` | Roll bar and awning |
| Ar-condicionado do teto | `roof_air_conditioner` | Roof air conditioner |
| Teto e escotilhas | `roof_and_hatches` | Roof and hatches |
| Farol de teto | `roof_light` | Roof light |
| Faróis de teto | `roof_lights` | Roof lights |
| Motor Rotax 900 ACE (sob o banco) | `rotax_900_ace_engine_under_the_seat` | Rotax 900 ACE engine (under the seat) |
| Motor Rotax (sob o banco) | `rotax_engine_under_the_seat` | Rotax engine (under the seat) |
| Leme, profundor e bequilha | `rudder_elevator_and_tail_wheel` | Rudder, elevator and tail wheel |
| Janela do salão | `saloon_window` | Saloon window |
| Holofote de busca | `search_spotlight` | Search spotlight |
| Banco, guidão e capô | `seat_handlebar_and_hood` | Seat, handlebar and hood |
| Bancos, piso e convés de proa | `seats_floor_and_bow_deck` | Seats, floor and bow deck |
| Blindagem lateral | `side_armor` | Side armor |
| Esquis | `skids` | Skids |
| Claraboia | `skylight` | Skylight |
| Janela da porta corrediça | `sliding_door_window` | Sliding door window |
| Estepe | `spare_wheel` | Spare wheel |
| Estepe e galão | `spare_wheel_and_jerry_can` | Spare wheel and jerry can |
| Holofote | `spotlight` | Spotlight |
| Barra de pulverização | `spray_boom` | Spray boom |
| Janela de ré boreste | `starboard_aft_window` | Starboard aft window |
| Giroflex azul boreste | `starboard_blue_beacon` | Starboard blue beacon |
| Luz de proa boreste (verde) | `starboard_bow_light_green` | Starboard bow light (green) |
| Janela de vante boreste | `starboard_forward_window` | Starboard forward window |
| Luz de bordo de boreste | `starboard_side_light` | Starboard side light |
| Luz de bordo boreste (verde) | `starboard_side_light_green` | Starboard side light (green) |
| Janelas de boreste | `starboard_windows` | Starboard windows |
| Metralhadoras 7,62 de ré | `stern_7_62_machine_guns` | Stern 7.62 machine guns |
| Popa e turbina | `stern_and_turbine` | Stern and turbine |
| Luz de popa | `stern_light` | Stern light |
| Luz de popa e giroflex | `stern_light_and_beacon` | Stern light and beacon |
| Luz de popa (mastro) | `stern_light_mast` | Stern light (mast) |
| Maca | `stretcher` | Stretcher |
| Suprimentos no corredor | `supplies_in_the_aisle` | Supplies in the aisle |
| Cauda em T | `t_tail` | T-tail |
| Luz de cauda e anticolisão | `tail_and_anti_collision_light` | Tail and anti-collision light |
| Luzes de cauda e anticolisão | `tail_and_anti_collision_lights` | Tail and anti-collision lights |
| Cone de cauda | `tail_cone` | Tail cone |
| Luz de cauda | `tail_light` | Tail light |
| Rotor de cauda | `tail_rotor` | Tail rotor |
| Bequilha | `tail_wheel` | Tail wheel |
| Lanterna | `taillight` | Taillight |
| Barra de lanterna | `taillight_bar` | Taillight bar |
| Faixa de lanterna | `taillight_strip` | Taillight strip |
| Cabine em tandem | `tandem_cockpit` | Tandem cockpit |
| Tanque | `tank` | Tank |
| Tanque (140 L) | `tank_140_l` | Tank (140 L) |
| Tanque (30 L) | `tank_30_l` | Tank (30 L) |
| Tanque (sob o assoalho) | `tank_under_the_floor` | Tank (under the floor) |
| Tanque (sob o banco) | `tank_under_the_seat` | Tank (under the seat) |
| Tanques (principal e auxiliar) | `tanks_main_and_auxiliary` | Tanks (main and auxiliary) |
| Tanques sob o piso | `tanks_under_the_floor` | Tanks under the floor |
| Farol de táxi | `taxi_light` | Taxi light |
| Farol de táxi (asa esquerda) | `taxi_light_left_wing` | Taxi light (left wing) |
| Farol de táxi (asa direita) | `taxi_light_right_wing` | Taxi light (right wing) |
| Imageador térmico | `thermal_imager` | Thermal imager |
| Hélice tripá | `three_blade_propeller` | Three-blade propeller |
| Cabine basculante | `tilting_cab` | Tilting cab |
| Bateria de tração | `traction_battery` | Traction battery |
| Cabine de tropa | `troop_cabin` | Troop cabin |
| Cabine de tropa e portas em concha | `troop_cabin_and_clamshell_doors` | Troop cabin and clamshell doors |
| Cabine de tropa e portas corrediças | `troop_cabin_and_sliding_doors` | Troop cabin and sliding doors |
| Compartimento de tropa | `troop_compartment` | Troop compartment |
| Blocos de visão da tropa | `troop_vision_blocks` | Troop vision blocks |
| Capô do porta-malas (frente) | `trunk_hood_front` | Trunk hood (front) |
| Tampa do porta-malas | `trunk_lid` | Trunk lid |
| Turbina e iBR | `turbine_and_ibr` | Turbine and iBR |
| Turbina e transmissão | `turbine_and_transmission` | Turbine and transmission |
| Turbina, capota e transmissão | `turbine_cowling_and_transmission` | Turbine, cowling and transmission |
| Turbinas e transmissão | `turbines_and_transmission` | Turbines and transmission |
| Turboeixos | `turboshafts` | Turboshafts |
| Turboeixos e transmissão | `turboshafts_and_transmission` | Turboshafts and transmission |
| Torre | `turret` | Turret |
| Torre e blindagem espaçada | `turret_and_spaced_armor` | Turret and spaced armor |
| Estiva da torre | `turret_stowage` | Turret stowage |
| Motor bicilíndrico | `twin_cylinder_engine` | Twin-cylinder engine |
| Trem de pouso em V | `v_shaped_landing_gear` | V-shaped landing gear |
| Motor V2 114 | `v2_114_engine` | V2 114 engine |
| Cofre | `vault` | Vault |
| Motores VK-2500 | `vk_2500_engines` | VK-2500 engines |
| Jatos d'água | `water_jets` | Water jets |
| Estação de armas | `weapon_station` | Weapon station |
| Para-brisa da casaria | `wheelhouse_windshield` | Wheelhouse windshield |
| Guincho | `winch` | Winch |
| Janela 1 | `window_1` | Window 1 |
| Janela 10 | `window_10` | Window 10 |
| Janela 11 | `window_11` | Window 11 |
| Janela 12 | `window_12` | Window 12 |
| Janela 2 | `window_2` | Window 2 |
| Janela 3 | `window_3` | Window 3 |
| Janela 4 | `window_4` | Window 4 |
| Janela 5 | `window_5` | Window 5 |
| Janela 6 | `window_6` | Window 6 |
| Janela 7 | `window_7` | Window 7 |
| Janela 8 | `window_8` | Window 8 |
| Janela 9 | `window_9` | Window 9 |
| Janela dianteira | `window_front` | Front window |
| Janela traseira | `window_rear` | Rear window |
| Para-brisa | `windshield` | Windshield |
| Para-brisa e nariz | `windshield_and_nose` | Windshield and nose |
| Bolha do para-brisa | `windshield_bubble` | Windshield bubble |
| Bolha do para-brisa e nariz | `windshield_bubble_and_nose` | Windshield bubble and nose |
| Para-brisa, queixo e imageador | `windshield_chin_and_imager` | Windshield, chin and imager |
| Para-brisa, janelas de queixo e nariz | `windshield_chin_windows_and_nose` | Windshield, chin windows and nose |
| Tanques nas asas | `wing_tanks` | Wing tanks |
| Hélice de madeira | `wooden_propeller` | Wooden propeller |
| Rotor de cauda em X | `x_tail_rotor` | X tail rotor |

## Left for the game

Not in the pack, because it is the story of the original game and not a vehicle:

- Zone effect texts of the 14 keys listed above as "game" (`panel`, `door`, `fender`, `side_panel`, `roof`, `lid`, `bumper`, `glass`, `windshield`, `underbody`, `deck`, `aircraft_cabin`, `exhaust`, `cab`); they mention the horde. Set them with `kit.configure({ zoneEffects })`.
- The part effect text of `glass`.
- The blood fluid, the blood stain of impacts (`impactStain`, `defaultSplat`), the `frontBlood` flag and the windshield splat after a crash, the `horde` flag
  (mirrors torn off, bite marks) and the scenario "Atacado pela horda".
- The plate `ZMB4D23`.
- The story sentences of 16 vehicle descriptions (see the README for the list).
