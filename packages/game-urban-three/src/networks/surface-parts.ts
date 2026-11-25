import type { SurfacePiece } from '@adatechnology/game-urban/networks'

/** A solid of a surface piece in the piece's frame (x along the street, z across, y up from the ground): a box, or a cylinder of its axis. */
export type SurfacePart = {
  readonly shape: 'box' | 'cylinder'
  readonly centre: readonly [number, number, number]
  /** Box: its sides. Cylinder: radius, length, radius. */
  readonly size: readonly [number, number, number]
  /** Cylinder only: the axis it lies along. Default y. */
  readonly axis?: 'x' | 'y' | 'z'
  readonly color: number
}

const IRON = 0x3b3e42
const IRON_WORN = 0x55595e
const CONCRETE = 0x9b9a94
const CONCRETE_LID = 0xa8a7a0
const VOID = 0x0b0b0c
const HYDRANT_RED = 0xb02a22
const CABINET_GREEN = 0x4d6a45
const CABINET_SEAM = 0x2f3f2b
const WARNING_YELLOW = 0xd8b21e

/** Flat covers lie at the ground: the frame 2 mm over it, the lid 2 mm over the frame, the ribs another 2 mm and 4 mm (CLAUDE.md §13: nothing in the plane of another). */
const FRAME_TOP = 0.002
const LID_TOP = 0.004
const RIB_TOP = 0.009
const CROSS_RIB_TOP = 0.011
const THICK = 0.03

const flat = (shape: 'box' | 'cylinder', top: number, size: readonly [number, number], color: number): SurfacePart =>
  shape === 'box' ? { shape, centre: [0, top - THICK / 2, 0], size: [size[0], THICK, size[1]], color } : { shape, centre: [0, top - THICK / 2, 0], size: [size[0], THICK, size[0]], color }

const rib = (size: readonly [number, number, number], top: number, at: readonly [number, number]): SurfacePart => ({ shape: 'box', centre: [at[0], top - size[1] / 2, at[1]], size, color: IRON_WORN })

function cover(piece: SurfacePiece): SurfacePart[] {
  const [width, , depth] = piece.size
  const shape = piece.shape === 'round' ? 'cylinder' : 'box'
  const [frame, lid] = piece.shape === 'round' ? [(width + 0.12) / 2, width / 2] : [width + 0.12, width]
  const colors = piece.material === 'concrete' ? [IRON, CONCRETE_LID] : [IRON, IRON_WORN]
  const parts = [flat(shape, FRAME_TOP, [frame, piece.shape === 'round' ? frame : depth + 0.12], colors[0] as number), flat(shape, LID_TOP, [lid, piece.shape === 'round' ? lid : depth], colors[1] as number)]
  if (piece.kind === 'inspection_cover') return [...parts, rib([0.14, 0.006, 0.03], RIB_TOP, [0, 0])]
  if (piece.shape === 'round') return [...parts, rib([lid * 1.7, 0.005, 0.04], RIB_TOP, [0, 0]), rib([0.04, 0.005, lid * 1.7], CROSS_RIB_TOP, [0, 0])]
  return [...parts, ...[-0.15, 0, 0.15].map((z) => rib([lid * 0.85, 0.005, 0.03], RIB_TOP, [0, z]))]
}

/** A grate at the kerb: the iron frame, the open slot dark under it, five bars along the kerb and a brace across them. */
function grate(): SurfacePart[] {
  const bars = [-0.2, -0.1, 0, 0.1, 0.2].map((z): SurfacePart => ({ shape: 'box', centre: [0, RIB_TOP - 0.006, z], size: [0.9, 0.012, 0.025], color: IRON_WORN }))
  const brace: SurfacePart = { shape: 'box', centre: [0, 0.0065, 0], size: [0.03, 0.003, 0.5], color: IRON }
  return [
    { shape: 'box', centre: [0, FRAME_TOP - THICK / 2, 0], size: [1, THICK, 0.6], color: IRON },
    { shape: 'box', centre: [0, 0.0025, 0], size: [0.9, 0.001, 0.5], color: VOID },
    ...bars,
    brace,
  ]
}

/** A pillar hydrant: flange, barrel, bonnet, two side nozzles and the pumper's nozzle in front. */
function hydrant(): SurfacePart[] {
  const part = (y: number, radius: number, length: number, axis: 'x' | 'y' | 'z', at: readonly [number, number] = [0, 0]): SurfacePart => ({ shape: 'cylinder', centre: [at[0], y, at[1]], size: [radius, length, radius], axis, color: HYDRANT_RED })
  return [part(0.02, 0.1, 0.04, 'y'), part(0.38, 0.065, 0.68, 'y'), part(0.74, 0.085, 0.06, 'y'), part(0.55, 0.032, 0.26, 'x'), part(0.5, 0.045, 0.14, 'z', [0, 0.1])]
}

