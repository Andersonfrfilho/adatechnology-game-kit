import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleContext } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** A headlight breaks by the material of its lens: glass shatters at once, polycarbonate takes holes and cracks first. Its bulbs go dark when a round reaches them. */
type Lamp = { kind: string; lens: Array<{ visible: boolean; material: unknown }>; inner: Array<{ material: unknown }>; broken: boolean | string; dark?: boolean; cracked?: boolean }

const PISTOL = { type: 'ballistic', energy: 527, caliber: 9 } as const

function car(key: string) {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  item.root.updateMatrixWorld(true)
  const c = item.vehicle as VehicleContext
  const bulbBroken = (kit as unknown as { _: { MATERIALS: { bulbBroken: unknown } } })._.MATERIALS.bulbBroken
  const part = d.describe().parts.find((p) => p.id === 'headlight_left')!
  const at = d.partWorldCenter!('headlight_left')
  // a round at the lens, from in front of the car or from its side, wherever the surface ray reaches it
  const shot = () => {
    const hit = d.surfaceRay!({ origin: [at[0] + 3, at[1], at[2]], direction: [-1, 0, 0], maxDistance: 10 }) ?? d.surfaceRay!({ origin: [at[0], at[1], at[2] + 3], direction: [0, 0, -1], maxDistance: 10 })
    expect(hit?.part).toBe('headlight_left')
    return d.hit({ ...PISTOL, point: hit!.point, part: hit!.part, normal: hit!.normal, direction: [-1, 0, 0] })
  }
  /** The lamp of the part: the one its zone draws. */
  const lampOf = (): Lamp => {
    const zone = (kit as unknown as { zonesOf(c: unknown): Array<{ id: string; lights: Lamp[] }> }).zonesOf(c).find((z) => z.id === 'headlight_left')!
    return zone.lights[0]!
  }
  return { d, part, shot, lamp: lampOf, bulbBroken }
}

describe('a headlight hit', () => {
  it('of polycarbonate (a modern car) takes a hole, cracks and goes dark, and comes apart after a few rounds', () => {
    const { part, shot, lamp, bulbBroken } = car('midsize_sedan')
    expect(part.material).toBe('plastic')
    expect(part.tags).toContain('lens_polycarbonate')
    const first = shot()
    expect(first.some((e) => e.type === 'hole')).toBe(true)
    expect(first.some((e) => e.type === 'fracture')).toBe(false)
    const L = lamp()
    expect(L.cracked).toBe(true)
    expect(L.lens.every((m) => m.visible)).toBe(true)
    // the round went through to the bulb: no light, no glow
    expect(L.inner.every((m) => m.material === bulbBroken)).toBe(true)
    let broke = false
    for (let i = 0; i < 4 && !broke; i++) broke = shot().some((e) => e.type === 'fracture')
    expect(broke).toBe(true)
    expect(L.broken).toBeTruthy()
    expect(L.lens.every((m) => !m.visible)).toBe(true)
  })
  it('of glass (an older car) shatters at the first round and goes dark', () => {
    const { part, shot, lamp, bulbBroken } = car('beetle')
    expect(part.material).toBe('glass')
    expect(shot().some((e) => e.type === 'fracture')).toBe(true)
    const L = lamp()
    expect(L.broken).toBeTruthy()
    expect(L.inner.every((m) => m.material === bulbBroken)).toBe(true)
  })
  it('by a blow: a kick shatters glass and only cracks polycarbonate, which stays lit', () => {
    const kick = { type: 'blunt', energy: 300, radius: 0.08 } as const
    const glass = car('beetle')
    const g = glass.d.hit({ ...kick, point: glass.d.partWorldCenter!('headlight_left') })
    expect(g.some((e) => e.type === 'fracture' && 'part' in e && e.part === 'headlight_left')).toBe(true)
    const plastic = car('midsize_sedan')
    const p = plastic.d.hit({ ...kick, point: plastic.d.partWorldCenter!('headlight_left') })
    expect(p.some((e) => e.type === 'fracture' && 'part' in e && e.part === 'headlight_left')).toBe(false)
    const L = plastic.lamp()
    expect(L.cracked).toBe(true)
    expect(L.inner.some((m) => m.material !== plastic.bulbBroken)).toBe(true)
  })
})
