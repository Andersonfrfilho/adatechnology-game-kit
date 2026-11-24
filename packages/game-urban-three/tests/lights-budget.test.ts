import { createLightBudget } from '@adatechnology/game-render-three'
import { createUrban } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createUrbanThree, physicalIntensityOf } from '../src'
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

  it('with physicalLights the lamp and the searchlight get the calibrated intensity, and a failing lamp dips it', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 4, spot: 2, pointShadows: 0 })
    const builder = kit.builder({ budget: 99 })
    kit.poles.get('led_double').build(builder, { x: 4, z: 0, on: true, flicker: true })
    kit.props.watchtower(builder, 2, -3, true)
    const drawn = createUrbanThree(THREE, { document: fakeDocument, lights, physicalLights: true }).draw(builder.scene())
    scene.add(drawn.root)
    scene.updateMatrixWorld(true)
    const full = physicalIntensityOf({ intensity: 1.3, distance: 24, decay: 2, y: 8 })
    const seen = new Set<number>()
    for (let t = 0; t < 10; t += 0.05) {
      drawn.animate(t)
      lights.present([0, 0, 0], 1)
      const lamp = lights.group.children.find((child) => (child as THREE.PointLight).isPointLight && (child as THREE.PointLight).intensity > 0) as THREE.PointLight | undefined
      seen.add(lamp?.intensity ?? 0)
    }
    expect([...seen].some((value) => Math.abs(value - full) < 1e-6)).toBe(true)
    expect([...seen].some((value) => Math.abs(value - full * 0.15) < 1e-6)).toBe(true)
    const spotPart = builder.scene().parts.find((part) => part.shape === 'light' && part.kind === 'spot')
    if (spotPart?.shape !== 'light' || spotPart.kind !== 'spot') throw new Error('the watchtower has no searchlight')
    const beam = Math.hypot(spotPart.target.x - spotPart.x, spotPart.target.y - spotPart.y, spotPart.target.z - spotPart.z)
    const spot = lights.group.children.find((child) => (child as THREE.SpotLight).isSpotLight && (child as THREE.SpotLight).intensity > 0) as THREE.SpotLight
    expect(spot.intensity).toBeCloseTo(physicalIntensityOf(spotPart, beam), 6)
    drawn.dispose()
  })

  it('with flickerLenses a failing lamp blinks its lens, even when it got no light; without it the lens stays lit', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 4, spot: 0, pointShadows: 0 })
    const builder = kit.builder({ budget: 0 })
    kit.poles.get('concrete_arm').build(builder, { x: 4, z: 0, on: true, flicker: true })
    kit.poles.get('concrete_arm').build(builder, { x: 40, z: 0, on: true })
    const lensesOf = (root: THREE.Object3D): THREE.MeshBasicMaterial[] => {
      const found: THREE.MeshBasicMaterial[] = []
      root.traverse((node) => {
        const material = (node as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined
        if (material?.type === 'MeshBasicMaterial' && !found.includes(material)) found.push(material)
      })
      return found
    }
    const steady = createUrbanThree(THREE, { document: fakeDocument, lights }).draw(builder.scene())
    expect(lensesOf(steady.root)).toHaveLength(1)
    steady.dispose()
    const drawn = createUrbanThree(THREE, { document: fakeDocument, lights, flickerLenses: true }).draw(builder.scene())
    const lenses = lensesOf(drawn.root)
    expect(lenses).toHaveLength(2)
    const levels = lenses.map(() => new Set<number>())
    for (let t = 0; t < 10; t += 0.05) {
      drawn.animate(t)
      lenses.forEach((lens, index) => levels[index]!.add(Number(lens.color.r.toFixed(4))))
    }
    expect(levels.map((set) => set.size).sort()).toEqual([1, 2])
    drawn.dispose()
  })

  it('lights the foot of the lamp as the r128 page did, under physically correct lights', () => {
    const part = { intensity: 1.3, distance: 20, decay: 2, y: 7.2 }
    const physical = physicalIntensityOf(part)
    const atFoot = (physical / part.y ** 2) * (1 - (part.y / part.distance) ** 4) ** 2 / Math.PI
    expect(atFoot).toBeCloseTo(part.intensity * (1 - part.y / part.distance) ** 2, 9)
    expect(physical).toBeGreaterThan(50)
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
