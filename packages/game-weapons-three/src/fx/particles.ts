import type * as THREE_NS from 'three'

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
}

const MAX_PARTICLES = 900
const FLOOR_FRICTION = 0.45

/** The gallery's particles (casings, magazines, smoke, flames): thrown with a velocity and a spin, bouncing on the floor under them until they rest or die. */
export interface Particles {
  spawn(object: THREE_NS.Object3D, velocity: THREE_NS.Vector3, options?: ParticleOptions): void
  update(dt: number): void
  count(kind: ParticleKind): number
  /** Called when something bounces: `casing` or `magazine` (for the sound). */
  onBounce?: (kind: ParticleKind) => void
  dispose(): void
}

const disposeOwned = (object: THREE_NS.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE_NS.Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
}

export function createParticles(THREE: Three, scene: THREE_NS.Object3D, groundAt: (x: number, z: number) => number): Particles {
  let list: Particle[] = []
  const remove = (particle: Particle): void => {
    particle.object.removeFromParent()
    if (particle.ownsGeometry) disposeOwned(particle.object)
    particle.onRemove?.()
    if (particle.fadeFrom !== undefined) ((particle.object as THREE_NS.Mesh).material as THREE_NS.Material).dispose()
    list = list.filter((other) => other !== particle)
  }
  const api: Particles = {
    spawn(object, velocity, options = {}) {
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
      })
      const oldest = list[0]
      if (list.length > MAX_PARTICLES && oldest) remove(oldest)
    },
    update(dt) {
      for (const particle of [...list]) {
        particle.age += dt
        if (particle.age > particle.life) {
          remove(particle)
          continue
        }
        const { object } = particle
        if (particle.fadeFrom !== undefined) ((object as THREE_NS.Mesh).material as THREE_NS.Material).opacity = Math.max(0, particle.fadeFrom * (1 - particle.age / particle.life))
        if (particle.resting) continue
        particle.velocity.y -= particle.gravity * dt
        if (particle.drag) particle.velocity.multiplyScalar(Math.max(0, 1 - particle.drag * dt))
        object.position.addScaledVector(particle.velocity, dt)
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
        particle.velocity.y *= -particle.bounce
        particle.velocity.x *= FLOOR_FRICTION
        particle.velocity.z *= FLOOR_FRICTION
        particle.spin.multiplyScalar(FLOOR_FRICTION)
        if (particle.bounces++ < 4 && Math.abs(particle.velocity.y) >= 0.18) api.onBounce?.(particle.kind)
        if (Math.abs(particle.velocity.y) < 0.18) {
          particle.resting = true
          particle.onRest?.(object)
        }
      }
    },
    count: (kind) => list.filter((particle) => particle.kind === kind).length,
    dispose() {
      for (const particle of [...list]) remove(particle)
    },
  }
  return api
}
