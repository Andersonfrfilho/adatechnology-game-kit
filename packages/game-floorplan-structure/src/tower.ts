import type { DestructibleSpec, JointSpec, PartSpec, Vec3, WindExposure } from '@adatechnology/game-contracts'
import { MATERIALS, buildFrame, partMass, sizeStructure } from '@adatechnology/game-destruction'
import type { FrameOptions, SizeStructureOptions, WindOptions } from '@adatechnology/game-destruction'

/**
 * Building systems of a multi-storey building, as parts added to a frame spec: the rigid concrete core (shear-wall tube with the stairs and the
 * elevator shafts inside), the glass curtain wall hung from the slab edges, the flat roof (screed sloped to the drains and a waterproofing
 * membrane) and the mechanical floor under it (elevator machines, the water tank, chillers). Every number is an option with a real default; see the
 * design T10-estrutura-real.md §9.
 */

/** The frame the systems are added to, in metres: what `buildFrame` was given. */
export interface TowerGeometry {
  floors: number
  /** Clear height of a storey (`buildFrame` `height`). */
  height: number
  /** Slab thickness. */
  slab: number
  spanX: number
  spanZ: number
  columnSize: number
  /** Columns along x and z (`buildFrame` `columnsX`, `columnsZ`; default 3 and 4, as `TOWER_DEFAULTS`). */
  columnsX?: number
  columnsZ?: number
  /** Depth of the beams (`buildFrame` `beamHeight`; default 0.6 m, as `TOWER_DEFAULTS`). */
  beamHeight?: number
  /** The top slab is a roof (`roof` id) instead of `slab_<floors-1>`. */
  roof: boolean
}

const slabId = (g: TowerGeometry, f: number): string => (f === g.floors - 1 && g.roof ? 'roof' : `slab_${f}`)
/** Bottom of storey `f` (top of the slab under it; storey 0 starts at the ground). */
const storeyBase = (g: TowerGeometry, f: number): number => f * (g.height + g.slab)
/** Half sizes of the slabs (`buildFrame` makes them the span plus a column and 0.1 m each side). */
const slabHalf = (g: TowerGeometry): [number, number] => [(g.spanX + g.columnSize + 0.2) / 2, (g.spanZ + g.columnSize + 0.2) / 2]

const box = (size: Vec3) => ({ kind: 'box' as const, size })
const rests = (joints: JointSpec[], a: string, b: string, kind: JointSpec['kind'], bears: JointSpec['bears'] = 'a_on_b') => joints.push({ id: `${a}~${b}`, a, b, kind, bears })

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Rigid core
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface CoreOptions {
  /** Centre of the core in plan, object-local `[x, z]` (default `[0, 0]`). */
  center?: [number, number]
  /** Thickness of the outer walls of the tube (default 0.35 m: 30 to 60 cm in high-rise cores; at least h/25, NBR 6118 18.5 / EN 1992-1-1 9.6). */
  wallThickness?: number
  /** Thickness of the walls inside it, between the stair and the shafts and between shafts (default 0.2 m). */
  innerThickness?: number
  /** Elevator shafts (default 2), each `shaft` wide along z and `shaftDepth` deep along x. */
  elevators?: number
  shaft?: number
  shaftDepth?: number
  /** Stair compartment: width along x (two flights of 1.2 m side by side) and length along z (default 2.6 x 4.8 m, NBR 9077). */
  stairWidth?: number
  stairLength?: number
  /** Concrete of the walls (default `concrete`). */
  material?: string
  /** Rebar cage of the walls: bars of `diameter` every `spacing` (default 12.5 mm every 0.15 m: about 0.5% of the section, above the 0.2% of EN 1992-1-1 9.6.2). */
  rebar?: { spacing?: number; diameter?: number }
  /** Thickness of the mat foundation under the core when the frame has no raft (default 1.2 m). */
  matThickness?: number
}

export const CORE_DEFAULTS = {
  wallThickness: 0.35, innerThickness: 0.2, elevators: 2, shaft: 2.2, shaftDepth: 2.4, stairWidth: 2.6, stairLength: 4.8, material: 'concrete',
  rebar: { spacing: 0.15, diameter: 0.0125 }, matThickness: 1.2,
} as const

/** Outer size of the core in plan, `[x, z]`, from its options: the stair compartment beside the row of shafts. */
export const coreSize = (o: CoreOptions = {}): [number, number] => {
  const c = { ...CORE_DEFAULTS, ...o }
  const shafts = c.elevators * c.shaft + Math.max(0, c.elevators - 1) * c.innerThickness
  return [2 * c.wallThickness + c.stairWidth + c.innerThickness + c.shaftDepth, 2 * c.wallThickness + Math.max(c.stairLength, shafts)]
}

