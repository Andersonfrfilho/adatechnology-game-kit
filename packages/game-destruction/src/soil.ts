import soilsJson from './data/soils.json'
import type { PileSpec, SoilDef, SoilKind, SoilOptions, SoilProfile } from './types'

/**
 * Soil and foundations. A footing bears on the soil under it as a bed of springs (the subgrade modulus of the elastic settlement of a rigid footing)
 * that give way at the soil's bearing capacity; a pile carries its load by end bearing and skin friction (Décourt-Quaresma) and gives way when the
 * load passes them. The whole object rests on those springs as a rigid body: it settles, leans with the out-of-plumb of the building and with its
 * own weight moving over as it leans (P-delta), and, when the springs cannot hold it, it keeps sinking and leaning until its centre of mass passes
 * the edge of its foundations and it tips over.
 */

/** Built-in soil classes (data in `src/data/soils.json`): NBR 6122 basic pressures, SPT N, moduli from Teixeira & Godoy. */
export const SOILS: readonly SoilDef[] = soilsJson as SoilDef[]

export const SOIL_DEFAULTS = {
  safety: 3,
  pileSafety: 2,
  rigidity: 0.82,
  influence: 2,
  imperfection: 1 / 200,
  cells: 4,
  sinkRate: 0.05,
  tiltRate: 1.5,
  pileElasticGPa: 25,
  footingWidth: 0.6,
} as const

export type ResolvedSoil = Required<Omit<SoilOptions, 'soils' | 'site'>> & { site?: string | SoilProfile; byId: Map<string, SoilDef> }

export const resolveSoil = (o: SoilOptions = {}): ResolvedSoil => {
  const byId = new Map(SOILS.map((s) => [s.id, s]))
  for (const s of o.soils ?? []) byId.set(s.id, s)
  const { soils: _soils, site, ...rest } = o
  return { ...SOIL_DEFAULTS, ...rest, ...(site !== undefined ? { site } : {}), byId }
}

/** A profile from a soil class id or a profile. */
export const profileOf = (soil: string | SoilProfile): SoilProfile => (typeof soil === 'string' ? { layers: [{ soil }] } : soil)

/** The layers of a profile that lie between two depths (metres below the surface), with the thickness of each inside that range. */
export const layersBetween = (profile: SoilProfile, top: number, bottom: number, soils: ReadonlyMap<string, SoilDef>): Array<{ soil: SoilDef; thickness: number; top: number }> => {
  const out: Array<{ soil: SoilDef; thickness: number; top: number }> = []
  let z = 0
  const layers = profile.layers
  for (let i = 0; i < layers.length; i++) {
    const def = soils.get(layers[i].soil)
    if (!def) throw new Error(`unknown soil "${layers[i].soil}"`)
    const last = i === layers.length - 1
    const end = last ? Infinity : z + Math.max(0, layers[i].thickness ?? 0)
    const a = Math.max(z, top), b = Math.min(end, bottom)
    if (b > a) out.push({ soil: def, thickness: b - a, top: a })
    z = end
    if (z >= bottom) break
  }
  return out
}

/** The soil class at a depth (metres below the surface). */
export const soilAt = (profile: SoilProfile, depth: number, soils: ReadonlyMap<string, SoilDef>): SoilDef => {
  let z = 0
  for (let i = 0; i < profile.layers.length; i++) {
    const def = soils.get(profile.layers[i].soil)
    if (!def) throw new Error(`unknown soil "${profile.layers[i].soil}"`)
    z += Math.max(0, profile.layers[i].thickness ?? 0)
    if (i === profile.layers.length - 1 || depth < z) return def
  }
  throw new Error('a soil profile needs at least one layer')
}

