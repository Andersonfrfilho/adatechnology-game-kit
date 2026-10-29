# @adatechnology/game-test-room

A self-contained first-person test room for three.js. Drop your own catalogue of objects in, walk around, shoot, hit, burn, cut, throw, drink and pour,
and read what happened in plain words in an on-screen behaviour log that you (or an agent) can also export as JSON or NDJSON. Scripted scenarios
check the behaviour and write pass/fail lines to the same log.

It composes `@adatechnology/game-destruction`, `game-destruction-three`, `game-weapons`, `game-fluids` and `game-fluids-three`. `three` is a peer dependency used only as a type: you pass the namespace in.

Contracts live in [`@adatechnology/game-contracts`](../game-contracts); the types are re-exported here, so existing imports keep working.

## Install

```sh
pnpm add @adatechnology/game-test-room three
```

## Usage

```ts
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'

const room = createTestRoom({
  THREE,
  container: document.getElementById('app')!,
  locale: 'en', // 'en' or 'pt-BR'
  catalog: [], // the room ships no items: load modules (`room.loadModule`) or pass your own
})
room.runScenarios().then((report) => console.log(report.passed, report.failed))
console.log(room.log.toNDJSON())
```

The IIFE build exposes `GameTestRoom`. Without an injected `renderer` the room owns the canvas and its render loop.

## Plugging in your own catalogue and scenarios

```ts
const room = createTestRoom({
  THREE,
  container,
  catalog: [
    { id: 'my_crate', name: 'My crate', group: 'Mine', build: (T) => buildMyCrate(T), specOptions: { /* material per mesh name */ } },
  ],
  scenarios: [
    { id: 'my_crate_breaks', name: 'My crate breaks', run: ({ room, step, expect }) => {
      const o = room.spawn('my_crate', [0, 0, -4])
      room.setTool('pistol_9mm')
      room.waitUntilReady() // setTool plays the draw: the tool answers `drawing` until the rule's draw time is over
      room.look([0, 1, -2], [0, 0.5, -4])
      room.use()
      step(2)
      expect(room.world.state(o.objectId)!.parts.some((p) => p.status !== 'intact'), 'a part was hurt')
    } },
  ],
})
```

