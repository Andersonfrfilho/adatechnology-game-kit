import type { GroundField } from './ground'
import type { RandomStream } from './random'

/** What an explosion leaves on the ground, as data: the renderer builds the meshes (L443-476). */
export interface ScorchMark {
  readonly kind: 'scorch'
  readonly x: number
  readonly z: number
  readonly radius: number
  /** Which of the three scorch textures. */
  readonly variant: number
  readonly lift: number
  readonly rotation: number
}

export interface DirtMark {
  readonly kind: 'dirt'
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly lift: number
  readonly rotation: number
}

/** A piece of broken asphalt on the rim of a crater. */
export interface RockMark {
  readonly kind: 'rock'
  readonly x: number
  readonly y: number
  readonly z: number
  readonly scale: readonly [number, number, number]
  readonly rotation: readonly [number, number, number]
  readonly plate: boolean
  readonly color: number
}

export interface BloodMark {
  readonly kind: 'blood'
  readonly x: number
  readonly y: number
  readonly z: number
  readonly scaleX: number
  readonly scaleZ: number
  readonly rotation: number
}

export type Mark = ScorchMark | DirtMark | RockMark | BloodMark

export type MarkEvent = { readonly type: 'add'; readonly mark: Mark } | { readonly type: 'clear' }

export interface MarkStore {
  readonly entries: Mark[]
  /** Goes up on every mark added or cleared. */
  readonly version: number
  readonly bloodCount: number
  /** The counter that lifts each decal a hair higher than the last (the Lab's `decalY`). */
  lift: number
  add(mark: Mark): void
  clear(): void
  /** Tells a renderer the moment a mark is made (the ground it conforms to is the ground of that moment) or taken away. */
  subscribe(listener: (event: MarkEvent) => void): () => void
}

const BLOOD_LIMIT = 450
const SCORCH_VARIANTS = 3
const RIM_COLORS = [0x2b2c2f, 0x3a3836] as const

export function createMarkStore(): MarkStore {
  const entries: Mark[] = []
  let version = 0
  let bloodCount = 0
  const listeners = new Set<(event: MarkEvent) => void>()
  return {
    entries,
    get version() {
      return version
    },
    get bloodCount() {
      return bloodCount
    },
    lift: 0,
    add(mark) {
      entries.push(mark)
      if (mark.kind === 'blood') bloodCount++
      version++
      for (const listener of listeners) listener({ type: 'add', mark })
    },
    clear() {
      entries.length = 0
      bloodCount = 0
      this.lift = 0
      version++
      for (const listener of listeners) listener({ type: 'clear' })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function nextLift(store: MarkStore): number {
  return store.lift++ % 20
}

/** `scorch` (L458): a burn mark; the texture and the turn are drawn in that order. */
export function addScorch(store: MarkStore, random: RandomStream, x: number, z: number, radius: number): void {
  const variant = Math.floor(random.next() * SCORCH_VARIANTS)
  const lift = 0.03 + nextLift(store) * 0.001
  const rotation = random.next() * 6
  store.add({ kind: 'scorch', x, z, radius, variant, lift, rotation })
}

function addRimRocks(store: MarkStore, ground: GroundField | undefined, random: RandomStream, x: number, z: number, radius: number): void {
  const count = Math.round(6 + radius * 7)
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + random.between(-0.15, 0.15)
    const distance = radius * random.between(0.95, 1.3)
    const size = random.between(0.12, 0.26) * Math.min(1.6, 0.6 + radius * 0.4)
    const px = x + Math.cos(angle) * distance
    const pz = z + Math.sin(angle) * distance
    const plate = random.next() < 0.6
    const color = RIM_COLORS[random.next() < 0.5 ? 0 : 1]
    const tiltX = random.between(-0.5, 0.5)
    const tiltZ = random.between(-0.6, 0.2)
    store.add({
      kind: 'rock',
      x: px,
      y: (ground?.heightAt(px, pz) ?? 0) + size * 0.12,
      z: pz,
      scale: [size * 2, size * 0.35, size * 1.4],
      rotation: [tiltX, angle, tiltZ],
      plate,
      color,
    })
  }
}

/** `crater` (L460-468): digs the ground (always), then, when marks are on, lays the dirt, and broken asphalt around the rim. */
export function addCrater(store: MarkStore, ground: GroundField | undefined, random: RandomStream, spec: { x: number; z: number; radius: number; depth: number; marks: boolean }): void {
  ground?.dent(random, spec.x, spec.z, spec.radius, spec.depth)
  if (!spec.marks) return
  const rotation = random.next() * 6
  store.add({ kind: 'dirt', x: spec.x, z: spec.z, radius: spec.radius * 1.02, lift: 0.045, rotation })
  addRimRocks(store, ground, random, spec.x, spec.z, spec.radius)
}

/** `bloodSplat` (L471-475). */
export function addBloodSplat(store: MarkStore, ground: GroundField | undefined, random: RandomStream, spec: { x: number; z: number; radius: number }): void {
  if (store.bloodCount > BLOOD_LIMIT) return
  const y = (ground?.heightAt(spec.x, spec.z) ?? 0) + 0.03 + nextLift(store) * 0.0008
  const scaleX = spec.radius * random.between(1.6, 2.4)
  const scaleZ = spec.radius * random.between(1.2, 2)
  store.add({ kind: 'blood', x: spec.x, y, z: spec.z, scaleX, scaleZ, rotation: random.next() * 6 })
}
