# @adatechnology/game-vehicles

A generic procedural vehicle engine for three.js. It builds cars, trucks, buses, bikes, quads, tractors, tanks, boats, planes and helicopters from
primitives (body shells, glass, lights, wheels, interiors, hood and engine bay) and gives each vehicle **damage zones with health from 0 to 100** in
five visual bands, cracking glass, dents, flying parts, fluids, particles, rollover, fire and explosions. A small widget set draws a damage map.

The engine has **no content**: no fleet, fuels, scenarios or game texts. A *content pack* (a plugin) registers its vehicles and its own data.
Everything is deterministic: the same vehicle in the same state with the same zone health always produces the same vertices.

`three` is a **type-only peer dependency**: the host passes its own `THREE` namespace to `createVehicleKit`, so the package never bundles three.js.

## Install

```sh
pnpm add @adatechnology/game-vehicles three
```

Browser without a bundler (the global is `GameVehicles`):

```html
<script src="https://unpkg.com/three@0.128.0/build/three.min.js"></script>
<script src="https://unpkg.com/@adatechnology/game-vehicles/dist/index.global.js"></script>
<script>
  const kit = GameVehicles.createVehicleKit({ THREE })
</script>
```

An offline, single-file example (three.js and the IIFE inlined) is built by `pnpm build && pnpm --filter @adatechnology/game-vehicles example:build`
into `example/dist/vehicles-example.html`. Add `?lang=pt-BR` to switch the language.

## Quick start

```ts
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'

const kit = createVehicleKit({
  THREE,
  locale: 'en', // 'en' (default), 'pt-BR', your own registered code, or a partial string table
  document, // optional; defaults to the global document (used for canvas textures)
  plugins: [myContentPack], // optional; same as kit.plugin(myContentPack)
})

// 1. register a vehicle: a spec and a build function that draws into the build context `c`
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

// 2. build it and add it to the scene
const c = kit.build('meteor', 'intact')
scene.add(c.root)

// 3. damage: a health per zone id, or a scenario, or a point impact
const state = { health: { hood: 38, windshield: 0 }, flags: { burnt: true } }
scene.remove(c.root); kit.dispose(c)
const hurt = kit.build('meteor', 'intact', state)
scene.add(hurt.root)

// 4. animate (particles, fluids, hood, rollover, explosions)
kit.tick(hurt, dt)
```

Axes: **+x is the front**, +y is up, +z is the right side (the driver sits at negative z), the ground is y = 0, units are metres.

## Concepts

**Kit.** `createVehicleKit` returns an independent object: its own registry, caches and configuration. Make one per game (or per test).

**Build states.** `'intact'`, `'damaged'` and `'modified'` (armour and fittings). The state is part of the random seed, so the three differ in small
details. `'damaged'` also applies the scenario named by `config.damagedScenario` (a pack sets it) when no zone state is given.

**Zones and bands.** Every vehicle gets named zones (`hood`, `door_front_left`, `windshield`, `wheel_front_right`, `engine`, ...) derived from its
`c.meta` (front, rear, width, belt, top, clearance, glasshouse, wheels, glass, lights, parts) and refined by the builder. A zone has health 0..100
and a band decided by the health:

| Band | Id | Health | Look |
|---|---|---|---|
| 0 | `intact` | 76 to 100 | Fine scratches at most |
| 1 | `scratched` | 51 to 75 | Scratches and chips |
| 2 | `dented` | 26 to 50 | Dents, hanging parts |
| 3 | `destroyed` | 1 to 25 | Heavy deformation, parts fall off |
| 4 | `torn_off` | 0 | The part is gone |

Bands only change the look when the band changes; `kit.build(key, state, zoneState)` rebuilds the vehicle and reapplies every zone.

**Content packs.** A pack is a plugin: `{ name, configure, install(kit) }`. `configure` accepts everything in the configuration table below and
`install` can call `kit.register(...)`, `kit.scenario(...)`, `kit.defineFluid(...)`, `kit.on(...)` and so on. The engine never imports a pack.

**Locale.** Every user-visible string (zone and part names, band names, effect texts, UI text) comes from a string table. English is built in
(`locales/en.json`) and Brazilian Portuguese is included (`locales/pt-BR.json`). A partial table falls back to English key by key.

```ts
import { registerLocale } from '@adatechnology/game-vehicles'
registerLocale('es', { bands: { intact: 'Intacto', torn_off: 'Arrancado' } })
const kit = createVehicleKit({ THREE, locale: 'es' }) // everything else stays English
```

A content pack adds its own strings under its own top-level key with `kit.registerLocale(code, table)`. The kit keeps the locale it was
created with, so `kit.t('mypack.some.key')` reads from it, with English as the fallback.

