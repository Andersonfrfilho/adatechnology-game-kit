import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { HEMISPHERE_INTENSITY, createLight } from '../src/world/light'

describe('the ambient fill of the host', () => {
  it('is the hemisphere light the scene has, with the clear day intensity, so a game can scale it', () => {
    const scene = new THREE.Scene()
    const light = createLight({ THREE, scene })
    expect(light.ambient.isHemisphereLight).toBe(true)
    expect(light.ambient.intensity).toBe(HEMISPHERE_INTENSITY)
    expect(light.group.children).toContain(light.ambient)
    light.ambient.intensity = 1
    expect(scene.getObjectByName('kit-world-light')?.children.find((child) => (child as THREE.HemisphereLight).isHemisphereLight)).toBe(light.ambient)
  })
})
