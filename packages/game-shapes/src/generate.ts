import { colorChannels, colorHex } from './color'
import { hashValue } from './hash'
import { asMat4, identity4, isAffine, matrixOf, multiply, normalMatrix, transformPoint } from './math'
import type { Matrix4 } from './math'
import { buildPrimitive, primitiveParameters } from './primitives'
import { canonicalJson } from './hash'
import { streamFor } from './random'
import { getGenerator } from './registry'
import { assertValidShape } from './schema'
import type {
  Bounds,
  GenerateOptions,
  InstancedBatch,
  NamedRange,
  PrimitiveBuffers,
  PrimitiveNode,
  ShapeBatch,
  ShapeBuffers,
  ShapeLevel,
  ShapeNode,
  ShapePart,
  ShapePoint,
  ShapeSchema,
  UvRect,
} from './types'

const PRIMITIVE_KINDS = new Set(['box', 'cylinder', 'cone', 'sphere', 'plane', 'circle', 'ring', 'lathe', 'torus', 'extrude', 'difference', 'mesh'])
export const isPrimitiveNode = (node: ShapeNode): node is PrimitiveNode => PRIMITIVE_KINDS.has(node.kind)

/** The options that change the output, as they enter the cache key. */
export function keyOptions(options: GenerateOptions = {}): Record<string, unknown> {
  return {
    seed: options.seed ?? 0,
    colors: options.colors ?? 'linear',
    indexed: options.indexed ?? true,
    materials: options.materials,
    fallbackMaterial: options.fallbackMaterial,
    materialAlias: options.materialAlias,
    instancing: options.instancing,
    levels: options.levels,
  }
}

/** The cache key of a shape under some options: 64-bit FNV-1a of the canonical schema text and the options that change the output. */
export const shapeKey = (schema: ShapeSchema, options: GenerateOptions = {}): string => hashValue({ schema, options: keyOptions(options) })

const IDENTITY_UV: UvRect = { u0: 0, v0: 0, u1: 1, v1: 1 }

class FloatList {
  array: Float32Array
  length = 0
  constructor(capacity = 256) {
    this.array = new Float32Array(capacity)
  }
  reserve(extra: number): void {
    if (this.length + extra <= this.array.length) return
    let capacity = this.array.length * 2
    while (capacity < this.length + extra) capacity *= 2
    const next = new Float32Array(capacity)
    next.set(this.array.subarray(0, this.length))
    this.array = next
  }
  done(): Float32Array {
    return this.array.slice(0, this.length)
  }
}
class IndexList {
  array: Uint32Array
  length = 0
  constructor(capacity = 256) {
    this.array = new Uint32Array(capacity)
  }
  reserve(extra: number): void {
    if (this.length + extra <= this.array.length) return
    let capacity = this.array.length * 2
    while (capacity < this.length + extra) capacity *= 2
    const next = new Uint32Array(capacity)
    next.set(this.array.subarray(0, this.length))
    this.array = next
  }
}

/** Growing buffers of one (target, material). */
class Accumulator {
  readonly positions = new FloatList()
  readonly normals = new FloatList()
  readonly uvs = new FloatList(170)
  readonly colors = new FloatList()
  readonly indices = new IndexList()
  readonly ranges: NamedRange[] = []
  vertices = 0
  constructor(
    readonly material: string,
    readonly part: string | null,
  ) {}
}

interface Target {
  readonly part: string | null
  readonly accs: Map<string, Accumulator>
}

interface Settings {
  readonly colors: 'linear' | 'srgb' | 'none'
  readonly indexed: boolean
  readonly materials?: ReadonlySet<string>
  readonly fallback?: string
  readonly alias?: Readonly<Record<string, string>>
  readonly seed: number | string
  readonly generators?: GenerateOptions['generators']
  readonly autoMin?: number
}

interface LevelSpec {
  readonly distance: number
  readonly detail: number
  readonly minSize?: number
  readonly minSegments?: number
  readonly index: number
}

interface Inherited {
  readonly material: string
  readonly color: number
  readonly uv: UvRect
  readonly target: Target
}

/**
 * Bakes a template into an accumulator: positions by the world matrix, normals by its normal matrix and normalised, uvs into the atlas cell,
 * one colour for all, indices offset. The arithmetic is three's (`createMeshApi`, `BufferGeometry.applyMatrix4`), so the bits match.
 */
