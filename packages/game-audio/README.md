# @adatechnology/game-audio

Sound as data for games. A **recipe** says which nodes a sound has (seeded noise, oscillators, the art scene's formant voice, serial or parallel
filters, LFOs, an envelope) and which numbers drive them; `planSound` turns it into a **`SoundPlan`** with every number decided by a seeded stream,
and the WebAudio layer builds the plan. Nothing here knows any game: the sounds live in each subject's bank (weapons, materials, voices, animals,
weather), and this package holds the machinery plus the two team mixing chains.

- **Recipes are data**, with `sources` for every number (`"jogo:L62128"`, `"cena:L1342"`, `"sdk"`).
- **Plans are pure** and run in Node: the same seed gives the same plan, which is what goldens and the bench sheet read.
- **Distance curves of the teams** (`DISTANCE_CURVES`): the game's `vol / (1 + d² × k)` with k 0.004, 0.006, 0.01, 0.002 and its cutoff muffling
  `/ (1 + d × 0.01)`; the art scene's 0.008; the animals' linear 70 m.
- **Pan** like the art scene (right ear from the listener yaw, ±0.85, at least 2 m), distance on the ground or in 3D.
- **Occlusion** only when the host passes a callback: gain × (1 − 0.5 × o), lowpass cutoffs × (1 − 0.6 × o).
- **Voice limiter**: groups with `maxConcurrent`, `cooldown`, `maxDistance` and `steal`; a global cap of 32 that drops the lowest `priority × gain`
  (weapons > voices > world > ambience).
- **Loops**: nodes only once the volume reaches 0.002, then `setTargetAtTime` with 0.15 s (volume) and 0.08 s (frequency), as in the game.

## Install

```sh
pnpm add @adatechnology/game-audio
```

Browser without a bundler (the global is `GameAudio`):

```html
<script src="https://unpkg.com/@adatechnology/game-audio/dist/index.global.js"></script>
```

## Recipes

```ts
import { planSound, createRng } from '@adatechnology/game-audio'
import type { SoundRecipe } from '@adatechnology/game-audio'

const scream: SoundRecipe = {
  id: 'scream_hoarse',
  bus: 'voices',
  order: 'scream',
  duration: [1, 1.4], // drawn first
  layers: [
    {
      source: { kind: 'noise', offset: 'random' }, // the start point is drawn last in its layer
      filters: { mode: 'parallel', bank: [{ type: 'bandpass', q: 6, level: 1, frequency: { from: 805, to: 560, curve: 'linear', over: 'duration' } }] },
      modulators: [{ target: 'gain', wave: 'square', rate: [31, 40], depth: 0.35 }],
      envelope: [[0, 0, 'set'], [0.06, 0.9, 'linear'], ['0.6d', 0.9, 'set'], ['1d', 0.001, 'exp', 'fixed']],
    },
  ],
  falloff: { model: 'inverse_square', k: 0.006, minGain: 0.02 },
  group: 'undead_voice',
  sources: ['jogo:L62128'],
}

const plan = planSound(scream, { random: createRng(7), distance: 12 }) // null when too far to hear
```

- `Range` is a number, `[min, max]` (drawn as `min + random × (max − min)`) or `{ param, scale?, add? }`.
- **Draw order** (so a recipe draws exactly what the team routine drew): `vars` in the order written, then `duration`, then each layer in the order
  its fields are written, the noise start point last in its layer. A sound below `minGain` draws nothing.
- Envelope points are `[time, value, 'set' | 'linear' | 'exp']`; `'0.6d'` is 0.6 × the layer duration; values are multiplied by the level unless
  the fourth item is `'fixed'`.
- `order` names the node-creation order the realizer uses, each taken from the team routine it reproduces (`layered` is the art scene's and the
  default; `burst`, `scream`, `groan`, `boom`, `static`, `chord`, `calls` are the game's; `siren` is the art scene's siren).

## Engine

`createAudioEngine({ seed, mix, banks, maxVoices, distance, occlusion, createContext })` plans a recipe, admits it through the voice limiter and builds it
on a lazily created `AudioContext` through one of the team chains (`game` or `art_scene`). Without a context (Node, workers) every call but `plan` does
nothing. `channel({ seed })` gives a subject its own random stream; `createAudioSink(engine)` lends the engine as a host's `audio` (`@adatechnology/game-contracts`).
`weapons-three` plays on it (`createWeaponAudio(volume, { engine })`) with the `weapon` build order.

