import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createPlayerAvatar } from '../src'

describe('the places on the body that take a weapon', () => {
  const avatar = createPlayerAvatar(THREE)
  avatar.update(1 / 60, {})
  avatar.root.updateMatrixWorld(true)
  const at = (name: 'hip' | 'back' | 'sling'): THREE.Vector3 => avatar.root.worldToLocal(avatar.slot(name).getWorldPosition(new THREE.Vector3()))

  it('the sling holds a long gun on the front of the chest, a little to the weapon side, above the hip holster', () => {
    const sling = at('sling')
    const back = at('back')
    const hip = at('hip')
    expect(sling.z).toBeGreaterThan(0.05)
    expect(back.z).toBeLessThan(-0.05)
    expect(sling.x).toBeLessThan(0)
    expect(sling.x).toBeGreaterThan(-0.15)
    expect(sling.y).toBeGreaterThan(hip.y + 0.25)
    expect(sling.y).toBeLessThan(avatar.heightMetres * 0.8)
  })

  it('each socket keeps the body\'s own turn', () => {
    for (const name of ['hip', 'back', 'sling'] as const) {
      const turn = avatar.slot(name).getWorldQuaternion(new THREE.Quaternion())
      expect(turn.angleTo(avatar.root.getWorldQuaternion(new THREE.Quaternion())), name).toBeLessThan(0.35)
    }
  })
})
