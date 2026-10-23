# @adatechnology/game-test-room

A self-contained first-person test room for three.js. Drop your own catalogue of objects in, walk around, shoot, hit, burn, cut, throw, drink and pour,
and read what happened in plain words in an on-screen behaviour log that you (or an agent) can also export as JSON or NDJSON. Scripted scenarios
check the behaviour and write pass/fail lines to the same log.

It composes `@adatechnology/game-destruction`, `game-destruction-three`, `game-weapons`, `game-fluids` and `game-fluids-three`. `three` is a peer dependency used only as a type: you pass the namespace in.

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
      room.look([0, 1, -2], [0, 0.5, -4])
      room.use()
      step(2)
      expect(room.world.state(o.objectId)!.parts.some((p) => p.status !== 'intact'), 'a part was hurt')
    } },
  ],
})
```

Use `DEMO_MATERIALS` if your own world needs the same materials (including `glass_thin`). `buildFromSpec` turns a `DestructibleSpec` into meshes,
and `brickWallSpec` / `DEMO_ITEMS` / `SCENARIOS` are exported to reuse or extend.

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
| F | use a fluid item (drink); Z tilt; C fill from the tap; V pour |
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

## Português

Uma sala de testes em primeira pessoa para three.js. Você passa o seu catálogo de objetos, anda, atira, bate, queima, corta, arremessa, bebe café e
derrama líquidos, e lê o que aconteceu em linguagem simples no registro de comportamento (também exportável em JSON, NDJSON ou texto). Os cenários
automáticos conferem o resultado e gravam aprovado/reprovado no mesmo registro. Use `locale: 'pt-BR'` para textos em português.

## Known limitations

The quality select does not recreate the destruction renderer; it only changes the room's own settings. Unit tests use an injected stub renderer (no WebGL).
