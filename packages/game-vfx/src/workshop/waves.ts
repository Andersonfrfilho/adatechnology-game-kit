import type { Vec3Tuple, WorkshopContext } from './types'

const RING_CAPACITY = 120
const LIGHT_CAPACITY = 4
const UP: Vec3Tuple = [0, 1, 0]
const DEFAULT_LIGHT_DISTANCE = 14

export interface WaveRing {
  on: boolean
  point: Vec3Tuple
  from: number
  to: number
  t: number
  duration: number
  color: number
  normal: Vec3Tuple
  hold: number
}

/** The Workshop's expanding rings on the ground (W308-315): 120 in a ring buffer. A ring with `hold` stays at that brightness until cleared. */
export class WaveRingPool {
  readonly rings: WaveRing[] = Array.from({ length: RING_CAPACITY }, () => ({ on: false, point: UP, from: 0, to: 0, t: 0, duration: 1, color: 0, normal: UP, hold: 0 }))
  count = 0
  private next = 0

  add(point: Vec3Tuple, from: number, to: number, duration: number, color: number, normal?: Vec3Tuple, hold?: number): void {
    const ring = this.rings[this.next++ % RING_CAPACITY]!
    ring.on = true
    ring.point = [point[0], point[1], point[2]]
    ring.from = from
    ring.to = to
    ring.t = 0
    ring.duration = duration
    ring.color = color
    ring.normal = normal ?? UP
    ring.hold = hold || 0
  }

  clear(): void {
    for (const ring of this.rings) ring.on = false
    this.count = 0
  }

  update(dt: number): void {
    this.count = 0
    for (const ring of this.rings) {
      if (!ring.on) continue
      this.count++
      ring.t += dt
      if (ring.t / ring.duration >= 1 && !ring.hold) ring.on = false
    }
  }
}

export interface FlashLight {
  x: number
  y: number
  z: number
  color: number
  distance: number
  peak: number
  duration: number
  t: number
  intensity: number
  /** Holds `peak` until `duration` is over. */
  steady: boolean
}

export interface FireLightSlot {
  x: number
  y: number
  z: number
  intensity: number
}

/** The four short flashes of the Workshop (W333-337), taken in turn, and its two fire lights. */
export class FlashLightPool {
  readonly lights: FlashLight[] = Array.from({ length: LIGHT_CAPACITY }, () => ({ x: 0, y: 0, z: 0, color: 0xffc070, distance: DEFAULT_LIGHT_DISTANCE, peak: 0, duration: 1, t: 0, intensity: 0, steady: false }))
  readonly fire: FireLightSlot[] = [
    { x: 0, y: 0, z: 0, intensity: 0 },
    { x: 0, y: 0, z: 0, intensity: 0 },
  ]
  private next = 0

  constructor(private readonly context: WorkshopContext) {}

  get lit(): number {
    return this.lights.filter((light) => light.intensity > 0).length
  }

  flash(point: Vec3Tuple, color: number, intensity: number, duration: number, distance?: number, force?: boolean | 'boom', steady?: boolean): void {
    const { level } = this.context.quality
    if (level >= 1 && !force) return
    if (level >= 2 && force !== 'boom') return
    const light = this.lights[this.next++ % LIGHT_CAPACITY]!
    light.x = point[0]
    light.y = point[1]
    light.z = point[2]
    light.color = color
    light.distance = distance || DEFAULT_LIGHT_DISTANCE
    light.peak = intensity
    light.duration = duration
    light.t = 0
    light.steady = steady === true
    light.intensity = intensity
  }

  clear(): void {
    for (const light of this.lights) light.intensity = 0
    for (const light of this.fire) light.intensity = 0
  }

  update(dt: number): void {
    for (const light of this.lights) {
      if (light.intensity <= 0) continue
      light.t += dt
      const age = light.t / light.duration
      light.intensity = age >= 1 ? 0 : light.steady ? light.peak : light.peak * (1 - age) * (1 - age)
    }
  }
}
