import type { NavHouseDef, NavRect, NavStair } from './floor-navigator.js'

/** The parts of a built house (`create(THREE, options).build(...)`) the navigator reads. */
export interface NavigableHouse {
  name?: string
  r: { floors: { index: number; y0: number; ceiling: number }[] }
  colliders: { type: string; f: number; x0: number; z0: number; x1: number; z1: number }[]
  stairs: { m: { ry: number }; f: number; to: number; rect: NavRect }[]
  floors: unknown[]
  roof: unknown
}

export interface NavigationDefOptions {
  /** Id the house registers with (default: the house's name). */
  id?: string
  /** Collider types that make a cell solid (default: walls and the boards of a barricade; the gaps of the doors stay free). */
  solids?: string[]
  /** The fine grid also rules the ground floor inside the house. */
  own?: boolean
}

/**
 * The registration of a built house in a floor navigator: heights from the plan's floors, solids from the house's wall colliders, one flight per
 * stair (its footprint, from the floor it leaves to the floor it reaches, along the axis the flight runs on) and the floor groups and roof to hide
 * by occlusion.
 */
export function navigationDefOf(house: NavigableHouse, options: NavigationDefOptions = {}): NavHouseDef {
  const types = new Set(options.solids ?? ['wall', 'board'])
  const floors = house.r.floors.map((floor) => ({
    y: floor.y0,
    h: floor.ceiling,
    solids: house.colliders.filter((c) => c.f === floor.index && types.has(c.type)).map((c): NavRect => [c.x0, c.z0, c.x1, c.z1]),
  }))
  // a flight climbs towards the local -z of its item (its bottom is at +z): in the world that is (-sin, -cos) of the rotation
  const stairs = house.stairs.map((stair): NavStair => {
    const c = Math.cos(stair.m.ry), s = Math.sin(stair.m.ry), [x0, z0, x1, z1] = stair.rect
    if (Math.abs(c) >= Math.abs(s)) return -c > 0 ? [x0, z0, x1, z1, stair.f, stair.to, 'z'] : [x0, z1, x1, z0, stair.f, stair.to, 'z']
    return -s > 0 ? [x0, z0, x1, z1, stair.f, stair.to, 'x'] : [x1, z0, x0, z1, stair.f, stair.to, 'x']
  })
  return { id: options.id ?? house.name ?? 'house', floors, stairs, groups: house.floors, roof: house.roof, own: options.own }
}