`buildFromSpec` turns a `DestructibleSpec` into meshes, and `brickWallSpec` (the arena's target wall) is exported to reuse.

## Breaking: the demo catalogue and the built-in scenarios are gone

The room used to ship 19 procedural box/cylinder items (`demoItems`, `DEMO_ITEMS`, `DEMO_MATERIALS`: chair, sofa, crate, jerrycan...) and its built-in scenarios (`SCENARIOS`, `scenariosFor`, `makeScenarios`) built on them. They were not the game's items, so they were removed: the room now holds only the generic contracts and the arena. Migrate:

- `catalog: demoItems(locale)` becomes `catalog: []`, and the items come from the SDK modules loaded with `room.loadModule` (weapons, items, household furniture, vehicles, characters...). `examples/interactables-test-area` loads all of them; `examples/test-room` opens with that set.
- `room.scenarios` is empty until the host passes `scenarios` or a module brings its own. The destruction checks the removed ones made (steel sheet, glass, concrete, fire, collapse) are covered by the tests of `game-destruction`, `game-fluids` and the module scenarios of the content packages.
- A test that needs a throwaway item should define it in its own fixture (see `tests/fixtures/demo-items.ts`, not exported).

## Scenery

The arena holds three destructible pieces by default, hand-made from boxes: `target_wall` (a brick wall of 48 panels at z = -11), `table` (with the water tap on a post beside it, at x = 3.5) and `shelf` (x = -3.5). `scenery` is a registry keyed by arena object id, so a host can use its own pieces without touching the room:

| `scenery[id]` | Effect |
|---|---|
| a key of a default (`target_wall`, `table`, `shelf`) | replaces that piece; `position` defaults to the replaced one's |
| `null` | removes the piece (no table: no tap either) |
| a new key | adds a piece; `position` is required |

```ts
createTestRoom({ ..., scenery: {
  target_wall: { spec: wallSpec, position: [0, 0, -11], build: (THREE) => drawWall(THREE) },
  table: { spec: tableSpec, build: drawTable, top: { part: 'wood_0', y: 0.78 } },
  crate: { spec: crateSpec, position: [0, 0, -4], rotationY: 0.4, label: 'Crate' },
  shelf: null,
} })
```

A `SceneryObject` is `{ spec, position?, rotationY?, colors?, build?, label?, top? }`:

- `spec`: the `DestructibleSpec` the world is given. The player collider is the footprint of its parts (what lies lower than 10 cm is walked over); the `target_wall` collider also closes the arena behind the wall.
- `build(THREE)`: draws the piece as a group whose meshes are named by part id (`userData.destructionPart` too), like `buildFromSpec` does. Without it the room draws one plain mesh per part with `buildFromSpec` and `colors`.
- `top: { part, y }`: loose things rest on that part's footprint at height `y` while the part stands (`room.groundAt`), and liquids pool on it. The tap stands beside the `table` top.
- `spout`: where a water tap of the piece pours (a sink, a tub), in the spec's space. The room's tap pours from the first piece that has one, so the piece's own model is the tap; without one the tap stands on the `table` top (see `tap` below).
- `label`: the name in the inspector and the log (the defaults are translated).

`tap` is the room's water tap: omitted, the room draws a post with an arm beside the table; `{ build(THREE), spout, position?, rotationY? }` puts the host's model there (the origin where it stands, `spout` where the water leaves it; by default it stands on the table top with the spout over its right half); `null` removes it.

## Models of thrown and placed explosives

The room knows the arsenal's ids, not the weapons' models. `projectileModel({ weapon, explosive, kind })` (`kind`: `grenade`, `molotov`, `rocket` or `charge`) is the host's hook: it answers `{ model, axis? }` (`axis`: the length of the model, default +y; a rocket points it along its flight) or `null`, and the room draws a plain primitive (a sphere, a cylinder, a box) only where it answers nothing. `@adatechnology/game-weapons-three` has one: `projectileModel(THREE, query)`.

## Loading a module

A game module hands the room a `TestableModule` from `@adatechnology/game-contracts` (items, each with an optional `impl` for its own destruction and `animations`, plus scenarios):

```ts
const report = room.loadModule(RENTAL_CARS) // { module, items, scenarios, ok, problems }
```

The items join the catalogue under the module's group and its scenarios become buttons. The contract checks run at once and write one line per result to the log: `checkDestructible` for every item with an `impl`, `checkAnimation` for every clip (`✓ Rental car: destructible contract ok (4 parts...)` or `✗ ...: <problem>`). The animations panel lists the clips of the aimed or held item; `room.playAnimation(clipId)` plays one (poses are offsets from the rest pose, events go to the log and `sound` events to `onSound`). The example (`examples/test-room`) loads the SDK's content modules (the same set as `examples/interactables-test-area`).

## Module bench

The room makes **one** effects world (`game-vfx` and its `game-vfx-three` layer) and steps it once per frame, after the destruction renderer. The destruction
renderer draws into it, every module gets it as `host.effects` (an `EffectSink`: `play({ effect: 'm67', point })`, `catalog()`), grenades and rockets play the
profile of their explosive (`explosive` is on the `explosion` host event), the camera shakes and the screen flashes through an overlay in the container, and the
`particles` metric counts its pools. Without a DOM nothing is drawn on the screen. `TestRoom.applyCamera()` wraps a host's own `render`; the room's loop does it itself.
`craters: true` swaps the floor for a deformable patch that big explosions dig into.

A module that declares `controls`, `layers` or `metrics` (see `@adatechnology/game-contracts`) gets a bench: `loadModule` checks it with
`checkBench` (a `✓ ... bench ok` / `✗ ... bench broken` line), lends `host.bench` to `attach`, then sends one change per control and layer. The
panel between the animations and the tests shows the active module (the one of the last `openArea`; else the first loaded with a bench, a later module never takes the panel from the one on screen): a
range per number, a checkbox per boolean, buttons (up to four options, no groups) or a select per choice (options with a `group` sit under `optgroup`s), a button per action, the layers, and the
module counters at 4 Hz with a bar when they have a budget (`warn` from 80 %, `bad` past it). A compact line on top shows the room counters
(`fps`, `frame_ms`, `draw_calls`, `triangles`, `objects`, `fragments`, `particles`, `decals`); `fps` uses the real frame time, so slow motion
does not change it.

```ts
const room = createTestRoom({ ..., metrics: ['fps', 'draw_calls'], bench: { state: { lab: params.get('bench.lab') ?? '' }, onChange: (moduleId, encoded) => keepInUrl(moduleId, encoded) } })
room.bench()?.set('size', 2) // clamped and snapped; false for an unknown id, a wrong type or an option not offered
room.metrics() // { room: { fps, draw_calls, ... }, module: { particles: 120 } }
```

The room's explosions take the blast options of `game-destruction` (`createTestRoom({ blast: { shelter: true } })`, `room.blast()`, `room.setBlast({ fragmentHits: true })`); three HUD toggles (Shelter, Fragments, Confinement; Abrigo, Estilhaços, Confinamento) flip them, and the numbers of the last blast show as the room metrics `blast_shelter` (% that reached the most sheltered target), `blast_confinement` and `blast_fragments`, and as a `blast_report` line in the log.

A module can put a **sheet** on the panel (`host.bench.sheet(sheet)`, `BenchSheet` of the contracts): a card with a kicker, a title, a text, facts, steps, colour swatches and a timeline of named segments whose playhead follows one of the module's numeric metrics.
The room also runs the film of the liquids that have one (`createFilmManager` of `game-fluids-three`): a leak of fuel, oil or blood drips into grids on the floor near the camera.

The state is `id=value;id=value` (`encodeBenchState` / `decodeBenchState`); decoding treats it as hostile input. `bench.state` is keyed by
module id, so two modules can share a control id; a module loaded again keeps its live values. The room never touches
`location`: the example page keeps it in `?bench.<moduleId>=`. `fps` and `frame_ms` use the real frame time, even past the 50 ms the simulation is clamped to. Loading a module again detaches the previous `attach` first. Q now reports the new fire
mode (`mode` event) and `shot` events carry `rounds` and `mode`.

Grenades are cooked: hold the button to pull the pin and let go to throw with the fuse that is left (`cook` host events: `start`, `throw`, `burst` when it goes off in the hand; `room.use(hold)` does the same
by script). A charge set down gets a marker (`charge_marker`, a stake with a flag) and, when it waits for a trip wire (the Claymore), the wire is drawn (`charge_wire`) and the charge goes off by itself
when a body (the player, an object of the room) crosses it; whatever was already on the wire when it was set is let through until it steps off. Y only fires the charges for the remote detonator (C4).

## Controls

| Input | Action |
|---|---|
| Click / Esc | capture / release the mouse (without pointer lock: drag to look) |
| WASD, Shift, Space | walk, run, jump |
| 1-0, wheel | pick a tool from the hotbar |
| Left button | use the tool (shoot, hit, flame, heat, throw, work a joint, extinguish, grab) |
| E | grab / drop |
| R | rotate the held item |
| Right button or G | throw |
| F | use a fluid item (drink); Z tilt; C fill from the tap; V pour (holding a fluid item); otherwise V toggles 1st/3rd person when a body is set (`setAvatar`), and kicks when there is none (Shift+V kicks with a body too; the `kick` tool whatever is selected) |
| Tab | show / hide the panels |

Panels: catalogue tabs (spawn, Clear, Reset all), slow motion 0.25x, time x10, quality select, inspector (material, state, hp, temperature, char, marks, joints, load and stress) and the behaviour log with filters.

## The player's body and the third-person camera

The room is a bare first-person camera until you give it a body. `room.setAvatar(avatar | null)` takes anything shaped like `RoomAvatar` (the room imports no character code):

```ts
interface RoomAvatar {
  root: Object3D
  update(dt: number, state: { speed: number; running: boolean; crouch: boolean; down: boolean; armed: boolean; pitch: number }): void
  hand?(side: 'R' | 'L'): Object3D
}
```

Every frame the room puts `root` at the player's feet turned to where the player looks (the body's front is +z, as the catalogue items'; `rotation.y` is the yaw plus pi) and calls `update` with the ground speed of the player's movement, Shift, `armed` (a firearm is the tool in hand) and the camera `pitch` (radians, positive looking up). `crouch` and `down` are not known to the room: a player module sets them with `room.setAvatarState({ crouch, down })` (`avatarState()` reads them back). `@adatechnology/game-characters-three` has such a body: `toRoomAvatar(createPlayerAvatar(THREE))`.

`room.setCameraMode('first' | 'third')` (option `cameraMode`, property `cameraMode`, event `room.on('camera', fn)`; every change is a `camera` action in the log). V toggles it when a body is set. In `first` the body is hidden; in `third` it is shown, the camera stands over the shoulder, and a carried item rides `avatar.hand('R')` instead of the camera frame. Option `thirdPerson` changes the view; the defaults are the team game's shoulder camera (`zombiada-modo-livre.html`, `cameraUpdate`, line 76546): `back` 3.8 m, `side` 0.9 m to the right, `up` 1.95 m (`crouchUp` 1.4 m), `lift` 0.1 m, three probe rays (`probes` 0 and +-0.2 m) that pull the camera in `margin` 0.3 m short of a wall (never closer than `minDistance` 0.2 m) and let it out at `recover` 4 per second.

The simulation always sees the eye: tools, grabs, scripted walks and the listener work as in first person. Only the render moves the camera (`applyCamera()` does it, a host that renders by itself calls it around its `render`). A shot or grab leaves the eye toward the point the camera ray hits, so the crosshair stays true.

## Log format

One JSON object per line (`log.toNDJSON()`, "Baixar NDJSON"):

```json
{"seq":1,"t":0,"channel":"action","type":"spawn","text":"Spawned Steel sheet with stand at (0.0, 0.0, -4.0)","objectId":"steel_sheet_1","itemId":"steel_sheet","data":{"position":[0,0,-4],"movable":false,"massKg":43.6}}
```

`channel` is `action`, `event` or `check`; `t` is room time in seconds; `data` is machine-readable. `log.toText()` gives the plain-text version and `log.entries({ type, objectId })` filters.

## Scenarios

`room.scenarios` lists them; `room.runScenarios(list?)` resets the room, runs each one deterministically with `step(seconds)` instead of rendering, and returns
`{ passed, failed, results: [{ id, name, ok, checks: [{ label, ok }] }] }`. 21 ship with the package (bullets vs steel, concrete and glass, hammer, shotgun, kick, screwdriver,
fire and torch, gas bottle, bottle drop, thrown chair, coffee sips and spills, jerrycan leak, fuel fire, columns and a roof, extinguisher). Open the example with `?scenario=all` to run them.

### Inside a claude.ai Artifact

An Artifact page cannot use `<a download>` or blob links. When `globalThis.claude.use('downloads')` resolves, `log.download(format)` offers the file through that capability (the NDJSON goes out as `test-room-log.ndjson.txt`, since `.ndjson` is not on the allowlist) and a declined save writes an `export_cancelled` line to the log; otherwise it falls back to the blob link. **The artifact page must declare the `downloads` capability.** "Copy JSON" falls back to selecting the text in a textarea when `navigator.clipboard` is missing.

## Português

Uma sala de testes em primeira pessoa para three.js. Você passa o seu catálogo de objetos, anda, atira, bate, queima, corta, arremessa, bebe café e
derrama líquidos, e lê o que aconteceu em linguagem simples no registro de comportamento (também exportável em JSON, NDJSON ou texto). Os cenários
automáticos conferem o resultado e gravam aprovado/reprovado no mesmo registro. Use `locale: 'pt-BR'` para textos em português.

Um módulo que declara controles, camadas ou contadores ganha um painel de bancada genérico; o estado vai para a URL do exemplo (`?bench.<idDoMódulo>=`) e
`room.bench()` / `room.metrics()` dirigem e leem a bancada por script.

Corpo do jogador: `room.setAvatar(corpo)` põe um corpo (qualquer objeto no formato `RoomAvatar`) nos pés do jogador; `room.setCameraMode('first' | 'third')` e a tecla V alternam entre 1ª e 3ª pessoa (câmera sobre o ombro com os números do jogo da equipe, puxada para perto de paredes). `room.setAvatarState({ crouch, down })` deixa um módulo de jogador agachar e derrubar o corpo. Com corpo, V alterna a câmera e Shift+V chuta.

## Known limitations

The quality select does not recreate the destruction renderer; it only changes the room's own settings. Unit tests use an injected stub renderer (no WebGL).
