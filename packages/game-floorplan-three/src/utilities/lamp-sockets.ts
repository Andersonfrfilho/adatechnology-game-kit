import type { LampType } from '@adatechnology/game-floorplan-structure'

export type Vec3 = readonly [number, number, number]

/** One solid of a socket or its lamp: an axis-aligned box, an upright cylinder from its base up, or a rod between two points. Metres. */
export type SocketPrimitive =
  | { readonly shape: 'box'; readonly min: Vec3; readonly max: Vec3; readonly color: number }
  | { readonly shape: 'cylinder'; readonly base: Vec3; readonly radius: number; readonly height: number; readonly color: number }
  | { readonly shape: 'rod'; readonly from: Vec3; readonly to: Vec3; readonly diameter: number; readonly color: number }

/** What a lighting point is made of: the fixed socket (from the rough-in) and the lamp that goes in it (once the walls are rendered). */
export interface SocketParts {
  readonly socket: readonly SocketPrimitive[]
  readonly lamp: readonly SocketPrimitive[]
}

/** Real sizes, metres. An E27 holder is about 40 mm across and 55 mm long; a T8 tube is 1.2 m (0.6 m the short one) between holders 40 mm long; a flush base is 100-300 mm across. */
export const SOCKET_SIZE = {
  e27: { radius: 0.02, height: 0.055, cord: 0.05, rosetteRadius: 0.04, rosetteHeight: 0.015, bulbRadius: 0.0315, bulbHeight: 0.105 },
  t8: { holderAlong: 0.04, holderAcross: 0.03, holderHeight: 0.02, battenWidth: 0.06, battenHeight: 0.025, battenOverhang: 0.03, tubeDiameter: 0.026, spans: [1.2, 0.6] },
  plafon: { radius: 0.125, height: 0.02, coverRadius: 0.115, coverHeight: 0.05 },
  sconce: { radius: 0.05, depth: 0.03, bulbRadius: 0.03, bulbDepth: 0.07 },
} as const

const WIRE_COLOR = 0x1c1c1e
const HOLDER_COLOR = 0xe8e4da
const GLOW_COLOR = 0xfff6e0

export interface CeilingSocketParams {
  readonly lamp: Exclude<LampType, 'sconce'>
  readonly x: number
  readonly z: number
  /** The plane the socket hangs from: the underside of the slab in the rough-in, the finished ceiling afterwards. */
  readonly mountY: number
  /** Whether the tube of a batten runs along u (else along v). */
  readonly alongU: boolean
  /** Distance between the two lampholders of a batten. */
  readonly span: number
}

const cylinder = (x: number, y: number, z: number, radius: number, height: number, color: number): SocketPrimitive => ({ shape: 'cylinder', base: [x, y, z], radius, height, color })

function bulbSocket({ x, z, mountY }: CeilingSocketParams): SocketParts {
  const size = SOCKET_SIZE.e27
  const holderTop = mountY - size.rosetteHeight - size.cord
  const holderBase = holderTop - size.height
  return {
    socket: [
      cylinder(x, mountY - size.rosetteHeight, z, size.rosetteRadius, size.rosetteHeight, HOLDER_COLOR),
      cylinder(x, holderTop, z, 0.003, size.cord, WIRE_COLOR),
      cylinder(x, holderBase, z, size.radius, size.height, HOLDER_COLOR),
    ],
    lamp: [cylinder(x, holderBase - size.bulbHeight, z, size.bulbRadius, size.bulbHeight, GLOW_COLOR)],
  }
}

