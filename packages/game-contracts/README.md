# @adatechnology/game-contracts

The contracts every game module depends on, and nothing else. Types plus a few tiny pure checkers, **no runtime dependencies**, MIT.

The idea: a vehicle, a chair, a pistol or a house is a *module*. It does not need the default destruction world, a renderer or the test room.
It only needs to agree on a few shapes, and these are they. The destruction package, the weapons package, the fluids package and the test room all
depend on this one and re-export what they used to define, so `import { Hit } from '@adatechnology/game-destruction'` keeps working.

```text
your module ──▶ game-contracts ◀── game-destruction / game-weapons / game-fluids / game-test-room
```

## Install

```sh
pnpm add @adatechnology/game-contracts
```

Browser without a bundler (the global is `GameContracts`):

```html
<script src="https://unpkg.com/@adatechnology/game-contracts/dist/index.global.js"></script>
<script>
  const problems = GameContracts.checkHit({ type: 'blunt', point: [0, 1, 0] })
</script>
```

## What is in it

| Contract | Exports | Used for |
|---|---|---|
| Destruction | `DestructibleSpec`, `PartSpec`, `Hit`, `DestructionEvent`, `ObjectState`, `PartState`, `JointSpec`... | the vocabulary of parts, joints, hits, events and state |
| Impact | `IMPACT_CONTRACT`, `checkHit(hit)` | the fields a weapon or hazard must put in a `Hit`, per damage type |
| Own destruction | `DestructibleImpl`, `checkDestructible(impl, { materials })` | a module that owns its destruction (a car with its own panel rule) |
| Weapons | `Shot`, `Use`, `shotToHit(shot, point, normal?)` | what a weapon produces, and the `Hit` a shot makes at a point |
| Fluids | `ContainerSpec`, `LiquidId`, `ItemUseDef` | what an item says about the liquid it holds and how it is used |
| Animation | `AnimationClipSpec`, `ItemAnimationContract`, `checkAnimation(clip, partIds)` | use animations an item brings (a door `open`, a pistol `reload`) |
| Module | `TestableModule`, `TestableItem`, `ModuleScenario` | what a module hands the test room |

### Destruction: a module owns its object

```ts
import type { DestructibleImpl } from '@adatechnology/game-contracts'
import { checkDestructible } from '@adatechnology/game-contracts'

const impl: DestructibleImpl = {
  id: 'rental_car_1',
  describe: () => ({ parts: [/* body, door_l, wheel_fl... in the impl's local space */] }),
  hit: (hit) => [/* events: every one has object === id and names a part listed by describe() */],
  state: () => ({ /* ObjectState */ }),
}

checkDestructible(impl, { materials: world.materials.keys() }) // { ok, problems }
```

Hits arrive in world space and events go out in world space. `checkDestructible` needs no world: it validates `describe()`, hits the impl with a
500 J ballistic hit, and checks that `state()` matches `describe()`, hit points never go negative, `update(0.016)` returns an array and every event is
well-formed and JSON-serializable. The contracts package does not know your materials: pass their ids (the world's `world.materials.keys()`) or
leave `materials` out to skip that check.

### Weapons

```ts
const hit = shotToHit(shot, point) // { type: 'ballistic', energy: shot.energyAt(distance), caliber, direction, ... }
checkHit(hit)                       // [] when valid
```

### Animations

A clip is plain data: keys with poses (offsets from the rest pose, Euler XYZ) for the item root and for named parts, plus events.
`checkAnimation(clip, partIds)` verifies a snake_case id, a positive duration, ordered times inside the clip, finite vectors, that every moved part
is one of `partIds`, and well-formed events.

```ts
const open: AnimationClipSpec = {
  id: 'open',
  duration: 1.2,
  keys: [{ t: 0 }, { t: 1.2, parts: { door_l: { rotation: [0, 1.1, 0] } } }],
  events: [{ t: 0.15, type: 'sound', data: { key: 'door_latch' } }],
}
checkAnimation(open, ['body', 'door_l']) // { ok: true, problems: [] }
```

### A module for the test room

```ts
import type { TestableModule } from '@adatechnology/game-contracts'

export const RENTAL_CARS: TestableModule = {
  id: 'rental_cars',
  name: 'Rental cars',
  group: 'Rental cars',
  items: (locale) => [{ id: 'rental_car', name: 'Rental car', build: (THREE) => buildCar(THREE), impl: (root, id) => createCarImpl(root, id), animations: [open] }],
  scenarios: (locale) => [/* { id, name, run(ctx) } */],
}

room.loadModule(RENTAL_CARS) // items join the catalogue, scenarios become buttons, contract checks write ✓ / ✗ lines to the log
```

`build` receives the host's three.js namespace and returns its `Object3D` (both are `unknown` here: this package has no dependency on three.js).
`impl` receives the object id the host gives the item and `DestructibleImpl.id` must equal it.

### A bench for the module

A module can also declare a bench as data: `controls` (number, boolean, choice, action), `layers` (things the viewer turns on or off) and
`metrics` (counters the host pulls with `read()` a few times a second). The host keeps the values, draws them, and lends the module a
`ModuleBench` in `attach` (`host.bench`): `value(id)`, `layer(id)`, `onChange(listener)` (right after `attach` it gets one change per control and
layer, in order), `patch(id, { hidden, disabled, options, value })` (no echo) and `look(eye, target)`. `checkBench({ controls, layers, metrics })`
checks the declaration (snake_case ids unique across the three, `min < max`, `step > 0`, defaults in range and among the options, `max > 0`).
A choice's options may carry a `group` (the host lists them under that heading; the options of a group sit next to each other, and `checkBench` says
so when they do not). `ModuleBench.sheet(sheet)` puts a card on the host's panel (`BenchSheet`: kicker, title, body, facts, steps, colour swatches, note and a
timeline of segments whose playhead follows a module metric); a host with no sheet area leaves it out.

