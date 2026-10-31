import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createLightBudget } from '@adatechnology/game-render-three'

import { createPersonBuilder } from '../src'

const BASE = { skin: 0xc49070, hair: { s: 'short', c: 0x222222 }, top: { c: 0x445566, sl: 'long' }, pants: { c: 0x333333 }, shoes: 0x111111 }
const lightsIn = (root: THREE.Object3D): number => {
  let count = 0
  root.traverse((node) => {
    if ((node as THREE.Light).isLight) count++
  })
  return count
}

describe('the flare in the hand through a LightBudget', () => {
  it('is a source that follows the flare, and the person has no light of its own', () => {
    const scene = new THREE.Scene()
    const lights = createLightBudget(THREE, scene, { point: 3, spot: 0, pointShadows: 0 })
    const builder = createPersonBuilder(THREE, { lights })
    const person = builder.build({ ...BASE, hand: 'flare' })
    scene.add(person.root)
    expect(lightsIn(person.root)).toBe(0)
    expect(person.lightSources.length).toBe(1)
    person.root.position.set(5, 0, 0)
    scene.updateMatrixWorld(true)
    lights.present([0, 0, 0], 1)
    const lit = lights.group.children.find((node) => (node as THREE.PointLight).isPointLight) as THREE.PointLight
    expect(lit.intensity).toBe(1.4)
    expect(lit.distance).toBe(4)
    expect(lit.position.x).toBeGreaterThan(4)
    for (const source of person.lightSources) source.remove()
    lights.present([0, 0, 0], 1)
    expect(lights.stats().sources).toBe(0)
  })

  it('without a budget it keeps the PointLight of the page', () => {
    const person = createPersonBuilder(THREE).build({ ...BASE, hand: 'flare' })
    expect(lightsIn(person.root)).toBe(1)
    expect(person.lightSources).toEqual([])
  })
})
