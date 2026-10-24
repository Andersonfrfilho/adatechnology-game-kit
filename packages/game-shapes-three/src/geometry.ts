import type { PrimitiveBuffers, ShapeBatch } from '@adatechnology/game-shapes'
import type * as THREE_NS from 'three'

export type Three = typeof THREE_NS

export interface ToGeometryOptions {
  /** Copy the arrays into the attributes (default true). Without a copy the geometry shares the buffers (a cached result is read-only: do not deform it). */
  readonly copy?: boolean
}

/** The order in which three's generator of each type sets its attributes (toJSON and attribute iteration keep it). */
const UV_BEFORE_NORMAL = new Set(['LatheGeometry', 'ExtrudeGeometry'])
/** Types whose constructor sets the index before the attributes. */
const INDEX_FIRST = new Set(['BoxGeometry', 'CylinderGeometry', 'ConeGeometry', 'SphereGeometry', 'PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'LatheGeometry', 'TorusGeometry'])

const isPrimitive = (value: PrimitiveBuffers | ShapeBatch): value is PrimitiveBuffers => typeof (value as PrimitiveBuffers).type === 'string'

/** Three's own parameters object for a type (lathe points as `Vector2`). */
function threeParameters(THREE: Three, p: PrimitiveBuffers): Record<string, unknown> {
  if (p.type === 'LatheGeometry') {
    const points = (p.parameters.points as Array<{ x: number; y: number }>).map(({ x, y }) => new THREE.Vector2(x, y))
    return { ...p.parameters, points }
  }
  return { ...p.parameters }
}

/**
 * A `BufferGeometry` from game-shapes buffers. A primitive becomes an instance of the three class it reproduces (`type`, `parameters`, prototype:
 * `instanceof THREE.CylinderGeometry`, `clone()` and `toJSON()` behave as three's), with the same attributes, index and groups. A batch gets
 * `position`, `normal`, `uv`, `color` (when present) and its index.
 */
export function toGeometry(THREE: Three, source: PrimitiveBuffers | ShapeBatch, options: ToGeometryOptions = {}): THREE_NS.BufferGeometry {
  const copy = options.copy !== false
  const primitive = isPrimitive(source) ? source : null
  const ThreeClass = primitive && primitive.type !== 'BufferGeometry' ? ((THREE as unknown as Record<string, unknown>)[primitive.type] as (new () => THREE_NS.BufferGeometry) | undefined) : undefined
  // the BufferGeometry constructor only, with the prototype of the class it stands for
  const geometry = (ThreeClass ? Reflect.construct(THREE.BufferGeometry, [], ThreeClass) : new THREE.BufferGeometry()) as THREE_NS.BufferGeometry & { parameters?: Record<string, unknown> }
  if (primitive && ThreeClass) {
    Object.assign(geometry, { type: primitive.type, parameters: threeParameters(THREE, primitive) })
  }
  const attribute = (array: Float32Array, size: number): THREE_NS.BufferAttribute => (copy ? new THREE.Float32BufferAttribute(array, size) : new THREE.BufferAttribute(array, size))
  const index = source.indices
  const setIndex = (): void => {
    if (!index) return
    geometry.setIndex(copy ? (index instanceof Uint32Array ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1)) : new THREE.BufferAttribute(index, 1))
  }
  const type = primitive?.type ?? 'BufferGeometry'
  if (INDEX_FIRST.has(type)) setIndex()
  geometry.setAttribute('position', attribute(source.positions, 3))
  if (UV_BEFORE_NORMAL.has(type)) {
    geometry.setAttribute('uv', attribute(source.uvs, 2))
    geometry.setAttribute('normal', attribute(source.normals, 3))
  } else {
    geometry.setAttribute('normal', attribute(source.normals, 3))
    geometry.setAttribute('uv', attribute(source.uvs, 2))
  }
  if (!primitive && (source as ShapeBatch).colors) geometry.setAttribute('color', attribute((source as ShapeBatch).colors as Float32Array, 3))
  if (!INDEX_FIRST.has(type)) setIndex()
  if (primitive) for (const group of primitive.groups) geometry.addGroup(group.start, group.count, group.materialIndex)
  return geometry
}