/** An outfall's wing wall: the headwall the gallery comes through, a wing on each side toward the river and the apron between. */
function wingWall(piece: SurfacePiece): SurfacePart[] {
  const [width, height, depth] = piece.size
  return [
    { shape: 'box', centre: [0, (height - 0.4) / 2, 0], size: [width, height + 0.4, 0.25], color: CONCRETE },
    ...[-1, 1].map((side): SurfacePart => ({ shape: 'box', centre: [side * (width / 2 - 0.135), (height - 0.2 - 0.4) / 2 + 0.01, depth / 2], size: [0.25, height - 0.2 + 0.4 - 0.02, depth], color: CONCRETE })),
    { shape: 'box', centre: [0, 0.01 - 0.075, depth / 2], size: [width - 0.6, 0.15, depth - 0.1], color: CONCRETE_LID },
  ]
}

/** The water meter's box beside the gate: the concrete box and its iron lid. */
function meterBox(piece: SurfacePiece): SurfacePart[] {
  const [width, height, depth] = piece.size
  return [
    { shape: 'box', centre: [0, height / 2, 0], size: [width, height, depth], color: CONCRETE },
    { shape: 'box', centre: [0, height, 0], size: [width - 0.06, 0.008, depth - 0.06], color: IRON },
  ]
}

/** The mouth of a downspout at the kerb: a concrete lip with its slot. */
function mouth(): SurfacePart[] {
  return [
    { shape: 'box', centre: [0, FRAME_TOP - 0.01, 0], size: [0.3, 0.02, 0.2], color: CONCRETE },
    { shape: 'box', centre: [0, 0.0025, 0], size: [0.2, 0.001, 0.08], color: VOID },
  ]
}

/**
 * A pad-mounted transformer (transformador em pedestal): the concrete plinth, the steel cabinet on it, the seam between its two doors and the
 * vents on its sides, the warning plate on its door; each detail stands 2 mm or more out of the face it sits on (CLAUDE.md §13).
 */
function padTransformer(piece: SurfacePiece): SurfacePart[] {
  const [width, height, depth] = piece.size
  const plinth = 0.15
  const body = height - plinth
  const front = depth / 2
  return [
    { shape: 'box', centre: [0, plinth / 2 - 0.05, 0], size: [width + 0.1, plinth + 0.1, depth + 0.1], color: CONCRETE },
    { shape: 'box', centre: [0, plinth + body / 2, 0], size: [width, body, depth], color: CABINET_GREEN },
    { shape: 'box', centre: [0, plinth + body + 0.02, 0], size: [width + 0.06, 0.04, depth + 0.06], color: CABINET_GREEN },
    { shape: 'box', centre: [0, plinth + body / 2, front + 0.004], size: [0.012, body - 0.12, 0.008], color: CABINET_SEAM },
    { shape: 'box', centre: [-width / 4, plinth + body * 0.62, front + 0.004], size: [0.2, 0.14, 0.008], color: WARNING_YELLOW },
    ...[-1, 1].map((end): SurfacePart => ({ shape: 'box', centre: [end * (width / 2 + 0.004), plinth + body * 0.7, 0], size: [0.008, 0.2, depth * 0.6], color: CABINET_SEAM })),
  ]
}

/** The lid of a box of the duct bank: the iron frame, the concrete lid and a lifting bar at each end. */
function powerBox(piece: SurfacePiece): SurfacePart[] {
  const [width, , depth] = piece.size
  return [
    flat('box', FRAME_TOP, [width + 0.12, depth + 0.12], IRON),
    flat('box', LID_TOP, [width, depth], CONCRETE_LID),
    ...[-1, 1].map((end) => rib([0.12, 0.006, 0.025], RIB_TOP, [0, end * (depth / 2 - 0.08)])),
  ]
}

/** The solids of a piece, by its kind. */
export function partsOf(piece: SurfacePiece): SurfacePart[] {
  switch (piece.kind) {
    case 'inlet_grate':
      return grate()
    case 'hydrant':
      return hydrant()
    case 'wing_wall':
      return wingWall(piece)
    case 'meter_box':
      return meterBox(piece)
    case 'downspout_mouth':
      return mouth()
    case 'pad_transformer':
      return padTransformer(piece)
    case 'power_box_cover':
      return powerBox(piece)
    default:
      return cover(piece)
  }
}
