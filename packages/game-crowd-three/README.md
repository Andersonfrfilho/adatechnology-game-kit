# @adatechnology/game-crowd-three

The three.js drawing of a `@adatechnology/game-crowd` crowd. Thousands of agents in a few draw calls: every crowd type is baked by the rich builder
into its variants at three levels of detail (the instanced bodies of `@adatechnology/game-characters-three`), and each frame every agent, every body
on the ground and every civilian becomes one instance of the right batch. three.js is passed in by the host; the package never imports it.

It is a literal port of the team game's drawing (`jogo.js` G 67079-67136 `ZVAR`, `hordeRender`; G 68469 `PB`; G 70177-70184 `npcRender`):

- **View culling**: past √30 m, an agent more than `0.35·d + 3` m behind the view is left out; nothing past 200 m.
- **Level of detail** at 18 and 55 m with 1.5 m of hysteresis, kept per agent (`store.lod`).
- **The attack pose** in at 1.6 m from the target, out at 2.2 m, kept per agent (`store.attackPose`); the crowd reads it back (a striking agent does not
  turn to its velocity), as in the game.
- **The pose by state** (dormant fallen, airborne leap, eating, pile step and grab as attack, swing and calling as scream, crawl), the bloater's
  swelling, the eyes out without the skull or on a dormant body.
- **Bodies on the ground** on their own variant (near within 18 m), darkening 70% over their life and shrinking in the last 60 s; a body that was not an
  agent goes on the plain body batch.
- **Civilians** one baked body each, a child 0.66 high and 0.75 wide, the bite showing.

Every number is in `src/data/render.json` with its source line, and the poses by state are options. The golden `game-crowd-render.json` (the game's
`hordeRender` and `npcRender` on the 11 scenes of the horde and the survivors, recorded in `node:vm` by `tools/characters-catalog`) is replayed instance
by instance by the tests.

## Install

```sh
pnpm add @adatechnology/game-crowd-three three
```

Browser without a bundler (the global is `GameCrowdThree`; the kit's engines are bundled in, three.js is yours):

```html
<script src="https://unpkg.com/@adatechnology/game-crowd-three/dist/index.global.js"></script>
```

## Usage

```ts
import * as THREE from 'three'
import { createCrowd } from '@adatechnology/game-crowd'
import { createCrowdRenderer, CROWD_SOUND_BANK, HERD_SOUND_IDS } from '@adatechnology/game-crowd-three'
import { createBestBuilder } from '@adatechnology/game-characters-three'
import { undeadCrowdPack, UNDEAD_TYPES } from '@adatechnology/game-characters-undead'

const crowd = createCrowd({ pack: undeadCrowdPack(), seed: 7, target: player })
const best = createBestBuilder(THREE, { types: UNDEAD_TYPES.map((t) => ({ name: t.name['pt-BR'], eye: parseInt(t.eye.color, 16) })), random })
const renderer = createCrowdRenderer(THREE, {
  crowd,
  builders: { buildBest: (spec, lod) => (best.setLOD(lod), best.build(spec)), topMaterial: () => best.topM() },
  typeName: (type) => UNDEAD_TYPES.find((t) => t.id === type.id)!.name['pt-BR'],
  civilians: { list: () => civilians.list, body: (n) => bodyOf(n) },
})
scene.add(renderer.group)
audio.register(CROWD_SOUND_BANK) // groan, runner_groan, scream_hoarse and the herd's calls

// every frame, after crowd.update
renderer.update(dt, { camera: { x: camera.position.x, z: camera.position.z }, viewYaw, target: { x: player.state.x, z: player.state.z, alive: player.state.alive } })
renderer.lodCounts // [near, middle, far]
```

A type is baked the first time one of its bodies is drawn (`bake()` does them all at once). Without three.js, `createCrowdInstances` gives the same
instances to any drawing.

`createHerdView(THREE, { herd, flock, drawer, species })` draws `game-crowd`'s herd with the animals' own rigs (`game-animals-three`'s
`createAnimalsThree(THREE)` is a drawer as it is) and the vultures gliding over the bodies.

## Test area

`createCrowdTestModule({ pack, builders, ... })` (`crowd_area`, only the generic contracts) puts a horde in the room, drawn on the instanced path, hunting
the room's camera as a `game-player` body, with civilians, the herd, a region model (`game-infection`) and nine scenarios. Sounds go to `host.audio`
(the bank is registered there), effects to `host.effects` (`CROWD_EFFECTS` maps them to the Oficina de VFX recipes). The content comes in by option.
`examples/crowd-test-area` loads it with the kit's own packs (`CrowdArea.loadInto(room)`, `sala-multidao.html`), and `examples/interactables-test-area`
carries it too.

## Em português

Desenho three.js da multidão do `game-crowd`: cada tipo assado nas variantes e em três níveis de detalhe, cada agente, corpo no chão e civil como uma
instância. Porte literal do `hordeRender` e do `npcRender` do jogo (corte pela vista, nível de detalhe com histerese de 1,5 m, pose de ataque de 1,6 a
2,2 m, pose por estado, corpo que escurece e encolhe). A área de teste (`crowd_area`) põe uma horda caçando o corpo do jogador na sala.
