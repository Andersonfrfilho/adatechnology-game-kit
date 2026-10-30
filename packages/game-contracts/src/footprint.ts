/** A floor rectangle in an object's own space, metres (x across, z along). */
export interface Footprint {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/** What `footprintBlocker` reads of an object: its world matrix (three.js `Object3D`, duck-typed so the contracts stay free of three.js). */
export interface FootprintObject {
  readonly matrixWorld: { readonly elements: ArrayLike<number> }
  readonly parent?: unknown
  updateWorldMatrix?(updateParents: boolean, updateChildren: boolean): void
}

/**
 * The `ModuleHost.addBlocker` function of a solid object standing on the floor: the walking player stays out of `footprint`, a rectangle in the object's own space,
 * so the object blocks turned with it and follows it when it moves. An object out of the scene (no parent) blocks nothing.
 */
export function footprintBlocker(object: FootprintObject | (() => FootprintObject | null | undefined), footprint: Footprint | (() => Footprint | null | undefined)): (x: number, z: number, radius: number) => boolean {
  return (x, z, radius) => {
    const o = typeof object === 'function' ? object() : object
    const fp = typeof footprint === 'function' ? footprint() : footprint
    if (!o || !fp || !o.parent) return false
    o.updateWorldMatrix?.(true, false)
    const e = o.matrixWorld.elements
    // the world point in the object's own floor axes: its x and z columns are at right angles, so a projection on each (over its squared length, for a scale) inverts the matrix
    const dx = x - (e[12] as number)
    const dz = z - (e[14] as number)
    const ax = (e[0] as number) ** 2 + (e[1] as number) ** 2 + (e[2] as number) ** 2
    const az = (e[8] as number) ** 2 + (e[9] as number) ** 2 + (e[10] as number) ** 2
    const lx = (dx * (e[0] as number) + dz * (e[2] as number)) / (ax || 1)
    const lz = (dx * (e[8] as number) + dz * (e[10] as number)) / (az || 1)
    return lx > fp.minX - radius && lx < fp.maxX + radius && lz > fp.minZ - radius && lz < fp.maxZ + radius
  }
}
