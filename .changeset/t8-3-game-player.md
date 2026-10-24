---
'@adatechnology/game-player': minor
---

New package: the player's body (spec 001, T8.3), a literal port of the team game's player. `createPlayer` gives vitals from an attribute sheet (derived values as data),
stamina, wounds that bleed and the bandage, the grab with six pushes or the knife, knock-downs, low-wall vaults, footstep noise, panic, the shove and the melee blow against
any crowd (`PlayerCrowd`), and an optional individual infection (off by default: the normal world first). Every number has its source in `defaults.json`; the golden
`game-player.json` (18 scripted runs of the game code) is replayed frame by frame. `createPlayerTestModule` is the `player_area` bench; texts in `en` and `pt-BR`; global `GamePlayer`.
