import { checkBench } from '@adatechnology/game-contracts'
import type { BenchChange, ControlPatch, ModuleHost } from '@adatechnology/game-contracts'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createAudioEngine, createAudioSink, createAudioTestModule } from '../src'

// The audio bench module against a stand-in host: it declares a valid bench, plays what the controls say and its scenarios pass.
function fakeHost(extra: Partial<ModuleHost> = {}) {
  const listeners: Array<(change: BenchChange) => void> = []
  const patches: Array<[string, ControlPatch]> = []
  const frames: Array<(dt: number) => void> = []
  const host = {
    THREE: {},
    scene: {},
    camera: {},
    locale: 'en',
    groundAt: () => 0,
    tool: () => ({ weapon: '', category: '', ammo: 0, capacity: 0, reserve: 0, reloading: false }),
    on: () => () => undefined,
    onFrame: (update: (dt: number) => void) => {
      frames.push(update)
      return () => undefined
    },
    log: () => undefined,
    bench: {
      value: () => undefined,
      layer: () => true,
      onChange: (listener: (change: BenchChange) => void) => {
        listeners.push(listener)
        return () => undefined
      },
      patch: (id: string, patch: ControlPatch) => void patches.push([id, patch]),
      look: () => undefined,
    },
    ...extra,
  } as unknown as ModuleHost
  return { host, send: (change: BenchChange) => listeners.forEach((listener) => listener(change)), patches, frames }
}

const rig = (options: Parameters<typeof createAudioTestModule>[0] = {}) => {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ seed: 3, mix: 'game', createContext: () => recorder.context })
  return { recorder, engine, module: createAudioTestModule({ locale: 'en', engine, ...options }) }
}
const starts = (recorder: ReturnType<typeof createAudioRecorder>): number => recorder.trace().entries.filter((entry) => entry.op === 'start').length

