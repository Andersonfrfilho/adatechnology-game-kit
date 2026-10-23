# @adatechnology/game-interactables

Renderer-agnostic runtime for interactive world objects: movable parts (doors, drawers, lids, knobs), containers with pickable items and
deterministic loot, a logical power grid (meter, circuits, sockets, switches, devices), fuel (gas bottles, charcoal), a logical water network,
seats and beds, soft volumes that sway instead of blocking, effect emitters, mirrors, colliders and damage.

The package draws nothing. Content packs describe objects as `ObjectSpec` data (see `src/types.ts`), the host adds them to a `World`, calls
`update(dt)` every frame and draws whatever the world reports (part poses, active emitters, mirrors, colliders, sway). `three` is not required.

## Install

```sh
pnpm add @adatechnology/game-interactables
```

Browser without a bundler (the global is `GameInteractables`):

```html
<script src="https://unpkg.com/@adatechnology/game-interactables/dist/index.global.js"></script>
<script>
  const world = GameInteractables.createWorld({ seed: 'level-1' })
</script>
```

## Usage

```ts
import { createWorld, poseOf, type ObjectSpec } from '@adatechnology/game-interactables'

const world = createWorld({
  locale: 'en',
  seed: 'level-1',
  items: { can: { id: 'can', category: 'food', size: [0.07, 0.11, 0.07], weight: 0.4, stack: 6 } },
  loot: { pantry: { fill: 0.7, entries: [{ type: 'can', weight: 1, qty: [1, 3] }] } },
  strings: { en: { 'prompt.door.closed': 'Open {name}', 'prompt.door.open': 'Close {name}', 'type.cupboard': 'cupboard' } },
  onEvent: (e) => console.log(e),
})

const cupboard: ObjectSpec = {
  type: 'cupboard',
  parts: [{ id: 'door', pivot: [-0.4, 0, 0.3], motion: { kind: 'hinge', angle: -Math.PI / 2 }, sweep: [-0.4, 0.3, 0.4, 1.1], label: 'prompt.door' }],
  containers: [{ id: 'main', access: 'door', volume: { center: [0, 0.5, 0], half: [0.4, 0.4, 0.25] }, slots: [{ pos: [0, 0.1, 0], max: [0.3, 0.3, 0.3] }], loot: 'pantry' }],
}
world.add('kitchen_cupboard', cupboard, { x: 2, y: 0, z: -1, ry: Math.PI })

// once, after placing objects next to walls: the door never opens through them
world.fitSweep('kitchen_cupboard', 'door', (x, z) => isWall(x, z))

// every frame
world.update(dt)
const look = world.target({ x: cam.x, y: cam.y, z: cam.z, yaw, pitch }) // best interaction or null
if (look) hud.show(look.label) // "Open cupboard"
if (pressedUse && look) look.act()

// drawing a part: pose is relative to the part's pivot
for (const o of world.objects()) {
  for (const p of o.spec.parts ?? []) {
    const pose = poseOf(p.motion, world.partT(o.id, p.id)) // { position, rotation: { axis, angle }, scale }
  }
}
```

Coordinates in a spec are local to the object: front is `+z`, origin at the center of the footprint on the floor, meters. `Transform.ry` rotates
around `+y` like `three.js` (`+z` turns toward `+x` for a positive angle). View `yaw` follows the camera convention: yaw 0 looks toward `-z`.

## Behaviour

- **Parts** animate toward their target at `motion.speed` (default 2.5 t/s). `requires` keeps a part from opening while another one is not open and closes it
  with that one (a drawer behind a door closes with the door). `fitSweep(object, part, blocked)` samples the swept `sweep` rectangle (rotating the leaf for hinges, translating for slides),
  returns the largest safe `t` (when a part declares `bounds`, the whole closed-pose slab is moved through the motion, so leaf thickness, hinge offset and horizontal hinge axes count) and clamps the part to it for good. A part counts as open from `t >= 0.5` (or 90% of its clamped limit).
  Parts that share a `group` move together: `setPart` or a toggle on any member sets the target of all (blind slats, curtain panels).
