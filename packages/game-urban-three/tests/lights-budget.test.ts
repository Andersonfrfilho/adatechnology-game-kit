import { createLightBudget } from '@adatechnology/game-render-three'
import { createUrban } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'

const kit = createUrban()
const lightsIn = (root: THREE.Object3D): number => {
  let count = 0
  root.traverse((node) => {
    if ((node as THREE.Light).isLight) count++
  })
  return count
}

describe('urban lights through a LightBudget', () => {
  it('a lamp is a source of the budget: no light in the scene, the nearest ones get the slots', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 6, spot: 0, pointShadows: 0 })
    const urban = createUrbanThree(THREE, { document: fakeDocument, lights })
    const builder = kit.builder({ budget: 99 })
    kit.poles.get('led_double').build(builder, { x: 4, z: 0, on: true })
    kit.poles.get('led_double').build(builder, { x: 400, z: 0, on: true })
    const drawn = urban.draw(builder.scene())
    scene.add(drawn.root)
    expect(lightsIn(drawn.root)).toBe(0)
    expect(drawn.lights.length).toBeGreaterThan(1)
    scene.updateMatrixWorld(true)
    lights.present([0, 0, 0], 1)
    const lit = lights.group.children.filter((child) => (child as THREE.PointLight).isPointLight && (child as THREE.PointLight).intensity > 0) as THREE.PointLight[]
    expect(lit.length).toBe(lights.stats().lit)
    expect(lit.length).toBeLessThanOrEqual(4)
    expect(Math.min(...lit.map((light) => light.position.x))).toBeCloseTo(4, 0)
    drawn.dispose()
    expect(lights.stats().sources).toBe(0)
  })

  it('a flickering lamp dips its source on the beats of the page formula', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 4, spot: 0, pointShadows: 0 })
    const builder = kit.builder({ budget: 99 })
    kit.poles.get('led_double').build(builder, { x: 4, z: 0, on: true, flicker: true })
    const drawn = createUrbanThree(THREE, { document: fakeDocument, lights }).draw(builder.scene())
    scene.add(drawn.root)
    scene.updateMatrixWorld(true)
    const seen = new Set<number>()
    for (let t = 0; t < 10; t += 0.05) {
      drawn.animate(t)
      lights.present([0, 0, 0], 1)
      const lamp = lights.group.children.find((child) => (child as THREE.PointLight).isPointLight && (child as THREE.PointLight).intensity > 0) as THREE.PointLight | undefined
      seen.add(lamp?.intensity ?? 0)
    }
    expect(seen.has(1.3)).toBe(true)
    expect([...seen].some((value) => value > 0 && value < 1.3)).toBe(true)
  })

  it('the searchlight aim circles the tower', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 2, spot: 2, pointShadows: 0 })
    const builder = kit.builder()
    kit.props.watchtower(builder, 2, -3, true)
    const drawn = createUrbanThree(THREE, { document: fakeDocument, lights }).draw(builder.scene())
    scene.add(drawn.root)
    const aimAt = (t: number): THREE.Vector3 => {
      drawn.animate(t)
      scene.updateMatrixWorld(true)
      lights.present([0, 0, 0], 1)
      const spot = lights.group.children.find((child) => (child as THREE.SpotLight).isSpotLight && (child as THREE.SpotLight).intensity > 0) as THREE.SpotLight
      return spot.target.position.clone().sub(spot.position).normalize()
    }
    const first = aimAt(0)
    const later = aimAt(2)
    expect(first.dot(later)).toBeLessThan(0.999)
  })
})
