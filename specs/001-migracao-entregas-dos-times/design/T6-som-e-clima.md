# Fase 6 — Som e clima (desenho do architect/opus, 2026-10-24)

Perguntas do §7 decididas pelo padrão reversível (autopilot, 2026-10-24), listadas no PR.

## Summary

Phase 6 needs three new packages and changes to five existing ones:

- **`game-audio`**: a pure planner that turns a recipe into a fully resolved `SoundPlan`, plus a WebAudio layer that builds nodes from that plan. It holds no content of its own except two kinds: the two team mixing chains (game and Cena de Arte) as profiles, and recipes for subjects whose package doesn't exist yet (motor, rotor, horn, horde, radio, siren).
- **`game-weather`**: pure. Holds the weather states, a seeded timeline, lightning, ground wetness, gameplay effects and the bridges to other packages.
- **`game-weather-three`**: draws the weather using the Phase 5 vfx primitives.
- Each subject keeps its own sound bank, as decided in S1: weapons in `weapons-three`, materials in `destruction-three`, voices in `characters-three`, animal calls in `animals-three`, rain, wind and thunder in `weather`.

How "igual ao original" is checked: a fake `AudioContext` records every node and every parameter change. The team's own functions run against it with a seeded `Math.random`, and the SDK must produce the same record. This compares generated parameters, as S3 requires, not audio.

The weapons sound is moved onto `game-audio` in two separate commits:
1. Move it with a byte-identical record (the T1.4 tests are untouched).
2. Replace the SDK-invented reload clicks with the Cena de Arte ones that the team actually delivered.

## Analysis

### 1. Source map (line → destination)

**Game `jogo.js`** (`artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`; the modo-livre audio block is identical, checked by diff)

| Lines | What | Destination |
|---|---|---|
| L62077–62081 `audioInit` (master 0.5 → output) | context and master gain | `game-audio/src/webaudio/context.ts`; mix profile `game` |
| L62082–62088 `noise()` (1.5 s, `Math.random`) | shared noise buffer | `webaudio/noise.ts`, filled from a seeded stream (`createRng`) |
| L62089–62107 `sfx` (table `P`, `att = vol/(1+d²·0.004)`, `cutoff/(1+d·0.01)`, silent below 0.01, offset `Math.random()`) | one-shot class burst and the game's distance curve | recipe builder `noiseClass` (`recipes/noise-class.ts`) and `falloff.ts` `GAME_SFX_CURVE`. Classes split by subject: pistol/shotgun/rifle/long_rifle/reload/empty → `weapons-three` (already there: `shot-sound.ts`); impact/glass/wood/explosion → `destruction-three/src/audio/bank.ts`; flesh/step → `characters-three/src/audio/bank.ts` |
| L62109–62127 `LOOPS`/`loopSet` (start threshold 0.002; smoothing 0.15 on volume, 0.08 on frequency; motor saw + lowpass 400; rain highpass 2500; horde lowpass 160; rotor lowpass 300 with 11 Hz LFO at 0.5) | continuous sounds | `game-audio/src/loops.ts` (state and smoothing); recipes: `rain_hiss_game` → `game-weather`; `engine_saw`, `rotor_blades`, `crowd_rumble` → `game-audio/src/library/` (temporary home until Phase 7/8) |
| L62128–62142 `grito` (3 formants 700/1150/2600, sweep ×1.15 → ×0.8, square LFO 31–40 Hz, `att = 1/(1+d²·0.006)`) | screamer | `characters-three` voice bank `scream_hoarse` |
| L62143–62155 `voz` (saw + bandpass Q3 at 3× base; 95+r·40 / 300; `1/(1+d²·0.01)`) | groan, runner | voice bank `groan`, `runner_groan`. The `kind==='grito'` arms at L62150–62151 are dead code (L62145 returns first) and are not ported |
| L66625–66639 `bichoSom` (latido/queroquero/cacarejo/mugido; linear `1 − d/70`) | animal calls | `animals-three/src/audio/bank.ts`; `falloff.ts` gets a `linear` model |
| L66978–66987 `groanBudget` 0.25 s, only below 40 m; L70472 decrement | voice limit (game) | `voices.ts` group `undead_voice: { cooldown: 0.25, maxDistance: 40 }` |
| L68278–68285 `boom` (sine 70 → 28 Hz, `1.4/(1+d²·0.002)`) | explosion thump | `destruction-three` bank `explosion_boom`; also the base of thunder (Q2) |
| L69998–70004 `chiado` (bandpass 1800, 0.6 s) | radio static | `game-audio/src/library/radio_static` |
| L70272–70276 `buzina` (squares 415 + 523 Hz, 0.6 s) | horn | `library/horn` (moves to vehicles in Phase 7) |
| L70416–70427 `ambientAudio` (10 Hz update; levels: motor `0.035+sp·0.003`, rain 0.035, horde `min(.16, perto·.0016)`, rotor `min(.5, 30/(dh+10))`) | loop driver | example usage in the bench; rain level = `weather` light-rain anchor |
| L68605 steps emit noise of 8/3/1 m × `ruidoPassos` × (×2 in water) | footstep noise | `game-weather` effects multiply this through `footstepScale`. The game never applies rain here: its `wet` (L68572) means standing in water |
| L66882–66884 hearing `N.r·(perc[1]/40)`; L66872 sight `perc[0]·(1−0.4·nightF)` | AI perception | `WeatherEffects.hearingScale` / `sightScale` (data for `game-crowd`/`game-player`) |
| L62046 `Fog(0x2a2f33, 25, 200)`; L69087 `rainOn`; L69116–69125 rain shader (14 000 points, 70 m box, 13 m/s); L69126–69159 `skyUpdate` (20-min day, `nightF`, sky ×0.8 in rain, fog far 140 rain / 220 dry, zone fog) | weather visuals and daylight | `game-weather-three/src/rain-curtain.ts`, `sky.ts`; `game-weather/src/daylight.ts` (dayT → s, nightF formula) |
| L69101, L63782–63788 `ZONA_NEBLINA` | zone fog (colour, far 60, weight) | `fog.ts` `zoneFog` blend |
| L62534 `lightning(){AMB.raios=true}`, L62573–62576 `chuva3`, L62619 | map preview rain and lightning | `AMB.raios` is never read, so this lightning does nothing; lightning is ported from the Workshop instead. The moving rain front (`chuva3` with `move`) becomes the "front from the west" |

