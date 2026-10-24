# @adatechnology/game-weather

Pure, seeded weather for games: states from clear to typhoon, climates that move between them in game time, lightning with the thunder delay,
ground wetness, what the weather means for sight, hearing and footsteps, the heat index and the day-night formula, and the bridges that push it to
the fluid film, the interactables, the vegetation, the effects world, the environment bus and the sound. No three.js and no game content; renderers
read it. Depends on `game-contracts` and `game-audio` (the rain, wind and thunder recipes); works in the browser and in Node.

The numbers come from the teams' pages (each state lists its `sources`): the rain, fog and lightning of the VFX Workshop, the dry and wet fog and
the day of the game, the wind and fog of the Art Scene, the rain rules of the Vale Cinzento gallery. Cyclone, typhoon and extreme heat have no team
source and are physics presets (and off in the `temperate` climate).

- **The normal world comes first.** Every climate starts `clear`; nothing is tied to an outbreak.
- **States** (`WEATHER_STATES`): `clear`, `overcast`, `light_rain`, `heavy_rain`, `storm`, `fog`, `windy`, `cyclone`, `typhoon`, `extreme_heat`.
- **Climates** (`CLIMATES`): `temperate` (mostly clear and overcast, no extremes, the default) and `tropical` (extremes rare and enabled).
  A seeded Markov chain in game time: each state lasts 2 to 6 game hours, a change blends over 10 game minutes and the front arrives from the west.
- **Lightning** has its own seeded stream (the server sends the seed, every client sees the same strikes): the first strike 2 to 4 s after a storm
  begins, then every 3.5 to 6 s, the Workshop's double flash, thunder `distance / 343` seconds later.
- **Wetness** rises with the rain and is dry 180 s after it stops (faster in extreme heat).
- **Effects**: `visibility`, `sightScale` (weather times the game's `1 - 0.4 × night`), `hearingScale`, `footstepScale`, `heatIndexC` (NOAA
  Rothfusz), `heatStress` (0..1 on the 27, 32, 41 and 54 °C bands), `lightningReveal`, `dryingScale`, `debrisPush`.
- **Day and night**: the game's formula (`daylight`), a 20-minute day by default (`timeScale` 72).

## Install

```sh
pnpm add @adatechnology/game-weather
```

Browser without a bundler (the global is `GameWeather`):

```html
<script src="https://unpkg.com/@adatechnology/game-weather/dist/index.global.js"></script>
<script>
  const weather = GameWeather.createWeather({ seed: 7 })
</script>
```

## Usage

```ts
import { createWeather } from '@adatechnology/game-weather'

const weather = createWeather({ seed: 7, climate: 'tropical' }) // starts clear, 8:00, a 20-minute day
weather.on('strike', (strike) => flash(strike.bearing))
weather.on('thunder', (strike) => playThunder(strike.distance))
weather.on('transition', ({ from, to }) => log(`${from} -> ${to}`))

// every frame, with real seconds
weather.advance(dt)
const sample = weather.sample()
sample.rain // mm/h, blended between states
sample.windX // m/s
sample.nightFactor // 0 day, 1 night
sample.groundWetness // 0..1
sample.effects.hearingScale // multiply a listener's radius by this
sample.front // { direction: [1, 0], progress } — the curtain moves along +x

weather.force('storm', 10) // blend to a storm over 10 real seconds
weather.timeline(72) // what a fresh world does in 72 game hours (plain JSON, a golden)
```

### Registry: add, patch, remove

```ts
import { createWeather, WEATHER_STATES } from '@adatechnology/game-weather'

const weather = createWeather({
  states: [{ ...WEATHER_STATES[2]!, id: 'drizzle', sources: ['my game'], rain: 0.5, drops: 300 }],
  patch: { states: { storm: { rain: 90, lightning: { interval: [2, 4] } } }, climates: { temperate: { dwellHours: [1, 3] } } },
  remove: { states: ['fog'] }, // nothing schedules it any more
})
weather.registry.patchState('heavy_rain', { visibility: 100 }) // later, with the same verbs
```