function bake(acc: Accumulator, t: PrimitiveBuffers, world: readonly number[], rgb: readonly number[] | null, u: UvRect, indexed: boolean): void {
  const e = world
  const nm = normalMatrix(world)
  const affine = isAffine(world)
  const source = t.positions
  const count = source.length / 3
  const order: ArrayLike<number> | null = indexed ? null : t.indices ?? null
  const emitted = order ? order.length : count
  acc.positions.reserve(emitted * 3)
  acc.normals.reserve(emitted * 3)
  acc.uvs.reserve(emitted * 2)
  if (rgb) acc.colors.reserve(emitted * 3)
  const P = acc.positions.array
  const N = acc.normals.array
  const U = acc.uvs.array
  const C = acc.colors.array
  let pi = acc.positions.length
  let ni = acc.normals.length
  let ui = acc.uvs.length
  let ci = acc.colors.length
  const du = u.u1 - u.u0
  const dv = u.v1 - u.v0
  const tn = t.normals
  const tu = t.uvs
  for (let k = 0; k < emitted; k++) {
    const i = order ? (order[k] as number) : k
    const x = source[i * 3] as number
    const y = source[i * 3 + 1] as number
    const z = source[i * 3 + 2] as number
    if (affine) {
      P[pi++] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!
      P[pi++] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!
      P[pi++] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!
    } else {
      const p = transformPoint(e, x, y, z)
      P[pi++] = p[0]
      P[pi++] = p[1]
      P[pi++] = p[2]
    }
    const nx = tn[i * 3] as number
    const ny = tn[i * 3 + 1] as number
    const nz = tn[i * 3 + 2] as number
    const vx = nm[0]! * nx + nm[3]! * ny + nm[6]! * nz
    const vy = nm[1]! * nx + nm[4]! * ny + nm[7]! * nz
    const vz = nm[2]! * nx + nm[5]! * ny + nm[8]! * nz
    const s = 1 / (Math.sqrt(vx * vx + vy * vy + vz * vz) || 1)
    N[ni++] = vx * s
    N[ni++] = vy * s
    N[ni++] = vz * s
    U[ui++] = u.u0 + (tu[i * 2] as number) * du
    U[ui++] = u.v0 + (tu[i * 2 + 1] as number) * dv
    if (rgb) {
      C[ci++] = rgb[0]!
      C[ci++] = rgb[1]!
      C[ci++] = rgb[2]!
    }
  }
  acc.positions.length = pi
  acc.normals.length = ni
  acc.uvs.length = ui
  acc.colors.length = ci
  if (indexed) {
    const base = acc.vertices
    const idx = t.indices
    const n = idx ? idx.length : count
    acc.indices.reserve(n)
    const I = acc.indices.array
    let ii = acc.indices.length
    for (let k = 0; k < n; k++) I[ii++] = base + (idx ? (idx[k] as number) : k)
    acc.indices.length = ii
  }
  acc.vertices += emitted
}

function boundsOf(positions: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const v = positions[i + axis] as number
      if (v < min[axis]!) min[axis] = v
      if (v > max[axis]!) max[axis] = v
    }
  }
  return { min, max }
}

function finish(acc: Accumulator, indexed: boolean, withColors: boolean): ShapeBatch {
  const positions = acc.positions.done()
  const indices = indexed ? (acc.vertices > 65535 ? acc.indices.array.slice(0, acc.indices.length) : Uint16Array.from(acc.indices.array.subarray(0, acc.indices.length))) : undefined
  return {
    material: acc.material,
    part: acc.part,
    positions,
    normals: acc.normals.done(),
    uvs: acc.uvs.done(),
    ...(withColors ? { colors: acc.colors.done() } : {}),
    ...(indices ? { indices } : {}),
    ranges: acc.ranges,
    bounds: boundsOf(positions),
  }
}

const radiusOf = (t: PrimitiveBuffers, world: readonly number[]): number => {
  let r = 0
  const p = t.positions
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i] as number, p[i + 1] as number, p[i + 2] as number))
  const sx = Math.hypot(world[0]!, world[1]!, world[2]!)
  const sy = Math.hypot(world[4]!, world[5]!, world[6]!)
  const sz = Math.hypot(world[8]!, world[9]!, world[10]!)
  return r * Math.max(sx, sy, sz)
}

interface LevelResult {
  readonly level: ShapeLevel
  readonly parts: ShapePart[]
  readonly points: ShapePoint[]
  readonly primitives: number
}

