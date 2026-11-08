import { writeFileSync } from 'node:fs'

import { engine } from '@adatechnology/game-floorplan'
import { buildOfficeTower, commercialTemplateIds, register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { buildResidentialTower, register as registerResidential, residentialTemplateIds } from '@adatechnology/game-floorplan-residential'
import { register as registerRural, ruralTemplateIds } from '@adatechnology/game-floorplan-rural'
import { register as registerStructure, toDestructibleSpec } from '@adatechnology/game-floorplan-structure'
import type { Structure } from '@adatechnology/game-floorplan-structure'
import { debrisFamily, MATERIALS } from '@adatechnology/game-destruction'
import type { DebrisFamily, DestructibleSpec } from '@adatechnology/game-destruction'
import { createHousehold, createRecorder, HOUSEHOLD_TYPES } from '@adatechnology/game-interactables-household'
import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import { DEFAULT_MATERIAL_IDS } from '@adatechnology/game-vegetation'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { wallPlan } from '../src/wall'
import { fakeDocument } from './helpers/fake-document'

registerResidential(engine, { region: 'br' })
registerCommercial(engine)
registerRural(engine)
registerStructure(engine)

const BY_ID = new Map(MATERIALS.map((def) => [def.id, def]))
const familyOf = (material: string): DebrisFamily => debrisFamily(BY_ID.get(material))

/** Members that carry the building (by their role or their name): concrete or masonry, or the material the house is built of when it is a wooden one. */
const STRUCTURAL_ROLES = new Set(['column', 'beam', 'slab', 'foundation'])
const STRUCTURAL_NAME = /column|pillar|beam|slab|lintel|sill|foundation|footing|bond|pilar|viga|cinta|laje|baldrame|verga/i
const GLASS_NAME = /glass|pane(?!l)|vidro/i

interface Row {
  readonly object: string
  readonly part: string
  readonly material: string
  readonly family: DebrisFamily | 'unknown'
  readonly rule: string
}

type PartLike = { readonly id: string; readonly material: string; readonly structure?: { readonly role?: string } }

/** Roof timbers: a tiled roof is carried on wood over a masonry house too (rafters, ridge, joists, purlins). */
const ROOF_TIMBER = /rafter|ridge|joist|purlin|batten|truss/i
/** Columns that are not the building's frame (the stand of a water tank, a porch post, a tent peg, the piers it stands on). */
const BUILDING_EXTRAS = /tank|porch|peg|pole|footing|pier/i

const majority = (parts: readonly PartLike[]): DebrisFamily | undefined => {
  const counts = new Map<DebrisFamily, number>()
  for (const part of parts) counts.set(familyOf(part.material), (counts.get(familyOf(part.material)) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/**
 * The building system, by what its frame is made of (a wood-frame house has wooden plates and lintels under drywall, a brick house concrete pillars), else by its
 * walls; `soft` for a tent, which has no structure to speak of.
 */
function buildingFamily(parts: readonly PartLike[]): DebrisFamily {
  const walls = majority(parts.filter((part) => part.structure?.role === 'wall' || part.structure?.role === 'partition'))
  if (walls === 'soft') return 'soft'
  const frame = parts.filter((part) => (part.structure?.role === 'column' || part.structure?.role === 'beam') && !BUILDING_EXTRAS.test(part.id) && !ROOF_TIMBER.test(part.id))
  return majority(frame) ?? walls ?? 'masonry'
}

/** The families a structural member may be of in a building of this family. */
function structuralFamilies(building: DebrisFamily, partId: string): readonly DebrisFamily[] | undefined {
  // a tent (its own fabric, pegs and poles) is not a building, wherever it is pitched
  if (building === 'soft' || /tent/i.test(partId)) return undefined
  if (building === 'masonry') return ROOF_TIMBER.test(partId) ? ['masonry', 'metal', 'wood'] : ['masonry', 'metal']
  return ['masonry', 'metal', 'wood']
}

/** Checks the parts of one object and adds a row for each part a rule looked at. */
function audit(object: string, parts: readonly PartLike[], rows: Row[]): string[] {
  const problems: string[] = []
  const building = buildingFamily(parts)
  for (const part of parts) {
    const def = BY_ID.get(part.material)
    if (!def) {
      problems.push(`${object}/${part.id}: unknown material "${part.material}"`)
      rows.push({ object, part: part.id, material: part.material, family: 'unknown', rule: 'material' })
      continue
    }
    const family = debrisFamily(def)
    const structural = STRUCTURAL_ROLES.has(part.structure?.role ?? '') || (part.structure?.role !== 'wall' && STRUCTURAL_NAME.test(part.id))
    if (structural) {
      rows.push({ object, part: part.id, material: part.material, family, rule: `structure (${part.structure?.role ?? 'name'})` })
      const allowed = structuralFamilies(building, part.id)
      if (allowed && !allowed.includes(family)) problems.push(`${object}/${part.id}: structural member of ${part.material} (${family}) in a ${building} building`)
    }
    if (GLASS_NAME.test(part.id) && !/frame|caixilho|putty|bead/i.test(part.id)) {
      rows.push({ object, part: part.id, material: part.material, family, rule: 'glass' })
      if (family !== 'glass') problems.push(`${object}/${part.id}: glass by name but ${part.material}`)
    }
  }
  return problems
}

const specOf = (id: string): DestructibleSpec => toDestructibleSpec((engine.generate(id, { seed: 1 }) as unknown as { structure: Structure }).structure, { wallDetail: 'coarse' })

const ROWS: Row[] = []

describe('every part of the kit objects has a real material, and the right one for what it is', () => {
  const houses = [...residentialTemplateIds, ...commercialTemplateIds, ...ruralTemplateIds].filter((id) => id !== 'residential_tower' && id !== 'office_tower')
  for (const id of houses) {
    it(`house ${id}`, () => {
      expect(audit(id, specOf(id).parts as readonly PartLike[], ROWS)).toEqual([])
    })
  }

  it('office tower (3 storeys)', () => {
    expect(audit('office_tower', buildOfficeTower({ storeys: 3 }).parts as readonly PartLike[], ROWS)).toEqual([])
  })

  it('residential tower (3 storeys)', () => {
    expect(audit('residential_tower', buildResidentialTower({ storeys: 3 }).parts as readonly PartLike[], ROWS)).toEqual([])
  })

  for (const options of [{ w: 10, h: 3 }, { w: 4, h: 2.6 }, { w: 1.2, h: 1.8 }, { w: 23, h: 2.2, finish: 'exposed_block' as const }]) {
    it(`wall ${options.w} x ${options.h}`, () => {
      const spec = toDestructibleSpec(wallPlan(options).structure, { wallDetail: 'coarse' })
      expect(audit(`wall_${options.w}x${options.h}`, spec.parts as readonly PartLike[], ROWS)).toEqual([])
    })
  }

  it('furniture catalogue', () => {
    const problems: string[] = []
    for (const { type } of defaultFurnitureCatalog()) {
      let made: { spec: DestructibleSpec } | undefined
      try {
        made = furnitureSpec(THREE, type, { catalog: defaultFurnitureCatalog(), document: fakeDocument, options: { chairs: false } }) as { spec: DestructibleSpec } | undefined
      } catch {
        continue
      }
      if (made?.spec) problems.push(...audit(`furniture ${type}`, made.spec.parts as readonly PartLike[], ROWS))
    }
    expect(problems).toEqual([])
  })

  it('household interactables', () => {
    const household = createHousehold({ region: 'br' })
    const problems: string[] = []
    for (const type of HOUSEHOLD_TYPES) {
      const spec = household.build(type, { circuits: [{ id: 'a' }], points: [[0, 0, 0], [1, 0, 0]], house: [1, 3, 0] }, createRecorder().api) as unknown as {
        destruction?: { material?: string }
        parts?: ReadonlyArray<{ id: string; destruction?: { material?: string } }>
      }
      const parts: PartLike[] = []
      if (spec.destruction?.material) parts.push({ id: 'body', material: spec.destruction.material })
      for (const part of spec.parts ?? []) if (part.destruction?.material) parts.push({ id: part.id, material: part.destruction.material })
      problems.push(...audit(`household ${type}`, parts, ROWS))
    }
    expect(problems).toEqual([])
  })

  it('vegetation materials', () => {
    const expected: Readonly<Record<string, DebrisFamily>> = { wood: 'wood', woodDry: 'wood', foliage: 'soft', flowers: 'soft', fruit: 'soft', pot: 'masonry', soil: 'soil', cactus: 'soft' }
    for (const [key, material] of Object.entries(DEFAULT_MATERIAL_IDS)) {
      expect(BY_ID.has(material), `${key} -> ${material}`).toBe(true)
      expect(familyOf(material), key).toBe(expected[key])
      ROWS.push({ object: 'vegetation', part: key, material, family: familyOf(material), rule: 'material' })
    }
  })

  it('writes the table when asked (PART_MATERIALS_TABLE=path)', () => {
    const path = process.env.PART_MATERIALS_TABLE
    if (!path) return
    const lines = ['| objeto | parte | material | família | regra |', '|---|---|---|---|---|', ...ROWS.map((row) => `| ${row.object} | ${row.part} | ${row.material} | ${row.family} | ${row.rule} |`)]
    writeFileSync(path, `${lines.join('\n')}\n`)
  })
})