function tubeSocket({ x, z, mountY, alongU, span }: CeilingSocketParams): SocketParts {
  const size = SOCKET_SIZE.t8
  const alongHalf = (span + size.holderAlong) / 2 + size.battenOverhang
  const across = size.battenWidth / 2
  const battenBase = mountY - size.battenHeight
  const around = (along: number, cross: number): readonly [number, number] => (alongU ? [x + along, z + cross] : [x + cross, z + along])
  const rectangle = (along0: number, along1: number, cross0: number, cross1: number, y0: number, y1: number, color: number): SocketPrimitive => {
    const [ax, az] = around(along0, cross0)
    const [bx, bz] = around(along1, cross1)
    return { shape: 'box', min: [Math.min(ax, bx), y0, Math.min(az, bz)], max: [Math.max(ax, bx), y1, Math.max(az, bz)], color }
  }
  const holderBase = battenBase - size.holderHeight
  const holders = [-1, 1].map((side) => rectangle(side * span / 2 - size.holderAlong / 2, side * span / 2 + size.holderAlong / 2, -size.holderAcross / 2, size.holderAcross / 2, holderBase, battenBase, HOLDER_COLOR))
  const [fromX, fromZ] = around(-span / 2, 0)
  const [toX, toZ] = around(span / 2, 0)
  const tubeY = holderBase + size.holderHeight / 2
  return {
    socket: [rectangle(-alongHalf, alongHalf, -across, across, battenBase, mountY, HOLDER_COLOR), ...holders],
    lamp: [{ shape: 'rod', from: [fromX, tubeY, fromZ], to: [toX, tubeY, toZ], diameter: size.tubeDiameter, color: GLOW_COLOR }],
  }
}

function flushSocket({ x, z, mountY }: CeilingSocketParams): SocketParts {
  const size = SOCKET_SIZE.plafon
  return {
    socket: [cylinder(x, mountY - size.height, z, size.radius, size.height, HOLDER_COLOR)],
    lamp: [cylinder(x, mountY - size.height - size.coverHeight, z, size.coverRadius, size.coverHeight, GLOW_COLOR)],
  }
}

/** The socket of a ceiling point and the lamp that goes in it, drawn from the plane it is fixed to. */
export function ceilingSocketParts(params: CeilingSocketParams): SocketParts {
  if (params.lamp === 'tube_t8') return tubeSocket(params)
  if (params.lamp === 'plafon') return flushSocket(params)
  return bulbSocket(params)
}

export interface WallSocketParams {
  readonly x: number
  readonly y: number
  readonly z: number
  /** The wall face the base is fixed to, and the way it points out of the wall (unit). */
  readonly frontU: number
  readonly frontV: number
}

/** A wall sconce (arandela): a round base on the wall with a lamp standing out of it. */
export function sconceSocketParts({ x, y, z, frontU, frontV }: WallSocketParams): SocketParts {
  const size = SOCKET_SIZE.sconce
  const point = (depth: number): Vec3 => [x + frontU * depth, y, z + frontV * depth]
  return {
    socket: [{ shape: 'rod', from: point(0), to: point(size.depth), diameter: size.radius * 2, color: HOLDER_COLOR }],
    lamp: [{ shape: 'rod', from: point(size.depth), to: point(size.depth + size.bulbDepth), diameter: size.bulbRadius * 2, color: GLOW_COLOR }],
  }
}

/** The room rectangle a point stands in, shrunk by the walls: where a batten can lie. */
export type Bounds = readonly [number, number, number, number]

/** The axis and span of a batten at a point: along the room's longer side, the 1.2 m tube when it fits between the walls, else the 0.6 m one. */
export function tubeLayoutOf(x: number, z: number, room: Bounds): { alongU: boolean; span: number } {
  const size = SOCKET_SIZE.t8
  const fits = (alongU: boolean, span: number): boolean => {
    const half = (span + size.holderAlong) / 2 + size.battenOverhang
    return alongU ? x - half >= room[0] && x + half <= room[2] : z - half >= room[1] && z + half <= room[3]
  }
  const longerU = room[2] - room[0] >= room[3] - room[1]
  const order = longerU ? [true, false] : [false, true]
  for (const span of size.spans) for (const alongU of order) if (fits(alongU, span)) return { alongU, span }
  return { alongU: longerU, span: size.spans[size.spans.length - 1] }
}
