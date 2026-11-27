import type * as THREE_NS from 'three'
import type { SeamWorld } from '@adatechnology/game-physics'
import { dropLoose, spawnLoose, syncLoose } from '../engine-loose'
import type { LooseBody, LooseCollider } from '../engine-loose'
import { PARTICLE_USERDATA_KEY } from '../laser-raycast'
import type { SurfaceProbe } from '../laser-raycast'

type Three = typeof THREE_NS

export type ParticleKind = 'casing' | 'magazine' | 'round' | 'other'

export interface ParticleOptions {
  kind?: ParticleKind
  /** Seconds before it is removed (default 2). */
  life?: number
  /** Gravity (default 9.8; negative lets smoke rise). */
  gravity?: number
  bounce?: number
  /** Fraction of the speed lost per second. */
  drag?: number
  /** Floor contact radius; negative: no contact (smoke, flames). */
  radius?: number
  spin?: THREE_NS.Vector3
  /** Opacity at birth: it fades to zero over its life. */
  fadeFrom?: number
  /** Growth per second as a fraction of the size. */
  grow?: number
  /** Called when it comes to rest on the floor. */
  onRest?: (object: THREE_NS.Object3D) => void
  /** Called instead of bouncing when it reaches the floor; the particle is removed. */
  onGround?: (position: THREE_NS.Vector3) => void
  /** The geometry of the object is its own (not shared with a model) and goes with it. */
  ownsGeometry?: boolean
  /** Called once when the particle leaves for good (life over, floor, too many): where an object that came from a pool gives its geometry and material back. */
  onRemove?: () => void
  /** With a physics world: the engine moves this piece (rolling, sleep, the walls and floor of its world) instead of the gallery's own bounce; the object's pose and `onBounce` come from it. */
  collider?: LooseCollider
}

interface Particle extends Required<Pick<ParticleOptions, 'life' | 'gravity' | 'bounce' | 'drag' | 'radius' | 'grow' | 'kind'>> {
  object: THREE_NS.Object3D
  velocity: THREE_NS.Vector3
  spin: THREE_NS.Vector3
  age: number
  resting: boolean
  fadeFrom: number | undefined
  onRest: ParticleOptions['onRest']
  onGround: ParticleOptions['onGround']
  ownsGeometry: boolean
  onRemove: ParticleOptions['onRemove']
  bounces: number
  body: LooseBody | undefined
}

const MAX_PARTICLES = 900
const FLOOR_FRICTION = 0.45

/** The gallery's particles (casings, magazines, smoke, flames): thrown with a velocity and a spin, bouncing on the floor under them until they rest or die. */
export interface Particles {
  spawn(object: THREE_NS.Object3D, velocity: THREE_NS.Vector3, options?: ParticleOptions): void
  update(dt: number): void
  count(kind: ParticleKind): number
  /** Takes every particle out of the scene and its body out of the world; the set stays usable. */
  clear(): void
  /** Called when something bounces: `casing` or `magazine` (for the sound), with what hit, how fast (m/s, vertical) and which bounce (0 = first). */
  onBounce?: (kind: ParticleKind, hit?: { readonly object: THREE_NS.Object3D; readonly speed: number; readonly bounce: number }) => void
  dispose(): void
}

/** What the world's surfaces stop. */
const SOLID_KINDS: ReadonlySet<ParticleKind> = new Set(['casing', 'magazine', 'round'])
/** How far above the ground a hit still counts as the floor (m). */
const FLOOR_EPSILON = 0.02
/** The most casings probed in one frame (the rest take their turn on the next); a particle slower than `PROBE_MIN_SPEED` (m/s) is not probed. */
const MAX_PROBES_PER_FRAME = 24
const PROBE_MIN_SPEED = 0.3
/** Shorter than this (m) a step is not probed. */
const MIN_TRAVEL = 1e-4

const disposeOwned = (object: THREE_NS.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE_NS.Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
}