/**
 * Adds the concrete core: four shear walls per storey forming a tube, the wall between the stair and the shafts and the walls between shafts, each
 * resting on the one below (continuous from the foundation to the roof) with its rebar cage, the slab of each storey resting on the tube, two
 * flights and a landing of stairs per storey inside, and an elevator car parked at the bottom of each shaft. Part ids: `core_<f>_<n|s|e|w|stair|shaft_k>`,
 * `stair_<f>_a|b`, `landing_<f>`, `elevator_<k>`, `core_mat`.
 */
export function addCore(spec: DestructibleSpec, g: TowerGeometry, options: CoreOptions = {}): DestructibleSpec {
  const c = { ...CORE_DEFAULTS, ...options, rebar: { ...CORE_DEFAULTS.rebar, ...options.rebar } }
  const [cx, cz] = options.center ?? [0, 0]
  const [W, L] = coreSize(options)
  const t = c.wallThickness, ti = c.innerThickness
  const x0 = cx - W / 2, z0 = cz - L / 2
  const parts: PartSpec[] = [...spec.parts]
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  const reinforcement = { material: 'steel', spacing: c.rebar.spacing, diameter: c.rebar.diameter }
  const raft = parts.find((p) => p.id === 'raft')
  let base = raft?.id
  if (!base) {
    base = 'core_mat'
    parts.push({ id: base, material: c.material, shape: box([W + 1, c.matThickness, L + 1]), position: [cx, -c.matThickness / 2, cz], structure: { role: 'foundation' }, anchored: true })
  }
  const innerX = x0 + t + c.stairWidth + ti / 2
  for (let f = 0; f < g.floors; f++) {
    const yb = storeyBase(g, f), H = g.height
    const wall = (name: string, size: Vec3, pos: [number, number]) => {
      const id = `core_${f}_${name}`
      parts.push({ id, material: c.material, shape: box(size), position: [pos[0], yb + H / 2, pos[1]], structure: { role: 'wall' }, reinforcement, tags: ['core'] })
      rests(joints, id, f === 0 ? base! : `core_${f - 1}_${name}`, 'rebar')
      return id
    }
    const tube = [
      wall('w', [t, H, L], [x0 + t / 2, cz]),
      wall('e', [t, H, L], [x0 + W - t / 2, cz]),
      wall('n', [W - 2 * t, H, t], [cx, z0 + L - t / 2]),
      wall('s', [W - 2 * t, H, t], [cx, z0 + t / 2]),
    ]
    wall('stair', [ti, H, L - 2 * t], [innerX, cz])
    for (let k = 1; k < c.elevators; k++) {
      wall(`shaft_${k}`, [c.shaftDepth, H, ti], [innerX + ti / 2 + c.shaftDepth / 2, z0 + t + k * c.shaft + (k - 1) * ti + ti / 2])
    }
    for (const w of tube) rests(joints, slabId(g, f), w, 'rebar')
    // the stairs: two flights of half the storey each and the landing between them, cast into the walls of the tube
    const rise = (H + g.slab) / 2
    const flightWidth = (c.stairWidth - 0.2) / 2
    const landing = 1.2
    const run = c.stairLength - 2 * landing
    const angle = Math.atan2(rise, run)
    const length = Math.hypot(rise, run)
    const sx = x0 + t
    const landingId = `landing_${f}`
    parts.push({ id: landingId, material: c.material, shape: box([c.stairWidth, 0.15, landing]), position: [sx + c.stairWidth / 2, yb + rise - 0.075, z0 + t + c.stairLength - landing / 2], structure: { role: 'stair' }, tags: ['stair'] })
    rests(joints, landingId, `core_${f}_w`, 'rebar')
    rests(joints, landingId, `core_${f}_stair`, 'rebar')
    const zMid = z0 + t + landing + run / 2
    for (const [k, side] of [['a', 0], ['b', 1]] as const) {
      const id = `stair_${f}_${k}`
      const up = side === 0 ? 1 : -1
      parts.push({
        id, material: c.material, shape: box([flightWidth, 0.15, length]), position: [sx + flightWidth / 2 + side * (flightWidth + 0.2), yb + rise / 2 + side * rise, zMid],
        rotation: [up * angle * -1, 0, 0], structure: { role: 'stair' }, tags: ['stair'],
      })
      rests(joints, id, landingId, 'rebar')
      rests(joints, id, side === 0 ? `core_${f}_w` : `core_${f}_stair`, 'rebar')
    }
  }
  // a car at the bottom of each shaft (it hangs from its machine on the mechanical floor; parked, it rests on the pit)
  for (let k = 0; k < c.elevators; k++) {
    const id = `elevator_${k}`
    parts.push({
      id, material: 'steel', shape: box([c.shaftDepth - 0.6, 2.3, c.shaft - 0.6]), position: [innerX + ti / 2 + c.shaftDepth / 2, 1.15 + 0.05, z0 + t + k * (c.shaft + ti) + c.shaft / 2],
      fill: 0.03, mass: 1500, tags: ['elevator_car'],
    })
    rests(joints, id, base, 'resting', false)
  }
  return { ...spec, parts, joints }
}

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Curtain wall
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface CurtainWallOptions {
  /** Width of a panel (default 1.5 m). */
  panel?: number
  /** Glass of the panels (default `glass`: annealed or laminated glass that breaks in large shards; `tempered_glass` breaks in small cubes). */
  material?: string
  /** Glass thickness in metres: the two panes of an insulated unit (default 0.012, 6 + 6 mm). */
  thickness?: number
  /** Mass of the aluminium frame per m² of facade (default 10 kg/m²). */
  frameKgM2?: number
  /** Size of the pieces a broken panel falls in (default 0.6 m: a laminated pane breaks in large shards held by the interlayer). */
  shard?: number
  /** Gap from the slab edge to the glass (default 0.1 m). */
  offset?: number
  /** Storeys without glass (the mechanical floor has louvres): default none. */
  skip?: (floor: number) => boolean
}

