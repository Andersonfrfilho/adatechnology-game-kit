# @adatechnology/game-kit-defaults

The default preset of the kit, the equivalent of Bevy's `DefaultPlugins`. It sits in the composition layer (L5 of `specs/005-camadas-e-quadro/plan.md`, D1 and D7): it imports the content packs and returns the options that the cores and the adapters take by option. The cores and adapters import content only through the named D2 exceptions of `.dependency-cruiser.cjs`.

A game that wants the full kit calls the preset. The cores and adapters still work without it, with the same content as before as a deprecated default (spec 005, D2), removed in the next major; the by-option path is the recommended one. A game that wants another fleet, other plants or other furniture does not call it and does not ship the default content.

```ts
import { defaultCharacterClips } from '@adatechnology/game-kit-defaults'

toRoomAvatar(avatar, { ...defaultCharacterClips() })
```

## Presets

| Preset | Returns | Feeds | Content pack |
|---|---|---|---|
| `defaultUrbanProviders(options?)` | `{ vehicle, plant }` | `compose(b, origin, { providers })` of the neighbourhoods of `game-urban`; `providers` of `createUrbanTestModule` | `game-vehicles-fleet`, `game-vegetation-species` |
| `createVehicleProvider(options?)`, `createPlantProvider(options?)` | the providers of `game-urban` with the kit's fleet (`PARKED_VEHICLE_IDS`) and the regional table (`region`, Brazil's) as default | same | same |
| `defaultPlantPicker(region?)` | `(context, key) => speciesId` | `pickSpecies` of `createPlantProvider` | `game-vegetation-species` |
| `defaultStoryContent(locale?)`, `defaultProfessionName(id, locale)` | `{ names, ruleset, professionName }` | `createStoryWorld`, `simulateStories`, `createSheet`, `drawSheet` and `createStoriesTestModule` of `game-stories` | `game-characters-people` |
| `defaultFurnitureCatalog()` | `residentialItems` | `catalog` of `furnitureSpec` of `game-floorplan-three` | `game-floorplan-residential` |
| `defaultVehicleFleet()` | `{ colorFromSeed, fleetDims, paintPalettes, paletteOf, installFleet }` | `fleet` of `createVehiclesThree` and of `createVehiclesTestModule` of `game-vehicles-three` | `game-vehicles-fleet` |
| `defaultPlantSpec(id)` | the generator spec of a species (`toSpec`) | `toSpec` of `createPlantResolver` and `plantSpec` of `createUrbanTestModule` of `game-urban-three` | `game-vegetation-species` |
| `defaultVegetationSpecies()` | the species pack | `GameVegetationSpecies` of `createVegetationTestModule` of `game-vegetation-three` | `game-vegetation-species` |
| `defaultCharacterClips()` | `{ strikeClips, firstPersonClips }` | `toRoomAvatar` of `game-characters-three` | `game-characters-people` |
| `createKitWorkers(options?)` | the kit's worker coordinator (`game-workers`), on by default | `crowdPhysics.workers` of `game-crowd`, `createCoordinatorGroundPort(workers)` for `groundWorker` of `game-destruction-three` | `KIT_WORKER_KINDS`: `crowd.physics`, `destruction.ground-tiles` |



## Workers (CLAUDE.md §14)

`createKitWorkers()` is the kit's worker coordinator, on by default: the automatic number of workers by the machine's cores (one core kept for the main thread, at most 8), every kind of the kit (`KIT_WORKER_KINDS`) with its own schedule. Every module of the game takes the same one.

```ts
import { createKitWorkers } from '@adatechnology/game-kit-defaults'
import { createCoordinatorGroundPort } from '@adatechnology/game-destruction-three'

const workers = createKitWorkers() // module workers of this package's dist/kit-worker.js
await workers.warm(KIT_WORKER_KINDS)
createDestructionRenderer(THREE, { groundWorker: createCoordinatorGroundPort(workers) })
createCrowd({ pack, physics: { ...CROWD_PHYSICS_DEFAULTS, workers } })
```

By hand, with the same options as `createWorkerCoordinator`: `createKitWorkers({ workers: 4, lanes: { sim: { workers: 2 } }, reserveCores: 2, kinds: { 'destruction.ground-tiles': { latencyFrames: 3 } } })`. Off: `workers: 0` or `spawn: null` (every job on the main thread, the same results). A page of one file passes `spawn: sourceSpawn(text of dist/kit-worker.global.js, { type: 'classic' })`, as `examples/test-room` does; Node passes `nodeSpawn(url)` of a file that calls `installWorkerHost(nodeWorkerScope(), KIT_WORKER_KINDS)`. A game with kinds of its own writes its worker file with them after the kit's: `installWorkerHost(self, [...KIT_WORKER_KINDS, ...mine])`.