## API

### Kit options (`createVehicleKit(options)`)

| Option | Meaning |
|---|---|
| `THREE` | The three.js namespace (required) |
| `locale` | A registered code (`'en'`, `'pt-BR'`, `'pt'`), or a partial string table. Default `'en'` |
| `document` | Document for canvas textures and the UI; default the global one |
| `plugins` | Plugins installed in order |
| anything else | A configuration (below), as if passed to `kit.configure` |

### Configuration (`kit.configure(options)` and `plugin.configure`)

| Key | Meaning |
|---|---|
| `bands` | Five `{ name, color, min, health }` overrides |
| `zoneEffects` | Effect text of a zone by `fxKey` or zone type, five texts (one per band); `{who}` is the occupant |
| `partEffects` | Effect text by part kind (crash report) |
| `scenarios` | Scenario definitions (see below) |
| `flagEffects` | Visual effect of a scenario flag: `{ order, settle, apply(c, flags, kit) }` |
| `fluids` | Fluid types for splats: `{ fresh, dry, dryTime, roughFresh, roughDry, metalFresh, metalDry, wipeable }` |
| `fuels`, `groups`, `waterGroups` | Registries for the pack's own use |
| `palette.rust` | Rust colour |
| `plate`, `texts` | Default plate text; `texts` has `who`, `noEffect`, `plate`, `ui` |
| `impactStain`, `defaultSplat` | Fluid key of the stain an impact leaves; default fluid of `splat` |
| `defaultGroup`, `damagedScenario` | Group of vehicles without one; scenario of the `'damaged'` state |

### Kit methods

| Area | Methods |
|---|---|
| Registry | `register(spec, build)`, `find(key)`, `fleet`, `configure`, `plugin`, `on`/`hook`, `scenario`, `defineFluid` |
| Lifecycle | `build(key, state?, zoneState?)`, `dispose(c)`, `tick(c, dt)`, `settle(c, seconds)`, `defaultDamage(c)` |
| Zones | `bandOf(health)`, `zonesOf(c)`, `applyZones(c, state)`, `zoneScenario(c, id)`, `zoneOverall(c)`, `zoneAt(c, point)`, `zoneDamageAt(c, point, dir, force)`, `zonePoint(c, zone)`, `zoneEffect(zone, health?)`, `zoneOwner` |
| Events | `impact(c, point, dir, force, options?)`, `zoneImpact(c, side, force)` (side: `front`, `rear`, `left`, `right` or `rolled`), `explode(c, options?)`, `blastDamage(c, amount)`, `roll(c, side?)`, `setHood(c, open)` |
| Fluids and particles | `splat`, `puddle`, `wipe(c, mode)` (`wiper` or `rain`), `spawn`, `burst`, `addEmitter` |
| Builders | `car`, `shell`, `addGlass`, `headlight`, `taillight`, `lightBar`, `grille`, `emblem`, `seat`, `interior`, `dashboard`, `steeringWheel`, `busRows`, `makeHood`, `engineBay`, `truckCab`, `truckChassis`, `spokedWheel`, `tracks`, `underbody`, `archFlare`, `jerryCan`, `geo.*` |
| Data | `bands`, `scenarios`, `fleet`, `fluidTypes`, `flagEffects`, `zoneEffects`, `partEffects`, `materials`, `config`, `strings`, `t(key, vars?)` |
| UI | `ui.damageMap`, `ui.bandButtons`, `ui.legend`, `ui.healthBar`, `ui.scenarioButtons`, `ui.zoneLabel`, `ui.bandRange`, `ui.css`, `ui.injectStyles` |
| Plugin helpers | `internals` (`rng`, `strHash`, `zonesOf`, `worldInverseOf`, `hideObj`, `markDecal`, `rayCaster`, `boxCenter`, `wheelInfo`) |

The typed surface (`VehicleKit`, `VehicleContext`, `DamageZone`, `ScenarioDefinition`, `Plugin`, ...) is exported from the package. The low-level
builders take and return three.js objects, so their parameters are loosely typed.

### The build context `c`

`kit.build` returns the context: `c.root` (add it to the scene), `c.vehicle` (the vehicle group, a child of `root`), `c.meta`, `c.zones`,
`c.zoneState` (`{ health, flags }`), `c.parts`, `c.glass`, `c.lights`, `c.wheels`, `c.log` (impact log), `c.rand` (deterministic random) and the
drawing primitives used by builders: `roundBox`, `cylinder`, `sphere`, `rod`, `add`, `part`, `wheel`, `paint`, `zone`, ...

