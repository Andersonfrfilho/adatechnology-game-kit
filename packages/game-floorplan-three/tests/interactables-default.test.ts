import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { describe, expect, it, vi } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

const kit = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree }

describe('interactives with the default adapter (@adatechnology/game-floorplan-interactables)', () => {
  const plan = planOf('sobrado', 3)

  it('builds real interactables from the kit with no adapter injected', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { house } = houseOf(plan, { interactives: kit })
    expect(warn).not.toHaveBeenCalled()
    const iv = house.interactives
    expect(iv && iv.active).toBe(true)
    expect(iv.entries.size).toBeGreaterThan(30)
    expect(iv.interactables().length).toBeGreaterThan(10)
    expect(iv.warnings.filter((w: string) => /nothing|vazio/.test(w))).toEqual([])
    expect([...iv.entries.values()].some((e: any) => e.type === 'fridge')).toBe(true)
    warn.mockRestore()
  })

  it('places the objects at the floor height of their storey', () => {
    const { house } = houseOf(plan, { interactives: kit })
    const ys = new Set<number>([...house.interactives.entries.values()].map((e: any) => e.pos[1]))
    expect(ys.size).toBeGreaterThan(1)
    expect([...ys].every((y) => Number.isFinite(y))).toBe(true)
  })

  it('takes adapterOptions (a registry entry dropped leaves the type out)', () => {
    const { house } = houseOf(plan, { interactives: { ...kit, adapterOptions: { typeMap: { fridge_large: null } } } })
    expect([...house.interactives.entries.values()].some((e: any) => e.type === 'fridge')).toBe(false)
  })

  it('still accepts the game\'s own adapter (an object, or a factory with create)', () => {
    const calls: string[] = []
    const real = houseOf(plan, { interactives: kit }).house.interactives.kit.A
    const spy = { ...real, plan: (...a: any[]) => { calls.push('plan'); return real.plan(...a) } }
    houseOf(plan, { interactives: { ...kit, adapter: spy } })
    expect(calls).toContain('plan')
    const made: any[] = []
    houseOf(plan, { interactives: { ...kit, adapter: { create: (o: any) => { made.push(o); return real } }, locale: 'en' } })
    expect(made[0]).toMatchObject({ locale: 'en' })
    expect(made[0].GameInteractables).toBe(GameInteractables)
  })
})
