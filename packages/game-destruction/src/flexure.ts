import { planeAxes } from './breach'
import { thinAxisOf } from './layers'
import { quat, quatFromEuler, rotateVec, shapeDims } from './math'
import { isMember, memberBarCount } from './rebar'
import type { FlexureOptions, MasonryOptions, MaterialDef, PartSpec, StructureRole, Vec3 } from './types'

/**
 * Real structural engineering of beams, slabs, walls and pillars: bending (the tension face cracks, the steel carries the pull, a member without
 * steel snaps) and crushing of slender bearing walls. Pure formulas in SI units (N, m, Pa, J); the world calls them with the parts' geometry.
 */

/** Standard gravity, m/s². A physical constant. */
export const GRAVITY = 9.81
const MPA = 1e6

export const FLEXURE_DEFAULTS: Required<FlexureOptions> = {
  enabled: true,
  roles: ['beam', 'slab', 'roof', 'stair'],
  scope: 'rebar',
  crackFactor: 1.5,
  rebarYieldMPa: 500,
  cover: 0.03,
  neutralAxisLimit: 0.45,
  failRotationDeg: 10,
  loadFactor: 0.64,
  massFactor: 0.5,
  tntJoules: 4.184e6,
  impulse: 200,
  reflection: 2,
  reflectionNear: 4,
  nearScaled: 0.5,
}

export const MASONRY_DEFAULTS: Required<MasonryOptions> = { minEccentricity: 0.05, slendernessLimit: 40, concreteFactor: 0.85 }

export const resolveFlexure = (o?: FlexureOptions): Required<FlexureOptions> => ({ ...FLEXURE_DEFAULTS, ...definedOf(o) })
export const resolveMasonry = (o?: MasonryOptions): Required<MasonryOptions> => ({ ...MASONRY_DEFAULTS, ...definedOf(o) })
const definedOf = <T extends object>(o?: T): Partial<T> => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>

/** Bar diameter assumed for a `structure.rebar` ratio (it only sets where the bar centre is): 10 mm. */
const RATIO_BAR = 0.01

/** Cracking moment of a rectangular section in N m: `alpha * fct * b * h^2 / 6` (NBR 6118 17.3.1). */
export const crackingMoment = (tensileMPa: number, b: number, h: number, alpha = FLEXURE_DEFAULTS.crackFactor): number => alpha * tensileMPa * MPA * (b * h * h) / 6

/**
 * Moment the tension steel gives in N m, with the rectangular stress block of NBR 6118 17.2.2 (`0.85 * fck` over `0.8 x`): the steel pulls
 * `T = As * fy`, the block takes it at depth `x = T / (0.68 * fck * b)`, and `M = T * (d - 0.4 x)`. Past the ductility limit `x = limit * d` the
 * concrete would crush first, so the steel beyond what balances the block is taken as paired with compression steel (double reinforcement, NBR 6118
 * 17.2.4): it adds `T2 * (d - d')`, `d'` being the cover to the compression bars.
 */
export const steelMoment = (
  area: number, yieldMPa: number, d: number, b: number, compressiveMPa: number, options: Pick<FlexureOptions, 'neutralAxisLimit' | 'cover'> = {},
): number => {
  if (area <= 0 || d <= 0 || b <= 0) return 0
  const T = area * yieldMPa * MPA
  const block = 0.68 * compressiveMPa * MPA * b
  const x = T / block
  const xl = (options.neutralAxisLimit ?? FLEXURE_DEFAULTS.neutralAxisLimit) * d
  if (x <= xl) return T * (d - 0.4 * x)
  const top = Math.min(d / 2, (options.cover ?? FLEXURE_DEFAULTS.cover) + RATIO_BAR / 2)
  return block * xl * (d - 0.4 * xl) + (T - block * xl) * (d - top)
}

/** Stiffness in N/m of a simply supported span under uniform load, at mid-span: `384 E I / (5 L^3)`. */
export const spanStiffness = (EI: number, span: number): number => (384 * EI) / (5 * span ** 3)

/**
 * Strain energy in J of the equivalent one-degree-of-freedom system of a span whose peak moment is `M` (uniform load: `R = 8 M / L`): `KL * R^2 / (2 k)`.
 */