`c.meta` fields: `kind` (`car`, `bike`, `quad`, `tractor`, `truck`, `bus`, `tank`, `boat`, `plane`, `heli`), `length`, `width`, `front`, `rear`,
`clearance`, `belt`, `top`, `bodyHeight`, `roof`, `bed`, `fuselageWidth`, `glasshouse`, `armor`, `damage`, `exhaust`. Missing fields are measured from the
bounding box.

### Scenarios

```ts
kit.scenario({
  id: 'front',
  name: 'Crushed nose',
  init: (x) => { x.limit = x.front - 0.4 * x.length },
  zone: (zone, x) => {
    if (x.center.x > x.limit) x.set(zone, 15 + x.rand() * 20) // health 15..35
    if (zone.type === 'roof') x.flags.flipped = true
  },
})
const result = kit.zoneScenario(c, 'front') // { health, flags, scenario }
const hurt = kit.build('meteor', 'intact', result)
```

`x` has `c`, `meta`, `front`, `rear`, `length`, `width`, `clearance`, `top`, `rand()`, `set(zone, health)`, `flags`, `health`, `center` (of the zone
being visited), `isWindshield`, `bodyTypes`, `clamp`. Built-in flags are `flipped`, `burnt` and `abandoned`; a pack adds more with `flagEffects`.

### The car spec (`kit.car(c, spec)`)

Lengths in metres. The short field names are kept from the original engine and are listed here once.

| Field | Meaning |
|---|---|
| `W`, `col`, `roofCol` | Body width, paint colour, optional roof colour |
| `bottomY`, `noseY`, `tailY` | Lower edge of the body; heights where the front and rear ends are measured |
| `lower` | Side profile `[[x, y, cornerRadius], ...]` from rear to front |
| `arches` | Wheel arches `[[x, wheelCentreY, radius], ...]` |
| `gh` | Glasshouse: `rb`/`rt` rear base/top x, `ft`/`fb` front top/base x, `belt`, `roof`, `Wg` width, `k` softness, `pillars` |
| `hl`, `tl`, `grille` | Headlights and taillights `{ style, w, h, y, in, yaw }`; grille `{ style, w, h, y }` or `false` |
| `interior`, `hood` | Interior `{ rows, col, trim }` or `false`; engine bay `{ motor, front }`, `true` or `false` |
| `wheels` | `[[x, radius, width, options], ...]` |

### UI widgets

Plain DOM and SVG, no framework: `ui.damageMap(host, c, { selected, onSelect })` draws the top-down map (external zones on the outline, internal
ones in a strip below); `ui.bandButtons`, `ui.legend`, `ui.healthBar({ text, bar }, c)`, `ui.scenarioButtons`. `ui.injectStyles()` adds minimal CSS
(`--panel-2`, `--line` and `--muted` customise it).

## Determinism and old seeds

The random stream of a zone is seeded from the vehicle key, the zone id and the band. The first version of this engine used Portuguese ids, so ids
and salts that were renamed keep their original text for seeding (`LEGACY_ZONE_IDS`, `LEGACY_STATES`, `SEED_SALTS`, `legacyZoneId`, and a
`seedId` option on zones). A vehicle looks exactly as it did before the rename. A content pack can set `seedId` on its own zones to keep an older look,
`seedKey` on a vehicle spec (used instead of `key` for every random stream) and `seedId` on a scenario (used instead of `id`), so ids can be renamed without changing a result. `kit.registerLegacySeeds({ zones, glassLabels })` registers the original text of
zone ids and glass keys (shared by every kit); a glass key that contains `windshield` or `rear` counts as the windshield or the rear glass.

Coming from the Portuguese `VehicleSDK`? The complete old-to-new table is in [MIGRATION.md](./MIGRATION.md).

## Destruction contract

`createVehicleDestructible(kit, c, options)` makes a built vehicle follow the `DestructibleImpl` of [`@adatechnology/game-contracts`](../game-contracts), so a test room (or any host) can shoot, burn, blast and unbolt it. It depends on the contracts only (types), not on the default destruction world.

```ts
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'

const item = buildVehicleItem(kit, 'meteor') // origin at the footprint centre, front facing +z
const car = createVehicleDestructible(kit, item.vehicle, { id: 'meteor_1', frame: item.root })
const events = car.hit({ type: 'ballistic', point, direction, energy: 500, caliber: 9 })
car.status() // { canStart, lightsOn, canDrive, brakeFactor, steerPull, flatTyres, ... }
car.animations() // open/close clips for the doors, hood and trunk
```

**Parts.** Every damage zone is a part (steel body panels, doors, hood and fenders; aluminium for aircraft and boats; glass for windows and lights; plastic for bumpers and mirrors; rubber for tyres). The engine adds the mechanical parts the zones do not cover, by vehicle kind and from the meta: `battery`, `alternator`, `gearbox`, `brakes`, `steering`, `shock_absorbers`, `oil_pan`, a separate `tyre_*` for every wheel, `mirror_left/right`, `pillar_a/c_*` on cars and an optional `tow_hitch` (option `hitch`, then the spec flag `hitch`, then a seeded choice). Names are in `locales` (`mechanics.*`).