**Cena de Arte** (`sources/arte__cena-de-arte.js`)

| Lines | What | Destination |
|---|---|---|
| L1305–1313 `initAudio`: compressor (−12 dB, ratio 5), master 0.85, convolver reverb (2.2 s, `(1−i/len)^3.4`, `rand`), wet 0.4, 2 s noise | mixing chain | mix profile `art_scene` (`data/mix-profiles.json`); IR generated from a seed in `webaudio/reverb.ts` |
| L1314 rain loop (highpass 600 → lowpass 6000, gain 0.06) | rain | `game-weather` `rain_loop` (heavy-rain anchor) |
| L1315 wind loop (lowpass 320, 0.05, LFO 0.07 Hz depth 0.035) | wind | `game-weather` `wind_loop` |
| L1316 fire loop (bandpass 1800 Q0.6), whose gain is never raised | fire | `destruction-three` `burn_loop` (the key is already emitted at `renderer.ts:501`) |
| L1319–1320 `panFor` (±0.85, min 2 m) and `outAt` (`vol/(1+d²·0.008)`, stereo panner, wet send) | listener and panning | `listener.ts` and falloff `ART_SCENE_CURVE` |
| L1322–1328 `sNoise`, `sTone`, `voice` (vibrato 4–10 Hz at f0·0.08, two formants, noise band, ×3.2, wet 0.45, `AU.groans`) | synthesis primitives | recipe layer kinds `noise`, `osc`, `formant_voice` |
| L1329–1369 `sfx.*` (31 sounds) | sound content | shot/click/empty/magOut/magIn/bolt/shell/casing → `weapons-three`; groan/scream/inhale/leap/grab/bite/hurt/flesh/sever/gore → `characters-three`; glass/wood/thunk/ping/clang/chip/crumble/thud/hiss/boom/burst/crack → `destruction-three`; siren → `library/siren` |
| L1342 `AU.groans>4` | voice limit (Cena) | `undead_voice.maxConcurrent: 4` |
| L36 `FogExp2(.03)`, L413 wind `(.35,0,.12)`, L1732–1736 rain (1600 lines, 24 m/s) | visuals | fog `exp2` model; wind vector default for `overcast` |

**Oficina de VFX** (`sources/efeitos__oficina-vfx.js`)

| Lines | What | Destination |
|---|---|---|
| W317–331 rain streaks, wind slant, splashes (35%, within 12/(1+Q) m), puddle rings | near rain | `game-weather-three/src/rain-near.ts` on the `game-vfx` pools `streak`, `normal`, `rings` (T5 design line 58) |
| W1063–1072 `chuva` (Garoa/Chuva/Temporal: 900/2200/4000 drops, slant 0.3/1.2/4.5, lightning every 3.5–6 s, first at 2–4 s, envelope 1 / 0.2 / 0.8 / 0 at 0.08/0.16/0.26 s, ends at 0.4 s, hemi `.6+I·3.2`, white `I·.12`, sheets) | rain states and lightning | `data/states.json` (`light_rain`, `heavy_rain`, `storm`), `lightning.ts` |
| W1073–1080 `neblina` (density 0.075, ground mist 5/s, ash 14/s) | fog | `fog` state and `fog.ts` emitters |
| W1161–1170 `farol` (headlight cones, 600 lit drops, fog 0.05) | headlights in rain | `headlights.ts` (T5 line 72: "farol waits for weather") |
| Line 2, sheet text: "Chuva lava: o sangue clareia, espalha 50% a mais e não seca enquanto chove"; water "volta à cor do chão 3 min sem chuva"; "chuva … mascara passos" | rules | fluids bridge; `wetness.ts` dry-out 180 s; `hearingScale` |