/** Expands a custom node into the node its generator returns (wrapped so that the custom node's own fields still apply). */
function expandCustom(node: Extract<ShapeNode, { kind: 'custom' }>, settings: Settings, detail: number, path: string): ShapeNode {
  const generator = settings.generators?.[node.generator] ?? getGenerator(node.generator)
  if (!generator) throw new Error(`game-shapes: no generator "${node.generator}" (register it with registerGenerator, in the worker too) at ${path}`)
  const generated = generator(node.params, { random: streamFor(settings.seed, node.generator, path), seed: settings.seed, detail, path })
  const { kind: _kind, generator: _generator, params: _params, ...common } = node
  return { ...common, kind: 'group', children: [generated] }
}

/** The key two leaf primitives share when one can stand for the other as an instance. */
const leafKey = (node: PrimitiveNode, material: string, color: number, uv: UvRect, level: LevelSpec): string =>
  `${node.kind}|${canonicalJson(primitiveParameters(node, level))}|${material}|${color}|${uv.u0},${uv.v0},${uv.u1},${uv.v1}`

function runLevel(schema: ShapeSchema, settings: Settings, level: LevelSpec): LevelResult {
  const bakeParts = level.index > 0
  const root: Target = { part: null, accs: new Map() }
  const targets: Target[] = [root]
  const partTargets = new Map<string, Target>()
  const parts: ShapePart[] = []
  const points: ShapePoint[] = []
  const instanced: InstancedBatch[] = []
  let primitives = 0
  const space = settings.colors === 'none' ? null : settings.colors
  const channels = new Map<number, readonly number[]>()
  const rgbOf = (hex: number): readonly number[] | null => {
    if (!space) return null
    let c = channels.get(hex)
    if (!c) {
      c = colorChannels(hex, space)
      channels.set(hex, c)
    }
    return c
  }
  const resolveMaterial = (id: string): string => {
    let out = id
    if (settings.materials && !settings.materials.has(out)) out = settings.fallback ?? out
    return settings.alias?.[out] ?? out
  }
  const accOf = (target: Target, material: string): Accumulator => {
    let acc = target.accs.get(material)
    if (!acc) {
      acc = new Accumulator(material, target.part)
      target.accs.set(material, acc)
    }
    return acc
  }

  // automatic instancing: count the leaves first
  const autoCounts = new Map<string, number>()
  const autoGroups = new Map<string, { node: PrimitiveNode; material: string; color: number; part: string | null; matrices: number[] }>()

  const count = (node: ShapeNode, inherited: { material: string; color: number; uv: UvRect; inPart: boolean }, path: string): void => {
    if (node.minDetail !== undefined && level.detail < node.minDetail) return
    if (node.kind === 'custom') return count(expandCustom(node, settings, level.detail, path), inherited, path)
    const next = {
      material: node.material !== undefined ? resolveMaterial(node.material) : inherited.material,
      color: node.color !== undefined ? colorHex(node.color) : inherited.color,
      uv: node.uv ?? inherited.uv,
      inPart: inherited.inPart || (node.part !== undefined && !bakeParts),
    }
    if (node.instances) return
    if (node.kind === 'group') {
      node.children?.forEach((child, index) => count(child, next, `${path}/${index}`))
      return
    }
    if (isPrimitiveNode(node) && node.name === undefined && !next.inPart) {
      const key = leafKey(node, next.material, next.color, next.uv, level)
      autoCounts.set(key, (autoCounts.get(key) ?? 0) + 1)
    }
  }
  const rootMaterial = resolveMaterial('default')
  if (settings.autoMin !== undefined) count(schema.root, { material: rootMaterial, color: 0xffffff, uv: IDENTITY_UV, inPart: false }, 'root')

  /** Draws a subtree into `collector` (a target) under `parent` (null: identity). */
  const visit = (node: ShapeNode, parent: Matrix4 | null, inherited: Inherited, path: string): void => {
    if (node.minDetail !== undefined && level.detail < node.minDetail) return
    if (node.kind === 'custom') return visit(expandCustom(node, settings, level.detail, path), parent, inherited, path)
    let target = inherited.target
    let parentWorld = parent
    if (node.part !== undefined) {
      if (bakeParts) {
        // far levels freeze the parts at rest: the part's pivot is relative to the root
        parentWorld = null
      } else {
        let partTarget = partTargets.get(node.part)
        if (!partTarget) {
          partTarget = { part: node.part, accs: new Map() }
          partTargets.set(node.part, partTarget)
          targets.push(partTarget)
          const { position, rotation, rotationOrder, scale, heading, matrix } = node
          parts.push({
            id: node.part,
            ...(position ? { position } : {}),
            ...(rotation ? { rotation } : {}),
            ...(rotationOrder ? { rotationOrder } : {}),
            ...(scale !== undefined ? { scale } : {}),
            ...(heading !== undefined ? { heading } : {}),
            ...(matrix ? { matrix } : { matrix: asMat4(matrixOf(node)) }),
          })
        }
        target = partTarget
      }
    }
    const isPart = node.part !== undefined && !bakeParts
    const local = isPart ? null : matrixOf(node)
    const world = isPart ? null : local ? (parentWorld ? multiply(parentWorld, local) : local) : parentWorld
    const next: Inherited = {
      material: node.material !== undefined ? resolveMaterial(node.material) : inherited.material,
      color: node.color !== undefined ? colorHex(node.color) : inherited.color,
      uv: node.uv ?? inherited.uv,
      target,
    }

    if (node.instances) {
      drawInstanced(node, parentWorld, next, path)
      return
    }

    const snapshot = node.name !== undefined ? new Map([...target.accs].map(([m, a]) => [m, { v: a.vertices, i: a.indices.length }])) : null

    if (node.kind === 'group') {
      node.children?.forEach((child, index) => visit(child, world, next, `${path}/${index}`))
    } else if (node.kind === 'point') {
      const p = node.position ?? [0, 0, 0]
      points.push({
        ...(node.name !== undefined ? { name: node.name } : {}),
        part: target.part,
        position: parent ? transformPoint(parent, p[0], p[1], p[2]) : [p[0], p[1], p[2]],
        ...(node.data !== undefined ? { data: node.data } : {}),
        ...(node.tags ? { tags: node.tags } : {}),
      })
    } else if (isPrimitiveNode(node)) {
      const template = buildPrimitive(node, level)
      const m = world ?? identity4()
      if (level.minSize !== undefined && radiusOf(template, m) < level.minSize) return
      primitives++
      if (settings.autoMin !== undefined && node.name === undefined && target.part === null) {
        const key = leafKey(node, next.material, next.color, next.uv, level)
        if ((autoCounts.get(key) ?? 0) >= settings.autoMin) {
          let group = autoGroups.get(key)
          if (!group) {
            group = { node, material: next.material, color: next.color, part: null, matrices: [] }
            autoGroups.set(key, group)
          }
          group.matrices.push(...m)
          return
        }
      }
      bake(accOf(target, next.material), template, m, rgbOf(next.color), next.uv, settings.indexed)
    }

    if (snapshot) {
      for (const [material, acc] of target.accs) {
        const before = snapshot.get(material) ?? { v: 0, i: 0 }
        if (acc.vertices === before.v) continue
        acc.ranges.push({
          name: node.name as string,
          ...(node.tags ? { tags: node.tags } : {}),
          vertexStart: before.v,
          vertexCount: acc.vertices - before.v,
          indexStart: before.i,
          indexCount: acc.indices.length - before.i,
        })
      }
    }
  }

  const drawInstanced = (node: ShapeNode, parentWorld: Matrix4 | null, inherited: Inherited, path: string): void => {
    const collector: Target = { part: inherited.target.part, accs: new Map() }
    const { instances, ...single } = node as ShapeNode & { instances: NonNullable<ShapeNode['instances']> }
    const before = parts.length
    visit(single as ShapeNode, null, { ...inherited, target: collector }, path)
    if (parts.length !== before) throw new Error(`game-shapes: an instanced node cannot hold parts (${path})`)
    const matrices = new Float32Array(instances.length * 16)
    const hasColors = instances.some((instance) => instance.color !== undefined)
    const colors = hasColors ? new Float32Array(instances.length * 3) : undefined
    instances.forEach((instance, index) => {
      const local = matrixOf(instance)
      const m = local ? (parentWorld ? multiply(parentWorld, local) : local) : parentWorld ?? identity4()
      matrices.set(m, index * 16)
      if (colors) colors.set(colorChannels(colorHex(instance.color), space ?? 'srgb'), index * 3)
    })
    for (const acc of collector.accs.values()) {
      const batch = finish(acc, settings.indexed, false)
      instanced.push({
        material: acc.material,
        part: collector.part,
        ...(node.name !== undefined ? { name: node.name } : {}),
        geometry: { type: 'BufferGeometry', parameters: {}, positions: batch.positions, normals: batch.normals, uvs: batch.uvs, ...(batch.indices ? { indices: batch.indices } : {}), groups: [] },
        matrices: matrices.slice(),
        ...(colors ? { colors: colors.slice() } : {}),
        count: instances.length,
      })
    }
  }

  visit(schema.root, null, { material: rootMaterial, color: 0xffffff, uv: IDENTITY_UV, target: root }, 'root')

  for (const group of autoGroups.values()) {
    const template = buildPrimitive(group.node, level)
    const n = group.matrices.length / 16
    const rgb = colorChannels(group.color, space ?? 'srgb')
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) colors.set(rgb, i * 3)
    instanced.push({
      material: group.material,
      part: null,
      geometry: { type: template.type, parameters: template.parameters, positions: template.positions.slice(), normals: template.normals.slice(), uvs: template.uvs.slice(), ...(template.indices ? { indices: template.indices.slice() } : {}), groups: template.groups.map((g) => ({ ...g })) },
      matrices: new Float32Array(group.matrices),
      ...(space ? { colors } : {}),
      count: n,
    })
  }

  const batches: ShapeBatch[] = []
  for (const target of targets) for (const acc of target.accs.values()) if (acc.vertices > 0 && (!settings.indexed || acc.indices.length > 0)) batches.push(finish(acc, settings.indexed, space !== null))
  return { level: { distance: level.distance, detail: level.detail, batches, instanced }, parts, points, primitives }
}

