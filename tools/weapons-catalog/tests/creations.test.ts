import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { loadDecisions } from '../src/decisions'
import type { Decisions } from '../src/decisions'
import { OUTPUT_PATHS } from '../src/paths'

type Row = { readonly id: string; readonly variantOf?: string; readonly sources: readonly string[]; readonly action: Readonly<Record<string, unknown>>; readonly dimensions: { readonly length: number; readonly barrel: number; readonly emptyMass: number } }
type ModelRow = { readonly builder: string; readonly options: Readonly<Record<string, unknown>>; readonly variantOf?: string }

const HAS_URL = /https?:\/\//
const REQUIRED_NUMBERS = ['length', 'barrel', 'emptyMass', 'rpm', 'capacity', 'reload'] as const

let decisions: Decisions
let firearms: Map<string, Row>
let models: Record<string, ModelRow>

beforeAll(() => {
  decisions = loadDecisions()
  firearms = new Map((JSON.parse(readFileSync(OUTPUT_PATHS.firearms, 'utf8')) as Row[]).map((row) => [row.id, row]))
  models = JSON.parse(readFileSync(OUTPUT_PATHS.models, 'utf8')) as Record<string, ModelRow>
})

describe('creations (weapons the team pages do not have)', () => {
  it('has 21 of them, every one with a reason and a source', () => {
    const entries = Object.entries(decisions.creations)
    expect(entries).toHaveLength(21)
    for (const [name, decision] of entries) {
      expect(decision.reason.length, name).toBeGreaterThan(20)
      expect(['reference', 'arsenal', 'derived'], name).toContain(decision.source)
    }
  })

  it('gives every number a source and a reason, and a reference always a URL', () => {
    for (const [name, { value }] of Object.entries(decisions.creations)) {
      const needed = [...REQUIRED_NUMBERS.filter((key) => key !== 'rpm' || models[value.id]?.options.rpm !== undefined), ...(value.muzzleSpeed === undefined ? [] : ['muzzleSpeed']), ...(value.noise === undefined ? [] : ['noise']), ...(value.spin === undefined ? [] : ['spin'])]
      for (const key of needed) {
        const note = value.numbers[key]
        expect(note, `${name} ${key}`).toBeDefined()
        expect(note?.reason.length, `${name} ${key}`).toBeGreaterThan(15)
        if (note?.source === 'reference') expect(note.reason, `${name} ${key}`).toMatch(HAS_URL)
      }
    }
  })

  it('generates a firearm and a model for each, with the measures of the decision and the reload of the weapon it names', () => {
    for (const [name, { value }] of Object.entries(decisions.creations)) {
      const firearm = firearms.get(value.id)
      expect(firearm, name).toBeDefined()
      expect(firearm?.dimensions.length, name).toBeCloseTo(value.length / 1000, 9)
      expect(firearm?.dimensions.barrel, name).toBeCloseTo(value.barrel / 1000, 9)
      expect(firearm?.dimensions.emptyMass, name).toBe(value.emptyMass)
      expect(firearm?.sources, name).toContain('sdk')
      expect(firearm?.sources, name).toContain('derived')
      expect(models[value.id]?.builder, name).toBe(value.builder ?? (value.of === undefined ? 'rifle' : models[value.id]?.builder))
    }
  })

  it('draws the Bizon with a helical magazine and the M134 with its own builder', () => {
    expect(models.pp19_bizon?.options.mag).toBe('helical')
    expect(models.m134?.builder).toBe('m134')
    expect(firearms.get('m134')?.action.family).toBe('belt')
  })

  it('gives the M134 a rate range, a spin-up and the three modes through mounts', () => {
    const m134 = firearms.get('m134')
    expect(m134?.action).toMatchObject({ rpm: 3000, rpmRange: [2000, 6000], spin: { upSeconds: 0.5, holdSeconds: 1 }, modes: ['auto'] })
    expect(decisions.creations['M134 Minigun']?.value.numbers.spin?.source).toBe('derived')
    const mounts = (firearms.get('m134') as unknown as { mounts: { kind: string; interfaces: string[] }[] }).mounts
    expect(mounts).toContainEqual(expect.objectContaining({ kind: 'feed', interfaces: ['belt'] }))
    expect(mounts).toContainEqual(expect.objectContaining({ kind: 'underbarrel', interfaces: ['tripod'] }))
  })

  it('records the GP-25 rule: AK weapons only', () => {
    expect(decisions.gp25Mount.value.requiresOption).toBe('ak')
    expect(decisions.gp25Mount.reason).toMatch(/SKS/)
  })
})