/** The soil a footing of width `width` at `depth` bears on: the weakest allowable pressure and the mean modulus over `influence` widths below it. */
export const footingSoil = (profile: SoilProfile, depth: number, width: number, soils: ReadonlyMap<string, SoilDef>, influence: number = SOIL_DEFAULTS.influence) => {
  const zone = layersBetween(profile, depth, depth + Math.max(0.01, influence * width), soils)
  let allowable = Infinity, e = 0, nu = 0, t = 0
  for (const l of zone) {
    allowable = Math.min(allowable, l.soil.allowableKPa)
    e += l.soil.elasticMPa * l.thickness
    nu += l.soil.poisson * l.thickness
    t += l.thickness
  }
  if (t <= 0) {
    const l = soilAt(profile, depth, soils)
    return { allowableKPa: l.allowableKPa, elasticMPa: l.elasticMPa, poisson: l.poisson }
  }
  return { allowableKPa: allowable, elasticMPa: e / t, poisson: nu / t }
}

/** Décourt-Quaresma coefficient C of the end bearing in kPa per blow (clay 120, silt 200, sand and gravel 400). */
const DQ_C: Record<SoilKind, number> = { clay: 120, silt: 200, sand: 400, gravel: 400, rock: 400 }
/** Décourt (1996) factors of a bored pile on the end bearing (alpha) and the skin friction (beta); a driven pile has 1 and 1. */
const BORED: Record<SoilKind, { alpha: number; beta: number }> = {
  clay: { alpha: 0.85, beta: 0.8 },
  silt: { alpha: 0.6, beta: 0.65 },
  sand: { alpha: 0.5, beta: 0.5 },
  gravel: { alpha: 0.5, beta: 0.5 },
  rock: { alpha: 1, beta: 1 },
}
const clampN = (n: number) => Math.min(50, Math.max(3, n))

/**
 * Ultimate resistance of one pile in newtons, by Décourt-Quaresma: end bearing `alpha C N A` at the tip and skin friction `beta 10 (N/3 + 1)` kPa
 * along the shaft in each layer (N limited to 3..50). Rock with `pile` resistances uses those instead. `top` is the depth of the pile head.
 */
export const pileCapacity = (profile: SoilProfile, pile: PileSpec, top: number, soils: ReadonlyMap<string, SoilDef>) => {
  const d = pile.diameter
  const area = (Math.PI * d * d) / 4
  const perimeter = Math.PI * d
  const driven = pile.method === 'driven'
  let skin = 0
  for (const l of layersBetween(profile, top, top + pile.length, soils)) {
    const f = driven ? 1 : BORED[l.soil.kind].beta
    const kPa = l.soil.pile?.skinKPa ?? f * 10 * (clampN(l.soil.spt) / 3 + 1)
    skin += kPa * 1000 * perimeter * l.thickness
  }
  const tipDepth = top + pile.length
  const tipSoil = soilAt(profile, tipDepth, soils)
  const alpha = driven ? 1 : BORED[tipSoil.kind].alpha
  const tipKPa = tipSoil.pile?.tipKPa ?? alpha * DQ_C[tipSoil.kind] * clampN(tipSoil.spt)
  const tip = tipKPa * 1000 * area
  return { tip, skin, ultimate: tip + skin, tipSoil }
}

/**
 * The shortest pile (to `step` metres) whose ultimate resistance over `safety` carries `load` newtons, going down from `top`; `maxLength` if none.
 * This is how a designer takes a pile down to firm ground.
 */
export const pileLength = (profile: SoilProfile, o: { load: number; diameter: number; top?: number; method?: PileSpec['method']; safety?: number; step?: number; maxLength?: number; soils?: ReadonlyMap<string, SoilDef> }): number => {
  const soils = o.soils ?? resolveSoil().byId
  const safety = o.safety ?? SOIL_DEFAULTS.pileSafety
  const step = o.step ?? 0.5
  const max = o.maxLength ?? 60
  for (let L = step; L <= max + 1e-9; L += step) {
    if (pileCapacity(profile, { length: L, diameter: o.diameter, ...(o.method ? { method: o.method } : {}) }, o.top ?? 0, soils).ultimate / safety >= o.load) return Math.round(L / step) * step
  }
  return max
}

