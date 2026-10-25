import windTerrainJson from './data/wind-terrain.json'
import { GRAVITY } from './flexure'
import { createRng } from './math'
import { thinAxisOf } from './layers'
import { verticalBarCount } from './rebar'
import type { Vec3, WindExposure, WindOptions, WindTerrainDef } from './types'

/**
 * Wind on a building. The wind pressure grows with the height (NBR 6123), the building is cut into storey-high bands, each band takes the force of
 * its area, and the structure that resists it is the walls (a cantilever of composite section) working with the frame (storey shear stiffness) as
 * the wall-frame interaction of Heidebrecht & Stafford Smith. The same stiffness gives the first mode (Rayleigh), and a gust series moves the top
 * against it, with a tuned mass damper if there is one. Pure formulas in SI units (N, m, Pa, s); the world calls them with the parts' boxes.
 */

/** Built-in terrain categories (data in `src/data/wind-terrain.json`): NBR 6123 table 1 and the roughness lengths. */
export const WIND_TERRAIN: readonly WindTerrainDef[] = windTerrainJson as WindTerrainDef[]

export const WIND_DEFAULTS = {
  speed: 40,
  direction: [1, 0, 0] as Vec3,
  terrain: 'III' as NonNullable<WindExposure['terrain']>,
  class: 'auto' as NonNullable<WindExposure['class']>,
  topography: 1,
  statistical: 1,
  drag: 1.3,
  damping: 0.016,
  airDensity: 1.226,
  minHeight: 5,
  bandHeight: 3,
  stiffnessFactor: 0.8,
  beamFactor: 0.4,
  flange: 0.1,
  driftLimit: 1 / 500,
  loadFactor: 1.4,
  chord: false,
  meanRatio: 0.69,
  gustFactor: { A: 1, B: 0.98, C: 0.95 },
  gust: { components: 400, maxHz: 2, scale: 1200, seed: 1 },
  peakDecay: 60,
  tuning: 'den-hartog' as NonNullable<WindOptions['tuning']>,
} as const

export type ResolvedWind = Required<Omit<WindOptions, 'terrains' | 'gustFactor' | 'gust' | 'direction'>> & {
  direction: Vec3
  gustFactor: { A: number; B: number; C: number }
  gust: { components: number; maxHz: number; scale: number; seed: number }
  terrains: Map<string, WindTerrainDef>
}

const definedOf = <T extends object>(o?: T): Partial<T> => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>

export const resolveWind = (o: WindOptions = {}): ResolvedWind => {
  const terrains = new Map(WIND_TERRAIN.map((t) => [t.id, t]))
  for (const t of o.terrains ?? []) terrains.set(t.id, t)
  const { terrains: _terrains, gustFactor, gust, ...rest } = o
  return {
    ...WIND_DEFAULTS,
    ...definedOf(rest),
    direction: o.direction ?? WIND_DEFAULTS.direction,
    gustFactor: { ...WIND_DEFAULTS.gustFactor, ...definedOf(gustFactor) },
    gust: { ...WIND_DEFAULTS.gust, ...definedOf(gust) },
    terrains,
  }
}

/** The world's wind with one object's `DestructibleSpec.wind` over it. */
export const exposureOf = (w: ResolvedWind, spec?: WindExposure | false): ResolvedWind => (spec ? { ...w, ...definedOf(spec) } : w)

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Pressure and profile
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Dynamic pressure in N/m² of a wind of `speed` m/s: `q = rho V^2 / 2`, which is `0.613 V^2` for the air at 15 °C (NBR 6123 4.2). */
export const windPressure = (speed: number, density: number = WIND_DEFAULTS.airDensity): number => 0.5 * density * speed * speed

/** Class of a building by its largest dimension (NBR 6123 table 1): `A` up to 20 m, `B` up to 50 m, `C` above. */
export const windClass = (largest: number): 'A' | 'B' | 'C' => (largest <= 20 ? 'A' : largest <= 50 ? 'B' : 'C')

