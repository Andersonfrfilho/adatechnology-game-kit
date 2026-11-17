import type JoltNS from 'jolt-physics/wasm-compat'

import type { ShapeDesc } from '@adatechnology/game-physics'

import { hashOf, sameBits } from './hull-cache'

/** The kinds a shape can be made ahead of: the ones a compound child is made of from its own numbers alone. */
export type Prebuildable = Extract<ShapeDesc, { readonly kind: 'box' | 'sphere' | 'capsule' | 'cylinder' | 'convex' }>

/** Most shapes the world holds made ahead (all owners): a few house loads of part boxes, under a megabyte of heap. */
export const MAX_READY = 8192

const CODE: Readonly<Record<Prebuildable['kind'], number>> = { box: 1, sphere: 2, capsule: 3, cylinder: 4, convex: 5 }

export const isPrebuildable = (shape: ShapeDesc): shape is Prebuildable => shape.kind in CODE

/** The numbers a shape of the kind is made from, all of them: two shapes with the same kind and these same bits are the same shape. */
const valuesOf = (shape: Prebuildable): ArrayLike<number> => {
  switch (shape.kind) {
    case 'box':
      return shape.half
    case 'sphere':
      return [shape.radius]
    case 'capsule':
    case 'cylinder':
      return [shape.halfHeight, shape.radius]
    case 'convex':
      return shape.points
  }
}

interface Ready {
  readonly owner: string
  readonly hash: number
  readonly code: number
  readonly values: readonly number[]
  readonly shape: JoltNS.Shape
}

/**
 * Shapes made ahead of the compounds that will use them (`PhysicsWorld.prebuildShapes`), by the exact bits of what they are made from (never a near match). Each is taken once:
 * the compound that takes it is its only holder, so a child's tag (the shape's own user data) is set on it when it is taken. What no compound took goes on `release` of its owner
 * or on `dispose`. Holds at most `limit` shapes.
 */
export class ReadyShapes {
  private readonly byHash = new Map<number, Ready[]>()
  private readonly byOwner = new Map<string, Set<Ready>>()
  private count = 0
  /** Shapes made ahead, taken by a compound, and prebuildable children a compound made itself while any were held: what a test or a probe reads. */
  made = 0
  taken = 0
  builtAtAssembly = 0

  constructor(private readonly limit = MAX_READY) {}

  /** One shape made with `make` for each prebuildable of `shapes`, while under the limit; returns how many. */
  add(owner: string, shapes: readonly ShapeDesc[], make: (shape: Prebuildable) => JoltNS.Shape): number {
    let added = 0
    for (const shape of shapes) {
      if (this.count >= this.limit) break
      if (!isPrebuildable(shape)) continue
      const code = CODE[shape.kind]
      const values = Array.from(valuesOf(shape))
      const ready: Ready = { owner, hash: hashOf(values, code), code, values, shape: make(shape) }
      const list = this.byHash.get(ready.hash)
      if (list) list.push(ready)
      else this.byHash.set(ready.hash, [ready])
      let mine = this.byOwner.get(owner)
      if (!mine) this.byOwner.set(owner, (mine = new Set()))
      mine.add(ready)
      this.count++
      added++
    }
    this.made += added
    return added
  }

  /** A shape made ahead with the very numbers of `shape`, handed over with its one reference (the caller releases it), or undefined. */
  take(shape: ShapeDesc): JoltNS.Shape | undefined {
    if (!isPrebuildable(shape)) return undefined
    const list = this.count > 0 ? this.listOf(shape) : undefined
    if (list) {
      const code = CODE[shape.kind]
      const values = valuesOf(shape)
      for (let i = list.length - 1; i >= 0; i--) {
        const ready = list[i]!
        if (ready.code !== code || !sameBits(ready.values, values)) continue
        list.splice(i, 1)
        if (list.length === 0) this.byHash.delete(ready.hash)
        this.byOwner.get(ready.owner)?.delete(ready)
        this.count--
        this.taken++
        return ready.shape
      }
    }
    this.builtAtAssembly++
    return undefined
  }

  private listOf(shape: Prebuildable): Ready[] | undefined {
    return this.byHash.get(hashOf(valuesOf(shape), CODE[shape.kind]))
  }

  /** Lets go of what `owner` had made and no compound took. */
  release(owner: string): void {
    const mine = this.byOwner.get(owner)
    if (!mine) return
    this.byOwner.delete(owner)
    const hashes = new Set<number>()
    for (const ready of mine) {
      hashes.add(ready.hash)
      ready.shape.Release()
    }
    for (const hash of hashes) {
      const left = (this.byHash.get(hash) ?? []).filter((ready) => !mine.has(ready))
      if (left.length > 0) this.byHash.set(hash, left)
      else this.byHash.delete(hash)
    }
    this.count -= mine.size
  }

  /** How many it holds (made ahead and not taken). */
  get size(): number {
    return this.count
  }

  dispose(): void {
    for (const owner of [...this.byOwner.keys()]) this.release(owner)
  }
}
