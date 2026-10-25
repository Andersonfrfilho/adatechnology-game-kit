# @adatechnology/game-camera

Shoulder, third-person and first-person camera rig for three.js games, plus a first-person viewmodel helper.
It knows nothing about any game: the host tells it where the target is (position, yaw, pitch, aiming, crouching) and, optionally, how to
collide against the world.

- Three modes (`shoulder`, `third`, `first`) with a wall-aware boom that shortens at once and eases back out.
- The chosen mode is persisted in `localStorage` (optional).
- A ready-made `<select>` for menus, localised (`en`, `pt-BR`).
- `three` is a peer dependency used for types only: you pass your own `THREE` instance at runtime.

## Install

```sh
pnpm add @adatechnology/game-camera three
```

Browser without a bundler (the global is `GameCamera`):

```html
<script src="https://unpkg.com/@adatechnology/game-camera/dist/index.global.js"></script>
<script>
  const rig = GameCamera.create(THREE, { storageKey: 'my-game-camera' })
</script>
```

## Usage

```ts
import * as THREE from 'three'
import { create } from '@adatechnology/game-camera'

const rig = create(THREE, {
  storageKey: 'my-game-camera',
  labels: { shoulder: 'shoulder (Q swaps side)' },
  locale: 'en', // or 'pt-BR'
})
rig.selector(document.querySelector('#menu')!) // optional ready-made selector

// every frame: turn the look (mouse, fever, panic), then place the camera
rig.look(view, { dx: mouse.dx, dy: mouse.dy, zoom: weapon.zoom, aiming: view.aim, time, fever, panic, random })
rig.update(
  camera,
  { x, y, z, yaw: view.yaw, pitch: view.pitch, aiming, crouching, zoom: weapon.zoom, alive, deathT },
  dt,
  (ox, oy, oz, dx, dy, dz, max) => distanceToWallOrNull, // collision (optional)
  (x, z, y) => ceilingHeight, // ceiling (optional)
)
if (rig.isFirstPerson()) {
  rig.viewmodel(weaponGroup, camera) // hide the player body yourself
}

rig.cycle()
rig.flipSide()
rig.setMode('third')
rig.onChange((mode) => console.log(mode))
```

The first frame starts from the standing boom (3.8 m, 0.9 m aside, 1.95 m high) and eases to what the target asks, so aiming, swapping shoulders and crouching do not jump. The port is tested frame by frame against the game's `cameraUpdate` (position, look, field of view, yaw and pitch to 1e-9 over 640 scripted frames).

Conventions: yaw 0 looks toward -z; positive pitch looks down; the weapon group has its barrel along +z.

## API

### `create(THREE, options?) => CameraRig`

`THREE` only needs `Vector3` and `Quaternion`. All numbers are tunable; nested objects are shallow-merged over the defaults.

| Option | Default | Meaning |
|---|---|---|
| `modes` | `['shoulder','third','first']` | Modes in cycling order; the first one is the initial mode |
| `labels` | from the locale | Display name per mode |
| `shoulder` | `{ distance: 3.8, aimDistance: 1.7, side: 0.9, height: 1.95, crouchHeight: 1.4 }` | Over-the-shoulder rig |
| `third` | `{ distance: 4.2, aimDistance: 2.2, height: 2.5, crouchHeight: 1.9 }` | Third-person rig |
| `first` | `{ eyes: 1.62, crouchEyes: 1.15, forward: 0.16 }` | First-person rig |
| `viewmodel` | `{ x: 0.24, y: -0.24, z: -0.38, twist: -0.16 }` | Weapon offset in camera space |
| `smoothing` | `12` | Rate per second at which the boom, the shoulder side, the height and the field of view ease (`1 - exp(-smoothing * dt)`; the field of view `min(1, smoothing * dt)`). `0` is instant, as before the rig read it |
| `aim` | `{ fov: 65, fovPower: 1, zoomPower: 0.5, sensitivity: 0.0022, fovTolerance: 0.1 }` | The field of view is `fov / zoom ** fovPower` while aiming; the look is slowed by `1 / zoom ** zoomPower`; the field of view only moves when it is farther than `fovTolerance` degrees from the wanted one |
| `wallRecovery` | `4` | How fast the boom comes back out after a wall (per second; the push in is instant) |
| `deathOrbit` | `{ radius: 6, height: 3.5, speed: 0.2, lookHeight: 1 }` | The camera that circles a dead target: angle `deathT * speed` |
| `look` | `{ pitchMin: -0.55, pitchMax: 1.2 }` | Limits of the pitch in `rig.look` |
| `shake` | `{ fever: { yawSpeed: 1.3, yaw: 0.0015, pitchSpeed: 1.7, pitch: 0.001 }, panic: { amplitude: 0.002 } }` | The look shake of fever and panic |
| `wallClearance` | `0.3` | Gap kept from walls |
| `minDistance` | `0.2` | Closest the boom may get |
| `storageKey` | `'game-camera-mode'` | localStorage key, `null` to disable persistence |
| `locale` | `'en'` | `'en'` or `'pt-BR'` |

### `CameraRig`

| Member | Description |
|---|---|
| `mode`, `side`, `config` | Current mode, shoulder side (`1` / `-1`) and merged configuration |
| `setMode(mode)` / `cycle()` | Change mode (unknown modes are ignored); persists and notifies |
| `flipSide()` | Mirror the shoulder offset |
| `onChange(listener)` | Subscribe to mode changes |
| `isFirstPerson()` | `mode === 'first'` |
| `update(camera, target, dt, collide?, ceiling?)` | Place the camera for this frame. The target may carry `zoom` (the field of view of a camera that has `fov` follows `aim.fov / zoom` while `aiming`), `alive` and `deathT` (a dead target is circled) |
| `look(state, input)` | Turns `{ yaw, pitch }` by the mouse (`dx`, `dy`) with the sensitivity of the zoom, adds the fever and panic shake and keeps the pitch in range. `aiming` is the sights of the frame before, as the game reads it |
| `lookSensitivity(zoom?, aiming?)` / `lookShake({ time, fever, panic, random })` | The two parts of `look`, for a host that turns the look itself. The panic jitter needs the host's `random`; the rig never calls `Math.random` |
| `viewmodel(group, camera)` | Glue the weapon group to the camera |
| `selector(parent, label?)` | Append a labelled `<select>` bound to the rig |

Types exported: `CameraConfig`, `CameraOptions`, `CameraTarget`, `CameraRig`, `CameraMode`, `CollideFn`, `CeilingFn`, `ThreeLib`, ...
The `locales` table is exported too.

Coming from the Portuguese `CameraModosSDK`? See [MIGRATION.md](./MIGRATION.md).

## Português

Rig de câmera (ombro, terceira e primeira pessoa) mais o viewmodel da arma, para jogos em three.js. Não conhece nenhum jogo: o jogo informa o
alvo e, se quiser, uma função de colisão.

```ts
const rig = create(THREE, { storageKey: 'meu-jogo-camera', locale: 'pt-BR' })
rig.update(camera, { x, y, z, yaw, pitch, aiming, crouching }, dt, collide)
```

Com `locale: 'pt-BR'` os rótulos do seletor ficam em português ("ombro", "terceira pessoa", "primeira pessoa", "Câmera"). A tabela completa de
nomes antigos para novos está em [MIGRATION.md](./MIGRATION.md).
