import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { BenchChange, HostEvent, ModuleControl, ModuleHost, TestableModule } from '@adatechnology/game-contracts'
import { createTestRoom, decodeBenchState, demoItems } from '../src'
import type { ScenarioContext } from '../src'
import { makeRoom, stubRenderer } from './helpers'

const CONTROLS: ModuleControl[] = [
  { kind: 'number', id: 'size', name: 'Size', min: 0.5, max: 4, step: 0.5, unit: 'm', default: 1 },
  { kind: 'boolean', id: 'auto_repeat', name: 'Auto repeat', default: false },
  { kind: 'choice', id: 'distance', name: 'Distance', options: [{ id: 'near', name: 'Near' }, { id: 'middle', name: 'Middle' }, { id: 'far', name: 'Far' }], default: 'near' },
  { kind: 'choice', id: 'effect', name: 'Effect', options: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `Effect ${id}` })), default: 'a' },
  { kind: 'action', id: 'replay', name: 'Replay' },
]

interface Probe {
  changes: BenchChange[]
  events: HostEvent[]
  attached: number
  detached: number
  reads: number
  host: ModuleHost | null
}

// a module of nothing in particular that declares a bench and records what reaches it
function benchedModule(probe: Probe, over: Partial<TestableModule<ScenarioContext>> = {}): TestableModule<ScenarioContext> {
  return {
    id: 'lab',
    name: 'Lab',
    group: 'Lab',
    items: () => [],
    controls: () => CONTROLS,
    layers: () => [{ id: 'smoke', name: 'Smoke' }, { id: 'flash', name: 'Flash', default: false }],
    metrics: () => [{ id: 'puffs', name: 'Puffs', max: 400, read: () => ++probe.reads }],
    attach(host) {
      probe.attached++
      probe.host = host
      const offChange = host.bench?.onChange((change) => probe.changes.push(change))
      const offEvents = host.on((event) => probe.events.push(event))
      return () => {
        probe.detached++
        offChange?.()
        offEvents()
      }
    },
    ...over,
  }
}

const newProbe = (): Probe => ({ changes: [], events: [], attached: 0, detached: 0, reads: 0, host: null })