/**
 * Height factor of the gust `S2 = b * Fr * (z / 10)^p` (NBR 6123 5.3), `z` in metres above the ground: at least `minHeight` and at most the gradient
 * height of the category.
 */
export const heightFactor = (z: number, terrain: WindTerrainDef, cls: 'A' | 'B' | 'C', o: { gustFactor?: { A: number; B: number; C: number }; minHeight?: number } = {}): number => {
  const zz = Math.min(terrain.zg, Math.max(o.minHeight ?? WIND_DEFAULTS.minHeight, z))
  return terrain.b[cls] * (o.gustFactor ?? WIND_DEFAULTS.gustFactor)[cls] * (zz / 10) ** terrain.p[cls]
}

/** The same profile for the 10-minute mean wind: no gust factor, times `meanRatio` (the share of the gust the mean is). */
export const meanHeightFactor = (z: number, terrain: WindTerrainDef, cls: 'A' | 'B' | 'C', o: { meanRatio?: number; minHeight?: number } = {}): number =>
  (o.meanRatio ?? WIND_DEFAULTS.meanRatio) * heightFactor(z, terrain, cls, { gustFactor: { A: 1, B: 1, C: 1 }, ...(o.minHeight !== undefined ? { minHeight: o.minHeight } : {}) })

/** Turbulence intensity at `z` over terrain of roughness length `z0`: `1 / ln(z / z0)` (EN 1991-1-4 4.4), no more than 0.5. */
export const turbulenceIntensity = (z: number, z0: number): number => Math.min(0.5, 1 / Math.log(Math.max(z, 1.5 * z0) / z0))

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Wall-frame cantilever
// ---------------------------------------------------------------------------------------------------------------------------------------------

export interface WallFrameSolution {
  /** Rotation `w'` at the n + 1 nodes. */
  psi: number[]
  /** Deflection at the nodes (0 at the base). */
  w: number[]
}

/**
 * A cantilever with bending stiffness `ei[j]` (N m²) and shear stiffness `ga[j]` (N) in each band of height `hb[j]`, loaded by the shear `V` at the
 * n + 1 nodes (from the base up; `V[n]` is the shear at the top, 0 when nothing hangs there). The wall and the frame share the load as
 * `-(EI psi')' + GA psi = V`, `psi(0) = 0` (as far as there is a wall), zero moment at the top: linear elements, one per band, a tridiagonal system. Without the frame
 * (`ga` 0) it is the bending cantilever (`w = w H^4 / (8 EI)` for a uniform load), without the wall (`ei` 0) the shear beam (`w' = V / GA`).
 */
export const solveWallFrame = (hb: readonly number[], ei: readonly number[], ga: readonly number[], V: readonly number[]): WallFrameSolution => {
  const n = hb.length
  const diag = new Array<number>(n + 1).fill(0)
  const off = new Array<number>(n).fill(0)
  const rhs = new Array<number>(n + 1).fill(0)
  for (let j = 0; j < n; j++) {
    const h = hb[j], e = ei[j], g = ga[j]
    diag[j] += e / h + (g * h) / 3
    diag[j + 1] += e / h + (g * h) / 3
    off[j] = -e / h + (g * h) / 6
    rhs[j] += (h / 6) * (2 * V[j] + V[j + 1])
    rhs[j + 1] += (h / 6) * (V[j] + 2 * V[j + 1])
  }
  // the wall is clamped at the base (psi = 0) as far as there is a wall: a stiff spring on the base node whose weight is the wall's share of the
  // stiffness over one band, so a frame alone is not held back by a boundary layer that no band resolves
  const wall = ei[0] / (ei[0] + ga[0] * hb[0] * hb[0])
  diag[0] += 1e6 * (ei[0] / hb[0] + ga[0] * hb[0]) * wall
  // Thomas algorithm on the nodes 0..n
  const c = new Array<number>(n + 1).fill(0)
  const d = new Array<number>(n + 1).fill(0)
  const psi = new Array<number>(n + 1).fill(0)
  c[0] = off[0] / diag[0]
  d[0] = rhs[0] / diag[0]
  for (let i = 1; i <= n; i++) {
    const m = diag[i] - off[i - 1] * c[i - 1]
    c[i] = i < n ? off[i] / m : 0
    d[i] = (rhs[i] - off[i - 1] * d[i - 1]) / m
  }
  psi[n] = d[n]
  for (let i = n - 1; i >= 0; i--) psi[i] = d[i] - c[i] * psi[i + 1]
  const w = new Array<number>(n + 1).fill(0)
  for (let j = 0; j < n; j++) w[j + 1] = w[j] + (hb[j] * (psi[j] + psi[j + 1])) / 2
  return { psi, w }
}

