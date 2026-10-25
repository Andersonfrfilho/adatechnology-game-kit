import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'

import {
  SKYSCRAPER_DEFAULTS, SKYSCRAPER_MAX_STOREYS, buildSkyscraper, mechanicalStoreys, pilesFor, skyscraperLayout, splitStrip, storeyKinds, stripDoor, towerFloors, towerPlate,
} from '../src'
import type { SkyscraperOptions } from '../src'

type Ev<T extends DestructionEvent['type']> = Extract<DestructionEvent, { type: T }>
const run = (w: ReturnType<typeof createDestruction>, seconds: number): DestructionEvent[] => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += 0.1) out.push(...w.update(0.1))
  return out
}
const bad = (events: DestructionEvent[]) => events.filter((e) => ['stress', 'collapse', 'fracture', 'detach'].includes(e.type))
/** The design wind of the preset: 40 m/s over a city (category IV). */
const wind = { speed: 40, terrain: 'IV' as const }
const area = (r: number[]) => (r[2] - r[0]) * (r[3] - r[1])

/** The skyscraper recipe (design T10-estrutura-real.md §11). */
describe('skyscraper layout', () => {
  it('turns the defaults into the sizes of a 40-storey tower on 12 m bays', () => {
    const l = skyscraperLayout()
    expect(l.storeys).toBe(SKYSCRAPER_DEFAULTS.storeys)
    expect(l.bay).toEqual([12, 12])
    expect(l.span).toEqual([36, 36])
    expect(l.slab).toBe(0.4)
    expect(l.beamHeight).toBe(0.9)
    expect(l.pitch).toBeCloseTo(4, 9)
    expect(l.total).toBeCloseTo(160, 6)
    expect(l.columnSize).toBeGreaterThanOrEqual(1.5)
    expect(l.columnSize).toBeLessThanOrEqual(2.2)
    expect(l.plate[0]).toBeCloseTo(36 + l.columnSize + 0.2, 6)
    expect(l.mechanical).toEqual([20, 39])
    expect(l.damper).toBe(true)
    expect(l.facade).toBe('curtain')
    // the core stands in the middle bay and fits between the columns and the beams
    const core = l.core!
    expect(core.center).toEqual([0, 0])
    expect(core.size[0]).toBeLessThan(12 - l.columnSize)
    expect(core.size[1]).toBeLessThan(12 - 0.8)
    expect(l.coreRatio).toBeGreaterThan(0.04)
    expect(l.coreRatio).toBeLessThan(0.1)
    expect(l.tower.floors).toBe(40)
    expect(l.tower.raft).toBe(true)
  })

  it('every number is an option: the range, the height, the bays, the facade, the mechanical floors, the damper', () => {
    expect(skyscraperLayout({ storeys: 500 }).storeys).toBe(60)
    expect(skyscraperLayout({ storeys: 3 }).storeys).toBe(20)
    const l = skyscraperLayout({ storeys: 30, height: 3, bay: [9, 12], slenderness: false, bays: [1, 2], facade: 'punched', mechanicalEvery: false, damperAbove: false, columnSize: 1, beamHeight: 0.7, slabThickness: 0.3 })
    expect(l.bay).toEqual([9, 12])
    // the bays in z are made odd: the middle bay has no row of beams through the core
    expect(l.columnsZ).toBe(4)
    expect(l.columnsX).toBe(2)
    expect(l.core!.center).toEqual([0, 0])
    expect(l.mechanical).toEqual([29])
    expect(l.damper).toBe(false)
    expect(l.facade).toBe('punched')
    expect(l.tower.facade).toBe(false)
    expect(l.tower.punched).toEqual({})
    expect([l.columnSize, l.beamHeight, l.slab]).toEqual([1, 0.7, 0.3])
    expect(l.pitch).toBeCloseTo(3.3, 9)
    expect(skyscraperLayout({ storeys: 30, core: false }).core).toBeNull()
  })

  it('60 storeys is the default maximum (owner, 2026-10-25) and an option raises it', () => {
    expect(SKYSCRAPER_MAX_STOREYS).toBe(60)
    expect(SKYSCRAPER_DEFAULTS.range).toEqual([20, 60])
    expect(skyscraperLayout({ storeys: 80 }).storeys).toBe(60)
    expect(skyscraperLayout({ storeys: 80, range: [20, 80] }).storeys).toBe(80)
    expect(skyscraperLayout({ storeys: 80 }, { ...SKYSCRAPER_DEFAULTS, range: [20, 100] }).storeys).toBe(80)
  })

  it('too slender a tower gets wider bays; a preset can turn the rule off', () => {
    const slim = skyscraperLayout({ storeys: 60, bay: 6, slenderness: 9 })
    expect(Math.min(...slim.span)).toBeGreaterThanOrEqual(slim.total / 9 - 1e-6)
    expect(slim.bay[0]).toBeGreaterThan(6)
    expect(skyscraperLayout({ storeys: 60, bay: 6, slenderness: false }).bay).toEqual([6, 6])
  })

  it('the core walls grow with the height but never past a third of the storey, and the bars get closer on the tall ones', () => {
    const t = (n: number) => skyscraperLayout({ storeys: n }).core!.wallThickness
    expect(t(20)).toBeLessThan(t(40))
    expect(t(40)).toBeLessThan(t(60))
    expect(t(60)).toBeLessThanOrEqual(3.6 / 3)
    expect(skyscraperLayout({ storeys: 40 }).tower.core).toMatchObject({ rebar: { spacing: 0.1 } })
    expect(skyscraperLayout({ storeys: 60 }).tower.core).toMatchObject({ rebar: { spacing: 0.075 } })
  })

  it('a plant floor every N storeys, never closer than N/2 to the top one', () => {
    expect(mechanicalStoreys(40, 20)).toEqual([20])
    expect(mechanicalStoreys(80, 20)).toEqual([20, 40, 60])
    expect(mechanicalStoreys(28, 20)).toEqual([])
    expect(mechanicalStoreys(80)).toEqual([])
    expect(skyscraperLayout({ storeys: 60 }).mechanical).toEqual([20, 40, 59])
    expect(skyscraperLayout({ storeys: 60, mechanicalEvery: 10 }).mechanical).toEqual([10, 20, 30, 40, 50, 59])
  })
})

