import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createBestBuilder } from '@adatechnology/game-characters-three'
import type { BakeBuilders } from '@adatechnology/game-characters-three'
import { createCrowd } from '@adatechnology/game-crowd'
import type { Crowd, CrowdPack } from '@adatechnology/game-crowd'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { appearanceSignature, createCrowdInstances, createCrowdRenderer } from '../src'
import type { CrowdInstance } from '../src'

/** The variety test of the horde (T4b.9, A16): 2000 agents, seed 7, a square of 60 by 60 m, personality on. */
const COUNT = 2000
const SIDE = 60
const SEED = 7
const NEIGHBOURS = 8
const NEAR_PAIR = 3
const MAX_SHARED = 0.01
const MIN_PHASE_SPREAD = 0.25
const MIN_AGENTS_SPREAD = 0.99
const MIN_CADENCE_VARIATION = 0.05
const CALL_CEILING = 95

const pack = undeadCrowdPack() as unknown as CrowdPack
const eyes = pack.types.map((type) => type.eye ?? null)
const sizes = Array.from({ length: 64 }, () => ({ s: 1.7, bulk: 1 }))
const frame = { camera: { x: 0, z: 0 }, viewYaw: 0, target: null }

const horde = (seed: number): Crowd => {
  const crowd = createCrowd({ pack, seed, capacity: COUNT + 8, physics: { personality: true } })
  const place = createRandom(seed + 100)
  for (let k = 0; k < COUNT; k++) crowd.spawn((place() - 0.5) * SIDE, -place() * SIDE - 2, -1)
  return crowd
}
/** A small counter-free stream so the test places agents without touching the crowd's own. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const instancesOf = (crowd: Crowd, options: Parameters<typeof createCrowdInstances>[0] = { eyes, variety: { impostorFrom: 90 } }): { index: number; level: number; instance: CrowdInstance; variant: number }[] => {
  const out: { index: number; level: number; instance: CrowdInstance; variant: number }[] = []
  let index = 0
  createCrowdInstances(options).agents(crowd.store, sizes, frame, (variant, level, instance) => out.push({ index: index++, level, instance, variant }))
  return out
}
const signaturesOf = (crowd: Crowd, rows = instancesOf(crowd)): number[] => rows.map(({ instance, variant }) => appearanceSignature(instance.type!, variant, instance, sizes[variant]!))

const phaseSpread = (crowd: Crowd): { readonly share: number; readonly cadenceVariation: number } => {
  const Z = crowd.store
  const cells = new Map<string, number[]>()
  const cell = (x: number, z: number): string => `${Math.floor(x / 6)},${Math.floor(z / 6)}`
  for (let i = 0; i < Z.n; i++) {
    const key = cell(Z.x[i]!, Z.z[i]!)
    cells.set(key, [...(cells.get(key) ?? []), i])
  }
  let spread = 0
  let variation = 0
  for (let i = 0; i < Z.n; i++) {
    const cx = Math.floor(Z.x[i]! / 6)
    const cz = Math.floor(Z.z[i]! / 6)
    const near: { d: number; j: number }[] = []
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const j of cells.get(`${cx + dx},${cz + dz}`) ?? []) if (j !== i) near.push({ d: Math.hypot(Z.x[j]! - Z.x[i]!, Z.z[j]! - Z.z[i]!), j })
    near.sort((a, b) => a.d - b.d)
    const group = [i, ...near.slice(0, NEIGHBOURS).map((n) => n.j)]
    let c = 0
    let s = 0
    for (const j of group) {
      const angle = 2 * Math.PI * (Z.phase[j]! - Math.floor(Z.phase[j]!))
      c += Math.cos(angle)
      s += Math.sin(angle)
    }
    if (1 - Math.hypot(c, s) / group.length >= MIN_PHASE_SPREAD) spread++
    const cadence = group.map((j) => Z.cadenceFactor[j]!)
    const mean = cadence.reduce((sum, value) => sum + value, 0) / cadence.length
    variation += Math.sqrt(cadence.reduce((sum, value) => sum + (value - mean) ** 2, 0) / cadence.length) / mean
  }
  return { share: spread / Z.n, cadenceVariation: variation / Z.n }
}

describe('the variety of a horde of 2000 (T4b.9)', () => {
  let crowd: Crowd
  beforeAll(() => {
    crowd = horde(SEED)
  })

  it('at most 1% of the pairs within 3 m share the whole look', () => {
    const rows = instancesOf(crowd)
    expect(rows).toHaveLength(COUNT)
    const signatures = signaturesOf(crowd, rows)
    const Z = crowd.store
    const grid = new Map<string, number[]>()
    rows.forEach((_, k) => {
      const key = `${Math.floor(Z.x[k]! / NEAR_PAIR)},${Math.floor(Z.z[k]! / NEAR_PAIR)}`
      grid.set(key, [...(grid.get(key) ?? []), k])
    })
    let pairs = 0
    let same = 0
    for (let k = 0; k < COUNT; k++) {
      const cx = Math.floor(Z.x[k]! / NEAR_PAIR)
      const cz = Math.floor(Z.z[k]! / NEAR_PAIR)
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
            if (j <= k || Math.hypot(Z.x[j]! - Z.x[k]!, Z.z[j]! - Z.z[k]!) > NEAR_PAIR) continue
            pairs++
            if (signatures[j] === signatures[k]) same++
          }
    }
    expect(pairs).toBeGreaterThan(10000)
    expect(same / pairs, `${same} of ${pairs} pairs`).toBeLessThanOrEqual(MAX_SHARED)
  })

  it('the animation phase of the 8 nearest neighbours is spread (1 - R of the phases at least 0.25) for 99% of the agents, now and 600 steps on', () => {
    const start = phaseSpread(crowd)
    expect(start.share, 'step 0').toBeGreaterThanOrEqual(MIN_AGENTS_SPREAD)
    expect(start.cadenceVariation).toBeGreaterThanOrEqual(MIN_CADENCE_VARIATION)
    const later = horde(SEED)
    for (let step = 0; step < 600; step++) later.update(1 / 30, { viewYaw: 0, nightFactor: 0 })
    expect(phaseSpread(later).share, 'step 600').toBeGreaterThanOrEqual(MIN_AGENTS_SPREAD)
  }, 120000)

  it('the signature is the same at every level of detail, the impostor included', () => {
    const forced = (edges: readonly [number, number], impostorFrom: number) => instancesOf(crowd, { eyes, numbers: { lodDistances: edges as never }, variety: { impostorFrom } })
    const levels = [forced([-1000, 1e9], 1e9 + 1), forced([-1000, -900], 1e9), forced([-1000, -900], -800)]
    const near = instancesOf(crowd, { eyes, numbers: { lodDistances: [1e9, 1e9 + 1] as never }, variety: { impostorFrom: 1e9 + 2 } })
    const all = [near, ...levels]
    expect(all.map((rows) => new Set(rows.map((row) => row.level)))).toEqual([new Set([0]), new Set([1]), new Set([2]), new Set([3])].map((set, index) => (index === 3 ? new Set([2, 3]) : set)))
    expect(levels[2]!.filter((row) => row.level === 3).length).toBeGreaterThan(COUNT * 0.5) // the walking ones go to the impostor, the rest keep the far mesh
    const pick = createRandom(11)
    for (let k = 0; k < 200; k++) {
      const index = Math.floor(pick() * COUNT)
      const reference = near[index]!
      for (const rows of levels) {
        const row = rows[index]!
        expect(row.instance.d).toEqual(reference.instance.d)
        expect(row.instance.c[0]).toBe(reference.instance.c[0])
        expect(row.instance.color).toBe(reference.instance.color)
        expect(row.instance.b[0]).toBe(reference.instance.b[0])
        expect(appearanceSignature(row.instance.type!, row.variant, row.instance, sizes[row.variant]!)).toBe(appearanceSignature(reference.instance.type!, reference.variant, reference.instance, sizes[reference.variant]!))
      }
    }
  })

  it('the same seed gives the same horde, another seed another one', () => {
    const first = signaturesOf(crowd)
    expect(signaturesOf(horde(SEED))).toEqual(first)
    const other = signaturesOf(horde(SEED + 1))
    const equal = first.filter((value, index) => other[index] === value).length
    expect(equal / COUNT).toBeLessThan(0.05)
  })
})

describe('the draw calls of a horde of 2000 with every variety option (design ceiling 95)', () => {
  const builders = (): BakeBuilders => {
    const best = createBestBuilder(THREE, { types: UNDEAD_TYPES.map((card) => ({ name: card.name['pt-BR'] ?? card.id, eye: Number.parseInt(card.eye.color, 16) })), random: () => 0.5 })
    return {
      buildBest: (spec, lod) => {
        best.setLOD(lod)
        return best.build(spec) as THREE.Object3D
      },
      topMaterial: () => best.topM() as THREE.Material | null,
    }
  }
  const names = new Map(UNDEAD_TYPES.map((card) => [card.id, card.name['pt-BR'] ?? card.id]))

  it('counts the main pass and the shadow pass of the batches with something to draw', () => {
    const crowd = horde(SEED)
    // a horde spread from 4 to 200 m so every level of detail and the impostor are in use
    const Z = crowd.store
    for (let i = 0; i < Z.n; i++) Z.z[i] = -4 - (i / Z.n) * 190
    const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id, variety: { segmentClips: true } })
    renderer.update(1 / 30, frame)
    const drawn = (renderer.group.children as unknown as { count: number; castShadow: boolean }[]).filter((mesh) => mesh.count > 0)
    const mainPass = drawn.length
    const shadowPass = drawn.filter((mesh) => mesh.castShadow).length
    expect(renderer.lodCounts[0]).toBeGreaterThan(0)
    expect(renderer.lodCounts[1]).toBeGreaterThan(0)
    expect(renderer.impostorCount).toBeGreaterThan(100)
    expect(mainPass + shadowPass, `${mainPass} main + ${shadowPass} shadow`).toBeLessThanOrEqual(CALL_CEILING)
    console.log(`T4b.9 draw calls: ${mainPass} main + ${shadowPass} shadow = ${mainPass + shadowPass} (ceiling ${CALL_CEILING}); lod ${renderer.lodCounts.join('/')} impostors ${renderer.impostorCount}`)
    renderer.dispose()
  }, 120000)
})
