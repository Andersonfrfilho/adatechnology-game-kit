import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createPlayerAvatar } from '@adatechnology/game-characters-three'
import { coincidentFacesOf, describeCoincidentFaces } from '@adatechnology/game-shapes-three'
import { createArsenal } from '@adatechnology/game-weapons'

import { createHolsteredWeapons } from '../src'

const poseOf = (socket: THREE.Object3D) => {
  socket.updateWorldMatrix(true, false)
  const position = socket.getWorldPosition(new THREE.Vector3())
  const quaternion = socket.getWorldQuaternion(new THREE.Quaternion())
  return { position: [position.x, position.y, position.z] as [number, number, number], quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [number, number, number, number] }
}

/** The weapons put away on the player's body: a pistol on the hip, a rifle and a shotgun across the back. */
const CASES = [
  ['beretta_92fs', 'hip'],
  ['glock_17', 'hip'],
  ['ak_12', 'back'],
  ['remington_870', 'back'],
] as const

describe('weapons put away on the body', () => {
  const arsenal = createArsenal()

  for (const [weapon, slot] of CASES) {
    it(`${weapon} on the ${slot}: drawn at the place of the body, outside it, no face on a plane of the body's`, () => {
      const avatar = createPlayerAvatar(THREE as never)
      avatar.update(1 / 60, {})
      const scene = new THREE.Scene()
      scene.add(avatar.root)
      scene.updateMatrixWorld(true)
      const before = coincidentFacesOf(avatar.root, { maxHits: Number.POSITIVE_INFINITY }).length
      const holstered = createHolsteredWeapons({ THREE, scene, arsenal, bodySlot: (name) => (name === 'hip' || name === 'back' ? poseOf(avatar.slot(name)) : null) })
      holstered.handle({ weapon, slot, on: true })
      holstered.update()
      expect(holstered.drawn).toEqual([weapon])
      const holder = scene.getObjectByName(`holstered_${weapon}`)!
      expect(holder.visible).toBe(true)
      const both = new THREE.Group()
      both.add(avatar.root.clone(), holder.clone())
      both.updateMatrixWorld(true)
      const hits = coincidentFacesOf(both, { maxHits: Number.POSITIVE_INFINITY })
      expect(hits.length - before, describeCoincidentFaces(hits, 4)).toBe(0)
      // on the weapon side of the body for a holster, behind it for a sling, and off the cloth
      const box = new THREE.Box3().setFromObject(holder)
      if (slot === 'hip') expect(box.max.x).toBeLessThan(-0.15)
      else expect(box.max.z).toBeLessThan(-0.1)
      holstered.handle({ weapon, slot, on: false })
      expect(holstered.drawn).toEqual([])
      expect(holder.visible).toBe(false)
      holstered.dispose()
    })
  }
})
