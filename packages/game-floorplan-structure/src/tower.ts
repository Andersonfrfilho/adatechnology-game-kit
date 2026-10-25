import type { DestructibleSpec, JointSpec, PartSpec, Vec3 } from '@adatechnology/game-contracts'
import { buildFrame, sizeStructure } from '@adatechnology/game-destruction'
import type { FrameOptions, SizeStructureOptions } from '@adatechnology/game-destruction'

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
  const parts: PartSpec[] = [...spec.parts]
  const joints: JointSpec[] = [...(spec.joints ?? [])]
  const floor = `slab_${g.floors - 2}`
  const y = storeyBase(g, g.floors - 1)
  const shafts = options.shafts ?? []
  const put = (id: string, material: string, size: Vec3, at: [number, number], mass: number, extra: Partial<PartSpec> = {}) => {
    parts.push({ id, material, shape: box(size), position: [at[0], y + size[1] / 2, at[1]], mass, fill: 0.2, structure: { role: 'partition' }, tags: ['mechanical'], ...extra })
    rests(joints, id, floor, 'bolt')
  }
  shafts.forEach((at, k) => put(`machine_${k}`, 'steel', [1.2, 1.0, 0.8], at, c.machineMass + c.suspendedMass, { tags: ['mechanical', 'elevator_machine'] }))
  const liters = options.waterLiters ?? towerWater(g.floors - 1, options)
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
// Tower
// -------------------------------------------------------------------------------------------------------------------------------------------------

export interface TowerOptions extends Omit<FrameOptions, 'walls' | 'roof' | 'continuousColumns'> {
  /** The core (default on); `false` for a frame alone. */
  core?: CoreOptions | false
  /** The curtain wall (default on, without glass on the mechanical floor). */
  facade?: CurtainWallOptions | false
  /** The flat roof (default on). */
  flatRoof?: FlatRoofOptions | false
  /** The mechanical floor under the roof (default on). */
  mechanical?: MechanicalFloorOptions | false
  /** Size the structure (`sizeStructure`, default `{}`); `false` keeps the material capacities. */
  sizing?: SizeStructureOptions | false
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
  const { core, facade, flatRoof, mechanical, sizing, ...frame } = options
  const f = { ...TOWER_DEFAULTS, ...frame, columnCage: { ...TOWER_DEFAULTS.columnCage, ...frame.columnCage } }
  const g: TowerGeometry = { floors: f.floors, height: f.height, slab: f.slabThickness, spanX: f.spanX, spanZ: f.spanZ, columnSize: f.columnSize, roof: true }
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
  if (facade !== false) spec = addCurtainWall(spec, g, { skip: mechanical === false ? undefined : (fl) => fl === g.floors - 1, ...facade })
  if (flatRoof !== false) spec = addFlatRoof(spec, g, flatRoof || {})
  if (mechanical !== false) spec = addMechanicalFloor(spec, g, { shafts, ...mechanical })
  return sizing === false ? spec : sizeStructure(spec, sizing ?? {})
}
