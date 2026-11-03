import { createLightBudget, isNeutralFog } from '@adatechnology/game-render-three'
import { createWeather } from '@adatechnology/game-weather'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createHeadlights, createLightning, createWeatherRenderer } from '../src'

const world = (state: string, startHour = 12) => createWeather({ seed: 3, start: state, startHour, autoSchedule: false })
const lightsIn = (root: THREE.Object3D): number => {
  let count = 0
  root.traverse((node) => {
    if ((node as THREE.Light).isLight) count++
  })
  return count
}

describe('headlights through a LightBudget', () => {
  it('are two sources that follow the lamps, aimed where the spots were, with no light on the car', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 0, spot: 2, pointShadows: 0 })
    const headlights = createHeadlights(THREE, { lights })
    const car = new THREE.Group()
    scene.add(car)
    const detach = headlights.attach(car)
    expect(lightsIn(car)).toBe(0)
    const night = world('clear', 23).sample()
    headlights.update(night, 0.016, [0, 0, 0])
    scene.updateMatrixWorld(true)
    lights.present([0, 0, 0], 1)
    expect(lights.stats().lit).toBe(2)
    const spots = lights.group.children.filter((child) => (child as THREE.SpotLight).isSpotLight) as THREE.SpotLight[]
    expect(spots.map((spot) => spot.intensity)).toEqual([2.4, 2.4])
    const aim = spots[0]!.target.position.clone().sub(spots[0]!.position).normalize()
    const lamp = new THREE.Vector3(0.65, 0.74, 2.15)
    const expected = new THREE.Vector3(spots[0]!.position.x > 0 ? 0.65 : -0.65, 0.2, 12).sub(new THREE.Vector3(spots[0]!.position.x > 0 ? 0.65 : -0.65, lamp.y, lamp.z)).normalize()
    expect(aim.dot(expected)).toBeGreaterThan(0.9999)
    headlights.update(world('clear', 12).sample(), 0.016, [0, 0, 0])
    lights.present([0, 0, 0], 1)
    expect(lights.stats().lit).toBe(0)
    detach()
    expect(lights.stats().sources).toBe(0)
  })
})

describe('lightning through a LightBudget', () => {
  it('leases a hemisphere slot, leaves the scene alone and only changes the intensity', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 0, spot: 0, hemisphere: 1 })
    const before = lightsIn(scene)
    const lightning = createLightning(THREE, scene, undefined, { lights })
    expect(lightsIn(scene)).toBe(before)
    expect(lights.group.children).toContain(lightning.light)
    lightning.update({ ...world('storm').sample(), flash: 1 })
    expect(lightning.light.intensity).toBeCloseTo(3.2)
    lightning.dispose()
    expect(lightning.light.intensity).toBe(0)
    expect(lights.group.children).toContain(lightning.light)
  })

  it('without a hemisphere slot left the light stays out of the scene', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 0, spot: 0, hemisphere: 0 })
    const before = lightsIn(scene)
    createLightning(THREE, scene, undefined, { lights })
    expect(lightsIn(scene)).toBe(before)
  })
})

describe('the weather renderer with a LightBudget', () => {
  it('keeps the fog in the scene whatever the layer does, and creates no light of its own', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, 1, 0.08, 400)
    const lights = createLightBudget(THREE, scene, { point: 0, spot: 2, pointShadows: 0, hemisphere: 1 })
    const own = lightsIn(scene)
    const renderer = createWeatherRenderer(THREE, { scene, camera, weather: world('storm'), lights, random: () => 0.5 })
    renderer.update(0.05)
    expect((scene.fog as THREE.Fog).isFog).toBe(true)
    renderer.setLayer('fog', false)
    expect(isNeutralFog(scene.fog)).toBe(true)
    renderer.update(0.05)
    renderer.setLayer('fog', true)
    renderer.update(0.05)
    expect((scene.fog as THREE.Fog).far).toBe(110)
    expect(lightsIn(scene)).toBe(own)
    renderer.dispose()
  })
})
