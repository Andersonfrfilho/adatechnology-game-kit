import { createFootprintRainCover, createGridRainCover, rainCoverTopOf } from '@adatechnology/game-contracts'
import type { RainCover, RainCoverBounds, RainCoverFootprint, RainCoverHole, RainCoverRect, RainCoverSource } from '@adatechnology/game-contracts'

import type { House } from './types.js'

/** The widest a through-hole in a roof or slab may be and still keep the rain out: a bullet hole does not let it in, a blast hole does. */
export const RAIN_OPENING_DIAMETER = 0.3
const GONE = new Set(['broken', 'collapsed', 'melted', 'ashes'])
const COVER_ROLES = new Set(['slab', 'roof'])
const BOUNDS_MARGIN = 0.5
/** The slab over an outbuilding's ceiling, metres (`outbuildingSlabEdge`). */
const OUTBUILDING_SLAB = 0.2
/** Plan item types whose model is a solid roof over what is under it (the sauna cabin, the doghouse, the outhouse): the box of the item roofs its footprint at its height. A pergola's slats are not one. */
export const ROOFED_ITEM_TYPES: ReadonlySet<string> = new Set(['sauna', 'doghouse', 'outhouse'])

type Cover = { readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly halfX: number; readonly halfY: number; readonly halfZ: number }

/**
 * The covers of a house for the rain: every roof and slab panel of its destructible spec, in the world, as a rectangle with the height of its top. A panel that broke,
 * collapsed or left the destruction world no longer covers, and a through-hole of {@link RAIN_OPENING_DIAMETER} or more in a slab or roof is a round opening. It follows the house's destruction events.
 */
export function createHouseRainCover(house: House): RainCoverSource & { dispose(): void } {
  const covers = (): Cover[] => {
    const parts = house.destruction.spec?.parts ?? []
    const found: Cover[] = []
    for (const part of parts) {
      const shape = part.shape
      if (!part.structure || !COVER_ROLES.has(part.structure.role) || shape.kind !== 'box') continue
      found.push({ id: part.id, x: part.position[0], y: part.position[1], z: part.position[2], halfX: shape.size[0] / 2, halfY: shape.size[1] / 2, halfZ: shape.size[2] / 2 })
    }
    if (found.length > 0) return found
    return house.structure.parts
      .filter((part) => COVER_ROLES.has(part.role))
      .map((part) => ({ id: part.id, x: (part.aabb[0] + part.aabb[2]) / 2, y: (part.y0 + part.y1) / 2, z: (part.aabb[1] + part.aabb[3]) / 2, halfX: (part.aabb[2] - part.aabb[0]) / 2, halfY: (part.y1 - part.y0) / 2, halfZ: (part.aabb[3] - part.aabb[1]) / 2 }))
  }
  const ids = new Set(covers().map((cover) => cover.id))
  const toWorld = (x: number, y: number, z: number): readonly [number, number, number] => {
    const e = house.group.matrixWorld.elements
    return [e[0]! * x + e[4]! * y + e[8]! * z + e[12]!, e[1]! * x + e[5]! * y + e[9]! * z + e[13]!, e[2]! * x + e[6]! * y + e[10]! * z + e[14]!]
  }
  const extent = (): { rects: RainCoverRect[]; holes: RainCoverHole[] } => {
    house.group.updateWorldMatrix(true, false)
    const state = house.destruction.state()
    const stateOf = new Map((state?.parts ?? []).map((part) => [part.id, part]))
    const rects: RainCoverRect[] = []
    const holes: RainCoverHole[] = []
    for (const cover of covers()) {
      const part = stateOf.get(cover.id)
      if (state && (!part || GONE.has(part.status))) continue
      const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => toWorld(cover.x + sx * cover.halfX, cover.y + cover.halfY, cover.z + sz * cover.halfZ)))
      const xs = corners.map((corner) => corner[0])
      const zs = corners.map((corner) => corner[2])
      rects.push({ bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], top: corners[0]![1] })
      for (const hole of part?.holes ?? []) {
        if (!hole.through || hole.diameter < RAIN_OPENING_DIAMETER) continue
        const at = toWorld(hole.point[0], hole.point[1], hole.point[2])
        holes.push({ x: at[0], z: at[2], radius: hole.diameter / 2 })
      }
    }
    return { rects, holes }
  }
  let rects: RainCoverRect[] = []
  let holes: RainCoverHole[] = []
  let bounds: RainCoverBounds = [0, 0, 0, 0]
  const refresh = (): void => {
    ;({ rects, holes } = extent())
    if (rects.length === 0) bounds = [0, 0, 0, 0]
    else bounds = [Math.min(...rects.map((r) => r.bounds[0])) - BOUNDS_MARGIN, Math.min(...rects.map((r) => r.bounds[1])) - BOUNDS_MARGIN, Math.max(...rects.map((r) => r.bounds[2])) + BOUNDS_MARGIN, Math.max(...rects.map((r) => r.bounds[3])) + BOUNDS_MARGIN]
  }
  refresh()
  const grid = createGridRainCover({ bounds, coverTopAt: (x, z) => rainCoverTopOf(rects, holes, x, z) })
  let isStale = false
  const stopEvents = house.destruction.onEvent((event) => {
    if ('part' in event && event.part !== undefined && ids.has(event.part)) isStale = true
  })
  const sync = (): void => {
    if (!isStale) return
    isStale = false
    refresh()
    grid.invalidate()
  }
  return {
    bounds: () => bounds,
    version() {
      sync()
      return grid.version()
    },
    coverTopAt(x, z) {
      sync()
      return grid.coverTopAt(x, z)
    },
    dispose: stopEvents,
  }
}