export const CURTAIN_DEFAULTS = { panel: 1.5, material: 'glass', thickness: 0.012, frameKgM2: 10, shard: 0.6, offset: 0.1 } as const

/**
 * Adds a glass curtain wall around the frame: one panel per bay and storey, floor to floor, hung from the edge of the slab above it (`bolt`, carries
 * nothing: role none). In a blast the panels shatter into `shard`-sized pieces (`units`) that fall from the facade; a panel whose slab falls goes
 * with it. Part ids: `glass_<f>_<side>_<k>` with side `n`, `s`, `e`, `w`.
 */
export function addCurtainWall(spec: DestructibleSpec, g: TowerGeometry, options: CurtainWallOptions = {}): DestructibleSpec {
  const c = { ...CURTAIN_DEFAULTS, ...options }
  const parts: PartSpec[] = [...spec.parts]
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  const [hx, hz] = slabHalf(g)
  const h = g.height + g.slab
  const sides = [
    { name: 'n', along: 0, length: 2 * hx, fixed: hz + c.offset, axis: 2 },
    { name: 's', along: 0, length: 2 * hx, fixed: -hz - c.offset, axis: 2 },
    { name: 'e', along: 2, length: 2 * hz, fixed: hx + c.offset, axis: 0 },
    { name: 'w', along: 2, length: 2 * hz, fixed: -hx - c.offset, axis: 0 },
  ]
  for (let f = 0; f < g.floors; f++) {
    if (c.skip?.(f)) continue
    const yb = storeyBase(g, f)
    for (const s of sides) {
      const n = Math.max(1, Math.round(s.length / c.panel))
      const w = s.length / n
      for (let k = 0; k < n; k++) {
        const id = `glass_${f}_${s.name}_${k}`
        const at = -s.length / 2 + (k + 0.5) * w
        const size: Vec3 = s.axis === 2 ? [w - 0.01, h - 0.01, c.thickness] : [c.thickness, h - 0.01, w - 0.01]
        const position: Vec3 = s.axis === 2 ? [at, yb + h / 2, s.fixed] : [s.fixed, yb + h / 2, at]
        parts.push({
          id, material: c.material, shape: box(size), position, mass: (2500 * c.thickness + c.frameKgM2) * w * h, thickness: c.thickness,
          units: { size: [c.shard, c.shard, c.thickness], bond: 'stack', mortar: 'plastic' }, tags: ['curtain_wall', 'glass'],
        })
        rests(joints, id, slabId(g, f), 'bolt', false)
      }
    }
  }
  return { ...spec, parts, joints }
}

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Punched facade
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface PunchedFacadeOptions {
  /** Material of the infill wall (default `brick`: a masonry or block wall between the columns, as the residential towers are built). */
  material?: string
  /** Thickness of the wall in metres (default 0.2). */
  thickness?: number
  /** Width of the window as a share of the clear bay (default 0.6). */
  window?: number
  /** Sill and head of the window above the floor of the storey (default 0.9 and 2.4 m; the head is kept under the beam). */
  sill?: number
  head?: number
  /** Glass of the window and its thickness (default `glass`, 12 mm: an insulated unit). */
  glass?: string
  glassThickness?: number
  /** Storeys without infill (louvres on a mechanical floor): default none. */
  skip?: (floor: number) => boolean
}

export const PUNCHED_DEFAULTS = { material: 'brick', thickness: 0.2, window: 0.6, sill: 0.9, head: 2.4, glass: 'glass', glassThickness: 0.012 } as const

