import { describe, expect, it } from 'vitest'
import { CALIBERS, DEFAULT_LOADOUT, WEAPONS, createArsenal, muzzleEnergy } from '../src'
import type { Vec3 } from '../src'

const O: Vec3 = [0, 1.5, 0]
const D: Vec3 = [0, 0, -1]
const angle = (a: Vec3, b: Vec3) => (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI

describe('calibres', () => {
  const expected: Record<string, number> = {
    '22lr': 160, '9x19': 500, '38spl': 310, '357mag': 800, '40sw': 560, '45acp': 480, '380acp': 270, '5_56x45': 1750, '7_62x39': 2100,
    '7_62x51': 3500, '338lapua': 6600, '50bmg': 18000, '12ga_00buck': 300, '12ga_slug': 3000, arrow: 100, crossbow_bolt: 150,
  }
  for (const [id, joules] of Object.entries(expected)) {
    it(`${id} muzzle energy is near ${joules} J`, () => {
      const c = CALIBERS.find((x) => x.id === id)!
      const e = muzzleEnergy(c)
      expect(e).toBeGreaterThan(joules * 0.88)
      expect(e).toBeLessThan(joules * 1.12)
    })
  }
  it('has pellet shells and every weapon points to a known calibre', () => {
    expect(CALIBERS.find((c) => c.id === '12ga_00buck')!.pellets).toBe(9)
    const ids = new Set(CALIBERS.map((c) => c.id))
    for (const w of WEAPONS) if (w.action.kind === 'firearm') expect(ids.has(w.action.caliber)).toBe(true)
  })
  it('default loadout ids exist', () => {
    const a = createArsenal()
    for (const id of DEFAULT_LOADOUT) expect(a.weapons.has(id)).toBe(true)
  })
  it('barrel factor scales energy with speed squared', () => {
    const a = createArsenal()
    expect(a.muzzleEnergy('9x19', 2)).toBeCloseTo(a.muzzleEnergy('9x19') * 4, 6)
  })
})

describe('firing', () => {
  it('semi fires once per pull and needs a release', () => {
    const w = createArsenal().create('pistol_9mm')
    expect(w.trigger(O, D, 0.016, true).shots).toHaveLength(1)
    w.update(1)
    expect(w.trigger(O, D, 0.016, true).shots).toHaveLength(0)
    w.release()
    expect(w.trigger(O, D, 0.016, true).shots).toHaveLength(1)
    w.update(1)
    expect(w.trigger(O, D, 0.016, false).shots).toHaveLength(1)
  })

  it('respects the cooldown between semi shots', () => {
    const w = createArsenal().create('pistol_9mm')
    w.trigger(O, D, 0.016, false)
    const r = w.trigger(O, D, 0.016, false)
    expect(r.status).toBe('cooldown')
    w.update(0.25)
    expect(w.trigger(O, D, 0.016, false).shots).toHaveLength(1)
  })

  it('auto at 600 rpm gives about 10 shots in one second', () => {
    const ar = createArsenal({ weapons: [{ id: 't600', category: 'rifle', mass: 1, action: { kind: 'firearm', caliber: '5_56x45', rpm: 600, modes: ['auto'], magazine: 100, reload: 2, spreadDeg: 0.5, recoil: [1, 1], range: 100, noise: 100 } }] })
    const one = ar.create('t600')
    expect(Math.abs(one.trigger(O, D, 1, true).shots.length - 10)).toBeLessThanOrEqual(1)
    const frames = ar.create('t600')
    let n = 0
    for (let i = 0; i < 60; i++) {
      frames.update(1 / 60)
      n += frames.trigger(O, D, 1 / 60, true).shots.length
    }
    expect(Math.abs(n - 10)).toBeLessThanOrEqual(1)
  })

  it('burst fires the burst count at once', () => {
    const w = createArsenal().create('rifle_5_56')
    w.cycleMode() // burst
    expect(w.mode).toBe('burst')
    expect(w.trigger(O, D, 0.016, false).shots).toHaveLength(3)
    expect(w.ammo).toBe(27)
  })

  it('empties the magazine, then reports empty without auto-reloading', () => {
    const w = createArsenal().create('pistol_22')
    for (let i = 0; i < 10; i++) {
      expect(w.trigger(O, D, 0.016, false).shots).toHaveLength(1)
      w.update(1)
    }
    expect(w.ammo).toBe(0)
    const r = w.trigger(O, D, 0.016, false)
    expect(r.status).toBe('empty')
    expect(r.shots).toHaveLength(0)
    expect(w.reloading).toBe(false)
  })

  it('reload takes its time and consumes the reserve', () => {
    const w = createArsenal().create('pistol_9mm', { reserve: 20 })
    for (let i = 0; i < 5; i++) {
      w.trigger(O, D, 0.016, false)
      w.update(1)
    }
    expect(w.ammo).toBe(10)
    expect(w.reload()).toBe(true)
    expect(w.reloading).toBe(true)
    expect(w.trigger(O, D, 0.016, false).status).toBe('reloading')
    w.update(1)
    expect(w.ammo).toBe(10)
    w.update(1.1)
    expect(w.reloading).toBe(false)
    expect(w.ammo).toBe(15)
    expect(w.reserve).toBe(15)
  })

  it('does not reload a full magazine or without reserve', () => {
    const w = createArsenal().create('pistol_9mm', { reserve: 0 })
    expect(w.reload()).toBe(false)
    w.trigger(O, D, 0.016, false)
    expect(w.reload()).toBe(false)
  })

  it('tube shotgun reloads one round per step and can be interrupted by the trigger', () => {
    const w = createArsenal().create('shotgun_pump_12', { reserve: 30 })
    for (let i = 0; i < 3; i++) {
      w.trigger(O, D, 0.016, false)
      w.update(1.2)
    }
    expect(w.ammo).toBe(3)
    expect(w.reload()).toBe(true)
    w.update(0.65)
    expect(w.ammo).toBe(4)
    w.update(0.6)
    expect(w.ammo).toBe(5)
    const r = w.trigger(O, D, 0.016, false)
    expect(r.shots).toHaveLength(9)
    expect(w.reloading).toBe(false)
    expect(w.ammo).toBe(4)
    expect(w.reload()).toBe(true)
    w.update(10)
    expect(w.ammo).toBe(6)
    expect(w.reloading).toBe(false)
  })

  it('12 ga buck gives 9 pellets inside the cone', () => {
    const w = createArsenal().create('shotgun_pump_12')
    const r = w.trigger(O, D, 0.016, false)
    expect(r.shots).toHaveLength(9)
    expect(r.shots.map((s) => s.pellet)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    for (const s of r.shots) {
      expect(angle(s.direction, D)).toBeLessThanOrEqual(1 + 3 + 1e-6)
      expect(Math.hypot(...s.direction)).toBeCloseTo(1, 9)
      expect(s.energy).toBeGreaterThan(270)
    }
    expect(new Set(r.shots.map((s) => s.direction.join())).size).toBe(9)
  })

  it('spread samples stay inside the cone and fill it', () => {
    const w = createArsenal().create('rifle_bolt_308', { reserve: 1e6 })
    let maxA = 0
    for (let i = 0; i < 300; i++) {
      w.refill()
      const s = w.trigger(O, [1, 0.3, -0.2], 0.016, false).shots[0]
      maxA = Math.max(maxA, angle(s.direction, [1, 0.3, -0.2].map((v) => v / Math.hypot(1, 0.3, 0.2)) as Vec3))
    }
    expect(maxA).toBeLessThanOrEqual(0.25 + 1e-6)
    expect(maxA).toBeGreaterThan(0.15)
  })

  it('bloom grows per shot, is capped at 4x base and recovers', () => {
    const w = createArsenal().create('smg_9mm')
    const base = w.spread
    w.trigger(O, D, 0.5, true)
    expect(w.spread).toBeGreaterThan(base)
    w.refill()
    for (let i = 0; i < 20; i++) w.trigger(O, D, 0.1, true)
    expect(w.spread).toBeLessThanOrEqual(base * 4 + 1e-9)
    w.update(5)
    expect(w.spread).toBeCloseTo(base, 6)
  })

  it('is deterministic by seed', () => {
    const run = (seed: number) => {
      const w = createArsenal().create('shotgun_pump_12', { seed })
      return w.trigger(O, D, 0.016, false).shots.map((s) => s.direction)
    }
    expect(run(7)).toEqual(run(7))
    expect(run(7)).not.toEqual(run(8))
    const a = createArsenal({ seed: 3 }).create('pistol_9mm').trigger(O, D, 0.016, false).shots[0].direction
    const b = createArsenal({ seed: 3 }).create('pistol_9mm').trigger(O, D, 0.016, false).shots[0].direction
    expect(a).toEqual(b)
  })

  it('shot energy falls with distance (speed squared)', () => {
    const s = createArsenal().create('pistol_9mm').trigger(O, D, 0.016, false).shots[0]
    expect(s.energyAt(0)).toBeCloseTo(s.energy, 9)
    expect(s.energyAt(100)).toBeLessThan(s.energyAt(50))
    expect(s.energyAt(100)).toBeCloseTo(s.energy * 0.8 * 0.8, 6)
    expect(s.caliber).toBeCloseTo(9, 1)
    expect(s.caliberId).toBe('9x19')
  })

  it('reports noise, recoil and the source', () => {
    const r = createArsenal().create('pistol_9mm').trigger(O, D, 0.016, false, 'player')
    expect(r.noise).toBe(150)
    expect(r.recoil[0]).toBeGreaterThan(0)
    expect(r.shots[0].source).toBe('player')
  })

  it('cycleMode walks the weapon modes', () => {
    const w = createArsenal().create('smg_9mm')
    expect([w.mode, w.cycleMode(), w.cycleMode(), w.cycleMode()]).toEqual(['auto', 'burst', 'semi', 'auto'])
  })
})

describe('non-firearms', () => {
  it('flamethrower drains fuel and runs dry', () => {
    const w = createArsenal().create('flamethrower')
    expect(w.capacity).toBe(20)
    const r = w.trigger(O, D, 1, true)
    expect(r.uses[0]).toMatchObject({ kind: 'flame', temperature: 900, cone: true, duration: 1 })
    expect(w.ammo).toBeCloseTo(19, 9)
    for (let i = 0; i < 19; i++) w.trigger(O, D, 1, true)
    expect(w.ammo).toBeCloseTo(0, 9)
    expect(w.trigger(O, D, 1, true).status).toBe('no_fuel')
    w.refill()
    expect(w.ammo).toBe(20)
  })

  it('clips the last flame tick to the fuel left', () => {
    const w = createArsenal().create('flamethrower')
    for (let i = 0; i < 19; i++) w.trigger(O, D, 1, true)
    const r = w.trigger(O, D, 5, true)
    expect(r.uses[0]).toMatchObject({ kind: 'flame', duration: 1 })
    expect(w.ammo).toBe(0)
  })

  it('heat tool uses duration dt', () => {
    const w = createArsenal().create('cutting_torch')
    expect(w.trigger(O, D, 0.5, true).uses[0]).toMatchObject({ kind: 'heat', temperature: 3000, duration: 0.5 })
  })

  it('throwables throw once per pull with an upward arc', () => {
    const w = createArsenal().create('frag_grenade')
    expect(w.ammo).toBe(3)
    const r = w.trigger(O, D, 0.016, true)
    const u = r.uses[0]
    expect(u.kind).toBe('throw')
    if (u.kind === 'throw') {
      expect(u.velocity[2]).toBeCloseTo(-15, 6)
      expect(u.velocity[1]).toBeGreaterThan(0)
      expect(u.fuse).toBe(4)
    }
    expect(w.trigger(O, D, 0.016, true).uses).toHaveLength(0)
    w.release()
    expect(w.trigger(O, D, 0.016, true).uses).toHaveLength(1)
    expect(w.ammo).toBe(1)
  })

  it('molotov carries fire', () => {
    const u = createArsenal().create('molotov').trigger(O, D, 0.016, false).uses[0]
    expect(u.kind === 'throw' && u.fire).toEqual({ temperature: 700, radius: 1.5, seconds: 12 })
  })

  it('melee respects its cooldown', () => {
    const w = createArsenal().create('axe')
    expect(w.trigger(O, D, 0.016, false).uses[0]).toMatchObject({ kind: 'melee', damage: 'slash', energy: 250 })
    expect(w.trigger(O, D, 0.016, false).status).toBe('cooldown')
    w.update(1.5)
    expect(w.trigger(O, D, 0.016, false).uses).toHaveLength(1)
  })

  it('tools use continuously and the extinguisher spends its charge', () => {
    const ar = createArsenal()
    expect(ar.create('hacksaw').trigger(O, D, 0.3, true).uses[0]).toMatchObject({ kind: 'tool', tool: 'saw', duration: 0.3 })
    const e = ar.create('extinguisher')
    expect(e.trigger(O, D, 5, true).uses[0]).toMatchObject({ kind: 'extinguish', duration: 5, coolC: 300 })
    expect(e.ammo).toBeCloseTo(7, 9)
    e.trigger(O, D, 10, true)
    expect(e.ammo).toBe(0)
    expect(e.trigger(O, D, 1, true).status).toBe('no_fuel')
  })

  it('hand gives one use per pull', () => {
    const w = createArsenal().create('hand')
    expect(w.trigger(O, D, 0.016, true).uses[0]).toMatchObject({ kind: 'hand', reach: 2 })
    expect(w.trigger(O, D, 0.016, true).uses).toHaveLength(0)
  })
})

describe('kick and shove', () => {
  it('are blunt melee tools in the default loadout right after the hand, with pt-BR names', () => {
    const a = createArsenal()
    expect(DEFAULT_LOADOUT.slice(0, 3)).toEqual(['hand', 'kick', 'shove'])
    expect(a.create('kick').trigger(O, D, 0.016, false).uses[0]).toMatchObject({ kind: 'melee', damage: 'blunt', energy: 250, radius: 0.08, reach: 1.1 })
    expect(a.create('shove').trigger(O, D, 0.016, false).uses[0]).toMatchObject({ kind: 'melee', damage: 'blunt', energy: 80, reach: 1.5 })
    const pt = createArsenal({ locale: 'pt-BR' })
    expect(pt.name('kick')).toBe('chute')
    expect(pt.name('shove')).toBe('empurrão')
  })
})

describe('arsenal', () => {
  it('translates names', () => {
    const pt = createArsenal({ locale: 'pt-BR' })
    expect(pt.name('pistol_9mm')).toBe('pistola 9 mm')
    expect(pt.name('revolver_357')).toBe('revólver .357')
    expect(pt.name('shotgun_pump_12')).toBe('espingarda de repetição calibre 12')
    expect(pt.name('rifle_bolt_308')).toBe('fuzil de ferrolho .308')
    expect(pt.name('crowbar')).toBe('pé de cabra')
    expect(pt.name('claw_hammer')).toBe('martelo de unha')
    expect(pt.name('auto')).toBe('automático')
    expect(createArsenal().name('pistol_9mm')).toBe('9 mm service pistol')
    expect(createArsenal({ locale: 'xx' }).name('hand')).toBe('Hand')
    expect(pt.name('9x19')).toBe('9×19 mm')
  })

  it('has a name in both locales for every weapon', () => {
    const pt = createArsenal({ locale: 'pt-BR' })
    for (const w of WEAPONS) expect(pt.name(w.id)).not.toBe(w.id)
  })

  it('unknown ids throw and custom weapons merge', () => {
    const a = createArsenal({ weapons: [{ id: 'my_gun', name: 'My gun', category: 'pistol', mass: 1, action: { kind: 'firearm', caliber: '9x19', rpm: 100, modes: ['semi'], magazine: 3, reload: 1, spreadDeg: 1, recoil: [1, 1], range: 10, noise: 10 } }] })
    expect(() => a.create('nope')).toThrow()
    expect(a.create('my_gun').capacity).toBe(3)
    expect(a.name('my_gun')).toBe('My gun')
    expect(a.list('pistol').length).toBeGreaterThan(3)
  })
})
