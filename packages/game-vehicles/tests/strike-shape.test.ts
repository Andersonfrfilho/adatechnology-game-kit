import { describe, expect, it } from 'vitest'
import { WEAPONS, meleeFamilyOf } from '@adatechnology/game-weapons'
import { strikeMarkShape, type StrikeMarkShape } from '../src'

/** The mark a hand-held weapon of the SDK's arsenal leaves on a car door (steel): its energy and contact radius, a club's contact line from its family. */
function markOf(weaponId: string, material = 'steel'): StrikeMarkShape | null {
  const weapon = WEAPONS.find((entry) => entry.id === weaponId)
  if (!weapon || weapon.action.kind !== 'melee') throw new Error(`no melee weapon ${weaponId} in the SDK`)
  const contactLength = meleeFamilyOf(weaponId)?.contactLength
  return strikeMarkShape({ type: weapon.action.damage, energy: weapon.action.energy, radius: weapon.action.radius, ...(contactLength !== undefined ? { contactLength } : {}), material })
}

describe('a hand-held blow leaves the mark of the weapon in a car door (SDK weapon data, no table per weapon)', () => {
  it('a punch: a small shallow round dent, the paint whole', () => {
    const fist = markOf('fists')!
    expect(fist.kind).toBe('dent')
    expect(fist.depth).toBeGreaterThan(0.002)
    expect(fist.depth).toBeLessThan(0.006)
    expect(fist.paintCracks).toBe(false)
    expect(fist.length).toBe(fist.width)
  })

  it('a kick: a deeper dent than a punch, and the paint cracks over it', () => {
    const fist = markOf('fists')!
    const kick = markOf('kick')!
    expect(kick.kind).toBe('dent')
    expect(kick.depth).toBeGreaterThan(fist.depth * 2)
    expect(kick.paintCracks).toBe(true)
  })

  it('a bat or a pipe swung level: a long crease along its barrel', () => {
    for (const id of ['baseball_bat', 'iron_pipe']) {
      const mark = markOf(id)!
      expect(mark.kind, id).toBe('crease')
      expect(mark.length).toBeGreaterThan(mark.width * 3)
      expect(mark.depth).toBeGreaterThan(markOf('fists')!.depth)
    }
  })

  it('a knife scratches the paint, a machete cuts to the bare metal, a katana or an axe opens a gash; the longer the stronger', () => {
    const knife = markOf('knife')!
    const machete = markOf('machete')!
    const katana = markOf('katana')!
    expect(knife.kind).toBe('scratch')
    expect(machete.kind).toBe('cut')
    expect(katana.kind).toBe('gash')
    expect(markOf('axe')!.kind).toBe('gash')
    expect(knife.length).toBeLessThan(machete.length)
    expect(machete.length).toBeLessThan(katana.length)
    expect(knife.depth).toBe(0)
    expect(katana.through).toBe(true)
  })

  it('a plastic bumper takes a blade as a cut, never a gash in sheet metal; glass and rubber take no mark here', () => {
    expect(markOf('katana', 'plastic')!.kind).toBe('cut')
    expect(markOf('baseball_bat', 'glass')).toBeNull()
    expect(markOf('knife', 'rubber')).toBeNull()
  })
})