- **Default interactions**: when a spec has no `interactions`, the world derives them. Labelled parts give `toggle_part`; containers without an
  access part give `open_container`; devices, switches, fixtures, burners (and `ignite` for `needsIgnition`), gas valves and seats get the
  matching action. Explicit `interactions` replace the derived ones. Ids are `part.<id>`, `open.<container>`, `device.<id>`, `channel.<id>`,
  `switch.<id>`, `fixture.<id>`, `burner.<id>`, `ignite.<id>`, `fuel.<id>`, `seat.<id>`; world-wide `object:interactionId`.
- **Labels**: the world looks up `<label>.open|.closed` (parts, valves, containers) or `<label>.on|.off` (devices, fixtures, burners,
  switches), then `<label>`, then an engine default (`prompt.open`, `prompt.turn_on`, ...). `{name}` is replaced by `type.<type>` or a humanized
  type id.
- **Targeting**: `target(eye, { reach = 1.8, cone = 0.45 })` scores by distance and angle to the view direction. `take`/`read` of closed
  containers and the wrong half of `ignite`/charcoal toggles are skipped.
- **Containers**: contents from `contents` or deterministic loot seeded with `seed + object id + container id`. An item fits a slot when its size
  is within the slot's `max` (width and depth may swap). `take` needs the container to be accessible and the item pickable and emits `pickup`.
- **Power**: `grid`, a breaker per circuit (default on), sockets (optionally on a circuit) and devices plugged to a socket (`auto` = nearest free
  socket within 2 m, across the whole world) or hard-wired to a circuit. `powered = grid && breaker && socket found`. A device that is on but
  unpowered stays on, reports `powered: false` and emits the `no_power` message. Switches toggle the listed devices (`object:device` or local ids).
  The `toggle_breaker` action (`{ do: 'toggle_breaker', circuit, part? }`) flips a circuit from a breaker panel, mirrors the optional rocker `part`
  (t = 1 when on) and uses the prompts `prompt.breaker_on|off` (`{circuit}` is the circuit id).
- **Fuel**: burners need fuel and, for a bottle with a valve, the valve open. `fuel: 'auto'` = nearest gas source within 2 m. Gas is consumed
  while lit; running out or closing the valve puts the flame out, and a gas knob left on without gas lights by itself when the valve opens. Charcoal needs `ignite`, burns until empty, and `toggle_burner` puts it out.
  Smoke emitters of solid fuel linger 20 s after the fire is out, fading.
- **Water**: tanks (`capacity`, `level`, `rainArea`), a default tank, fixtures that flow while on and supplied. With `options.waterSupply`, fixtures
  draw through it (`flow / 60 * dt` liters, a flush draws `volume` once). Dry fixtures stay "on" but report `flowing: false`.
- **Seats**: one actor per seat. `sit` returns the world eye position and yaw, `stand` returns the world exit point.
- **Soft volumes** never block and are never colliders. `push(pos, radius, vel)` swings them; they settle back by a damped spring. Wind adds a
  small oscillating force. A `panel` with a `part` opens when pushed from the front.
- **Damage**: `hp` per target. A destroyed gas source with fuel explodes (`radius = 2 + level / 5`) and empties; a damaged tank leaks once and
  drains; glass is just an event.
- **Save/load**: `serialize()` is plain JSON; `load()` restores it onto a world that has the same objects added. Swept limits (`fitSweep`) are
  not saved, call it again after loading.

## API

```ts
createWorld(options?: WorldOptions): World
```

`WorldOptions`: `locale`, `strings`, `items`, `loot`, `seed`, `grid`, `rain`, `wind`, `waterSupply`, `onEvent`, `canInteract`.

