# @adatechnology/game-characters-three

three.js presentation for `@adatechnology/game-characters`. three.js is passed in by the host (`import * as THREE from 'three'`), so the same code runs from a bundler or from a plain script (`dist/index.global.js` exposes the `GameCharactersThree` global).

**Instanced crowd body** (literal port of the game's, G 65336-65541):

- `buildInstancedBody(THREE, { segments, body? })`: the merged geometry (torso, head, hair, jaw, eyes, arms, legs) tagged with bone, pivot and material; 16, 10 and 5 segments are the three levels of detail. `body` defaults to `TEAM_GAME`; any `BodySpec` moves the joints.
- `BODY_CHUNK` / `createBodyChunk`: the GPU pose chunk, byte for byte from the game (only the hip joint is a parameter). `createBodyMaterial` adds the tints and glowing eyes.
- `createBodyBatch`: `begin`, `push` per body, `end`; one draw call for a whole variant.
- `bakeBody` and `bakeVariants`: bake a rich body into an instanceable geometry; the three variants rule of the game (`7000 + c·101 + v·13`).
- `createFlyingLimbs`: 40 torn-off pieces that fly, bounce and stay, with injected blood effects.

```ts
import * as THREE from 'three'
import { buildInstancedBody, createBodyBatch } from '@adatechnology/game-characters-three'

const time = { value: 0 }
const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 10 }), { max: 700, time })
scene.add(batch.mesh)
batch.begin()
batch.push({ a: [x, z, yaw, phase], b: [1.8, 1, stride, 0], c: [missingMask, infection, 1, skinTone], color: { r: 0.3, g: 0.4, b: 0.5 }, eye: { r: 1, g: 0.2, b: 0.1 } })
batch.end()
time.value += dt
```

**Sound and blood of the bodies** (on `@adatechnology/game-audio` and the running film of `@adatechnology/game-fluids-three`):

- `createCharacterSound(host.audio, { style? })`: `voice(typeId, 'idle' | 'alert' | 'special', position)` for the 13 undead types (`UNDEAD_VOICES`: the game's groans and scream, the art scene's `voice` groan, scream and leap, with the class rule of the page for the types it does not have), `body(event, position)` (wound = flesh, cut = sever, burst or split = gore), `player('grab' | 'bite' | 'hurt')`. The 16 recipes (`CHARACTER_SOUND_BANK`) leave the same trace as the team code.
- `createFluidsBridge({ sink, film })` and `bloodLookOfAge(age)`: a `body` event throws drops of blood into the film, in the fresh and dry colours of the infection age (`ages.json`), `old_blood` for the thin ones.

**Player avatar.** `createPlayerAvatar(THREE, options?)` is the team game's player body: the rich human of the Bestiário/Elenco built from `presets/player-avatar.json`
(`{ type: 'Lento', human: true, seed: 4242, skin, hs: 'short', hair }`, shirt `0x3d5a73`), overridable with `{ spec, shirtColor, clips, blend, fallSeconds }`.

```ts
const player = createPlayerAvatar(THREE)
scene.add(player.root)
player.update(dt, { speed, crouch, down, armed, pitch, hip }) // the gait is tied to the ground speed (cadence and swing from `walkCadence`/`walkGait`)
player.hand('R').add(weaponMesh) // a socket at the weapon hand
player.play('grabbed_bitten_human', { onEvent: (event) => event.type === 'impact' && applyBlow() }) // or player.play(myClip); player.on('event', fn); player.stop()
```

Crouch, down and the aimed arms are derived literally from the game's GPU pose code (`BODY_CHUNK`, lines quoted in `src/player/avatar.ts`): crouch is thigh `-0.95`, knee `1.9`, trunk `+0.25`, hip `-0.35`;
down turns the body about the hip (`±1.5` rad, face up or down by the phase) with the limbs of pose 2; `armed` follows `(pitch + 1) / 3`. `play` overlays a `PoseClip` of `@adatechnology/game-characters`
(`channels: 'upper'` leaves the legs to the gait) with a 0.12 s blend, and fires its events (`impact`, `phase`) once through `onEvent` and `on('event')`. `hand('R')` is the weapon hand (the puppet's right, at -x).
