import type * as THREE_NS from 'three'

import type { DistributionSpec } from '@adatechnology/game-urban'
import { shapeGeometries } from '@adatechnology/game-shapes-three'

import type { WorldBox, WorldCylinder, WorldMast } from './pieces'

type Three = typeof THREE_NS

/** Sides of the cylinders: the transformer tank and the reserve coil. */
const CYLINDER_SEGMENTS = 10

export type DrawnPieces = { readonly meshes: readonly THREE_NS.InstancedMesh[]; dispose(): void }

/** The masts of each spec (one instanced mesh per spec), the hardware boxes, and the cylinders, each instanced with its colour. */
export function drawPieces(THREE: Three, { masts, boxes, cylinders, specOf }: { readonly masts: readonly WorldMast[]; readonly boxes: readonly WorldBox[]; readonly cylinders: readonly WorldCylinder[]; readonly specOf: (id: string) => DistributionSpec }): DrawnPieces {
  const T = shapeGeometries(THREE)
  const owned: Array<{ dispose(): void }> = []
  const meshes: THREE_NS.InstancedMesh[] = []
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const axis = new THREE.Vector3()
  const color = new THREE.Color()
  const instanced = (geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, count: number, name: string): THREE_NS.InstancedMesh => {
    owned.push(geometry, material)
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.push(mesh)
    return mesh
  }
  for (const specId of new Set(masts.map((mast) => mast.specId))) {
    const { mast } = specOf(specId)
    // a tapered square post with its faces to the road and along the line (a 4-sided cylinder turned 45°), its foot on the ground
    const geometry = new T.CylinderGeometry(mast.radiusTop, mast.radiusBottom, mast.height, mast.segments ?? 4).rotateY(Math.PI / 4).translate(0, mast.height / 2, 0)
    const own = masts.filter((item) => item.specId === specId)
    const mesh = instanced(geometry, new THREE.MeshStandardMaterial({ color: mast.color, roughness: 0.9 }), own.length, `network:masts:${specId}`)
    own.forEach((item, index) => mesh.setMatrixAt(index, matrix.compose(position.set(item.x, item.y, item.z), quaternion.setFromAxisAngle(up, item.ry), scale.set(1, 1, 1))))
  }
  if (boxes.length > 0) {
    const mesh = instanced(new T.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), boxes.length, 'network:hardware')
    boxes.forEach((box, index) => {
      mesh.setMatrixAt(index, matrix.compose(position.set(box.x, box.y, box.z), quaternion.setFromAxisAngle(up, box.ry), scale.set(box.width, box.height, box.depth)))
      mesh.setColorAt(index, color.set(box.color))
    })
  }
  if (cylinders.length > 0) {
    const mesh = instanced(new T.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.3 }), cylinders.length, 'network:cylinders')
    cylinders.forEach((cylinder, index) => {
      quaternion.setFromUnitVectors(up, axis.set(cylinder.axis[0], cylinder.axis[1], cylinder.axis[2]).normalize())
      mesh.setMatrixAt(index, matrix.compose(position.set(cylinder.x, cylinder.y, cylinder.z), quaternion, scale.set(cylinder.radius, cylinder.height, cylinder.radius)))
      mesh.setColorAt(index, color.set(cylinder.color))
    })
  }
  return {
    meshes,
    dispose() {
      for (const mesh of meshes) mesh.dispose()
      for (const item of owned.splice(0)) item.dispose()
    },
  }
}
