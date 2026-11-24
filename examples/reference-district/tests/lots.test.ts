import { describe, expect, it } from 'vitest'

import { commercialTemplateIds, interiorTemplateIds } from '@adatechnology/game-floorplan-commercial'
import { hashString } from '@adatechnology/game-floorplan'
import { residentialTemplateIds } from '@adatechnology/game-floorplan-residential'
import { createUrban } from '@adatechnology/game-urban'

import { SIDEWALK_WIDTH, createTestEngine, lineBandOverlapsRect, plan, rectsOverlap, site } from './helpers'

const engine = createTestEngine()
const OWNED_TEMPLATE_IDS: readonly string[] = [...residentialTemplateIds, ...commercialTemplateIds]

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
  // the engine measures the lot its template draws; every rule is checked again on the lot of the site (same setbacks and yards, the site's area)
  it.each(site.lots.map((lot) => [lot.id, lot] as const))('%s passes every rule of its zone on the lot of the site', (_id, lot) => {
    const zone = zoneOf(lot)
    const result = engine.generate(lot.typology, { seed: hashString(`${site.seed}:${lot.id}`), zone })
    const [width, depth] = [lot.rect[2] - lot.rect[0], lot.rect[3] - lot.rect[1]]
    const [frontage, deep] = lot.front === 'n' || lot.front === 's' ? [width, depth] : [depth, width]
    const siteLot = { ...(result.lot as NonNullable<typeof result.lot>), rect: [0, 0, frontage, deep] }
    expect(engine.checkLot(zone, siteLot, result), `${lot.id} in ${zone}`).toEqual([])
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

  it('no lot covers the road of a plan line, nor the sidewalk on each side of a street', () => {
    for (const lot of site.lots) {
      for (const line of layout.lines) {
        const band = line.kind === 'river' ? line : { ...line, width: line.width + 2 * SIDEWALK_WIDTH }
        expect(lineBandOverlapsRect(band, lot.rect), `${lot.id} x ${line.id}`).toBe(false)
      }
    }
  })

  it('the lots on the script street start past the road and the sidewalk: z -7.5 for the north side, z 7.5 for the south side', () => {
    for (const lot of site.lots.filter((item) => item.id.startsWith('street_'))) {
      expect(lot.front).toBe(lot.rect[3] <= 0 ? 's' : 'n')
      expect(lot.rect[3] <= 0 ? lot.rect[3] : lot.rect[1]).toBe(lot.rect[3] <= 0 ? -7.5 : 7.5)
    }
  })

  it('every lot sits wholly inside one district of the plan', () => {
    for (const lot of site.lots) {
      const [x0, z0, x1, z1] = lot.rect
      const districts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => layout.districtAt(x as number, z as number)?.id)
      expect(districts[0], lot.id).toBeDefined()
      expect(new Set(districts).size, lot.id).toBe(1)
    }
  })

  it('the lines of the plan themselves are checked: a lot on the road is caught', () => {
    const main = layout.lines.find((line) => line.id === 'main_street')!
    expect(lineBandOverlapsRect(main, [60, -2, 70, 2])).toBe(true)
    expect(lineBandOverlapsRect(main, [60, -30, 70, -5])).toBe(false)
    expect(lineBandOverlapsRect({ ...main, width: main.width + 2 * SIDEWALK_WIDTH }, [60, -30, 70, -5])).toBe(true)
  })
})
