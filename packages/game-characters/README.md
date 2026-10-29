# @adatechnology/game-characters

Living bodies for games, without an engine. Proportions (`GUIDE`, `TEAM_GAME`), a rig of 17 joints, the 17-segment tree (the 11 Arsenal kinds)
with the 6 crowd regions of the game, preset registries filled by content packs, and the damage model as a `DestructibleImpl`: protection,
penetration (`physical` P = √(E·m/A), or the game's `team-game` points), severity per segment, dismemberment, death rules and bleeding as
`leak` events. Engine units: joules, metres, seconds. Knows nothing about any game.

```ts
import { createCharacters } from '@adatechnology/game-characters'

const kit = createCharacters()
const person = kit.create({ seed: 1, kind: 'person' })
person.segments // 17 segments with hit points and status
person.state().body // { alive, vitality, missing, limp, crawl }
person.hit({ type: 'ballistic', point: [0, 1.7, 0], direction: [0, 0, -1], energy: 500, mass: 7.5, caliber: 9 }) // destruction events
person.lastHit // { points, killed, headshot, through, exitEnergy }
```

Plain script: `dist/index.global.js` exposes the `GameCharacters` global.

## Pose clips

Keyframed poses over the joint names of the rich body (`lean`, `twist`, `side`, `drop`, `headX/Y/Z`, `armR/L`, `elbR/L`, `armRz/Lz`, `legL/R`, `kneeL/R`). `samplePoseClip(clip, t)` is
the Bestiário's `sample` (find the segment, clamp, smoothstep, `lerpPose`); `clipEventsBetween(clip, t0, t1)` gives the events crossed in `(t0, t1]` (`impact` for "the blow lands
now", `phase` with a locale key). `channels` says what a clip drives: `full`, `upper` (the legs keep walking) or `lower`. `POSE_CLIPS` has the two clips of the "grab and bite"
scene (`grabbed_bitten_human`, `grab_bite_zombie`, with `x` and `run` as extra channels), texts in `POSE_CLIP_LOCALES` (`pt-BR`, `en`). A game adds or replaces clips with
`createPoseClipRegistry(POSE_CLIPS).register(clip)`.

```ts
import { POSE_CLIPS, createPoseClipRegistry, samplePoseClip } from '@adatechnology/game-characters'

const clips = createPoseClipRegistry(POSE_CLIPS)
samplePoseClip(clips.get('grabbed_bitten_human')!, 2.5) // { lean, headY, armL, ... }
```

**Clip format (JSON).** A team can add clips, attacks included, as data and register them; the core has no clip of its own beyond the two Bestiário ones.

```json
{
  "id": "my_clip", "duration": 1.2, "loop": false, "channels": "upper",
  "keys": [{ "t": 0, "pose": { "armR": -0.1 } }, { "t": 0.4, "pose": { "armR": -1.6, "lean": 0.3 } }, { "t": 1.2, "pose": { "armR": -0.1 } }],
  "events": [{ "t": 0.4, "type": "impact", "data": { "kind": "blow" } }]
}
```

Event types: `impact` is the moment the blow, bite or hit lands (the game applies the damage when it fires); `phase` carries `data.label`, a locale key. Any other type is the game's.
`clipEventsBetween` returns an event once, for the interval it falls in `(t0, t1]`.
