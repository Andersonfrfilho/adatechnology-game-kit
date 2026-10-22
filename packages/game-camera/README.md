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

// every frame
rig.update(
  camera,
  { x, y, z, yaw, pitch, aiming, crouching },
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
| `update(camera, target, dt, collide?, ceiling?)` | Place the camera for this frame |
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