**Other team sources and the SDK today**

- `sources/mapa__galeria-vale-cinzento.js` L1381–1393: "O tempo muda a cada 2 a 6 h e chega de oeste. Na chuva a visão cai para 120 m e os passos fazem menos barulho." Goes to `climates.json` (dwell time [2 h, 6 h], front from the west) and `effects` (`visibility: 120`).
- `sources/jogo__visor-casas-3d.js` L13489–13494 (the same at `veiculos__garagem.js` L1797–1802): rain removes fresh `wipeable` stains below 50 % dried. Goes to the fluids bridge rule `washFresh`.
- SDK interactables already has `water.setRain(mm/h)` (`packages/game-interactables/src/types.ts:655`, `world.ts:1395,1648`), `setWind(x, z)` (`types.ts:668`), and three-side `effects.setWind` (`game-interactables-three/src/effects.ts:53,749`). Vegetation has `WindSettings {direction, strength, gust}` (`game-vegetation/src/three/types.ts:10–16,43`). The showroom drives them by hand (`examples/interactables-showroom/src/showroom.js:1060–1131,1693–1710`); that code moves to `game-weather` bridges.
- `game-destruction-three` emits sound keys without playing them (`src/types.ts:37`, `renderer.ts:473–857`: `impact_*`, `shatter_glass`, `ricochet`, `ignite`, `burn_loop`, `extinguish`, `melt_sizzle`, `detach`, `explode`). The new `destruction-three` bank maps them.
- `game-weapons-three/src/audio.ts`, `audio/shot-sound.ts`, `audio/mechanical-sounds.ts`, `audio/host-events.ts`: the migration source (see §2.6).

### 2. `game-audio`

**2.1 Layout** (depends only on `game-contracts`; the core is pure and runs in Node)

```
packages/game-audio/src/
  rng.ts            createRng(seed), streamFor(seed, n)       (per-channel streams; same idea as game-vfx random.ts)
  recipe.ts         SoundRecipe, Layer, Automation, Envelope, Range, LoopRecipe, SoundBank
  plan.ts           planSound(recipe, input) → SoundPlan | null      (pure; resolves ranges in field order)
  falloff.ts        inverse_square {k, minGain, cutoffK?} | linear {range}; DISTANCE_CURVES (game 0.004/0.006/0.01/0.002, Cena 0.008, animals 70 m)
  listener.ts       pan (Cena panFor), xz or 3D distance
  voices.ts         VoiceManager: groups {maxConcurrent, cooldown, maxDistance, steal}, global cap, priority
  loops.ts          LoopState: start threshold 0.002, tau 0.15 / 0.08, auto-stop
  mix.ts            MixProfile, buses (master, weapons, voices, world, ambience, weather, ui)
  bank.ts           register / patch / remove (mergeById-style; uses the contracts helper if T4 lands it)
  library/          engine_saw, rotor_blades, crowd_rumble, horn, radio_static, siren (temporary home, Q12)
  data/             game-sfx.json (with sources), mix-profiles.json, voice-groups.json
  webaudio/         context.ts (lazy, unlock), noise.ts (seeded buffers), reverb.ts (seeded IR), realize.ts, engine.ts
  bench/module.ts   createAudioTestModule
  locale.ts         en, pt-BR
```

**2.2 Recipes are data**

```ts
type Range = number | readonly [min: number, max: number] | { readonly param: string }   // ranges drawn in declaration order
type Automation = { set: Range } | { from: Range; to: Range; curve: 'exp' | 'linear'; over: Range | 'duration' }
type Envelope = readonly (readonly [t: number | `${number}d`, value: number, curve: 'set' | 'linear' | 'exp'])[]  // 'd' = × duration
type Layer = {
  at?: Range; repeat?: { count: number; spacing: number }; gain?: Range
  source: { kind: 'noise'; offset: 'random' } | { kind: 'osc'; wave: OscillatorType; frequency: Automation }
  filters?: { mode: 'serial' | 'parallel'; bank: readonly { type: BiquadFilterType; frequency: Automation; q?: number; gain?: number }[] }
  modulators?: readonly { target: 'gain' | 'frequency'; wave: OscillatorType; rate: Range; depth: Range | { scaleOf: 'frequency'; factor: number } }[]
  envelope: Envelope
}
type SoundRecipe = {
  id: string; bus: BusId; duration: Range; layers: readonly Layer[]
  falloff: Falloff; wet?: number; pan?: boolean; group?: string; priority?: number; sources: readonly string[]  // "jogo:L62128"
}
type LoopRecipe = { id: string; bus: BusId; source: Layer['source'] & { loop: true }; filters; modulators?; smoothing: { volume: 0.15; frequency: 0.08 }; startAbove: 0.002 }
```

Every team routine fits this shape: `sfx`, `grito` (parallel formant bank plus a square LFO on gain), `voz`, `boom`, `bichoSom` (`repeat`), `buzina` (two osc layers), `chiado`, Cena `sNoise`/`sTone`/`voice`/`siren`, and the four game loops plus the three Cena loops.

**2.3 API**

