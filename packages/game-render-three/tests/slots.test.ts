import { describe, expect, it, vi } from 'vitest'

import { LIGHT_PRIORITY, createLightBudget } from '../src'
import { FOCUS, THREE, fakeRendererState, lampSource, lightAt } from './helpers'

function sceneWithChildren(): InstanceType<typeof THREE.Scene> {
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(), new THREE.Group())
  return scene
}

describe('slots at boot', () => {
  it('creates the point, shadow and hemisphere lights, dark, visible, on every layer, first in the scene', () => {
    const scene = sceneWithChildren()
    const budget = createLightBudget(THREE, scene, { point: 4, pointShadows: 2, hemisphere: 1, spot: 1 })
    expect(scene.children[0]).toBe(budget.group)
    const points: InstanceType<typeof THREE.PointLight>[] = []
    const hemispheres: InstanceType<typeof THREE.HemisphereLight>[] = []
    budget.group.traverse((object) => {
      if ((object as InstanceType<typeof THREE.PointLight>).isPointLight) points.push(object as InstanceType<typeof THREE.PointLight>)
      if ((object as InstanceType<typeof THREE.HemisphereLight>).isHemisphereLight) hemispheres.push(object as InstanceType<typeof THREE.HemisphereLight>)
    })
    expect(points).toHaveLength(4)
    expect(points.map((light) => light.castShadow)).toEqual([true, true, false, false])
    expect(hemispheres).toHaveLength(1)
    for (const light of [...points, ...hemispheres]) {
      expect(light.visible).toBe(true)
      expect(light.intensity).toBe(0)
      expect(light.layers.mask).toBe(-1)
    }
    expect(points[0]?.shadow.autoUpdate).toBe(false)
  })
})

describe('preemption', () => {
  function fullOfLamps() {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 3, pointShadows: 0, urgentReserve: 0, fadeMs: 100 })
    const lamps = [1, 2, 3].map((x) => budget.addSource(lampSource(`lamp${x}`, x)))
    budget.present(FOCUS, 1)
    return { scene, budget, lamps }
  }

  it('an urgent request takes the slot of the weakest source in the same present, cutting it', () => {
    const { budget, lamps } = fullOfLamps()
    expect(lamps.map((lamp) => lamp.slot)).not.toContain(-1)
    const lost = vi.fn()
    const handle = budget.acquire({ owner: 'blast', priority: LIGHT_PRIORITY.blast, urgent: true, color: 0xff0000, intensity: 5, distance: 20, position: [0, 1, 0], onLost: lost })
    expect(handle).not.toBeNull()
    expect(lamps[2]?.slot).toBe(-1)
    expect(lightAt(budget.group, handle?.slot ?? -1).intensity).toBe(5)
    expect(lost).not.toHaveBeenCalled()
  })

  it('without urgent the victim fades for fadeMs before the new owner shows', () => {
    const { budget, lamps } = fullOfLamps()
    const handle = budget.acquire({ owner: 'flare', priority: LIGHT_PRIORITY.flare, color: 0xffffff, intensity: 3, distance: 10, position: [0, 0, 0] })
    expect(handle?.alive).toBe(true)
    const light = lightAt(budget.group, handle?.slot ?? -1)
    expect(light.intensity).toBe(1)
    expect(lamps[2]?.slot).toBe(-1)
    budget.present(FOCUS, 0.05)
    expect(light.intensity).toBeCloseTo(0.5, 5)
    budget.present(FOCUS, 0.06)
    expect(light.intensity).toBe(0)
    budget.present(FOCUS, 1)
    expect(light.intensity).toBe(3)
  })

  it('a request of lower priority than every holder gets null', () => {
    const { budget } = fullOfLamps()
    const handle = budget.acquire({ owner: 'weak', priority: 100, color: 0xffffff, intensity: 1, distance: 5, position: [0, 0, 0] })
    expect(handle).toBeNull()
    expect(budget.stats().refused).toBe(1)
  })

  it('tells a request it lost the slot and kills its handle', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 1, pointShadows: 0, urgentReserve: 0 })
    const lost = vi.fn()
    const first = budget.acquire({ owner: 'a', priority: 100, color: 1, intensity: 1, distance: 5, position: [0, 0, 0], onLost: lost })
    budget.acquire({ owner: 'b', priority: 900, urgent: true, color: 1, intensity: 1, distance: 5, position: [0, 0, 0] })
    expect(lost).toHaveBeenCalledTimes(1)
    expect(first?.alive).toBe(false)
  })
})