/**
 * Closes the perimeter bays of every storey with an infill wall that has a window in it (the alternative to the curtain wall): a sill wall under the
 * window, a wall over it and a pier at each side, all resting on the columns of the bay (role partition: they load the columns and carry nothing, as the
 * walls of `buildFrame`), and the glass in the opening, which rests on the sill and carries nothing. Part ids: `infill_<f>_<side>_<k>_sill|head|pl|pr`,
 * `glass_<f>_<side>_<k>` with side `n`, `s`, `e`, `w` (the same ids as the curtain wall, so the two exclude each other).
 */
export function addPunchedFacade(spec: DestructibleSpec, g: TowerGeometry, options: PunchedFacadeOptions = {}): DestructibleSpec {
  const c = { ...PUNCHED_DEFAULTS, ...options }
  const parts: PartSpec[] = [...spec.parts]
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  const nx = Math.max(2, g.columnsX ?? 3), nz = Math.max(2, g.columnsZ ?? 4)
  const xs = Array.from({ length: nx }, (_, i) => -g.spanX / 2 + (i * g.spanX) / (nx - 1))
  const zs = Array.from({ length: nz }, (_, j) => -g.spanZ / 2 + (j * g.spanZ) / (nz - 1))
  const beamUnder = g.beamHeight ?? TOWER_DEFAULTS.beamHeight
  for (let f = 0; f < g.floors; f++) {
    if (c.skip?.(f)) continue
    const yb = storeyBase(g, f)
    const room = g.height - beamUnder
    const head = Math.min(c.head, room - 0.3), sill = Math.min(c.sill, head - 0.6)
    const wall = (id: string, size: Vec3, position: Vec3, on: string[]) => {
      parts.push({ id, material: c.material, shape: box(size), position, structure: { role: 'partition' }, tags: ['infill'] })
      for (const o of on) rests(joints, id, o, 'mortar')
    }
    const bay = (side: string, k: number, along: 0 | 2, centre: number, fixed: number, length: number, c1: string, c2: string) => {
      const clear = length - g.columnSize
      const win = clear * c.window
      const pier = (clear - win) / 2
      const at = (u: number): Vec3 => (along === 0 ? [u, 0, fixed] : [fixed, 0, u])
      const size = (u: number, h: number): Vec3 => (along === 0 ? [u, h, c.thickness] : [c.thickness, h, u])
      const put = (name: string, u: number, h: number, y: number, centreU: number, on: string[]) => {
        const p = at(centreU)
        wall(`infill_${f}_${side}_${k}_${name}`, size(u, h), [p[0], y, p[2]], on)
      }
      const id = (name: string) => `infill_${f}_${side}_${k}_${name}`
      put('sill', clear, sill, yb + sill / 2, centre, [c1, c2])
      put('pl', pier, head - sill, yb + sill + (head - sill) / 2, centre - clear / 2 + pier / 2, [c1, id('sill')])
      put('pr', pier, head - sill, yb + sill + (head - sill) / 2, centre + clear / 2 - pier / 2, [c2, id('sill')])
      put('head', clear, room - head, yb + head + (room - head) / 2, centre, [c1, c2])
      const gp = at(centre)
      const gid = `glass_${f}_${side}_${k}`
      parts.push({
        id: gid, material: c.glass, shape: box(size(win - 0.01, head - sill)), position: [gp[0], yb + sill + (head - sill) / 2, gp[2]], thickness: c.glassThickness,
        units: { size: [0.6, 0.6, c.glassThickness], bond: 'stack', mortar: 'plastic' }, tags: ['window', 'glass'],
      })
      rests(joints, gid, id('sill'), 'glue', false)
    }
    for (const [side, j] of [['s', 0], ['n', nz - 1]] as const) {
      for (let i = 0; i < nx - 1; i++) bay(side, i, 0, (xs[i] + xs[i + 1]) / 2, zs[j], xs[i + 1] - xs[i], `column_${f}_${i}_${j}`, `column_${f}_${i + 1}_${j}`)
    }
    for (const [side, i] of [['w', 0], ['e', nx - 1]] as const) {
      for (let j = 0; j < nz - 1; j++) bay(side, j, 2, (zs[j] + zs[j + 1]) / 2, xs[i], zs[j + 1] - zs[j], `column_${f}_${i}_${j}`, `column_${f}_${i}_${j + 1}`)
    }
  }
  return { ...spec, parts, joints }
}

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Flat roof
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface FlatRoofOptions {
  /** Slope of the screed to the drains (default 0.01: 1%, the minimum of NBR 9575 for flat roofs). */
  slope?: number
  /** Screed thickness at the drains (default 0.02 m). */
  screedMin?: number
  /** Density of the screed (default 2000 kg/m³, cement and sand). */
  screedDensity?: number
  /** Membrane material and thickness (default `rubber` 1.5 mm: an EPDM sheet). */
  membrane?: string
  membraneThickness?: number
  /** Drains (default one per 150 m² of roof, at least 2, on the long centre line). */
  drains?: number
  /** Water standing on the membrane in metres (default 0.005: 5 mm of a storm on its way to the drains); set it in game with `setLiters`. */
  water?: number
}

