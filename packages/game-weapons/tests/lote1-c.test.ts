import { describe, expect, it } from 'vitest'
import { createArsenal } from '../src'
import type { Detonation, ExplosiveEvent, Use, Vec3 } from '../src'

const FRAME = 1 / 60
const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const arsenal = createArsenal({ rules: { faults: false, startSafe: false } })

const detonationsOf = (events: readonly ExplosiveEvent[]): Detonation[] => events.flatMap((event) => (event.type === 'detonate' ? [event.detonation] : []))

const runUse = (use: Use, limit = 200): Detonation[] => {
  const body = arsenal.explosiveBody(use)
  if (!body) throw new Error('no body')
  const events: ExplosiveEvent[] = []
  for (let t = 0; t < limit && !body.done; t += FRAME) events.push(...body.step(FRAME, (from, to) => (to[1] > 0 ? null : { point: [to[0], 0, to[2]], normal: [0, 1, 0], ground: true })))
  return detonationsOf(events)
}

const useOf = (weaponId: string): Use => {
  const weapon = arsenal.create(weaponId)
  const result = weapon.trigger(ORIGIN, AIM, 0, false)
  const use = (weapon.release(ORIGIN, AIM) ?? result).uses[0] ?? result.uses[0]
  if (!use) throw new Error(`${weaponId} gave no use`)
  return use
}

describe('M32 multiple grenade launcher (Milkor MGL)', () => {
  const def = arsenal.weapons.get('m32_mgl')

  it('is a revolving launcher of six 40×46 mm grenades with the real measures of the MGL', () => {
    expect(def?.action).toMatchObject({ kind: 'launcher', projectile: 'm79_40mm', magazine: 6, family: 'revolver', speed: 75, backblast: 0 })
    expect(def?.dimensions).toMatchObject({ length: 0.778, lengthCollapsed: 0.565, barrel: 0.3, emptyMass: 5.3 })
    expect(def?.stock).toEqual({ kind: 'fold', foldAxis: 'over' })
  })

  it('fires six grenades one pull each, is then empty, and the reload brings the six back', () => {
    const weapon = arsenal.create('m32_mgl', { reserve: 12 })
    expect(weapon.ammo).toBe(6)
    for (let shot = 0; shot < 6; shot++) {
      const result = weapon.trigger(ORIGIN, AIM, 0.5, false)
      expect(result.status, `shot ${shot}`).toBe('ok')
      expect(result.uses[0]).toMatchObject({ kind: 'throw', explosive: 'm79_40mm', trigger: 'impact' })
      weapon.release(ORIGIN, AIM)
    }
    expect(weapon.trigger(ORIGIN, AIM, 0.5, false).status).toBe('empty')
    expect(weapon.reload()).toBe(true)
    weapon.update(10)
    expect(weapon.ammo).toBe(6)
  })
})

describe('M18 smoke grenade', () => {
  const smoke = arsenal.explosives.get('smoke_grenade')

  it('is a canister: no blast, a fuse of 1.0 to 2.3 s, smoke for 50 to 90 s', () => {
    expect(smoke).toMatchObject({ kind: 'smoke', energy: 0, lethalRadius: 0, injuryRadius: 0, destructionLevel: 0, fuseRange: [1, 2.3], mass: 0.54 })
    expect(smoke?.smoke?.seconds).toEqual([50, 90])
  })

  it('lights after its fuse and the detonation carries the smoke, not a blast', () => {
    const use = useOf('smoke_grenade')
    expect(use).toMatchObject({ kind: 'throw', explosive: 'smoke_grenade', trigger: 'timer' })
    const [detonation] = runUse(use)
    expect(detonation?.energy).toBe(0)
    expect(detonation?.smoke?.seconds).toEqual([50, 90])
    expect(detonation?.at).toBeGreaterThanOrEqual(1)
    expect(detonation?.at).toBeLessThanOrEqual(2.4)
  })
})

describe('Semtex charge', () => {
  it('is a 500 g block with 0.83 kg of TNT, fired by the remote or by its fuse of about 30 s', () => {
    const semtex = arsenal.explosives.get('semtex')
    expect(semtex).toMatchObject({ kind: 'blast', mass: 0.5, tnt: 0.83, triggers: ['remote', 'timer'] })
    expect(semtex?.energy).toBeGreaterThan(arsenal.explosives.get('c4')?.energy ?? 0)
    const placed = useOf('semtex')
    expect(placed).toMatchObject({ kind: 'place', explosive: 'semtex' })
    const timed = placed.kind === 'place' ? placed.fuse : undefined
    expect(timed).toBeGreaterThan(25)
    expect(timed).toBeLessThan(35)
  })

  it('goes off at once on the remote trigger', () => {
    const body = arsenal.explosiveBody(useOf('semtex'))
    const event = body?.trigger('remote')
    expect(event?.type).toBe('detonate')
  })
})

describe('KA-BAR, katana and brass knuckles', () => {
  const action = (id: string) => {
    const found = arsenal.weapons.get(id)?.action
    if (found?.kind !== 'melee') throw new Error(`${id} is not a melee weapon`)
    return found
  }

  it('the KA-BAR is a 320 g fighting knife like the tactical knife', () => {
    expect(arsenal.weapons.get('kabar')).toMatchObject({ category: 'melee_blade', mass: 0.32 })
    expect(action('kabar').damage).toBe('slash')
  })

  it('the katana is a heavy two-hand blade that swings slower and harder than the machete', () => {
    expect(arsenal.weapons.get('katana')?.tags).toContain('two_handed')
    expect(action('katana').energy).toBeGreaterThan(action('machete').energy)
    expect(action('katana').rpm).toBeLessThan(action('machete').rpm)
    expect(action('katana').reach).toBeGreaterThan(action('machete').reach)
  })

  it('brass knuckles hit harder than bare fists over a smaller contact area', () => {
    expect(action('brass_knuckles').energy).toBeGreaterThan(action('fists').energy)
    expect(action('brass_knuckles').radius).toBeLessThan(action('fists').radius)
    expect(action('brass_knuckles').damage).toBe('blunt')
  })
})