## Shipped data

| Data | What it is | Source |
|---|---|---|
| `GAME_SFX_CLASSES`, `GAME_SFX_FALLBACK`, `noiseClassRecipe`, `GAME_SFX_BANK` (`src/data/game-sfx.json`) | The game's 12 noise classes (pistol to explosion) and its fallback, as rows and as `burst` recipes `sfx_<id>` | jogo L62089–62107 |
| `MIX_PROFILES` (`src/data/mix-profiles.json`), `DEFAULT_MIX` | `game` (master 0.5, noise 1.5 s made on demand) and `art_scene` (compressor −12 dB ratio 5, master 0.85, reverb 2.2 s with decay 3.4 and wet 0.4, noise 2 s made with the chain). The kit default is `art_scene` (Q1) | jogo L62077–62088, cena L1305–1313 |
| `VOICE_GROUPS` (`src/data/voice-groups.json`) | `undead_voice`: five at once, one every 0.25 s, nearer than 40 m | cena L1342, jogo L66986, L70472 |
| `LIBRARY_BANK` (`src/library/*.json`) | Sounds whose subject has no package yet (Q12): loops `engine_saw`, `rotor_blades`, `crowd_rumble`; sounds `horn`, `radio_static`, `siren` | jogo L62109–62127, L69998–70004, L70272–70276; cena L1369 |

The subject banks (weapons, destruction, characters, animals, weather) live in their own packages.

## Português

Som como dados: a receita diz quais nós o som tem e quais números o movem; `planSound` sorteia tudo com semente na ordem em que a receita está
escrita e devolve o plano que a camada WebAudio constrói. Curvas de distância dos times, pan da Cena de Arte, limite de vozes, laços e as cadeias de
mixagem do jogo e da Cena. Os sons em si ficam no banco de cada assunto (armas, materiais, vozes, bichos, clima).

## Sounds from files (`SampleSound`)

A bank can carry `samples`: sounds made of recorded takes. The engine plays the files once they are loaded and the `fallback` recipe until then.

```ts
import { createAudioEngine, sampleBankFromManifest } from '@adatechnology/game-audio'
import manifest from '@adatechnology/game-audio/assets/sfx/manifest.json'

const engine = createAudioEngine({ banks: [sampleBankFromManifest(manifest, { id: 'sfx', baseUrl: '/sfx/', sounds: { pistol_9mm: { bus: 'weapons', fallback: 'sfx_pistol' } } })] })
await engine.loadSamples()
engine.play('pistol_9mm', { position: [10, 0, -40], environment: 'indoor', delay: 40 / 343 })
```

- Layers: `close` (≥ 4 takes for a P1 sound), `far` (crossfades in between `crossover.from` and `to`, default 30–80 m, equal power), `tiers` (light/medium/heavy by `PlayOptions.intensity`), `tail.indoor` / `tail.outdoor` (by `PlayOptions.environment` or `engine.setEnvironment`).
- Each play: a take drawn among all but the last one (round-robin, never twice in a row), the rate ± `pitch` (default 4 %), the level by `falloff`, a lowpass by distance (`cutoffK`) and behind a wall (`occlusion`), the pan.
- Sample voices of a bus go through a zero-delay limiter (ceiling −1 dBFS); `choke: { voices }` fades the oldest plays of a sound for rapid fire.
- `onVoiceStart` reports every voice (recipe or sample, the files and takes, `requestedAt` / `startAt`): the event log the criteria measure.
- **No audio ships in the kit.** `assets/sfx/manifest.json` is only the references (sound id → path, with source, author and licence) and
  `assets/sfx/CREDITOS.md` the credits; the files live in the game's repository (ZombiAdA `assets/sfx/<categoria>/`, originals in
  `assets/sfx-originais/`). A game serves that folder and passes it as `baseUrl`; a take whose file is missing plays the recipe of its id.
- On this machine, `scripts/sfx-dir.mjs` says where the files are: `KIT_SFX_DIR` / `KIT_SFX_INBOX`, or `.sfx-local.json` at the repo root (ignored
  by git) `{ "kit": "../zombiada/assets/sfx", "inbox": "../zombiada/assets/sfx-originais" }`, or `.sfx/` and `.sfx-inbox/`. The test room links
  them into `dist/sfx/`; the tests that read files skip without them; CI fails on any audio file tracked by git.