/** Stiffness of one pile in N/m: the shaft shortens under the mean of its force (`L / (2 E A)`) in series with the tip as a rigid plate (`E d / (1 - nu^2)`). */
export const pileStiffness = (pile: PileSpec, pileElasticGPa: number, tipElasticMPa: number, tipPoisson: number): number => {
  const area = (Math.PI * pile.diameter * pile.diameter) / 4
  const shaft = pile.length / (2 * pileElasticGPa * 1e9 * area)
  const tip = (1 - tipPoisson * tipPoisson) / (tipElasticMPa * 1e6 * pile.diameter)
  return 1 / (shaft + tip)
}

/** Subgrade modulus in Pa/m of a rigid footing of width `width`: `E / (B (1 - nu^2) Iw)`, the elastic settlement of the footing as springs. */
export const subgradeModulus = (elasticMPa: number, poisson: number, width: number, rigidity: number = SOIL_DEFAULTS.rigidity): number =>
  (elasticMPa * 1e6) / (Math.max(0.05, width) * (1 - poisson * poisson) * rigidity)

/**
 * Thickness-free design check of a shallow footing: the area a load of `load` newtons needs on `soil` (allowable pressure), as a designer sizes it.
 */
export const footingArea = (load: number, allowableKPa: number): number => load / (allowableKPa * 1000)

/** One support of the object on the ground: a footing cell or a pile, at object-local `x, z`, `hx`/`hz` half its size. */
export interface SoilSpring {
  x: number
  z: number
  hx: number
  hz: number
  /** N/m. */
  k: number
  /** Newtons it carries before it gives way. */
  cap: number
  /** Permanent settlement of the soil under it from yielding, metres: it pushes back only past this (default 0). */
  set?: number
}

/** The springs' permanent settlement after the base moved to `(s, a, b)`: a spring pushed past its capacity keeps the extra (return mapping). */
export const yieldSprings = (springs: readonly SoilSpring[], s: number, a: number, b: number): number[] => {
  const [x0, z0] = stiffnessCentre(springs)
  return springs.map((sp) => {
    const set = sp.set ?? 0
    const w = s + a * (sp.x - x0) + b * (sp.z - z0)
    return sp.k * (w - set) > sp.cap ? w - sp.cap / sp.k : set
  })
}

export interface FoundationSolve {
  /** Settlement at the centre of stiffness, metres. */
  s: number
  /** Slopes of the base: the foundations go down `a` per metre of x and `b` per metre of z. */
  a: number
  b: number
  /** An equilibrium was found and it is stable. */
  stable: boolean
  /** Some spring is at its capacity in that equilibrium. */
  yielded: boolean
  /** Weight over the sum of the capacities. */
  bearing: number
  /** Largest force over capacity of a spring, 0..1. */
  edge: number
  /** Residual of the vertical force and moments at the end, to tell which way an unstable object moves. */
  residual: [number, number, number]
}

/** Centre of stiffness of the springs. */
export const stiffnessCentre = (springs: readonly SoilSpring[]): [number, number] => {
  let k = 0, x = 0, z = 0
  for (const s of springs) {
    k += s.k
    x += s.k * s.x
    z += s.k * s.z
  }
  return k > 0 ? [x / k, z / k] : [0, 0]
}

/** Solves `J d = r` for a symmetric 3x3 by Cholesky; null when `J` is not positive definite. */
const cholesky3 = (J: number[][], r: number[]): number[] | null => {
  const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = J[i][j]
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k]
      if (i === j) {
        if (!(sum > 1e-9 * Math.max(1, Math.abs(J[i][i])))) return null
        L[i][i] = Math.sqrt(sum)
      } else L[i][j] = sum / L[j][j]
    }
  }
  const y = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    let sum = r[i]
    for (let k = 0; k < i; k++) sum -= L[i][k] * y[k]
    y[i] = sum / L[i][i]
  }
  const x = [0, 0, 0]
  for (let i = 2; i >= 0; i--) {
    let sum = y[i]
    for (let k = i + 1; k < 3; k++) sum -= L[k][i] * x[k]
    x[i] = sum / L[i][i]
  }
  return x
}

