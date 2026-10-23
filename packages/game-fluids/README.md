# @adatechnology/game-fluids

Engine-agnostic liquids for games, with no renderer. It knows nothing about any game: the host moves the containers, gives it surfaces and calls
`update(dt)`; the package answers with events and plain state that any renderer (see `@adatechnology/game-fluids-three`) can draw.

- **Containers** (cup, bottle, jerrycan, tank) with a level computed from their shape and tilt, a temperature (cools towards ambient, steams when
  hot), an opening and an optional lid. Fill, pour, drink, spill over the lip when tilted, leak through holes.
- **Streams**: the jet leaving a lip or a hole. Ballistic, it ends on the first surface it hits (planes with half extents) or on the ground.
- **Stains**: grow from a flow front (16 radial samples, never a perfect disc), run downhill, soak into porous surfaces, dry from the edge in and
  either vanish or leave a permanent mark (coffee, blood, oil).
- **19 built-in liquids** (`LIQUIDS`): water, coffee, tea, milk, soda, juice, beer, wine, spirits, fuel, diesel, motor_oil, cooking_oil, blood,
  sap, acid, paint, bleach, honey. Each one has its own colour, viscosity, drying time, gloss and drink effects (`caffeine`, `alcohol`, `poison`,
  `disgust`).
- **Item uses** (`ITEM_USES`): scripted `sip`, `drink`, `chug`, `pour`, `pour_out`, `open` and `close`, as pure keyframe data plus a player.
- Deterministic from a seed (no `Math.random`), so a LAN host can run it and send events. `serialize()` / `load()` round trip the whole world.
- Units: metres, litres, seconds, degrees Celsius. Locale table `en` / `pt-BR` for liquid names and event labels.

Contracts live in [`@adatechnology/game-contracts`](../game-contracts); the types are re-exported here, so existing imports keep working.

## Install

```sh
pnpm add @adatechnology/game-fluids
```

Browser without a bundler (the global is `GameFluids`):

```html
<script src="https://unpkg.com/@adatechnology/game-fluids/dist/index.global.js"></script>
<script>
  const world = GameFluids.createFluids({ seed: 1 })
</script>
```

## Usage

```ts
import { createFluids, createItemUse, ITEM_USES } from '@adatechnology/game-fluids'

const fluids = createFluids({ seed: 42, locale: 'en', onEvent: (e) => console.log(fluids.describe(e)) })

fluids.addSurface({ id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [10, 10], porosity: 0.05 })
fluids.addSurface({ id: 'rug', point: [2, 0.01, 0], normal: [0, 1, 0], halfSize: [1, 1], porosity: 0.9 })

const cup = fluids.addContainer(
  {
    capacity: 0.25,
    liquid: 'coffee',
    liters: 0.25,
    temperature: 90,
    shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, // inner shape, origin at the inner bottom centre, +Y up
    opening: 0.04,
  },
  { id: 'cup', position: [0, 0.8, 0] },
)

// every frame: keep the container in sync with the object that carries it, then step
fluids.setTransform(cup, object.position, object.quaternion, velocity)
for (const event of fluids.update(dt)) {
  if (event.type === 'drink' && event.effects.includes('caffeine')) player.energy += event.thirst * 0.1
}
```

Events from direct calls (`drink`, `fill`, `puncture`, `splash`...) are delivered once: to the listeners at once and, for `drink`, as its return value; `update` never repeats them. `update` returns the events it produced, in order, and also fires `onEvent` and the listeners registered with
`fluids.on(type | '*', fn)`. Use `fluids.describe(event)` for a localised one-liner, handy for a debug panel or a log.

Draw from the state, never from the events: `container(id)`, `containers()`, `streams()` and `stains()` return plain copies.

### Spilling, pouring and holes

Tilt the container (`setTransform` with a rotated quaternion): the liquid surface keeps its volume and stays horizontal; when it rises above the
lowest point of the lip, liquid spills over it with a rate proportional to the excess and the opening (Torricelli, divided by the square root of the
viscosity), creating a `spill` stream. A closed container never spills or pours. `fluids.pour(id, dt, into?)` forces flow out of the opening for
`dt` seconds (optionally into another container). `puncture(id, point, normal, diameter)` makes a hole: it leaks (one `leak` stream per hole) while
the liquid is above it and stops once the level falls below.

### Taps

A tap is a fixed source (a sink, a pipe, a hose end):

```ts
const sink = fluids.addTap({ position: [0, 1.0, -2], liquid: 'water', rate: 0.1 }) // direction [0, -1, 0], on by default
fluids.setTap(sink, false) // off; fluids.setTap(sink, true, 0.2) turns it on at 0.2 l/s
fluids.removeTap(sink)
```

While on it is a `tap` stream (`streams()` lists it with `tap: <id>`): it fills any container whose opening it lands in (the same logic as pouring
into a cup) and otherwise makes a stain where it lands. Switching emits `{ type: 'tap', tap, on }`. `taps()` returns the state of every tap, and
taps are part of `serialize` / `load`.

### Using it with `@adatechnology/game-destruction`

The damage model reports `leak` events for parts that hold a fluid. Map them one to one onto `puncture`; the container then loses liquid by
Torricelli and the stream and stains follow:

```ts
import type { DamageEvent } from '@adatechnology/game-destruction'

destruction.on('leak', (e) => {
  // e.part is the damaged part, e.point the world hit point of the hole, e.direction where the fluid leaves
  const id = containerOfPart(e.part)
  if (!id) return
  const local = worldToContainer(id, e.point) // container space: origin at the inner bottom centre
  const normal = worldDirToContainer(id, e.direction)
  fluids.puncture(id, local, normal, 0.009) // hole diameter in metres (e.g. a 9 mm bullet)
})
```

