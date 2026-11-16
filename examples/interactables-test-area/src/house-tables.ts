// The house and the yard on tables: every thing a house of the kit holds, laid out room by room so each one can be shot, hit, burnt and blown up next to the
// others. What the house keeps in its furniture (the goods pools of game-items-goods) lies on the items area's tables, one group of tables per room; the
// household furniture and the houses' own furniture stand on the floor behind them, room by room; the yard (barbecue, clothesline, bins, the well, the camp
// gear and the garden plants) stands on lawn at the back; what hangs on a wall (wall cabinets, sockets, the electrical panel, blinds) hangs on the room's
// target wall. Every piece comes from the module that owns it, by its catalogue id: these modules have no items of their own, only the layout.
//   ?area=house_tables           the whole house and yard (the page opens a wider floor for it, with only the target wall)
//   ?area=house_tables_kitchen   the kitchen alone, small enough for the plain room: the scenarios run on it
import { FINDS_TABLE_ID } from '@adatechnology/game-items-three'
import type { GroundLayout, ModuleArea, ModuleScenario, TestableItem, TestableModule } from '@adatechnology/game-contracts'
import type { ItemSize, ScenarioContext, SpawnedObject } from '@adatechnology/game-test-room'
import type * as ThreeNamespace from 'three'

import { KITCHEN_ONLY, ON_THE_WALL, SECTIONS } from './house-tables-data.js'
import type { Locale } from './house-tables-data.js'
import { layHouseTables } from './house-tables-layout.js'
import type { HousePlan, HouseTablesLayout } from './house-tables-layout.js'

export const HOUSE_TABLES_ID = 'house_tables'
export const HOUSE_TABLES_KITCHEN_ID = 'house_tables_kitchen'

/** The whole house: a strip 36 m wide from z = 19 back to the target wall (the page opens a floor 24 m each way for it). */
const WHOLE_HOUSE: HousePlan = { sections: SECTIONS, halfX: 18, firstZ: 19, wall: ON_THE_WALL }
const KITCHEN_WALL = new Set(['kitchen_cabinet_wall', 'wall_socket', 'wall_switch'])
/** The kitchen alone: in front of the plain room's scenery (its tables, shelf and tub stand between z = -1 and 4), inside its 14 m floor. */
const KITCHEN: HousePlan = {
  sections: SECTIONS.filter((section) => KITCHEN_ONLY.includes(section.id)),
  halfX: 11,
  firstZ: 13,
  wall: ON_THE_WALL.filter((item) => KITCHEN_WALL.has(item)),
}

/** What the area modules need from the room: its measure of a catalogue item (null for an id it did not load). */
export interface HouseTablesOptions {
  readonly locale?: string
  readonly measure: (itemId: string) => ItemSize | null
}

const localeOf = (locale: string | undefined): Locale => (locale === 'en' ? 'en' : 'pt-BR')

/** The ids of what is still in the room. */
const liveIds = (room: ScenarioContext['room']): Set<string> => new Set(room.spawned().map((so) => so.objectId))

/** What the area laid on its tables and is still in the room. */
const onTablesNow = (room: ScenarioContext['room'], spawned: readonly SpawnedObject[], layout: HouseTablesLayout): SpawnedObject[] => {
  const live = liveIds(room)
  return spawned.filter((so) => layout.onTables.has(so.itemId) && live.has(so.objectId))
}

type Three = typeof ThreeNamespace

/** Gap under a thing's box that still counts as resting on what is below, metres; the ray starts `REST_RISE` above the bottom of the box (a thing sunk a little in the floor still lies on it). */
const REST_GAP = 0.05
const REST_RISE = 0.1

const isInside = (node: ThreeNamespace.Object3D, root: ThreeNamespace.Object3D): boolean => {
  for (let o: ThreeNamespace.Object3D | null = node; o; o = o.parent) if (o === root) return true
  return false
}

