import type * as THREE_NS from 'three'
import type { ModelKit } from '../models/kit'
import type { ModelParts } from '../models/types'
import { buildFlyingRocket } from '../models/launcher-rounds'
import type { Effects } from './effects'
import type { Particles } from './particles'

const PI = Math.PI

/** What the launchers' and flamethrowers' effects need from the viewmodel. */
export interface HeavyContext {
  kit: ModelKit
  scene: THREE_NS.Object3D
  particles: Particles
  effects: Effects
  random: () => number
  parts: ModelParts
  /** Weapon forward in the world, and the world position of a part. */
  forward(): THREE_NS.Vector3
  positionOf(part: THREE_NS.Object3D): THREE_NS.Vector3
  orientation(): THREE_NS.Quaternion
  /** Runs `step(progress)` every frame for `seconds`, then `done`. */
  every(seconds: number, step: (progress: number, dt: number) => void, done?: () => void): void
  groundAt(x: number, z: number): number
}

const flameMaterials = (kit: ModelKit): THREE_NS.MeshBasicMaterial[] => {
  const { THREE } = kit
  return [
    new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0.9, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.9, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xc8361a, transparent: true, opacity: 0.8, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  ]
}

/** A rocket leaving the tube: backblast smoke and fire at the rear, then the round flying out along the barrel, gaining speed, with a trail. */
export function launchRocket(context: HeavyContext): void {
  const { kit, scene, parts, random } = context
  const { THREE } = kit
  const forward = context.forward()
  const muzzle = context.positionOf(parts.muzzle as THREE_NS.Object3D)
  const rear = context.positionOf(parts.rear as THREE_NS.Object3D)
  context.effects.backblast(rear, forward)
  const rocket = parts.makeRound ? parts.makeRound() : buildFlyingRocket(kit, parts.launcherType)
  if (parts.round) parts.round.visible = false
  rocket.quaternion.copy(context.orientation())
  rocket.position.copy(muzzle)
  scene.add(rocket)
  const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.9, depthWrite: false }))
  exhaust.rotation.z = PI / 2
  exhaust.position.x = -0.08
  rocket.add(exhaust)
  const light = new THREE.PointLight(0xff9a40, 3, 2.5)
  rocket.add(light)
  context.every(
    1.6,
    (progress, dt) => {
      const flight = progress * 1.6
      const distance = 1.2 * flight + (flight > 0.25 ? 9 * (flight - 0.25) ** 2 : 0)
      rocket.position.copy(muzzle).addScaledVector(forward, distance)
      rocket.rotation.x += 0.25 * dt * 60
      exhaust.scale.set(1, 0.6 + random() * 0.8, 1)
      if (random() < 0.9) context.effects.smoke(rocket.position.clone().addScaledVector(forward, -0.12), new THREE.Vector3((random() - 0.5) * 0.1, 0.05, (random() - 0.5) * 0.1), 0.02 + random() * 0.015, 2.2, 0.5)
    },
    () => {
      rocket.removeFromParent()
      exhaust.geometry.dispose()
      ;(exhaust.material as THREE_NS.Material).dispose()
      light.dispose()
    },
  )
}

/** A frame of flame from the nozzle: fire thrown forward and up and smoke downwind (the recipe `flame_jet` of the effect sink), and burning droplets that light the ground where they land. */
export function flameJet(context: HeavyContext, dt: number, scale: number): void {
  const { kit, particles, random, parts } = context
  const { THREE } = kit
  const forward = context.forward()
  const muzzle = context.positionOf(parts.muzzle as THREE_NS.Object3D)
  context.effects.flameJet(muzzle, forward, dt, scale)
  if (random() < 0.18) {
    const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff7a22 }))
    droplet.position.copy(muzzle).addScaledVector(forward, 0.3 + random() * 0.5)
    particles.spawn(droplet, forward.clone().multiplyScalar(1.2 * scale).add(new THREE.Vector3(0, 0.2, 0)), { life: 3, radius: 0.003, ownsGeometry: true, onGround: (position) => groundFire(context, position) })
  }
}

/** Three small flames where a burning droplet landed, flickering for four seconds and smoking. */
function groundFire(context: HeavyContext, position: THREE_NS.Vector3): void {
  const { kit, scene, random } = context
  const { THREE } = kit
  const fire = new THREE.Group()
  fire.position.set(position.x, context.groundAt(position.x, position.z) + 0.005, position.z)
  scene.add(fire)
  const materials = flameMaterials(kit)
  const flames = [0, 1, 2].map((index) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), (materials[index % 2] as THREE_NS.Material).clone())
    flame.position.set((random() - 0.5) * 0.04, 0.035, (random() - 0.5) * 0.04)
    fire.add(flame)
    return flame
  })
  let clock = 0
  context.every(
    4,
    (progress, dt) => {
      clock += dt
      flames.forEach((flame, index) => flame.scale.set(1 - progress * 0.7, (0.6 + Math.sin(clock * 20 + index * 2) * 0.35) * (1 - progress), 1 - progress * 0.7))
      if (random() < 0.08) context.effects.smoke(fire.position.clone().add(new THREE.Vector3(0, 0.08, 0)), new THREE.Vector3(0, 0.15, 0), 0.015, 1.2, 0.25)
    },
    () => {
      fire.removeFromParent()
      flames.forEach((flame) => {
        flame.geometry.dispose()
        ;(flame.material as THREE_NS.Material).dispose()
      })
      materials.forEach((material) => material.dispose())
    },
  )
}