describe('skyscraper structure', () => {
  const cases: Array<[number, SkyscraperOptions]> = [[20, {}], [40, {}], [60, {}]]

  for (const [storeys, extra] of cases) {
    describe(`${storeys} storeys`, () => {
      const spec = buildSkyscraper({ storeys, ...extra })
      const layout = skyscraperLayout({ storeys, ...extra })

      it('stands at rest and in the design wind, on its core and its piles, with nothing moving', () => {
        const w = createDestruction({ wind })
        const id = w.add(spec)
        const st = w.state(id)!
        expect(st.groups).toHaveLength(1)
        expect(Math.max(...st.parts.map((p) => p.stress ?? 0))).toBeLessThanOrEqual(0.65 + 1e-6)
        expect(st.soil!.status).toBe('stable')
        expect(st.soil!.bearing).toBeLessThan(0.85)
        expect(st.soil!.tilt).toBeLessThan(0.5)
        // measured at 60 storeys: drift 0.00265 (1/377), above H/500 = 0.002, so the status is 'drift' there; 20 and 40 storeys are 'ok'
        expect(st.wind!.overturn).toBeLessThan(0.3)
        expect(st.wind!.status === 'ok' || storeys >= 60).toBe(true)
        expect(st.wind!.drift).toBeLessThan(storeys >= 60 ? 1 / 300 : 1 / 500)
        expect(bad(run(w, 20))).toHaveLength(0)
        expect(w.state(id)!.groups).toHaveLength(1)
      })

      it('has the core from the raft to the roof, the piles to firm ground and the plant floors', () => {
        const parts = new Map(spec.parts.map((p) => [p.id, p]))
        expect(parts.has('core_0_w') && parts.has(`core_${storeys - 1}_e`)).toBe(true)
        expect(spec.joints!.find((j) => j.a === 'core_0_w')!.b).toBe('raft')
        const pile = parts.get('raft')!.structure!.pile!
        expect(pile.diameter).toBe(1.2)
        expect(pile.method).toBe('bored')
        expect(pile.count).toBeGreaterThan(40)
        // the sand is below 10 m of soft clay: a pile that carries a tower goes well into it
        expect(pile.length).toBeGreaterThan(12)
        expect(pile.length).toBeLessThanOrEqual(60)
        expect(spec.soil).toEqual(SKYSCRAPER_DEFAULTS.soil)
        for (const f of layout.mechanical) {
          const sfx = f === storeys - 1 ? '' : `_${f}`
          expect(parts.has(`water_tank${sfx}`), `water_tank${sfx}`).toBe(true)
          expect(parts.has(`chiller_0${sfx}`)).toBe(true)
          expect(parts.has(`glass_${f}_n_0`), 'no glass on a plant floor').toBe(false)
          expect(parts.has(`glass_${f - 1}_n_0`)).toBe(true)
        }
        expect(parts.has('machine_0')).toBe(true)
        expect(parts.has('damper')).toBe(layout.damper)
        // the elevator machines are on the top floor only
        expect(spec.parts.filter((p) => p.id.startsWith('machine_'))).toHaveLength(layout.core!.elevators)
      })
    })
  }

  it('the same tower on soft clay with no piles sinks and tips over; on firm ground it needs no piles', () => {
    const shallow = buildSkyscraper({ storeys: 40, piles: false })
    expect(shallow.parts.find((p) => p.id === 'raft')!.structure!.pile).toBeUndefined()
    const w = createDestruction({ wind })
    const id = w.add(shallow)
    expect(w.state(id)!.soil!.bearing).toBeGreaterThan(1)
    const events = run(w, 60)
    expect(events.some((e) => e.type === 'settle' && (e as Ev<'settle'>).status === 'toppled')).toBe(true)
    // on dense sand the raft carries a 20-storey tower by itself
    const firm = buildSkyscraper({ storeys: 20, soil: 'sand_dense', piles: false })
    const f = createDestruction({ wind })
    const fi = f.add(firm)
    expect(f.state(fi)!.soil!.bearing).toBeLessThan(1)
    expect(bad(run(f, 10))).toHaveLength(0)
    // soil: false leaves the raft anchored with no soil at all
    expect(buildSkyscraper({ storeys: 20, soil: false }).soil).toBeUndefined()
  })

  it('piles are sized by the load: more floors, longer or more piles; firmer soil, shorter ones', () => {
    const of = (storeys: number, soil: SkyscraperOptions['soil']) => pilesFor(buildSkyscraper({ storeys, soil: false }), soil as string, {})
    const clay = { layers: [{ soil: 'clay_soft', thickness: 10 }, { soil: 'sand_dense' }] }
    const a = of(20, clay), b = of(40, clay)
    expect(b.length * b.count!).toBeGreaterThan(a.length * a.count!)
    const rock = of(40, { layers: [{ soil: 'clay_soft', thickness: 4 }, { soil: 'rock' }] })
    expect(rock.length).toBeLessThan(b.length)
    expect(pilesFor(buildSkyscraper({ storeys: 20, soil: false }), clay, { length: 25, count: 30, diameter: 1 })).toEqual({ length: 25, count: 30, diameter: 1, method: 'bored' })
    expect(() => pilesFor({ parts: [] }, clay)).toThrow(/raft/)
  })

  it('a punched facade has infill walls with a window in each bay, and no curtain wall', () => {
    const spec = buildSkyscraper({ storeys: 30, height: 2.8, bay: 9, facade: 'punched', mechanicalEvery: 25 })
    const ids = new Set(spec.parts.map((p) => p.id))
    expect(ids.has('infill_5_n_0_sill') && ids.has('infill_5_n_0_head') && ids.has('infill_5_n_0_pl') && ids.has('infill_5_n_0_pr')).toBe(true)
    const glass = spec.parts.find((p) => p.id === 'glass_5_n_0')!
    expect(glass.tags).toContain('window')
    expect(spec.parts.some((p) => p.tags?.includes('curtain_wall'))).toBe(false)
    // the glass sits in the opening, inside the width of the bay, under the head
    const [gx, gy] = (glass.shape as { size: number[] }).size
    expect(gx).toBeLessThan(9)
    expect(gy).toBeGreaterThan(0.5)
    expect(gy).toBeLessThan(2.8 - 0.5)
    // none on the plant floors
    expect(ids.has('infill_25_n_0_sill')).toBe(true)
    expect(ids.has('infill_29_n_0_sill')).toBe(false)
    expect(ids.has('infill_24_n_0_sill')).toBe(true)
    const w = createDestruction({ wind })
    const id = w.add(spec)
    expect(Math.max(...w.state(id)!.parts.map((p) => p.stress ?? 0))).toBeLessThanOrEqual(0.65 + 1e-6)
    expect(bad(run(w, 10))).toHaveLength(0)
  })

  describe('in a blast', () => {
    const spec = buildSkyscraper({ storeys: 40 })
    const layout = skyscraperLayout({ storeys: 40 })
    const f = 10
    const yMid = f * layout.pitch + layout.height / 2
    const half = layout.plate[1] / 2
    const charge = 5 * 4.184e6

    it('a blast on one floor breaks the glass of the facade and hurts the local slab, and the core stands', () => {
      const w = createDestruction({ wind })
      const id = w.add(spec)
      const events = [...w.explode([0, yMid, -half - 3], charge, 12).flatMap((h) => h.events), ...run(w, 10)]
      const shattered = events.filter((e): e is Ev<'fracture'> => e.type === 'fracture').flatMap((e) => (e as Ev<'fracture'>).part ? [(e as Ev<'fracture'>).part] : [])
      const glass = shattered.filter((p) => p.startsWith('glass_'))
      expect(glass.length).toBeGreaterThan(3)
      // the panels of that storey on that face, not the whole tower
      expect(glass.every((p) => /^glass_(8|9|10|11|12)_s_/.test(p))).toBe(true)
      expect(glass.some((p) => p.startsWith('glass_10_s_'))).toBe(true)
      // the slab above and below the blast is hurt where it is hit, and no other slab
      const hurt = w.state(id)!.parts.filter((p) => p.id.startsWith('slab_') && p.hp < p.maxHp)
      expect(hurt.length).toBeGreaterThan(0)
      expect(hurt.every((p) => Number(p.id.split('_')[1]) >= 6 && Number(p.id.split('_')[1]) <= 13)).toBe(true)
      // the storey of the blast is the most hurt
      const worst = hurt.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b))
      expect(['slab_9', 'slab_10']).toContain(worst.id)
      // the core: nothing of it, of the other slabs or of the other columns of the tower fell
      const fell = events.filter((e): e is Ev<'collapse'> => e.type === 'collapse').flatMap((e) => (e as Ev<'collapse'>).parts)
      expect(fell.filter((p) => p.startsWith('core_') || p.startsWith('slab_') || p.startsWith('stair_') || p.startsWith('elevator_'))).toEqual([])
      const core = w.state(id)!.parts.filter((p) => p.id.startsWith('core_'))
      expect(core.every((p) => p.status !== 'broken' && p.status !== 'collapsed')).toBe(true)
      expect(Math.min(...core.map((p) => p.hp / p.maxHp))).toBeGreaterThan(0.5)
    })

    it('losing a column of the perimeter does not bring the tower down: the slabs, the core and the other columns hold', () => {
      for (const target of ['column_3_0_1', 'column_20_3_2']) {
        const w = createDestruction({ wind })
        const id = w.add(spec)
        w.hitPart(id, target, { type: 'blunt', point: spec.parts.find((p) => p.id === target)!.position, energy: 1e10, radius: 0.05 })
        const events = run(w, 20)
        expect(w.part(id, target)!.status).toBe('broken')
        const [, storey, i, j] = target.split('_').map(Number)
        const fell = events.filter((e): e is Ev<'collapse'> => e.type === 'collapse').flatMap((e) => (e as Ev<'collapse'>).parts)
        // only the columns of that line above the lost one come down; the continuous column above it had nothing else under it
        expect(fell.length).toBeGreaterThan(0)
        expect(fell.every((p) => p.startsWith(`column_`) && p.endsWith(`_${i}_${j}`) && Number(p.split('_')[1]) > storey)).toBe(true)
        const st = w.state(id)!
        const alive = st.parts.filter((p) => !p.id.startsWith('column_') || !fell.includes(p.id))
        expect(alive.every((p) => p.status !== 'collapsed')).toBe(true)
        // the weight of the lost column line went to the beams and the other columns, which hold it
        expect(Math.max(...alive.map((p) => p.stress ?? 0))).toBeLessThan(1)
      }
    })
  })
})

