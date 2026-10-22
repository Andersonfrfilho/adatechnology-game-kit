# Migration: `CameraModosSDK` (camera-modos.js) to `@adatechnology/game-camera`

Source: `sdk/camera/camera-modos.js`. Every old name maps to exactly one new name. Behaviour is unchanged (verified by running both
implementations on the same inputs: identical camera positions, look-at points and viewmodel transforms).

## Loading

| Old | New |
|---|---|
| `<script>` concatenated into the game; global `CameraModosSDK` | ESM `import { create } from '@adatechnology/game-camera'`, or the IIFE `dist/index.global.js` exposing the global `GameCamera` |
| `CameraModosSDK.criar(THREE, cfg)` | `GameCamera.create(THREE, options)` / `create(THREE, options)` |
| `CameraModosSDK.PADRAO` | `GameCamera.DEFAULTS` (labels now come from the locale table, see below) |

## Options (`criar` second argument)

| Old | New |
|---|---|
| `modos` | `modes` |
| `nomes` | `labels` |
| `ombro` | `shoulder` |
| `ombro.dist` | `shoulder.distance` |
| `ombro.distMira` | `shoulder.aimDistance` |
| `ombro.lado` | `shoulder.side` |
| `ombro.altura` | `shoulder.height` |
| `ombro.alturaAgachado` | `shoulder.crouchHeight` |
| `terceira` | `third` |
| `terceira.dist` | `third.distance` |
| `terceira.distMira` | `third.aimDistance` |
| `terceira.altura` | `third.height` |
| `terceira.alturaAgachado` | `third.crouchHeight` |
| `primeira` | `first` |
| `primeira.olhos` | `first.eyes` |
| `primeira.olhosAgachado` | `first.crouchEyes` |
| `primeira.frente` | `first.forward` |
| `viewmodel` | `viewmodel` (unchanged word) |
| `viewmodel.x`, `.y`, `.z` | `viewmodel.x`, `.y`, `.z` |
| `viewmodel.giro` | `viewmodel.twist` |
| `suavidade` | `smoothing` (still not read by the rig, kept for compatibility) |
| `folgaParede` | `wallClearance` |
| `minimo` | `minDistance` |
| `chave` | `storageKey` |
| (none) | `locale` (new: `'en'` default, `'pt-BR'`) |

Default of `chave`: `'sdk-camera-modo'` -> `storageKey`: `'game-camera-mode'`. Pass your own key (as the ZombiAdA adapter already does) and nothing
changes; if you relied on the old default, pass `storageKey: 'sdk-camera-modo'` to keep the saved choice.

## Mode ids (data ids)

| Old | New |
|---|---|
| `'ombro'` | `'shoulder'` |
| `'terceira'` | `'third'` |
| `'primeira'` | `'first'` |

Persisted values in `localStorage` change accordingly: a value saved as `'ombro'` / `'terceira'` / `'primeira'` is ignored by the new package
(the rig falls back to the first mode). Clear it or map it once in the adapter.

## Rig members (return of `criar`)

| Old | New |
|---|---|
| `rig.modo` | `rig.mode` |
| `rig.lado` | `rig.side` |
| `rig.config` | `rig.config` |
| `rig.setModo(m)` | `rig.setMode(mode)` |
| `rig.ciclar()` | `rig.cycle()` |
| `rig.trocaLado()` | `rig.flipSide()` |
| `rig.aoMudar(f)` | `rig.onChange(listener)` |
| `rig.primeiraPessoa()` | `rig.isFirstPerson()` |
| `rig.atualiza(cam, alvo, dt, colide, teto)` | `rig.update(camera, target, dt, collide, ceiling)` |
| `rig.viewmodel(grupo, cam)` | `rig.viewmodel(group, camera)` |
| `rig.seletor(pai, rotulo)` | `rig.selector(parent, label)` |

## Target object (`atualiza` second argument)

| Old | New |
|---|---|
| `x`, `y`, `z`, `yaw`, `pitch` | unchanged |
| `mira` | `aiming` |
| `agachado` | `crouching` |

## Callbacks

| Old | New |
|---|---|
| `colide(ox, oy, oz, dx, dy, dz, max)` | `collide(ox, oy, oz, dx, dy, dz, max)` (same signature, returns distance or `null`) |
| `teto(x, z, y)` | `ceiling(x, z, y)` (same signature) |

## User-facing strings (now in the locale table)

`pt-BR` reproduces the previous Portuguese strings exactly.

| Old (hard-coded) | New key | `en` | `pt-BR` |
|---|---|---|---|
| `nomes.ombro` = `'ombro'` | `modeLabels.shoulder` | `shoulder` | `ombro` |
| `nomes.terceira` = `'terceira pessoa'` | `modeLabels.third` | `third person` | `terceira pessoa` |
| `nomes.primeira` = `'primeira pessoa'` | `modeLabels.first` | `first person` | `primeira pessoa` |
| `seletor` default label `'Câmera'` | `selectorLabel` | `Camera` | `Câmera` |

To keep the Portuguese UI: `create(THREE, { locale: 'pt-BR' })`. Per-mode overrides still work through `labels`
(`nomes: { ombro: 'ombro (Q troca)' }` becomes `labels: { shoulder: 'ombro (Q troca)' }`).

## DOM

| Old | New |
|---|---|
| selector class `sdk-camera-sel` | `game-camera-selector` |

## Behaviour changes beyond renaming

None.