/**
 * Equilibrium of a rigid object of weight `weight` (N) on elastic-perfectly-plastic springs that carry no tension, with its centre of mass at
 * `(xg, zg)` and `height` metres above the base, leaning `imperfection` (radians, x and z) before any load and moving over as it leans (P-delta).
 * Newton iterations from `start`; where the tangent is not positive definite the elastic stiffness of the springs in contact is used instead.
 */
export const solveFoundation = (
  springs: readonly SoilSpring[],
  weight: number,
  xg: number,
  zg: number,
  height: number,
  imperfection: readonly [number, number],
  start: { s: number; a: number; b: number } = { s: 0, a: 0, b: 0 },
): FoundationSolve => {
  const [x0, z0] = stiffnessCentre(springs)
  const capSum = springs.reduce((sum, s) => sum + s.cap, 0)
  const span = Math.max(1, ...springs.map((s) => Math.max(Math.abs(s.x - x0) + s.hx, Math.abs(s.z - z0) + s.hz)))
  let s = start.s, a = start.a, b = start.b
  // from a base that touches nothing, start at the elastic settlement of the whole bed
  if (springs.every((sp) => s + a * (sp.x - x0) + b * (sp.z - z0) - (sp.set ?? 0) <= 0)) {
    s = weight / Math.max(1e-9, springs.reduce((sum, sp) => sum + sp.k, 0))
    a = b = 0
  }
  const Wh = weight * height
  const evaluate = () => {
    let F = 0, Mx = 0, Mz = 0, edge = 0, yielded = false
    const Jt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const Je = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const add = (J: number[][], k: number, dx: number, dz: number) => {
      J[0][0] += k; J[0][1] += k * dx; J[0][2] += k * dz
      J[1][1] += k * dx * dx; J[1][2] += k * dx * dz; J[2][2] += k * dz * dz
    }
    for (const sp of springs) {
      const dx = sp.x - x0, dz = sp.z - z0
      const w = s + a * dx + b * dz - (sp.set ?? 0)
      if (w <= 0) continue
      const f = sp.k * w
      add(Je, sp.k, dx, dz)
      let force = f
      if (f >= sp.cap) {
        force = sp.cap
        yielded = true
      } else add(Jt, sp.k, dx, dz)
      edge = Math.max(edge, force / sp.cap)
      F += force
      Mx += force * dx
      Mz += force * dz
    }
    for (const J of [Jt, Je]) {
      J[1][0] = J[0][1]; J[2][0] = J[0][2]; J[2][1] = J[1][2]
      J[1][1] -= Wh; J[2][2] -= Wh
    }
    const r = [weight - F, weight * (xg - x0 + height * (a + imperfection[0])) - Mx, weight * (zg - z0 + height * (b + imperfection[1])) - Mz]
    return { r, Jt, Je, edge, yielded }
  }
  let ev = evaluate()
  let converged = false
  const tol = 1e-7 * weight
  for (let it = 0; it < 120; it++) {
    if (Math.abs(ev.r[0]) < tol && Math.abs(ev.r[1]) < tol * span && Math.abs(ev.r[2]) < tol * span) {
      converged = true
      break
    }
    const d = cholesky3(ev.Jt, ev.r) ?? cholesky3(ev.Je, ev.r)
    if (!d) break
    s += d[0]
    a += d[1]
    b += d[2]
    if (!Number.isFinite(s + a + b) || Math.abs(a) > 2 || Math.abs(b) > 2) break
    ev = evaluate()
  }
  // a stable equilibrium keeps a positive definite tangent: with every spring under one side yielding the object has nothing left to stop it
  const stable = converged && cholesky3(ev.Jt, [0, 0, 0]) !== null
  return { s, a, b, stable, yielded: ev.yielded, bearing: capSum > 0 ? weight / capSum : Infinity, edge: ev.edge, residual: [ev.r[0], ev.r[1], ev.r[2]] }
}
