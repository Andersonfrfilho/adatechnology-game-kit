import schemaJson from '../schema/shape.schema.json'
import type { ShapeSchema } from './types'

/** The JSON Schema (draft 2020-12) of a shape document; the same file ships as `@adatechnology/game-shapes/schema.json`. */
export const SHAPE_SCHEMA: Readonly<Record<string, unknown>> = schemaJson

type Check = (value: unknown) => string | null

const num: Check = (v) => (typeof v === 'number' && Number.isFinite(v) ? null : 'expected a finite number')
const bool: Check = (v) => (typeof v === 'boolean' ? null : 'expected a boolean')
const str: Check = (v) => (typeof v === 'string' ? null : 'expected a string')
const int = (min: number): Check => (v) => (typeof v === 'number' && Number.isInteger(v) && v >= min ? null : `expected an integer >= ${min}`)
const range = (lo: number, hi: number, loOpen = false): Check => (v) =>
  typeof v === 'number' && (loOpen ? v > lo : v >= lo) && v <= hi ? null : `expected a number in ${loOpen ? '(' : '['}${lo}, ${hi}]`
const tuple = (n: number, item: Check = num): Check => (v) => {
  if (!Array.isArray(v) || v.length !== n) return `expected an array of ${n}`
  for (const x of v) if (item(x)) return `expected an array of ${n} numbers`
  return null
}
const list = (item: Check, min = 0): Check => (v) => {
  if (!Array.isArray(v)) return 'expected an array'
  if (v.length < min) return `expected at least ${min} items`
  for (let i = 0; i < v.length; i++) {
    const e = item(v[i])
    if (e) return `[${i}]: ${e}`
  }
  return null
}
const color: Check = (v) =>
  (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff) || (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? null : 'expected 0xRRGGBB or "#rrggbb"'
const oneOf = (values: readonly unknown[]): Check => (v) => (values.includes(v) ? null : `expected one of ${values.map((x) => JSON.stringify(x)).join(', ')}`)
const object = (fields: Readonly<Record<string, Check>>, required: readonly string[] = []): Check => (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'expected an object'
  const record = v as Record<string, unknown>
  for (const key of required) if (record[key] === undefined) return `${key}: required`
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) continue
    const check = fields[key]
    if (!check) return `${key}: unknown field`
    const e = check(record[key])
    if (e) return `${key}: ${e}`
  }
  return null
}

const ORDERS = ['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'] as const
const TRANSFORM: Record<string, Check> = {
  position: tuple(3),
  rotation: tuple(3),
  rotationOrder: oneOf(ORDERS),
  scale: (v) => (typeof v === 'number' ? num(v) : tuple(3)(v)),
  heading: num,
  matrix: tuple(16),
}
const UV = object({ u0: num, v0: num, u1: num, v1: num }, ['u0', 'v0', 'u1', 'v1'])
const INSTANCE = object({ ...TRANSFORM, color })
const COMMON: Record<string, Check> = {
  ...TRANSFORM,
  kind: str,
  name: str,
  part: str,
  material: str,
  color,
  uv: UV,
  instances: list(INSTANCE),
  minDetail: range(0, 1, true),
  tags: list(str),
}
const vec2 = tuple(2)
const BEVEL: Check = (v) => (v === false ? null : object({ thickness: num, size: num, offset: num, segments: int(1) })(v))
const KINDS: Readonly<Record<string, { fields: Record<string, Check>; required?: string[] }>> = {
  group: { fields: {} },
  box: { fields: { size: tuple(3), segments: tuple(3, int(1)) } },
  cylinder: { fields: { radiusTop: num, radiusBottom: num, height: num, radialSegments: int(1), heightSegments: int(1), openEnded: bool, thetaStart: num, thetaLength: num } },
  cone: { fields: { radius: num, height: num, radialSegments: int(1), heightSegments: int(1), openEnded: bool, thetaStart: num, thetaLength: num } },
  sphere: { fields: { radius: num, widthSegments: int(3), heightSegments: int(2), phiStart: num, phiLength: num, thetaStart: num, thetaLength: num } },
  plane: { fields: { width: num, height: num, widthSegments: int(1), heightSegments: int(1) } },
  circle: { fields: { radius: num, segments: int(3), thetaStart: num, thetaLength: num } },
  ring: { fields: { innerRadius: num, outerRadius: num, thetaSegments: int(3), phiSegments: int(1), thetaStart: num, thetaLength: num } },
  lathe: { fields: { points: list(vec2, 2), segments: int(1), phiStart: num, phiLength: num }, required: ['points'] },
  torus: { fields: { radius: num, tube: num, radialSegments: int(1), tubularSegments: int(1), arc: num } },
  extrude: {
    fields: { shape: object({ outer: list(vec2, 3), holes: list(list(vec2, 3)) }, ['outer']), depth: num, steps: int(1), bevel: BEVEL },
    required: ['shape'],
  },
  difference: { fields: { size: tuple(3), subtract: list(object({ min: vec2, max: vec2 }, ['min', 'max'])) }, required: ['size', 'subtract'] },
  mesh: {
    fields: {
      positions: (v) => list(num)(v) ?? ((v as unknown[]).length % 3 === 0 ? null : 'expected a multiple of 3 numbers'),
      normals: list(num),
      uvs: list(num),
      indices: list(int(0)),
    },
    required: ['positions'],
  },
  point: { fields: { data: () => null } },
  custom: { fields: { generator: str, params: () => null }, required: ['generator'] },
}

