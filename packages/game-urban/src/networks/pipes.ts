import { isAerialEdgeKind } from './classes'
import type { SurfaceMaterial } from './surface'
import type { BuriedEdgeKind, UtilityNetworks } from './types'

/** What a pipe carries: a fluid that leaks when it breaks, or the cables of a duct (power, telecom), which are cut. */
export type PipeContent = FluidContent | 'power' | 'telecom'
/** What leaks from a pipe that breaks. */
export type FluidContent = 'sewage' | 'stormwater' | 'water'

export function isFluidContent(content: PipeContent): content is FluidContent {
  return content === 'sewage' || content === 'stormwater' || content === 'water'
}

/** A buried pipe as a body in the ground: its centre line from end to end, laid at the depths the network was laid with. */
export type PipePiece = {
  /** The id of the edge. */
  readonly id: string
  readonly kind: BuriedEdgeKind
  readonly content: PipeContent
  /** The centre line's ends (world metres, `y` the centre of the bore). */
  readonly from: readonly [number, number, number]
  readonly to: readonly [number, number, number]
  /** Outer diameter, metres; a duct bank's height. */
  readonly diameter: number
  /** A concrete duct bank is a box this wide across its line (its height `diameter`); a pipe is round. */
  readonly width?: number
  readonly material: SurfaceMaterial
  /** Ground level above each end. */
  readonly ground: readonly [number, number]
}

const CONTENT: Readonly<Partial<Record<BuriedEdgeKind, PipeContent>>> = {
  sewer_main: 'sewage',
  sewer_lateral: 'sewage',
  storm_gallery: 'stormwater',
  storm_lateral: 'stormwater',
  water_main: 'water',
  water_service: 'water',
  mv_duct: 'power',
  lv_duct: 'power',
  service_lateral: 'power',
  light_cable: 'power',
  telecom_duct: 'telecom',
  telecom_lateral: 'telecom',
}

const MATERIAL_OF: Readonly<Record<PipeContent, SurfaceMaterial>> = { sewage: 'plastic', water: 'plastic', stormwater: 'concrete', power: 'plastic', telecom: 'plastic' }

/** Metres a pipe's wall is thicker than its bore, per metre of bore (a DN 600 gallery has rings of 0.07 m). */
const WALL_SHARE = 0.12
const HYDRANT_BRANCH_SHARE = 0.8

/**
 * Every pipe of the sewer, the drainage and the water as a piece laid in the ground: from the inverts of its ends (its own, or its nodes'),
 * with the diameter the network gave plus its wall, and the ducts of underground power and telecom (a bank as its concrete box). The gutters are open channels at the kerb and have no pipe.
 */
export function pipePiecesOf(networks: Pick<UtilityNetworks, 'nodes' | 'edges'>): PipePiece[] {
  const nodes = new Map(networks.nodes.map((node) => [node.id, node]))
  return networks.edges.flatMap((edge): PipePiece[] => {
    const content = isAerialEdgeKind(edge.kind) ? undefined : CONTENT[edge.kind as BuriedEdgeKind]
    const [from, to] = [nodes.get(edge.from), nodes.get(edge.to)]
    if (content === undefined || from === undefined || to === undefined || edge.diameter === undefined) return []
    const inverts = edge.inverts ?? (from.invert !== undefined && to.invert !== undefined ? ([from.invert, to.invert] as const) : undefined)
    if (inverts === undefined) return []
    // the hydrant's branch runs on along the main's own line: a little slimmer, so the two never share a surface
    // a duct bank is its concrete envelope, drawn as laid; a pipe has its wall over the bore
    const bank = edge.width !== undefined
    const diameter = bank ? edge.diameter : edge.diameter * (1 + WALL_SHARE) * (to.kind === 'hydrant' ? HYDRANT_BRANCH_SHARE : 1)
    const centre = (invert: number): number => invert + edge.diameter! / 2
    const material: SurfaceMaterial = bank ? 'concrete' : MATERIAL_OF[content]
    return [{ id: edge.id, kind: edge.kind as BuriedEdgeKind, content, from: [from.at[0], centre(inverts[0]), from.at[2]], to: [to.at[0], centre(inverts[1]), to.at[2]], diameter, ...(bank ? { width: edge.width } : {}), material, ground: [from.at[1], to.at[1]] }]
  })
}

/** Metres of ground over the top of a pipe at a share `t` of its length. */
export function coverOf(pipe: PipePiece, t: number): number {
  const ground = pipe.ground[0] + (pipe.ground[1] - pipe.ground[0]) * t
  const centre = pipe.from[1] + (pipe.to[1] - pipe.from[1]) * t
  return ground - (centre + pipe.diameter / 2)
}
