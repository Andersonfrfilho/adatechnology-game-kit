import type JoltNS from 'jolt-physics/wasm-compat'

interface Hull {
  readonly points: readonly number[]
  readonly shape: JoltNS.Shape
}

const bits = new Float64Array(1)
const halves = new Uint32Array(bits.buffer)

/** FNV-1a over the bits of every number (from `seed`): the same points, the same hash. */
export const hashOf = (points: ArrayLike<number>, seed = 0x811c9dc5): number => {
  let hash = seed
  for (let i = 0; i < points.length; i++) {
    bits[0] = points[i]!
    hash = Math.imul(hash ^ halves[0]!, 0x01000193)
    hash = Math.imul(hash ^ halves[1]!, 0x01000193)
  }
  return hash >>> 0
}

export const sameBits = (a: readonly number[], b: ArrayLike<number>): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

/**
 * The convex hulls one body's compound shape holds, kept for the next shape it gets. Making a hull is most of what a compound of hulls costs, and a compound made again after
 * a small change holds mostly the hulls it held. A shape holds its own reference to a hull, so what this lets go (a hull the new shape does not use) never changes a shape made.
 * It holds exactly the hulls of the body's current shape, so it adds none to what the shape already costs and never grows with the number of changes.
 */
export class HullSet {
  private held = new Map<number, Hull>()
  private building = new Map<number, Hull>()
  /** Hulls whose hash another hull of this shape already has: used once, let go at `finish`. */
  private strays: JoltNS.Shape[] = []

  /** The hull of `points` the last shape held, else made with `make`. Borrowed: a compound that takes it holds its own reference; the caller does not release it. */
  shapeOf(points: ArrayLike<number>, make: () => JoltNS.Shape): JoltNS.Shape {
    const key = hashOf(points)
    const inUse = this.building.get(key)
    if (inUse) {
      if (sameBits(inUse.points, points)) return inUse.shape
      const stray = make()
      this.strays.push(stray)
      return stray
    }
    const before = this.held.get(key)
    if (before && sameBits(before.points, points)) {
      this.held.delete(key)
      this.building.set(key, before)
      return before.shape
    }
    const shape = make()
    this.building.set(key, { points: Array.from(points), shape })
    return shape
  }

  /** The shape is made: what it uses is kept for the next, and what the last held and this did not use is let go. */
  finish(): void {
    for (const hull of this.held.values()) hull.shape.Release()
    for (const shape of this.strays) shape.Release()
    this.held = this.building
    this.building = new Map()
    this.strays = []
  }

  /** How many hulls it holds for the next shape. */
  get size(): number {
    return this.held.size
  }

  dispose(): void {
    for (const hull of this.held.values()) hull.shape.Release()
    for (const hull of this.building.values()) hull.shape.Release()
    for (const shape of this.strays) shape.Release()
    this.held.clear()
    this.building.clear()
    this.strays = []
  }
}