### Effects the host lends

`ModuleHost.effects` is an `EffectSink`: `play({ effect, point, direction?, normal?, seed?, param?, scale? })` starts an effect of the host's catalogue by id
and answers a handle (or `null` when the host does not know it), `stop(handle)` ends a looping one, and `configure`, `stats` and `catalog` are optional. The
`explosion` host event carries `explosive` (the id of the explosive), `PartSpec.explodes.effect` and the `explode` event name the effect of a part's blast.

```ts
controls: () => [
  { kind: 'choice', id: 'distance', name: 'Distance', options: [{ id: 'near', name: 'Near' }, { id: 'far', name: 'Far' }], default: 'near' },
  { kind: 'action', id: 'replay', name: 'Replay' },
],
layers: () => [{ id: 'smoke', name: 'Smoke' }],
metrics: () => [{ id: 'particles', name: 'Particles', max: 400, read: () => fx.particles }],
```

Tool events are named after a tool's cycle, not a firearm: `mode`, `fault`, `clear` (start / end) and `safety`, and `shot` carries `rounds`
(cartridges spent) next to `shots` (projectiles, always 1 or more) and the `mode`; a dud round is its own `misfire` event, not a `shot` of zero. `HostTool` may report `mode`, `fault`, `safety` and `heat` (0..1).
`host.configureTool(settings)` takes a `Record<string, string>` keyed by the id of the module's own control; the test room applies `condition` and `ammo_quality` and ignores other ids.

## API

Everything is exported from the package root; see `src/*.ts` for the doc comments. Units: metres, seconds, joules, millimetres (calibre), degrees Celsius.

## Português

Os contratos de que todo módulo de jogo depende, e só isso: tipos mais alguns verificadores pequenos e puros, **sem dependências em tempo de
execução**. Um carro, uma cadeira, uma pistola ou uma casa é um *módulo*; ele não precisa do mundo de destruição padrão, de um renderizador nem da
sala de testes, só concordar com estas formas. Os pacotes de destruição, armas, fluidos e a sala de testes dependem deste e reexportam os tipos que
antes definiam, então `import { Hit } from '@adatechnology/game-destruction'` continua funcionando.

- **Destruição própria**: `DestructibleImpl` (o módulo manda no seu objeto) e `checkDestructible(impl, { materiais })`, que valida `describe()`,
  aplica um golpe de 500 J e confere eventos e estado sem precisar de mundo.
- **Impacto**: `IMPACT_CONTRACT` e `checkHit(hit)` dizem quais campos cada tipo de dano exige.
- **Armas**: `Shot`, `Use` e `shotToHit(shot, ponto)`.
- **Fluidos**: `ContainerSpec`, `LiquidId` e `ItemUseDef`.
- **Animações**: `AnimationClipSpec` e `checkAnimation(clipe, idsDasPeças)` (uma porta `open`, uma pistola `reload`).
- **Módulo**: `TestableModule` entrega itens, animações e cenários à sala de testes; `room.loadModule(modulo)` roda as verificações e escreve linhas
  ✓ / ✗ no log. Assim o módulo de um carro de aluguel já nasce com as suas animações e o seu jeito de quebrar.
- **Bancada**: o módulo declara `controls`, `layers` e `metrics` como dados; a sala guarda os valores, desenha e empresta `host.bench`
  (`ModuleBench`). `checkBench` valida a declaração. Eventos de ciclo da ferramenta: `mode`, `fault`, `clear`, `safety`, e `rounds` no `shot`.
