import type * as THREE_NS from 'three'

import { markKitOrigin } from '@adatechnology/game-contracts'
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import { surfacePiecesOf } from '@adatechnology/game-urban/networks'
import type { SurfacePiece, SurfacePiecesOptions, UtilityNetworks } from '@adatechnology/game-urban/networks'

import { partsOf } from './surface-parts'
import type { SurfacePart } from './surface-parts'

type Three = typeof THREE_NS

/** Sides of a round cover. */
const CYLINDER_SEGMENTS = 14

export type DrawnSurface = {
  readonly root: THREE_NS.Object3D
  /** The pieces drawn (`surfacePiecesOf`): where each cover, grate, hydrant and wall stands. */
  readonly pieces: readonly SurfacePiece[]
  /** Draw calls: one for the boxes, one for the cylinders. */
  drawCalls(): number
  /** Takes a piece off the ground (a cover thrown by a blast): its parts are hidden, nothing else moves. */
  remove(id: string): void
  dispose(): void
}

type Range = { readonly box: readonly [number, number]; readonly cylinder: readonly [number, number] }

/**
 * Draws what shows of the buried networks (`surfacePiecesOf`): covers flush with the road, grates at the kerb, hydrants, wing walls, the
 * boxes of each lot. Every part of every piece is an instance of one of two meshes, with its colour: two draw calls whatever the district.
 */
export function drawSurface(THREE: Three, { networks, pieces, root, options }: { readonly networks?: Pick<UtilityNetworks, 'nodes' | 'edges'>; readonly pieces?: readonly SurfacePiece[]; readonly root?: THREE_NS.Object3D; readonly options?: SurfacePiecesOptions }): DrawnSurface {
  const list = pieces ?? surfacePiecesOf(networks ?? { nodes: [], edges: [] }, options)
  const T = shapeGeometries(THREE)
  const group = markKitOrigin(root ?? new THREE.Group(), { owner: 'game-urban-three', kind: 'network-surface' })
  const boxes: Array<{ readonly piece: SurfacePiece; readonly part: SurfacePart }> = []
  const cylinders: Array<{ readonly piece: SurfacePiece; readonly part: SurfacePart }> = []
  const ranges = new Map<string, Range>()
  for (const piece of list) {
    const parts = partsOf(piece)
    const range = { box: [boxes.length, 0] as [number, number], cylinder: [cylinders.length, 0] as [number, number] }
    for (const part of parts) (part.shape === 'box' ? boxes : cylinders).push({ piece, part })
    range.box[1] = boxes.length - range.box[0]
    range.cylinder[1] = cylinders.length - range.cylinder[0]
    ranges.set(piece.id, range)
  }
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.2 })
  const boxGeometry = new T.BoxGeometry(1, 1, 1)
  const cylinderGeometry = new T.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS)
  const matrix = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const spin = new THREE.Quaternion()
  const local = new THREE.Matrix4()
  const color = new THREE.Color()
  const axisTurn: Record<'x' | 'y' | 'z', THREE_NS.Quaternion> = { x: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), y: new THREE.Quaternion(), z: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) }
  const fill = (mesh: THREE_NS.InstancedMesh, items: typeof boxes): void => {
    items.forEach(({ piece, part }, slot) => {
      turn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), piece.ry)
      matrix.compose(new THREE.Vector3(piece.at[0], piece.at[1], piece.at[2]), turn, new THREE.Vector3(1, 1, 1))
      spin.copy(axisTurn[part.axis ?? 'y'])
      local.compose(new THREE.Vector3(...part.centre), spin, new THREE.Vector3(...part.size))
      mesh.setMatrixAt(slot, matrix.multiply(local))
      mesh.setColorAt(slot, color.set(part.color))
    })
  }
  const make = (geometry: THREE_NS.BufferGeometry, items: typeof boxes, name: string): THREE_NS.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(items.length, 1))
    mesh.name = name
    mesh.count = items.length
    mesh.receiveShadow = true
    fill(mesh, items)
    return mesh
  }
  const boxMesh = make(boxGeometry, boxes, 'network:surface:boxes')
  const cylinderMesh = make(cylinderGeometry, cylinders, 'network:surface:cylinders')
  group.add(boxMesh, cylinderMesh)
  const hide = (mesh: THREE_NS.InstancedMesh, [start, count]: readonly [number, number]): void => {
    matrix.makeScale(0, 0, 0)
    for (let slot = start; slot < start + count; slot++) mesh.setMatrixAt(slot, matrix)
    mesh.instanceMatrix.needsUpdate = true
  }
  return {
    root: group,
    pieces: list,
    drawCalls: () => [boxMesh, cylinderMesh].filter((mesh) => mesh.count > 0).length,
    remove(id) {
      const range = ranges.get(id)
      if (range === undefined) return
      hide(boxMesh, range.box)
      hide(cylinderMesh, range.cylinder)
    },
    dispose() {
      group.parent?.remove(group)
      for (const mesh of [boxMesh, cylinderMesh]) mesh.dispose()
      for (const item of [boxGeometry, cylinderGeometry, material]) item.dispose()
    },
  }
}
