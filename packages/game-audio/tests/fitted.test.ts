import { describe, expect, it } from 'vitest'
import manifest from '../assets/sfx/manifest.json'
import { createAudioEngine, createRng, createSoundRegistry, kitSampleBank, planSound } from '../src'
import type { SfxManifest } from '../src'
import type { SoundBank } from '../src'
import { FITTED_KEEPS_RECIPE, FITTED_SFX, fittedBus, fittedIds, fittedSoundBank, fittedTakeId, registerFittedSounds } from '../src/fitted'

const OLD: SoundBank = {
  id: 'old',
  sounds: [
    { id: 'wood_hit', bus: 'world', duration: 0.2, layers: [{ gain: 1, source: { kind: 'noise' }, envelope: [[0, 1, 'set'], [0.2, 0.001, 'exp']] }], sources: ['test'] },
    { id: 'gas_leak', bus: 'world', duration: 0.2, layers: [{ gain: 1, source: { kind: 'noise' }, envelope: [[0, 1, 'set'], [0.2, 0.001, 'exp']] }], sources: ['test'] },
  ],
}

describe('fitted sounds', () => {
  it('covers every recorded id of the manifest but the vehicles', () => {
    const recorded = (manifest as { sounds: { id: string; category: string }[] }).sounds.filter((sound) => sound.category !== 'veiculos').map((sound) => sound.id)
    const fitted = new Set(fittedIds())
    expect(recorded.filter((id) => !fitted.has(id))).toEqual([])
  })

  it('gives one recipe per take and one set per id, every recipe a valid plan that ends on time', () => {
    const bank = fittedSoundBank()
    const sounds = new Map((bank.sounds ?? []).map((sound) => [sound.id, sound]))
    for (const set of bank.sets ?? []) {
      expect(set.variants.length).toBeGreaterThan(0)
      for (const variant of set.variants) expect(sounds.has(variant)).toBe(true)
    }
    for (const recipe of bank.sounds ?? []) {
      expect(recipe.layers.length).toBeGreaterThan(0)
      const plan = planSound(recipe, { random: createRng(1) })
      expect(plan).not.toBeNull()
      for (const layer of recipe.layers) for (const point of layer.envelope ?? []) expect(point[1]).toBeGreaterThan(0)
      expect(plan?.length ?? 0).toBeLessThanOrEqual((recipe.duration as number) + 0.1)
    }
    expect(fittedTakeId('door_wood_shut', 2)).toBe('door_wood_shut~2')
  }, 60000)

  it('puts voices on the voices bus and loops in loops', () => {
    expect(fittedBus({ id: 'zombie_groan', category: 'monstros' })).toBe('voices')
    const bank = fittedSoundBank()
    const loops = new Set((bank.loops ?? []).map((loop) => loop.id))
    for (const sound of FITTED_SFX.sounds) if (sound.loop) expect(loops.has(sound.id)).toBe(true)
  })

  it('replaces the older recipe of a fitted id, keeps its recorded takes and the param-driven ones', () => {
    const registry = createSoundRegistry([OLD])
    const kit = kitSampleBank(manifest as SfxManifest, { baseUrl: '/sfx/' })
    registry.register(kit)
    const ids = registerFittedSounds({ registry, register: (bank) => registry.register(bank) })
    expect(ids).toContain('wood_hit')
    expect(registry.sound('wood_hit')).toBeUndefined()
    expect(registry.set('wood_hit')?.variants[0]).toBe('wood_hit~1')
    expect(registry.sample('wood_hit')).toBeDefined()
    expect(FITTED_KEEPS_RECIPE.has('gas_leak')).toBe(true)
    expect(registry.sound('gas_leak')).toBeDefined()
  })

  it('answers the aliases and the bare id of tiered recordings with the fitted takes', () => {
    const bank = fittedSoundBank()
    const sets = new Map((bank.sets ?? []).map((set) => [set.id, set]))
    expect(sets.get('shut_wood')?.variants).toEqual(sets.get('door_wood_shut')?.variants)
    expect(sets.get('wood_blunt')?.variants).toEqual(sets.get('wood_blunt_medium')?.variants)
    expect(fittedSoundBank({ aliases: {} }).sets?.some((set) => set.id === 'shut_wood')).toBe(false)
  })

  it('leaves the older recipes with replace: false', () => {
    const registry = createSoundRegistry([OLD])
    registerFittedSounds({ registry, register: (bank) => registry.register(bank) }, { replace: false })
    expect(registry.sound('wood_hit')?.layers.length).toBe(1)
  })

  it('plays through an engine without a context', () => {
    const engine = createAudioEngine({ createContext: () => null })
    registerFittedSounds(engine)
    expect(() => engine.play('glass_shatter')).not.toThrow()
  })
})
