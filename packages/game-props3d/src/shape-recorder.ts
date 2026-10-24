import type { GroupNode, ShapeNode, ShapeSchema, Vec3 } from '@adatechnology/game-shapes'

import type { CylinderShape, PropItem, PropsApi, Uv } from './types'

export interface ShapeRecorderOptions {
  /** Radial segments of `cyl` and `cone` (default 12). */
  readonly cylinderSegments?: number
  /** Radial segments of `cyl6` (default 6). */
  readonly hexSegments?: number
  /** Width and height segments of `sphere` (default 12 x 8). */
  readonly sphereSegments?: readonly [number, number]
  /** Name of the schema. */
  readonly name?: string
}

/** A part as the api received it: the first call's pivot and turn (later calls with the same id draw into it). */
export interface RecordedPart {
  readonly id: string
  readonly pivot: Vec3
  readonly ry: number
}

/** The props api plus parts (the `HouseholdApi` contract): a part draws in its own frame, at `pivot`, turned by `ry`. */
export interface ShapeRecorderApi extends PropsApi {
  light(M: PropItem, x: number, y: number, z: number, color: number, range: number, kind: string): void
  part(id: string, pivot: Vec3, ry: number, draw: () => void): void
}

export interface ShapeRecorder {
  readonly api: ShapeRecorderApi
  /** The game-shapes schema of everything drawn so far. */
  schema(): ShapeSchema
  /** The parts in the order of their first call. */
  readonly parts: readonly RecordedPart[]
}

/** The double-sided diamond of `leaf`: base at the origin, tip at +y, in the xy plane (front face counter-clockwise seen from +z). */
const LEAF = (() => {
  const f = [0, 0, 0, -0.5, 0.4, 0, 0.5, 0.4, 0, 0, 1, 0]
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (const side of [1, -1]) {
    const base = positions.length / 3
    for (let i = 0; i < 4; i++) {
      positions.push(f[i * 3] as number, f[i * 3 + 1] as number, f[i * 3 + 2] as number)
      normals.push(0, 0, side)
      uvs.push((f[i * 3] as number) + 0.5, f[i * 3 + 1] as number)
    }
    if (side === 1) indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    else indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }
  return { positions, normals, uvs, indices }
})()

/**
 * An api that turns what a builder draws into a `game-shapes` schema, with the arithmetic of the interactables mesh api: each primitive
 * under its item frame (`heading` = `M.ry`, at `M.x, 0, M.z`), placed by `compose(position, euler YXZ, scale)` over a unit template (a box
 * with its base at `y`, a cylinder centred as the api says, a sphere of radius `h / 2`, the double-sided leaf, a unit plane with the atlas
 * cell as its uv), parts as part nodes, lights as points (`data: { light: true, color, range, kind }`).
 *
 * ```ts
 * const recorder = createShapeRecorder()
 * props.builders.sofa_l(item, recorder.api)
 * const buffers = generate(recorder.schema(), { validate: false, key: false })
 * ```
 */
export function createShapeRecorder(options: ShapeRecorderOptions = {}): ShapeRecorder {
  const cyl = options.cylinderSegments ?? 12
  const hex = options.hexSegments ?? 6
  const [sphereW, sphereH] = options.sphereSegments ?? [12, 8]
  const root: ShapeNode[] = []
  const parts: RecordedPart[] = []
  const partChildren = new Map<string, ShapeNode[]>()
  let current = root
  // consecutive primitives of the same item frame share one frame group (one matrix, the same products)
  let lastFrame: { list: ShapeNode[]; group: GroupNode & { children: ShapeNode[] }; x: number; z: number; ry: number } | null = null

  const into = (M: PropItem | undefined): ShapeNode[] => {
    const x = M?.x ?? 0
    const z = M?.z ?? 0
    const ry = M?.ry ?? 0
    const last = lastFrame
    if (last && last.list === current && current[current.length - 1] === last.group && Object.is(last.x, x) && Object.is(last.z, z) && Object.is(last.ry, ry)) return last.group.children
    const group = { kind: 'group' as const, position: [x, 0, z] as Vec3, heading: ry, children: [] as ShapeNode[] }
    current.push(group)
    lastFrame = { list: current, group, x, z, ry }
    return group.children
  }

  const api: ShapeRecorderApi = {
    box(M, material, x, y, z, w, h, d, color, ry, rx, rz) {
      into(M).push({ kind: 'box', material, color, position: [x, y + h / 2, z], rotation: [rx, ry, rz], rotationOrder: 'YXZ', scale: [w, h, d] })
    },
    cylinder(M, material, x, y, z, r, h, color, rx, rz, shape?: CylinderShape) {
      const tilted = rx !== 0 || rz !== 0
      const cy = shape === 'sphere' ? y + h / 2 : tilted ? y : y + h / 2
      const sy = shape === 'sphere' ? h / 2 : h
      const place = { material, color, position: [x, cy, z] as Vec3, rotation: [rx, 0, rz] as Vec3, rotationOrder: 'YXZ' as const, scale: [r, sy, r] as Vec3 }
      const list = into(M)
      switch (shape) {
        case 'cyl6':
          list.push({ kind: 'cylinder', radiusTop: 1, radiusBottom: 1, height: 1, radialSegments: hex, ...place })
          break
        case 'cone':
          list.push({ kind: 'cylinder', radiusTop: 0, radiusBottom: 1, height: 1, radialSegments: cyl, ...place })
          break
        case 'sphere':
          list.push({ kind: 'sphere', radius: 1, widthSegments: sphereW, heightSegments: sphereH, ...place })
          break
        default:
          list.push({ kind: 'cylinder', radiusTop: 1, radiusBottom: 1, height: 1, radialSegments: cyl, ...place })
      }
    },
    leaf(M, x, y, z, w, h, color, ry, rx) {
      into(M).push({ kind: 'mesh', ...LEAF, material: 'plant', color, position: [x, y, z], rotation: [rx, ry, 0], rotationOrder: 'YXZ', scale: [w, h, 1] })
    },
    plane(M, material, x, y, z, w, h, color, ry, rx, rz, uv?: Uv) {
      into(M).push({
        kind: 'plane',
        width: 1,
        height: 1,
        material,
        color,
        position: [x, y, z],
        rotation: [rx, ry, rz],
        rotationOrder: 'YXZ',
        scale: [w, h, 1],
        ...(uv ? { uv: { u0: uv.u0, v0: uv.v0, u1: uv.u1, v1: uv.v1 } } : {}),
      })
    },
    light(M, x, y, z, color, range, kind) {
      into(M).push({ kind: 'point', position: [x, y, z], data: { light: true, color, range, kind } })
    },
    part(id, pivot, ry, draw) {
      let children = partChildren.get(id)
      if (!children) {
        children = []
        partChildren.set(id, children)
        parts.push({ id, pivot: [pivot[0], pivot[1], pivot[2]], ry })
        current.push({ kind: 'group', part: id, position: [pivot[0], pivot[1], pivot[2]], rotation: [0, ry, 0], children })
      }
      const outer = current
      current = children
      try {
        draw()
      } finally {
        current = outer
      }
    },
  }

  return {
    api,
    parts,
    schema: () => ({ version: 1, ...(options.name !== undefined ? { name: options.name } : {}), root: { kind: 'group', children: root } }),
  }
}