/**
 * Whether what is drawn under `root` holds it: a ray down from near the bottom of its box, at its centre and at the four corners pulled 30 % in, meets a visible mesh
 * of something else within `REST_GAP` under the box (the floor, a table top, another thing). A thing thrown by a blast lies on something; one that stopped in the air does not.
 */
function restsOnSomething(THREE: Three, room: ScenarioContext['room'], root: ThreeNamespace.Object3D): boolean {
  const box = new THREE.Box3().setFromObject(root)
  const centre = box.getCenter(new THREE.Vector3())
  // on the ground: the terrain's height there, whatever its mesh is drawn as
  if (box.min.y <= room.terrain.heightAt(centre.x, centre.z) + REST_GAP) return true
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.35)
  const ray = new THREE.Raycaster()
  // sprites (labels, flames) are hit through the camera
  ray.camera = room.camera
  ray.far = REST_RISE + REST_GAP
  const down = new THREE.Vector3(0, -1, 0)
  return [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx = 0, sz = 0]) => {
    ray.set(new THREE.Vector3(centre.x + sx * half.x, box.min.y + REST_RISE, centre.z + sz * half.z), down)
    return ray.intersectObjects(room.scene.children, true).some((hit) => hit.object.visible && !isInside(hit.object, root))
  })
}

/** The scenarios, on the kitchen: everything laid lands where it was put and stays still; a grenade under a table throws what is on it, and nothing stays hanging in the air. */
function scenariosOf(locale: Locale, layout: () => HouseTablesLayout, three: () => Three | null): Array<ModuleScenario<ScenarioContext>> {
  const T = (pt: string, en: string): string => (locale === 'en' ? en : pt)
  const n2 = (n: number): string => n.toFixed(2)
  return [
    {
      id: 'house_tables_laid',
      name: T('Casa nas mesas (cozinha): o que a cozinha guarda fica no tampo, os móveis no chão, nada afunda nem flutua', 'House on tables (kitchen): what the kitchen keeps stays on the top, the furniture on the floor, nothing sinks or floats'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_TABLES_KITCHEN_ID)
        const expected = layout().area.placements.length
        expect(spawned.length === expected && layout().missing.length === 0, T(`Peças postas: ${spawned.length} de ${expected}`, `Pieces laid: ${spawned.length} of ${expected}`), { missing: layout().missing })
        step(2)
        const top = room.measure(FINDS_TABLE_ID)?.h ?? 0
        const onTables = onTablesNow(room, spawned, layout())
        const off = onTables.filter((so) => Math.abs(so.root.position.y - top) > 0.06)
        expect(onTables.length >= 20 && off.length === 0, T(`${onTables.length} itens nas mesas, ${off.length} fora do tampo (${n2(top)} m)`, `${onTables.length} items on the tables, ${off.length} off the top (${n2(top)} m)`), {
          off: off.map((so) => ({ item: so.itemId, y: so.root.position.y })),
        })
        const live = liveIds(room)
        const floor = spawned.filter((so) => layout().onFloor.has(so.itemId) && live.has(so.objectId))
        const sunk = floor.filter((so) => Math.abs(so.root.position.y) > 0.05)
        expect(floor.length >= 8 && sunk.length === 0, T(`${floor.length} móveis no chão, ${sunk.length} fora do chão`, `${floor.length} pieces on the floor, ${sunk.length} off the floor`), {
          sunk: sunk.map((so) => ({ item: so.itemId, y: so.root.position.y })),
        })
      },
    },
    {
      id: 'house_tables_grenade',
      name: T('Casa nas mesas (cozinha): uma granada debaixo da mesa joga longe o que está nela, e nada fica parado no ar', 'House on tables (kitchen): a grenade under the table throws what lies on it, and nothing stays still in the air'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_TABLES_KITCHEN_ID)
        step(1)
        const table = spawned.find((so) => so.itemId === FINDS_TABLE_ID)
        if (!table) {
          expect(false, T('A mesa foi posta', 'The table was laid'))
          return
        }
        const at = table.root.position.clone()
        const near = onTablesNow(room, spawned, layout()).filter((so) => Math.abs(so.root.position.x - at.x) < 1.7 && Math.abs(so.root.position.z - at.z) < 0.6)
        const before = new Map(near.map((so) => [so.objectId, so.root.position.clone()]))
        expect(room.blastAt('m67', [at.x, 0.05, at.z]), T('A granada explodiu debaixo da mesa', 'The grenade went off under the table'))
        step(8)
        const ids = liveIds(room)
        const live = near.filter((so) => ids.has(so.objectId))
        const moved = live.filter((so) => (before.get(so.objectId)?.distanceTo(so.root.position) ?? 0) > 0.2)
        const thrown = moved.length + near.length - live.length
        expect(thrown >= Math.min(5, near.length), T(`A explosão jogou ou quebrou ${thrown} de ${near.length} itens da mesa`, `The blast threw or broke ${thrown} of ${near.length} items of the table`))
        // 8 s later what was thrown and stopped lies on something drawn: the floor, a top, another thing
        // still means it stopped: what is still rolling or bouncing is not hanging
        const at8 = new Map(live.map((so) => [so.objectId, so.root.position.clone()]))
        step(0.5)
        // what the blast threw past the edge of the room's floor has no drawn floor under it: only what is over the floor is judged
        const [x0, z0, x1, z1] = room.terrain.bounds
        const overFloor = (so: SpawnedObject): boolean => so.root.position.x > x0 && so.root.position.x < x1 && so.root.position.z > z0 && so.root.position.z < z1
        const still = live.filter((so) => ids.has(so.objectId) && overFloor(so) && (at8.get(so.objectId)?.distanceTo(so.root.position) ?? 1) < 0.01)
        const THREE = three()
        const hanging = THREE ? still.filter((so) => !restsOnSomething(THREE, room, so.root)) : still
        expect(hanging.length === 0, T(`Nada parado no ar: tudo o que foi jogado está sobre algo (${hanging.length})`, `Nothing still in the air: everything thrown lies on something (${hanging.length})`), {
          hanging: hanging.map((so) => ({ item: so.itemId, at: so.root.position.toArray() })),
          still: still.length,
        })
      },
    },
  ]
}