| Group | Members |
|---|---|
| Objects | `add(id, spec, transform)`, `remove(id)`, `get(id)`, `objects()` |
| Frame | `update(dt)` |
| Interaction | `interactables()`, `target(eye, { reach?, cone? })`, `act(id, actor?)` |
| Parts | `partT`, `setPart(object, part, target, instant?)`, `fitSweep(object, part, blocked)` |
| Containers | `contents`, `accessible`, `take`, `put`, `slotPosition` |
| Power | `power.grid`, `setGrid`, `setBreaker`, `breaker`, `isPowered`, `isOn`, `pluggedInto`, `channel` |
| Fuel | `fuelLevel(object, fuel)`, `isLit(object, burner)` |
| Water | `water.setDefaultTank`, `level`, `refill`, `setRain`, `isFlowing` |
| Seats | `sit`, `stand`, `seatOf` |
| Soft | `push`, `sway`, `setWind` |
| Draw | `emitters()`, `mirrors(eye, maxDistance?, count?)`, `colliders()` |
| Damage | `damage(object, target, amount, kind?)`, `hp(object, target)` |
| Text | `t(key, vars?)`, `setLocale(locale)` |
| Save | `serialize()`, `load(state)` |

Standalone helpers: `rng(seed)`, `generateLoot(tables, tableId, slots, seed, items)`, `poseOf(motion, t)`, `localToWorld(transform, v)`,
`worldToLocal`, `rotY`, `rotateAxis`, `fitsSize`, `fitsSlot`, `resolveStrings(locale, extra)`, `locales`, `format`, `pickLocale`.

`poseOf(motion, t)` returns `{ position, rotation: { axis, angle }, scale }` relative to the part's pivot: hinge, rocker and knob rotate,
slide translates along `axis * distance * t`, scale scales along `axis`.

## Events

`onEvent` receives every change:

| `type` | Fields |
|---|---|
| `part` | `object`, `part`, `t`, `target` (on a new target and again on arrival) |
| `pickup` | `object`, `container`, `slot`, `stack`, `actor` |
| `device` | `object`, `device`, `on`, `powered`, `channel?` |
| `switch` | `object`, `switch`, `on` |
| `fixture` | `object`, `fixture`, `on`, `flowing` |
| `burner` | `object`, `burner`, `on`, `lit` |
| `seat` | `object`, `seat`, `actor`, `seated` |
| `damage` | `object`, `target`, `hp`, `destroyed` |
| `explosion` | `object`, `pos`, `radius` |
| `leak` | `object`, `target`, `pos` |
| `message` | `key`, `text` (localized): `no_power`, `no_gas`, `no_water`, `locked`, `empty`, `full`, or an item text key from a `read` |
| `power` | `grid` |
| `container` | `object`, `container`, `open` (an open shelf was "opened") |

## Locales

Engine-level strings exist in `en` and `pt-BR`: `prompt.open`, `prompt.close`, `prompt.turn_on`, `prompt.turn_off`, `prompt.take`, `prompt.sit`,
`prompt.lie_down`, `prompt.get_up`, `prompt.light`, `prompt.change_channel`, `prompt.read`, `prompt.open_valve`, `prompt.close_valve` and the
messages above. Content packs add their keys through `options.strings`; unknown keys fall back to English, then to the key itself.

## Português

Runtime sem renderer para objetos interativos do mundo: portas, gavetas e tampas que se movem, recipientes com itens e loot determinístico por
semente, rede elétrica lógica (medidor, circuitos, tomadas, interruptores, aparelhos), combustível (botijão de gás, carvão), rede de água lógica,
assentos e camas, volumes macios (cortinas, folhagem) que balançam sem bloquear, emissores de efeitos, espelhos, colisores e dano.

```ts
const world = createWorld({ locale: 'pt-BR', seed: 'fase-1' })
world.add('armario', especificacao, { x: 2, y: 0, z: -1, ry: Math.PI })
world.update(dt)
const alvo = world.target({ x, y, z, yaw, pitch }) // ex.: "Abrir armário"
alvo?.act()
```

O pacote não desenha nada: você informa o `ObjectSpec` (dados), chama `update(dt)` a cada quadro e desenha o que o mundo reportar. Os textos do
motor (`Abrir`, `Ligar`, `Sem energia`, `Sem gás`, `Sem água`...) vêm em `pt-BR`; os pacotes de conteúdo acrescentam as suas chaves em `strings`.
