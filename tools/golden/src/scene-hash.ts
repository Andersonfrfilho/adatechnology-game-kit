import type { SceneSnapshot } from './types'

/** The slice of a three.js object the hash reads, so it works with any three.js version and without importing it. */
export type SceneNodeLike = {
  readonly type: string
  readonly name: string
  readonly visible: boolean
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly quaternion: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }
  readonly scale: { readonly x: number; readonly y: number; readonly z: number }
  readonly traverse: (visitor: (node: SceneNodeLike) => void) => void
  readonly geometry?: GeometryLike
  readonly material?: MaterialLike | readonly MaterialLike[]
}

type GeometryLike = {
  readonly type: string
  readonly attributes?: { readonly position?: { readonly count: number; readonly array: ArrayLike<number> } }
  readonly index?: { readonly count: number } | null
}

type MaterialLike = {
  readonly type: string
  readonly color?: { readonly getHexString: () => string }
  readonly opacity?: number
}

export type DescribeSceneOptions = {
  /** Decimal places kept for every number; transforms drift in the last digits across builds. */
  readonly precision?: number
  /** Leaves node names out, for pages whose names are not part of what the SDK must match. */
  readonly ignoreNames?: boolean
}

const DEFAULT_PRECISION = 4
const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision
  // + 0 turns -0 into 0 so that "-0" never shows up in a hash input
  return Math.round(value * factor) / factor + 0
}

/** FNV-1a of a text, as a hex string: the hash a capture and a package test put in an event so long lists compare as one value. */
export function hashText(text: string): string {
  let hash = FNV_OFFSET
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0).toString(16)
}

function fnvOfNumbers(values: ArrayLike<number>, precision: number): string {
  const factor = 10 ** precision
  let hash = FNV_OFFSET
  for (let index = 0; index < values.length; index++) {
    const scaled = Math.round((values[index] as number) * factor)
    hash ^= scaled & 0xffff
    hash = Math.imul(hash, FNV_PRIME)
    hash ^= (scaled >> 16) & 0xffff
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0).toString(16)
}

function describeVector(prefix: string, components: readonly number[], precision: number): string {
  return prefix + components.map((component) => roundTo(component, precision)).join(',')
}

function describeGeometry(geometry: GeometryLike, precision: number): string {
  const positions = geometry.attributes?.position
  if (!positions) return `geo:${geometry.type}`
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (let offset = 0; offset + 2 < positions.array.length; offset += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions.array[offset + axis] as number
      bounds[axis] = Math.min(bounds[axis] as number, value)
      bounds[axis + 3] = Math.max(bounds[axis + 3] as number, value)
    }
  }
  const indexPart = geometry.index ? ` i${geometry.index.count}` : ''
  const boundsPart = positions.count > 0 ? describeVector(' bbox', bounds, precision) : ''
  return `geo:${geometry.type} v${positions.count}:${fnvOfNumbers(positions.array, precision)}${indexPart}${boundsPart}`
}

function describeMaterial(material: MaterialLike, precision: number): string {
  const color = material.color ? material.color.getHexString() : '-'
  return `${material.type}:${color}:${roundTo(material.opacity ?? 1, precision)}`
}

function describeMaterials(material: SceneNodeLike['material'], precision: number): string {
  if (!material) return ''
  const list = Array.isArray(material) ? (material as readonly MaterialLike[]) : [material as MaterialLike]
  return ' mat:' + list.map((entry) => describeMaterial(entry, precision)).join('|')
}

function describeNode(node: SceneNodeLike, options: Required<DescribeSceneOptions>): string {
  const { precision } = options
  const { position, quaternion, scale } = node
  const parts = [node.type]
  if (!options.ignoreNames && node.name) parts.push(`"${node.name}"`)
  if (!node.visible) parts.push('hidden')
  parts.push(describeVector('p', [position.x, position.y, position.z], precision))
  parts.push(describeVector('q', [quaternion.x, quaternion.y, quaternion.z, quaternion.w], precision))
  parts.push(describeVector('s', [scale.x, scale.y, scale.z], precision))
  if (node.geometry) parts.push(describeGeometry(node.geometry, precision))
  return parts.join(' ') + describeMaterials(node.material, precision)
}

/** One line per node in traversal order: names, geometry, material colors and local transforms, never uuids. */
export function describeScene(root: SceneNodeLike, options: DescribeSceneOptions = {}): string[] {
  const resolved = { precision: options.precision ?? DEFAULT_PRECISION, ignoreNames: options.ignoreNames ?? false }
  const lines: string[] = []
  root.traverse((node) => lines.push(describeNode(node, resolved)))
  return lines
}

export function snapshotScene(root: SceneNodeLike, options: DescribeSceneOptions = {}): SceneSnapshot {
  const lines = describeScene(root, options)
  return { objects: lines.length, hash: hashText(lines.join('\n')), lines }
}
