import * as THREE from 'three'

import type { Silhouette, SilhouettePart } from '../src/silhouettes'

/** Rounded box of the team page: a 4x4x4 grid per face with the edge vertices pushed onto an arc of the given radius. */
function createRoundedBox(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
  if (radius === 0) return new THREE.BoxGeometry(width, height, depth)
  const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const normal = geometry.attributes.normal as THREE.BufferAttribute
  const half = [width / 2, height / 2, depth / 2]
  const p = [0, 0, 0]
  const q = [0, 0, 0]
  const map = (value: number, halfSize: number): number => {
    const a = Math.abs(value)
    return Math.sign(value) * (a <= 0.5 ? a * 2 * (halfSize - radius) : halfSize - radius + (a - 0.5) * 2 * radius)
  }
  for (let index = 0; index < position.count; index++) {
    const source = [position.getX(index), position.getY(index), position.getZ(index)]
    let length = 0
    for (let axis = 0; axis < 3; axis++) {
      p[axis] = map(source[axis] as number, half[axis] as number)
      const clamped = Math.max(-((half[axis] as number) - radius), Math.min((half[axis] as number) - radius, p[axis] as number))
      q[axis] = (p[axis] as number) - clamped
      p[axis] = clamped
      length += (q[axis] as number) ** 2
    }
    length = Math.sqrt(length)
    if (length < 1e-6) {
      q[0] = normal.getX(index)
      q[1] = normal.getY(index)
      q[2] = normal.getZ(index)
    } else for (let axis = 0; axis < 3; axis++) q[axis] = (q[axis] as number) / length
    position.setXYZ(index, (p[0] as number) + (q[0] as number) * radius, (p[1] as number) + (q[1] as number) * radius, (p[2] as number) + (q[2] as number) * radius)
    normal.setXYZ(index, q[0] as number, q[1] as number, q[2] as number)
  }
  return geometry
}

function createPrism(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(0, height)
  shape.lineTo(-width / 2, 0)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

function createObject(part: SilhouettePart): THREE.Object3D {
  switch (part.shape) {
    case 'group': {
      const group = new THREE.Group()
      group.position.set(part.x, part.y, part.z)
      if (part.ry) group.rotation.y = part.ry
      return group
    }
    case 'box': {
      const material = part.emissive ? new THREE.MeshBasicMaterial({ color: part.color }) : new THREE.MeshStandardMaterial({ color: part.color })
      const mesh = new THREE.Mesh(createRoundedBox(part.width, part.height, part.depth, part.radius), material)
      mesh.position.set(part.x, part.y, part.z)
      if (part.ry) mesh.rotation.y = part.ry
      if (part.rz) mesh.rotation.z = part.rz
      return mesh
    }
    case 'prism': {
      const mesh = new THREE.Mesh(createPrism(part.width, part.height, part.depth), new THREE.MeshStandardMaterial({ color: part.color, flatShading: true }))
      mesh.position.set(part.x, part.y, part.z)
      return mesh
    }
    case 'cylinder': {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.segments), new THREE.MeshStandardMaterial({ color: part.color }))
      mesh.position.set(part.x, part.y, part.z)
      return mesh
    }
    case 'line': {
      const geometry = new THREE.BufferGeometry().setFromPoints(part.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: part.color }))
    }
    case 'sign': {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(part.width, part.height), new THREE.MeshBasicMaterial({ transparent: true }))
      mesh.position.set(part.x, part.y, part.z)
      if (part.ry) mesh.rotation.y = part.ry
      return mesh
    }
  }
}

/** Builds the three.js scene of a silhouette the way the team page's helpers do (root group, then the parts in creation order). */
export function buildSilhouetteScene(silhouette: Silhouette): THREE.Group {
  const root = new THREE.Group()
  const objects: THREE.Object3D[] = []
  for (const part of silhouette.parts) {
    const object = createObject(part)
    ;(part.parent < 0 ? root : (objects[part.parent] as THREE.Object3D)).add(object)
    objects.push(object)
  }
  return root
}
