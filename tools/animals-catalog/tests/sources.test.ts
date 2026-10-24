import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadDecisions } from '../src/decisions'
import { extractAnimals } from '../src/extract-animals'
import { GAME_SLICE_DIR, OUTPUT_PATHS } from '../src/paths'

type SpeciesRow = {
  readonly id: string
  readonly order: number
  readonly name: { readonly 'pt-BR': string }
  readonly outcome: string
  readonly body: { readonly kind: string }
  readonly walkHz: number
  readonly runHz: number
  readonly soundRangeMetres?: number
  readonly outbreak?: { readonly turnMinutes?: { readonly min: number; readonly max: number }; readonly deathHours?: { readonly min: number; readonly max: number } }
}

const data = extractAnimals()
const decisions = loadDecisions()
const species = JSON.parse(readFileSync(OUTPUT_PATHS.species, 'utf8')) as SpeciesRow[]
const gaits = JSON.parse(readFileSync(OUTPUT_PATHS.gaits, 'utf8')) as Record<string, number[]>
const byId = Object.fromEntries(species.map((row) => [row.id, row]))

describe('Bichos do Vale', () => {
  it('has the 13 species in the production order of the page, with English ids and a body spec for each', () => {
    expect(data.species).toHaveLength(13)
    expect(data.order).toHaveLength(13)
    expect(Object.keys(data.specs).sort()).toEqual(data.species.map((entry) => entry.id).sort())
    expect(species.map((row) => row.id)).toEqual(['cow', 'horse', 'pig', 'wild_boar', 'capybara', 'jaguar', 'dog', 'cat', 'chicken', 'southern_lapwing', 'vulture', 'lancehead', 'rat'])
    expect(species.map((row) => row.order)).toEqual([...Array(13).keys()])
  })

  it('keeps the body kind and the step frequencies of every SPEC', () => {
    for (const row of species) {
      const spec = data.specs[Object.entries(decisions.speciesIds.value).find(([, id]) => id === row.id)?.[0] ?? '']
      expect(row.walkHz, row.id).toBe(spec?.walkHz)
      expect(row.runHz, row.id).toBe(spec?.runHz)
      expect(row.body.kind, row.id).toBe(spec?.snake ? 'snake' : spec?.b ? 'bird' : 'quadruped')
    }
    expect(species.filter((row) => row.body.kind === 'quadruped')).toHaveLength(9)
    expect(species.filter((row) => row.body.kind === 'bird')).toHaveLength(3)
    expect(species.filter((row) => row.body.kind === 'snake')).toHaveLength(1)
  })

  it('has the infection rule of the page: six turn, three die, four are immune', () => {
    const outcomes = (kind: string): string[] => species.filter((row) => row.outcome === kind).map((row) => row.id).sort()
    expect(outcomes('turns')).toEqual(['cat', 'dog', 'jaguar', 'pig', 'rat', 'wild_boar'])
    expect(outcomes('dies')).toEqual(['capybara', 'cow', 'horse'])
    expect(outcomes('immune')).toEqual(['chicken', 'lancehead', 'southern_lapwing', 'vulture'])
    const pageText = `${data.visibleText} ${data.species.map((entry) => entry.cuidado).join(' ')}`
    for (const snippet of decisions.outbreak.value.evidence) expect(pageText, snippet).toContain(snippet)
    expect(byId.rat?.outbreak?.turnMinutes).toEqual({ min: 2, max: 2 })
    expect(byId.jaguar?.outbreak?.turnMinutes).toEqual({ min: 60, max: 60 })
    expect(byId.dog?.outbreak?.turnMinutes).toEqual({ min: 10, max: 30 })
    expect(byId.cow?.outbreak?.deathHours).toEqual({ min: 2, max: 6 })
  })

  it('has the sound ranges the species text states', () => {
    const textOf = (id: string): string => data.species.find((entry) => decisions.speciesIds.value[entry.id] === id)?.som ?? ''
    for (const [id, range] of Object.entries(decisions.soundRanges.value)) {
      expect(textOf(id), id).toContain(range.evidence)
      expect(byId[id]?.soundRangeMetres, id).toBe(range.metres)
    }
    expect(species.filter((row) => row.soundRangeMetres !== undefined)).toHaveLength(Object.keys(decisions.soundRanges.value).length)
  })

  it('has the three gait phase tables of the page (radians): walk, trot and gallop', () => {
    expect(Object.keys(gaits)).toEqual(['walk', 'trot', 'gallop'])
    expect(gaits.walk?.map((phase) => Number((phase / Math.PI).toFixed(4)))).toEqual([0.5, 1.5, 0, 1])
    expect(gaits.trot?.map((phase) => Number((phase / Math.PI).toFixed(4)))).toEqual([0, 1, 1, 0])
    expect(gaits.gallop?.map((phase) => Number((phase / Math.PI).toFixed(4)))).toEqual([0.92, 1.18, 0, 0.28])
  })

  it('keeps the valley out of the SDK data: texts and places are only in the game slice', () => {
    const sdk = readFileSync(OUTPUT_PATHS.species, 'utf8')
    for (const row of data.species) {
      for (const text of [row.onde, row.papel, row.cuidado, row.rende]) expect(sdk).not.toContain(text)
    }
    const texts = JSON.parse(readFileSync(join(GAME_SLICE_DIR, 'species-texts.json'), 'utf8')) as Record<string, { where: string }>
    expect(Object.keys(texts)).toHaveLength(13)
    expect(JSON.stringify(data.zones)).toContain('Santa Aurora')
  })
})
