# @adatechnology/game-characters

Living bodies for games, without an engine. Proportions (`GUIDE`, `TEAM_GAME`), a rig of 17 joints, the 17-segment tree (the 11 Arsenal kinds)
with the 6 crowd regions of the game, and preset registries filled by content packs. Knows nothing about any game.

```ts
import { createCharacters } from '@adatechnology/game-characters'

const kit = createCharacters()
const person = kit.create({ seed: 1, kind: 'person' })
person.segments // 17 segments with hit points and status
person.state().body // { alive, vitality, missing, limp, crawl }
```

Plain script: `dist/index.global.js` exposes the `GameCharacters` global.