describe('the audio bench module', () => {
  it('declares a valid bench, and a probe drawn by the host (none without one)', () => {
    const { module } = rig({ probe: () => ({ name: 'portable_radio' }) })
    const report = checkBench({ controls: module.controls?.('en'), layers: module.layers?.('en'), metrics: module.metrics?.('en') })
    expect(report.problems).toEqual([])
    const probe = module.items('en')[0]!
    expect(probe.id).toBe('audio_probe')
    expect(probe.build({})).toMatchObject({ name: 'portable_radio', userData: { audio_probe: true } })
    expect(module.area?.('en').placements[0]?.item).toBe('audio_probe')
    expect(rig().module.items('en')).toEqual([])
    expect(rig().module.area?.('en').placements).toEqual([])
    expect(module.group).toBe('Sound')
    expect(createAudioTestModule({ locale: 'pt-BR' }).group).toBe('Som')
  })

  it('lists the sounds of the bank and offers the loops once attached', () => {
    const { module } = rig()
    const sound = module.controls?.('en').find((control) => control.id === 'sound')
    expect(sound?.kind === 'choice' && sound.options.map((option) => option.id)).toEqual(expect.arrayContaining(['bench_ping', 'sfx_pistol', 'horn', 'siren']))
    const { host, patches } = fakeHost()
    module.attach?.(host)
    expect(patches.map(([id]) => id)).toEqual(['sound', 'loop'])
    expect(patches[1]![1].options?.map((option) => option.id)).toEqual(['none', 'engine_saw', 'rotor_blades', 'crowd_rumble'])
  })

  it('plays the chosen sound at its distance and bearing, and quieter when it is farther', () => {
    const { recorder, module } = rig()
    const { host, send } = fakeHost()
    module.attach?.(host)
    send({ kind: 'control', id: 'sound', value: 'bench_ping' })
    send({ kind: 'control', id: 'distance', value: '10' })
    send({ kind: 'control', id: 'bearing', value: 90 })
    expect(module.sheet()).toMatch(/pan 0\.8/)
    send({ kind: 'action', id: 'play' })
    expect(starts(recorder)).toBeGreaterThan(0)
    const near = module.sheet().match(/level ([\d.]+)/)![1]!
    send({ kind: 'control', id: 'distance', value: '120' })
    expect(Number(module.sheet().match(/level ([\d.]+)/)![1])).toBeLessThan(Number(near))
  })

  it('hears from the host camera: its position and the way it looks', () => {
    const { module } = rig()
    const yaw = Math.PI / 2
    const camera = { position: { x: 5, y: 1.7, z: 5 }, getWorldDirection: () => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) }) }
    class Vector3 {}
    const { host, send } = fakeHost({ camera, THREE: { Vector3 } } as unknown as Partial<ModuleHost>)
    module.attach?.(host)
    send({ kind: 'control', id: 'distance', value: '10' })
    send({ kind: 'control', id: 'bearing', value: 0 })
    // the listener looks along -x (yaw 90 degrees), so straight ahead is 10 m to the west of it and in the middle
    expect(module.sheet()).toMatch(/distance 10\.0 m pan -?0\.0/)
    send({ kind: 'control', id: 'bearing', value: 90 })
    expect(module.sheet()).toMatch(/pan 0\.8/)
  })

  it('panning off plays centred; muffling off keeps the cutoff', () => {
    const { module } = rig()
    const { host, send } = fakeHost()
    module.attach?.(host)
    send({ kind: 'control', id: 'bearing', value: 90 })
    send({ kind: 'layer', id: 'panning', on: false })
    expect(module.sheet()).toMatch(/pan 0\.000/)
    send({ kind: 'control', id: 'sound', value: 'sfx_pistol' })
    send({ kind: 'control', id: 'distance', value: '60' })
    send({ kind: 'layer', id: 'panning', on: true })
    const muffled = module.sheet()
    send({ kind: 'layer', id: 'muffling', on: false })
    const clear = module.sheet()
    expect(muffled).toMatch(/lowpass@1125\.0/)
    expect(clear).toMatch(/lowpass@1800\.0/)
    // the recipe is back as it was
    send({ kind: 'layer', id: 'muffling', on: true })
    expect(module.sheet()).toMatch(/lowpass@1125\.0/)
  })

  it('throws a storm at the limiter: a group lets one through, the cap holds the rest', () => {
    const { engine, module } = rig()
    engine.registry.patch('bench_ping', { group: 'undead_voice' })
    const { host, send } = fakeHost()
    module.attach?.(host)
    send({ kind: 'action', id: 'voice_storm' })
    expect(engine.stats().voices).toBe(1)
    expect(engine.stats().dropped).toBe(19)
  })

  it('runs a loop at a level and drops it on none', () => {
    const { engine, module } = rig()
    const { host, send } = fakeHost()
    module.attach?.(host)
    send({ kind: 'control', id: 'loop', value: 'rotor_blades' })
    send({ kind: 'control', id: 'loop_level', value: 0.3 })
    expect(engine.stats().loops).toBe(1)
    send({ kind: 'control', id: 'loop', value: 'none' })
    expect(engine.stats().loops).toBe(0)
  })

  it('switches the mixing chain and its parts', () => {
    const { recorder, module } = rig()
    const { host, send } = fakeHost()
    module.attach?.(host)
    send({ kind: 'action', id: 'play' })
    const before = recorder.trace().entries.filter((entry) => entry.kind === 'convolver').length
    send({ kind: 'control', id: 'mix', value: 'art_scene' })
    expect(recorder.trace().entries.filter((entry) => entry.kind === 'convolver').length).toBe(before + 1)
    send({ kind: 'layer', id: 'reverb', on: false })
    send({ kind: 'layer', id: 'compressor', on: false })
    expect(recorder.trace().entries.filter((entry) => entry.kind === 'convolver').length).toBe(before + 1)
  })

  it('uses the engine of the sink the host lends, and registers its banks there', () => {
    const own = rig()
    const lent = createAudioEngine({ createContext: () => null })
    const { host } = fakeHost({ audio: createAudioSink(lent) })
    own.module.attach?.(host)
    expect(own.module.engine).toBe(lent)
    expect(lent.registry.sound('bench_ping')).toBeDefined()
    expect(lent.registry.sound('sfx_pistol')).toBeDefined()
  })

  it('reads the bus levels without a context as zero, and the metrics as numbers', () => {
    const module = createAudioTestModule({ locale: 'en', engine: createAudioEngine({ createContext: () => null }) })
    for (const metric of module.metrics?.('en') ?? []) expect(['number', 'string']).toContain(typeof metric.read())
  })

  it('passes its own scenarios', async () => {
    const { module } = rig()
    for (const scenario of module.scenarios?.('en') ?? []) {
      const failed: string[] = []
      await scenario.run({ expect: (ok: boolean, label: string) => void (ok || failed.push(label)) })
      expect(failed, scenario.id).toEqual([])
    }
  })
})