export const FLAT_ROOF_DEFAULTS = { slope: 0.01, screedMin: 0.02, screedDensity: 2000, membrane: 'rubber', membraneThickness: 0.0015, water: 0.005, areaPerDrain: 150 } as const

/**
 * Turns the top slab into a flat roof: a screed sloped to the drains (its weight from the mean thickness `screedMin + slope * run / 2`), the
 * waterproofing membrane over it with the rain water on it (`contains` water, running down through a puncture: `outflow` [0, -1, 0], so a shot through
 * the membrane is a `leak` into the floor below) and the drains (tag `drain`). Screed and membrane load the roof slab (role partition: carried,
 * carry nothing). Part ids: `roof_screed`, `roof_membrane`, `roof_drain_<k>`.
 */
export function addFlatRoof(spec: DestructibleSpec, g: TowerGeometry, options: FlatRoofOptions = {}): DestructibleSpec {
  const c = { ...FLAT_ROOF_DEFAULTS, ...options }
  const parts: PartSpec[] = [...spec.parts]
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  const top = slabId(g, g.floors - 1)
  const slab = parts.find((p) => p.id === top)
  if (!slab || slab.shape.kind !== 'box') return spec
  const [sx, sy, sz] = slab.shape.size
  const area = sx * sz
  const longX = sx >= sz
  const count = c.drains ?? Math.max(2, Math.ceil(area / c.areaPerDrain))
  const long = longX ? sx : sz
  const spacing = long / count
  // the farthest point from a drain: half the spacing along the line and half the width across it
  const run = Math.hypot(spacing / 2, (longX ? sz : sx) / 2)
  const screed = c.screedMin + (c.slope * run) / 2
  const y = slab.position[1] + sy / 2
  parts.push({
    id: 'roof_screed', material: 'concrete', shape: box([sx, screed, sz]), position: [slab.position[0], y + screed / 2, slab.position[2]], mass: c.screedDensity * screed * area,
    structure: { role: 'partition' }, tags: ['roof_screed'],
  })
  rests(joints, 'roof_screed', top, 'mortar')
  const my = y + screed + c.membraneThickness / 2
  parts.push({
    id: 'roof_membrane', material: c.membrane, shape: box([sx, c.membraneThickness, sz]), position: [slab.position[0], my, slab.position[2]], thickness: c.membraneThickness,
    structure: { role: 'partition' }, contains: { fluid: 'water', liters: c.water * area * 1000, outflow: [0, -1, 0] }, tags: ['roof_membrane', 'waterproofing'],
  })
  rests(joints, 'roof_membrane', top, 'glue')
  for (let k = 0; k < count; k++) {
    const at = -long / 2 + (k + 0.5) * spacing
    const id = `roof_drain_${k}`
    parts.push({
      id, material: 'plastic', shape: { kind: 'cylinder', radius: 0.05, height: 0.1 }, position: longX ? [slab.position[0] + at, my, slab.position[2]] : [slab.position[0], my, slab.position[2] + at],
      fill: 0.2, tags: ['drain'],
    })
    rests(joints, id, top, 'glue', false)
  }
  return { ...spec, parts, joints }
}

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Mechanical floor
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface MechanicalFloorOptions {
  /** Elevator machines: one per elevator, over its shaft (default from the core; 2). */
  elevators?: number
  /** Where the shafts are, object-local `[x, z]` of each (default from the core layout). */
  shafts?: Array<[number, number]>
  /** Mass of a traction machine with its frame (default 2500 kg) and of what hangs from it: car, counterweight, rated load (default 1500 + 2000 + 1000 kg). */
  machineMass?: number
  suspendedMass?: number
  /** Water tank in litres (default: `occupants` per storey x 200 L a day x 40% stored up high, NBR 5626, plus a fire reserve of 6000 L, NBR 13714). */
  waterLiters?: number
  occupants?: number
  fireReserve?: number
  /** Chillers on the floor (default 2 of 3500 kg). */
  chillers?: number
  chillerMass?: number
  /** Material and wall thickness of the tank (default `plastic` 10 mm: a fibreglass or polyethylene reservoir). */
  tankMaterial?: string
  tankWall?: number
  /** Where the tank goes, `[x, z]` (default the middle of the bay at -x, away from the core). */
  tankAt?: [number, number]
  /**
   * Storey the equipment stands on (default the top one, under the roof). On any other storey the part ids end in `_<floor>` (`water_tank_20`,
   * `chiller_0_20`), so a tower can carry a mechanical floor every few storeys (design T10 §11).
   */
  floor?: number
}

