# @adatechnology/game-weapons

Engine-agnostic weapons and ammunition. Real calibres as data (muzzle energy from `0.5 × m × v²`), generic real-world weapon archetypes (no brands),
and a tiny deterministic runtime: magazines, fire modes, reload, spread and bloom, shotgun pellets, recoil, noise, plus melee, flame, heat, throwables,
tools and a fire extinguisher. A trigger pull returns plain-data `Shot`s and `Use`s, so any damage model can consume them. It knows nothing about any game.

Units: metres, seconds, joules, mm (calibre diameter), grams (bullet mass), m/s, degrees, °C. Every random choice comes from a seeded generator, so the
same seed gives the same shots on every machine.

Contracts live in [`@adatechnology/game-contracts`](../game-contracts); the types are re-exported here, so existing imports keep working.

## Install

```sh
pnpm add @adatechnology/game-weapons
```

A plain `<script src=".../dist/index.global.js">` exposes the `GameWeapons` global. No runtime dependencies.

## Usage

```ts
import { createArsenal, DEFAULT_LOADOUT } from '@adatechnology/game-weapons'

const arsenal = createArsenal({ seed: 42, locale: 'pt-BR' })
const gun = arsenal.create('shotgun_pump_12', { reserve: 24 })
arsenal.name('shotgun_pump_12') // "espingarda de repetição calibre 12"

// every frame
gun.update(dt)
if (mouseDown) {
  const r = gun.trigger(cameraPos, cameraDir, dt, mouseHeldSinceLastFrame)
  for (const shot of r.shots) {
    // feed the shots to @adatechnology/game-destruction
    world.shoot(shot.origin, shot.direction, shot.energy, shot.caliber)
  }
  for (const use of r.uses) handleUse(use) // melee swing, flame tick, throw, tool...
  camera.kick(...r.recoil)
  horde.hear(cameraPos, r.noise)
} else gun.release()
if (reloadKey) gun.reload()
```

Semi / single / pump / bolt weapons fire once per pull: call `trigger(..., held = true)` while the button stays down and they fire only the first
time (status `cooldown` afterwards) until `release()`, or pass `held = false` for every new click. `auto` fires at the cyclic rpm while held (several
shots per `dt` if needed). `burst` emits its rounds together in one call. Reloading is never automatic: the host calls `reload()`; a tube-fed weapon
loads one round per `reload` seconds and the trigger interrupts it. `trigger(dt)` and `update(dt)` can both be called in the same frame without
counting `dt` twice.

Non-firearms: `flame`/`heat` drain `fuelPerSecond × dt` of fuel (`no_fuel` when dry), `tool` ticks with `duration: dt`, `extinguisher` spends its
charge in seconds, `throwable` throws once per pull (`velocity = direction × throwSpeed` plus a small upward arc, three by default), `melee` swings at
its rpm, `hand` produces one `hand` use per pull.

## Data

`CALIBERS` (`src/data/calibers.json`): `22lr`, `9x19`, `38spl`, `357mag`, `40sw`, `45acp`, `380acp`, `5_56x45`, `7_62x39`, `7_62x51`, `338lapua`, `50bmg`,
`12ga_00buck` (9 pellets), `12ga_slug`, `12ga_birdshot` (90 pellets), `20ga_buck`, `arrow`, `crossbow_bolt`. Muzzle energy is per projectile (per pellet
for shotguns), e.g. 9×19 ~500 J, 5.56 ~1750 J, .308 ~3500 J, .50 BMG ~18 kJ, 00 buck ~300 J per pellet.

`WEAPONS` (`src/data/weapons.json`):

| Category | Ids |
|---|---|
| Firearms | `pistol_9mm`, `pistol_45`, `pistol_22`, `revolver_357`, `revolver_38`, `smg_9mm`, `carbine_22`, `rifle_5_56`, `rifle_7_62x39`, `rifle_bolt_308`, `sniper_338`, `anti_materiel_50`, `shotgun_pump_12`, `shotgun_double_12`, `shotgun_semi_12`, `bow_compound`, `crossbow` |
| Melee | `hammer`, `sledgehammer`, `baseball_bat`, `crowbar`, `machete`, `axe`, `knife`, `fists` |
| Fire and heat | `lighter`, `flamethrower`, `cutting_torch`, `blowtorch`, `molotov` |
| Explosives | `frag_grenade`, `pipe_bomb` |
| Tools | `screwdriver`, `wrench`, `pry_bar`, `hacksaw`, `utility_knife`, `claw_hammer`, `extinguisher`, `hand` |

`DEFAULT_LOADOUT` lists a starter kit of 19 ids. Pass `calibers` / `weapons` to `createArsenal` to add or override entries by id.

## API

- `createArsenal(options?)` returns an `Arsenal`: `calibers`, `weapons` (maps), `create(id, { seed?, reserve? })` (unknown id throws), `muzzleEnergy(caliberId, barrel?)`,
  `name(id)` (weapon, fire mode or category, translated), `list(category?)`.
- `WeaponState`: `def`, `caliber`, `ammo`, `capacity`, `reserve`, `mode`, `reloading`, `spread`, `trigger(origin, direction, dt, held?, source?)`, `release()`,
  `reload()`, `cycleMode()`, `update(dt)`, `refill()`.
- `Shot`: `origin`, `direction`, `energy` (J), `caliber` (mm), `caliberId`, `speed`, `energyAt(distance)` (energy × speed factor², drag per 100 m), `pellet`, `weapon`, `source`.
- `Use`: `melee`, `flame`, `heat`, `throw`, `tool`, `extinguish`, `hand`. `TriggerResult`: `shots`, `uses`, `status` (`ok`, `empty`, `reloading`, `cooldown`, `no_fuel`, `safe`), `recoil`, `noise`.
- `muzzleEnergy(caliber, barrel?)`, `CALIBERS`, `WEAPONS`, `DEFAULT_LOADOUT`, `locales`, `resolveStrings`.

Locales: `en` and `pt-BR` (`locale` option; unknown falls back to `en`). Calibre labels are technical names and are not translated.

## Português

Armas e munição independentes de engine: calibres reais como dados (energia de boca = `0,5 × m × v²`), arquétipos genéricos de armas (sem marcas) e um
runtime determinístico (carregador, modos de tiro, recarga, dispersão, chumbos de espingarda, recuo, ruído), além de corpo a corpo, chama, calor,
arremessáveis, ferramentas e extintor. Cada disparo vira um `Shot` (energia em joules, calibre em mm, direção) que se passa direto para
`world.shoot(origem, direção, shot.energy, shot.caliber)` do `@adatechnology/game-destruction`. Use `createArsenal({ locale: 'pt-BR' })` para os nomes
em português (`arsenal.name('rifle_5_56')` devolve "fuzil 5,56"). A recarga nunca é automática; o jogo chama `reload()`.
