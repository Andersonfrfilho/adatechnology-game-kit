import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import type { ItemRecord } from '../src/build-items'
import { DENSITY_MATERIALS } from '../src/decisions'
import type { DensityMaterial } from '../src/decisions'
import { outputPath } from '../src/paths'
import { loadSources } from '../src/sources'
import type { Sources } from '../src/sources'

/** Kilograms per litre of the bounding box, by material. The boxes are wide on purpose (a hammer is mostly air around its handle): the test catches a slipped decimal, not a rounding. */
const DENSITY_RANGE: Readonly<Record<DensityMaterial, readonly [number, number]>> = {
  liquid: [0.3, 1.4],
  food: [0.1, 1.3],
  paper: [0.03, 1],
  cloth: [0.03, 0.6],
  wood: [0.15, 0.95],
  metal_solid: [1, 8.5],
  metal_tool: [0.1, 5],
  long: [0.02, 1.3],
  stone: [1, 3],
  glass: [0.2, 2.6],
  plastic: [0.05, 1.3],
  electronic: [0.1, 2.5],
  battery: [1, 4],
  hollow: [0.004, 0.3],
}

const LITRES_PER_CUBIC_METRE = 1000
const MAX_SIDE_METRES = 2

let sources: Sources
let items: ItemRecord[]

beforeAll(() => {
  sources = loadSources()
  items = JSON.parse(readFileSync(outputPath('items'), 'utf8')) as ItemRecord[]
})

const litres = ([width, height, depth]: readonly [number, number, number]): number => width * height * depth * LITRES_PER_CUBIC_METRE

describe('density of the measures', () => {
  it('gives every item a material the test knows, and keeps the kg per litre of its box inside the range of that material', () => {
    const outside: string[] = []
    for (const item of items) {
      const decision = sources.decisions.dimensions[item.id]
      expect(decision, `${item.id} has a measure`).toBeDefined()
      const material = decision?.material ?? 'hollow'
      expect(DENSITY_MATERIALS.includes(material), `${item.id} material ${material}`).toBe(true)
      const [low, high] = DENSITY_RANGE[material]
      const density = item.weight / litres(item.size)
      if (density < low || density > high) outside.push(`${item.id} ${material} ${item.weight} kg in ${litres(item.size).toFixed(3)} L = ${density.toFixed(3)} kg/L (range ${low} to ${high})`)
    }
    expect(outside).toEqual([])
  })

  it('names the hollow items (empty containers, bags, helmets, boxes of air) one by one, each with its reason', () => {
    const hollow = Object.entries(sources.decisions.dimensions).filter(([, decision]) => decision.material === 'hollow')
    expect(hollow.length).toBeGreaterThan(30)
    expect(hollow.length).toBeLessThan(70)
    for (const [id, decision] of hollow) expect(decision.reason.length, id).toBeGreaterThan(10)
  })

  it('keeps every side a plausible size for something you pick up (1 mm to 2 m)', () => {
    for (const item of items) for (const side of item.size) expect(side, item.id).toBeGreaterThanOrEqual(0.001)
    for (const item of items) for (const side of item.size) expect(side, item.id).toBeLessThanOrEqual(MAX_SIDE_METRES)
  })

  it('would flag a slipped decimal: moving one side of an item by a factor of ten leaves its range for most items', () => {
    let caught = 0
    let tried = 0
    for (const item of items) {
      const material = sources.decisions.dimensions[item.id]?.material ?? 'hollow'
      const [low, high] = DENSITY_RANGE[material]
      for (const factor of [10, 0.1]) {
        tried += 1
        const density = item.weight / (litres(item.size) * factor)
        if (density < low || density > high) caught += 1
      }
    }
    expect(caught / tried).toBeGreaterThan(0.75)
  })
})