describe('urgent reserve', () => {
  it('lamps never take the last two free slots; urgent requests do', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 4, pointShadows: 0, spot: 0, urgentReserve: 2 })
    const lamps = [1, 2, 3, 4].map((x) => budget.addSource(lampSource(`lamp${x}`, x)))
    budget.present(FOCUS, 1)
    expect(lamps.filter((lamp) => lamp.slot >= 0)).toHaveLength(2)
    expect(budget.stats().free).toBe(2)
    const blasts = [0, 1].map(() => budget.acquire({ owner: 'blast', priority: LIGHT_PRIORITY.blast, urgent: true, color: 1, intensity: 1, distance: 5, position: [0, 0, 0] }))
    expect(blasts.every((handle) => handle !== null)).toBe(true)
    expect(budget.stats().free).toBe(0)
  })
})

describe('hysteresis', () => {
  it('two sources at the same distance trading places 1 cm per frame keep their slots', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 1, pointShadows: 0, urgentReserve: 0, fadeMs: 0 })
    const near = budget.addSource(lampSource('a', 1))
    const far = budget.addSource(lampSource('b', -1))
    budget.present(FOCUS, 1)
    const winner = near.slot >= 0 ? 'a' : 'b'
    for (let frame = 0; frame < 40; frame++) {
      const shift = frame % 2 === 0 ? 0.01 : -0.01
      budget.present([shift, 0, 0], 0.016)
      expect(winner === 'a' ? near.slot : far.slot).toBe(0)
      expect(winner === 'a' ? far.slot : near.slot).toBe(-1)
    }
  })

  it('a clearly closer source of the same priority takes the slot', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 1, pointShadows: 0, urgentReserve: 0, fadeMs: 0 })
    const a = budget.addSource(lampSource('a', 10))
    const b = budget.addSource(lampSource('b', 12))
    budget.present(FOCUS, 1)
    expect(a.slot).toBe(0)
    b.update({ position: [2, 0, 0] })
    budget.present(FOCUS, 0.016)
    budget.present(FOCUS, 0.016)
    expect(b.slot).toBe(0)
    expect(a.slot).toBe(-1)
  })
})

describe('follow', () => {
  it('tracks the object, reads it once per present, and goes dark when it leaves the scene', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 2, pointShadows: 0, urgentReserve: 0, fadeMs: 0 })
    const bulb = new THREE.Object3D()
    scene.add(bulb)
    bulb.position.set(3, 2, 1)
    const spy = vi.spyOn(bulb, 'getWorldPosition')
    const source = budget.addSource({ ...lampSource('bulb', 0), position: [0, 0, 0], follow: bulb })
    budget.present(FOCUS, 1)
    expect(spy).toHaveBeenCalledTimes(1)
    const light = lightAt(budget.group, source.slot)
    expect(light.position.toArray()).toEqual([3, 2, 1])
    bulb.position.set(-4, 0, 0)
    budget.present(FOCUS, 1)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(light.position.toArray()).toEqual([-4, 0, 0])
    scene.remove(bulb)
    budget.present(FOCUS, 1)
    expect(source.slot).toBe(-1)
    expect(light.intensity).toBe(0)
  })

  it('aims a spot along the world -z of the followed object', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 0, spot: 1, pointShadows: 0, urgentReserve: 0, fadeMs: 0 })
    const rail = new THREE.Object3D()
    scene.add(rail)
    rail.position.set(1, 0, 0)
    rail.updateMatrixWorld(true)
    const source = budget.addSource({ ...lampSource('rail', 0), kind: 'spot', position: [0, 0, 0], follow: rail })
    budget.present(FOCUS, 1)
    expect(source.slot).toBe(0)
    let spot: InstanceType<typeof THREE.SpotLight> | undefined
    budget.group.traverse((object) => {
      if ((object as InstanceType<typeof THREE.SpotLight>).isSpotLight) spot = object as InstanceType<typeof THREE.SpotLight>
    })
    expect(spot?.target.position.toArray()).toEqual([1, 0, -1])
  })
})

