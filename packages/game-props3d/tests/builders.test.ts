import { describe, expect, it, vi } from 'vitest'
import { create, createRecorder, locales, TYPE_DEFS, type PropItem, type PropType } from '../src'
import { footprintOf, itemFor, stubDocument } from './helpers'

const props = create(undefined, { document: stubDocument() })

/**
 * Footprint tolerance in meters. Most props stay within M.w x M.d (+ this much, for trim, foliage and rounding).
 * The ones below overhang on purpose; each entry pins the current overhang (with a little slack) so a regression shows up.
 */
const TOLERANCE = 0.25
const OVERHANG: Partial<Record<PropType, number>> = {
  palm_tree: 1.6, // fronds spread well beyond the trunk
  fallen_chair: 0.8, // a 0.5 m chair lying on its side
  double_bed_modern: 0.6, // wide headboard and the two bedside tables
  bbq_simple: 0.45, // firewood stacked next to it
  pool: 0.4, // coping around the water (0.32 m)
  blood_stains: 0.6, // splatter and drag marks
  barricade: 0.55, // planks leaning out of the footprint
  open_door: 0.8, // the leaf swings open
  slide: 0.95, // ladder and rails
  home_office: 0.7, // chair pulled out in front of the desk
  soaking_tub: 0.65, // step beside the tub
  deck: 0.45, // front step
  ac_condenser: 0.45, // pipes behind the unit
}

describe('catalog', () => {
  it('has a builder for every type and a type for every builder', () => {
    expect([...props.names].sort()).toEqual(TYPE_DEFS.map((t) => t.id).sort())
    expect(props.types.map((t) => t.id).sort()).toEqual([...props.names].sort())
    expect(props.names.length).toBeGreaterThanOrEqual(57)
  })
  it('type ids are English snake_case and groups are known', () => {
    for (const t of props.types) {
      expect(t.id).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(['ceiling', 'wall', 'plants', 'furniture', 'floor', 'yard', 'house_state']).toContain(t.group)
      expect(t.w).toBeGreaterThan(0)
      expect(t.d).toBeGreaterThan(0)
      expect(t.h).toBeGreaterThan(0)
    }
  })
  it('renames follow the migration examples', () => {
    for (const id of ['picture_small', 'wall_ac', 'ac_condenser', 'window_boards', 'sandbags', 'floor_plant', 'lawn', 'pool', 'sauna', 'water_bottle_crates'] as const) {
      expect(props.names).toContain(id)
    }
  })
  it('non-solid items are walls, ceilings, floors and decals', () => {
    for (const t of props.types.filter((t) => !t.solid)) {
      expect(['ceiling', 'wall', 'plants', 'floor', 'yard', 'house_state']).toContain(t.group)
    }
    expect(props.types.find((t) => t.id === 'sofa_l')!.solid).toBe(true)
    expect(props.types.find((t) => t.id === 'lawn')!.solid).toBe(false)
  })
  it('localizes the type names', () => {
    expect(props.types.find((t) => t.id === 'sofa_l')!.name).toBe('L-shaped sofa')
    const pt = create(undefined, { document: stubDocument(), locale: 'pt-BR' })
    expect(pt.types.find((t) => t.id === 'sofa_l')!.name).toBe('Sofá em L')
    expect(pt.types.find((t) => t.id === 'water_bottle_crates')!.name).toBe('Caixas de água mineral')
    expect(Object.keys(locales['pt-BR'].typeNames).sort()).toEqual(Object.keys(locales.en.typeNames).sort())
    expect(pt.atlas('picture').names[5]).toBe('montanhas e lago')
    expect(props.atlas('picture').names).toHaveLength(8)
  })
})