export const elasticEnergy = (moment: number, span: number, EI: number, loadFactor = FLEXURE_DEFAULTS.loadFactor): number => {
  const R = (8 * moment) / span
  return (loadFactor * R * R) / (2 * spanStiffness(EI, span))
}

/** Inverse of `elasticEnergy`: the peak moment in N m a span reaches when it takes `energy` J elastically. */
export const momentOfEnergy = (energy: number, span: number, EI: number, loadFactor = FLEXURE_DEFAULTS.loadFactor): number =>
  (span / 8) * Math.sqrt((2 * Math.max(0, energy) * spanStiffness(EI, span)) / loadFactor)

/** Kinetic energy in J an impulse `I` (N s) gives the equivalent system of a span of mass `m` (kg): `(KL I)^2 / (2 KM m)` (Biggs 1964). */
export const impulseEnergy = (impulse: number, mass: number, options: Pick<FlexureOptions, 'loadFactor' | 'massFactor'> = {}): number => {
  const KL = options.loadFactor ?? FLEXURE_DEFAULTS.loadFactor
  const KM = options.massFactor ?? FLEXURE_DEFAULTS.massFactor
  return mass > 0 ? (KL * impulse) ** 2 / (2 * KM * mass) : 0
}

/**
 * Reflected impulse per area in Pa s of a charge of `tnt` kg at `distance` m on a face that looks at it. The incident impulse is Sadovsky's
 * `impulse * W^(2/3) / R`; the face reflects it by `reflection + reflectionNear / Z` (`Z = R / W^(1/3)`, m/kg^(1/3)): about 2 far away, 4 to 6 at
 * one or two metres per cube root kilogram, as the reflected-impulse curves of UFC 3-340-02 (fig. 2-7) rise towards the charge. Below `nearScaled`
 * the distance is held at that scaled distance.
 */
export const blastImpulse = (
  tnt: number, distance: number, options: Pick<FlexureOptions, 'impulse' | 'reflection' | 'reflectionNear' | 'nearScaled'> = {},
): number => {
  if (tnt <= 0) return 0
  const o = { ...FLEXURE_DEFAULTS, ...definedOf(options) }
  const cube = Math.cbrt(tnt)
  const r = Math.max(distance, o.nearScaled * cube)
  return (o.reflection + o.reflectionNear / (r / cube)) * ((o.impulse * cube * cube) / r)
}

/**
 * Share of the compressive strength a wall or pillar of height `h` and thickness `t` keeps: the unavoidable eccentricity `(1 - 2 e)` times the
 * slenderness reduction `1 - (h / t / limit)^3` (NBR 16868-1), never below 0.
 */
export const slendernessFactor = (h: number, t: number, options: MasonryOptions = {}): number => {
  const o = resolveMasonry(options)
  const lambda = h / Math.max(t, 1e-3)
  return Math.max(0, (1 - 2 * o.minEccentricity) * (1 - (lambda / o.slendernessLimit) ** 3))
}

/** The part is reinforced for bending: a `reinforcement` cage or a `structure.rebar` ratio. */
export const isReinforced = (part: PartSpec): boolean => !!part.reinforcement || (part.structure?.rebar?.ratio ?? 0) > 0

/** The part's material is slender masonry or plain concrete (`strength.slender`, default: tagged `masonry` and not reinforced). */
export const isSlender = (part: PartSpec, material: MaterialDef): boolean =>
  material.strength?.slender ?? (!!material.tags?.includes('masonry') && !isReinforced(part))

/** The part takes part in the bending model. */
export const isFlexural = (part: PartSpec, material: MaterialDef, options: Required<FlexureOptions>): boolean =>
  options.enabled && material.strength?.tensileMPa !== undefined && !!part.structure && options.roles.includes(part.structure.role) &&
  (part.structure.rebar !== undefined || options.scope === 'all' || (options.scope === 'reinforced' && !!part.reinforcement))

/** A bending section: width `b`, depth `h` (along the bending), in metres. */
export interface BendSection {
  b: number
  h: number
}

/** Tension steel of a section: area in m², effective depth in m, yield in MPa. */
export interface TensionSteel {
  area: number
  d: number
  yieldMPa: number
}

/**
 * Tension steel of the part for a section of width `b` and depth `h`: from `structure.rebar` (`ratio * b * d`), else from the `reinforcement` cage
 * (a plate's grid: one bar every `spacing` across `b`; a long member: the bars of the perimeter on the tension face). Zero for plain concrete.
 */