export const MECHANICAL_DEFAULTS = { tankMaterial: 'plastic', tankWall: 0.01, machineMass: 2500, suspendedMass: 4500, occupants: 16, litersPerPerson: 200, storedFraction: 0.4, fireReserve: 6000, chillers: 2, chillerMass: 3500 } as const

/** Litres of the water tank of a building of `storeys` occupied storeys (NBR 5626 consumption, the fire reserve of NBR 13714). */
export const towerWater = (storeys: number, o: Pick<MechanicalFloorOptions, 'occupants' | 'fireReserve'> = {}): number =>
  Math.round((o.occupants ?? MECHANICAL_DEFAULTS.occupants) * MECHANICAL_DEFAULTS.litersPerPerson * MECHANICAL_DEFAULTS.storedFraction * storeys + (o.fireReserve ?? MECHANICAL_DEFAULTS.fireReserve))

/**
 * Makes the top storey the mechanical floor: the elevator machines over the shafts, the water tank (with its water: `contains`, a shot makes it leak)
 * and the chillers, on the slab under the roof (role partition: their weight goes into the structure). Part ids: `machine_<k>`, `water_tank`,
 * `chiller_<k>`.
 */
export function addMechanicalFloor(spec: DestructibleSpec, g: TowerGeometry, options: MechanicalFloorOptions = {}): DestructibleSpec {
  const c = { ...MECHANICAL_DEFAULTS, ...options }
  if (g.floors < 2) return spec
  const level = options.floor ?? g.floors - 1
  if (level < 1 || level > g.floors - 1) return spec
  const sfx = level === g.floors - 1 ? '' : `_${level}`
  const parts: PartSpec[] = [...spec.parts]
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  const floor = `slab_${level - 1}`
  const y = storeyBase(g, level)
  const shafts = options.shafts ?? []
  const put = (id: string, material: string, size: Vec3, at: [number, number], mass: number, extra: Partial<PartSpec> = {}) => {
    parts.push({ id: id + sfx, material, shape: box(size), position: [at[0], y + size[1] / 2, at[1]], mass, fill: 0.2, structure: { role: 'partition' }, tags: ['mechanical'], ...extra })
    rests(joints, id + sfx, floor, 'bolt')
  }
  shafts.forEach((at, k) => put(`machine_${k}`, 'steel', [1.2, 1.0, 0.8], at, c.machineMass + c.suspendedMass, { tags: ['mechanical', 'elevator_machine'] }))
  const liters = options.waterLiters ?? towerWater(level, options)
  const depth = 2
  const side = Math.sqrt(liters / 1000 / depth)
  const [hx] = slabHalf(g)
  const tankAt = options.tankAt ?? [-hx / 2, 0]
  const shell = 4 * side * depth + 2 * side * side
  put('water_tank', c.tankMaterial, [side, depth, side], tankAt, liters + 1100 * c.tankWall * shell, {
    fill: (shell * c.tankWall) / (side * side * depth), thickness: c.tankWall, contains: { fluid: 'water', liters }, tags: ['mechanical', 'water_tank'],
  })
  for (let k = 0; k < c.chillers; k++) put(`chiller_${k}`, 'steel', [3, 2, 1.5], [-hx + 2 + k * 3.5, -(slabHalf(g)[1] - 2)], c.chillerMass, { tags: ['mechanical', 'chiller'] })
  return { ...spec, parts, joints }
}

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Tuned mass damper
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface DamperOptions {
  /** Mass of the damper in kg (default: `ratio` of the modal mass of the building, estimated as `modalShare` of its mass). */
  mass?: number
  /** Mass ratio, damper over the modal mass of the building (default 0.01: 0.5 to 2% is the usual range). */
  ratio?: number
  /** Share of the building's mass that is its modal mass in the first mode, tip at 1 (default 0.25, a uniform cantilever). */
  modalShare?: number
  /** Frequency in Hz and damping ratio of the damper (default: tuned by the world to the building, `wind.tuning`). */
  frequency?: number
  damping?: number
  /** Where it stands on the mechanical floor, object-local `[x, z]` (default on the beam end beside the column nearest to 35% of the depth at +z, clear of the machines: its weight goes straight to the beam and the column). */
  at?: [number, number]
  /** Material of the mass (default `steel`; the real ones are steel or lead-filled blocks and concrete). */
  material?: string
  /** Tallest the block may be, metres (default 2.5: it stands inside the mechanical floor). */
  maxHeight?: number
}