/** One area module over a plan: the layout is made the first time the area opens, when every other module is in the room, and kept. */
function areaModule(options: HouseTablesOptions, spec: { readonly id: string; readonly name: readonly [string, string]; readonly plan: HousePlan; readonly scenarios: boolean }): TestableModule<ScenarioContext> {
  const locale = localeOf(options.locale)
  let made: HouseTablesLayout | null = null
  let THREE: Three | null = null
  const layout = (): HouseTablesLayout => {
    made ??= layHouseTables(options.measure, locale, spec.plan)
    return made
  }
  const name = locale === 'en' ? spec.name[1] : spec.name[0]
  return {
    id: spec.id,
    name,
    group: name,
    items: (): TestableItem[] => [],
    area: (): ModuleArea => layout().area,
    get ground(): GroundLayout {
      return layout().ground
    },
    attach: (host) => {
      THREE = host.THREE as Three
      return () => {
        THREE = null
      }
    },
    ...(spec.scenarios ? { scenarios: () => scenariosOf(locale, layout, () => THREE) } : {}),
  }
}

/** The two area modules for `room.loadModule`: the whole house and yard (`?area=house_tables`) and the kitchen alone (`?area=house_tables_kitchen`, with the scenarios). */
export function createHouseTablesAreas(options: HouseTablesOptions): Array<TestableModule<ScenarioContext>> {
  return [
    areaModule(options, { id: HOUSE_TABLES_ID, name: ['Casa e quintal nas mesas', 'House and yard on tables'], plan: WHOLE_HOUSE, scenarios: false }),
    areaModule(options, { id: HOUSE_TABLES_KITCHEN_ID, name: ['Cozinha nas mesas', 'Kitchen on tables'], plan: KITCHEN, scenarios: true }),
  ]
}