/**
 * Turns a shape into buffers: one batch per (part, material) per level, baked; instanced nodes as instance batches; parts with their pivots;
 * points. Pure: the same schema and options give the same bytes, here or in a worker.
 */
export function generate(schema: ShapeSchema, options: GenerateOptions = {}): ShapeBuffers {
  if (options.validate !== false) assertValidShape(schema)
  const settings: Settings = {
    colors: options.colors ?? 'linear',
    indexed: options.indexed ?? true,
    ...(options.materials ? { materials: new Set(options.materials) } : {}),
    ...(options.fallbackMaterial !== undefined ? { fallback: options.fallbackMaterial } : {}),
    ...(options.materialAlias ? { alias: options.materialAlias } : {}),
    seed: options.seed ?? 0,
    ...(options.generators ? { generators: options.generators } : {}),
    ...(options.instancing ? { autoMin: Math.max(2, options.instancing.minCount) } : {}),
  }
  const specs: LevelSpec[] = [{ distance: 0, detail: 1, index: 0 }, ...(schema.lod ?? []).map((rule, index) => ({ ...rule, index: index + 1 }))]
  const wanted = options.levels ? specs.filter((spec) => options.levels!.includes(spec.index)) : specs
  let parts: ShapePart[] = []
  let points: ShapePoint[] = []
  let primitives = 0
  const levels: ShapeLevel[] = []
  for (const spec of wanted) {
    const result = runLevel(schema, settings, spec)
    if (spec.index === 0 || levels.length === 0) {
      parts = result.parts
      points = result.points
      primitives = result.primitives
    }
    levels.push(result.level)
  }
  const first = levels[0]
  const vertices = first ? first.batches.reduce((sum, batch) => sum + batch.positions.length / 3, 0) : 0
  const triangles = first
    ? first.batches.reduce((sum, batch) => sum + (batch.indices ? batch.indices.length : batch.positions.length / 3) / 3, 0) +
      first.instanced.reduce((sum, batch) => sum + ((batch.geometry.indices ? batch.geometry.indices.length : batch.geometry.positions.length / 3) / 3) * batch.count, 0)
    : 0
  return {
    key: shapeKey(schema, options),
    ...(schema.name !== undefined ? { name: schema.name } : {}),
    levels,
    parts,
    points,
    ...(schema.materials ? { materials: schema.materials } : {}),
    ...(schema.cullDistance !== undefined ? { cullDistance: schema.cullDistance } : {}),
    stats: { vertices, triangles, batches: first ? first.batches.length : 0, instances: first ? first.instanced.reduce((sum, batch) => sum + batch.count, 0) : 0, primitives },
  }
}
