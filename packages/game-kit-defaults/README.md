# @adatechnology/game-kit-defaults

The default preset of the kit, the equivalent of Bevy's `DefaultPlugins`. It sits in the composition layer (L5 of `specs/005-camadas-e-quadro/plan.md`, D1 and D7): it imports the content packs and returns the options that the cores and the adapters take by option, so the cores and adapters never import content themselves.

A game that wants the full kit calls the preset. A game that wants another fleet, other plants or other furniture does not call it and does not ship the default content.

```ts
import { defaultCharacterClips } from '@adatechnology/game-kit-defaults'

toRoomAvatar(avatar, { ...defaultCharacterClips() })
```

## Presets

| Preset | Returns | Feeds | Content pack |
|---|---|---|---|
| `defaultCharacterClips()` | `{ strikeClips, firstPersonClips }` | `toRoomAvatar` of `game-characters-three` | `game-characters-people` |

More presets are added by the tasks of phase 3 (urban providers, vehicle palettes, furniture).
