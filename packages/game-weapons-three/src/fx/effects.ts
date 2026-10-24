import type * as THREE_NS from 'three'
import type { ModelKit } from '../models/kit'
import type { Particles } from './particles'

const PI = Math.PI

/** Flash size by case: shells flash biggest, rimfire smallest (the page's `flashK`). */
export const FLASH_BY_CASE = { shell: 1.6, big: 2.6, tiny: 0.5, pistol: 0.8, rifle: 1.2 } as const

export interface Effects {
  /** The muzzle flash at `position` pointing along `orientation`, with six puffs of smoke. */
  muzzleFlash(position: THREE_NS.Vector3, orientation: THREE_NS.Quaternion, size: number): void
  /** A puff that rises, grows and fades. */
  smoke(position: THREE_NS.Vector3, velocity: THREE_NS.Vector3, size: number, life: number, opacity: number): void
  update(dt: number): void
  dispose(): void
}

const FLASH_SECONDS = 0.055

/** The gallery's muzzle flash: a cone, four small cones and a core, additive, over 55 ms, with a short light. */
export function createEffects(kit: ModelKit, scene: THREE_NS.Object3D, particles: Particles, random: () => number): Effects {
  const { THREE, M } = kit
  const light = new THREE.PointLight(0xffb060, 0, 3, 2)
  scene.add(light)
  let flash: { group: THREE_NS.Group; age: number } | null = null

  const buildFlash = (size: number): THREE_NS.Group => {
    const group = new THREE.Group()
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.013 * size, 0.085 * size, 10, 1, true), M.flashA)
    cone.rotation.z = -PI / 2
    cone.position.x = 0.042 * size
    group.add(cone)
    for (let i = 0; i < 4; i++) {
      const angle = (i * PI) / 2 + random() * 0.6
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.005 * size, 0.04 * size, 6), M.flashA)
      spike.position.set(0.012 * size, Math.cos(angle) * 0.016 * size, Math.sin(angle) * 0.016 * size)
      spike.rotation.set(angle, 0, 0)
      spike.rotateZ(-PI / 2)
      group.add(spike)
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.016 * size, 12, 8), M.flashB)
    core.position.x = 0.008 * size
    group.add(core)
    return group
  }

  const endFlash = (): void => {
    if (!flash) return
    flash.group.removeFromParent()
    flash.group.traverse((child) => {
      const mesh = child as THREE_NS.Mesh
      if (mesh.isMesh) mesh.geometry.dispose()
    })
    flash = null
    light.intensity = 0
  }

  const effects: Effects = {
    muzzleFlash(position, orientation, size) {
      endFlash()
      const group = buildFlash(size)
      group.position.copy(position)
      group.quaternion.copy(orientation)
      group.rotateX(random() * PI)
      scene.add(group)
      flash = { group, age: 0 }
      light.position.copy(position)
      light.intensity = 4 * size
      light.distance = 2 * size
      for (let i = 0; i < 6; i++) {
        const velocity = new THREE.Vector3(0.15 + random() * 0.35, 0.03 + random() * 0.12, (random() - 0.5) * 0.14).applyQuaternion(orientation)
        effects.smoke(position, velocity, 0.013 * size, 1.3 + random() * 0.6, 0.45)
      }
    },
    smoke(position, velocity, size, life, opacity) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), M.smokeP.clone())
      puff.position.copy(position)
      particles.spawn(puff, velocity, { gravity: -0.08, life, fadeFrom: opacity, grow: 2.1, drag: 2.2, radius: -1, ownsGeometry: true })
    },
    update(dt) {
      if (!flash) return
      flash.age += dt
      flash.group.scale.setScalar(0.6 + Math.min(1, flash.age / FLASH_SECONDS) * 0.9)
      if (flash.age >= FLASH_SECONDS) endFlash()
    },
    dispose() {
      endFlash()
      light.removeFromParent()
      light.dispose()
    },
  }
  return effects
}