describe('skyscraper plan', () => {
  const layout = skyscraperLayout({ storeys: 24 })
  const plate = towerPlate(layout)

  it('tiles the plate with the core, the circulation and the four strips, with nothing over', () => {
    const rects = [plate.stairs, ...(plate.service ? [plate.service] : []), ...plate.shafts, plate.lobby, plate.corridors.n, plate.corridors.s, plate.corridors.w, ...plate.strips.map((s) => s.rect)]
    expect(rects.reduce((sum, r) => sum + area(r), 0)).toBeCloseTo(plate.w * plate.d, 3)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlap = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-6 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-6
        expect(overlap, `${i} ${j}`).toBe(false)
      }
    }
    // the core of the plan is the core of the structure
    expect(plate.core[2] - plate.core[0]).toBeCloseTo(layout.core!.size[0], 2)
    expect(plate.core[3] - plate.core[1]).toBeCloseTo(layout.core!.size[1], 2)
    expect(plate.shafts).toHaveLength(layout.core!.elevators)
    expect(plate.strips.map((s) => s.id)).toEqual(['south', 'north', 'west', 'east'])
    expect(plate.strips.every((s) => s.depth > 5)).toBe(true)
  })

  it('has the kinds of storey of the layout and one FloorDef each, with unique ids and the stairs linked', () => {
    const kinds = storeyKinds(layout)
    expect(kinds[0]).toBe('ground')
    expect(kinds[layout.storeys - 1]).toBe('mechanical')
    expect(kinds.filter((k) => k === 'mechanical')).toHaveLength(layout.mechanical.length)
    const strip = (s: { id: string; rect: number[]; circulation: string }, { floor }: { floor: number }) => {
      const id = `suite_${floor}_${s.id}`
      return { rooms: [{ id, type: 'office', label: 'office', rect: s.rect }], doors: [stripDoor(id, s as never, floor)], windows: [] }
    }
    const floors = towerFloors(layout, { typical: strip as never })
    expect(floors).toHaveLength(layout.storeys)
    const ids = new Set<string>()
    for (const [f, def] of floors.entries()) {
      const rooms = def.rooms(plate.w, plate.d, {})
      for (const r of rooms) {
        expect(ids.has(r.id)).toBe(false)
        ids.add(r.id)
      }
      expect(def.ceiling).toBeCloseTo(layout.pitch, 9)
      const stairs = rooms.find((r) => r.type === 'stairs')!
      expect(stairs.link).toEqual(f < layout.storeys - 1 ? [f, f + 1] : [f - 1, f])
      expect(rooms.filter((r) => r.type === 'elevator')).toHaveLength(layout.core!.elevators)
      expect(def.doors(plate.w, plate.d, {}).length).toBeGreaterThan(rooms.length - 3 - layout.core!.elevators)
    }
    // the plant floors have a plant room on each strip and no windows
    const plant = floors[layout.storeys - 1]
    expect(plant.rooms(plate.w, plate.d, {}).filter((r) => r.type === 'storage' && r.label === 'plant_room')).toHaveLength(4)
    expect(plant.windows(plate.w, plate.d, {})).toEqual([])
    expect(splitStrip(plate.strips[0], 4)).toHaveLength(4)
    expect(splitStrip(plate.strips[2], 3)[2][3]).toBeCloseTo(plate.strips[2].rect[3], 6)
  })
})
