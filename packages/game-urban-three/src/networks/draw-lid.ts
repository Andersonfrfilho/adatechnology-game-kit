import type * as THREE_NS from 'three'

import { markKitOrigin } from '@adatechnology/game-contracts'
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import { COVER_PLATE_PART } from '@adatechnology/game-urban/networks'
import type { SurfacePiece } from '@adatechnology/game-urban/networks'

import { partsOf } from './surface-parts'

type Three = typeof THREE_NS

/** Sides of a round lid. */
const CYLINDER_SEGMENTS = 14

export type DrawnLid = {
  readonly root: THREE_NS.Object3D
  dispose(): void
}

/**
 * The lid of a cover as a body of its own: the plate and its ribs from the piece's own parts (the frame of a cover stays in the ground; a grate goes whole), with the plate's foot at the origin of the
 * group, so the group sits where the destruction world's plate of `coverBodyOf` does (its part centred half its height up). A thrown lid is drawn this way and moves as a piece.
 */
export function drawLid(THREE: Three, piece: SurfacePiece): DrawnLid {
  const T = shapeGeometries(THREE)
  // a grate goes whole, its frame the plate and the bars on it (the dark slot under them is the hole it leaves, not a part of the lid); a cover leaves its frame in the ground: the lid is the parts over it
  const [frame, second, ...over] = partsOf(piece)
  const [lid, ...ribs] = piece.kind === 'inlet_grate' ? [frame, ...over] : second === undefined ? [] : [second, ...over]
  if (lid === undefined) throw new Error(`game-urban-three: "${piece.id}" has no lid to draw`)
  const lift = lid.size[1] / 2 - lid.centre[1]
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-urban-three', kind: 'network-lid' })
  group.name = `network:lid:${piece.id}`
  const geometries = { box: new T.BoxGeometry(1, 1, 1), cylinder: new T.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS) }
  const materials = new Map<number, THREE_NS.MeshStandardMaterial>()
  const axisTurn: Record<'x' | 'y' | 'z', readonly [number, number, number]> = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] }
  for (const part of [lid, ...ribs]) {
    let material = materials.get(part.color)
    if (material === undefined) materials.set(part.color, (material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7, metalness: 0.2 })))
    const mesh = new THREE.Mesh(geometries[part.shape], material)
    mesh.position.set(part.centre[0], part.centre[1] + lift, part.centre[2])
    mesh.scale.set(part.size[0], part.size[1], part.size[2])
    const [turnX, turnY, turnZ] = axisTurn[part.axis ?? 'y']
    mesh.rotation.set(turnX, turnY, turnZ)
    mesh.userData.destructionPart = COVER_PLATE_PART
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return {
    root: group,
    dispose() {
      group.parent?.remove(group)
      for (const geometry of Object.values(geometries)) geometry.dispose()
      for (const material of materials.values()) material.dispose()
    },
  }
}
