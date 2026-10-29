import { afterEach, describe, expect, it } from 'vitest'
import { makeKit } from './helpers/kit'

/* the builds are long synchronous loops: let the worker report between tests */
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const kit = makeKit()

describe('zone derivation from meta', () => {
  it('derives the car zones from the glasshouse, lights, wheels and engine bay', () => {
    const c = kit.build('proto', 'intact')
    const ids = c.zones.map((z) => z.id)
    expect(ids).toContain('hood')
    expect(ids).toContain('bumper_front')
    expect(ids).toContain('roof')
    expect(ids).toContain('windshield')
    expect(ids).toContain('headlight_left')
    expect(ids).toContain('headlight_right')
    expect(ids).toContain('wheel_front_left')
    expect(ids).toContain('engine')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every zone a box, a direction, a weight, a map rectangle and full health', () => {
    const c = kit.build('proto', 'intact')
    for (const z of c.zones) {
      expect(z.box).toBeTruthy()
      expect(z.map).toHaveLength(4)
      expect(z.weight).toBeGreaterThan(0)
      expect(z.health).toBe(100)
      expect(c.zoneState.health[z.id]).toBe(100)
    }
  })

  it('tags the windshield zone and labels it from the locale', () => {
    const c = kit.build('proto', 'intact')
    const glass = c.zones.find((z) => z.id === 'windshield')
    expect(glass?.tags).toContain('windshield')
    expect(glass?.name).toBe('Windshield')
  })

  it.each([
    ['truck', 'cab_front'],
    ['bike', 'handlebar'],
    ['tank', 'track_left'],
    ['boat', 'bow'],
    ['plane', 'wing_left'],
    ['heli', 'tail_rotor'],
    ['bus', 'chassis'],
  ])('derives family zones for %s (%s)', (key, zone) => {
    const ids = kit.build(key, 'intact').zones.map((z) => z.id)
    expect(ids.length).toBeGreaterThan(3)
    expect(ids).toContain(zone)
  })

  it('weights the overall health by zone weight', () => {
    const c = kit.build('proto', 'intact', { health: { engine: 0 } })
    const overall = kit.zoneOverall(c)
    expect(overall.health).toBeLessThan(100)
    expect(overall.health).toBeGreaterThan(80)
    expect(overall.band).toBe(kit.bandOf(overall.health))
  })

  it('finds the zone at a point and reports damage per zone', () => {
    const c = kit.build('proto', 'intact')
    const THREE = kit.THREE
    expect(kit.zoneAt(c, new THREE.Vector3(2, 0.6, 0))?.id).toBe('bumper_front')
    const hit = kit.zoneDamageAt(c, new THREE.Vector3(2, 0.6, 0), new THREE.Vector3(-1, 0, 0), 1) as any
    expect(hit.main).toBe('bumper_front')
    expect(hit.list[0]).toEqual({ id: 'bumper_front', name: 'Front bumper', damage: 36 })
  })
})
