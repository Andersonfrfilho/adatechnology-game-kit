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
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'

const room = createTestRoom({
  THREE,
  container: document.getElementById('app')!,
  locale: 'en', // 'en' or 'pt-BR'
  catalog: demoItems('en'),
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
    ...demoItems('en'),
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

`DEMO_MATERIALS` is now empty (kept for compatibility: the demo items use only core materials). `buildFromSpec` turns a `DestructibleSpec` into meshes,
and `brickWallSpec` / `DEMO_ITEMS` / `SCENARIOS` are exported to reuse or extend.

## Loading a module

A game module hands the room a `TestableModule` from `@adatechnology/game-contracts` (items, each with an optional `impl` for its own destruction and `animations`, plus scenarios):

```ts
const report = room.loadModule(RENTAL_CARS) // { module, items, scenarios, ok, problems }
```

The items join the catalogue under the module's group and its scenarios become buttons. The contract checks run at once and write one line per result to the log: `checkDestructible` for every item with an `impl`, `checkAnimation` for every clip (`✓ Rental car: destructible contract ok (4 parts...)` or `✗ ...: <problem>`). The animations panel lists the clips of the aimed or held item; `room.playAnimation(clipId)` plays one (poses are offsets from the rest pose, events go to the log and `sound` events to `onSound`). The example (`examples/test-room`) loads a `DEMO_MODULE` rental car that owns its damage rule, its door `open` clip and a wheel that comes off with a wrench.

## Module bench

A module that declares `controls`, `layers` or `metrics` (see `@adatechnology/game-contracts`) gets a bench: `loadModule` checks it with
`checkBench` (a `✓ ... bench ok` / `✗ ... bench broken` line), lends `host.bench` to `attach`, then sends one change per control and layer. The
panel between the animations and the tests shows the active module (the one of the last `openArea`; else the first loaded with a bench, a later module never takes the panel from the one on screen): a
range per number, a checkbox per boolean, buttons (up to four options) or a select per choice, a button per action, the layers, and the
module counters at 4 Hz with a bar when they have a budget (`warn` from 80 %, `bad` past it). A compact line on top shows the room counters
(`fps`, `frame_ms`, `draw_calls`, `triangles`, `objects`, `fragments`, `particles`, `decals`); `fps` uses the real frame time, so slow motion
does not change it.

```ts
const room = createTestRoom({ ..., metrics: ['fps', 'draw_calls'], bench: { state: { lab: params.get('bench.lab') ?? '' }, onChange: (moduleId, encoded) => keepInUrl(moduleId, encoded) } })
room.bench()?.set('size', 2) // clamped and snapped; false for an unknown id, a wrong type or an option not offered
room.metrics() // { room: { fps, draw_calls, ... }, module: { particles: 120 } }
```

The state is `id=value;id=value` (`encodeBenchState` / `decodeBenchState`); decoding treats it as hostile input. `bench.state` is keyed by
module id, so two modules can share a control id; a module loaded again keeps its live values. The room never touches
`location`: the example page keeps it in `?bench.<moduleId>=`. `fps` and `frame_ms` use the real frame time, even past the 50 ms the simulation is clamped to. Loading a module again detaches the previous `attach` first. Q now reports the new fire
mode (`mode` event) and `shot` events carry `rounds` and `mode`.

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
| F | use a fluid item (drink); Z tilt; C fill from the tap; V pour (holding a fluid item) or kick (otherwise, with the `kick` tool whatever is selected) |
| Tab | show / hide the panels |

Panels: catalogue tabs (spawn, Clear, Reset all), slow motion 0.25x, time x10, quality select, inspector (material, state, hp, temperature, char, marks, joints, load and stress) and the behaviour log with filters.

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

## Known limitations

The quality select does not recreate the destruction renderer; it only changes the room's own settings. Unit tests use an injected stub renderer (no WebGL).
