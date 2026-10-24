import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { BenchChange, BenchSheet, ControlPatch, ControlValue, ModuleBench, ModuleHost } from '@adatechnology/game-contracts'
import { checkBench } from '@adatechnology/game-contracts'
import { createVfxTestModule } from '../src'

function fakeHost(): { host: ModuleHost; frame: (dt: number) => void; send: (change: BenchChange) => void; patches: Array<[string, ControlPatch]>; sheets: Array<BenchSheet | null>; looks: unknown[] } {
  const listeners: Array<(change: BenchChange) => void> = []
  const frames: Array<(dt: number) => void> = []
  const patches: Array<[string, ControlPatch]> = []
  const sheets: Array<BenchSheet | null> = []
  const looks: unknown[] = []
  const bench: ModuleBench = {
    value: () => undefined,
    layer: () => true,
    onChange: (listener) => {
      listeners.push(listener)
      return () => undefined
    },
    patch: (id, patch) => void patches.push([id, patch]),
    look: (eye, target) => void looks.push([eye, target]),
    sheet: (sheet) => void sheets.push(sheet),
  }
  const host = {
    THREE,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    locale: 'en',
    groundAt: () => 0,
    tool: () => ({}),
    on: () => () => undefined,
    onFrame: (update: (dt: number) => void) => {
      frames.push(update)
      return () => undefined
    },
    log: () => undefined,
    bench,
  } as unknown as ModuleHost
  return { host, frame: (dt) => frames.forEach((f) => f(dt)), send: (change) => listeners.forEach((l) => l(change)), patches, sheets, looks }
}

describe('createVfxTestModule', () => {
  it('declares a valid bench: grouped effects, six layers and the budget counters', () => {
    const module = createVfxTestModule({ locale: 'en' })
    const controls = module.controls!('en')
    const declared = { controls, layers: module.layers!('en'), metrics: module.metrics!('en') }
    expect(checkBench(declared)).toEqual({ ok: true, problems: [] })
    const effect = controls.find((control) => control.id === 'effect')!
    if (effect.kind !== 'choice') throw new Error('effect is a choice')
    expect(effect.options.filter((option) => option.group === 'Explosions')).toHaveLength(16)
    expect(effect.options.length).toBeGreaterThanOrEqual(16 + 30)
    expect(declared.layers).toHaveLength(6)
    expect(declared.metrics.map((metric) => metric.id)).toEqual(['puffs', 'sparks', 'debris', 'lights', 'budget_particles', 'lod', 'phase', 'blast_time'])
    expect(module.name).toBe('Effects')
    expect(createVfxTestModule({ locale: 'pt-BR' }).name).toBe('Efeitos')
  })

  it('plays what is picked in a renderer of its own, patches the variant list and puts the sheet up', () => {
    const { host, frame, send, patches, sheets, looks } = fakeHost()
    const module = createVfxTestModule()
    const detach = module.attach!(host)
    send({ kind: 'control', id: 'effect', value: 'm67' })
    for (let i = 0; i < 10; i++) frame(1 / 60)
    const metric = (id: string): number => Number(module.metrics!('en').find((m) => m.id === id)!.read())
    expect(metric('puffs')).toBeGreaterThan(10)
    expect(metric('budget_particles')).toBeGreaterThan(100)
    expect(sheets.at(-1)?.timeline?.metric).toBe('blast_time')
    expect(metric('blast_time')).toBeGreaterThan(0)

    send({ kind: 'control', id: 'effect', value: 'blood_hit' })
    const variant = patches.filter(([id]) => id === 'variant').at(-1)![1]
    expect(variant.hidden).toBe(false)
    expect(variant.options!.length).toBeGreaterThan(1)
    expect(sheets.at(-1)?.title).toBeTruthy()
    expect(sheets.at(-1)?.timeline?.metric).toBe('phase')
    for (let i = 0; i < 12; i++) frame(1 / 60)
    expect(metric('phase')).toBeGreaterThan(0.1)

    send({ kind: 'control', id: 'distance', value: 40 as ControlValue })
    expect(looks).toHaveLength(1)
    send({ kind: 'layer', id: 'show_puffs', on: false })
    send({ kind: 'control', id: 'quality', value: 'low' })
    detach()
    expect(sheets.at(-1)).toBeNull()
  })

  it('replays by itself while auto replay is on', () => {
    const { host, frame, send } = fakeHost()
    const module = createVfxTestModule({ repeatSeconds: 1 })
    module.attach!(host)
    send({ kind: 'control', id: 'auto_repeat', value: true })
    send({ kind: 'control', id: 'effect', value: 'm67' })
    for (let i = 0; i < 70; i++) frame(1 / 60)
    const phase = Number(module.metrics!('en').find((m) => m.id === 'phase')!.read())
    expect(phase).toBeLessThan(0.5)
  })
})
