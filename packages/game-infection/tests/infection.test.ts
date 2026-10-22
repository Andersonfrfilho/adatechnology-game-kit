// Headless test of the infection model: determinism, save/load, the Valley curve and cost per step.
// Port of the original contagio teste.mjs; the fixture is the ZombiAdA "Valley" data translated to the English schema.
import { describe, expect, it } from 'vitest'
import { create, STAGES, type InfectionConfig, type InfectionEvent } from '../src'
import valley from './fixtures/valley-outbreak.json'

const data = valley as unknown as InfectionConfig & { events: InfectionEvent[] }
const fresh = (extra: Partial<InfectionConfig> = {}) =>
  create({ ...data, ...extra, events: data.events.concat(extra.events || []) })
const zombies = (c: ReturnType<typeof create>) => c.total('active') + c.total('contained')
const atEndOfDay = (c: ReturnType<typeof create>, day: number) => {
  c.advance((day + 1) * 24 - c.hour())
  return zombies(c)
}

describe('Valley curve (targets from the design page, default transmission)', () => {
  const targets: Record<number, number> = { 0: 190, 1: 1631, 3: 4897, 7: 17929, 30: 37124 }
  const c = fresh()
  const phases: string[] = []
  c.on('phase', (f) => phases.push(f.id + '@' + Math.floor(f.hour / 24)))
  const counts: Record<number, number> = {}
  for (const d of Object.keys(targets)) counts[+d] = atEndOfDay(c, +d)

  for (const [d, v] of Object.entries(targets)) {
    it(`D${d}: about ${v} zombies (within 5%)`, () => {
      expect(Math.abs(counts[+d] - v) / v).toBeLessThan(0.05)
    })
  }
  it('enters the phases in order and on the expected days', () => {
    expect(phases.join(' ')).toBe('cases@-4 alert@-2 rupture@0 collapse@1 blackout@8')
  })
  it('some people leave the valley', () => {
    const left = Math.round(c.total('departed'))
    expect(left).toBeGreaterThan(300)
    expect(left).toBeLessThan(500)
  })
})

describe('determinism and save/load', () => {
  it('saving halfway and loading gives the same state as running straight through', () => {
    const a = fresh().advance(200)
    const b = fresh().advance(100)
    const saved = b.save()
    const b2 = fresh().load(saved).advance(100)
    expect(a.save()).toBe(b2.save())
  })
  it('accepts the parsed object as well as the string', () => {
    const a = fresh().advance(120)
    const b = fresh().load(JSON.parse(a.save()))
    expect(b.save()).toBe(a.save())
  })
})

describe('player actions', () => {
  it('warning the Garden district delays its fall', () => {
    const fallDay = (warn: boolean) => {
      const m = fresh(
        warn ? { events: [{ id: 'warning', hour: -39, action: 'warn', region: 'garden', level: 0.8, guard: 0.25 }] } : {},
      )
      let day: number | null = null
      m.on('stage', (e) => {
        if (e.region === 'garden' && e.to === 'fallen' && day === null) day = Math.floor((e.hour - 1) / 24)
      })
      m.advance(31 * 24 + 144)
      return day as number | null
    }
    const d0 = fallDay(false)
    const d1 = fallDay(true)
    expect(d0).not.toBeNull()
    expect(d1).not.toBeNull()
    expect(d1!).toBeGreaterThan(d0!)
  })

  it('materialize takes from the abstract number and giveBack restores it', () => {
    const m = fresh()
    m.advance(144 + 3 * 24)
    const before = zombies(m)
    const batch = m.materialize('downtown', 300)
    expect(batch).toHaveLength(300)
    expect(batch.every((a) => a.state === 'active' || a.state === 'contained')).toBe(true)
    expect(Math.abs(zombies(m) - (before - 300))).toBeLessThan(1e-6)
    m.giveBack('downtown', batch)
    expect(Math.abs(zombies(m) - before)).toBeLessThan(1e-6)
  })

  it('infect moves free people into the incubation queue and remove culls active ones', () => {
    const m = fresh()
    const free0 = m.region('garden').free
    m.infect('garden', 5, 3)
    expect(m.region('garden').free).toBeCloseTo(free0 - 5, 9)
    expect(m.region('garden').incubating).toBeCloseTo(5, 9)
    m.region('garden')
    m.advance(100)
    const active = m.region('garden').active
    m.remove('garden', 2)
    expect(m.region('garden').active).toBeCloseTo(active - 2, 9)
    expect(m.region('garden').removed).toBeGreaterThanOrEqual(2)
  })

  it('throws on unknown regions', () => {
    expect(() => fresh().region('atlantis')).toThrow(/unknown region/)
  })
})

describe('stages', () => {
  it('exposes the stage ids', () => {
    expect([...STAGES]).toEqual(['calm', 'cases', 'panic', 'fallen', 'overrun'])
  })
})

describe('cost', () => {
  it('a one-hour step is cheap (original goal < 0.05 ms; CI allows 5x headroom)', () => {
    const t = fresh()
    const t0 = performance.now()
    t.advance(37 * 24)
    const ms = (performance.now() - t0) / (37 * 24)
    expect(ms).toBeLessThan(0.25)
  })
})
