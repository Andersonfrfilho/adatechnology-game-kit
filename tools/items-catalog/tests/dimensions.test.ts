import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import type { ItemRecord, ProvenanceRecord } from '../src/build-items'
import { finalIdOf, gameIteItems } from '../src/item-ids'
import { outputPath, SOURCE_PATHS } from '../src/paths'
import { loadSources } from '../src/sources'
import type { Sources } from '../src/sources'

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const
const SCALE_ROUNDING = 0.01

let sources: Sources
let items: Map<string, ItemRecord>
let provenance: Record<string, ProvenanceRecord>

beforeAll(() => {
  sources = loadSources()
  items = new Map((JSON.parse(readFileSync(outputPath('items'), 'utf8')) as ItemRecord[]).map((item) => [item.id, item]))
  provenance = JSON.parse(readFileSync(outputPath('provenance'), 'utf8')) as Record<string, ProvenanceRecord>
})

describe('measures of the items', () => {
  it('has one measure per item of the catalog and nothing else but the game-only items that have a model', () => {
    const gameModeled = gameIteItems(sources).map((item) => finalIdOf(item, sources).id)
    const allowed = new Set([...items.keys(), ...gameModeled])
    for (const id of items.keys()) expect(sources.decisions.dimensions[id], id).toBeDefined()
    for (const id of Object.keys(sources.decisions.dimensions)) expect(allowed.has(id), id).toBe(true)
    expect(items.size).toBe(327)
  })

  it('writes the measure of the decision, and says where it comes from', () => {
    for (const item of items.values()) {
      const decision = sources.decisions.dimensions[item.id]
      expect(item.size, item.id).toEqual([...(decision?.value ?? [])])
      expect(provenance[item.id]?.sizeSource, item.id).toBe(decision?.source)
    }
  })

  it('keeps the household value where the source is household', () => {
    for (const [id, decision] of Object.entries(sources.decisions.dimensions)) {
      if (decision.source !== 'household') continue
      expect(sources.household[id], id).toBeDefined()
      expect([...decision.value], id).toEqual([...(sources.household[id]?.size ?? [])])
    }
  })

  it('sizes the 24 modeled items by the box of the team model times one real scale', () => {
    const iteSource = readFileSync(SOURCE_PATHS.ite, 'utf8')
    const modelsText = iteSource.slice(iteSource.indexOf('const MODELS = ['), iteSource.indexOf('const STAGE_TARGET'))
    const teamModelIds = [...modelsText.matchAll(/^\s*\["([a-z0-9_]+)", \(\) =>/gm)].map((match) => match[1])
    expect(teamModelIds.length).toBe(24)
    const modeled = Object.entries(sources.decisions.dimensions).filter(([, decision]) => decision.source === 'model')
    expect(modeled.map(([, decision]) => decision.modelScaleRef?.teamId).sort()).toEqual([...teamModelIds].sort())
    for (const [id, decision] of modeled) {
      const reference = decision.modelScaleRef
      expect(reference, id).toBeDefined()
      if (!reference) continue
      expect(sources.ite.itens.some((item) => item.id === reference.teamId), `${id} team item`).toBe(true)
      const index = AXIS_INDEX[reference.axis]
      expect(decision.value[index], `${id} real measure`).toBeCloseTo(reference.meters, 4)
      decision.value.forEach((side, axis) => {
        const expected = (reference.teamBox[axis] ?? 0) * reference.scale
        expect(Math.abs(side - expected) / expected, `${id} axis ${axis}`).toBeLessThan(SCALE_ROUNDING)
      })
    }
  })
})