/** Shear at the n + 1 nodes of loads `f[j]` spread over each band (the load of the bands above, from the top). */
export const shearNodes = (f: readonly number[]): number[] => {
  const V = new Array<number>(f.length + 1).fill(0)
  for (let j = f.length - 1; j >= 0; j--) V[j] = V[j + 1] + f[j]
  return V
}

/** Moment at the n + 1 nodes from the shear at the nodes (linear inside each band, so the trapezoid is exact). */
export const momentNodes = (hb: readonly number[], V: readonly number[]): number[] => {
  const M = new Array<number>(V.length).fill(0)
  for (let j = hb.length - 1; j >= 0; j--) M[j] = M[j + 1] + (hb[j] * (V[j] + V[j + 1])) / 2
  return M
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Analysis of a building
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Factor on the stiffness of the bands above the lateral system, which move as a rigid body with its top. */
const RIGID = 1e3

export interface WindPartInput {
  /** Object-local box of the part (`aabbOf`). */
  min: Vec3
  max: Vec3
  /** `wall` and `column` resist, `beam` frames into the columns, `foundation` is the footprint, `other` only weighs and shows area. */
  kind: 'wall' | 'column' | 'beam' | 'foundation' | 'other'
  /** Young's modulus in Pa (walls, columns, beams). */
  elasticPa?: number
  /** Mass in kg (what rests on it is counted by the parts that rest). */
  mass: number
  /** A tuned mass damper: weighs, but is not part of the modal mass of the building. */
  damper?: boolean
  /** Indices of the beams that frame into this column (closed joints). */
  beams?: readonly number[]
  /** Thickness of the slab that rests on this beam and works with it as a T section (0: none). */
  slab?: number
}

/** Everything `analyzeWind` needs once it is resolved for one building (`ResolvedWind` with its terrain and direction). */
export interface WindCase {
  speed: number
  /** Horizontal unit vector the wind blows towards, object-local `[x, z]`. */
  direction: readonly [number, number]
  terrain: WindTerrainDef
  cls: 'auto' | 'A' | 'B' | 'C'
  topography: number
  statistical: number
  drag: number
  damping: number
  airDensity: number
  minHeight: number
  bandHeight: number
  stiffnessFactor: number
  beamFactor: number
  flange: number
  loadFactor: number
  chord: boolean
  meanRatio: number
  gustFactor: { A: number; B: number; C: number }
}

export interface WindAnalysis {
  /** Height of the top above the ground and the class used. */
  height: number
  cls: 'A' | 'B' | 'C'
  /** Largest width across the wind. */
  width: number
  /** Band heights and the height of the middle of each above the ground. */
  bands: number[]
  mid: number[]
  /** Design force on each band, N, and the force of the 10-minute mean wind. */
  forces: number[]
  meanForces: number[]
  /** Design pressure at the top, N/m². */
  pressure: number
  /** Design base shear (N) and overturning moment (N m). */
  shear: number
  moment: number
  /** Top deflection under the design wind (m), over the height, and under the mean wind. */
  deflection: number
  drift: number
  lean: number
  /** Weight, N, and the overturning moment (factored) over the stabilizing moment `W e`. */
  weight: number
  overturn: number
  /** Share of the base moment the walls carry (the rest is the frame's couple). */
  wallShare: number
  /** Bending and shear stiffness of each band (cracked). */
  ei: number[]
  ga: number[]
  /** First mode (Rayleigh): frequency in Hz, angular frequency, modal mass and stiffness, shape at the nodes. */
  frequency: number
  omega: number
  modalMass: number
  modalStiffness: number
  shape: { z: number[]; phi: number[] }
  /** Modal force of the mean wind, N; turbulence intensity for the gust. */
  modalForce: number
  intensity: number
  /** Axial force the design wind adds to each input part, N (compression positive), without the load factor. */
  axial: number[]
}

/**
 * Second moment of area of a beam of web `bw` and depth `h` with a slab flange of width `bf` and thickness `tf` on top (a T section, about its own
 * centroid); the web alone when there is no flange.
 */
export const tBeamInertia = (bw: number, h: number, bf: number, tf: number): number => {
  const web = bw * h
  const fl = Math.max(0, bf - bw) * Math.min(tf, h)
  const t = Math.min(tf, h)
  const yc = (web * (h / 2) + fl * (h - t / 2)) / (web + fl)
  return (bw * h ** 3) / 12 + web * (h / 2 - yc) ** 2 + (Math.max(0, bf - bw) * t ** 3) / 12 + fl * (h - t / 2 - yc) ** 2
}

/** The shape of the first mode at height `z` above the ground (linear between the nodes). */
export const shapeAt = (a: Pick<WindAnalysis, 'shape'>, z: number): number => {
  const { z: zs, phi } = a.shape
  if (z <= zs[0]) return phi[0]
  for (let i = 1; i < zs.length; i++) if (z <= zs[i]) return phi[i - 1] + ((phi[i] - phi[i - 1]) * (z - zs[i - 1])) / (zs[i] - zs[i - 1])
  return phi[phi.length - 1]
}

/**
 * Wind on a building of `parts` standing on the ground at `ground` (the y of the top of the foundations). Null when it has no wall or column.
 * Bands of `bandHeight`; a part gives to a band the share of itself that lies inside it.
 */
export const analyzeWind = (parts: readonly WindPartInput[], c: WindCase, ground: number): WindAnalysis | null => {
  const [dx, dz] = c.direction
  const along = (p: WindPartInput) => {
    const cx = (p.min[0] + p.max[0]) / 2, cz = (p.min[2] + p.max[2]) / 2
    const hx = (p.max[0] - p.min[0]) / 2, hz = (p.max[2] - p.min[2]) / 2
    return {
      u: cx * dx + cz * dz, v: -cx * dz + cz * dx,
      du: 2 * (Math.abs(dx) * hx + Math.abs(dz) * hz), dv: 2 * (Math.abs(dz) * hx + Math.abs(dx) * hz),
    }
  }
  const g = parts.map(along)
  let topY = ground
  let resists = false
  for (const p of parts) {
    if (p.kind === 'foundation') continue
    topY = Math.max(topY, p.max[1])
    if ((p.kind === 'wall' || p.kind === 'column') && p.elasticPa) resists = true
  }
  const height = topY - ground
  if (!(height > 0) || !resists) return null
  const n = Math.max(1, Math.ceil(height / c.bandHeight - 1e-9))
  const bands = Array.from({ length: n }, (_, j) => Math.min(c.bandHeight, height - j * c.bandHeight))
  const z0 = Array.from({ length: n }, (_, j) => j * c.bandHeight)
  const mid = bands.map((h, j) => z0[j] + h / 2)
  const share = (p: WindPartInput, j: number): number => {
    const a = Math.max(p.min[1] - ground, z0[j]), b = Math.min(p.max[1] - ground, z0[j] + bands[j])
    return Math.max(0, b - a)
  }

  // the building across the wind, the weight and the section of walls and columns
  const vmin = new Array<number>(n).fill(Infinity), vmax = new Array<number>(n).fill(-Infinity)
  const mass = new Array<number>(n).fill(0)
  let weight = 0, wu = 0
  let footEnd = -Infinity
  let anyFoundation = false
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    weight += p.mass * GRAVITY
    wu += p.mass * g[i].u
    if (p.kind === 'foundation') {
      anyFoundation = true
      footEnd = Math.max(footEnd, g[i].u + g[i].du / 2)
      continue
    }
    const full = Math.max(1e-6, p.max[1] - p.min[1])
    for (let j = 0; j < n; j++) {
      const ov = share(p, j)
      if (ov <= 0) continue
      vmin[j] = Math.min(vmin[j], g[i].v - g[i].dv / 2)
      vmax[j] = Math.max(vmax[j], g[i].v + g[i].dv / 2)
      if (!p.damper) mass[j] += (p.mass * ov) / full
    }
  }
  if (!anyFoundation) for (let i = 0; i < parts.length; i++) if (parts[i].min[1] - ground < 0.1) footEnd = Math.max(footEnd, g[i].u + g[i].du / 2)
  const totalMass = weight / GRAVITY
  const uCg = totalMass > 0 ? wu / totalMass : 0
  const width = vmax.map((hi, j) => (hi > vmin[j] ? hi - vmin[j] : 0))
  const widest = Math.max(...width)
  const cls = c.cls === 'auto' ? windClass(Math.max(height, widest)) : c.cls

  // forces on the bands
  const k0 = c.speed * c.topography * c.statistical
  const pressure = mid.map((z) => windPressure(k0 * heightFactor(z, c.terrain, cls, { gustFactor: c.gustFactor, minHeight: c.minHeight }), c.airDensity))
  const meanPressure = mid.map((z) => windPressure(k0 * meanHeightFactor(z, c.terrain, cls, { meanRatio: c.meanRatio, minHeight: c.minHeight }), c.airDensity))
  const forces = bands.map((h, j) => pressure[j] * c.drag * width[j] * h)
  const meanForces = bands.map((h, j) => meanPressure[j] * c.drag * width[j] * h)
  const V = shearNodes(forces)
  const M = momentNodes(bands, V)

  // the lateral system: walls as one section, columns as a shear frame
  const ea = new Array<number>(n).fill(0), eau = new Array<number>(n).fill(0)
  const vertical: number[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if ((p.kind !== 'wall' && !(p.kind === 'column' && c.chord)) || !p.elasticPa) continue
    vertical.push(i)
    const area = g[i].du * g[i].dv
    const e = p.elasticPa * c.stiffnessFactor
    for (let j = 0; j < n; j++) {
      const w = share(p, j) / bands[j]
      if (w <= 0) continue
      ea[j] += e * area * w
      eau[j] += e * area * g[i].u * w
    }
  }
  const centre = ea.map((v, j) => (v > 0 ? eau[j] / v : 0))
  const ei = new Array<number>(n).fill(0)
  const ga = new Array<number>(n).fill(0)
  for (const i of vertical) {
    const p = parts[i]
    const e = p.elasticPa! * c.stiffnessFactor
    for (let j = 0; j < n; j++) {
      const w = share(p, j) / bands[j]
      if (w <= 0) continue
      ei[j] += e * ((g[i].du ** 3 * g[i].dv) / 12 + g[i].du * g[i].dv * (g[i].u - centre[j]) ** 2) * w
    }
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p.kind !== 'column' || !p.elasticPa) continue
    const h = Math.max(1e-6, p.max[1] - p.min[1])
    const kc = (p.elasticPa * c.stiffnessFactor * (g[i].du ** 3 * g[i].dv) / 12) / h
    let beams = 0
    for (const b of p.beams ?? []) {
      const q = parts[b]
      if (!q?.elasticPa) continue
      const hx = q.max[0] - q.min[0], hz = q.max[2] - q.min[2]
      const long = Math.max(hx, hz), short = Math.min(hx, hz)
      const cos = hx >= hz ? Math.abs(dx) : Math.abs(dz)
      const depth = q.max[1] - q.min[1]
      const inertia = tBeamInertia(short, depth, short + 2 * c.flange * long, q.slab ?? 0)
      beams += (cos * cos * q.elasticPa * c.beamFactor * inertia) / Math.max(long, 1e-6)
    }
    const k = beams / kc
    const base = p.min[1] - ground < 0.05
    const a = base ? (0.5 + k) / (2 + k) : k / (2 + k)
    const stiffness = (a * 12 * (p.elasticPa * c.stiffnessFactor) * ((g[i].du ** 3 * g[i].dv) / 12)) / (h * h)
    for (let j = 0; j < n; j++) ga[j] += (stiffness * share(p, j)) / bands[j]
  }
  // what stands above the highest wall or column (a roof, its trusses) is carried by them and moves with their top: nothing bends there
  let last = -1
  for (let j = 0; j < n; j++) if (ei[j] > 0 || ga[j] > 0) last = j
  for (let j = last + 1; j < n && last >= 0; j++) {
    ei[j] = ei[last] * RIGID
    ga[j] = ga[last] * RIGID
  }
  const tiny = 1
  const eiS = ei.map((v) => Math.max(v, tiny))
  const gaS = ga.map((v) => Math.max(v, tiny))
  const sol = solveWallFrame(bands, eiS, gaS, V)
  const deflection = sol.w[n]
  const lean = solveWallFrame(bands, eiS, gaS, shearNodes(meanForces)).w[n]

  // what the walls and the frame each carry
  const kappa = bands.map((h, j) => (sol.psi[j + 1] - sol.psi[j]) / h)
  const Mmid = bands.map((h, j) => M[j + 1] + (h / 2) * (V[j + 1] + (V[j] + V[j + 1]) / 2) / 2)
  const Mwall = ei.map((v, j) => Math.min(Mmid[j], Math.max(0, v * kappa[j])))
  const axial = new Array<number>(parts.length).fill(0)
  for (const i of vertical) {
    const p = parts[i]
    let sum = 0, tot = 0
    for (let j = 0; j < n; j++) {
      const w = share(p, j)
      if (w <= 0) continue
      sum += w * p.elasticPa! * c.stiffnessFactor * kappa[j] * g[i].du * g[i].dv * (g[i].u - centre[j])
      tot += w
    }
    axial[i] = tot > 0 ? sum / tot : 0
  }
  if (!c.chord) {
    // the frame carries the rest of the moment as a couple of the columns: forces in proportion to `A d` from their centroid
    const colA = new Array<number>(n).fill(0), colAu = new Array<number>(n).fill(0)
    const cols: number[] = []
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].kind !== 'column') continue
      cols.push(i)
      for (let j = 0; j < n; j++) {
        const w = share(parts[i], j) / bands[j]
        colA[j] += g[i].du * g[i].dv * w
        colAu[j] += g[i].du * g[i].dv * g[i].u * w
      }
    }
    const colC = colA.map((a, j) => (a > 0 ? colAu[j] / a : 0))
    const colI = new Array<number>(n).fill(0)
    for (const i of cols) for (let j = 0; j < n; j++) colI[j] += (g[i].du * g[i].dv * (g[i].u - colC[j]) ** 2 * share(parts[i], j)) / bands[j]
    for (const i of cols) {
      let sum = 0, tot = 0
      for (let j = 0; j < n; j++) {
        const w = share(parts[i], j)
        if (w <= 0 || colI[j] <= 0) continue
        sum += w * (Math.max(0, Mmid[j] - Mwall[j]) * g[i].du * g[i].dv * (g[i].u - colC[j])) / colI[j]
        tot += w
      }
      axial[i] = tot > 0 ? sum / tot : 0
    }
  }

  // stability: overturning moment against the weight over the leeward edge of the foundations
  const arm = footEnd - uCg
  const overturn = arm > 0 ? (c.loadFactor * M[0]) / (weight * arm) : Infinity

  // first mode, Rayleigh: the shape under a load equal to the mass of each band
  const mode = solveWallFrame(bands, eiS, gaS, shearNodes(mass))
  const top = mode.w[n]
  const um = bands.map((_, j) => (mode.w[j] + mode.w[j + 1]) / 2)
  let mu = 0, muu = 0
  mass.forEach((m, j) => {
    mu += m * um[j]
    muu += m * um[j] * um[j]
  })
  const omega = muu > 0 ? Math.sqrt(mu / muu) : 0
  const phi = um.map((u) => (top > 0 ? u / top : 0))
  const modalMass = mass.reduce((s, m, j) => s + m * phi[j] * phi[j], 0)
  const modalForce = meanForces.reduce((s, f, j) => s + f * phi[j], 0)
  const z = [0, ...bands.map((_, j) => z0[j] + bands[j])]
  const intensity = turbulenceIntensity(Math.max(0.6 * height, c.minHeight), c.terrain.z0)

  return {
    height, cls, width: widest, bands, mid, forces, meanForces, pressure: pressure[n - 1], shear: V[0], moment: M[0], deflection, drift: deflection / height, lean,
    weight, overturn, wallShare: M[0] > 0 ? Mwall[0] / M[0] : 0, ei, ga, frequency: omega / (2 * Math.PI), omega, modalMass, modalStiffness: omega * omega * modalMass,
    shape: { z, phi: mode.w.map((w) => (top > 0 ? w / top : 0)) }, modalForce, intensity, axial,
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Tuned mass damper
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Optimal tuning of a damper of mass ratio `mu` (damper mass over the modal mass): its frequency over the building's and its damping ratio.
 * `den-hartog` (1956): `1 / (1 + mu)` and `sqrt(3 mu / (8 (1 + mu)^3))`, for a harmonic force on an undamped structure. `warburton` (1982): for a random
 * force, `sqrt(1 - mu / 2) / (1 + mu)` and `sqrt(mu (1 - mu / 4) / (4 (1 + mu) (1 - mu / 2)))`.
 */
export const damperTuning = (mu: number, kind: 'den-hartog' | 'warburton' = 'den-hartog'): { frequency: number; damping: number } =>
  kind === 'warburton'
    ? { frequency: Math.sqrt(1 - mu / 2) / (1 + mu), damping: Math.sqrt((mu * (1 - mu / 4)) / (4 * (1 + mu) * (1 - mu / 2))) }
    : { frequency: 1 / (1 + mu), damping: Math.sqrt((3 * mu) / (8 * (1 + mu) ** 3)) }

/**
 * Amplitude of the structure under a harmonic force over its static deflection, with a damper: `r` the forcing frequency over the structure's,
 * `mu` the mass ratio, `g` the damper's frequency over the structure's, `damper` and `structure` the damping ratios. Solves
 * `[(1 - r^2 + 2 i zs r) - mu A r^2 / (A - r^2)] X = 1` with `A = g^2 + 2 i zd g r`. `mu` 0 is the structure alone (`1 / (2 zs)` at resonance).
 */
export const damperAmplification = (r: number, mu: number, g: number, damper: number, structure = 0): number => {
  // complex arithmetic by hand: numbers as [re, im]
  const mul = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
  const div = (a: [number, number], b: [number, number]): [number, number] => {
    const d = b[0] * b[0] + b[1] * b[1]
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
  }
  const A: [number, number] = [g * g, 2 * damper * g * r]
  const main: [number, number] = [1 - r * r, 2 * structure * r]
  const coupling = mu > 0 ? mul([mu * r * r, 0], div(A, [A[0] - r * r, A[1]])) : ([0, 0] as [number, number])
  const total: [number, number] = [main[0] - coupling[0], main[1] - coupling[1]]
  return 1 / Math.hypot(total[0], total[1])
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Gust and sway
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** A gust series: sines of equal frequency spacing whose amplitudes follow the Davenport spectrum, normalized to unit variance. */
export interface Gust {
  freq: number[]
  amp: number[]
  phase: number[]
}

/**
 * The turbulence at the 10 m mean speed `v10`: `components` sines up to `maxHz`, amplitudes from the Davenport spectrum `f S(f) / u*^2 = 4 x^2 / (1 + x^2)^(4/3)`,
 * `x = scale f / v10` (NBR 6123 chapter 9, Simiu & Scanlan), phases from the seed.
 */
export const makeGust = (v10: number, o: { components: number; maxHz: number; scale: number; seed: number }): Gust => {
  const rng = createRng(o.seed)
  const n = Math.max(1, Math.floor(o.components))
  const df = o.maxHz / n
  const freq = Array.from({ length: n }, (_, k) => (k + 0.5) * df)
  const weight = freq.map((f) => {
    const x = (o.scale * f) / Math.max(v10, 1e-6)
    return ((4 * x * x) / (1 + x * x) ** (4 / 3) / f) * df
  })
  const sum = weight.reduce((s, w) => s + w, 0)
  return { freq, amp: weight.map((w) => Math.sqrt((2 * w) / sum)), phase: freq.map(() => rng.next() * 2 * Math.PI) }
}

/** The gust at time `t`: zero mean, unit variance. */
export const gustAt = (gust: Gust, t: number): number => {
  let s = 0
  for (let k = 0; k < gust.freq.length; k++) s += gust.amp[k] * Math.cos(2 * Math.PI * gust.freq[k] * t + gust.phase[k])
  return s
}

/** The first mode of a building with an optional tuned mass damper: modal mass, stiffness and damping, and the damper's mass, stiffness and dashpot. */
export interface SwaySystem {
  M: number
  K: number
  C: number
  damper?: { m: number; k: number; c: number }
}

/** Displacement and velocity of the top, and of the damper's mass (absolute). */
export interface SwayState {
  x: number
  v: number
  y: number
  w: number
}

/** Advances `s` by `dt` seconds under the force `force(t)` (N, on the modal mass), RK4 with steps no longer than `maxStep`. */
export const stepSway = (s: SwayState, sys: SwaySystem, t: number, dt: number, force: (t: number) => number, maxStep = Infinity): void => {
  const steps = Math.max(1, Math.ceil(dt / maxStep - 1e-9))
  const h = dt / steps
  const d = sys.damper
  const f = (x: number, v: number, y: number, w: number, tt: number): [number, number, number, number] => {
    const fd = d ? d.k * (y - x) + d.c * (w - v) : 0
    return [v, (force(tt) - sys.K * x - sys.C * v + fd) / sys.M, d ? w : 0, d ? -fd / d.m : 0]
  }
  for (let i = 0; i < steps; i++) {
    const tt = t + i * h
    const k1 = f(s.x, s.v, s.y, s.w, tt)
    const k2 = f(s.x + (h / 2) * k1[0], s.v + (h / 2) * k1[1], s.y + (h / 2) * k1[2], s.w + (h / 2) * k1[3], tt + h / 2)
    const k3 = f(s.x + (h / 2) * k2[0], s.v + (h / 2) * k2[1], s.y + (h / 2) * k2[2], s.w + (h / 2) * k2[3], tt + h / 2)
    const k4 = f(s.x + h * k3[0], s.v + h * k3[1], s.y + h * k3[2], s.w + h * k3[3], tt + h)
    s.x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
    s.v += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    s.y += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
    s.w += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Tension of walls and columns
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Force in newtons a wall or column holds in tension: its vertical rebar at yield (`reinforcement` bars, or `ratio` of the section) when it has any,
 * else the tensile strength of its material times the section, else nothing (a masonry wall does not pull).
 */
export const tensionCapacity = (
  dims: Vec3, o: { reinforcement?: { spacing: number; diameter: number }; ratio?: number; yieldMPa: number; tensileMPa?: number },
): number => {
  const section = dims[0] * dims[2]
  if (o.reinforcement) {
    const bars = verticalBarCount(dims, thinAxisOf(dims), o.reinforcement.spacing)
    return bars * Math.PI * (o.reinforcement.diameter / 2) ** 2 * o.yieldMPa * 1e6
  }
  if (o.ratio) return o.ratio * section * o.yieldMPa * 1e6
  return (o.tensileMPa ?? 0) * 1e6 * section
}
