import type { AreaPlacement, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import { EXPLOSIONS } from '@adatechnology/game-vfx'
import { createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal, ExplosiveDef } from '@adatechnology/game-weapons'
import { EXPLOSIVES_AREA_ID, createExplosivesBench } from './explosives-bench'
import type { ItemModels } from './item-models'
import type { ExplosivesRoom } from './explosives-bench'
import { explosivesScenarios } from './explosives-scenarios'
import { explosivesTextOf } from './explosives-text'
import { WORLD_EXPLOSIVE_PREFIX, worldExplosiveItem } from './world-explosives'

export { EXPLOSIVES_AREA_ID }
export type { ExplosivesRoom }

/** Where the things of the scene stand (metres, in the room's world; the brick wall is the room's own at z = -11). The kitchen corner is against the wall; the player looks at it from about 6 m. */
export interface ExplosivesScene {
  /** Item ids and positions of the kitchen furniture (items of the household module); one that the room does not know is left out. */
  readonly furniture: ReadonlyArray<{ readonly item: string; readonly at: Vec3; readonly rotationY?: number }>
  /** The cylinder. */
  readonly cylinder: Vec3
  /** The zombie (about 3 m from the cylinder) and the survivor (about 8 m): item ids of the characters module. */
  readonly zombie: { readonly item: string; readonly at: Vec3 }
  readonly survivor: { readonly item: string; readonly at: Vec3 }
  /** The player's eye (about 6 m from the cylinder: outside the 5 m lethal ring, the lamp rig of the weather module is behind it). */
  readonly eye: Vec3
}

/** The kitchen corner of the default scene: fridge, cabinet, the cylinder and the stove side by side against the wall, a table 2 m away. */
export const DEFAULT_EXPLOSIVES_SCENE: ExplosivesScene = {
  furniture: [
    { item: 'fridge', at: [-1.65, 0, -10.55] },
    { item: 'kitchen_cabinet_base', at: [-0.78, 0, -10.6] },
    { item: 'stove', at: [0.72, 0, -10.58] },
    { item: 'camp_table', at: [2.4, 0, -10.2] },
  ],
  cylinder: [0.02, 0, -10.66],
  zombie: { item: 'zombie_walker', at: [-1.6, 0, -8.1] },
  survivor: { item: 'person_police_officer', at: [6, 0, -5.3] },
  eye: [0, 1.7, -4.7],
}

export interface ExplosivesTestModuleOptions {
  /** `en` or `pt-BR` (default). */
  locale?: string
  /** The arsenal to read the P13 from (default `createArsenal` with the locale). */
  arsenal?: Arsenal
  /** The room the module drives: its destruction world, effects and tools. Without it the module still lays the area and the bench shows, but the actions only say they need the room. */
  room?: ExplosivesRoom
  /** Overrides of the default scene (see `ExplosivesScene`). */
  scene?: Partial<ExplosivesScene>
  /** Strength multiplier the bench starts at (default 1: the arsenal's numbers; a game value, see the README). */
  blastScale?: number
  /** The item models of game-items-three (`itemModels` there): the P13 is drawn with the team's model when given. */
  items?: ItemModels
}

const EXPLOSIVE_ID = 'propane_p13'
/** Aim and view of the area: the player's eye and the point it looks at. */
const AIM_HEIGHT = 0.25

/**
 * The explosives test area as a `TestableModule`: the P13 cooking gas cylinder in a kitchen corner against a brick wall, with furniture, a zombie at 3 m, a survivor at 8 m and rings on the floor at the
 * lethal and injury radii. The bench shoots it, opens its valve, lights it with a lighter, throws it in a fire or restarts the scene; every phase is told in the room's log in the locale of the room.
 * The module reads the sequence (the torch delay, the gas, the flight of the shell) from the arsenal def of `propane_p13` and the blast from its `chain`, so a game changes them with `ArsenalOptions.patch.explosives`.
 */
export function createExplosivesTestModule(options: ExplosivesTestModuleOptions = {}): TestableModule & { readonly bench: ReturnType<typeof createExplosivesBench> } {
  const locale = options.locale ?? 'pt-BR'
  const arsenal = options.arsenal ?? createArsenal({ locale })
  const text = explosivesTextOf(locale)
  const scene: ExplosivesScene = { ...DEFAULT_EXPLOSIVES_SCENE, ...options.scene }
  const def = arsenal.explosives.get(EXPLOSIVE_ID) as ExplosiveDef | undefined
  if (!def) throw new Error(`explosives area: the arsenal has no "${EXPLOSIVE_ID}"`)
  const bench = createExplosivesBench({ locale, text, def, scene, room: options.room, blastScale: options.blastScale ?? 1, ...(options.items ? { items: options.items } : {}), profile: EXPLOSIONS[EXPLOSIVE_ID] })
  return {
    id: EXPLOSIVES_AREA_ID,
    name: text.name,
    ground: { surface: 'concrete_slab' },
    group: text.group,
    bench,
    // the cylinder of this area is the world explosive of the weapons module with the bench's strength: the same id, the same model, the same part
    items: (): TestableItem[] => {
      const item = worldExplosiveItem(def, text.cylinder, { scale: () => bench.blastScale(), ...(options.items ? { items: options.items } : {}) })
      return item ? [item] : []
    },
    area: (): ModuleArea => {
      bench.areaOpened()
      const placements: AreaPlacement[] = [
        ...scene.furniture.map((piece) => ({ item: piece.item, position: piece.at, ...(piece.rotationY === undefined ? {} : { rotationY: piece.rotationY }) })),
        { item: `${WORLD_EXPLOSIVE_PREFIX}${EXPLOSIVE_ID}`, position: scene.cylinder },
        // facing the cylinder (the front of an item looks to +z, the cylinder is at -z)
        { item: scene.zombie.item, position: scene.zombie.at, rotationY: Math.PI },
        { item: scene.survivor.item, position: scene.survivor.at, rotationY: Math.PI },
      ]
      const centre: Vec3 = [scene.cylinder[0], AIM_HEIGHT, scene.cylinder[2]]
      return { placements, view: { eye: scene.eye, target: centre } }
    },
    controls: (): ModuleControl[] => bench.controls(),
    layers: (): ModuleLayer[] => bench.layers(),
    metrics: (): ModuleMetric[] => bench.metrics(),
    scenarios: (scenarioLocale?: string): Array<ModuleScenario<never>> => explosivesScenarios(scenarioLocale ?? locale, bench) as Array<ModuleScenario<never>>,
    attach: (host: ModuleHost) => bench.attach(host),
  }
}