## Determinism

The schedule and the lightning draw from separate seeded streams (`streamSeed(seed, 'schedule' | 'lightning')`), so strikes never move the
schedule and the result does not depend on the size of the steps `advance` is called with. `createTimeline` steps one game minute at a time and is
checked against goldens on Node 22 and 24.

## API

Everything is exported from the package root; see `src/*.ts` for the doc comments. Units: metres, seconds, mm/h, degrees Celsius; wind in m/s.

## Português

Clima puro e determinístico por semente: estados de céu limpo a tufão, climas que passam de um estado a outro em tempo de jogo, relâmpago com o
atraso do trovão, solo molhado, o que o tempo muda para visão, audição e passos, índice de calor e a fórmula de dia e noite do jogo. Sem three.js,
sem som, sem conteúdo de jogo: quem desenha e quem toca lê daqui. Cada estado traz `sources` com a origem dos números (Oficina de VFX, jogo, Cena de
Arte, Galeria do Vale Cinzento); ciclone, tufão e calor intenso não têm fonte de time e são predefinições físicas, desligadas no clima `temperate`.

- O mundo normal vem primeiro: todo clima começa em `clear`.
- O estado dura de 2 a 6 horas de jogo, a mudança se mistura em 10 minutos de jogo e a frente chega de oeste.
- Relâmpago com fluxo próprio de semente (o servidor manda a semente e todos veem o mesmo clarão); trovão `distância / 343` s depois.
- O solo seca 180 s depois que a chuva para; `effects` entrega `sightScale`, `hearingScale`, `footstepScale`, índice de calor e estresse de calor.
- Catálogo por registro: acrescente, troque (`patch`) ou tire estados e climas sem mexer no núcleo.

## Bridges

`createWeatherBridges(targets, options)` pushes one weather to whatever you give it. Every target is optional and an interface of its own, so the
weather imports none of the packages it drives:

```ts
import { createWeatherBridges } from '@adatechnology/game-weather'

const bridges = createWeatherBridges({
  film: room.film, // game-fluids-three FilmBridge: setWeather({ rain, drying }), wash()
  interactables: world, // game-interactables: water.setRain(mm/h), setWind(x, z)
  vegetation, // game-vegetation: setWind({ direction, strength, gust })
  vfx: vfxWorld, // game-vfx: setWind([x, 0, z])
  environment: host.environment, // the EnvironmentBus
  audio: host.audio, // rain and wind loops, thunder
})
bridges.bind(weather)
// every frame, after weather.advance(dt)
bridges.update(dt)
```

The rules are numbers you can change (`filmRainFullAt`, `washFrom`, `washBelow`, `washEvery`, `windFull`): light rain (2.5 mm/h) stops the drying and
does not wash; heavy rain (15 mm/h) and stronger washes the fresh stain (less than half dry) once a second; extreme heat dries twice as fast; the
vegetation's `strength` is `min(1, speed / 20)`.

Sound: `WEATHER_BANK` holds `rain_loop` and `wind_loop` (art scene), `rain_hiss_game` (game) and `thunder`. `createWeatherSound` sets the rain loop
from 0.035 (light rain) to 0.06 (heavy), the wind loop at 0.05 in the breeze and in proportion to the speed, and plays the thunder at the strike's
bearing when it arrives (`distance / 343` s after the flash). `options.sound` changes the style (`art_scene` or `game`), the levels and the listener.

The picture is `@adatechnology/game-weather-three`. The bench takes it as `visual` (a `WeatherVisualFactory`: `layers(locale)` before the room lends anything, then
`create({ host, locale, weather })` returning `{ update(dt), setLayer(id, on), dispose() }`); with a visual the bench leaves the scene fog to it:
`createWeatherTestModule({ visual: createWeatherVisual({ vfx: room.vfx }) })`.