function validateNode(node: unknown, path: string, errors: string[]): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`${path}: expected a node object`)
    return
  }
  const record = node as Record<string, unknown>
  const spec = typeof record.kind === 'string' ? KINDS[record.kind] : undefined
  if (!spec) {
    errors.push(`${path}.kind: expected one of ${Object.keys(KINDS).join(', ')}`)
    return
  }
  for (const key of spec.required ?? []) if (record[key] === undefined) errors.push(`${path}.${key}: required`)
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || key === 'children') continue
    const check = spec.fields[key] ?? COMMON[key]
    if (!check) {
      errors.push(`${path}.${key}: unknown field for a ${String(record.kind)}`)
      continue
    }
    const e = check(record[key])
    if (e) errors.push(`${path}.${key}: ${e}`)
  }
  const exclusive = ['matrix', 'heading'].filter((key) => record[key] !== undefined)
  if (record.matrix !== undefined && (record.position !== undefined || record.rotation !== undefined || record.scale !== undefined || record.heading !== undefined))
    errors.push(`${path}.matrix: cannot be combined with position, rotation, scale or heading`)
  else if (exclusive.includes('heading') && (record.rotation !== undefined || record.scale !== undefined)) errors.push(`${path}.heading: cannot be combined with rotation or scale`)
  if (record.children !== undefined) {
    if (record.kind !== 'group') errors.push(`${path}.children: only a group has children`)
    else if (!Array.isArray(record.children)) errors.push(`${path}.children: expected an array`)
    else record.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`, errors))
  }
}

/** Every rule of the JSON Schema, checked without a schema engine: one message per problem, with its path (`root.children[3].radialSegments: ...`). */
export function validateShape(schema: unknown): string[] {
  const errors: string[] = []
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return ['expected a shape object']
  const record = schema as Record<string, unknown>
  for (const key of Object.keys(record)) if (!['version', 'name', 'materials', 'root', 'lod', 'cullDistance'].includes(key) && record[key] !== undefined) errors.push(`${key}: unknown field`)
  if (record.version !== 1) errors.push('version: expected 1')
  if (record.name !== undefined && typeof record.name !== 'string') errors.push('name: expected a string')
  if (record.materials !== undefined) {
    if (!record.materials || typeof record.materials !== 'object' || Array.isArray(record.materials)) errors.push('materials: expected an object')
    else {
      const material = object({
        color,
        roughness: range(0, 1),
        metalness: range(0, 1),
        opacity: range(0, 1),
        transparent: bool,
        emissive: color,
        emissiveIntensity: (v) => (typeof v === 'number' && v >= 0 ? null : 'expected a number >= 0'),
        side: oneOf(['front', 'back', 'double']),
        flatShading: bool,
        vertexColors: bool,
        depthWrite: bool,
      })
      for (const [id, hint] of Object.entries(record.materials)) {
        const e = material(hint)
        if (e) errors.push(`materials.${id}: ${e}`)
      }
    }
  }
  if (record.lod !== undefined) {
    const e = list(object({ distance: (v) => (typeof v === 'number' && v >= 0 ? null : 'expected a number >= 0'), detail: range(0, 1, true), minSize: (v) => (typeof v === 'number' && v >= 0 ? null : 'expected a number >= 0'), minSegments: int(3) }, ['distance', 'detail']))(record.lod)
    if (e) errors.push(`lod${e.startsWith('[') ? '' : ': '}${e}`)
  }
  if (record.cullDistance !== undefined && !(typeof record.cullDistance === 'number' && record.cullDistance > 0)) errors.push('cullDistance: expected a number > 0')
  if (record.root === undefined) errors.push('root: required')
  else validateNode(record.root, 'root', errors)
  return errors
}

/** Throws with every problem when the schema is not valid. */
export function assertValidShape(schema: unknown): asserts schema is ShapeSchema {
  const errors = validateShape(schema)
  if (errors.length) throw new Error(`game-shapes: invalid shape\n  ${errors.slice(0, 20).join('\n  ')}${errors.length > 20 ? `\n  ... ${errors.length - 20} more` : ''}`)
}
