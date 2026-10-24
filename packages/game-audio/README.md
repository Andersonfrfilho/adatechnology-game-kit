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

## Português

Som como dados: a receita diz quais nós o som tem e quais números o movem; `planSound` sorteia tudo com semente na ordem em que a receita está
escrita e devolve o plano que a camada WebAudio constrói. Curvas de distância dos times, pan da Cena de Arte, limite de vozes, laços e as cadeias de
mixagem do jogo e da Cena. Os sons em si ficam no banco de cada assunto (armas, materiais, vozes, bichos, clima).
