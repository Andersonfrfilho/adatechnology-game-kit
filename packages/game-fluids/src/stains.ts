import type { LiquidDef, StainState, Vec3 } from './types'
import { Rng, add, clamp, cross, dot, length, normalize, scale, sub } from './math'

/** Number of radial samples of the flow front. */
export const SAMPLES = 16

const COS: number[] = []
const SIN: number[] = []
for (let i = 0; i < SAMPLES; i++) {
  COS.push(Math.cos((i / SAMPLES) * Math.PI * 2))
  SIN.push(Math.sin((i / SAMPLES) * Math.PI * 2))
}

/** Orthonormal frame of a surface: `normal`, `t1` (tangent) and `t2 = normal × t1`. */
export interface Basis {
  normal: Vec3
  t1: Vec3
  t2: Vec3
}

export const makeBasis = (normalIn: Vec3, tangentIn?: Vec3): Basis => {
  const normal = normalize(normalIn)
  const ref: Vec3 = tangentIn && length(tangentIn) > 1e-6 ? tangentIn : Math.abs(normal[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const t1 = normalize(sub(ref, scale(normal, dot(ref, normal))), [1, 0, 0])
  return { normal, t1, t2: cross(normal, t1) }
}

/** What a stain needs to know about the surface it lies on. */
export interface StainSurface extends Basis {
  point: Vec3
  half: [number, number]
  porosity: number
}

export interface StainInt extends StainState {
  normal: Vec3
  tangent: Vec3
  noise: number[]
  /** Seconds since the last inflow. */
  sinceInflow: number
  /** Drying progress 0..1. */
  dry: number
  mark: boolean
  age: number
}

/** Direction (world space) of radial sample `i` on a surface frame. */
export const sampleDir = (b: Basis, i: number): Vec3 => [
  b.t1[0] * COS[i] + b.t2[0] * SIN[i],
  b.t1[1] * COS[i] + b.t2[1] * SIN[i],
  b.t1[2] * COS[i] + b.t2[2] * SIN[i],
]

export const stainArea = (front: number[]): number => {
  let a = 0
  for (let i = 0; i < SAMPLES; i++) a += front[i] * front[(i + 1) % SAMPLES]
  return 0.5 * Math.sin((Math.PI * 2) / SAMPLES) * a
}

export const meanRadius = (front: number[]): number => front.reduce((s, v) => s + v, 0) / front.length

/** Thickness (m) a puddle of this liquid cannot get thinner than: 1 mm for water, thicker for viscous liquids. */
export const minFilm = (def: LiquidDef): number => 0.001 * (1 + 0.8 * Math.log10(Math.max(1, def.viscosity)))

/** Per-direction growth multipliers: low harmonics plus smoothed seeded noise, so the outline is never a disc. */
export const makeNoise = (rng: Rng): number[] => {
  const amp = [0.12 + rng.next() * 0.18, 0.08 + rng.next() * 0.14, 0.05 + rng.next() * 0.08]
  const phase = [rng.next() * Math.PI * 2, rng.next() * Math.PI * 2, rng.next() * Math.PI * 2]
  const raw: number[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2
    let v = 1 + (rng.next() - 0.5) * 0.3
    for (let k = 0; k < 3; k++) v += amp[k] * Math.sin((k + 2) * a + phase[k])
    raw.push(v)
  }
  const out = raw.map((v, i) => 0.25 * raw[(i + SAMPLES - 1) % SAMPLES] + 0.5 * v + 0.25 * raw[(i + 1) % SAMPLES])
  return out.map((v) => clamp(v, 0.45, 1.7))
}

/** Horizontal run direction on a surface (downhill, unit, in the plane) and the slope strength 0..1 (sin of the angle). */
export const downhill = (normal: Vec3): { dir: Vec3; slope: number } => {
  const d = add([0, -1, 0], scale(normal, normal[1]))
  const slope = length(d)
  return slope < 1e-6 ? { dir: [0, 0, 0], slope: 0 } : { dir: scale(d, 1 / slope), slope }
}

/** Creates a stain at `center` (on the surface) with a small starting front. */
export const createStain = (
  id: string,
  surfaceId: string,
  def: LiquidDef,
  basis: Basis,
  center: Vec3,
  liters: number,
  rng: Rng,
): StainInt => {
  const r0 = clamp(Math.sqrt(liters / 1000 / minFilm(def) / Math.PI) * 0.4, 0.012, 0.12)
  return {
    id,
    surface: surfaceId,
    liquid: def.id,
    center: [center[0], center[1], center[2]],
    front: new Array(SAMPLES).fill(r0),
    liters,
    soaked: 0,
    wetness: 1,
    wetRadius: 1,
    normal: basis.normal,
    tangent: basis.t1,
    noise: makeNoise(rng),
    sinceInflow: 0,
    dry: 0,
    mark: false,
    age: 0,
  }
}

/** Adds liquid to a stain (rewets a dried mark). `velocity` makes the front stretch the way the liquid came in. */
export const addInflow = (s: StainInt, liters: number, velocity: Vec3 | null): void => {
  s.liters += liters
  s.sinceInflow = 0
  if (s.dry > 0 || s.mark) {
    s.dry = 0
    s.mark = false
    s.wetness = 1
    s.wetRadius = 1
  }
  if (velocity) {
    const n = s.normal
    const tangential = sub(velocity, scale(n, dot(velocity, n)))
    if (length(tangential) > 0.2) s.flow = normalize(tangential)
  }
}

/** Moves the centre towards an inflow point without moving the outline. */
export const nudgeCenter = (s: StainInt, point: Vec3, weight: number, basis: Basis): void => {
  const delta = scale(sub(point, s.center), weight)
  if (length(delta) < 1e-6) return
  s.center = add(s.center, delta)
  for (let i = 0; i < SAMPLES; i++) s.front[i] = Math.max(0.008, s.front[i] - dot(delta, sampleDir(basis, i)))
}

export type StainStatus = 'alive' | 'dried_mark' | 'dried_gone'

/** Largest radius along each sample direction before the centre's surface rectangle ends. */
const edgeLimit = (s: StainInt, surface: StainSurface, i: number): number => {
  if (!Number.isFinite(surface.half[0]) && !Number.isFinite(surface.half[1])) return Infinity
  const rel = sub(s.center, surface.point)
  const cx = dot(rel, surface.t1)
  const cy = dot(rel, surface.t2)
  let limit = Infinity
  if (COS[i] > 1e-6) limit = Math.min(limit, (surface.half[0] - cx) / COS[i])
  else if (COS[i] < -1e-6) limit = Math.min(limit, (-surface.half[0] - cx) / COS[i])
  if (SIN[i] > 1e-6) limit = Math.min(limit, (surface.half[1] - cy) / SIN[i])
  else if (SIN[i] < -1e-6) limit = Math.min(limit, (-surface.half[1] - cy) / SIN[i])
  return Math.max(0.01, limit)
}

/**
 * Advances a stain: the front grows (faster downhill, with seeded noise, tapering as the area approaches what the liquid can cover at its
 * minimum film thickness), porous surfaces soak the pool, and once the inflow stopped the stain dries from the edge in.
 */
export const stepStain = (s: StainInt, def: LiquidDef, surface: StainSurface, ambientC: number, dt: number): StainStatus => {
  s.age += dt
  s.sinceInflow += dt
  const basis: Basis = surface
  const { dir: down, slope } = downhill(s.normal)

  // Soak into porous surfaces.
  if (s.liters > 0 && surface.porosity > 0) {
    const soak = Math.min(s.liters, surface.porosity * 0.2 * stainArea(s.front) * dt)
    s.liters -= soak
    s.soaked += soak
  }

  // Grow the flow front.
  if (s.liters > 1e-7 && s.wetness > 0) {
    const area = stainArea(s.front)
    const cover = s.liters / 1000 / (minFilm(def) * (1 - 0.7 * slope))
    if (area < cover) {
      const taper = clamp(1 - area / cover, 0, 1)
      const v0 = (0.02 + 0.2 * Math.sqrt(s.liters)) / Math.sqrt(Math.max(1, def.viscosity))
      const delta: number[] = []
      for (let i = 0; i < SAMPLES; i++) {
        let m = s.noise[i]
        if (s.flow) m *= 1 + 0.5 * Math.max(0, dot(sampleDir(basis, i), s.flow))
        if (slope > 0.02) {
          const a = dot(sampleDir(basis, i), down)
          m *= a > 0 ? 1 + 14 * slope * a : Math.max(0.1, 1 + 2.5 * slope * a)
        }
        delta.push(Math.max(0, Math.min(s.front[i] + v0 * m * taper * dt, edgeLimit(s, surface, i)) - s.front[i]))
      }
      // Never overshoot the area the liquid can cover: scale the growth (not the outline) down to fit.
      let lambda = 1
      const apply = (k: number) => s.front.map((r, i) => r + delta[i] * k)
      if (stainArea(apply(1)) > cover) {
        let lo = 0
        let hi = 1
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2
          if (stainArea(apply(mid)) > cover) hi = mid
          else lo = mid
        }
        lambda = lo
      }
      s.front = apply(lambda)
    }
  }

  // Dry from the edge in once the inflow stopped.
  if (s.sinceInflow > 1 && def.dryTime > 0 && s.dry < 1) {
    const warm = Math.pow(2, (ambientC - 20) / 12)
    const ds = (dt * warm * (1 + 0.5 * surface.porosity)) / def.dryTime
    const before = s.dry
    s.dry = Math.min(1, s.dry + ds)
    if (before < 1) s.liters *= 1 - (s.dry - before) / (1 - before)
    s.wetness = 1 - s.dry
    s.wetRadius = Math.sqrt(Math.max(0, 1 - s.dry))
    if (s.dry >= 1) {
      s.liters = 0
      s.wetness = 0
      s.wetRadius = 0
      if (def.leavesMark) {
        s.mark = true
        return 'dried_mark'
      }
      return 'dried_gone'
    }
  }
  return 'alive'
}

/** Unit direction (world space) of front sample `i` of a stain, from its `normal` and `tangent`. */
export const stainDirection = (s: Pick<StainState, 'normal' | 'tangent'>, i: number): Vec3 => sampleDir(makeBasis(s.normal ?? [0, 1, 0], s.tangent), i)
