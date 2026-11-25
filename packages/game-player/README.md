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

## HUD and death screen (`./hud`)

`@adatechnology/game-player/hud` is the body's screen, in DOM and with no three.js, laid over the game's view: the health and stamina bars with the
bleeding, the infection stage and the wounds under them (bottom left), the weapon in the hand and its rounds (bottom right, only when the hand holds
one), a name at the top left, the body's `message` events at the top centre and the crosshair in the first person. Nothing in it takes the mouse.
The death screen opens once the body has been dead `delaySeconds` (1.5 s: the death camera settles first), frees the pointer lock and shows the
cause, the time survived and two buttons: restart the scene (also Enter or R) and back to the start. Each hook fires once until the body lives
again. The words are `pt-BR` (default) and `en`.

```ts
import { createDeathScreen, createPlayerHud, playerHudViewOf } from '@adatechnology/game-player/hud'

const hud = createPlayerHud({ container, locale: 'pt-BR', title: 'Level 1' })
const death = createDeathScreen({ container, onRestart: rebuildFromSeed, onBackToStart: () => player.load(startSave) })
player.on('message', ({ id, seconds }) => hud.message(playerTextOf(id), seconds))

// every frame
hud.update(playerHudViewOf(player))
hud.setView(camera.isFirstPerson() ? 'first' : 'third')
hud.setWeapon(gun ? { name: gun.name, ammo: `${gun.mag} / ${gun.reserve}` } : null)
death.update({ alive: player.state.alive, deathTime: player.state.deathTime, cause: player.state.cause, survivedSeconds })
```

## Test area

`createPlayerTestModule()` (`player_area`, only the generic contracts) makes the room's camera the player body and puts the vitals on the bench;
`examples/player-test-area` loads it into the shared test room (`PlayerArea.loadInto(room)`, `sala-jogador.html`), and `examples/interactables-test-area`
carries it too.

## Drawing between fixed steps

A body moved in fixed steps and drawn at the last step stutters on any display that is not the step's rate (0, 1 or 2 steps a frame). `createStepPose(start)` keeps the last two step poses: `record(position)` after each step, `blend(context.alpha)` when drawing the body and placing the camera; `reset(position)` after a respawn or a placed body (a step longer than `teleportDistance`, default 3 m, is a teleport and is not swept).

## Pushing furniture

`createFurniturePush(rules?)` is the logic of pushing a heavy thing on foot: `begin({ massKg, material })`, then `update(dt, { walk, isFree })` every frame answers the step and says the `phase` (`grip` while the hold timer fills, `push`, `strain`), the `progress` of the timer and the `block` (`too_heavy`, `obstacle`). The host answers `isFree` by sweeping the volume of the piece and draws the rest. `gripSecondsFor`, `pushSpeedFor` and `canPush` give the numbers; the force of the legs, the friction by material, the times and the speeds are all in `FurniturePushRules` (`FURNITURE_PUSH_DEFAULTS`).
The walk with the piece speeds up and brakes like a person's (`accel`: the force left over the friction, over the mass, at most `accel.max`; braking at `accel.brake`), and each step reports its `velocity`, its `acceleration` and, when it hits something and stops at once, the velocity it had (`stoppedFrom`). `slipsOnTop(acceleration, frictionFor(material))` says whether a thing resting on the piece slides on it: a cup on a table rides while the push speeds up and slides on when the table stops dead.

## Opening doors by hand

`createDoorUse(rules?)` is the logic of working a door, lid or drawer by hand: `begin({ opening, massKg, locked })` answers where the leaf goes (1 open, 0 closed; a second `begin` in the middle of a swing turns it round) or null for a locked leaf, which only rattles. `step(dt, isFree, hand?)` then goes through `reach` (the hand to the handle), `swing` (the leaf follows the hand, a little at a time so it stops at the first thing in its way, `block: 'obstacle'`) and `release`. The player does not follow the leaf: when `hand.reaches()` says the handle left the arm (`DOOR_ARM_REACH` from the shoulder), a leaf that goes away gets a shove (`push`, `hand.pull` false) and one that comes toward the body is let go (`release`), and the leaf finishes on its own to its goal. A heavier leaf swings slower (`swingSecondsFor`); every number is in `DoorUseRules` (`DOOR_USE_DEFAULTS`).

## The hands and the weapon

`planHands({ hands, weapons: { R, L }, slots })` is the owner's rule (2026-11-24): an interaction of one hand (a small thing picked up, a door, a switch) takes the free hand, not the
weapon hand, and the weapon stays in its hand; one of both hands (a big thing carried, a push, a climb) first puts the weapon away in a slot the body wears that takes it (a holster at
the hip for a pistol, a sling on the back for a rifle) and, with none, drops it to the ground. A two-handed weapon (a rifle, a shotgun) leaves no hand free, so any interaction puts it
away or drops it. `drawBackOf(plan)` says what comes back to the hands when the interaction ends: what was put away, never what fell. `interactionHandsFor({ massKg, size })` says
whether a thing goes in one hand (up to 4 kg and 0.7 m, `HANDS_DEFAULTS`). The hands and slot of each weapon come from `weaponHandsOf` of `@adatechnology/game-weapons`.

A long gun on its sling (owner, 2026-11-25) is not dropped: its slot is `sling` (`move: 'sling'`), it hangs on the body and stays there after the interaction until the player
brings it back; with no sling worn it goes to the next slot that takes it (`SLOT_FALLBACKS`: the back). Every move is seen: `planTakeSequence(plan)` lays the steps (each weapon
`stow`, `sling` or `drop`, the off hand first, then `reach`, `close`, `lift`; `HANDS_TIMING` in seconds), `planDrawSequence(moves)` the way back (`draw`), and
`createTakeTimeline(sequence).advance(dt)` says which steps began and ended in the host's frame and how far into the current one (eased). `gripOfItem(size, hand)` is how a hand closes on
a thing: its longest side through the fist along the thumb, its thinnest across the palm, its middle a palm's thickness plus half that side under the middle of the palm, the
fingers closed by its thickness; `itemPoseInHand(hand, grip)` and `handPoseOnItem(item, grip)` turn one into the other (the hand reaches the thing where it lies, and carries it in the
palm). The pose algebra they use is exported too (`composePose`, `poseHolding`, `blendPoses`, `quaternionOfBasis`).
