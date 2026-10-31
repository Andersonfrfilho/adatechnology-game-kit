import type * as THREE_NS from 'three'
import { LIGHT_PRIORITY, geometryKey, materialKey } from '@adatechnology/game-render-three'
import type { LightBudget, LightHandle, RenderPools } from '@adatechnology/game-render-three'
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
  /** The host's light budget: the rocket asks it for a light while it flies. */
  lights?: LightBudget
  /** The host's pools: the burning droplets and the ground flames take their geometry and material from them and give them back, so no program is freed and relinked. Without them each makes its own. */
  pools?: RenderPools
  /** Without a budget: a point light that stays in the scene for good (intensity 0 when idle): the light count is part of every lit material's program key. */
  rocketLight?: THREE_NS.PointLight
}

export const ROCKET_LIGHT_NAME = 'rocket-light'
const ROCKET_LIGHT_COLOR = 0xff9a40
const ROCKET_LIGHT_INTENSITY = 3
const ROCKET_LIGHT_DISTANCE = 2.5
const DROPLET_SPHERE = [0.006, 6, 4] as const
const DROPLET_COLOR = 0xff7a22
const FLAME_CONE = [0.02, 0.07, 6] as const
/** The first two of `flameMaterials`: the ones a ground flame uses. */
const FLAME_MATERIALS = [
  { color: 0xff7a22, transparent: true, opacity: 0.9, depthWrite: false },
  { color: 0xffc040, transparent: true, opacity: 0.9, depthWrite: false },
] as const

const rocketsInFlight = new WeakMap<THREE_NS.PointLight, number>()

/**
 * The light that follows rockets in flight, to be added to the scene once and never removed.
 * @deprecated Pass the host's `lights` (a LightBudget) so the rocket asks for a light while it flies; this one is a light of its own. Removed in the next major.
 */
export function createRocketLight(THREE: ModelKit['THREE']): THREE_NS.PointLight {
  // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
  const light = new THREE.PointLight(ROCKET_LIGHT_COLOR, 0, ROCKET_LIGHT_DISTANCE)
  light.name = ROCKET_LIGHT_NAME
  light.position.set(0, -50, 0)
  return light
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
export function launchRocket(context: HeavyContext, flyRound = true): void {
  const { kit, scene, parts, random } = context
  const { THREE } = kit
  const forward = context.forward()
  const muzzle = context.positionOf(parts.muzzle as THREE_NS.Object3D)
  const rear = context.positionOf(parts.rear as THREE_NS.Object3D)
  context.effects.backblast(rear, context.orientation())
  if (!flyRound) {
    if (parts.round) parts.round.visible = false
    return
  }
  const rocket = parts.makeRound ? parts.makeRound() : buildFlyingRocket(kit, parts.launcherType)
  if (parts.round) parts.round.visible = false
  rocket.quaternion.copy(context.orientation())
  rocket.position.copy(muzzle)
  scene.add(rocket)
  const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.9, depthWrite: false }))
  exhaust.rotation.z = PI / 2
  exhaust.position.x = -0.08
  rocket.add(exhaust)
  const flame = context.lights?.acquire({ owner: 'weapons.rocket', priority: LIGHT_PRIORITY.rocket, urgent: true, color: ROCKET_LIGHT_COLOR, intensity: ROCKET_LIGHT_INTENSITY, distance: ROCKET_LIGHT_DISTANCE, position: [muzzle.x, muzzle.y, muzzle.z] })
  const light = context.rocketLight
  if (light) {
    light.intensity = ROCKET_LIGHT_INTENSITY
    rocketsInFlight.set(light, (rocketsInFlight.get(light) ?? 0) + 1)
  }
  context.every(
    1.6,
    (progress, dt) => {
      const flight = progress * 1.6
      const distance = 1.2 * flight + (flight > 0.25 ? 9 * (flight - 0.25) ** 2 : 0)
      rocket.position.copy(muzzle).addScaledVector(forward, distance)
      rocket.rotation.x += 0.25 * dt * 60
      light?.position.copy(rocket.position)
      flame?.update({ position: [rocket.position.x, rocket.position.y, rocket.position.z] })
      exhaust.scale.set(1, 0.6 + random() * 0.8, 1)
      if (random() < 0.9) context.effects.smoke(rocket.position.clone().addScaledVector(forward, -0.12), new THREE.Vector3((random() - 0.5) * 0.1, 0.05, (random() - 0.5) * 0.1), 0.02 + random() * 0.015, 2.2, 0.5)
    },
    () => {
      rocket.removeFromParent()
      exhaust.geometry.dispose()
      ;(exhaust.material as THREE_NS.Material).dispose()
      releaseLight(flame, light)
    },
  )
}

