---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-kit-defaults': minor
---

`game-characters-three` no longer imports `game-characters-people` (spec 005, D1 and D7): `toRoomAvatar(avatar, options)` takes `strikeClips` (required) and `firstPersonClips` by option. Migration: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`, or pass `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`.
