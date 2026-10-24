import { describe, expect, it } from 'vitest'
import { checkBench } from '../src'
import type { BenchDeclaration, BenchSheet, HostEvent, ModuleControl, ModuleLayer, ModuleMetric, TestableModule } from '../src'

const controls: ModuleControl[] = [
  { kind: 'number', id: 'size', name: 'Size', min: 0.5, max: 4, step: 0.5, unit: 'm', default: 1 },
  { kind: 'boolean', id: 'auto_repeat', name: 'Auto repeat', default: false },
  { kind: 'choice', id: 'distance', name: 'Distance', options: [{ id: 'near', name: 'Near' }, { id: 'far', name: 'Far' }], default: 'near' },
  { kind: 'action', id: 'replay', name: 'Replay' },
]
const layers: ModuleLayer[] = [{ id: 'smoke', name: 'Smoke' }, { id: 'flash', name: 'Flash', default: false }]
const metrics: ModuleMetric[] = [{ id: 'particles', name: 'Particles', max: 400, read: () => 0 }]
const valid: BenchDeclaration = { controls, layers, metrics }

const problemsOf = (declared: BenchDeclaration): readonly string[] => {
  const report = checkBench(declared)
  expect(report.ok).toBe(false)
  return report.problems
}

describe('bench contract', () => {
  it('a valid declaration passes, and an empty one too', () => {
    expect(checkBench(valid)).toEqual({ ok: true, problems: [] })
    expect(checkBench({})).toEqual({ ok: true, problems: [] })
  })

  it('names every broken rule', () => {
    expect(problemsOf({ controls, layers: [{ id: 'size', name: 'Size layer' }] })).toEqual(['duplicate id "size" across controls, layers and metrics'])
    expect(problemsOf({ layers, metrics: [{ id: 'smoke', name: 'Smoke count', read: () => 0 }] })).toEqual(['duplicate id "smoke" across controls, layers and metrics'])
    expect(problemsOf({ layers: [{ id: 'Smoke', name: 'Smoke' }] })).toEqual(['layer id "Smoke" must be snake_case'])
    expect(problemsOf({ controls: [{ kind: 'number', id: 'size', name: 'Size', min: 4, max: 4, default: 4 }] })).toEqual(['control "size" needs min < max'])
    expect(problemsOf({ controls: [{ kind: 'number', id: 'size', name: 'Size', min: 0, max: 4, step: 0, default: 1 }] })).toEqual(['control "size" needs a step > 0'])
    expect(problemsOf({ controls: [{ kind: 'number', id: 'size', name: 'Size', min: 0, max: 4, default: 5 }] })).toEqual(['control "size" default 5 is outside 0..4'])
    expect(problemsOf({ controls: [{ kind: 'choice', id: 'mode', name: 'Mode', options: [], default: 'a' }] })).toEqual(['control "mode" needs at least one option'])
    expect(problemsOf({ controls: [{ kind: 'choice', id: 'mode', name: 'Mode', options: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A again' }], default: 'a' }] })).toEqual(['control "mode" repeats option "a"'])
    expect(problemsOf({ controls: [{ kind: 'choice', id: 'mode', name: 'Mode', options: [{ id: 'a', name: 'A' }], default: 'b' }] })).toEqual(['control "mode" default "b" is not among its options'])
    expect(problemsOf({ metrics: [{ id: 'heat', name: 'Heat', max: 0, read: () => 0 }] })).toEqual(['metric "heat" needs a max > 0'])
  })

  it('a module without a bench still satisfies TestableModule, and the tool events are generic', () => {
    const plain: TestableModule = { id: 'plain', name: 'Plain', group: 'Plain', items: () => [] }
    const benched: TestableModule = { ...plain, controls: () => controls, layers: () => layers, metrics: () => metrics }
    expect(plain.controls).toBeUndefined()
    expect(checkBench({ controls: benched.controls?.('en'), layers: benched.layers?.('en'), metrics: benched.metrics?.('en') }).ok).toBe(true)
    const events: HostEvent[] = [
      { type: 'shot', weapon: 'nail_gun', shots: 1, recoil: [0, 0] },
      { type: 'shot', weapon: 'rifle', shots: 3, recoil: [1, 0], rounds: 3, mode: 'burst' },
      { type: 'mode', weapon: 'rifle', mode: 'semi' },
      { type: 'fault', weapon: 'chainsaw', fault: 'chain_stuck' },
      { type: 'clear', weapon: 'chainsaw', fault: 'chain_stuck', phase: 'end' },
      { type: 'safety', weapon: 'nail_gun', on: true },
    ]
    expect(events.map((e) => e.type)).toEqual(['shot', 'shot', 'mode', 'fault', 'clear', 'safety'])
  })

  it('options may be grouped, each group in one run', () => {
    const grouped = (options: { id: string; group?: string }[]): BenchDeclaration => ({
      controls: [{ kind: 'choice', id: 'effect', name: 'Effect', options: options.map((o) => ({ ...o, name: o.id })), default: options[0]?.id ?? '' }],
    })
    expect(checkBench(grouped([{ id: 'a', group: 'Throw' }, { id: 'b', group: 'Throw' }, { id: 'c', group: 'Charges' }, { id: 'd' }])).ok).toBe(true)
    expect(problemsOf(grouped([{ id: 'a', group: 'Throw' }, { id: 'c', group: 'Charges' }, { id: 'b', group: 'Throw' }]))).toEqual(['control "effect" group "Throw" is split: its options must be next to each other'])
    expect(problemsOf(grouped([{ id: 'a', group: '' }]))).toEqual(['control "effect" option "a" has an empty group'])
  })

  it('a bench may show a sheet and a host may leave it out', () => {
    const sheet: BenchSheet = {
      title: 'Granada',
      facts: [{ label: 'Lethal', value: '5 m' }],
      steps: [{ at: '0 s', text: 'flash' }],
      swatches: [{ color: '#FFF4D6', name: 'flash' }],
      timeline: { segments: [{ name: 'Flash', start: 0, end: 0.05, color: '#fff4d6' }], ticks: [0, 1], metric: 'blast_time' },
    }
    const shown: (BenchSheet | null)[] = []
    const withSheet = { sheet: (value: BenchSheet | null) => shown.push(value) }
    const withoutSheet: { sheet?: (value: BenchSheet | null) => void } = {}
    withSheet.sheet(sheet)
    withSheet.sheet(null)
    withoutSheet.sheet?.(sheet)
    expect(shown).toEqual([sheet, null])
  })
})
