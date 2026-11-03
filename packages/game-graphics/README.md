# @adatechnology/game-graphics

The player's graphics settings, without any engine or screen in the core. A game shows the screen (`@adatechnology/game-graphics/screen`) and draws with
what the controller hands it (`@adatechnology/game-graphics-three` puts it on a three.js renderer).

## Presets and options

| Option | Values | Automático |
|---|---|---|
| `resolutionScale` | 50 to 100 % | moved by the frame time |
| `hordeDetail` | 10 to 100 % of the horde's level budgets | the crowd renderer's own `budget.adapt` (`game-crowd-three`) |
| `shadows` | `off`, `near`, `all` | moved by the frame time |
| `viewDistance` | `short`, `medium`, `long` | picked by the calibration |
| `fpsCap` | 30, 60, 120, 0 (no cap) | never automatic |
| `showFps` | on, off | never automatic |

Presets: `auto` (Automático, the default), `low` (Baixa), `medium` (Média), `high` (Alta), `ultra`. A preset sets every option but the cap and the counter.
Changing one option by hand makes the preset `custom` (Personalizada) and leaves every other option as it was: under Automático the automatic mode keeps
moving only what is still on `auto`.

## The automatic mode

`createAutoTuner` walks one ladder, best first: the shadows go to the near ones before any pixel is lost, the resolution comes down to 80 %, the shadows go
off, and only then the resolution comes down to half. It steps down after half a second over the frame of the cap (×1.05) and back up after three seconds
under 70 % of it. A knob the player fixed keeps its value on every step. The load it reads is `frameLoad`: the larger of the frame's CPU work and the GPU
time of its draws, and the time between frames only when frames are being missed (under vsync that time never says how much room there is).

## Calibration

On a first run with an option on `auto`, the host draws its scene at the best step for about three seconds (`createBenchmark`, the first 0.4 s left out)
and the median load names the tier the automatic mode starts at: under 45 % of the frame is Ultra, under 75 % Alta, under 110 % Média, Baixa beyond. The
result is kept with the GPU's name, so it runs again only on another GPU or from the screen's Calibrar de novo.

## Use

```ts
import { createGraphicsController } from '@adatechnology/game-graphics'
import { createGraphicsScreen, createFpsOverlay } from '@adatechnology/game-graphics/screen'
import { createGraphicsView, gpuName } from '@adatechnology/game-graphics-three'

const view = createGraphicsView({ renderer, camera, sun })
const graphics = createGraphicsController({ gpu: gpuName(renderer), apply: (e) => view.apply(e) })
const screen = createGraphicsScreen({ container, controller: graphics, locale: 'pt-BR' })
createFpsOverlay({ container, controller: graphics, locale: 'pt-BR' })

// every frame: what it cost, and the cap for the loop (game-runtime's startLoop takes `minFrameMs`)
graphics.frame(dtSeconds, frameLoad({ cpuMs, gpuMs, intervalMs: dtSeconds * 1000, targetMs: targetFrameMs(graphics.settings.fpsCap) }))
```

The choice is kept in `localStorage` under `adatechnology.graphics` (pass `store: { storage, key }` to change it). A storage that throws is read as empty.
The test room turns all of this on with `graphics: true` (`examples/test-room`: the Gráficos button).
