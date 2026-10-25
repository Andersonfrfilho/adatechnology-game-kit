import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildModels, teamModelIds } from '../src/build-models'
import type { ItemRecord } from '../src/build-items'
import { MODELS_OUTPUT_PATH, outputPath } from '../src/paths'
import { loadSources } from '../src/sources'

describe('models.json of game-items-three', () => {
  const sources = loadSources()
  const models = buildModels(sources)
  const items = JSON.parse(readFileSync(outputPath('items'), 'utf8')) as ItemRecord[]

  const showcase = models.slice(0, teamModelIds().length)
  const kit = models.slice(showcase.length)

  it('starts with the 24 models of the page, in the order of its MODELS, each with the box and scale of decisions.json', () => {
    expect(showcase.map((model) => model.teamId)).toEqual(teamModelIds())
    expect(showcase).toHaveLength(24)
    for (const model of showcase) {
      const reference = sources.decisions.dimensions[model.id]?.modelScaleRef
      expect(reference, model.id).toBeDefined()
      expect(model.teamBox).toEqual(reference?.teamBox)
      expect(model.scale).toBe(reference?.scale)
    }
  })

  it('continues with the kit models of decisions.json.kitModels, in its order, each an item of the catalog', () => {
    expect(kit.map((model) => model.id)).toEqual(Object.keys(sources.decisions.kitModels))
    for (const model of kit) {
      expect(items.some((item) => item.id === model.id), model.id).toBe(true)
      expect(sources.decisions.dimensions[model.id]?.modelScaleRef, model.id).toBeUndefined()
    }
  })

  it('is the file on disk', () => {
    expect(JSON.parse(readFileSync(MODELS_OUTPUT_PATH, 'utf8'))).toEqual(models)
  })

  it('marks, with `model`, every catalog item that has a model and no other', () => {
    const modeled = items.filter((item) => item.model !== undefined)
    expect(modeled.every((item) => item.model === item.id)).toBe(true)
    // the 24th model, the diary, belongs to the game: its item is in the game slice
    expect(modeled.map((item) => item.id).sort()).toEqual(models.map((model) => model.id).filter((id) => id !== 'survivor_diary').sort())
  })
})