export const tensionSteel = (part: PartSpec, dims: Vec3, section: BendSection, options: Required<FlexureOptions>): TensionSteel => {
  const rebar = part.structure?.rebar
  const cage = part.reinforcement
  const bar = rebar ? RATIO_BAR : cage?.diameter ?? RATIO_BAR
  const d = Math.max(0.01, section.h - (rebar?.cover ?? options.cover) - bar / 2)
  const yieldMPa = rebar?.yieldMPa ?? options.rebarYieldMPa
  if (rebar && rebar.ratio > 0) return { area: rebar.ratio * section.b * d, d, yieldMPa }
  if (!cage) return { area: 0, d, yieldMPa }
  const one = (Math.PI * cage.diameter * cage.diameter) / 4
  const count = isMember(dims) ? memberBarCount(section.b, cage.spacing) : section.b / cage.spacing
  return { area: one * count, d, yieldMPa }
}

/**
 * Moments of a section in N m: `cracking` (the concrete's), `steel` (what the tension steel gives once the concrete has cracked; 0 for plain
 * concrete), `ultimate` (what the uncracked section holds: the larger of the two) and `reinforced` (it has steel: when it fails it hinges and its bars
 * keep it in one piece; without steel it snaps).
 */
export interface SectionMoments {
  cracking: number
  steel: number
  ultimate: number
  reinforced: boolean
}

export const sectionMoments = (material: MaterialDef, section: BendSection, steel: TensionSteel, options: Required<FlexureOptions>): SectionMoments => {
  const s = material.strength!
  const cracking = crackingMoment(s.tensileMPa ?? 0, section.b, section.h, options.crackFactor)
  const steelM = steelMoment(steel.area, steel.yieldMPa, steel.d, section.b, s.compressiveMPa, options)
  return { cracking, steel: steelM, ultimate: Math.max(cracking, steelM), reinforced: steelM > 0 }
}

/** Static moment in N m at mid-span of a span `L` under a uniform load `w` (N/m): `w L^2 / 8`. */
export const spanMoment = (w: number, span: number): number => (w * span * span) / 8

/**
 * How a box part bends, in its own axes. A long member (beam) spans along `long` and bends about either cross axis; a plate (slab) spans in the plane
 * of `plane` and bends across its thickness `thin`. `gravity` is the axis the weight bends it along (the local axis closest to the vertical among those
 * it can bend along, when it is within 45 degrees of it; -1 for a plate standing on edge). `up` is the world vertical in the part's axes.
 */
export interface BendGeometry {
  dims: Vec3
  member: boolean
  /** Axes the span is measured along: `[long]` for a member, the two plane axes for a plate. */
  spanAxes: number[]
  /** Axes the part can bend along (its depth): the two cross axes of a member, the thickness of a plate. */
  depthAxes: number[]
  gravity: number
  up: Vec3
}

export const bendGeometry = (part: PartSpec): BendGeometry => {
  const dims = shapeDims(part.shape)
  const member = isMember(dims)
  const q = quatFromEuler(...(part.rotation ?? [0, 0, 0]))
  const up = rotateVec(quat.conjugate(q), [0, 1, 0])
  let spanAxes: number[]
  let depthAxes: number[]
  if (member) {
    const long = dims.indexOf(Math.max(...dims))
    spanAxes = [long]
    depthAxes = [0, 1, 2].filter((i) => i !== long)
  } else {
    const thin = thinAxisOf(dims)
    spanAxes = [...planeAxes(thin)]
    depthAxes = [thin]
  }
  let gravity = -1
  for (const a of depthAxes) if (Math.abs(up[a]) > Math.SQRT1_2 && (gravity < 0 || Math.abs(up[a]) > Math.abs(up[gravity]))) gravity = a
  return { dims, member, spanAxes, depthAxes, gravity, up }
}

/** Width of the section that bends along `axis`: the other cross axis of a member, a strip of 1 m of a plate. */
export const sectionWidth = (g: BendGeometry, axis: number): number => (g.member ? g.dims[g.depthAxes.find((a) => a !== axis) ?? axis] : 1)

/**
 * Uniform load in N per metre of span of the bending section when the part carries `load` kg: per metre of a member's length, per metre-wide strip
 * of a plate (its load per square metre times 1 m).
 */
