# @adatechnology/game-weather-three

The three.js picture of [`@adatechnology/game-weather`](../game-weather): the rain, fog, sky, lightning, headlights and heat of the weather that a
`createWeather` world samples. It reads `weather.sample()` once a frame and draws it; it never advances the weather.

| Part | What it draws | Where it comes from |
|---|---|---|
| **Rain curtain** (`createRainCurtain`) | 14 000 GPU points in a 70 m x 25 m box that follows the camera, falling 13 m/s; shader texts character for character; sized by the weather's `drops` (the whole curtain at 4 000, the storm) and by the profile (`low` 0.35, `medium` 0.7, `high` 1) | game `jogo.js`, `const RAIN = 14000` |
| **Near rain** (`createNearRain`) | the Workshop's streaks (`engine.rain`, up to 4 000, slanted by the wind), the splashes on the `normal` sprite pool and the rings (only where `puddleAt` says there is a puddle, within `12 / (1 + quality)` m); `game-vfx-three` draws them | Workshop W313-331 |
| **Mist and ash** (`emitAirborne`) | `mistPerSecond` puffs of low mist and `ashPerSecond` flakes of falling ash a second around the camera, into the same pool | Workshop `neblina`, W1085-1086 |
| **Fog** (`createFog`, `fogOf`) | linear fog (near 25 m, far from the weather: 220 clear, 140 rain) or exponential-squared fog where the weather has a density (`fog` 0.075), and the zone fog (colour, far, weight; near 4 m at full weight) | game `skyUpdate` and `ZONA_NEBLINA` |
| **Sky** (`createSky`) | night colour `0x0b0f18` to day `0x8796a6` by `sample.sun`, times `sample.skyScale` (the page's 0.8 in rain), pulled to the zone colour; it also gives the fog its colour | game `skyUpdate` |
| **Lightning** (`createLightning`) | the double flash of `sample.flash`: hemisphere light `+ 3.2 I`, background `+ I * (.25, .27, .32)`, screen white `I * .12` | Workshop `chuva`, W1068-1072 |
| **Headlights** (`createHeadlights`) | two spot lights and two additive beam cones on any `Object3D`, lit at night, in rain or in fog, real light only within 40 m of the camera, and rain that glows inside the beam (up to 600 lit drops a second) | Workshop `farol`, W101-103 and W1161-1170 |
| **Heat haze** (`createHeatHaze`) | warm bands that rise over the lower half of the view, by `sample.haze` | SDK-made: no team delivered it |

`createWeatherRenderer(THREE, { scene, camera, weather, vfx, profile, zone, puddles, puddleAt, headlights, layers })` puts them together:
`update(dt)` each frame, `setLayer(id, on)` for `far_rain`, `near_rain`, `mist`, `fog`, `sky`, `lightning`, `headlights` and `haze`, `setZoneFog`,
`setProfile`, `headlights.attach(car, lensMaterial)`. Without `vfx` only the curtain, fog, sky, lightning light, headlights and haze are drawn.

```ts
import * as THREE from 'three'
import { createWeather } from '@adatechnology/game-weather'
import { createWeatherRenderer } from '@adatechnology/game-weather-three'

const weather = createWeather({ seed: 1, start: 'storm' })
const picture = createWeatherRenderer(THREE, { scene, camera, weather, vfx })
// every frame
weather.advance(dt)
picture.update(dt)
```

## Bench

`createWeatherTestModule({ visual: createWeatherVisual({ vfx: room.vfx }) })` (the module of `game-weather`) adds the picture to the weather bench: seven layers
(rain curtain, near rain and splashes, mist and ash, sky, lightning, headlights, heat haze; names in pt-BR and en), and a lamp rig (two lamps on a block, the
Workshop's `hlMat` lenses) in front of the camera to show the headlights. `layers: { sky: false }` keeps a room's own sky; the bench's own `fog` layer reaches the
renderer too. The fog layer gives back the fog the host had when it is switched off.

## Proof

- `tools/golden/bin/record-weather-visual.mjs` cuts the rain block of `jogo.js` (`const RAIN = 14000` to `skyUpdate`) and runs it in a vm with three.js stubs under a
  seeded `Math.random`; the fixture `tools/golden/fixtures/weather/game-rain-curtain.json` keeps the SHA-256 of the 42 000 floats, the shader texts and the sky, zone and
  fog lines of the page. `tests/rain-curtain-golden.test.ts` compares the points bit for bit, the shaders character for character and the numbers of sky, fog, lightning,
  headlights, mist and ash against the page text.
- The Workshop's `chuva` (three intensities), `neblina` and `farol` run in `game-vfx` as effects (`rain_and_puddles`, `fog_and_ash`, `headlights_in_rain`), with their own
  golden of the events and the pools (`vfx-workshop-weather.json`).

No game content here: no names of a city or a faction. Peer dependency: `three` ^0.160.
