import type { AnimalVisualState } from '@adatechnology/game-animals'
import type * as THREE_NS from 'three'

import type { AnimalRig, Three } from './types'

const INFECTED_TINT = 0x7d8a66
const POOL_COLOR = 0x3a0806

/**
 * Applies a visual state (page: `setInfected`, with the dead look for every species): infected greys the coat, glows the eyes, shows the wounds and hides
 * the first ear; dead lets the animation lay the body down and shows a blood pool at `home`. The pool goes under `rig.root.parent`; with no parent yet,
 * it is created hidden from the scene and `rig.pool` is for the caller to add.
 */
export const applyVisualState = (THREE: Three, rig: AnimalRig, state: AnimalVisualState): void => {
  rig.infected = state === 'infected'
  rig.dead = state === 'dead'
  const tint = new THREE.Color(INFECTED_TINT)
  rig.materials.forEach((material) => {
    if (material === rig.eyeMaterial || material === rig.woundMaterial) return
    material.color.copy(material.userData.base as THREE_NS.Color)
    if (rig.infected) material.color.lerp(tint, 0.45).multiplyScalar(0.72)
  })
  const eye = rig.eyeMaterial
  if (eye) {
    if (rig.infected) {
      eye.color.set(0xdcd8b0)
      eye.emissive = new THREE.Color(0x8a8660)
      eye.emissiveIntensity = 0.8
    } else {
      eye.color.copy(eye.userData.base as THREE_NS.Color)
      eye.emissive = new THREE.Color(0)
    }
  }
  rig.infectionParts.forEach((part) => (part.visible = rig.infected))
  const firstEar = rig.ears[0]
  if (firstEar) firstEar.visible = !rig.infected
  if (!rig.dead) {
    rig.root.rotation.z = 0
    rig.root.position.y = 0
  }
  if (rig.pool) {
    rig.pool.visible = rig.dead
    return
  }
  if (!rig.dead) return
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 22).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: POOL_COLOR, roughness: 0.25 }))
  pool.position.set(rig.home.x, 0.005, rig.home.z + 0.1)
  pool.receiveShadow = true
  pool.scale.setScalar(rig.size * 0.45)
  rig.root.parent?.add(pool)
  rig.pool = pool
}
