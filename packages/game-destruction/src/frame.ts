import type { DestructibleSpec, JointSpec, MaterialId, PartSpec, PileSpec, Reinforcement, SoilProfile } from './types'

export interface FrameOptions {
  /** Total length along x between the outer column centres, metres (default 8). */
  spanX?: number
  /** Total length along z (default 8). */
  spanZ?: number
  /** Columns along x (at least 2, default 3). */
  columnsX?: number
  /** Columns along z (at least 2, default 3). */
  columnsZ?: number
  /** Height of one floor from slab top to the underside of the next slab, metres (default 3). */
  height?: number
  /** Number of floors (default 1). */
  floors?: number
  /** Brick walls on every perimeter bay of every floor; the first bay of the ground floor on the -z side gets a door opening (default false). */
  walls?: boolean
  /** A thin roof slab resting on the top beams (default true); without it the top floor is open. */
  roof?: boolean
  columnSize?: number
  beamHeight?: number
  slabThickness?: number
  wallThickness?: number
  doorWidth?: number
  doorHeight?: number
  /** Material of foundations, columns, beams, slabs and roof (default `concrete`). */
  material?: MaterialId
  wallMaterial?: MaterialId
  /** Override the load capacity of every column, kg (see `PartState.load`). */
  columnCapacity?: number
  /**
   * Tension steel ratio of the beams and slabs (`structure.rebar.ratio`; default beams 1%, slabs and roof 0.5%, inside the ranges of NBR 6118);
   * `false` makes them plain concrete (they snap when they bend past cracking).
   */
  rebar?: { beam?: number; slab?: number } | false
  /** Side of the square pad under each column in metres (default 2.2 x `columnSize`), 0.3 m thick. */
  footing?: number
  /** One raft under the whole frame instead of a pad per column (`raft`, the footprint plus `footing` / 2 each side, 0.4 m thick). */
  raft?: boolean
  /** Piles under each pad (or under the raft): the pad becomes a pile cap. */
  piles?: PileSpec
  /**
   * Columns run from storey to storey: each one rests on the column below (through the slab, as a cast-in-place column does) instead of on the slab,
   * so the slab carries only its own floor. Default false (the column of each storey stands on the slab below, as before).
   */
  continuousColumns?: boolean
  /** Rebar cage of the columns (`PartSpec.reinforcement`; default none). A caged column carries `0.85 fck Ac + As fy` and its `rebar` joints are monolithic. */
  columnCage?: Reinforcement
  /** Thickness of the roof slab (default 0.75 x `slabThickness`; a flat roof that carries a screed and equipment is as thick as a floor). */
  roofThickness?: number
  /** The ground the frame stands on (`DestructibleSpec.soil`). */
  soil?: string | SoilProfile
}

/**
 * A parametric test structure: a grid of columns on foundations, beams between the column tops, one slab per floor (the last one a roof), and
 * optional brick walls with a door. Joints are explicit and directional: columns rest on foundations (or on the slab below) with `rebar`, beams on
 * columns, slabs on beams, the roof rests on the top beams, walls hang on their columns with `mortar`. Part ids: `foundation_i_j`, `column_f_i_j`,
 * `beam_x_f_i_j`, `beam_z_f_i_j`, `slab_f`, `roof`, `wall_*`, `door`. Ground is y = 0 (the top of the foundations).
 */