describe.each(TYPE_DEFS.map((t) => [t.id, t] as const))('builder %s', (id, def) => {
  const run = (item: PropItem) => {
    const { api, primitives } = createRecorder()
    props.builders[id](item, api)
    return primitives
  }

  it('runs against a recording api without throwing and emits at least one primitive', () => {
    const prims = run(itemFor(def.w, def.d, def.h))
    expect(prims.length).toBeGreaterThan(0)
    for (const p of prims) {
      if (p.kind === 'light') continue
      for (const v of Object.values(p)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('works with no size, no seed and no palette (type defaults)', () => {
    expect(run({}).length).toBeGreaterThan(0)
  })

  it('respects M.w x M.d within tolerance', () => {
    const f = footprintOf(run(itemFor(def.w, def.d, def.h)))
    const tol = OVERHANG[id] ?? TOLERANCE
    expect(f.x[0]).toBeGreaterThanOrEqual(-def.w / 2 - tol)
    expect(f.x[1]).toBeLessThanOrEqual(def.w / 2 + tol)
    expect(f.z[0]).toBeGreaterThanOrEqual(-def.d / 2 - tol)
    expect(f.z[1]).toBeLessThanOrEqual(def.d / 2 + tol)
  })

  it('is deterministic for the same seed', () => {
    const a = JSON.stringify(run(itemFor(def.w, def.d, def.h, { seed: 42 })))
    const b = JSON.stringify(run(itemFor(def.w, def.d, def.h, { seed: 42 })))
    expect(a).toBe(b)
  })

  it('only uses known materials and valid colors', () => {
    for (const p of run(itemFor(def.w, def.d, def.h, { on: true, light: true }))) {
      if ('material' in p) expect(props.materials).toContain(p.material)
      expect(p.kind === 'light' || Number.isInteger((p as { color: number }).color)).toBe(true)
    }
  })
})

describe('item fields', () => {
  const draw = (id: PropType, M: PropItem) => {
    const { api, primitives } = createRecorder()
    props.builders[id](M, api)
    return primitives
  }

  it('M.color wins over the palette, the palette over the default', () => {
    const colors = (M: PropItem) => new Set(draw('pendant', M).map((p) => ('color' in p ? p.color : -1)))
    expect(colors({ color: 0x123456 }).has(0x123456)).toBe(true)
    expect(colors({ color: '#123456' }).has(0x123456)).toBe(true)
    const wood = (M: PropItem) => new Set(draw('home_office', M).map((p) => ('color' in p ? p.color : -1)))
    expect(wood({ palette: { wood: 0x00ff00 } }).has(0x00ff00)).toBe(true)
    expect(wood({}).has(0x00ff00)).toBe(false)
  })

  it('ceiling lights follow M.ceiling and light up with M.on', () => {
    const top = (M: PropItem) => Math.max(...draw('ceiling_light', M).map((p) => ('y' in p ? p.y : 0)))
    expect(top({ ceiling: 3.5 })).toBeGreaterThan(top({ ceiling: 2.6 }) + 0.8)
    expect(draw('ceiling_light', { on: true }).some((p) => p.kind === 'light')).toBe(true)
    expect(draw('ceiling_light', {}).some((p) => p.kind === 'light')).toBe(false)
    expect(draw('ceiling_light', { on: true }).some((p) => 'material' in p && p.material === 'emissive')).toBe(true)
  })

  it('different seeds give different details; the same seed gives the same', () => {
    const a = JSON.stringify(draw('floor_plant', { seed: 1 }))
    expect(JSON.stringify(draw('floor_plant', { seed: 2 }))).not.toBe(a)
    expect(JSON.stringify(draw('floor_plant', { seed: 1 }))).toBe(a)
    expect(JSON.stringify(draw('floor_plant', { seed: '1' }))).toBe(JSON.stringify(draw('floor_plant', { seed: '1' })))
  })

  it('variants: blinds use wood, window boards can cross', () => {
    expect(draw('blinds', { variant: 'wood' }).some((p) => 'material' in p && p.material === 'wood')).toBe(true)
    expect(draw('blinds', {}).some((p) => 'material' in p && p.material === 'wood')).toBe(false)
    expect(draw('window_boards', { variant: 'x' }).length).not.toBe(draw('window_boards', { variant: 'h' }).length)
  })

  it('falls back to emit("light") when the api has no light()', () => {
    const emit = vi.fn()
    const p = create(undefined, { document: stubDocument(), emit })
    const { api } = createRecorder({ light: false })
    p.builders.lantern({ seed: 1 }, api)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit.mock.calls[0][0]).toBe('light')
    expect(emit.mock.calls[0][1]).toMatchObject({ kind: 'lantern', range: 7 })
    emit.mockClear()
    p.builders.lantern({ seed: 1, lit: false }, api)
    expect(emit).not.toHaveBeenCalled()
  })

  it('uses api.light() when it exists, instead of emit', () => {
    const emit = vi.fn()
    const p = create(undefined, { document: stubDocument(), emit })
    const { api, primitives } = createRecorder()
    p.builders.candles({}, api)
    expect(emit).not.toHaveBeenCalled()
    expect(primitives.some((q) => q.kind === 'light')).toBe(true)
  })
})

describe('atlases and cover()', () => {
  it('builds each atlas once and caches it', () => {
    const f = props.atlas('floor')
    expect(props.atlas('floor')).toBe(f)
    expect(props.atlas('picture').n).toBe(7)
    expect(props.atlas('water').canvas).toBeTruthy()
    expect(f.variants('lawn')).toBe(2)
    expect(f.size('tile_floor')).toBe(1)
    for (const k of ['lawn', 'tile_floor', 'concrete', 'deck_floor', 'dirt', 'pool_tile', 'paving'] as const) {
      const uv = f.uv(k)
      expect(uv.u0).toBeGreaterThanOrEqual(0)
      expect(uv.u1).toBeLessThanOrEqual(1)
      expect(uv.v0).toBeGreaterThanOrEqual(0)
      expect(uv.v1).toBeLessThanOrEqual(1)
      expect(uv.u1).toBeGreaterThan(uv.u0)
    }
  })

  it('covers a rectangle with flat atlas planes inside it', () => {
    const { api, primitives } = createRecorder()
    props.cover(api, { w: 3.5, d: 2 }, 'concrete')
    expect(primitives.length).toBeGreaterThan(0)
    let area = 0
    for (const p of primitives) {
      expect(p.kind).toBe('plane')
      if (p.kind !== 'plane') continue
      expect(p.material).toBe('atlas_floor')
      expect(p.rx).toBeCloseTo(-Math.PI / 2, 9)
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(-1.75 - 1e-9)
      expect(p.x + p.w / 2).toBeLessThanOrEqual(1.75 + 1e-9)
      expect(p.z - p.h / 2).toBeGreaterThanOrEqual(-1 - 1e-9)
      expect(p.z + p.h / 2).toBeLessThanOrEqual(1 + 1e-9)
      area += p.w * p.h
    }
    expect(area).toBeCloseTo(3.5 * 2, 6)
  })

  it('covers a polygon with quarter-size cells, only inside it', () => {
    const { api, primitives } = createRecorder()
    const poly: Array<[number, number]> = [[0, 0], [4, 0], [4, 2], [0, 2]]
    props.cover(api, {}, 'lawn', { poly })
    expect(primitives.length).toBeGreaterThan(0)
    for (const p of primitives) {
      if (p.kind !== 'plane') throw new Error('expected planes')
      expect(p.w).toBeCloseTo(0.5, 9) // lawn cell 2 m / 4
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(4)
      expect(p.z).toBeGreaterThan(0)
      expect(p.z).toBeLessThan(2)
    }
    expect(primitives.length).toBe(4 * 8)
  })

  it('throws a clear error when there is no document to draw atlases on', () => {
    const noDoc = create(undefined, { document: undefined })
    // in the node test environment there is no global document either
    if (typeof document === 'undefined') expect(() => noDoc.atlas('floor')).toThrow(/document/)
  })
})
