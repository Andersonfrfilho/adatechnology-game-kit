import { engine } from '@adatechnology/game-floorplan'
import type { FloorplanResult, ResultItem } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { postApocalypticStates, register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'
import { countViolations, register as registerStructure, slabsOffSupport, toDestructibleSpec, validateSpec, validateStructure } from '@adatechnology/game-floorplan-structure'
import type { SourceDoor, Structure } from '@adatechnology/game-floorplan-structure'
import { MATERIALS, createDestruction, getAssembly } from '@adatechnology/game-destruction'
import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'
import { AT_REST_FAILING } from './helpers/at-rest-failing'
import { UNMODELLED_ITEM_TYPES } from './helpers/unmodelled-items'

// Every pack of the kit in the engine, as the houses area of the room loads them (examples/floorplan-test-area/src/entry.js).
registerResidential(engine, { region: 'br' })
registerCommercial(engine, { region: 'br' })
registerStructure(engine)
registerRural(engine)
registerPostApocalyptic(engine)

const SEEDS = [1, 2, 3]
const STATES = ['normal', ...postApocalypticStates] as const
const MATERIAL_IDS = new Set(MATERIALS.map((material) => material.id))
const CATALOG = defaultFurnitureCatalog()

type Plan = FloorplanResult & { structure: Structure; doors: SourceDoor[] }
type Options = Readonly<Record<string, unknown>>
interface TemplateInfo {
  readonly id: string
  readonly floorRange: readonly [number, number] | null
  readonly options: Readonly<Record<string, readonly unknown[]>>
}

const TEMPLATES = engine.listTemplates() as unknown as readonly TemplateInfo[]
/** A tower is a frame of 20 to 60 storeys: one seed at its lowest height is enough here, its own package checks it at height. */
const isTower = (template: TemplateInfo): boolean => (template.floorRange?.[0] ?? 1) >= 10

/** The defaults, then every value of every option the template declares (one at a time) and both ends of its storeys: what changes how it is built. */
function variantsOf(template: TemplateInfo): Options[] {
  if (isTower(template)) return [{ floors: template.floorRange![0] }]
  const out: Options[] = [{}]
  for (const [key, values] of Object.entries(template.options)) for (const value of values) out.push({ [key]: value })
  if (template.floorRange && !('floors' in template.options)) for (const floors of new Set(template.floorRange)) out.push({ floors })
  return out
}

const generate = (id: string, options: Options): Plan => engine.generate(id, options) as unknown as Plan

/** The positive count of what a building of its system has to carry (the validator says where each one is missing; this says none of them vanished). */
function missingMembers(structure: Structure): string[] {
  const parts = structure.parts
  const count = (test: (part: Structure['parts'][number]) => boolean): number => parts.filter(test).length
  const out: string[] = []
  if (structure.construction.system === 'masonry') {
    if (count((part) => part.role === 'column') < 4) out.push('fewer than 4 pillars')
    if (!structure.framed && count((part) => part.beamKind === 'ground_beam') === 0) out.push('no ground beam (viga baldrame)')
    if (!structure.framed && count((part) => part.beamKind === 'bond_beam') === 0) out.push('no bond beam (cinta)')
  }
  if (structure.construction.system !== 'canvas' && count((part) => part.role === 'wall' || part.role === 'partition') === 0) out.push('no wall')
  return out
}

/** Every part of the structure is of a material and an assembly the destruction SDK knows (nothing generic). */
function unknownMaterials(structure: Structure): string[] {
  const out: string[] = []
  for (const part of structure.parts) {
    if (!MATERIAL_IDS.has(part.material)) out.push(`${part.id}: material ${part.material}`)
    if (part.assembly && !getAssembly(part.assembly)) out.push(`${part.id}: assembly ${part.assembly}`)
  }
  return out
}

describe('every plan of the kit, every state, seed and option', () => {
  for (const template of TEMPLATES) {
    for (const options of variantsOf(template)) {
      const states = isTower(template) ? (['normal'] as const) : STATES
      // the defaults on every seed; each option on one seed in every state (the option is what changes the building, the seeds are covered by the defaults)
      const seeds = isTower(template) || Object.keys(options).length > 0 ? [1] : SEEDS
      it(`${template.id} ${JSON.stringify(options)}: structure, spec, members, materials and resting slabs`, () => {
        const problems: string[] = []
        for (const state of states) {
          for (const seed of seeds) {
            const where = `${template.id} ${state} seed ${seed}`
            const plan = generate(template.id, { seed, state, ...options })
            expect(plan.structure, `${where}: a plan with no structure`).toBeTruthy()
            const structure = plan.structure
            for (const v of validateStructure(structure, { doors: plan.doors })) problems.push(`${where} structure ${v.code} ${v.part}`)
            const spec = toDestructibleSpec(structure, { wallDetail: 'coarse' })
            const specProblems = validateSpec(spec)
            if (specProblems.length) problems.push(`${where} spec ${JSON.stringify(countViolations(specProblems))} ${specProblems.slice(0, 3).map((v) => v.part).join(',')}`)
            for (const missing of missingMembers(structure)) problems.push(`${where}: ${missing}`)
            for (const unknown of unknownMaterials(structure)) problems.push(`${where}: ${unknown}`)
            for (const slab of slabsOffSupport(spec, undefined, { ledgers: true })) problems.push(`${where}: ${slab} rests with its centre off its supports`)
          }
        }
        expect(problems).toEqual([])
      }, 600000)
    }
  }
})

/** What breaks in the destruction world with nothing hitting it: the building as built, left alone for `seconds` (a crack, a break or a fall is a load it cannot carry). */
function brokenAtRest(structure: Structure, seconds = 2): string[] {
  const world = createDestruction({ seed: 1 })
  world.add(toDestructibleSpec(structure, { wallDetail: 'coarse' }))
  const broken = new Set<string>()
  world.on('*', (event) => {
    if (['crack', 'damage', 'break', 'collapse', 'fracture'].includes(event.type) && 'part' in event && typeof event.part === 'string') broken.add(event.part)
  })
  for (let t = 0; t < seconds; t += 0.1) world.update(0.1)
  return [...broken].sort()
}

/** The defaults and each number of storeys a template declares, on seed 1: where the load of a storey lands on what is under it. */
function storeyVariantsOf(template: TemplateInfo): Options[] {
  if (isTower(template)) return []
  const floors = (template.options.floors ?? (template.floorRange ? [...new Set(template.floorRange)] : [])) as readonly unknown[]
  return [{}, ...floors.map((value) => ({ floors: value }))]
}

describe('every plan stands on its own: left alone, nothing cracks, breaks or falls', () => {
  const failing: string[] = []
  for (const template of TEMPLATES) {
    for (const options of storeyVariantsOf(template)) {
      const key = `${template.id} ${JSON.stringify(options)}`
      it(key, () => {
        const broken = brokenAtRest(generate(template.id, { seed: 1, ...options }).structure)
        if (AT_REST_FAILING.has(key)) {
          failing.push(key)
          // a counted failure (helpers/at-rest-failing.ts): once it stands, it leaves the list
          expect(broken.length, `${key} stands now: take it out of AT_REST_FAILING`).toBeGreaterThan(0)
          return
        }
        expect(broken).toEqual([])
      }, 120000)
    }
  }

  it('every counted failure is a plan this test runs', () => {
    expect([...AT_REST_FAILING].filter((key) => !failing.includes(key))).toEqual([])
  })
})

/** Every item type any plan places, in every state, with the plan item it was first seen as. */
function itemsOfAllPlans(): Map<string, ResultItem> {
  const out = new Map<string, ResultItem>()
  for (const template of TEMPLATES) {
    if (isTower(template)) continue
    for (const options of variantsOf(template)) {
      for (const state of STATES) {
        const plan = generate(template.id, { seed: 1, state, ...options })
        // a state marker with no size (open doors, ransacked drawers) is not a piece: the house draws only the sized ones (furniture/place-items)
        for (const item of [...plan.items, ...plan.stateItems.filter((marker) => marker.w != null && marker.d != null)]) if (!out.has(item.type)) out.set(item.type, item)
      }
    }
  }
  return out
}

describe('every item a plan places is a piece of the kit with real materials', () => {
  const items = itemsOfAllPlans()
  const modelled: string[] = []
  const unmodelled: string[] = []
  for (const [type, item] of items) {
    if (item.category === 'ground_cover' || type === 'stairs') continue // a floor finish of the lot, the stairs of the structure
    try {
      const made = furnitureSpec(THREE, type, { catalog: CATALOG, document: fakeDocument, w: item.w, d: item.d, h: item.h, options: { chairs: false } })
      modelled.push(type)
      it(`${type}: every part of a material of the destruction SDK`, () => {
        expect(made.spec.parts.length).toBeGreaterThan(0)
        expect(made.spec.parts.filter((part) => !MATERIAL_IDS.has(part.material)).map((part) => `${part.id}: ${part.material}`)).toEqual([])
      })
    } catch (error) {
      if (!(error instanceof Error) || !/no builder/.test(error.message)) throw error
      unmodelled.push(type)
    }
  }

  // Item types the plans place that the kit draws as a labelled box: a debt counted in helpers/unmodelled-items.ts (docs/plantas-validacao.md) that only shrinks.
  it('no item type without a model beyond the counted ones', () => {
    expect(unmodelled.filter((type) => !UNMODELLED_ITEM_TYPES.has(type)).sort()).toEqual([])
  })

  it('a counted item type that got its model leaves the list', () => {
    expect([...UNMODELLED_ITEM_TYPES].filter((type) => !unmodelled.includes(type)).sort()).toEqual([])
  })

  it('the plans place furniture with models', () => {
    expect(modelled.length).toBeGreaterThan(100)
  })
})