export const DAMPER_DEFAULTS = { ratio: 0.01, modalShare: 0.25, material: 'steel', maxHeight: 2.5 } as const

/** Mass in kg of a damper for a structure: `ratio` of `modalShare` of the mass of everything above the foundations (curtain wall, roof and equipment included). */
export const damperMass = (spec: DestructibleSpec, o: Pick<DamperOptions, 'ratio' | 'modalShare'> = {}): number => {
  const byId = new Map(MATERIALS.map((m) => [m.id, m]))
  let total = 0
  for (const p of spec.parts) {
    const m = byId.get(p.material)
    if (!m || p.structure?.role === 'foundation' || p.damper) continue
    total += partMass(p, m)
  }
  return total * (o.modalShare ?? DAMPER_DEFAULTS.modalShare) * (o.ratio ?? DAMPER_DEFAULTS.ratio)
}

/**
 * Adds a tuned mass damper to the mechanical floor: a block of `material` on the slab under the roof (role partition: its mass loads the slab and
 * goes down to the core and the columns like the machines), with `PartSpec.damper` so the world tunes it to the building and moves it against the
 * sway (Den Hartog). Part id: `damper`.
 */
export function addTunedMassDamper(spec: DestructibleSpec, g: TowerGeometry, options: DamperOptions = {}): DestructibleSpec {
  const c = { ...DAMPER_DEFAULTS, ...options }
  if (g.floors < 2) return spec
  const mat = MATERIALS.find((m) => m.id === c.material)
  if (!mat) throw new Error(`unknown material "${c.material}" for the damper`)
  const mass = options.mass ?? damperMass(spec, c)
  const volume = mass / mat.density
  const height = Math.min(c.maxHeight, Math.cbrt(volume))
  const side = Math.sqrt(volume / height)
  const column = (span: number, n: number | undefined, want: number) => {
    const k = Math.max(2, n ?? 0) - 1
    return n === undefined ? want : Math.round((want + span / 2) / (span / k)) * (span / k) - span / 2
  }
  const colZ = column(g.spanZ, g.columnsZ, g.spanZ * 0.35)
  // on the beam end beside the column, so the slab hands its weight straight to the beam, which hands it to the column
  const at = options.at ?? [column(g.spanX, g.columnsX, 0), colZ - Math.sign(colZ || 1) * (g.columnSize / 2 + 0.1)]
  const y = storeyBase(g, g.floors - 1)
  const floor = `slab_${g.floors - 2}`
  const part: PartSpec = {
    id: 'damper', material: c.material, shape: box([side, height, side]), position: [at[0], y + height / 2, at[1]], mass, structure: { role: 'partition' }, tags: ['mechanical', 'tuned_mass_damper'],
    damper: { ...(c.frequency !== undefined ? { frequency: c.frequency } : {}), ...(c.damping !== undefined ? { damping: c.damping } : {}) },
  }
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  rests(joints, part.id, floor, 'bolt')
  return { ...spec, parts: [...spec.parts, part], joints }
}

// -------------------------------------------------------------------------------------------------------------------------------------------------
// Tower
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface TowerMechanicalOptions {
  /**
   * Another mechanical floor every this many storeys (design T10 §11): storeys `every`, `2 * every`... below the top one, each with its own
   * relay water tank for the storeys it serves and its chillers, and without glass. Default none: only the top storey.
   */
  every?: number
}

/** Indices of the intermediate mechanical storeys of a tower of `floors` storeys with one every `every` (none below `every / 2` storeys of the top one). */
export const mechanicalStoreys = (floors: number, every?: number): number[] => {
  if (!every || every < 2) return []
  const out: number[] = []
  for (let k = every; k < floors - 1; k += every) if (floors - 1 - k >= every / 2) out.push(k)
  return out
}

export interface TowerOptions extends Omit<FrameOptions, 'walls' | 'roof' | 'continuousColumns'> {
  /** The core (default on); `false` for a frame alone. */
  core?: CoreOptions | false
  /** The curtain wall (default on, without glass on the mechanical floor). */
  facade?: CurtainWallOptions | false
  /** A punched facade (infill walls with windows) instead of the curtain wall: turn the curtain wall off (`facade: false`) when you use it. Default off. */
  punched?: PunchedFacadeOptions | false
  /** The flat roof (default on). */
  flatRoof?: FlatRoofOptions | false
  /** The mechanical floor under the roof (default on). */
  mechanical?: (MechanicalFloorOptions & TowerMechanicalOptions) | false
  /** A tuned mass damper on the mechanical floor (default off: `{}` adds one of 1% of the modal mass). */
  damper?: DamperOptions | false
  /**
   * The wind the tower is made for (default none: the tower is sized for its weight only). Its `speed`, `terrain`, `class`... size the walls, columns
   * and core bars for the wind (`sizeStructure({ wind })`), and the fields of `WindExposure` (terrain, class, topography, statistical, drag, damping)
   * go into `DestructibleSpec.wind`, where the building stands. The world still needs its own `wind` for the wind to blow.
   */
  wind?: WindOptions | false
  /** Size the structure (`sizeStructure`, default `{}`); `false` keeps the material capacities. */
  sizing?: SizeStructureOptions | false
}

