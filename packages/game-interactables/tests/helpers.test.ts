import { describe, expect, it } from 'vitest'
import { fitsSize, format, generateLoot, localToWorld, pickLocale, poseOf, resolveStrings, rng, rotateAxis, worldToLocal } from '../src'
import type { ItemCatalog, LootTables, SlotSpec } from '../src'

const items: ItemCatalog = {
  can: { id: 'can', category: 'food', size: [0.07, 0.11, 0.07], weight: 0.4, stack: 6 },
  box: { id: 'box', category: 'food', size: [0.3, 0.3, 0.2], weight: 1 },
  tall: { id: 'tall', category: 'drink', size: [0.1, 0.4, 0.1], weight: 1 },
}
const tables: LootTables = {
  pantry: { fill: 1, entries: [{ type: 'can', weight: 3, qty: [1, 4] }, { type: 'box', weight: 1 }, { type: 'tall', weight: 1 }] },
  none: { fill: 0, entries: [{ type: 'can', weight: 1 }] },
}
const slots: SlotSpec[] = Array.from({ length: 12 }, (_, i) => ({ pos: [i * 0.1, 0, 0], max: [0.35, 0.5, 0.35] }))

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = rng('seed')
    const b = rng('seed')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(rng(1)()).not.toBe(rng(2)())
  })
  it('stays in [0, 1)', () => {
    const r = rng(7)
    for (let i = 0; i < 500; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('math', () => {
  it('localToWorld and worldToLocal are inverse', () => {
    const tr = { x: 3, y: 1, z: -2, ry: 0.7 }
    const w = localToWorld(tr, [1, 0.5, 2])
    const l = worldToLocal(tr, w)
    expect(l[0]).toBeCloseTo(1)
    expect(l[1]).toBeCloseTo(0.5)
    expect(l[2]).toBeCloseTo(2)
  })
  it('rotates +z to +x with ry = pi/2', () => {
    const w = localToWorld({ x: 0, y: 0, z: 0, ry: Math.PI / 2 }, [0, 0, 1])
    expect(w[0]).toBeCloseTo(1)
    expect(w[2]).toBeCloseTo(0)
  })
  it('poseOf hinge rotates, slide translates, scale scales', () => {
    const h = poseOf({ kind: 'hinge', angle: 2 }, 0.5)
    expect(h.rotation.angle).toBeCloseTo(1)
    expect(h.rotation.axis).toEqual([0, 1, 0])
    const s = poseOf({ kind: 'slide', axis: [0, 0, 1], distance: 0.4 }, 0.5)
    expect(s.position).toEqual([0, 0, 0.2])
    const k = poseOf({ kind: 'scale', axis: [0, 1, 0], scale: 0.2 }, 1)
    expect(k.scale[1]).toBeCloseTo(0.2)
    expect(k.scale[0]).toBe(1)
    expect(poseOf({ kind: 'knob', angle: 3 }, 2).rotation.angle).toBeCloseTo(3)
  })
  it('rotateAxis matches a quarter turn', () => {
    const v = rotateAxis([1, 0, 0], [0, 0, 1], Math.PI / 2)
    expect(v[1]).toBeCloseTo(1)
  })
})

describe('locale', () => {
  it('has en and pt-BR with the same engine keys', () => {
    const en = resolveStrings('en')
    const pt = resolveStrings('pt-BR')
    for (const k of ['prompt.open', 'prompt.take', 'prompt.sit', 'prompt.lie_down', 'prompt.get_up', 'prompt.light', 'no_power', 'no_gas', 'no_water', 'locked', 'empty', 'full']) {
      expect(en[k]).toBeTruthy()
      expect(pt[k]).toBeTruthy()
    }
    expect(pt.no_power).not.toBe(en.no_power)
  })
  it('merges extra strings and falls back to en', () => {
    const s = resolveStrings('pt-BR', { en: { 'prompt.door': 'Door', only_en: 'x' }, 'pt-BR': { 'prompt.door': 'Porta' } })
    expect(s['prompt.door']).toBe('Porta')
    expect(s.only_en).toBe('x')
    expect(resolveStrings('xx')['no_power']).toBe('No power')
    expect(pickLocale('pt')).toBe('pt-BR')
  })
  it('format fills placeholders', () => {
    expect(format('Open {name}', { name: 'door' })).toBe('Open door')
    expect(format('{a}{b}', { a: 1 })).toBe('1{b}')
  })
})

describe('loot', () => {
  it('is deterministic for the same seed and differs for another', () => {
    const a = generateLoot(tables, 'pantry', slots, 'obj|c1', items)
    const b = generateLoot(tables, 'pantry', slots, 'obj|c1', items)
    const c = generateLoot(tables, 'pantry', slots, 'obj|c2', items)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })
  it('respects fill 0, unknown tables and slot size', () => {
    expect(generateLoot(tables, 'none', slots, 1, items).every((s) => s === null)).toBe(true)
    expect(generateLoot(tables, 'missing', slots, 1, items)).toHaveLength(12)
    const small: SlotSpec[] = Array.from({ length: 30 }, () => ({ pos: [0, 0, 0], max: [0.1, 0.15, 0.1] }))
    const out = generateLoot(tables, 'pantry', small, 3, items)
    expect(out.every((s) => s === null || s.type === 'can')).toBe(true)
    expect(out.some((s) => s?.type === 'can')).toBe(true)
  })
  it('clamps quantity to the stack size', () => {
    const out = generateLoot({ t: { fill: 1, entries: [{ type: 'box', weight: 1, qty: [5, 9] }] } }, 't', slots, 1, items)
    expect(out.every((s) => s?.qty === 1)).toBe(true)
  })
  it('fitsSize allows turning the item', () => {
    expect(fitsSize([0.3, 0.1, 0.1], [0.1, 0.2, 0.3])).toBe(true)
    expect(fitsSize([0.3, 0.1, 0.3], [0.1, 0.2, 0.3])).toBe(false)
    expect(fitsSize([0.1, 0.3, 0.1], [0.5, 0.2, 0.5])).toBe(false)
  })
})
