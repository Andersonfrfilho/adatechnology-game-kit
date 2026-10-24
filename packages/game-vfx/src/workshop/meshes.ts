import type { MeshSpawn, MeshShape, Vec3Tuple } from './types'

const CAPACITY = 400
const IDENTITY: Quaternion = [0, 0, 0, 1]

/** A unit quaternion `[x, y, z, w]`. */
export type Quaternion = readonly [number, number, number, number]

/** One solid particle as the pool keeps it; a renderer draws it from these fields and never changes them. */
export interface MeshParticle {
  /** Grows by one for every particle ever spawned: a renderer knows a new one by it. */
  readonly id: number
  readonly shape: MeshShape
  readonly radius: number
  readonly height: number
  readonly segments: number
  readonly segments2: number
  readonly color: number
  readonly additive: boolean
  readonly lit: boolean
  /** Where the group is, how it is turned (placement and roll), where the piece sits in it (before the scale) and how the piece is turned in it (Euler XYZ, changes with `spin`). */
  x: number
  y: number
  z: number
  readonly frame: Quaternion
  readonly at: Vec3Tuple
  rx: number
  ry: number
  rz: number
  scale: number
  opacity: number
  age: number
  readonly life: number
  vx: number
  vy: number
  vz: number
  readonly spin: Vec3Tuple
  readonly gravity: number
  readonly drag: number
  readonly grow: number
  readonly ramp: readonly [number, number] | undefined
  readonly fade: boolean
  readonly startOpacity: number
}

function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]
}

/** The turn of `angle` about the x axis. */
const aboutX = (angle: number): Quaternion => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)]

/**
 * The solids of the Workshop's recipes: the gallery's `Particles` (thrown with a velocity and a spin, slowed, lifted by a negative gravity, grown and faded) without
 * the floor, in order of birth. The oldest goes when the pool is full. Each frame does what the gallery's did, in its order: age, fade, gravity, drag, move, spin, grow.
 */
export class MeshPool {
  readonly particles: MeshParticle[] = []
  private serial = 0

  constructor(readonly capacity: number = CAPACITY) {}

  get count(): number {
    return this.particles.length
  }

  spawn(options: MeshSpawn, frame: Quaternion = IDENTITY): MeshParticle {
    const velocity = options.v ?? [0, 0, 0]
    const world = options.wv ?? [0, 0, 0]
    const particle: MeshParticle = {
      id: ++this.serial,
      shape: options.shape,
      radius: options.r,
      height: options.h ?? 0,
      segments: options.seg ?? 0,
      segments2: options.seg2 ?? 0,
      color: options.c0,
      additive: options.add === true,
      lit: options.lit === true,
      x: options.p[0],
      y: options.p[1],
      z: options.p[2],
      frame: options.roll ? multiply(frame, aboutX(options.roll)) : frame,
      at: options.at ?? [0, 0, 0],
      rx: options.rot?.[0] ?? 0,
      ry: options.rot?.[1] ?? 0,
      rz: options.rot?.[2] ?? 0,
      scale: 1,
      opacity: options.a,
      age: 0,
      life: options.life,
      vx: velocity[0] + world[0],
      vy: velocity[1] + world[1],
      vz: velocity[2] + world[2],
      spin: options.spin ?? [0, 0, 0],
      gravity: options.g ?? 0,
      drag: options.drag ?? 0,
      grow: options.grow ?? 0,
      ramp: options.ramp,
      fade: options.fade === true,
      startOpacity: options.a,
    }
    this.particles.push(particle)
    if (this.particles.length > this.capacity) this.particles.shift()
    return particle
  }

  update(dt: number): void {
    const live = this.particles
    for (let index = 0; index < live.length; index++) {
      const particle = live[index]!
      particle.age += dt
      if (particle.ramp ? particle.age >= particle.life : particle.age > particle.life) {
        live.splice(index--, 1)
        continue
      }
      if (particle.fade) particle.opacity = Math.max(0, particle.startOpacity * (1 - particle.age / particle.life))
      particle.vy -= particle.gravity * dt
      if (particle.drag) {
        const keep = Math.max(0, 1 - particle.drag * dt)
        particle.vx *= keep
        particle.vy *= keep
        particle.vz *= keep
      }
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.z += particle.vz * dt
      particle.rx += particle.spin[0] * dt
      particle.ry += particle.spin[1] * dt
      particle.rz += particle.spin[2] * dt
      if (particle.grow) particle.scale *= 1 + particle.grow * dt
      if (particle.ramp) particle.scale = particle.ramp[0] + Math.min(1, particle.age / particle.life) * particle.ramp[1]
    }
  }

  clear(): void {
    this.particles.length = 0
  }
}