export const buildFrame = (o: FrameOptions = {}): DestructibleSpec => {
  const spanX = o.spanX ?? 8, spanZ = o.spanZ ?? 8
  const nx = Math.max(2, o.columnsX ?? 3), nz = Math.max(2, o.columnsZ ?? 3)
  const H = o.height ?? 3, floors = Math.max(1, o.floors ?? 1)
  const cs = o.columnSize ?? 0.3, bh = o.beamHeight ?? 0.3, bw = 0.2, T = o.slabThickness ?? 0.2, wt = o.wallThickness ?? 0.2
  const dw = o.doorWidth ?? 1, dh = o.doorHeight ?? 2.1
  const mat = o.material ?? 'concrete', wmat = o.wallMaterial ?? 'brick'
  const roof = o.roof ?? true
  const rebarOf = (kind: 'beam' | 'slab') => (o.rebar === false ? {} : { rebar: { ratio: o.rebar?.[kind] ?? (kind === 'beam' ? 0.01 : 0.005) } })
  const xs = Array.from({ length: nx }, (_, i) => -spanX / 2 + (i * spanX) / (nx - 1))
  const zs = Array.from({ length: nz }, (_, j) => -spanZ / 2 + (j * spanZ) / (nz - 1))
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  const on = (a: string, b: string, kind: JointSpec['kind']) => joints.push({ id: `${a}~${b}`, a, b, kind, bears: 'a_on_b' })

  const pad = o.footing ?? cs * 2.2
  const pile = o.piles ? { pile: { ...o.piles } } : {}
  if (o.raft) {
    parts.push({
      id: 'raft', material: mat, shape: { kind: 'box', size: [spanX + pad, 0.4, spanZ + pad] }, position: [0, -0.2, 0],
      structure: { role: 'foundation', ...pile }, anchored: true,
    })
  } else {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        parts.push({
          id: `foundation_${i}_${j}`, material: mat, shape: { kind: 'box', size: [pad, 0.3, pad] }, position: [xs[i], -0.15, zs[j]],
          structure: { role: 'foundation', ...pile }, anchored: true,
        })
      }
    }
  }
  for (let f = 0; f < floors; f++) {
    const yb = f * (H + T)
    const top = yb + H
    const last = f === floors - 1
    const slabId = last && roof ? 'roof' : `slab_${f}`
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const id = `column_${f}_${i}_${j}`
        parts.push({
          id, material: mat, shape: { kind: 'box', size: [cs, H, cs] }, position: [xs[i], yb + H / 2, zs[j]],
          structure: o.columnCapacity === undefined ? { role: 'column' } : { role: 'column', capacity: o.columnCapacity },
          ...(o.columnCage ? { reinforcement: { ...o.columnCage } } : {}),
        })
        on(id, f === 0 ? (o.raft ? 'raft' : `foundation_${i}_${j}`) : o.continuousColumns ? `column_${f - 1}_${i}_${j}` : `slab_${f - 1}`, 'rebar')
      }
    }
    const beams: string[] = []
    const beam = (id: string, size: [number, number, number], pos: [number, number, number], c1: string, c2: string) => {
      parts.push({ id, material: mat, shape: { kind: 'box', size }, position: pos, structure: { role: 'beam', ...rebarOf('beam') } })
      on(id, c1, 'rebar')
      on(id, c2, 'rebar')
      beams.push(id)
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx - 1; i++) {
        beam(`beam_x_${f}_${i}_${j}`, [xs[i + 1] - xs[i] - cs, bh, bw], [(xs[i] + xs[i + 1]) / 2, top - bh / 2, zs[j]], `column_${f}_${i}_${j}`, `column_${f}_${i + 1}_${j}`)
      }
    }
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz - 1; j++) {
        beam(`beam_z_${f}_${i}_${j}`, [bw, bh, zs[j + 1] - zs[j] - cs], [xs[i], top - bh / 2, (zs[j] + zs[j + 1]) / 2], `column_${f}_${i}_${j}`, `column_${f}_${i}_${j + 1}`)
      }
    }
    const thick = last && roof ? o.roofThickness ?? T * 0.75 : T
    parts.push({
      id: slabId, material: mat, shape: { kind: 'box', size: [spanX + cs + 0.2, thick, spanZ + cs + 0.2] }, position: [0, top + thick / 2, 0],
      structure: { role: last && roof ? 'roof' : 'slab', ...rebarOf('slab') },
    })
    for (const b of beams) on(slabId, b, last && roof ? 'resting' : 'rebar')

    if (o.walls) {
      const wh = H - bh
      const wy = yb + wh / 2
      const wall = (id: string, size: [number, number, number], pos: [number, number, number], supports: string[]) => {
        parts.push({ id, material: wmat, shape: { kind: 'box', size }, position: pos, structure: { role: 'wall' } })
        for (const s of supports) on(id, s, 'mortar')
      }
      for (const j of [0, nz - 1]) {
        for (let i = 0; i < nx - 1; i++) {
          const c1 = `column_${f}_${i}_${j}`, c2 = `column_${f}_${i + 1}_${j}`
          const avail = xs[i + 1] - xs[i] - cs
          if (f === 0 && j === 0 && i === 0 && avail > dw + 0.4) {
            const side = (avail - dw) / 2
            const lx = xs[i] + cs / 2 + side / 2, rx = xs[i + 1] - cs / 2 - side / 2
            wall(`wall_door_left`, [side, wh, wt], [lx, wy, zs[j]], [c1])
            wall(`wall_door_right`, [side, wh, wt], [rx, wy, zs[j]], [c2])
            const lh = wh - dh
            wall(`wall_door_lintel`, [dw, lh, wt], [xs[i] + cs / 2 + side + dw / 2, yb + dh + lh / 2, zs[j]], ['wall_door_left', 'wall_door_right'])
            parts.push({ id: 'door', material: 'wood_hard', shape: { kind: 'box', size: [dw - 0.04, dh, 0.05] }, position: [xs[i] + cs / 2 + side + dw / 2, yb + dh / 2, zs[j]], tags: ['door'] })
            joints.push({ id: 'door~wall_door_left', a: 'door', b: 'wall_door_left', kind: 'hinge', bears: false })
          } else wall(`wall_x_${f}_${i}_${j}`, [avail, wh, wt], [(xs[i] + xs[i + 1]) / 2, wy, zs[j]], [c1, c2])
        }
      }
      for (const i of [0, nx - 1]) {
        for (let j = 0; j < nz - 1; j++) {
          wall(`wall_z_${f}_${i}_${j}`, [wt, wh, zs[j + 1] - zs[j] - cs], [xs[i], wy, (zs[j] + zs[j + 1]) / 2], [`column_${f}_${i}_${j}`, `column_${f}_${i}_${j + 1}`])
        }
      }
    }
  }
  return { name: 'frame', parts, joints, tags: ['structure'], ...(o.soil !== undefined ? { soil: o.soil } : {}) }
}