**Joints.** `hinge` for doors, hood and trunk lid; `bolt` for wheels, fenders, bumpers, mirrors, battery, lights and the mechanics; `weld` for the roof, the pillars and side panels; `glue` for glass; `clip` for the tyre on its rim. Each joint wears when the part it holds is hit, and a wrench, screwdriver or cutting torch undoes it (`disassemble`).

**Detaching.** Bumpers, fenders, mirrors, lights, wheels (and tyres), doors, hood, trunk lid, battery and hitch come off as separate objects and fall (the kit's ballistic animation). Hidden mechanics are logical: `status()` says what they do (brakes: longer stop; steering: pulls to one side; battery or alternator: no start and no lights; gearbox: no drive).

| Hit | Mapped to |
|---|---|
| `ballistic` | hole (through when the energy beats the material), dent when it holds, ricochet at a shallow angle, crack or shatter on glass, leak on a tank, flat tyre |
| `blunt`, `slash` | `kit.impact` for hard blows, dents with depth, damage by distance, joint wear (bumpers and mirrors tear off) |
| `explosive` | `kit.impact`, `kit.blastDamage`, damage by distance; a tank blast gives `explode` |
| `fire`, `heat` | temperature by part, `ignite`, `melt` (tyres, plastic), `burnout`, `explode` when the tank passes its temperature |
| wrench and others | `disassemble` with `disassemble_progress` and `detach` |

Fluids: the tank, the oil pan and the radiator hold fuel, oil and coolant; a hole below the level makes a `leak` event, a puddle and a falling level.

## Português

Motor genérico de veículos procedurais para three.js: carrocerias, vidros, faróis, rodas, interiores, capô e compartimento do motor, **zonas de dano
com saúde de 0 a 100** em cinco faixas visuais, vidros que trincam, peças que soltam, fluidos, partículas, capotagem, fogo e explosões, mais widgets
de mapa de danos. O motor **não tem conteúdo**: frota, combustíveis, cenários e textos do jogo vêm de *content packs* (plugins). Tudo é determinístico.

```ts
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'

const kit = createVehicleKit({ THREE, locale: 'pt-BR' }) // 'en' é o padrão; faltou uma chave, cai no inglês
kit.register({ key: 'meteoro', name: 'Meteoro 1', fuel: 'flex' }, (c) => kit.car(c, spec))
const c = kit.build('meteoro', 'intact', { health: { hood: 38 }, flags: {} }) // estados: 'intact' | 'damaged' | 'modified'
scene.add(c.root)
```

- Eixos: **+x é a frente**, +y é para cima, +z é a direita (o motorista fica em z negativo); unidades em metros.
- Faixas: `intact` 76 a 100, `scratched` 51 a 75, `dented` 26 a 50, `destroyed` 1 a 25, `torn_off` 0.
- Os textos em português estão em `locales/pt-BR.json` e saem exatamente como no SDK original (`Para-choque dianteiro`, `Capô`, `Arrancado`...).
- A API e os nomes agora são todos em inglês; a tabela completa de nomes antigos para novos está em [MIGRATION.md](./MIGRATION.md).
- O exemplo offline (`example:build`) aceita `?lang=pt-BR`.

### Contrato de destruição

`createVehicleDestructible(kit, c, opções)` faz um veículo construído seguir o `DestructibleImpl` de `@adatechnology/game-contracts`: cada zona de dano vira uma peça com material, as peças mecânicas (bateria, alternador, câmbio, freios, direção, amortecedores, pneus, retrovisores, engate) são acrescentadas, as juntas (dobradiça, parafuso, solda) se desfazem por desgaste ou com a chave inglesa, e as peças saem do veículo e caem. `status()` diz o que a mecânica faz (freios, direção, bateria, câmbio). Os nomes em português estão em `locales/pt-BR.json` (`mechanics.*`).

## Light mode and damageable parts

`createVehicleKit({ lod })` takes the settings of the light mode (`defaultLodSettings`: every number can be overridden). `kit.build(key, state, zones, { lod: true })` builds the same vehicle with fewer triangles (rounded boxes with one ring, coarser lofts, grilles and generators, interiors tagged `userData.skipLite`) and puts the switch back; with it off nothing changes. `kit.damageables(c, matrix?)` lists the metal, glass, rubber and fuel parts of a built vehicle as `Box3` boxes (`kit.damageableKinds` maps zone types to parts and can be extended).
