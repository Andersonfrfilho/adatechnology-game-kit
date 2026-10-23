/** Smoke test: the demo vehicle of `example/example.html`, built through a content plugin exactly as the example does. */
import { describe, expect, it } from 'vitest'
import { DEMO_CAR } from './helpers/sample-fleet'
import { makeKit } from './helpers/kit'

function demoKit() {
  const kit = makeKit(
    {
      bands: [{ name: 'Pristine', color: '#4aa3df' }],
      fluids: { paint: { fresh: '#2a6fd6', dry: '#1b3f7a', dryTime: 120, wipeable: true } },
      impactStain: 'paint',
      defaultSplat: 'paint',
      texts: { who: 'the driver', plate: 'RALLY-01' },
      defaultGroup: 'Prototypes',
      damagedScenario: 'front',
      scenarios: [
        {
          id: 'front',
          name: 'Crushed nose',
          init: (x) => {
            x.limit = x.front - 0.4 * x.length
          },
          zone: (z, x) => {
            if (x.center.x > x.limit) x.set(z, 15 + x.rand() * 20)
          },
        },
        {
          id: 'rolled',
          name: 'Rolled',
          zone: (z, x) => {
            if (z.type === 'roof') x.set(z, 10)
            x.flags.flipped = true
          },
        },
      ],
    },
    false,
  )
  kit.register({ key: 'meteor', name: 'Meteor 1', fuel: 'flex', hood: true }, (c) => kit.car(c, JSON.parse(JSON.stringify(DEMO_CAR))))
  return kit
}

describe('demo vehicle', () => {
  it('builds in the three states, with a root to add to the scene', () => {
    const kit = demoKit()
    expect(kit.find('meteor')?.group).toBe('Prototypes')
    for (const state of ['intact', 'damaged', 'modified'] as const) {
      const c = kit.build('meteor', state)
      expect(c.root.isObject3D).toBe(true)
      expect(c.zoneErrors ?? []).toEqual([])
      expect(c.zones.length).toBeGreaterThan(20)
      let meshes = 0
      c.root.traverse((o: any) => {
        if (o.isMesh) meshes++
      })
      expect(meshes).toBeGreaterThan(50)
      kit.dispose(c)
    }
  })

  it('measures the body from the spec', () => {
    const c = demoKit().build('meteor', 'intact')
    expect(c.meta.kind).toBe('car')
    expect(c.meta.front).toBeGreaterThan(1.5)
    expect(c.meta.rear).toBeLessThan(-1.5)
    expect(c.meta.color).toBe('#c23b22')
  })

  it('shows damage after the damagedScenario, a scenario run and an impact', () => {
    const kit = demoKit()
    const damaged = kit.build('meteor', 'damaged')
    expect(kit.zoneOverall(damaged).health).toBeLessThan(100)
    const c = kit.build('meteor', 'intact')
    kit.applyZones(c, kit.zoneScenario(c, 'rolled'))
    expect(c.zoneState.flags.flipped).toBe(true)
    const log = kit.impact(c, new kit.THREE.Vector3(2, 0.6, 0), new kit.THREE.Vector3(-1, 0, 0), 1)
    expect(log.length).toBeGreaterThan(0)
  })

  it('stays inside the bounds of a real car (metres)', () => {
    const kit = demoKit()
    const c = kit.build('meteor', 'intact')
    const THREE = kit.THREE
    const bb = new THREE.Box3().setFromObject(c.root)
    expect(bb.max.x - bb.min.x).toBeGreaterThan(3.5)
    expect(bb.max.x - bb.min.x).toBeLessThan(5.5)
    expect(bb.min.y).toBeGreaterThanOrEqual(-0.05)
    expect(bb.max.y).toBeLessThan(2)
  })
})
