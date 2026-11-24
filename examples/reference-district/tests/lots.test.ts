import { describe, expect, it } from 'vitest'

import { commercialTemplateIds, interiorTemplateIds } from '@adatechnology/game-floorplan-commercial'
import { hashString } from '@adatechnology/game-floorplan'
import { residentialTemplateIds } from '@adatechnology/game-floorplan-residential'
import { createUrban } from '@adatechnology/game-urban'

import { createTestEngine, lineBandOverlapsRect, plan, rectsOverlap, site } from './helpers'

const engine = createTestEngine()
const OWNED_TEMPLATE_IDS: readonly string[] = [...residentialTemplateIds, ...commercialTemplateIds]
/** Rules about the size of the lot: the engine measures its own default lot, so these are checked against the lot of the site below. */
const LOT_SIZE_RULES = ['min_lot', 'min_frontage']

const urban = createUrban({ packs: { cityPlans: [plan] } })
const layout = urban.cities.layout(plan.id)

/** The zone of a lot: its own, or the one of the district under its centre. */
function zoneOf(lot: (typeof site.lots)[number]): string {
  const zone = lot.zone ?? layout.districtAt((lot.rect[0] + lot.rect[2]) / 2, (lot.rect[1] + lot.rect[3]) / 2)?.zone
  if (!zone) throw new Error(`lot ${lot.id} is on ground with no zone`)
  return zone
}

describe('lot typologies', () => {
  it('are templates of the owning packs, registered in the engine', () => {
    const registered = engine.listTemplates().map((template) => template.id)
    for (const lot of site.lots) {
      expect(OWNED_TEMPLATE_IDS, `${lot.id}: ${lot.typology}`).toContain(lot.typology)
      expect(registered, `${lot.id}: ${lot.typology}`).toContain(lot.typology)
    }
  })

  it('police_station and church come from the interior modules of game-floorplan-commercial', () => {
    for (const typology of ['police_station', 'church']) {
      expect(interiorTemplateIds).toContain(typology)
      expect(site.lots.some((lot) => lot.typology === typology), typology).toBe(true)
    }
  })

  it('the house the player enters is the third lot to the south, fixed to no state', () => {
    const entered = site.lots.filter((lot) => lot.state === 'none')
    expect(entered.map((lot) => lot.id)).toEqual(['street_south_3'])
    expect(entered[0]?.typology).toBe('budget_slab_house')
  })
})

describe('zoning', () => {
  it.each(site.lots.map((lot) => [lot.id, lot] as const))('%s passes the zoning check of its zone', (_id, lot) => {
    const zone = zoneOf(lot)
    const result = engine.generate(lot.typology, { seed: hashString(`${site.seed}:${lot.id}`), zone })
    const violations = (result.zoning?.violations ?? []).filter((violation) => !LOT_SIZE_RULES.includes(violation.rule))
    expect(violations, `${lot.id} in ${zone}`).toEqual([])
    const zoneDef = engine.getZone(zone)
    const [width, depth] = [lot.rect[2] - lot.rect[0], lot.rect[3] - lot.rect[1]]
    const [frontage, deep] = lot.front === 'n' || lot.front === 's' ? [width, depth] : [depth, width]
    expect(frontage, `${lot.id} frontage`).toBeGreaterThanOrEqual(zoneDef?.minFrontage ?? Infinity)
    expect(frontage * deep, `${lot.id} area`).toBeGreaterThanOrEqual(zoneDef?.minLot ?? Infinity)
  })

  it('a pharmacy in the popular quarter is zc, not zr2 (zr2 takes no commercial use)', () => {
    const pharmacy = site.lots.find((lot) => lot.id === 'street_north_3')
    expect(pharmacy?.zone).toBe('zc')
    expect(engine.generate('pharmacy', { seed: 1, zone: 'zr2' }).zoning?.violations.map((violation) => violation.rule)).toContain('use')
  })
})

describe('lot placement', () => {
  it('no two lots overlap', () => {
    for (const [index, lot] of site.lots.entries()) {
      for (const other of site.lots.slice(index + 1)) expect(rectsOverlap(lot.rect, other.rect), `${lot.id} x ${other.id}`).toBe(false)
    }
  })

  it('no lot covers the band of a plan line', () => {
    for (const lot of site.lots) {
      for (const line of layout.lines) expect(lineBandOverlapsRect(line, lot.rect), `${lot.id} x ${line.id}`).toBe(false)
    }
  })

  it('the lots on the script street front the street: z -5 for the north side, z 5 for the south side', () => {
    for (const lot of site.lots.filter((item) => item.id.startsWith('street_'))) {
      expect(lot.front).toBe(lot.rect[3] <= 0 ? 's' : 'n')
      expect(lot.rect[3] <= 0 ? lot.rect[3] : lot.rect[1]).toBe(lot.rect[3] <= 0 ? -5 : 5)
    }
  })

  it('every lot sits inside a district of the plan', () => {
    for (const lot of site.lots) expect(layout.districtAt(lot.rect[0], lot.rect[1]), lot.id).toBeDefined()
  })

  it('the lines of the plan themselves are checked: a lot on the road is caught', () => {
    const main = layout.lines.find((line) => line.id === 'main_street')!
    expect(lineBandOverlapsRect(main, [60, -2, 70, 2])).toBe(true)
    expect(lineBandOverlapsRect(main, [60, -30, 70, -5])).toBe(false)
  })
})
