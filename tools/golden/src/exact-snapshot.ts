import { hashText } from './scene-hash'

/**
 * Exact snapshot of a three.js tree: every byte of every attribute and index, the attribute order and array types, the transforms, the
 * user data, the materials (by identity, type and the fields that change a draw) and the lights. Where `snapshotScene` answers "does it look
 * the same", this answers "is it the same object": it guards a change of the code that builds geometry (a move to another generator) that
 * must not change a single bit. It reads the objects duck-typed, so it works with any three.js version and without importing it.
 */

type Any = Record<string, any>

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

/** FNV-1a over the raw bytes of a typed array (the bits, so -0, NaN payloads and the last ulp count). */
export function hashBytes(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  let hash = FNV_OFFSET
  for (let index = 0; index < bytes.length; index++) {
    hash ^= bytes[index] as number
    hash = Math.imul(hash, FNV_PRIME)
  }
  return `${(hash >>> 0).toString(16)}:${bytes.length}`
}

/** A number as text that keeps -0 and every bit of a double. */
const num = (value: unknown): string => (typeof value !== 'number' ? String(value) : Object.is(value, -0) ? '-0' : String(value))

const vec = (v: Any | undefined, keys: readonly string[]): string => (v ? keys.map((k) => num(v[k])).join(',') : '-')

/** JSON with sorted keys and exact numbers, without uuids; functions and three objects (objects, materials, textures) by a placeholder. */
function stable(value: unknown, depth = 0): string {
  if (depth > 6) return '…'
  if (typeof value === 'number') return num(value)
  if (value === null || typeof value !== 'object') return typeof value === 'function' ? 'fn' : JSON.stringify(value) ?? 'undefined'
  const o = value as Any
  if (ArrayBuffer.isView(o)) return `bytes(${hashBytes(o)})`
  if (o.isObject3D || o.isMaterial || o.isTexture) return `<${o.type ?? 'object'}${o.name ? ` ${o.name}` : ''}>`
  if (Array.isArray(o)) return `[${o.map((x) => stable(x, depth + 1)).join(',')}]`
  // uuids are random per run (a Shape in an extrusion's parameters has one)
  return `{${Object.keys(o)
    .filter((k) => k !== 'uuid')
    .sort()
    .map((k) => `${k}:${stable(o[k], depth + 1)}`)
    .join(',')}}`
}

function geometryLines(g: Any): string[] {
  const lines = [`geometry ${g.type} params=${g.parameters ? stable(g.parameters) : '-'}`]
  for (const [name, a] of Object.entries(g.attributes ?? {}) as Array<[string, Any]>) {
    const array = a.array as ArrayBufferView
    // the array type, not the wrapper class: Float32BufferAttribute is only a constructor that copies into a Float32Array
    lines.push(`  ${name} ${array.constructor.name} size=${a.itemSize} normalized=${a.normalized} count=${a.count} ${hashBytes(array)}`)
  }
  if (g.index) lines.push(`  index ${g.index.array.constructor.name} count=${g.index.count} ${hashBytes(g.index.array)}`)
  if (g.groups?.length) lines.push(`  groups ${stable(g.groups)}`)
  if (g.drawRange && (g.drawRange.start !== 0 || g.drawRange.count !== Infinity)) lines.push(`  drawRange ${num(g.drawRange.start)},${num(g.drawRange.count)}`)
  if (g.boundingBox) lines.push(`  box ${vec(g.boundingBox.min, ['x', 'y', 'z'])} ${vec(g.boundingBox.max, ['x', 'y', 'z'])}`)
  if (g.boundingSphere) lines.push(`  sphere ${vec(g.boundingSphere.center, ['x', 'y', 'z'])} r=${num(g.boundingSphere.radius)}`)
  if (g.userData && Object.keys(g.userData).length) lines.push(`  userData ${stable(g.userData)}`)
  return lines
}

// where the object comes from (`markKitOrigin` of game-contracts) is not part of the drawing: a builder that starts marking its root keeps its golden
const PROVENANCE_KEYS = new Set(['kitOrigin'])
function drawnUserData(userData: Any): Any | null {
  if (!userData) return null
  const keys = Object.keys(userData).filter((key) => !PROVENANCE_KEYS.has(key))
  return keys.length ? Object.fromEntries(keys.map((key) => [key, userData[key]])) : null
}

function materialLine(m: Any, ids: Map<object, number>): string {
  let id = ids.get(m)
  if (id === undefined) {
    id = ids.size
    ids.set(m, id)
  }
  const color = m.color?.getHexString ? m.color.getHexString() : '-'
  return `material #${id} ${m.type} name=${m.name} color=${color} side=${m.side} transparent=${m.transparent} opacity=${num(m.opacity)} vertexColors=${m.vertexColors} depthWrite=${m.depthWrite}`
}

export interface ExactSnapshot {
  /** One hash of the whole tree. */
  readonly hash: string
  /** A hash per object, in traverse order (`<path> <type> <hash>`): where two snapshots part. */
  readonly nodes: readonly string[]
  /** The lines behind the hashes, for a diff while debugging (not meant to be stored). */
  readonly lines: readonly string[]
}

/** The exact snapshot of `root` and everything under it. */
export function exactSnapshot(root: Any): ExactSnapshot {
  const ids = new Map<object, number>()
  const nodes: string[] = []
  const all: string[] = []
  const walk = (o: Any, path: string): void => {
    const lines = [
      `${path} ${o.type} name=${o.name} visible=${o.visible} cast=${o.castShadow} receive=${o.receiveShadow} order=${o.renderOrder} culled=${o.frustumCulled}`,
      `  p=${vec(o.position, ['x', 'y', 'z'])} q=${vec(o.quaternion, ['x', 'y', 'z', 'w'])} s=${vec(o.scale, ['x', 'y', 'z'])} auto=${o.matrixAutoUpdate}`,
    ]
    const userData = drawnUserData(o.userData)
    if (userData) lines.push(`  userData ${stable(userData)}`)
    if (o.geometry) lines.push(...geometryLines(o.geometry))
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) lines.push(materialLine(m, ids))
    if (o.isInstancedMesh) lines.push(`  instances count=${o.count} matrices=${hashBytes(o.instanceMatrix.array)} colors=${o.instanceColor ? hashBytes(o.instanceColor.array) : '-'}`)
    if (o.isLight) lines.push(`  light color=${o.color?.getHexString?.()} intensity=${num(o.intensity)} distance=${num(o.distance)} decay=${num(o.decay)}`)
    if (o.isLOD) lines.push(`  levels ${(o.levels as Any[]).map((l) => num(l.distance)).join(',')}`)
    all.push(...lines)
    nodes.push(`${path} ${o.type} ${hashText(lines.join('\n'))}`)
    ;(o.children as Any[]).forEach((child, index) => walk(child, `${path}/${index}`))
  }
  walk(root, '0')
  return { hash: hashText(all.join('\n')), nodes, lines: all }
}