/** The fields of the wind options that describe the place and the shape of one building (`DestructibleSpec.wind`). */
export const windExposureOf = (w: WindOptions): WindExposure => {
  const out: WindExposure = {}
  if (w.terrain !== undefined) out.terrain = w.terrain
  if (w.class !== undefined) out.class = w.class
  if (w.topography !== undefined) out.topography = w.topography
  if (w.statistical !== undefined) out.statistical = w.statistical
  if (w.drag !== undefined) out.drag = w.drag
  if (w.damping !== undefined) out.damping = w.damping
  return out
}

/** Defaults of the frame of a tower: 16 x 24 m on a 8 m grid, 12 storeys of 3 m, 60 cm columns caged with 20 mm bars, 60 cm beams, continuous columns. */
export const TOWER_DEFAULTS = {
  spanX: 16, spanZ: 24, columnsX: 3, columnsZ: 4, floors: 12, height: 3, columnSize: 0.6, beamHeight: 0.6, slabThickness: 0.2,
  columnCage: { material: 'steel', spacing: 0.15, diameter: 0.02 },
} as const

/**
 * A multi-storey building with real structure: a frame with continuous columns, the concrete core in the bay at +x of the centre, the curtain wall,
 * the flat roof and the mechanical floor, sized as a designer would. Every system can be turned off or configured.
 */
export function buildTower(options: TowerOptions = {}): DestructibleSpec {
  const { core, facade, punched, flatRoof, mechanical, damper, wind, sizing, ...frame } = options
  const f = { ...TOWER_DEFAULTS, ...frame, columnCage: { ...TOWER_DEFAULTS.columnCage, ...frame.columnCage } }
  const g: TowerGeometry = { floors: f.floors, height: f.height, slab: f.slabThickness, spanX: f.spanX, spanZ: f.spanZ, columnSize: f.columnSize, columnsX: f.columnsX, columnsZ: f.columnsZ, beamHeight: f.beamHeight, roof: true }
  const { every, ...mech } = mechanical || {}
  const relays = mechanical === false ? [] : mechanicalStoreys(f.floors, every)
  const noGlass = (fl: number) => mechanical !== false && (fl === g.floors - 1 || relays.includes(fl))
  let spec = buildFrame({ roofThickness: f.slabThickness, ...f, roof: true, continuousColumns: true })
  spec = { ...spec, name: 'tower', tags: ['structure', 'tower'] }
  let shafts: Array<[number, number]> = []
  if (core !== false) {
    const bayX = f.spanX / (Math.max(2, f.columnsX) - 1)
    const center = core?.center ?? [bayX / 2, 0]
    spec = addCore(spec, g, { ...core, center })
    const c = { ...CORE_DEFAULTS, ...core }
    const [W, L] = coreSize(core || {})
    const sx = center[0] - W / 2 + c.wallThickness + c.stairWidth + c.innerThickness + c.shaftDepth / 2
    shafts = Array.from({ length: c.elevators }, (_, k) => [sx, center[1] - L / 2 + c.wallThickness + k * (c.shaft + c.innerThickness) + c.shaft / 2] as [number, number])
  }
  if (facade !== false && !punched) spec = addCurtainWall(spec, g, { skip: noGlass, ...facade })
  if (punched) spec = addPunchedFacade(spec, g, { skip: noGlass, ...punched })
  if (flatRoof !== false) spec = addFlatRoof(spec, g, flatRoof || {})
  if (mechanical !== false) {
    spec = addMechanicalFloor(spec, g, { shafts, ...mech })
    // the intermediate floors hold the plant of the zone below them: no elevator machines (they are on the top floor), a relay tank and the chillers
    for (const floor of relays) spec = addMechanicalFloor(spec, g, { ...mech, shafts: [], floor, waterLiters: mech.waterLiters ?? towerWater(every ?? floor, mech) })
  }
  if (damper) spec = addTunedMassDamper(spec, g, damper)
  if (wind) {
    const exposure = windExposureOf(wind)
    if (Object.keys(exposure).length) spec = { ...spec, wind: exposure }
  }
  if (sizing === false) return spec
  return sizeStructure(spec, wind && sizing?.wind === undefined ? { ...sizing, wind } : sizing ?? {})
}
