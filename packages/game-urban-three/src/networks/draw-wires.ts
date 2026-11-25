import type * as THREE_NS from 'three'

import { appendLine, appendTube, emptyLines, emptyMesh } from './catenary'
import type { LineData, MeshData, Vec3 } from './catenary'
import { WIRE_CLASSES } from './wire-runs'
import type { GuyAnchor, WireClass, WireRun } from './wire-runs'

type Three = typeof THREE_NS

/** How each class of conductor looks: the radius of its tube and its colour (bare aluminium medium voltage, black insulated cables, steel guys). */
export const WIRE_STYLE: Readonly<Record<WireClass, { readonly radius: number; readonly color: number; readonly metalness: number; readonly roughness: number }>> = {
  mv: { radius: 0.007, color: 0x8e9297, metalness: 0.5, roughness: 0.5 },
  lv: { radius: 0.016, color: 0x1b1c1e, metalness: 0, roughness: 0.8 },
  telecom: { radius: 0.008, color: 0x141516, metalness: 0, roughness: 0.85 },
  drops: { radius: 0.007, color: 0x1c1c1e, metalness: 0, roughness: 0.8 },
  guys: { radius: 0.005, color: 0x7a7c7e, metalness: 0.6, roughness: 0.5 },
}

/** Where a span's conductors lie in the merged meshes (R8): its range of indices in its class's tube mesh (`near`) and in the far lines. */
export type SpanRange = { readonly wireClass: WireClass; readonly near: readonly [number, number]; readonly far: readonly [number, number] }

export type DrawnWires = {
  /** One tube mesh per class with conductors, near (LOD 0). */
  readonly near: readonly THREE_NS.Mesh[]
  /** Every conductor as line segments, far (no hardware). */
  readonly far: THREE_NS.LineSegments
  readonly spans: ReadonlyMap<string, SpanRange>
  /** Spans within `distance` of the point are tubes, the others lines: an upload of each index buffer only when a span changes side. */
  setFocus(x: number, z: number, distance: number): void
  dispose(): void
}

const rgb = (THREE: Three, hex: number): readonly [number, number, number] => {
  const color = new THREE.Color(hex)
  return [color.r, color.g, color.b]
}

const distanceToSegment = (x: number, z: number, a: Vec3, b: Vec3): number => {
  const [dx, dz] = [b[0] - a[0], b[2] - a[2]]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(a[0] + dx * t - x, a[2] + dz * t - z)
}

/** Sets the range of each span in `index` to its original indices (shown) or to zeros (degenerate triangles or lines: hidden). */
const apply = (attribute: THREE_NS.BufferAttribute, original: Uint32Array, ranges: ReadonlyArray<readonly [number, number] | undefined>, shown: readonly boolean[]): void => {
  const array = attribute.array as Uint32Array
  ranges.forEach((range, span) => {
    if (!range) return
    const [start, count] = range
    if (shown[span]) array.set(original.subarray(start, start + count), start)
    else array.fill(0, start, start + count)
  })
  attribute.needsUpdate = true
}

/** The conductors merged into one tube mesh per class and one set of far lines, with each span's index ranges (R8). */
export function drawWires(THREE: Three, { runs, guys }: { readonly runs: readonly WireRun[]; readonly guys: readonly GuyAnchor[] }): DrawnWires {
  const all: WireRun[] = [...runs, ...guys.map((guy): WireRun => ({ id: guy.id, wireClass: 'guys', conductors: [[guy.from, guy.at]] }))]
  const meshes = new Map<WireClass, MeshData>(WIRE_CLASSES.map((wireClass) => [wireClass, emptyMesh()]))
  const lines: LineData = emptyLines()
  const spans = new Map<string, SpanRange>()
  for (const run of all) {
    const mesh = meshes.get(run.wireClass)!
    const { radius, color } = WIRE_STYLE[run.wireClass]
    const nearRanges = run.conductors.map((points) => appendTube({ mesh, points, radius }))
    const farRanges = run.conductors.map((points) => appendLine({ lines, points, color: rgb(THREE, color) }))
    const span = (ranges: ReadonlyArray<readonly [number, number]>): readonly [number, number] => [ranges[0]![0], ranges.reduce((sum, range) => sum + range[1], 0)]
    spans.set(run.id, { wireClass: run.wireClass, near: span(nearRanges), far: span(farRanges) })
  }
  const owned: Array<{ dispose(): void }> = []
  const near = WIRE_CLASSES.filter((wireClass) => meshes.get(wireClass)!.indices.length > 0).map((wireClass) => {
    const data = meshes.get(wireClass)!
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3))
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1))
    const style = WIRE_STYLE[wireClass]
    const material = new THREE.MeshStandardMaterial({ color: style.color, metalness: style.metalness, roughness: style.roughness })
    owned.push(geometry, material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `network:${wireClass}`
    mesh.castShadow = true
    return mesh
  })
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines.positions, 3))
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lines.colors, 3))
  lineGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(lines.indices), 1))
  const lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true })
  owned.push(lineGeometry, lineMaterial)
  const far = new THREE.LineSegments(lineGeometry, lineMaterial)
  far.name = 'network:far'
  far.visible = false

  const ids = [...spans.keys()]
  const ends = all.map((run) => [run.conductors[0]![0]!, run.conductors[0]![run.conductors[0]!.length - 1]!] as const)
  const originals = new Map(near.map((mesh) => [mesh, (mesh.geometry.index!.array as Uint32Array).slice()]))
  const farOriginal = (lineGeometry.index!.array as Uint32Array).slice()
  let shown = ids.map(() => true)
  return {
    near,
    far,
    spans,
    setFocus(x, z, distance) {
      const next = ends.map(([a, b]) => distanceToSegment(x, z, a, b) <= distance)
      if (next.every((value, span) => value === shown[span])) return
      shown = next
      for (const mesh of near) {
        const wireClass = mesh.name.slice('network:'.length)
        apply(mesh.geometry.index!, originals.get(mesh)!, ids.map((id) => (spans.get(id)!.wireClass === wireClass ? spans.get(id)!.near : undefined)), shown)
        mesh.visible = ids.some((id, span) => shown[span] && spans.get(id)!.wireClass === wireClass)
      }
      apply(lineGeometry.index!, farOriginal, ids.map((id) => spans.get(id)!.far), shown.map((value) => !value))
      far.visible = shown.some((value) => !value)
    },
    dispose() {
      for (const item of owned.splice(0)) item.dispose()
    },
  }
}
