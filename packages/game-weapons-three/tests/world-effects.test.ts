import { createArsenal } from '@adatechnology/game-weapons'
import type { EffectRequest, EffectSink, HostEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'
import { createWorldEffects, WORLD_EFFECTS } from '../src'

const arsenal = createArsenal({ seed: 1 })

const sink = (known: string[] = Object.values(WORLD_EFFECTS).flatMap((ids) => [ids.muzzle, ids.casing])): { effects: EffectSink; played: EffectRequest[] } => {
  const played: EffectRequest[] = []
  return {
    played,
    effects: {
      play(request) {
        if (!known.includes(request.effect)) return null
        played.push(request)
        return played.length
      },
      stop() {},
    },
  }
}

const shot = (weapon: string, extra: Partial<Extract<HostEvent, { type: 'shot' }>> = {}): HostEvent => ({ type: 'shot', weapon, shots: 1, recoil: [0, 0], ...extra })

describe('world effects of a shot seen from outside', () => {
  it('knows a flash and a case for every case type of the calibers', () => {
    const types = new Set([...arsenal.calibers.values()].map((caliber) => caliber.caseType).filter(Boolean))
    for (const type of types) expect(WORLD_EFFECTS[type as string], String(type)).toBeDefined()
  })

  it('plays the flash and the case of the weapon at the muzzle, facing where it points', () => {
    const { effects, played } = sink()
    const world = createWorldEffects({ arsenal, caseTypeOf: () => 'shell' })
    expect(world.handle(shot('r870', { origin: [2, 1.4, 3], direction: [1, 0, 0] }), effects)).toBe(2)
    expect(played.map((request) => request.effect)).toEqual(['muzzle_r870', 'casing_shell'])
    expect(played[0]).toMatchObject({ point: [2, 1.4, 3], direction: [1, 0, 0] })
    expect(played[1]!.point[0]).toBeLessThan(2)
  })

  it('plays one flash per round of a burst, and different seeds for each', () => {
    const { effects, played } = sink()
    const world = createWorldEffects({ arsenal, caseTypeOf: () => 'rifle' })
    world.handle(shot('m4', { origin: [0, 1, 0], rounds: 3 }), effects)
    const flashes = played.filter((request) => request.effect === 'muzzle_ak')
    expect(flashes).toHaveLength(3)
    expect(new Set(flashes.map((request) => request.seed)).size).toBe(3)
  })

  it('plays nothing for the player\'s own shot, other events, or a host without effects', () => {
    const { effects, played } = sink()
    const world = createWorldEffects({ arsenal, caseTypeOf: () => 'pistol' })
    expect(world.handle(shot('glock17'), effects)).toBe(0)
    expect(world.handle({ type: 'reload', weapon: 'glock17', phase: 'start' }, effects)).toBe(0)
    expect(world.handle(shot('glock17', { origin: [0, 1, 0] }), undefined)).toBe(0)
    expect(played).toHaveLength(0)
  })

  it('counts only what the host knows, and a game can change the ids', () => {
    const { effects, played } = sink(['my_flash'])
    const world = createWorldEffects({ arsenal, caseTypeOf: () => 'pistol', ids: { pistol: { muzzle: 'my_flash', casing: 'unknown' } } })
    expect(world.handle(shot('glock17', { origin: [0, 1, 0] }), effects)).toBe(1)
    expect(played[0]!.effect).toBe('my_flash')
  })

  it('takes the case type from the caliber of the weapon by default', () => {
    const firearm = [...arsenal.weapons.values()].find((def) => def.action.kind === 'firearm' && arsenal.calibers.get(def.action.caliber)?.caseType === 'shell')
    expect(firearm).toBeDefined()
    const { effects, played } = sink()
    createWorldEffects({ arsenal }).handle(shot(firearm!.id, { origin: [0, 1, 0] }), effects)
    expect(played[0]!.effect).toBe('muzzle_r870')
  })
})