/** `limit`: the most bodies the host allows at once (its one budget); without it the own cap of 900 stands (no host lends one yet, so no warning). */
export function createParticles(THREE: Three, scene: THREE_NS.Object3D, groundAt: (x: number, z: number) => number, limit?: () => number | undefined, surface?: SurfaceProbe, physics?: SeamWorld): Particles {
  const from = new THREE.Vector3()
  const step = new THREE.Vector3()
  let list: Particle[] = []
  const remove = (particle: Particle): void => {
    particle.object.traverse((node) => {
      delete node.userData[PARTICLE_USERDATA_KEY]
    })
    particle.object.removeFromParent()
    if (particle.ownsGeometry) disposeOwned(particle.object)
    if (particle.body && physics) dropLoose(physics, particle.body)
    particle.onRemove?.()
    if (particle.fadeFrom !== undefined) ((particle.object as THREE_NS.Mesh).material as THREE_NS.Material).dispose()
    list = list.filter((other) => other !== particle)
  }
  /** A casing or a magazine does not go through a wall, a ceiling or a post: it stops at the surface the world draws and comes back off it by the face's normal. The floor stays with `groundAt` (rest, friction). */
  const bounceOffSolid = (particle: Particle, origin: THREE_NS.Vector3, travel: THREE_NS.Vector3): void => {
    const { object } = particle
    travel.copy(object.position).sub(origin)
    const length = travel.length()
    if (length < MIN_TRAVEL) return
    travel.divideScalar(length)
    const radius = Math.max(particle.radius, 0)
    const hit = surface?.(origin, travel, length + radius)
    if (!hit) return
    const at = origin.y + travel.y * hit.distance
    if (at <= groundAt(origin.x + travel.x * hit.distance, origin.z + travel.z * hit.distance) + radius + FLOOR_EPSILON) return
    const { velocity } = particle
    const impact = Math.abs(velocity.dot(hit.normal))
    object.position.copy(origin).addScaledVector(travel, Math.max(0, hit.distance - radius))
    // the part along the normal comes back with the bounce, the part along the surface slides with the floor's friction
    velocity.addScaledVector(hit.normal, -(1 + particle.bounce) * velocity.dot(hit.normal))
    velocity.multiplyScalar(FLOOR_FRICTION)
    particle.spin.multiplyScalar(FLOOR_FRICTION)
    if (particle.bounces < 4) api.onBounce?.(particle.kind, { object, speed: impact, bounce: particle.bounces })
    particle.bounces++
  }
  const api: Particles = {
    spawn(object, velocity, options = {}) {
      object.traverse((node) => {
        node.userData[PARTICLE_USERDATA_KEY] = true
      })
      scene.add(object)
      list.push({
        object,
        velocity,
        spin: options.spin ?? new THREE.Vector3(),
        age: 0,
        resting: false,
        life: options.life ?? 2,
        gravity: options.gravity ?? 9.8,
        bounce: options.bounce ?? 0.3,
        drag: options.drag ?? 0,
        radius: options.radius ?? 0.003,
        grow: options.grow ?? 0,
        kind: options.kind ?? 'other',
        fadeFrom: options.fadeFrom,
        onRest: options.onRest,
        onGround: options.onGround,
        ownsGeometry: options.ownsGeometry ?? false,
        onRemove: options.onRemove,
        bounces: 0,
        body: options.collider && physics ? spawnLoose(physics, options.collider, { position: object.position, rotation: object.quaternion, velocity, spin: options.spin ?? new THREE.Vector3() }) : undefined,
      })
      const hostLimit = limit?.()
      const oldest = list[0]
      if (list.length > (hostLimit ?? MAX_PARTICLES) && oldest) remove(oldest)
    },
    update(dt) {
      let probes = 0
      for (const particle of [...list]) {
        particle.age += dt
        if (particle.age > particle.life) {
          remove(particle)
          continue
        }
        const { object } = particle
        if (particle.fadeFrom !== undefined) ((object as THREE_NS.Mesh).material as THREE_NS.Material).opacity = Math.max(0, particle.fadeFrom * (1 - particle.age / particle.life))
        if (particle.resting) continue
        if (particle.body && physics) {
          const reading = syncLoose(physics, particle.body, object)
          if (reading.bounceSpeed !== undefined && particle.bounces < 4) api.onBounce?.(particle.kind, { object, speed: reading.bounceSpeed, bounce: particle.bounces })
          if (reading.bounceSpeed !== undefined) particle.bounces++
          if (reading.asleep) particle.resting = true
          continue
        }
        particle.velocity.y -= particle.gravity * dt
        if (particle.drag) particle.velocity.multiplyScalar(Math.max(0, 1 - particle.drag * dt))
        const probed = surface !== undefined && SOLID_KINDS.has(particle.kind) && probes < MAX_PROBES_PER_FRAME && particle.velocity.lengthSq() > PROBE_MIN_SPEED * PROBE_MIN_SPEED
        if (probed) {
          from.copy(object.position)
          probes++
        }
        object.position.addScaledVector(particle.velocity, dt)
        if (probed) bounceOffSolid(particle, from, step)
        object.rotation.x += particle.spin.x * dt
        object.rotation.y += particle.spin.y * dt
        object.rotation.z += particle.spin.z * dt
        if (particle.grow) object.scale.multiplyScalar(1 + particle.grow * dt)
        if (particle.radius < 0) continue
        const floor = groundAt(object.position.x, object.position.z) + particle.radius
        if (object.position.y >= floor || particle.velocity.y >= 0) continue
        if (particle.onGround) {
          particle.onGround(object.position.clone())
          remove(particle)
          continue
        }
        object.position.y = floor
        const impact = Math.abs(particle.velocity.y)
        particle.velocity.y *= -particle.bounce
        particle.velocity.x *= FLOOR_FRICTION
        particle.velocity.z *= FLOOR_FRICTION
        particle.spin.multiplyScalar(FLOOR_FRICTION)
        if (particle.bounces < 4 && Math.abs(particle.velocity.y) >= 0.18) api.onBounce?.(particle.kind, { object, speed: impact, bounce: particle.bounces })
        particle.bounces++
        if (Math.abs(particle.velocity.y) < 0.18) {
          particle.resting = true
          particle.onRest?.(object)
        }
      }
    },
    count: (kind) => list.filter((particle) => particle.kind === kind).length,
    clear() {
      for (const particle of [...list]) remove(particle)
    },
    dispose() {
      api.clear()
    },
  }
  return api
}
