# @adatechnology/game-player

The player's body for games, pure and seeded: vitals from an attribute sheet, stamina, wounds and bleeding, the bandage, being grabbed and breaking
free (six pushes or the knife), knock-downs, vaulting a low wall, footstep noise, panic, the shove and the melee blow against any crowd, and an
optional individual infection. No three.js, no audio, no game content: it emits events (`noise`, `sound`, `message`...) and the game plays and shows them.

It is a literal port of the team game's player (`jogo.js` G 68427-68640: `player`, `playerUpdate`, `frontZombies`, `shove`, `knife`, with `FICHA`,
`DERIV`, `INFEC` and `FERIDA`). Every number is in `src/data/defaults.json` with its source line, and the golden `game-player.json` (18 scripted runs of
the game code in `node:vm`, recorded by `tools/characters-catalog`) is replayed frame by frame by the tests.

- **The normal world comes first.** The infection is off by default: wounds bleed, a bite hurts, nothing turns. `infection: true` turns on the game
  rule (scratch 6%, laceration 22%, bite 100%; fever at 30 s, delirium at 70 s, death at 120 s, the body turns 8 s later).
- **The sheet** (`attributes`): strength, vigor, agility, perception, intellect, presence (5 each by default). The derived values (`maxHealth`,
  `maxStamina`, `runSpeed`, `walkSpeed`, `footstepNoise`, `composure`) are linear formulas given as data (`derived`).
- **The world** is a set of callbacks (`cellKind`, `solidAt`, `blocked`, `inWater`, `busy`, `canVault`, `afterMove`); the default is an open dry field.
- **The crowd** is the `PlayerCrowd` interface (read by index, written by `hold`, `stun`, `chase`, `damage`); `game-crowd` implements it, and any game
  with its own agents writes a small adapter.
- **Every draw is in the game's order** on the stream you pass (`random`), so a game that shares one stream keeps its sequence.

## Install

```sh
pnpm add @adatechnology/game-player
```

Browser without a bundler (the global is `GamePlayer`):

```html
<script src="https://unpkg.com/@adatechnology/game-player/dist/index.global.js"></script>
```

## Usage

```ts
import { createPlayer, playerTextOf } from '@adatechnology/game-player'

const player = createPlayer({ seed: 7, attributes: { agility: 7 }, world: { solidAt: grid.solidAt, cellKind: grid.cellKind, inWater, crowd } })
player.on('noise', ({ x, z, radius }) => crowd.emitNoise(x, z, radius))
player.on('sound', (request) => audio.play(request)) // { sound: 'step' | 'flesh', volume, position }
player.on('message', ({ id, seconds }) => hud.show(playerTextOf(id, locale), seconds))
player.on('died', ({ cause }) => endScreen(cause))

// every frame: held keys as booleans, the keys pressed this frame under `pressed`
player.update(dt, { forward: 1, right: 0, run: shift, aim, yaw: camera.yaw, bandage: keyB, pressed: { crouch, push, knife, vault, throw: t } })
player.state.health // also stamina, bleeding, wounds, grabbedBy, panic...
player.spreadFactor() // panic x fever x moving, for the weapon's spread

player.hurt(12) // a hit: draws the wound kind
player.grab(agentIndex) // 3 s to break free
player.knock(1.5)
```

## Test area

`createPlayerTestModule()` (`player_area`, only the generic contracts) makes the room's camera the player body and puts the vitals on the bench;
`examples/player-test-area` loads it into the shared test room (`PlayerArea.loadInto(room)`, `sala-jogador.html`), and `examples/interactables-test-area`
carries it too.

## Pushing furniture

`createFurniturePush(rules?)` is the logic of pushing a heavy thing on foot: `begin({ massKg, material })`, then `update(dt, { walk, isFree })` every frame answers the step and says the `phase` (`grip` while the hold timer fills, `push`, `strain`), the `progress` of the timer and the `block` (`too_heavy`, `obstacle`). The host answers `isFree` by sweeping the volume of the piece and draws the rest. `gripSecondsFor`, `pushSpeedFor` and `canPush` give the numbers; the force of the legs, the friction by material, the times and the speeds are all in `FurniturePushRules` (`FURNITURE_PUSH_DEFAULTS`).