Keep `fluids.setTransform` in sync with the destructible object so the hole follows it. A fuel tank punctured near the bottom leaks until the level
falls under the hole; the fuel stain (`flammable` liquid) can be handed to the fire system by the host.

### Item uses

```ts
const use = createItemUse(fluids, 'cup', ITEM_USES.find((u) => u.id === 'sip')!, () => ({ position: handPos, rotation: handQuat }))
// every frame
for (const event of use.update(dt)) log(fluids.describe(event))
viewmodel.position.set(...use.pose().position) // hand-relative pose, Euler XYZ for the rotation
if (use.done) /* ... */
```

| id | duration | what it does |
|---|---|---|
| `sip` | 1.2 s | raise to the mouth, small tilt, drinks 0.03 l |
| `drink` | 2.5 s | raise, tilt about 70 degrees, drinks about 0.2 l, back down |
| `chug` | 4 s | long tilt, drinks until empty or 0.5 l |
| `pour` | 3 s | tilt 100 degrees outward, `pour` action |
| `pour_out` | 4 s | empties the container on the floor |
| `open` / `close` | 1 s | removes / puts the lid |

While the current key has `action: 'drink'` the player calls `world.drink(rate × dt)` (litres per second in `rate`); with `'pour'` it calls
`world.pour(dt × rate)`; `'open'` and `'close'` fire once when their key is reached. If a `getHandTransform` callback is given, the container follows
hand ∘ pose; otherwise the host animates its own viewmodel from `pose()`. `def.liquids` restricts the use to some liquids. Write your own
`ItemUseDef` to add `eat`, `wipe` and so on.

## API

| Export | What it is |
|---|---|
| `createFluids(options?)` | Creates a `FluidWorld`. Options: `liquids`, `locale`, `seed`, `ambientC`, `gravity`, `groundAt(x, z)`, `mergeDistance`, `maxStains`, `onEvent` |
| `LIQUIDS` | The 19 built-in `LiquidDef`s (`id`, `color`, `opacity`, `stainColor`, `viscosity`, `density`, `dryTime`, `leavesMark`, `gloss`, `drink`...) |
| `ITEM_USES` | The built-in `ItemUseDef`s |
| `createItemUse(world, containerId, def, getHandTransform?)` | Returns an `ItemUsePlayer` (`pose()`, `update(dt)`, `cancel()`, `time`, `done`) |
| `sampleStream(stream, gravity, t)` | Point of a stream's path at time `t` (0 to `flightTime`) |
| `stainDirection(stain, i)`, `STAIN_SAMPLES` | World direction of the front sample `i` of a stain (16 samples) |
| `describeEvent(strings, event)`, `resolveStrings(locale)`, `locales` | Localised event text and liquid names |

`FluidWorld` methods: `addContainer`, `removeContainer`, `setTransform`, `open`, `close`, `fill`, `pour`, `drink`, `puncture`, `heat`, `addSurface`,
`removeSurface`, `addTap`, `setTap`, `removeTap`, `taps`, `splash`, `clearStains`, `update`, `container`, `containers`, `streams`, `stains`, `on`, `describe`, `serialize`, `load`, plus
`liquids` and `gravity`.

Events (`FluidEvent.type`): `fill`, `pour`, `spill`, `leak`, `drink`, `empty`, `stream_end`, `splash`, `stain`, `dried`, `steam`, `mix`, `tap`.

Notes: liquid ids and event types are snake_case data ids and part of the public contract. Colours in `liquids.json` are `0xRRGGBB` stored as
integers; density is in kg/m³ and viscosity is relative to water. The surface id `ground` is reserved for the implicit ground (`groundAt`).

## Português

Líquidos sem renderizador, para qualquer engine: copos, garrafas, galões e tanques com nível calculado pelo formato e pela inclinação,
temperatura (esfria e solta vapor), beber, despejar, derramar ao inclinar e vazar por furos (ligue os eventos `leak` do
`@adatechnology/game-destruction` em `fluids.puncture`). O líquido que cai vira mancha: cresce a partir de uma frente de fluxo (nunca um disco
perfeito), escorre ladeira abaixo, é absorvido por superfícies porosas e seca de fora para dentro, deixando marca permanente (café, sangue, óleo)
ou sumindo (água). Determinístico por semente, pronto para LAN.

```ts
const fluids = createFluids({ seed: 1, locale: 'pt-BR' })
const use = createItemUse(fluids, 'copo', ITEM_USES.find((u) => u.id === 'drink')!)
for (const e of use.update(dt)) console.log(fluids.describe(e)) // "bebeu: copo café 0.01 l [caffeine]"
```

Com `locale: 'pt-BR'`, `describe` usa os nomes em português ("água", "café", "chá", "leite", "refrigerante", "suco", "cerveja", "vinho",
"destilado", "gasolina", "diesel", "óleo de motor", "óleo de cozinha", "sangue", "seiva", "ácido", "tinta", "água sanitária", "mel") e os rótulos
dos eventos ("bebeu", "derramou", "vazando", "encheu", "esvaziou", "mancha", "secou"...). Os usos de item prontos são `sip`, `drink`, `chug`,
`pour`, `pour_out`, `open` e `close`.

Torneiras: `fluids.addTap({ position, liquid: 'water', rate: 0.1 })` cria uma fonte fixa (pia, cano); `setTap(id, on, rate?)` liga e desliga e
`removeTap(id)` remove. Ligada, é um fluxo `tap` que enche o recipiente em que cai ou deixa uma mancha, e emite o evento `tap`.