/** The roofed items of the plan (see {@link ROOFED_ITEM_TYPES}) and the slab roof of each outbuilding (the edicula: its walls and slab are drawn, no part of the structure) where the house stands now. */
export function createItemRainCover(house: House): RainCoverSource {
  house.group.updateWorldMatrix(true, false)
  const e = house.group.matrixWorld.elements
  const houseYaw = Math.atan2(e[2]!, e[0]!)
  const roofs: RainCoverFootprint[] = []
  for (const item of house.r.items) {
    if (!ROOFED_ITEM_TYPES.has(item.type)) continue
    const [x, z] = [item.x, item.z]
    roofs.push({ x: e[0]! * x + e[8]! * z + e[12]!, z: e[2]! * x + e[10]! * z + e[14]!, halfX: item.w / 2, halfZ: item.d / 2, yaw: houseYaw - item.ry, top: e[1]! * x + e[5]! * (item.y + item.h) + e[9]! * z + e[13]! })
  }
  for (const building of house.r.outbuildings ?? []) {
    const half = (building.thickness ?? 0.15) / 2
    const [u0, v0, u1, v1] = building.aabb
    const [cu, cv] = [(u0 + u1) / 2, (v0 + v1) / 2]
    roofs.push({ x: e[0]! * cu + e[8]! * cv + e[12]!, z: e[2]! * cu + e[10]! * cv + e[14]!, halfX: (u1 - u0) / 2 + half, halfZ: (v1 - v0) / 2 + half, yaw: houseYaw, top: e[1]! * cu + e[5]! * (building.ceiling + OUTBUILDING_SLAB) + e[9]! * cv + e[13]! })
  }
  const source = createFootprintRainCover()
  source.set(roofs, [], true)
  return source
}

/** Adds the covers of `house` to `cover` (`ModuleHost.rainCover`, `KitWorld.rainCover`); returns the function that takes them away. Call once the house stands where it will. */
export function addHouseRainCover(cover: RainCover, house: House): () => void {
  const source = createHouseRainCover(house)
  const remove = cover.add(source)
  const removeItems = cover.add(createItemRainCover(house))
  return () => {
    remove()
    removeItems()
    source.dispose()
  }
}
