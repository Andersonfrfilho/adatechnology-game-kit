import type { DecalOptions, Vec3Tuple, WorkshopContext } from './types'

const CAPACITY = 400
const UP: Vec3Tuple = [0, 1, 0]
const DEFAULT_LIFE = 60
const DEFAULT_GROW = 1.2

/** The seconds a fluid decal waits and then takes to evaporate away (W276); blood, bile and oil only darken. */
const EVAPORATION = { fuel: [6, 5], water: [40, 20] } as const

export interface Decal {
  on: boolean
  x: number
  y: number
  z: number
  sx: number
  sy: number
  t: number
  life: number
  grow: number
  color: number
  /** Where the surface faces, and the colour a fluid dries to (`-1`: it does not dry). */
  normal: Vec3Tuple
  fluid: DecalOptions['fluid'] | undefined
  dryColor: number
  dryAt: number
  dryTime: number
}

function createDecal(): Decal {
  return { on: false, x: 0, y: 0, z: 0, sx: 0, sy: 0, t: 0, life: 0, grow: 0, color: 0, normal: UP, fluid: undefined, dryColor: -1, dryAt: 0, dryTime: 0 }
}

/** The Workshop's decals (W265-306): 400 marks on the ground in a ring buffer. Wet ones spread and evaporate (fuel, water), the rest last their life. */
export class DecalPool {
  readonly decals: Decal[] = Array.from({ length: CAPACITY }, createDecal)
  count = 0
  private next = 0

  constructor(private readonly context: WorkshopContext) {}

  add(x: number, y: number, z: number, size: number, color: number, options: DecalOptions = {}): void {
    const random = this.context.random
    const index = this.next++ % CAPACITY
    const decal = this.decals[index]!
    const normal = options.n ?? UP
    random.between(0, 6.28)
    const offset = 0.004 + (index % 40) * 0.0004
    decal.on = true
    decal.x = x + normal[0] * offset
    decal.y = y + normal[1] * offset
    decal.z = z + normal[2] * offset
    decal.sx = size * (options.ar ? 1 : random.between(0.8, 1.2))
    decal.sy = size * (options.ar || random.between(0.65, 1.1))
    decal.t = -(options.delay || 0)
    decal.grow = options.grow ?? DEFAULT_GROW
    decal.life = options.life || DEFAULT_LIFE
    decal.color = color
    decal.normal = normal
    const fluid = options.fluid ?? (options.dark ? 'blood' : undefined)
    decal.fluid = fluid
    decal.dryAt = options.dark && !options.fluid ? 0 : options.dryAt ?? (fluid === 'blood' || fluid === 'bile' ? 40 : 0)
    decal.dryTime = options.dark && !options.fluid ? options.dark : options.dryT ?? (fluid === 'blood' || fluid === 'bile' ? 30 : 0)
    decal.dryColor = options.dry ?? (fluid === 'bile' ? 0x3e4220 : -1)
  }

  clear(): void {
    for (const decal of this.decals) decal.on = false
    this.count = 0
  }

  /**
   * Takes away the marks inside a box: world `center`, `half` extents along the axes of the world `rotation` (a quaternion, x y z w; none means the
   * world axes). The surface they were on is gone (a brick came out of a wall with its bullet holes). Returns how many went.
   */
  clearInside(center: Vec3Tuple, half: Vec3Tuple, rotation: readonly [number, number, number, number] = [0, 0, 0, 1]): number {
    // the inverse rotation takes a point into the box's axes: v' = v + 2w(q x v) + 2 q x (q x v) with q = -xyz of the rotation
    const qx = -rotation[0], qy = -rotation[1], qz = -rotation[2], qw = rotation[3]
    let gone = 0
    for (const decal of this.decals) {
      if (!decal.on) continue
      const vx = decal.x - center[0], vy = decal.y - center[1], vz = decal.z - center[2]
      const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx)
      const lx = vx + qw * tx + (qy * tz - qz * ty), ly = vy + qw * ty + (qz * tx - qx * tz), lz = vz + qw * tz + (qx * ty - qy * tx)
      if (Math.abs(lx) > half[0] || Math.abs(ly) > half[1] || Math.abs(lz) > half[2]) continue
      decal.on = false
      gone++
    }
    return gone
  }

  update(dt: number): void {
    this.count = 0
    for (const decal of this.decals) {
      if (!decal.on) continue
      this.count++
      decal.t += dt
      if (decal.t < 0) continue
      decal.life -= dt
      if (decal.life <= 0) {
        decal.on = false
        continue
      }
      const evaporation = decal.fluid === 'fuel' || decal.fluid === 'water' ? EVAPORATION[decal.fluid] : undefined
      if (evaporation && (decal.t - evaporation[0]) / evaporation[1] >= 1) decal.on = false
    }
  }
}