describe('lease', () => {
  it('hands out fixed slots, shadows first, that are never preempted', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 6, pointShadows: 2, hemisphere: 1, urgentReserve: 0 })
    const lease = budget.lease({ owner: 'rooms', point: 6, shadows: 2 })
    expect(lease?.handles.map((handle) => handle.slot)).toEqual([0, 1, 2, 3, 4, 5])
    expect(budget.lease({ owner: 'more', point: 1 })).toBeNull()
    expect(budget.acquire({ owner: 'blast', priority: 900, urgent: true, color: 1, intensity: 1, distance: 5, position: [0, 0, 0] })).toBeNull()
    lease?.handles[3]?.update({ intensity: 2, color: 0xff00ff })
    expect(lightAt(budget.group, 3).intensity).toBe(2)
    expect(budget.stats().leased).toBe(6)
    lease?.release()
    expect(budget.stats().leased).toBe(0)
  })

  it('leaseHemisphere gives each boot light once, then null', () => {
    const budget = createLightBudget(THREE, new THREE.Scene(), { hemisphere: 1 })
    const light = budget.leaseHemisphere('weather.lightning')
    expect(light?.intensity).toBe(0)
    expect(budget.leaseHemisphere('other')).toBeNull()
  })

  it('marks the shadow of a leased slot when its light moves', () => {
    const budget = createLightBudget(THREE, new THREE.Scene(), { point: 2, pointShadows: 1 })
    const lease = budget.lease({ owner: 'rooms', point: 2, shadows: 1 })
    const shadowLight = lightAt(budget.group, 0)
    shadowLight.shadow.needsUpdate = false
    lease?.handles[0]?.update({ position: [1, 2, 3], intensity: 1 })
    expect(shadowLight.shadow.needsUpdate).toBe(true)
  })
})

describe('fixed light count', () => {
  it('1000 random operations never change the sealed signature, and a stray light is reported', () => {
    const scene = new THREE.Scene()
    scene.add(new THREE.DirectionalLight(0xffffff, 1))
    const budget = createLightBudget(THREE, scene, { point: 6, pointShadows: 2, spot: 2, hemisphere: 1 })
    const renderer = fakeRendererState()
    budget.seal(renderer, scene)
    let seed = 7
    const random = (): number => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
    const handles: Array<ReturnType<typeof budget.acquire>> = []
    const sources: Array<ReturnType<typeof budget.addSource>> = []
    for (let step = 0; step < 1000; step++) {
      const roll = random()
      if (roll < 0.3) handles.push(budget.acquire({ owner: 'r', kind: random() < 0.3 ? 'spot' : 'point', priority: Math.floor(random() * 900), urgent: random() < 0.5, color: 1, intensity: 1, distance: 5, position: [random() * 10, 0, 0] }))
      else if (roll < 0.5) handles[Math.floor(random() * handles.length)]?.release({ fadeMs: random() < 0.5 ? 0 : 50 })
      else if (roll < 0.7) sources.push(budget.addSource(lampSource('s', random() * 20, Math.floor(random() * 500))))
      else if (roll < 0.8) sources.splice(Math.floor(random() * sources.length), 1)[0]?.remove()
      else budget.present([random() * 10, 0, 0], 0.016)
      expect(budget.check(renderer, scene).ok).toBe(true)
    }
    scene.add(new THREE.PointLight(0xffffff, 1))
    const result = budget.check(renderer, scene)
    expect(result.ok).toBe(false)
    expect(result.strays).toHaveLength(1)
  })
})
