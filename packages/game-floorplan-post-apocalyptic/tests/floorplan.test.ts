/**
 * Property suite for the whole floor plan stack (a port of the old `teste.mjs`).
 * Default: 25 seeds per variant and per state. FULL=1 runs the original 200.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { FULL, N, STATES, checkPlan, createFailures, engine, sizes, variants } from './support'

// The suite is CPU-bound and synchronous; yield a macrotask between tests so the worker can report progress.
afterEach(() => new Promise<void>((r) => setTimeout(r, 0)))

const FILTER = process.env.TPL ? new RegExp(process.env.TPL) : null

describe('generated plans (seeds x states x variants)', () => {
  for (const [name, id, extra] of variants()) {
    if (FILTER && !FILTER.test(name)) continue
    const seen = new Set<string>()
    for (const state of STATES) {
      it(`${name}/${state}: ${N} seeds hold every property`, () => {
        const F = createFailures()
        for (let s = 1; s <= N; s++) {
          const opts: Record<string, unknown> = { seed: s, state, ...extra }
          Object.assign(opts, sizes(id, s, opts))
          let res: any
          try {
            res = engine.generate(id, opts)
          } catch (e) {
            F.add('exception', `${name}#${s}: ${(e as Error).message}`)
            continue
          }
          checkPlan(name, res, s, seen, F)
          if (s <= 2 && state === 'fortified') {
            if (JSON.stringify(engine.generate(id, opts)) !== JSON.stringify(res)) F.add('determinism', `${name}#${s}`)
            const errs = engine.validate(res)
            if (errs.length) F.add('validate()', `${name}#${s} ${errs[0]}`)
          }
        }
        expect(F.report()).toEqual([])
      })
    }
    it(`${name}: layouts vary across seeds`, () => {
      // Runs after the three state tests above, which fill `seen`.
      expect(seen.size).toBeGreaterThanOrEqual(Math.min(50, N * 0.9))
    })
  }
})

describe('default state distribution (about 35/45/20)', () => {
  // The state is drawn from the seed alone, so the default run checks one cheap template;
  // FULL=1 checks every variant as the old suite did.
  const subjects = FULL ? variants().filter(([n]) => !FILTER || FILTER.test(n)) : variants().filter(([n]) => n === 'single_storey_a' || n === 'market')
  for (const [name, id, extra] of subjects) {
    it(`${name}`, () => {
      const count: Record<string, number> = { fortified: 0, abandoned: 0, normal: 0 }
      for (let s = 1; s <= 600; s++) count[engine.generate(id, { seed: s, ...extra, w: undefined }).state]++
      expect(count.fortified, JSON.stringify(count)).toBeGreaterThanOrEqual(120)
      expect(count.fortified, JSON.stringify(count)).toBeLessThanOrEqual(300)
      expect(count.abandoned, JSON.stringify(count)).toBeGreaterThanOrEqual(190)
      expect(count.abandoned, JSON.stringify(count)).toBeLessThanOrEqual(350)
      expect(count.normal, JSON.stringify(count)).toBeGreaterThanOrEqual(60)
      expect(count.normal, JSON.stringify(count)).toBeLessThanOrEqual(180)
    })
  }
})

describe('density by class', () => {
  const avg = (id: string) => {
    let decor = 0
    let outdoor = 0
    for (let s = 1; s <= 40; s++) {
      const r = engine.generate(id, { seed: s, state: 'normal' })
      decor += r.items.filter((m: any) => m.decor && m.category !== 'ground_cover').length
      outdoor += r.items.filter((m: any) => m.outdoor && m.category !== 'ground_cover' && !m.decor).length
    }
    return [decor / 40, outdoor / 40]
  }
  it('decoration grows from budget to mid to high, and yards are not bare', () => {
    const pop = avg('budget_semi_detached')
    const mid = avg('mid_modern_single_storey')
    const high = avg('high_end_contemporary')
    expect(pop[0]).toBeLessThan(mid[0])
    expect(mid[0]).toBeLessThan(high[0])
    expect(mid[1]).toBeGreaterThanOrEqual(8)
    expect(high[1]).toBeGreaterThanOrEqual(12)
  })
})

describe('template specifics', () => {
  it('single_storey_a has the four rooms and its recorded slots', () => {
    const r = engine.generate('single_storey_a', { w: 11, d: 11, seed: 5 })
    expect(r.rooms.map((c: any) => c.id).sort().join()).toBe('bathroom,bedroom,kitchen,living')
    const slots = engine.slots('single_storey_a', { w: 11, d: 11 }).filter((s: any) => s.valid && !s.outdoor).map((s: any) => s.room + '.' + s.id)
    const wanted = ['living.tv_unit_right', 'living.sofa_right', 'living.table_right', 'living.rug_right', 'living.armchair', 'living.shelf', 'living.counter', 'kitchen.fridge', 'kitchen.stove', 'kitchen.sink', 'kitchen.table', 'bedroom.bed', 'bedroom.nightstand_left', 'bedroom.wardrobe', 'bathroom.toilet', 'bathroom.washbasin', 'bathroom.shower']
    for (const k of wanted) expect(slots.some((x: string) => x === k || x.startsWith(k + '@')), k).toBe(true)
  })

  it('townhouse has two floors, linked stairs and a balcony', () => {
    const r = engine.generate('townhouse', { seed: 3 })
    expect(r.floors.length).toBe(2)
    const stairs = r.items.filter((m: any) => m.type === 'stairs')
    expect(stairs.length).toBe(2)
    expect(stairs[0].floor).not.toBe(stairs[1].floor)
    expect(stairs[0].link).toBeTruthy()
    expect(r.rooms.some((c: any) => c.type === 'balcony' && c.floor === 1)).toBe(true)
    expect(r.facade.balcony).toBeTruthy()
  })

  it('styles: the luxury alias resolves to high, and budget houses stay modest', () => {
    const n = engine.generate('mansion', { seed: 1 })
    const p = engine.generate('mansion', { seed: 1, style: 'budget' })
    const c = engine.generate('single_storey_a', { seed: 1, style: 'luxury' })
    expect(n.style).toBe('high')
    expect(c.style).toBe('high')
    expect(n.lot.perimeter.some((s: any) => s.type === 'wall' && s.height >= 2.5)).toBe(true)
    expect(p.lot.perimeter.every((s: any) => s.height <= 2.0)).toBe(true)
    expect(p.lot.pool).toBeTruthy()
    expect(c.lot.perimeter.some((s: any) => s.height >= 2.5)).toBe(true)
  })

  it('commercial: the market has no garden, a steel door and a cargo gate', () => {
    const m = engine.generate('market', { seed: 1 })
    expect(m.lot.zones.some((z: any) => z.type === 'garden')).toBe(false)
    expect(m.facade.steelDoor).toBeTruthy()
    expect(m.doors.some((p: any) => p.model === 'steel' && p.exterior)).toBe(true)
    expect(m.lot.gates.some((g: any) => g.type === 'cargo')).toBe(true)
  })

  it('only the mansion and high-end houses must have a pool', () => {
    for (const id of ['single_storey_a', 'townhouse', 'market', 'pharmacy', 'budget_slab_house', 'budget_semi_detached', 'mid_modern_single_storey', 'mid_modern_townhouse']) {
      const r = engine.generate(id, { seed: 1 })
      expect(r.lot && r.lot.pool, id).toBeFalsy()
    }
  })

  it('apartments have no lot; apartment_modern describes the building', () => {
    for (const id of ['apartment_basic', 'apartment_modern']) expect(engine.generate(id, { seed: 1 }).lot, id).toBeNull()
    const high = engine.generate('apartment_modern', { seed: 1, tier: 'high', locale: 'pt-BR' })
    const b = high.building
    expect(b && b.elevator && b.stairs && b.hall && b.unitsPerFloor && b.floors).toBeTruthy()
    expect(engine.generate('apartment_modern', { seed: 1 }).style).toBe('mid')
    expect(high.style).toBe('high')
    expect(high.rooms.some((c: any) => c.name.includes('Varanda gourmet'))).toBe(true)
    expect(high.rooms.filter((c: any) => c.type === 'bedroom' && c.name.startsWith('Suíte')).length).toBe(3)
    expect(high.rooms.some((c: any) => c.name === 'Dependência')).toBe(true)
  })

  it('mansion has three floors and a terrace by default', () => {
    const ma = engine.generate('mansion', { seed: 2 })
    expect(ma.floors.length).toBe(3)
    expect(ma.rooms.some((c: any) => c.type === 'terrace')).toBe(true)
  })

  it('high_end_contemporary program: closet, spa, sauna, soaking tub, two cars, double-height living', () => {
    const al = engine.generate('high_end_contemporary', { seed: 2 })
    expect(al.floors.length).toBe(2)
    expect(al.rooms.filter((c: any) => c.type === 'bedroom').length).toBeGreaterThanOrEqual(4)
    expect(al.rooms.some((c: any) => c.type === 'closet')).toBe(true)
    expect(al.rooms.some((c: any) => c.type === 'spa')).toBe(true)
    expect(al.items.some((m: any) => m.type === 'sauna')).toBe(true)
    expect(al.items.some((m: any) => m.type === 'soaking_tub')).toBe(true)
    expect(al.items.filter((m: any) => m.category === 'car').length).toBeGreaterThanOrEqual(2)
    expect(al.rooms.find((c: any) => c.type === 'living' && c.id === 'living').ceiling).toBeGreaterThanOrEqual(5)
  })
})

describe('colour palettes', () => {
  const C = engine.color as any
  const L = C.lstar as (c: number) => number
  const ROLES = ['facade', 'facade_detail', 'wall', 'gate', 'roof', 'ceiling', 'wood', 'fabric_main', 'fabric_accent', 'metal', 'picture_accent', 'exterior_floor']
  for (const style of ['budget', 'mid', 'high', 'commercial']) {
    it(`${style}: valid, contrasted, varied, deterministic and desaturated when abandoned`, () => {
      const F = createFailures()
      const seen = new Set<string>()
      for (const state of STATES) {
        for (let s = 1; s <= N; s++) {
          const p = engine.palette({ seed: s, style, state }) as Record<string, any>
          const tag = `${style}/${state}#${s}`
          const keys = Object.keys(p).filter((k) => k !== 'meta')
          for (const k of keys) if (!Number.isInteger(p[k]) || p[k] < 0 || p[k] > 0xffffff) F.add('invalid colour', tag + k)
          for (const k of ROLES) if (p[k] == null) F.add('missing role', tag + k)
          const rooms = keys.filter((k) => k.startsWith('wall_')).map((k) => k.slice(5))
          for (const c of rooms) {
            const w = p['wall_' + c]
            const f = p['floor_' + c]
            if (f == null) { F.add('missing floor colour', tag + c); continue }
            if (Math.abs(L(w) - L(f)) < C.MIN_WALL_FLOOR_CONTRAST) F.add('wall x floor contrast', tag + c)
            if (Math.abs(L(p.fabric_main) - L(f)) < C.MIN_FABRIC_FLOOR_CONTRAST) F.add('fabric x floor contrast', tag + c)
            const hw = C.hsl(w), hf = C.hsl(f), ha = C.hsl(p.fabric_accent), hq = C.hsl(p.picture_accent), S = C.HIGH_SATURATION
            if (hw.s > S && hf.s > S) F.add('saturated wall on a saturated floor', tag + c)
            if ((hw.s > S ? 1 : 0) + (ha.s > S ? 1 : 0) + (hq.s > S ? 1 : 0) > 1) F.add('more than one saturated accent in a room', tag + c)
          }
          seen.add(JSON.stringify(p))
        }
      }
      if (seen.size < N * 3 * 0.95) F.add('repeated palettes', `${style} ${seen.size}/${N * 3}`)
      const a = engine.palette({ seed: 7, style, state: 'abandoned' }) as any
      const n = engine.palette({ seed: 7, style, state: 'normal' }) as any
      if (!(C.hsl(a.facade).s <= C.hsl(n.facade).s + 1e-9 && L(a.facade) <= L(n.facade) + 1e-9)) F.add('abandoned is not desaturated and darker', style)
      if (JSON.stringify(engine.palette({ seed: 9, style, state: 'normal' })) !== JSON.stringify(engine.palette({ seed: 9, style, state: 'normal' }))) F.add('palette is not deterministic', style)
      expect(F.report()).toEqual([])
    })
  }
})
