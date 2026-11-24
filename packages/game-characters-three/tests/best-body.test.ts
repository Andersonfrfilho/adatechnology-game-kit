import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { installPortableMath, snapshotScene } from '@adatechnology/golden-tool'

import { defaultHeightMetres } from '@adatechnology/game-characters'

import { RICH_PORT_SKULL_TOP_METRES, bakeBody, createBestBuilder } from '../src'
import type { BakeBuilders } from '../src'
import { fnvOfArray } from './helpers'
import golden from './fixtures/team-golden/game-best-body.json'
import undeadTypes from '../../game-characters-undead/src/data/types.json'

// Recorded from the game's BEST.build / bakeBody (three r160, the version of the SDK) by tools/characters-catalog: 13 types x decay 0..3 x seeds 1..5 x
// LOD {1, .5, .28}, and the 60 bakes of the ZVAR variants. The port has to hash the same scene node by node.
const cards = undeadTypes.map((type) => ({ name: type.name['pt-BR'], eye: Number.parseInt(type.eye.color, 16) }))
const names = new Map(undeadTypes.map((type, index) => [type.id, { name: type.name['pt-BR'], index }]))

const createBuilder = () => createBestBuilder(THREE, { types: cards, random: () => 0.5 })

type Scene = { objects: number; hash: string }
type BakeEvent = { type: string; data: { type: string; variant: number; decay: number; seed: number; lod: number; vertices: number; scale: number; bulk: number; indices: number; index: string } & Record<string, number | string> }

// Owner decision (2026-11-12, CLAUDE.md §13): the bloated body's legs overlapped at the hips and its neck sat flush with the head, and flickered; one leg
// sits 3 mm lower and the neck is 4 mm taller, so the bloater no longer hashes like the page. Its node and vertex counts are still checked.
// Owner decision (2026-11-19, Spec 012 D3): Bestiário root scale is normalised by `defaultHeightMetres(type) / RICH_PORT_SKULL_TOP_METRES` so every type
// measures its declared height in metres (±1 cm); scene node counts, vertex counts, indices, bulk and non-position attributes stay identical to the page.
const Z_FIGHTING_FIXES: ReadonlySet<string> = new Set(['bloater'])

describe('G-body: the Bestiário v17 builder', () => {
  const restore = installPortableMath()
  const best = createBuilder()
  const scenes = golden.scenes as unknown as Record<string, Scene>

  it('builds the 780 recorded scenes with the same node count (Spec 012 D3 height-normalised)', () => {
    const mismatches: string[] = []
    let checked = 0
    for (const [label, expected] of Object.entries(scenes)) {
      const [, id, decayPart, seedPart, lodPart] = /^best_(\w+)_d(\d)_s(\d)_l([\d.]+)$/.exec(label)!
      best.setLOD(Number(lodPart))
      const root = best.build({ type: names.get(id!)!.name, decay: Number(decayPart), seed: Number(seedPart) })
      const snapshot = snapshotScene(root)
      checked++
      if (snapshot.objects !== expected.objects) mismatches.push(`${label}: ${expected.objects} -> ${snapshot.objects}`)
    }
    restore()
    expect(checked).toBe(780)
    expect(mismatches.slice(0, 10)).toEqual([])
  })
})

describe('G-body: bakeBody of the ZVAR variants', () => {
  const best = createBuilder()
  const builders: BakeBuilders = {
    buildBest: (spec, lod) => {
      best.setLOD(lod)
      return best.build(spec)
    },
    topMaterial: () => best.topM(),
  }
  const events = (golden.events as unknown as BakeEvent[]).filter((event) => event.type === 'bake')

  it('bakes the 60 recorded variants with the same topology, bulk, normal/vcol/bone hashes and normalised scale', () => {
    expect(events).toHaveLength(60)
    const mismatches: string[] = []
    for (const { data } of events) {
      const typeName = names.get(data.type)!.name
      const baked = bakeBody(THREE, builders, { type: typeName, decay: data.decay, seed: data.seed }, data.lod)
      const actual = { vertices: baked.verts, bulk: baked.bulk, indices: baked.geo.index!.count, index: fnvOfArray(baked.geo.index!.array) } as Record<string, number | string>
      for (const name of ['normal', 'vcol', 'bone']) actual[name] = fnvOfArray(baked.geo.attributes[name]!.array)
      const kept = Z_FIGHTING_FIXES.has(data.type) ? ['vertices', 'indices', 'index'] : Object.keys(actual)
      for (const key of kept) if (actual[key] !== data[key]) mismatches.push(`${data.type} v${data.variant} lod ${data.lod}: ${key} ${data[key]} -> ${actual[key]}`)
      const expectedScale = defaultHeightMetres(typeName) / RICH_PORT_SKULL_TOP_METRES
      if (Math.abs(baked.s - expectedScale) > 1e-6) mismatches.push(`${data.type} v${data.variant} lod ${data.lod}: scale ${expectedScale} -> ${baked.s}`)
    }
    expect(mismatches.slice(0, 10)).toEqual([])
  })
})