```ts
createAudioEngine(o?: {
  seed?: number; mix?: 'game' | 'art_scene' | MixProfile; banks?: SoundBank[]
  maxVoices?: number; distance?: 'xz' | '3d'
  occlusion?: (point: Vec3) => number; createContext?: () => AudioContext | null
}): AudioEngine

interface AudioEngine {
  register(bank: SoundBank): void
  plan(id: string, o?: PlayOptions): SoundPlan | null                // pure; what goldens and the bench sheet read
  play(id: string, o?: PlayOptions): VoiceHandle | null             // PlayOptions: position, volume, params, seed, delay, channel
  playPlan(plan: SoundPlan): VoiceHandle | null
  loop(id: string, o?: { position?: Vec3 }): LoopHandle             // set({ volume, frequency, params, position })
  channel(o: { seed?: number; random?: () => number; ownNoise?: boolean }): AudioChannel   // a subject's own RNG stream
  setListener(l: { position: Vec3; yaw: number }): void
  setBus(id: BusId, s: { gain?: number; muted?: boolean }): void
  setMix(profile): void; unlock(): void; stats(): AudioStats; dispose(): void
}
```

Without an `AudioContext` (Node, workers) every call except `plan` does nothing, the same as `weapons-three/src/audio.ts:61–66` today.

**2.4 Distance, occlusion, voices, loops, listener**

- **Distance.** The game's formula is the default: gain `/(1+d²·k)` and cutoff `/(1+d·0.01)` through a per-voice lowpass. The coefficient `k` is set per recipe, using the team values listed in the source map.
- **Occlusion.** No team source has it. The host may pass a callback returning 0..1, which scales gain by (1 − 0.5·o) and cutoff by (1 − 0.6·o); with no callback nothing happens (Q8). The `indoors` option of weapons stays in `weapons-three`.
- **Voice limit.** The two team rules combine: group `undead_voice: { maxConcurrent: 4 (Cena L1342), cooldown: 0.25, maxDistance: 40 (jogo L66986) }`. The global cap is 32 voices. When full, the lowest `priority × planned gain` is dropped (Q7); `stats().dropped` counts them.
- **Loops.** One node set per handle, created only when volume first exceeds 0.002, then smoothed with `setTargetAtTime` (jogo L62109–62127). Fire, rain, engine and crowd are all loop recipes.
- **Listener.** Cena's StereoPanner: right vector from yaw, pan clamped to ±0.85, distance at least 2 m. No HRTF, for cost.
- **Deterministic noise.**
  - Each engine has one seeded noise buffer per length (1.5 s for the game, 2 s for Cena) and a seeded reverb impulse.
  - Each `channel` draws start offsets from its own stream, so one subject's sounds never shift another's.
  - `ownNoise: true` keeps the legacy order (fill the buffer, then draw offsets) that `createWeaponAudio` uses today.

**2.5 Mixing.** Profile `game` = master 0.5 → output (jogo L62080). Profile `art_scene` = master 0.85 → compressor (−12 dB, ratio 5) → output, plus wet 0.4 → reverb → master (Cena L1309–1312). Buses sit under the master: `weapons`, `voices`, `world`, `ambience`, `weather`, `ui`.

**2.6 Migrating `game-weapons-three` without changing T1.4**

- `computeShotSound`, `GAME_SOUND_CLASSES`, `CLASS_REFERENCE_ENERGY`, `MECHANICAL_SOUNDS`, `mechanicalSoundOf` and `weaponEventOf` stay with the same names (`shot-sound.ts`, `mechanical-sounds.ts`, `host-events.ts`). `DistanceCurve`/`GAME_DISTANCE_CURVE` become re-exports of `game-audio` `falloff.ts`, with identical values.
- `createWeaponAudio(volume, options)` (`audio.ts:57`) becomes an adapter:
  - with `options.engine`, it uses that engine through `engine.channel({ seed })`;
  - otherwise it creates `createAudioEngine({ mix: { ...GAME, master: volume }, createContext })` with `channel({ random: createRng(seed), ownNoise: true })`.
- `classBurst`, `burst`, `tone` and `metal` (`audio.ts:88–150`) become recipe layers. The realizer creates nodes in the same order as the current code.
- Gate:
  1. T6.0b records the trace of the current `createWeaponAudio` (the same calls as `tests/audio.test.ts:154–200` and `integration.test.ts`) **before** any change.
  2. After the migration the trace must be byte-identical.
  3. `audio.test.ts` and `integration.test.ts` stay unedited.
- `weapons-three/src/area.ts:254` uses `host.audio` when the host lends it.
- A separate later commit (T6.1e2) ports the Cena reload sounds (`click`, `empty`, `magOut`, `magIn`, `bolt`, `shell`, `casing`, L1335–1341) into `MECHANICAL_SOUNDS`, replacing the SDK-invented metal clicks (evidence T1.4 note 1). The trace fixture is regenerated in that commit on purpose (Q5).

