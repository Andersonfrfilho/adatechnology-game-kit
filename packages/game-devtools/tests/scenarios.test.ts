import { describe, expect, it, vi } from 'vitest'
import { createScenarioRunner, type Scenario } from '../src'

interface Rain extends Scenario {
  id: string
  mm: number
}

describe('scenario runner', () => {
  const list: Rain[] = [
    { id: 'drizzle', mm: 1 },
    { id: 'storm', mm: 40 },
  ]

  it('applies a scenario by id and remembers it as active', () => {
    const r = createScenarioRunner<Rain>()
    const applied: number[] = []
    r.set(list, (s) => applied.push(s.mm), () => ({}))
    expect(r.active).toBeNull()
    expect(r.run('storm')).toBe(true)
    expect(applied).toEqual([40])
    expect(r.active?.id).toBe('storm')
    expect(r.list).toBe(list)
  })

  it('returns false and changes nothing for an unknown id', () => {
    const r = createScenarioRunner<Rain>()
    const apply = vi.fn()
    r.set(list, apply, () => ({}))
    r.run('drizzle')
    expect(r.run('hail')).toBe(false)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(r.active?.id).toBe('drizzle')
  })

  it('checks by id, falls back to the active scenario, and returns {} when there is none', () => {
    const r = createScenarioRunner<Rain>()
    const check = vi.fn((s: Rain) => ({ wet: { ok: s.mm > 10, note: `${s.mm} mm` } }))
    r.set(list, () => {}, check)
    expect(r.check()).toEqual({})
    expect(r.check('storm')).toEqual({ wet: { ok: true, note: '40 mm' } })
    expect(r.check('drizzle').wet.ok).toBe(false)
    r.run('storm')
    expect(r.check().wet.note).toBe('40 mm')
    expect(r.check('unknown').wet.note).toBe('40 mm') // unknown id falls back to the active scenario
  })

  it('replaces the previous registration', () => {
    const r = createScenarioRunner<Rain>()
    r.set(list, () => {}, () => ({}))
    r.set([{ id: 'only', mm: 0 }], () => {}, () => ({}))
    expect(r.run('storm')).toBe(false)
    expect(r.run('only')).toBe(true)
  })
})