- New files: the original in `<inbox>/<categoria>/` with a line in its `CREDITOS.md`, then `pnpm --filter @adatechnology/game-audio sfx:convert`
  (ffmpeg): Ogg Vorbis mono 48 kHz, −1 dBFS peak, attack on the first ms, written to the game's folder, with the manifest and credits updated here.
  Only CC0 and CC-BY (the kit and the game are public).
- Measuring: `measureCriteria({ sound, banks, loader })` renders C1–C9 through the real engine on an `OfflineAudioContext`; the test room's `?area=sound_check_area` (`createSoundCheckModule`) runs it on a button and records 3 s for C10. `CALIBRATION_SOUND` is a kit-made sample sound (no file) with every layer, for checking the path end to end.

## Fitted copies of the recordings (`@adatechnology/game-audio/fitted`)

Where the files are not on the machine (CI, the published site, a clean clone) or have not loaded yet, a recorded id plays its **fitted copy**:
numbers measured from each take by `tools/sfx-sources/fit.mjs`, not audio. Each take becomes a recipe of white noise through twelve bandpass bands
(63 Hz to 12.5 kHz), each band with its own gain curve, plus the ringing partials as sines; the takes of an id form a set, and a loop keeps its
average band gains. Through the real engine they land 3 to 8 dB from the recording (mean band error over time) where the hand-made recipes were 14
to 28 dB away.

```ts
import { registerFittedSounds } from '@adatechnology/game-audio/fitted'

registerFittedSounds(engine) // after the game's own banks: the fitted set replaces the older recipe of the same id, its recorded takes stay
```

- `KIT_SAMPLE_ALIASES` are answered too (`shut_wood` plays the fitted `door_wood_shut`), and the bare id of tiered recordings plays the medium tier.
- `FITTED_KEEPS_RECIPE` (`fire_extinguish`, `gas_leak`) keep their recipes, which read params; `{ replace: false }` keeps every older recipe.
- Vehicles are not fitted: their loops follow the engine's RPM.
- After new recordings: `node tools/sfx-sources/fit.mjs` (ffmpeg, the files where `scripts/sfx-dir.mjs` finds them) rewrites `src/data/fitted-sfx.json`.

## Local sound pack (your own files, by config)

A project can answer any SDK sound id with its own files, kept in its own folders and never in the SDK. A JSON config maps each id to its takes:

```json
{
  "version": 1,
  "baseUrl": "audio/",
  "sounds": {
    "pistol_9mm": { "files": ["weapons/pistol_01.ogg", "weapons/pistol_02.ogg"], "license": "CC0" },
    "door_wood_close": { "files": ["doors/close.ogg"], "license": "CC-BY", "score": 7 }
  }
}
```

```ts
import { applyLocalSoundPack, parseLocalSoundPack } from '@adatechnology/game-audio'

const pack = applyLocalSoundPack(engine, parseLocalSoundPack(await (await fetch('audio/pack.json')).json()), { baseUrl: 'audio/' })
await pack.done // { file: ids now playing your files, fallback: ids whose files failed }
pack.unlicensed() // ids playing a file whose licence is not CC0 / CC-BY
pack.dispose() // every id gets its previous sound back
```

- Urls are `baseUrl + file`: a folder served next to the page or any url (`https://cdn.example/sfx/`). `options.baseUrl` overrides the config's.
- Nothing runs in the frame a sound plays: each id's files are fetched and decoded in idle time (`requestIdleCallback`, one id per slot), once per
  url and shared by every voice. Until they decode the id plays what it played before (the SDK recording, else the synthesized recipe); a file that
  fails leaves the id on the SDK sound for good, decided once at load.
- `license` is `CC0`, `CC-BY`, `unknown` or `proprietary`. The sound panel (`createSoundCheckModule`, metric "File without licence") lists the ids
  playing a file that is not CC0 / CC-BY: those may be tried locally but cannot ship.
- `parseLocalSoundPack` validates at the boundary and throws `LocalSoundPackError` with every problem at once.
- In this repo the test room reads `audio.local.json` at the root (git-ignored; see `examples/test-room/audio.local.example.json`, with `root` the
  folder of the files): `tools/local-audio/local-audio.mjs link` symlinks it into `dist/local-audio/`, and `guard` / `guard-git` (build, site build,
  pre-commit and CI) fail if a local file reaches a build or git.