describe('module bench', () => {
  it('sends one change per control and layer, in declaration order, right after attach', () => {
    const probe = newProbe()
    const room = makeRoom()
    const report = room.loadModule(benchedModule(probe))
    expect(report.ok).toBe(true)
    expect(probe.changes).toEqual([
      { kind: 'control', id: 'size', value: 1 },
      { kind: 'control', id: 'auto_repeat', value: false },
      { kind: 'control', id: 'distance', value: 'near' },
      { kind: 'control', id: 'effect', value: 'a' },
      { kind: 'layer', id: 'smoke', on: true },
      { kind: 'layer', id: 'flash', on: false },
    ])
    expect(room.log.entries({ channel: 'check' }).some((e) => e.type === 'pass' && e.data?.check === 'bench')).toBe(true)
  })

  it('clamps and snaps numbers, refuses what does not fit without emitting, and passes actions and layers on', () => {
    const probe = newProbe()
    const room = makeRoom()
    room.loadModule(benchedModule(probe))
    probe.changes.length = 0
    const bench = room.bench()!
    expect(bench.set('size', 9)).toBe(true)
    expect(bench.value('size')).toBe(4)
    expect(bench.set('size', 1.3)).toBe(true)
    expect(bench.value('size')).toBe(1.5)
    expect(bench.set('nope', 1)).toBe(false)
    expect(bench.set('size', 'big')).toBe(false)
    expect(bench.set('distance', 'nowhere')).toBe(false)
    expect(bench.set('replay', true)).toBe(false)
    expect(probe.changes).toEqual([
      { kind: 'control', id: 'size', value: 4 },
      { kind: 'control', id: 'size', value: 1.5 },
    ])
    expect(bench.act('replay')).toBe(true)
    expect(bench.act('size')).toBe(false)
    expect(bench.setLayer('smoke', false)).toBe(true)
    expect(bench.setLayer('nope', true)).toBe(false)
    expect(bench.layer('smoke')).toBe(false)
    expect(probe.changes.slice(2)).toEqual([{ kind: 'action', id: 'replay' }, { kind: 'layer', id: 'smoke', on: false }])
  })

  it('a patch sets a value without echo, and new options fall back to the first one', () => {
    const probe = newProbe()
    const room = makeRoom()
    room.loadModule(benchedModule(probe))
    probe.changes.length = 0
    const lent = probe.host!.bench!
    lent.patch('size', { value: 3 })
    expect(lent.value('size')).toBe(3)
    room.bench()!.set('distance', 'far')
    probe.changes.length = 0
    lent.patch('distance', { options: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }] })
    expect(lent.value('distance')).toBe('x')
    lent.patch('size', { disabled: true })
    expect(room.bench()!.set('size', 2)).toBe(false)
    expect(probe.changes).toEqual([])
  })

  it('the state goes to an encoded string and back, restored before the first changes', () => {
    const encoded: Array<[string, string]> = []
    const room = makeRoom({ bench: { onChange: (moduleId, state) => encoded.push([moduleId, state]) } })
    room.loadModule(benchedModule(newProbe()))
    const bench = room.bench()!
    bench.set('size', 2.5)
    bench.set('auto_repeat', true)
    bench.set('effect', 'e')
    bench.setLayer('flash', true)
    const state = bench.encode()
    expect(state).toBe('size=2.5;auto_repeat=1;distance=near;effect=e;smoke=1;flash=1')
    expect(encoded.at(-1)).toEqual(['lab', state])

    const probe = newProbe()
    const restored = makeRoom({ bench: { state: { lab: state } } })
    restored.loadModule(benchedModule(probe))
    expect(restored.bench()!.encode()).toBe(state)
    expect(probe.changes[0]).toEqual({ kind: 'control', id: 'size', value: 2.5 })
    expect(probe.changes.at(-1)).toEqual({ kind: 'layer', id: 'flash', on: true })
  })

  it('two modules sharing a control id keep their values apart, and each restores only its own state across a reload', () => {
    const second = (probe: Probe): TestableModule<ScenarioContext> => benchedModule(probe, { id: 'other', name: 'Other' })
    const changes: Array<[string, string]> = []
    const room = makeRoom({ bench: { onChange: (moduleId, encoded) => changes.push([moduleId, encoded]) } })
    room.loadModule(benchedModule(newProbe()))
    room.loadModule(second(newProbe()))
    room.bench('lab')!.set('size', 2)
    room.bench('other')!.set('size', 3.5)
    const saved = { lab: room.bench('lab')!.encode(), other: room.bench('other')!.encode() }
    expect(saved.lab).not.toBe(saved.other)

    const reloaded = makeRoom({ bench: { state: saved } })
    reloaded.loadModule(benchedModule(newProbe()))
    reloaded.loadModule(second(newProbe()))
    expect(reloaded.bench('lab')!.value('size')).toBe(2)
    expect(reloaded.bench('other')!.value('size')).toBe(3.5)

    const onlyOther = makeRoom({ bench: { state: { other: saved.other } } })
    onlyOther.loadModule(benchedModule(newProbe()))
    expect(onlyOther.bench('lab')!.value('size')).toBe(1)
  })

  it('reloading a module keeps its live values, and the host state only seeds a module not seen yet', () => {
    const room = makeRoom({ bench: { state: { lab: 'size=4' } } })
    room.loadModule(benchedModule(newProbe()))
    expect(room.bench('lab')!.value('size')).toBe(4)
    room.bench('lab')!.set('size', 2)
    room.loadModule(benchedModule(newProbe()))
    expect(room.bench('lab')!.value('size')).toBe(2)
  })

  it('a module loaded later does not take the panel from the one being viewed', () => {
    const room = makeRoom()
    room.loadModule(benchedModule(newProbe()))
    room.loadModule(benchedModule(newProbe(), { id: 'other', name: 'Other' }))
    room.bench('lab')!.set('size', 2)
    room.bench('other')!.set('size', 3.5)
    expect(room.bench()!.value('size')).toBe(2)
  })

  it('a metric that throws shows n/a and is logged once, not at every read', () => {
    const room = makeRoom()
    room.loadModule(benchedModule(newProbe(), { metrics: () => [{ id: 'puffs', name: 'Puffs', read: () => { throw new Error('boom') } }] }))
    expect(room.metrics().module).toEqual({ puffs: 'n/a' })
    room.metrics()
    room.metrics()
    const notes = room.log.entries().filter((entry) => entry.type === 'module_note' && entry.text.includes('boom'))
    expect(notes).toHaveLength(1)
  })

  it('a listener that throws does not stop the others, the state still changes and the watchers still hear it', () => {
    const encoded: string[] = []
    const probe = newProbe()
    const room = makeRoom({ bench: { onChange: (_moduleId, state) => encoded.push(state) } })
    room.loadModule(
      benchedModule(probe, {
        attach(host) {
          host.bench?.onChange(() => {
            throw new Error('listener broke')
          })
          host.bench?.onChange((change) => probe.changes.push(change))
          return () => undefined
        },
      }),
    )
    expect(probe.changes).toHaveLength(6)
    expect(room.bench()!.set('size', 2)).toBe(true)
    expect(probe.changes.at(-1)).toEqual({ kind: 'control', id: 'size', value: 2 })
    expect(encoded.at(-1)).toContain('size=2')
  })

  it('reads a hostile state: unknown ids, NaN, bad escapes, options not offered and malformed pairs are dropped, numbers clamped', () => {
    const layers = [{ id: 'smoke', name: 'Smoke' }]
    expect([...decodeBenchState('size=NaN;x=1;fx=%ZZ;distance=nope;garbage;=3;auto_repeat=yes', CONTROLS, layers)]).toEqual([])
    expect([...decodeBenchState('size=99;effect=%65;auto_repeat=1;smoke=0;replay=1', CONTROLS, layers)]).toEqual([
      ['size', 4],
      ['effect', 'e'],
      ['auto_repeat', true],
      ['smoke', false],
    ])
  })

  it('a broken declaration fails the report with a check line and lends no bench', () => {
    const probe = newProbe()
    const room = makeRoom()
    const report = room.loadModule(benchedModule(probe, { layers: () => [{ id: 'size', name: 'Size again' }] }))
    expect(report.ok).toBe(false)
    expect(report.problems.some((p) => p.includes('duplicate id "size"'))).toBe(true)
    expect(room.log.entries({ channel: 'check', type: 'fail' }).some((e) => e.data?.check === 'bench')).toBe(true)
    expect(probe.host?.bench).toBeUndefined()
    expect(room.bench()).toBeNull()
  })

  it('loading the same module twice detaches the first one: every event arrives once', () => {
    const probe = newProbe()
    const room = makeRoom()
    room.loadModule(benchedModule(probe))
    room.loadModule(benchedModule(probe))
    expect(probe.attached).toBe(2)
    expect(probe.detached).toBe(1)
    probe.events.length = 0
    room.setTool('pistol_9mm')
    expect(probe.events.filter((e) => e.type === 'tool')).toHaveLength(1)
  })

  it('a module without a bench gets the plain host and no bench handle', () => {
    let lent: ModuleHost | null = null
    const room = makeRoom()
    const report = room.loadModule({ id: 'plain', name: 'Plain', group: 'Plain', items: () => [], attach: (host) => ((lent = host), () => undefined) })
    expect(report.ok).toBe(true)
    expect(lent!.bench).toBeUndefined()
    expect(room.bench('plain')).toBeNull()
  })
})

