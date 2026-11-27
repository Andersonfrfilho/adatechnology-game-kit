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

/** A fixed box a module gives the host as the body of an obstacle (`ModuleHost.addBlocker`): centre and half sizes in the world, the turn as a quaternion (default none). */
export interface HostSolid {
  readonly center: readonly [number, number, number]
  readonly half: readonly [number, number, number]
  readonly rotation?: readonly [number, number, number, number]
  /** Names the box across calls (a box measured again is the same box): without it, the place in the list. */
  readonly key?: string
}

/**
 * The fixed box of `footprint` on `object`, `height` metres tall from the floor: the body of what `footprintBlocker` stops the player at. An object out of the scene (no parent) has no box.
 * The turn is read from the object's x and z columns (a turn about the vertical axis, as the blocker reads it).
 */
export function footprintSolid(object: FootprintObject | (() => FootprintObject | null | undefined), footprint: Footprint | (() => Footprint | null | undefined), height: number): HostSolid[] {
  const o = typeof object === 'function' ? object() : object
  const fp = typeof footprint === 'function' ? footprint() : footprint
  if (!o || !fp || !o.parent) return []
  o.updateWorldMatrix?.(true, false)
  const e = o.matrixWorld.elements
  const sx = Math.hypot(e[0] as number, e[2] as number) || 1
  const sz = Math.hypot(e[8] as number, e[10] as number) || 1
  const angle = Math.atan2(-(e[2] as number), e[0] as number)
  const cx = (fp.minX + fp.maxX) / 2
  const cz = (fp.minZ + fp.maxZ) / 2
  const centreX = (e[12] as number) + cx * (e[0] as number) + cz * (e[8] as number)
  const centreZ = (e[14] as number) + cx * (e[2] as number) + cz * (e[10] as number)
  return [{ center: [centreX, height / 2, centreZ], half: [((fp.maxX - fp.minX) / 2) * sx, height / 2, ((fp.maxZ - fp.minZ) / 2) * sz], rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)] }]
}
