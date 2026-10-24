import { encodePoseHeight } from '@adatechnology/game-characters'
import type { BakeBuilders } from '../instanced/bake'
import { LOD_DISTANCES, lodAt } from '../instanced/lod'
import { bakeVariants, createVariantBatches } from '../instanced/variants'
import type { BodyVariant, VariantType } from '../instanced/variants'
import type { BodyBatch } from '../instanced/body-batch'
import type { Three, THREE_NS } from '../three'

type Member = { variant: number; x: number; z: number; yaw: number; phase: number; speed: number }

const FIELD = { x0: 12, x1: 30, z0: -16, z1: 16 }
const STRIDE = 1

/** A crowd on the instanced path: variants baked on demand from the rich builder, one batch per variant and level of detail, members walking a field. */
export type Crowd = {
  readonly group: THREE_NS.Group
  spawn(count: number): void
  clear(): void
  update(dt: number, camera: THREE_NS.Camera): void
  readonly count: number
  readonly bakeMs: number
  readonly drawCalls: number
  readonly triangles: number
  /** Triangles of one body at each level of detail (the budget the benchmark checks). */
  trianglesPerLevel(typeId: string): readonly number[]
}

export const createCrowd = (three: Three, builders: BakeBuilders, types: readonly VariantType[], eyes: Readonly<Record<string, number>>, random: () => number): Crowd => {
  const group = new three.Group()
  const time = { value: 0 }
  let variants: BodyVariant[] = []
  let byType: ReadonlyMap<string, readonly number[]> = new Map()
  let batches: (readonly BodyBatch[])[] = []
  let members: Member[] = []
  let bakeMs = 0
  const ensure = (): void => {
    if (variants.length > 0) return
    const started = typeof performance === 'undefined' ? Date.now() : performance.now()
    const baked = bakeVariants(three, builders, types)
    bakeMs = (typeof performance === 'undefined' ? Date.now() : performance.now()) - started
    variants = baked.variants
    byType = baked.byType
    batches = variants.map((variant) => createVariantBatches(three, variant, time))
    for (const set of batches) for (const batch of set) group.add(batch.mesh)
  }
  const color = (hex: number) => new three.Color(hex)
  return {
    group,
    spawn(count) {
      ensure()
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(random() * types.length)] as VariantType
        const pool = byType.get(type.id) as readonly number[]
        members.push({ variant: pool[Math.floor(random() * pool.length)] as number, x: FIELD.x0 + random() * (FIELD.x1 - FIELD.x0), z: FIELD.z0 + random() * (FIELD.z1 - FIELD.z0), yaw: random() * Math.PI * 2, phase: random(), speed: 0.6 + random() * 0.8 })
      }
    },
    clear() {
      members = []
      for (const set of batches) for (const batch of set) { batch.begin(); batch.end() }
    },
    update(dt, camera) {
      time.value += dt
      if (variants.length === 0) return
      for (const set of batches) for (const batch of set) batch.begin()
      const pose = encodePoseHeight('walk', 0)
      for (const member of members) {
        member.x += Math.sin(member.yaw) * member.speed * dt
        member.z += Math.cos(member.yaw) * member.speed * dt
        if (member.x < FIELD.x0 || member.x > FIELD.x1) member.yaw = -member.yaw
        if (member.z < FIELD.z0 || member.z > FIELD.z1) member.yaw = Math.PI - member.yaw
        const variant = variants[member.variant] as BodyVariant
        const distance = Math.hypot(member.x - camera.position.x, member.z - camera.position.z)
        const level = lodAt(distance, LOD_DISTANCES)
        const eye = color(eyes[variant.typeId] ?? 0xe3c341)
        ;(batches[member.variant] as readonly BodyBatch[])[level]?.push({ a: [member.x, member.z, member.yaw, member.phase], b: [variant.s, variant.bulk, STRIDE, pose], c: [0, 0.4, 1, member.phase], color: { r: 0.4, g: 0.45, b: 0.5 }, eye })
      }
      for (const set of batches) for (const batch of set) batch.end()
    },
    get count() {
      return members.length
    },
    get bakeMs() {
      return bakeMs
    },
    get drawCalls() {
      return batches.reduce((sum, set) => sum + set.filter((batch) => batch.count > 0).length, 0)
    },
    get triangles() {
      return batches.reduce((sum, set, index) => sum + set.reduce((inner, batch, level) => inner + batch.count * ((variants[index]?.verts[level] ?? 0) / 3), 0), 0)
    },
    trianglesPerLevel(typeId) {
      const first = byType.get(typeId)?.[0]
      return first === undefined ? [] : (variants[first] as BodyVariant).verts.map((verts) => verts / 3)
    },
  }
}