function releaseLight(flame: LightHandle | null | undefined, light: THREE_NS.PointLight | undefined): void {
  flame?.release({ fadeMs: 0 })
  if (!light) return
  const remaining = (rocketsInFlight.get(light) ?? 1) - 1
  rocketsInFlight.set(light, remaining)
  if (remaining > 0) return
  light.intensity = 0
  light.position.set(0, -50, 0)
}

/** A frame of flame from the nozzle: fire thrown forward and up and smoke downwind (the recipe `flame_jet` of the effect sink), and burning droplets that light the ground where they land. */
export function flameJet(context: HeavyContext, dt: number, scale: number): void {
  const { kit, particles, random, parts } = context
  const { THREE } = kit
  const forward = context.forward()
  const muzzle = context.positionOf(parts.muzzle as THREE_NS.Object3D)
  context.effects.flameJet(muzzle, context.orientation(), dt, scale)
  if (random() < 0.18) {
    const pools = context.pools
    const geometry = pools?.geometries.acquire(geometryKey('sphere', DROPLET_SPHERE), () => new THREE.SphereGeometry(...DROPLET_SPHERE))
    const material = pools?.materials.acquire(materialKey('MeshBasicMaterial', { color: DROPLET_COLOR }), () => new THREE.MeshBasicMaterial({ color: DROPLET_COLOR }))
    const droplet = new THREE.Mesh(geometry ?? new THREE.SphereGeometry(...DROPLET_SPHERE), material ?? new THREE.MeshBasicMaterial({ color: DROPLET_COLOR }))
    droplet.position.copy(muzzle).addScaledVector(forward, 0.3 + random() * 0.5)
    const onRemove = pools && geometry && material ? () => { pools.geometries.release(geometry); pools.materials.release(material) } : undefined
    particles.spawn(droplet, forward.clone().multiplyScalar(1.2 * scale).add(new THREE.Vector3(0, 0.2, 0)), { life: 3, radius: 0.003, ownsGeometry: onRemove === undefined, ...(onRemove ? { onRemove } : {}), onGround: (position) => groundFire(context, position) })
  }
}

/** Three small flames where a burning droplet landed, flickering for four seconds and smoking. */
function groundFire(context: HeavyContext, position: THREE_NS.Vector3): void {
  const { kit, scene, random, pools } = context
  const { THREE } = kit
  const fire = new THREE.Group()
  fire.position.set(position.x, context.groundAt(position.x, position.z) + 0.005, position.z)
  scene.add(fire)
  const materials = pools ? [] : flameMaterials(kit)
  const pooled: Array<{ geometry: THREE_NS.BufferGeometry; material: THREE_NS.Material }> = []
  const flames = [0, 1, 2].map((index) => {
    const own = pools ? undefined : (materials[index % 2] as THREE_NS.Material).clone()
    const part = pools ? pooledFlame(kit, pools, index) : undefined
    if (part) pooled.push(part)
    const flame = new THREE.Mesh(part?.geometry ?? new THREE.ConeGeometry(...FLAME_CONE), part?.material ?? own)
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
      if (pools) {
        for (const { geometry, material } of pooled) {
          pools.geometries.release(geometry)
          pools.materials.release(material)
        }
        return
      }
      flames.forEach((flame) => {
        flame.geometry.dispose()
        ;(flame.material as THREE_NS.Material).dispose()
      })
      materials.forEach((material) => material.dispose())
    },
  )
}

/** The geometry and the material one ground flame shares with every other (the flame only changes its scale). */
function pooledFlame(kit: ModelKit, pools: RenderPools, index: number): { geometry: THREE_NS.BufferGeometry; material: THREE_NS.Material } {
  const { THREE } = kit
  const geometry = pools.geometries.acquire(geometryKey('cone', FLAME_CONE), () => new THREE.ConeGeometry(...FLAME_CONE))
  const flame = FLAME_MATERIALS[index % 2] as (typeof FLAME_MATERIALS)[number]
  const material = pools.materials.acquire(materialKey('MeshBasicMaterial', flame), () => new THREE.MeshBasicMaterial(flame))
  return { geometry, material }
}
