# Migration from the Portuguese `VehicleSDK`

`@adatechnology/game-vehicles` is the port of the Portuguese `VehicleSDK` (`veiculos-sdk.js` + `veiculos-ui.js`, global `window.VehicleSDK`). The
geometry and every damage formula are unchanged: for the same vehicle, state and zone health the vertices are identical to the original (the test
suite compares them against digests produced by the original). What changed is naming, packaging and where the texts live.

- All names, options and ids are English. Portuguese lives only in `src/locales/pt-BR.json`.
- The singleton became a factory: `window.VehicleSDK` is now `GameVehicles.createVehicleKit({ THREE, locale })`.
- Everything that is content (fleet, fuels, scenarios, texts) comes from your plugin, as before.
- Seeds are unchanged: renamed ids keep their old text for random seeding, see [Seeds](#seeds-and-determinism).

Contents: [Setup](#setup) - [Kit](#kit) - [Configure and plugins](#configure-and-plugins) - [Spec and build context](#spec-and-build-context) -
[Meta](#meta) - [Zones](#zones) - [Scenarios](#scenarios) - [Values](#values) - [Zone ids](#zone-ids) - [Part labels](#part-labels) -
[UI](#ui) - [Seeds](#seeds-and-determinism) - [Removed](#removed)

## Setup

| Old | New |
|---|---|
| `<script src="veiculos-sdk.js">` then `window.VehicleSDK` | `import { createVehicleKit } from '@adatechnology/game-vehicles'`, or the IIFE global `GameVehicles.createVehicleKit` |
| `THREE` read from the page | `createVehicleKit({ THREE })` (required); `three` is a type-only peer dependency |
| `<script src="veiculos-ui.js">` (adds `SDK.ui`) | Included: `kit.ui` |
| Texts always Portuguese | `createVehicleKit({ locale: 'pt-BR' })` (default `'en'`) |
| `SDK.version` | Removed |
| `SDK.plugin(p)` after load | `createVehicleKit({ plugins: [p] })` or `kit.plugin(p)` |

```js
// before
const SDK = window.VehicleSDK
SDK.plugin(myPlugin)
const c = SDK.build('proto', 'intacto')

// after
const kit = GameVehicles.createVehicleKit({ THREE, locale: 'pt-BR', plugins: [myPlugin] })
const c = kit.build('proto', 'intact')
```

## Kit

Top-level members of `VehicleSDK` (`SDK.x`) and of the kit (`kit.x`). Members not listed kept their name.

| Old | New |
|---|---|
| `FUELS` | `fuels` |
| `GROUPS` | `groups` |
| `WATER_GROUPS` | `waterGroups` |
| `FLEET` | `fleet` |
| `BUILD` | `builders` |
| `FX` | `partEffects` |
| `ZONE_FX` | `zoneEffects` |
| `SCENARIOS` | `scenarios` |
| `BANDS` | `bands` |
| `DMG_MAT` | `damageMaterials` |
| `STEELM` | `steelMaterial` |
| `MT` | `materials` |
| `CM` | `makeMaterial` |
| `FM` | `makeFlatMaterial` |
| `paintCol` | `paintColor` |
| `textTex` | `textTexture` |
| `studioEnv` | `studioEnvironment` |
| `mkWarp` | `makeWarp` |
| `jerry` | `jerryCan` |
| `gBox` | `localBox` |
| `zoneBox` | `normalizeBox` |
| `Ctx` | `BuildContext` |
| `flagFx` | `flagEffects` |
| `geo.rbox` | `geo.roundedBox` |
| `geo.sloft` | `geo.smoothLoft` |
| `internals.gInvOf` | `internals.worldInverseOf` |
| `version` | removed |
| `SDK.ui.*` | `kit.ui.*` (same function names) |
| (none) | `kit.t(key, vars)`, `kit.strings`, `kit.matchers`, `kit.resolveLabel`, `kit.document` |

Unchanged: `register`, `find`, `build`, `dispose`, `configure`, `plugin`, `plugins`, `on`, `hook`, `defaultDamage`, `internals`, `config`,
`hash`, `geo`, `car`, `shell`, `addGlass`, `asGlass`, `autoWindows`, `sideWindows`, `headlight`, `taillight`, `lightBar`, `emblem`, `grille`, `seat`,
`steeringWheel`, `yoke`, `dashboard`, `interior`, `busRows`, `makeHood`, `hinge`, `engineBay`, `underbody`, `carDetails`, `archFlare`, `truckCab`,
`truckChassis`, `spokedWheel`, `tracks`, `spawn`, `burst`, `addEmitter`, `exhaustLook`, `fluidTypes`, `defineFluid`, `splat`, `puddle`,
`updateFluids`, `wipe`, `hitGlass`, `breakLight`, `hurtEngine`, `igniteFuel`, `applyPart`, `impact`, `probe`, `zoneImpact`, `roll`, `rollContact`,
`explode`, `blastDamage`, `tick`, `settle`, `setHood`, `applyArmor`, `bandOf`, `zoneEffect`, `zonesOf`, `zoneOwner`, `applyZones`, `scenario`,
`zoneScenario`, `zoneOverall`, `zoneAt`, `zoneDamageAt`, `zonePoint`, `halfAt`, `profX`, `surfaceAt`, `surfaceX`, `cutMesh`, `quadDef`, `glassQuad`,
`halo`, `holeTop`, `holeSide`, `holeQuad`, `holeBox`, `holeWhere`.

## Configure and plugins

| Old | New |
|---|---|
| `configure({ zoneFx })` | `configure({ zoneEffects })` |
| `configure({ partFx })` | `configure({ partEffects })` |
| `configure({ flags })` | `configure({ flagEffects })` |
| `bands: [{ n, col, min, h }]` | `bands: [{ name, color, min, health }]` |
| `texts: { who, noEffect, plate, ui }` | same keys; `ui` keys are `front`, `inside`, `aria`, `noZones`, `health` |
| `{quem}` in effect texts | `{who}` |
| fluid type `mancha` (default stain) | `stain` |
| `plugin({ name, configure, install(SDK) })` | `plugin({ name, configure, install(kit) })` |
| flag effect `apply(c, flags, SDK)` | `apply(c, flags, kit)` |

Unchanged: `scenarios`, `fluids`, `fuels`, `groups`, `waterGroups`, `palette.rust`, `impactStain`, `defaultSplat`, `defaultGroup`, `damagedScenario`.
The hook event `defaultDamage` keeps its name. Effect-text keys are the English zone types and `fxKey`s (see [Values](#values)).

## Spec and build context

Vehicle spec given to `register`:

| Old | New |
|---|---|
| `k` | `key` |
| `grp` | `group` |
| `n` | `name` |
| other fields (`fuel`, `hood`, `mass`, `seats`, ...) | passed through unchanged |

Build function: `(c, kit)` as before. Members of the build context `c`:

| Old | New |
|---|---|
| `c.g` | `c.vehicle` |
| `c.fx` | `c.effects` |
| `c.st` | `c.state` |
| `c.k` | `c.key` |
| `c.rb(...)` | `c.roundBox(...)` |
| `c.cyl(...)` | `c.cylinder(...)` |
| `c.sph(...)` | `c.sphere(...)` |
| `c.zs` | `c.zoneState` (`{ health, flags }`) |
| `c.zOwner` | `c.zoneOwners` |
| `c.zDrop` | `c.zoneDrops` |
| `c.zoneErr` | `c.zoneErrors` |
| `c.ps` | `c.particles` |
| `c.emit` | `c.emitters` |
| `c.rollA` | `c.rollState` |
| `c.boom` | `c.blast` |
| `c.tankDmg` | `c.tankDamage` |
| `c.toFx(p)` / `c.dirFx(v)` | `c.toEffects(p)` / `c.dirToEffects(v)` |
| `c.part(kind, label, obj, pos, reach)` | same signature; `label` may also be `{ key, label? }` (see [Part labels](#part-labels)) |
| part object `{ kind, n, obj, pos, reach }` | `{ kind, label, key, obj, pos, reach }` |
| log entry `n` | `label` |
| light object `{ g, inner, lens, kind, tint, broken }` | `{ group, inner, lens, kind: 'headlight' or 'taillight', tint, broken }` |

The car, truck and other builders keep their option names (`W`, `col`, `gh`, `hl`, `tl`, `lower`, `arches`, `f`, `L`, `axles`, `dual`, ...). Changed values:

| Old | New |
|---|---|
| `truckChassis` option `tank: 'direita'` / `'esquerda'` | `'right'` / `'left'` |
| zone option `hinge`: `'frente'` / `'tras'` / `'cima'` / `'baixo'` | `'front'` / `'rear'` / `'up'` / `'down'` |
| `wipe(c, 'limpador')` / `'chuva'` | `'wiper'` / `'rain'` |
| `puddle(c, 'oleo' / 'gasolina' / 'diesel', ...)` | `'oil'` / `'gasoline'` / `'diesel'` |
| `addGlass(..., 'laminado' / 'temperado')` | `'laminated'` / `'tempered'` |
| `zoneImpact(c, 'frente' / 'traseira' / 'esquerda' / 'direita' / 'capotado')` | `'front'` / `'rear'` / `'left'` / `'right'` / `'rolled'` |
| `zonePoint(c, 'frente' ...)` | same side words as `zoneImpact` |
| engine bay `motor: 'gasolina' / 'eletrico' / 'v8n'` | `'gasoline'` / `'electric'` / `'v8_na'` |
| `spec.fuel: 'gasolina' / 'qav' / 'eletrico' / 'nenhum'` | `'gasoline'` / `'jet_fuel'` / `'electric'` / `'none'` |

## Meta

| Old | New |
|---|---|
| `col` | `color` |
| `L` | `length` |
| `W` | `width` |
| `clear` | `clearance` |
| `bodyH` | `bodyHeight` |
| `fusW` | `fuselageWidth` |
| `fusTop` | `fuselageTop` |
| `cabL` | `cabLength` |
| `bigBoom` | `bigBlast` |
| `quadF` | `frontQuad` |
| `underG` | `underbodyGroup` |
| `bumperF` / `bumperR` | `frontBumper` / `rearBumper` |
| `gh` | `glasshouse` |
| `T` | `tumble` |

Unchanged: `kind`, `front`, `rear`, `belt`, `top`, `roof`, `bed`, `bay`, `cabin`, `exhaust`, `exhaustDir`, `arches`, `armor`, `damage`, `stiff`, `rack`,
`armored`, `bullet`. The old code sniffed the vehicle key with `/militar|worker/` to choose the body zone type; that is gone. Set `meta.bodyLabel`
(a label for the single body zone) or `meta.bodyKind: 'box' | 'body'`. Meta kinds are the same English words (`car`, `bike`, `quad`, `tractor`, `boat`,
`plane`, `heli`, `bus`, `truck`).

## Zones

| Old | New |
|---|---|
| zone `n` | `name` |
| zone `h` | `health` |
| zone `b` | `band` |
| zone `w` | `weight` |
| zone `own` | `owned` |
| zone `lagarta` | `track` |
| zone `type`: `porta` `painel` `teto` `tampa` `capo` `parachoque` `vidro` `luz` `roda` `interno` `peca` | `door` `panel` `roof` `lid` `hood` `bumper` `glass` `light` `wheel` `internal` `part` |
| zone `tags`: `parabrisa` `frente` `traseira` `esquerda` `direita` | `windshield` `front` `rear` `left` `right` |
| zone tag/fxKey names | English (`windshield`, `glass`, `landing_gear`, `skid`, `axle`, `engine`, `handlebar`, ...) |
| `ZONE_WEIGHTS` keys | the English zone types above |
| `zs = { h, flags }` (input of `build` / `applyZones`) | `{ health, flags }` |
| `c.zs.h` | `c.zoneState.health` |
| `zoneOverall(c)` returns `{ h, b, n }` | `{ health, band, name }` |
| `zoneDamageAt(...)` returns `{ main, list: [{ id, n, dmg }] }` | `{ main, list: [{ id, name, damage }] }` |
| `c.zone(id, label, box, parts, opts)` | unchanged signature; use English ids and `opts.seedId` to keep an old seed |

Band ids and fields:

| Old | New |
|---|---|
| ids `intacto` `arranhado` `amassado` `destruido` `arrancado` | `intact` `scratched` `dented` `destroyed` `torn_off` |
| band fields `n`, `col`, `h`, `min` | `name`, `color`, `health`, `min` |
| band names (`Intacto`, `Arranhado`, `Amassado`, `Destruído`, `Arrancado`) | `locales/pt-BR.json` (`bands.*`), English in `en.json` |

Build states: `'intacto'` / `'danificado'` / `'modificado'` are now `'intact'` / `'damaged'` / `'modified'`.

## Scenarios

Definition `{ id, n, init?, zone }` becomes `{ id, name, init?, zone }`. `zone(z, X)` and `init(X)` receive:

| Old (`X.`) | New |
|---|---|
| `F` | `front` |
| `R` | `rear` |
| `L` | `length` |
| `W` | `width` |
| `cl` | `clearance` |
| `cen` | `center` |
| `isPB` | `isWindshield` |
| `BODY_TYPES` | `bodyTypes` (keys are the English zone types) |
| `r()` | `rand()` |
| `h` | `health` |
| `set`, `flags`, `c`, `meta`, `top`, `clamp` | unchanged |

`zoneScenario(c, id)` returns `{ health, flags, scenario }` (was `{ h, flags, sc }`) and the result can be passed straight to `build` or
`applyZones`. A scenario is found by `id` or by `name`. Built-in flags `flipped`, `burnt` and `abandoned` are unchanged.

## Values

Particle types (`spawn`, `burst`):

| Old | New |
|---|---|
| `faisca` `caco` `cubo` `lente` `lata` `plastico` `poeira` `fumaca` `fogo` `agua` `gota` | `spark` `shard` `cube` `lens` `scrap` `plastic` `dust` `smoke` `fire` `water` `droplet` |
| variants `branca` `preta` `cinza` `vapor` | `white` `black` `gray` `steam` |
| emitter kinds `branca` `preta` `fogo` `escape` | `white` `black` `fire` `exhaust` |

Part kinds (`c.part(kind, ...)`, `parts[].kind`, `partEffects` keys):

| Old | New |
|---|---|
| `farol` `lanterna` `vidro` `roda` `parachoque` `radiador` `motor` `capo` `tanque` `bateria` `casco` `popa` `helice` `rotor` `rotorcauda` `trem` `lagarta` | `headlight` `taillight` `glass` `wheel` `bumper` `radiator` `engine` `hood` `fuel_tank` `battery` `hull` `stern` `propeller` `rotor` `tail_rotor` `landing_gear` `track` |

## Zone ids

Zones derived by the engine have English ids. The old id is still what seeds the damage (see below). Ids that are not listed did not change.

| Old id | New id |
|---|---|
| `parachoque_d` | `bumper_front` |
| `parachoque_t` | `bumper_rear` |
| `paralama_de` | `fender_front_left` |
| `paralama_dd` | `fender_front_right` |
| `porta_de` | `door_front_left` |
| `porta_dd` | `door_front_right` |
| `porta_te` | `door_rear_left` |
| `porta_td` | `door_rear_right` |
| `lateral_te` | `side_rear_left` |
| `lateral_td` | `side_rear_right` |
| `capo` | `hood` |
| `teto` | `roof` |
| `tampa` | `lid` |
| `assoalho` | `underbody` |
| `cacamba` | `cargo_bed` |
| `motor` | `engine` |
| `radiador` | `radiator` |
| `tanque` | `fuel_tank` |
| `bateria` | `battery` |
| `carenagem` | `fairing` |
| `guidao` | `handlebar` |
| `banco` | `seat` |
| `quadro` | `frame` |
| `escapamento` | `exhaust` |
| `frente` | `front` |
| `traseira` | `rear` |
| `topo` | `top` |
| `capo_trator` | `tractor_hood` |
| `paralama_te` | `fender_rear_left` |
| `paralama_td` | `fender_rear_right` |
| `posto` | `operator_station` |
| `cab_frente` | `cab_front` |
| `cab_e` | `cab_left` |
| `cab_d` | `cab_right` |
| `corpo_e` | `body_left` |
| `corpo_d` | `body_right` |
| `corpo_t` | `body_rear` |
| `chassi` | `chassis` |
| `blind_frente` | `armor_front` |
| `blind_e` | `armor_left` |
| `blind_d` | `armor_right` |
| `blind_t` | `armor_rear` |
| `arma` | `weapon` |
| `torre` | `turret` |
| `lagarta_e` | `track_left` |
| `lagarta_d` | `track_right` |
| `rodas_e` | `wheels_left` |
| `rodas_d` | `wheels_right` |
| `proa` | `bow` |
| `costado_e` | `side_left` |
| `costado_d` | `side_right` |
| `popa` | `stern` |
| `conves` | `deck` |
| `nariz` | `nose` |
| `cabine` | `cab` |
| `asa_e` | `wing_left` |
| `asa_d` | `wing_right` |
| `fuselagem` | `fuselage` |
| `cauda` | `tail` |
| `trem` | `landing_gear` |
| `tanques` | `fuel_tanks` |
| `cone` | `tail_cone` |
| `rotor` | `rotor` |
| `rotor_cauda` | `tail_rotor` |
| `esquis` | `skids` |
| `vidros_f` / `vidros_e` / `vidros_d` / `vidros_t` (grouped glass) | `glass_front` / `glass_left` / `glass_right` / `glass_rear` |
| `vidro_<slug of label>`, `para_brisa`, `janela_*` (one zone per pane) | `windshield`, `rear_window`, `window_front`, `window_rear`, `quarter_glass`, `cab_window`, `window`, `glass` (the part `key`), with `_left` / `_right` for side panes; free text labels still use `glass_<slug>` |
| `farol_e` `farol_d` `farol_c` (+ `_2`, `_3` for more) | `headlight_left` `headlight_right` `headlight_center` (+ `_2`, ...) |
| `lanterna_e` `lanterna_d` `lanterna_c` | `taillight_left` `taillight_right` `taillight_center` |
| `roda_<dianteira\|traseira>[_<esquerda\|direita>]` | `wheel_<front\|rear>[_<left\|right>]` |
| `rodas_eixo1`, `rodas_eixo2`, ... | `wheels_axle_1`, `wheels_axle_2`, ... |

## Part labels

`c.part`, `addGlass` and the light builders accept a plain string (as before) or `{ key, label? }`. A key is looked up in the locale as `parts.<key>`
and also lets the engine recognise the part without matching text. Free text still works: the engine falls back to the regular expressions in the
locale `matchers` (windshield, rear, side, tank, diesel, fuel), which for `pt-BR` are the original Portuguese patterns. A part can carry `fuel:
'diesel' | 'gasoline'` instead of the old `/diesel/` and `/gasolina|etanol|álcool|combust/` label matching.

| Key | Portuguese (original label) | English |
|---|---|---|
| `tire_front` | Pneu dianteiro {sideM} | Front {side} tire |
| `tire_rear` | Pneu traseiro {sideM} | Rear {side} tire |
| `bike_tire_front` | Pneu dianteiro | Front tire |
| `bike_tire_rear` | Pneu traseiro | Rear tire |
| `headlight` | Farol {sideM} | {Side} headlight |
| `taillight` | Lanterna {side} | {Side} taillight |
| `led_bar` | Barra de LED | LED bar |
| `taillight_bar` | Barra de lanterna | Taillight bar |
| `hood` | Capô | Hood |
| `engine` | Motor | Engine |
| `engine_electric` | Motor elétrico e inversor | Electric motor and inverter |
| `radiator` | Radiador | Radiator |
| `bumper_front` | Para-choque dianteiro | Front bumper |
| `bumper_rear` | Para-choque traseiro | Rear bumper |
| `fuel_tank` | Tanque de combustível | Fuel tank |
| `diesel_tank` | Tanque de diesel | Diesel tank |
| `windshield` | Para-brisa | Windshield |
| `rear_window` | Vidro traseiro | Rear window |
| `window_front` | Janela dianteira | Front window |
| `window_rear` | Janela traseira | Rear window |
| `quarter_glass` | Vidro lateral traseiro | Rear quarter glass |
| `cab_window` | Janela da cabine | Cab window |
| `window` | Janela | Window |
| `glass` | Vidro | Glass |
| `glass_side` | {label} {side} | {label} ({side}) |
| `glass_side_m` | {label} {sideM} | {label} ({side}) |
| `track` | Lagarta {side} | {Side} track |

## UI

| Old | New |
|---|---|
| `SDK.ui.damageMap(host, c, { selected, onSelect })` | `kit.ui.damageMap(host, c, { selected, onSelect })` |
| `bandButtons`, `legend`, `healthBar`, `scenarioButtons`, `zoneLabel`, `bandRange`, `css`, `injectStyles` | same names under `kit.ui` |
| `healthBar` returns `{ h, b, n }` | `{ health, band, name }` |
| stylesheet id `vsdk-ui-css` | `vehicles-ui-css` |
| text keys `front`, `inside`, `aria`, `noZones`, `health` (`texts.ui`) | same keys; defaults from `ui.*` in the locale |
| SVG class names (`dmap`, `dm-body`, `zn`, `sel`, `gone`, ...) | unchanged |

## Seeds and determinism

Every random stream is seeded from the vehicle key plus a text. To keep the output identical after the rename, the seed text of renamed things is the
original one:

| Seed | Text |
|---|---|
| build state | `intact` -> `intacto`, `damaged` -> `danificado`, `modified` -> `modificado` |
| zone | the old zone id (`LEGACY_ZONE_IDS`, or an explicit `seedId` on the zone) |
| phases of `applyZones` | the salts of `SEED_SALTS`: `ferrugem` (rust), `cenario` (scenario flags), `assenta` (settling), `capota` (rollover) |

Exported for packs: `LEGACY_STATES`, `LEGACY_ZONE_IDS`, `SEED_SALTS`, `legacyZoneId(zone)`. A pack that registers its own zones with `c.zone(...)` can
pass `seedId` to keep the look of an earlier version; zones without it seed from their own id.

## Removed

- `SDK.version`.
- The global `window.VehicleSDK` singleton (use a kit; make one per game).
- The `/militar|worker/` key sniffing in the body zones (use `meta.bodyLabel` or `meta.bodyKind`).
- Portuguese text anywhere outside `locales/pt-BR.json`.
- `zombiada/plugin.js` and `zombiada/frota/*.js` were never part of the SDK; the fleet is a content pack built on this package.

## What a fleet pack changes

1. Replace `VehicleSDK.register({ k, grp, n, ... }, build)` with `kit.register({ key, group, name, ... }, build)`.
2. Rename the context calls (`c.g` -> `c.vehicle`, `c.rb` -> `c.roundBox`, ...) and the meta keys (`L`, `W`, `clear`, ... -> `length`, `width`, `clearance`, ...).
3. Use English part kinds, glass types, zone types, particle names and state names; use `{ key }` labels where the label is a known part.
4. Move scenario definitions, effect texts and bands to `configure` with the new key names (`zoneEffects`, `partEffects`, `flagEffects`) and `{who}`.
5. Zone ids in saved game data (`zs.h` maps) must be translated once with the table above; `build` takes `{ health, flags }`.
6. Choose the locale: `createVehicleKit({ THREE, locale: 'pt-BR' })` reproduces the original texts exactly.