**2.7 Contracts (additive, generic).**
- `game-contracts/src/audio.ts`: `SoundRequest { sound, position?, volume?, params?, seed? }`, `AudioSink { play, loop?, stop, setListener?, register? }`, and `ModuleHost.audio?: AudioSink`.
- `game-contracts/src/environment.ts`: `EnvironmentState { rain, windX, windZ, windSpeed, gust, fogFar, visibility, nightFactor, temperatureC, wetness }` and `EnvironmentBus { get, set, on }`, plus `ModuleHost.environment?`. The room implements the bus as a tiny store with no dependency; the weather module writes to it and other modules read it.

### 3. `game-weather` and `game-weather-three`

**3.1 States** (`data/states.json`; registry with patch/remove)

| id | Source of the numbers | Key data |
|---|---|---|
| `clear` (default) | game L69141 | fog far 220, wind breeze (showroom 3.5, 1.5 m/s) |
| `overcast` | Cena L413, L36 | sky ×0.9, wind (.35, .12) |
| `light_rain` | W1065 Garoa; jogo rain level 0.035 | 900 drops, slant 0.3, 2.5 mm/h, wetness 0.35, visibility 160 |
| `heavy_rain` | W1065 Chuva; Cena rain gain 0.06; jogo fog 140; Galeria vision 120 m | 2200 drops, slant 1.2, 15 mm/h, sky ×0.8, visibility 120 |
| `storm` | W1065–1069 Temporal | 4000 drops, slant 4.5, 60 mm/h (the showroom's value), lightning 3.5–6 s, sheets |
| `fog` | W1076–1078; jogo zone fog L69101 | exp2 0.075 / linear far 60, ground mist and ash, visibility 40 |
| `windy` | Cena wind loop | 8 m/s, gust 12 (Q3) |
| `cyclone`, `typhoon` | **no team source** | physics presets: tropical cyclone at 33 and 50 m/s sustained, gust ×1.3, storm rain, debris push; off in `temperate` (Q3) |
| `extreme_heat` | **no team source** | 38 °C, 60 % humidity → heat index (Rothfusz), haze, faster drying (Q3) |

**3.2 Transitions** (`climates.json`, `scheduler.ts`)
- A seeded Markov chain in game time. Each state lasts a uniform 2–6 h (Galeria L1393). Fronts arrive from the west: the rain curtain moves along +x, like `chuva3` `move`.
- `blend.ts` interpolates every continuous value over `blendMinutes` (default 10).
- Climates: `temperate` (kit default: mostly clear/overcast, no extremes) and `tropical` (extremes rare and enabled).
- The normal world comes first (G7): no state is tied to the outbreak, and the world starts `clear` unless `start` says otherwise.
- `createWeather({ seed, climate, start, timeScale })` returns `{ advance(dt), sample(), state(), force(id, blend?), timeline(hours), on(event) }`.

**3.3 Lightning** (`lightning.ts`). Strikes come from their own seeded stream (the Workshop sheet says the server sends the seed) and use the W1067–1069 envelope. Thunder is delayed by `distance / 343` s (speed of sound, a physical constant).

**3.4 Wetness** (`wetness.ts`). Rises with rain and returns to dry 180 s after rain stops (Workshop: "3 min sem chuva").

**3.5 Effects on other packages** (`bridges.ts`, all optional and injected)
- **Fluids:**
  - `film.setWeather({ rain })` (T5 design line 343): while it rains, drying stops and spread is ×1.5.
  - The Workshop sheet also says blood lightens in rain.
  - Heavy rain, or stronger, removes fresh `wipeable` stains below 50 % dried (visor L13494).
  - Extreme heat passes an additive `dryingScale`.
- **VFX:** the wind vector goes to `VfxOptions.wind`; rain, fog and lightning use the T5 primitives (`streak`, `normal` sprites, `rings`, screen white).
- **Interactables:** `water.setRain(mm/h)` and `setWind(x, z)`.
- **Vegetation:** `setWind({ direction, strength: min(1, speed/20), gust })`.
- **Sound** (S1: rain belongs to the weather package): loops `rain_loop` (Cena band; gain from 0.035 light, the game anchor, to 0.06 heavy, the Cena anchor), `wind_loop` (Cena, gain by speed), and one-shot `thunder` (Q2).
- **Environment bus** (`ModuleHost.environment`).

**3.6 Gameplay values as data** (`effects.ts`). The state exposes:
- `visibility` (m), `sightScale` (multiplies `perc[0]` like L66872), `hearingScale` (multiplies the hearing radius at L66883; this is the rain masking), `footstepScale`;
- `heatIndexC` and `heatStress` 0..1 on the NOAA bands 27/32/41/54 °C, for `game-player` (T8.3);
- `lightningReveal` seconds.

No consumer exists yet; the bench shows these values as metrics.

**3.7 `game-weather-three`** (three ^0.160; depends on `game-weather` and `game-vfx-three`)
- `rain-curtain.ts`: the game's GPU points (L69116–69125), sized by profile.
- `rain-near.ts`: Workshop W317–331 through the vfx pools.
- `fog.ts`: both linear and exp2 fog, zone fog, mist and ash.
- `lightning.ts`, `sky.ts`: L69138–69141 dimming plus `daylight`.
- `headlights.ts`: W1161–1170.
- `heat-haze.ts`: SDK-made (Q3).
- `createWeatherRenderer(THREE, { scene, camera, weather, vfx, lights })` and `createWeatherTestModule`.

### 4. Goldens

- **Audio trace (S3).**
  - `tools/golden/src/audio-recorder.ts` provides a fake `AudioContext` that logs `{node, connect, param, method, value, time}` relative to `currentTime = 0`.
  - The team functions are cut literally from jogo.js (L62077–62155, 66625–66639, 68278–68285, 69998–70004, 70272–70276) and Cena (L1305–1369), then run in a Node `vm` with `Math.random = createSeededRandom(seed)` (the G3 mechanism, `tools/golden/src/determinism.ts:48`).
  - Coverage: the 12 game classes at 0/10/60/120/160 m; 4 loops × 3 levels; grito, voz ×2, boom, the 4 animal calls, chiado, buzina; the Cena chain plus all 31 `sfx.*` at 3 positions.
  - The SDK `realize(plan)` must produce the same log. Tolerance 1e-9.
  - The SDK draws randomness in the same order as the original, and each recipe's field order is documented.
- **Voice limiter.** A scripted sequence of groan attempts gives the same accepted set as jogo L66986 plus L70472 (cooldown) and Cena `AU.groans` (concurrency).
- **Weapons migration.** The identical trace from §2.6.
- **Weather timelines.** `timeline({ seed, climate, hours: 72 })` → JSON of transitions, strikes (time, distance, bearing), and samples every 10 min. Fixtures for seeds 1, 7, 42 in both climates; checked on Node 22 and 24.
- **Visual.**
  - Workshop `chuva` × 3 params, `neblina` and `farol` (the four T5 left out): event sequence and scene hash with the `vfx-workshop.js` capture that T5.0 adds.
  - The game rain shader: geometry hash with seeded `Math.random`.

### 5. Benches and test areas

- **`createAudioTestModule`** (group `audio`, uses `host.audio`, falls back to its own engine):
  - Controls: `sound` (grouped by bank), `distance` (0/10/40/60/120/160 m), `mix` (game / art_scene), `voice_storm` action (20 groans to show the limiter), loop levels (rain, wind, fire, engine, crowd, rotor), `seed`.
  - Layers: reverb, compressor, panning, muffling.
  - Metrics: active voices and the maximum, dropped, loops, RMS per bus (AnalyserNode).
  - `bench.sheet` prints the resolved `SoundPlan`, the S3 view.
  - Scenario: the listener circles a looping source to show panning and muffling.
- **`createWeatherTestModule`**:
  - Controls: `state`, `transition` (instant / 10 s), `time_of_day`, `auto_schedule` (time ×600), `seed`.
  - Layers: far rain, near rain, splashes and rings, fog, lightning, wind, sound.
  - Metrics: mm/h, visibility, sightScale, hearingScale, wind m/s, heat index, wetness, drops, strikes.
  - Scene: a puddle with a blood film to show rain washing, an interactables clothesline, a vegetation tree, and a car with headlights when vehicles are loaded.
- **`examples/audio-test-area` and `examples/weather-test-area`** follow the `vfx-test-area` layout: `build.mjs`, `src/entry.js` with globals `AudioArea`/`WeatherArea`, `area.js`, `scenarios.js`, `test.mjs`, opened with `?area=`.
- **`examples/interactables-test-area` (owner rule):**
  - `src/entry.js` `loadInto` also loads `createAudioTestModule` and `createWeatherTestModule` with `room.loadModule`; the furniture bench stays the active one.
  - `build.mjs` adds `game-audio`, `game-weather`, `game-weather-three` (plus `game-vfx`/`-three` from T5) to the built-check list and the aliases.
  - The test room lends `host.audio` (one shared engine, listener following the camera) and `host.environment`.
  - The showroom's hand-made `setRain`/`setWind`/`setNight` (`showroom.js:1693–1710`) is replaced by `game-weather`.

### 6. Ordered tasks

Header for `tasks.md`:

```markdown
## Fase 6 — Som e clima
> 🤖 Modelo: `sonnet` (T6.0a, T6.1d, T6.4, T6.5 → `haiku`; T6.1b é 🧠 → `opus`, validar com architect antes)
```

| # | Commit | Model | Group |
|---|---|---|---|
| T6.0a | contracts: `audio.ts`, `environment.ts`, `ModuleHost.audio?`/`environment?`; tests | haiku | A |
| T6.0b | `tools/golden`: audio recorder, literal cuts from jogo/Cena, fixtures; **weapons-three trace fixture recorded before any change** | sonnet | A |
| T6.2a | `game-weather` core: states/climates JSON with `sources`, scheduler, blend, lightning, wetness, effects, heat, daylight; timeline goldens | sonnet | A |
| T6.1b 🧠 | `game-audio` core: rng, recipe schema, plan, falloff, listener, voices, loops, mix, bank; unit tests and limiter golden | opus | B (after A) |
| T6.1c | WebAudio layer: context/unlock, seeded noise and impulse, `realize`, `createAudioEngine`; trace goldens against the team fixtures | sonnet | B (after b) |
| T6.1d | data: `game-sfx.json`, `mix-profiles.json`, `voice-groups.json`, `library/*` with `sources` | haiku | B (parallel with c) |
| T6.1e | `weapons-three` onto `game-audio` (adapter, `engine` option, `host.audio` in `area.ts`); identical trace; T1.4 tests untouched | sonnet | C |
| T6.1e2 | Cena reload sounds become `MECHANICAL_SOUNDS` defaults; fixture regenerated on purpose | sonnet | C (after e) |
| T6.1f | `destruction-three` bank (`onSound` keys → recipes from game and Cena; `burn_loop`); room wiring | sonnet | C (parallel) |
| T6.1g | `characters-three` voices (13 types) and `animals-three` calls | sonnet | C (needs Phase 4 on main) |
| T6.2b | weather bridges (fluids `setWeather` and wash, interactables, vegetation, vfx wind, environment bus, rain/wind/thunder recipes) | sonnet | C (needs T5.3e on main) |
| T6.2c | `game-weather-three` (curtain, near rain, fog, lightning, sky, headlights, haze); Workshop ×5 and game-shader goldens | sonnet | C (needs Phase 5 on main) |
| T6.1h | audio bench module and `examples/audio-test-area` | sonnet | D |
| T6.2d | weather bench module and `examples/weather-test-area` | sonnet | D (parallel) |
| T6.3 | test room `host.audio`/`host.environment`; load both modules into `interactables-test-area`; showroom switched to `game-weather` | sonnet | D (after h, d) |
| T6.4 | Dockerfile, site, thumbnails | haiku | D (last) |
| T6.5 | inventory, READMEs, skills, changesets, consolidado §7 (S1 marked done), evidence, PR | haiku | E |

**Parallelism.** Group A runs together. In B, c and d run in parallel after b. In C, e/f/g/b/c are parallel except as noted. Then D, then E.

**Gates per task.** `pnpm build`, `pnpm -r typecheck`, package tests (goldens included), `pnpm lint`, skill updated, one commit per task, evidence entry.

**Dockerfile wiring.**
- In `site/Dockerfile:12–40`, add these in alphabetical order:
  - `COPY packages/game-audio/package.json packages/game-audio/`
  - `COPY packages/game-weather/package.json packages/game-weather/`
  - `COPY packages/game-weather-three/package.json packages/game-weather-three/`
  - `COPY examples/audio-test-area/package.json examples/audio-test-area/`
  - `COPY examples/weather-test-area/package.json examples/weather-test-area/`
- tsup IIFE globals: `GameAudio`, `GameWeather`, `GameWeatherThree`; `three` external; `noExternal: [/^@adatechnology\//]`.
- New dependencies:
  - `game-audio` in `weapons-three`, `test-room`, `destruction-three` (for its bank) and `game-weather` (pure core only);
  - `@adatechnology/golden-tool` as a devDependency of `game-audio` and `game-weather`.
- `site/build-site.mjs` needs no change. Add the thumbnails with `site/capture-thumbs.mjs`.

### 7. Business questions (each has a reversible default)

1. **Kit mix profile:** default `art_scene` (compressor and reverb, as S1 asks). `weapons-three` on its own stays `game`. Reverse: `mix: 'game'`.
2. **Thunder** has no team source. Default: the game `boom` (70 → 28 Hz) plus low noise rumble, delayed by distance/343. Reverse: patch the recipe.
3. **Cyclone, typhoon and extreme heat numbers** (no team source): physics presets as listed in §3.1; off in `temperate`. Reverse: patch `states.json`.
4. **Rain masking:** default hearing ×0.8 light, ×0.6 heavy, ×0.5 storm; visibility 120 m in heavy rain (Galeria). Gameplay visibility (120) is kept separate from render fog (140).
5. **Cena reload sounds as default:** default yes (CLAUDE.md §1, in a separate commit). Reverse: revert T6.1e2.
6. **Voices for the 6 zombie types the teams didn't synthesize** (sniffer, bloater, stalker, blind, charred, drowned, devourer): default is the nearest team recipe with parameter shifts taken from the `voice` text in `types.json`.
7. **Global cap of 32 voices and priority order** (weapons > voices > world > ambience): SDK value.
8. **Occlusion:** off unless the host passes a callback.
9. **Rain on fluids:** both team rules apply; light rain stops drying but does not wash stains.
10. **Day-night formula:** lives in `game-weather/daylight.ts` for now, not in a separate `game-sky`.
11. **Weather time base:** game time (2–6 game hours, which is 10–30 real minutes with the 20-minute day).
12. **Temporary home for motor, rotor, horn, horde, radio and siren:** `game-audio/library` until Phases 7 and 8 move them as re-exports.

## Root Cause

The teams' sound and weather are scattered across copies that each create their own `AudioContext` with unseeded `Math.random`:
- the game (`audioInit` L62078, `noise` L62085, `grito` L62139);
- Cena de Arte (L1307, L1311);
- `weapons-three` (`audio.ts:61–66`).

Each copy hard-codes a different distance curve: k = 0.004, 0.006, 0.01, 0.002, 0.008, plus a linear 70 m. Weather exists only as page toggles: `rainOn` at L69087/L70474, Workshop `run(pr)` at W1066, showroom `setRain` at `showroom.js:1698`. Nothing feeds weather into fluids, perception or sound.

Two of the team-code flags in this area are defined but never used:
- the game's `AMB.raios` (L62534) is set and never read, so its lightning does nothing;
- Cena's `AU.fire` bus (L1316) is never turned up, so its fire loop is silent.

The design addresses this by:
- separating plan from realize in `game-audio` and keeping all recipes as data;
- one shared engine lent through the host;
- one seeded weather timeline that pushes values to its consumers through optional bridges.

## Recommendations

1. **T6.0b first:** record the `weapons-three` trace and the team audio fixtures before touching code. Effort: medium. Without them neither "igual ao original" nor "T1.4 unchanged" can be proven.
2. **T6.1b in opus with architect review:** every subject bank inherits the recipe schema; if it is wrong, all banks are rewritten. Effort: high.
3. **Start T6.2a in parallel:** weather core has no audio dependency. Effort: medium.
4. **Hold T6.1g, T6.2b and T6.2c** until Phase 4, T5.3e and Phase 5 are merged. They consume `characters-three`, `film.setWeather` and the `game-vfx` pools. Effort: medium each.
5. **Add the environment bus to contracts (T6.0a)** instead of making `test-room` depend on `game-weather`. This keeps the room generic (CLAUDE.md §4). Effort: low.

## Trade-offs

| Option | Pros | Cons |
|---|---|---|
| Plan/realize split with a recorded trace (chosen) | S3 goldens become exact against the team's own code; Node-testable | The realizer must keep the team's node-creation order; the recipe schema is richer |
| Port each team function as code | Fast, literal | Duplicated envelopes; no shared voice limit or mixing; can't be configured as data (breaks CLAUDE.md §2) |
| Subject banks in their own packages (S1, chosen) | Follows S1; packages compose | Phase 6 depends on Phase 4 and 5 merges; orphans need a temporary `library` |
| `game-audio` as a content pack for everything | One place for all sounds | Contradicts S1; content moves again later |
| Weather pushes through an environment bus plus optional bridges | No package-to-package hard dependencies; works LAN-safe from the seed | Adds a contract type; each consumer still maps the values |
| Weather drives the consumer packages directly | Fewer types | `game-weather` would depend on fluids, interactables and vegetation |
| Cena reload sounds as default (T6.1e2) | Follows CLAUDE.md §1 (team work over invented) | A deliberate fixture change; needs the owner's ok (Q5) |

## References

- Phase 6 tasks: `specs/001-migracao-entregas-dos-times/tasks.md:74–78` (origin/main). Decisions: `consolidado.md:32` (G7), `98` (E6), `113–133` (sounds; S1–S3).
- T1.4 audio notes and lines: `evidence.md:312–340`, `590`, `613`, `631–632`.
- Phase design docs, read from the local branches (only fase-0 and fase-1 are on origin):
  - `feat/spec-001-fase-5:…/design/T5-efeitos.md`: 58 and 71–72 (rain, fog and headlights handed to Phase 6), 109–245 (vfx layout and API), 343 (fluids rain hook), 390 (interactables-test-area rule), 430–436 (Dockerfile).
  - `feat/spec-001-fase-4:…/design/T4-personagens-e-animais.md`: 169 (voices as parameter events), 207 (animal sound ranges).
- Weapons audio being migrated: `packages/game-weapons-three/src/audio.ts:57–224`, `src/audio/shot-sound.ts`, `src/audio/mechanical-sounds.ts`, `src/audio/host-events.ts`, `src/area.ts:254`, `tests/audio.test.ts:154–200`.
- Existing SDK hooks: `packages/game-destruction-three/src/types.ts:37`, `renderer.ts:473–857`; `packages/game-interactables/src/types.ts:463–466,655,668`, `world.ts:1395,1648–1668`; `packages/game-interactables-three/src/effects.ts:53,749`; `packages/game-vegetation/src/three/types.ts:10–16,43`.
- Host contract and showroom: `packages/game-contracts/src/module.ts:166–208`; `examples/interactables-showroom/src/showroom.js:1060–1131,1693–1710`.
- Test area and build files: `examples/interactables-test-area/src/entry.js`, `build.mjs`; `site/Dockerfile:12–40`; `tools/golden/src/determinism.ts:48`.
- Team sources (all under the spec folder on origin/main):
  - `artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js` at the lines in §1;
  - `sources/arte__cena-de-arte.js:1305–1370,1732–1736`;
  - `sources/efeitos__oficina-vfx.js:317–331,1063–1080,1161–1170` and line 2 (sheet rules);
  - `sources/mapa__galeria-vale-cinzento.js:1381–1393`;
  - `sources/jogo__visor-casas-3d.js:13489–13494`.