export const lineLoad = (g: BendGeometry, load: number): number => {
  const area = g.member ? g.dims[g.spanAxes[0]!] : g.dims[g.spanAxes[0]!] * g.dims[g.spanAxes[1]!]
  return (load * GRAVITY) / Math.max(area, 1e-6)
}

/**
 * Span in metres from the regions the part rests on (`contacts`: boxes `[min, max]` in the part's axes): twice the farthest any point of the part
 * is from its nearest support, measured along the span axes as the largest of the per-axis gaps. Two walls 4 m apart give 4 m, four columns at the
 * corners of a 5 x 4 m panel give 5 m (the long way), a cantilever of 1.5 m gives 3 m (the same moment, `w c^2 / 2`). 0 without contacts.
 */
export const spanOf = (g: BendGeometry, contacts: ReadonlyArray<readonly [Vec3, Vec3]>, samples = 9): number => {
  if (contacts.length === 0) return 0
  const axes = g.spanAxes
  const steps = (a: number) => Array.from({ length: samples }, (_, i) => (i / (samples - 1) - 0.5) * g.dims[a])
  const us = steps(axes[0]!)
  const vs = axes.length > 1 ? steps(axes[1]!) : [0]
  let far = 0
  for (const u of us) for (const v of vs) {
    let near = Infinity
    for (const [lo, hi] of contacts) {
      let gap = 0
      const x = [u, v]
      axes.forEach((a, k) => (gap = Math.max(gap, lo[a] - x[k]!, x[k]! - hi[a], 0)))
      if (gap < near) near = gap
    }
    if (near > far) far = near
  }
  return 2 * far
}

/** Roles that carry bending by default. */
export const FLEXURAL_ROLES: readonly StructureRole[] = FLEXURE_DEFAULTS.roles

export interface BearingWallOptions {
  /** Storeys the wall carries, the ground floor included. */
  storeys: number
  /** Height of one storey in metres. */
  storeyHeight: number
  /** Load each floor puts on one metre of wall, in N/m (dead and live load of the floor's share). */
  floorLoad: number
  /** Material of the wall (default the built-in `brick`): `strength.compressiveMPa` and `density`. */
  material: Pick<MaterialDef, 'density' | 'strength'>
  /** Load factor (1.4: NBR 8681, permanent and variable loads). */
  loadFactor?: number
  /** Material factor (2.0: NBR 16868-1, masonry). */
  materialFactor?: number
  /** Thinnest bearing wall in metres (0.14: NBR 16868-1). */
  minThickness?: number
  /** Thicknesses are rounded up to this many metres (0.01). */
  step?: number
  masonry?: MasonryOptions
}

/**
 * Thickness of a bearing masonry wall storey by storey, ground floor first, as a designer sizes it: the load from the top down (every floor plus the
 * walls above, times `loadFactor`) within `fk / materialFactor` times the slenderness factor of each storey's wall. `Infinity` when a storey cannot be
 * carried at any thickness (the wall's own weight per storey already uses up the strength).
 */
export const bearingWallThickness = (options: BearingWallOptions): number[] => {
  const gf = options.loadFactor ?? 1.4
  const gm = options.materialFactor ?? 2
  const min = options.minThickness ?? 0.14
  const step = options.step ?? 0.01
  const fd = ((options.material.strength?.compressiveMPa ?? 0) * MPA) / gm
  const own = options.material.density * GRAVITY * options.storeyHeight
  const out: number[] = []
  let above = 0
  for (let i = 0; i < options.storeys; i++) {
    const n = above + options.floorLoad
    let t = min
    for (let k = 0; k < 60; k++) {
      const room = fd * slendernessFactor(options.storeyHeight, t, options.masonry) - gf * own
      if (room <= 0) {
        // too slender (or too weak) at this thickness: try a thicker wall, give up past 20 m
        t *= 1.25
        if (t > 20) {
          t = Infinity
          break
        }
        continue
      }
      const next = Math.max(min, (gf * n) / room)
      if (Math.abs(next - t) < 1e-5) break
      t = next
    }
    t = Number.isFinite(t) ? Math.ceil(t / step - 1e-9) * step : Infinity
    out.push(t)
    above = n + own * (Number.isFinite(t) ? t : 0)
  }
  return out.reverse()
}
