# @adatechnology/game-crowd

Any crowd as a struct of arrays, pure and seeded: a horde, but also a street of people or a herd. Relevance bands with hysteresis, perception by sight,
hearing and smell, a sliced flow field, a spatial hash and separation, six attack slots, chain alerts, doors that take blows, piles of bodies against
walls, special moves as type traits, corpses, a blood trail, the population and migrations. No three.js, no audio, no game content: it emits events
(`sound`, `effect`, `message`, `kill`...) and the game plays, draws and shows them.

It is a literal port of the team game's horde (`jogo.js` G 66714-67430: `hordeUpdate` and everything it calls, with the doors of G 63796-64050). Every
number is in `src/data/defaults.json` with its source line, and the golden `game-crowd.json` (8 scripted scenes of the game code in `node:vm`, recorded by
`tools/characters-catalog`) is replayed frame by frame by the tests.

- **The pack is data.** Types (health, speeds, damage, bite, multipliers, perception, size), ages, outfits, segments and the clothes palette come in
  `pack`. `@adatechnology/game-characters-undead` gives the undead one (`undeadCrowdPack()`, the game's 13 types); any game writes its own.
- **Special moves are traits** of a type (`vaultsLow`, `pounce`, `heavySwing`, `soundSeeker`, `caller`, `burns`, `waterWeak`, `submerged`, `ambush`,
  `burst`, `eatsCorpses`, `tracker`...). A type without traits only walks, hears, sees and hits. `plugins` add moves without touching the core.
- **The normal world comes first.** With no target (`target: null`) nobody chases: agents wander and pause. The target is anything with the
  `CrowdTarget` shape; `game-player`'s `Player` is one as it is.
- **The world** is a `NavGrid` (`createNavGrid`, the game's 0.5 m grid with occupancy codes and heights) and `water(x, z)`; doors are `createDoors`.
- **Every draw is in the game's order** on the stream you pass (`random`); the flow field's time budget reads `flow.clock` (pass `() => 0` to finish
  each field in one frame, as the golden does).

## Install

```sh
pnpm add @adatechnology/game-crowd
```

Browser without a bundler (the global is `GameCrowd`):

```html
<script src="https://unpkg.com/@adatechnology/game-crowd/dist/index.global.js"></script>
```

## Usage

```ts
import { createCrowd, createNavGrid } from '@adatechnology/game-crowd'
import { undeadCrowdPack } from '@adatechnology/game-characters-undead'

const grid = createNavGrid() // 768 m, 0.5 m cells, a solid border
grid.fillRect(x0, z0, x1, z1, 1, 3) // a wall 3 m tall
const crowd = createCrowd({ pack: undeadCrowdPack(), seed: 7, grid, water: (x, z) => pool.contains(x, z) })
crowd.doors.add(0, -2.1, 'x', 1.2)
crowd.on('sound', (s) => host.audio?.play({ sound: s.sound, volume: s.volume, position: s.position }))
crowd.on('effect', (e) => host.effects?.play({ effect: e.effect, point: e.point }))
crowd.on('message', ({ id, seconds }) => hud.show(id, seconds))

crowd.target = player // game-player's Player, or { state, grab, hurt, knock, release }
player.setWorld({ ...world, crowd: crowd.asPlayerCrowd() })
player.on('noise', ({ x, z, radius }) => crowd.emitNoise(x, z, radius))

// every frame, in the game's order
crowd.updateTrail(dt)
crowd.update(dt, { nightFactor, viewYaw: camera.yaw })
crowd.updatePopulation(dt, { x: camera.x, z: camera.z, yaw: camera.yaw, far: fog.far }, { target: 1200, migration })
crowd.updateCorpses(dt)

crowd.damage(i, { region: 0, amount: 35, distance: 12, caliber: { id: '9x19', class: 'pistol', skull: 1 } })
crowd.store.x[i] // the struct of arrays: x, z, y, yaw, state, hp, missing, band, variant...
```

## Civilians, herds, flocks and the region model

```ts
import { HERD_ROLES, bindInfection, carrionCenter, createCivilians, createFlock, createHerd } from '@adatechnology/game-crowd'

// people with a routine by the hour; agents that are closer to them than to the target hunt them
const civilians = createCivilians(crowd, { people: [{ id: 'ana', home: 'house_2', routine: [[19, 'market']] }], buildings, hour: () => clock.hour })
civilians.on('bitten', ({ id, near }) => diary(id, near))
civilians.join('ana') // follows the target
civilians.flee('ana', path) // leaves; `gone` at the end

// animals: wander, rest, flee, call; their calls are noises the crowd hears
const herd = createHerd(crowd, { blocked: insideABuilding })
herd.add({ ...HERD_ROLES.cow, species: 'cow', x, z, walkHz: cow.walkHz, runHz: cow.runHz, size: quadrupedLayout(cow.body).size })
const vultures = createFlock({ count: 3, mode: 'carrion' })
// every frame, after crowd.updateTrail and before crowd.update
civilians.update(dt)
herd.update(dt)
vultures.update(herd.time, dt, carrionCenter(crowd.corpses.entries.map((e) => e.data), carcass), [camera.x, camera.z])

// the region model of game-infection: numbers become agents near the player and go back when far
const binding = bindInfection(crowd, infection, { place: (region, seed, k) => spotIn(region, seed, k), civilians, regionOf })
binding.materialize('downtown', 40)
binding.giveBack()
```

Civilians are a literal port of the game's survivors on the block (`jogo.js` G 69960-70175: `pontos`, `rota`, `npcZombies`, `zChaseNpc`, `npcMorre`,
`npcVira`, `npcMove`, `npcUpdate`) without their names, lines, radio and diary; the herd of `bichoLivre`, `zumbiPerto` and `bichosUpdate` (G 66601-66700)
without the rig; the vultures of G 66700-66708 and the live map's ring of birds of the Bancada de Hordas (G 53609-53615). Two goldens replay them
with the horde: `game-crowd-civilians.json` (3 scenes) and `game-crowd-herd.json`.

## What is not here yet

The drawing and the test area are in `@adatechnology/game-crowd-three`. The game's multi-floor houses (`ANDARES`) and the roof (`ROOF`) are not ported: the crowd walks one
ground grid (`floor` is kept on each agent for a game that adds floors).