describe('bench panel', () => {
  const roomWithUi = (): { room: ReturnType<typeof createTestRoom>; container: HTMLElement } => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: demoItems('en'), renderer: stubRenderer(), ui: true })
    return { room, container }
  }

  it('draws a range, a checkbox, segmented buttons, a select and an action, and the layer checkboxes reach the module', () => {
    const probe = newProbe()
    const { room, container } = roomWithUi()
    room.loadModule(benchedModule(probe))
    const panel = container.querySelector('.tr-bench') as HTMLElement
    expect(panel.style.display).not.toBe('none')
    expect(panel.querySelector('input[type=range]')).not.toBeNull()
    expect(panel.querySelector('output')!.textContent).toBe('1.00 m')
    const pressed = [...panel.querySelectorAll('.tr-seg button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])
    expect(pressed).toEqual([['Near', 'true'], ['Middle', 'false'], ['Far', 'false']])
    expect(panel.querySelectorAll('select option')).toHaveLength(5)
    const replay = [...panel.querySelectorAll('button')].find((b) => b.textContent === 'Replay')!
    probe.changes.length = 0
    replay.click()
    const layerBoxes = panel.querySelectorAll('.tr-layers input[type=checkbox]')
    expect(layerBoxes).toHaveLength(2)
    const smoke = layerBoxes[0] as HTMLInputElement
    expect(smoke.checked).toBe(true)
    smoke.checked = false
    smoke.dispatchEvent(new Event('change'))
    expect(probe.changes).toEqual([{ kind: 'action', id: 'replay' }, { kind: 'layer', id: 'smoke', on: false }])
    room.dispose()
  })

  it('updates the counter text at 4 Hz, and shows no module rows for a module that declares nothing', () => {
    const probe = newProbe()
    const { room, container } = roomWithUi()
    room.loadModule(benchedModule(probe))
    const value = (): string => container.querySelector('.tr-metrics dd span')!.textContent ?? ''
    const before = value()
    room.update(0.1)
    expect(value()).toBe(before)
    room.update(0.15)
    expect(value()).not.toBe(before)
    expect(container.querySelector('.tr-metrics .tr-bar')).not.toBeNull()
    room.dispose()

    const plain = roomWithUi()
    plain.room.loadModule({ id: 'plain', name: 'Plain', group: 'Plain', items: () => [] })
    plain.room.update(0.3)
    expect(plain.container.querySelectorAll('.tr-metrics dt')).toHaveLength(0)
    expect(plain.container.querySelector('.tr-bench-room')!.textContent).toContain('Objects')
    plain.room.dispose()
  })
  it('stops sampling the counters while the panels column is hidden', () => {
    const probe = newProbe()
    const { room, container } = roomWithUi()
    room.loadModule(benchedModule(probe))
    room.update(0.3)
    const reads = probe.reads
    ;(container.querySelector('.tr-bench')!.parentElement as HTMLElement).style.display = 'none'
    room.update(0.3)
    expect(probe.reads).toBe(reads)
    room.dispose()
  })
})
