import type { TerrainBudget, TerrainMark } from './types'

/** Two marks at this fraction of their radii or closer are one hole. */
const SAME_HOLE = 0.75

/** Fine marks under a budget per area and a global one: past the budget the closest two of the area become one, and past the global one the oldest goes. */
export interface MarkStore {
  readonly list: TerrainMark[]
  add(spec: Omit<TerrainMark, 'id' | 'count' | 'born'>): TerrainMark
  near(x: number, z: number, radius: number): TerrainMark | undefined
  depthAt(x: number, z: number): number
  remove(mark: TerrainMark): void
  removeInside(x: number, z: number, radius: number): void
  clear(): void
  load(marks: readonly TerrainMark[]): void
  readonly version: number
}

export function createMarkStore(budget: TerrainBudget): MarkStore {
  const list: TerrainMark[] = []
  const areas = new Map<number, TerrainMark[]>()
  let serial = 0
  let version = 0
  const areaKey = (x: number, z: number): number => Math.floor(x / budget.markAreaSize) * 100003 + Math.floor(z / budget.markAreaSize)

  function detach(mark: TerrainMark): void {
    const key = areaKey(mark.x, mark.z)
    const area = areas.get(key)
    if (area) {
      const at = area.indexOf(mark)
      if (at >= 0) area.splice(at, 1)
      if (area.length === 0) areas.delete(key)
    }
    const at = list.indexOf(mark)
    if (at >= 0) list.splice(at, 1)
    version++
  }

  function attach(mark: TerrainMark): void {
    const key = areaKey(mark.x, mark.z)
    const area = areas.get(key)
    if (area) area.push(mark)
    else areas.set(key, [mark])
    list.push(mark)
    version++
  }

  function mergeClosestPair(area: TerrainMark[]): void {
    let bestA = area[0]!
    let bestB = area[1]!
    let best = Infinity
    for (let i = 0; i < area.length; i++) {
      for (let j = i + 1; j < area.length; j++) {
        const distance = Math.hypot(area[i]!.x - area[j]!.x, area[i]!.z - area[j]!.z)
        if (distance < best) {
          best = distance
          bestA = area[i]!
          bestB = area[j]!
        }
      }
    }
    const weight = bestA.radius ** 2 + bestB.radius ** 2
    const shareB = weight > 0 ? bestB.radius ** 2 / weight : 0.5
    detach(bestB)
    bestA.x += (bestB.x - bestA.x) * shareB
    bestA.z += (bestB.z - bestA.z) * shareB
    bestA.radius = Math.sqrt(weight)
    bestA.depth = Math.max(bestA.depth, bestB.depth)
    bestA.count += bestB.count
    version++
  }

  return {
    list,
    add(spec) {
      const mark: TerrainMark = { ...spec, id: ++serial, count: 1, born: serial }
      attach(mark)
      const area = areas.get(areaKey(mark.x, mark.z))!
      if (area.length > budget.maxMarksPerArea) mergeClosestPair(area)
      if (list.length > budget.maxMarks) detach(list.reduce((oldest, candidate) => (candidate.born < oldest.born ? candidate : oldest)))
      return mark
    },
    near(x, z, radius) {
      let found: TerrainMark | undefined
      let best = Infinity
      const reach = Math.ceil((radius + 0.5) / budget.markAreaSize)
      const baseX = Math.floor(x / budget.markAreaSize)
      const baseZ = Math.floor(z / budget.markAreaSize)
      for (let dx = -reach; dx <= reach; dx++) {
        for (let dz = -reach; dz <= reach; dz++) {
          for (const mark of areas.get((baseX + dx) * 100003 + baseZ + dz) ?? []) {
            const distance = Math.hypot(mark.x - x, mark.z - z)
            if (distance < best && distance < Math.max(mark.radius, radius) * SAME_HOLE) {
              best = distance
              found = mark
            }
          }
        }
      }
      return found
    },
    depthAt(x, z) {
      let depth = 0
      for (const mark of areas.get(areaKey(x, z)) ?? []) {
        const distance = Math.hypot(mark.x - x, mark.z - z)
        if (distance < mark.radius) depth = Math.max(depth, mark.depth * (1 - (distance / mark.radius) ** 2))
      }
      return depth
    },
    remove: detach,
    removeInside(x, z, radius) {
      for (const mark of [...list]) if (Math.hypot(mark.x - x, mark.z - z) + mark.radius * 0.5 < radius) detach(mark)
    },
    clear() {
      list.length = 0
      areas.clear()
      // the numbering starts again with the ground (a loaded snapshot takes it on from its own marks); `version` only grows, the renderers follow it
      serial = 0
      version++
    },
    load(marks) {
      this.clear()
      for (const mark of marks) {
        attach({ ...mark })
        serial = Math.max(serial, mark.id)
      }
    },
    get version() {
      return version
    },
  }
}
