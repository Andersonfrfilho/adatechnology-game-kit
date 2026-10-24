import type { Three, THREE_NS } from '../three'

import type { WoundMaterials } from './cut'

/** Arsenal `starGeo`: the ragged star of an exit wound, `points` spikes. */
export const starGeometry = (three: Three, random: () => number, radius: number, points: number): THREE_NS.ShapeGeometry => {
  const outline: THREE_NS.Vector2[] = []
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 + (random() - 0.5) * 0.25
    const r = i % 2 ? radius * (0.3 + random() * 0.2) : radius * (0.7 + random() * 0.6)
    outline.push(new three.Vector2(Math.cos(angle) * r, Math.sin(angle) * r))
  }
  return new three.ShapeGeometry(new three.Shape(outline))
}

/** Arsenal `woundDecal`: a bruise with a rim and a dark hole, laid on a segment at a world point with the surface normal. */
export const woundDecal = (three: Three, materials: WoundMaterials, segment: THREE_NS.Object3D, point: THREE_NS.Vector3, normal: THREE_NS.Vector3, radius: number): THREE_NS.Mesh => {
  const decal = new three.Mesh(new three.CircleGeometry(radius * 0.62, 14), materials.bruise)
  segment.add(decal)
  decal.position.copy(segment.worldToLocal(point.clone().addScaledVector(normal, 0.002)))
  decal.lookAt(point.clone().addScaledVector(normal, 1))
  const rim = new three.Mesh(new three.RingGeometry(radius * 0.2, radius * 0.34, 12), materials.wound)
  rim.position.z = 0.0003
  decal.add(rim)
  const hole = new three.Mesh(new three.CircleGeometry(radius * 0.22, 10), materials.hole)
  hole.position.z = 0.0005
  decal.add(hole)
  decal.userData.wound = 1
  return decal
}

/**
 * Arsenal `exitWound`: finds where the bullet left the segment (a ray back along the shot from 0.6 m beyond) and lays a torn star there. Returns the
 * world point and the surface normal, or undefined when the ray missed (the part was too small).
 */
export const exitWound = (
  three: Three,
  materials: WoundMaterials,
  random: () => number,
  segment: THREE_NS.Object3D,
  point: THREE_NS.Vector3,
  direction: THREE_NS.Vector3,
  damage: number,
): { point: THREE_NS.Vector3; normal: THREE_NS.Vector3; radius: number } | undefined => {
  const meshes: THREE_NS.Object3D[] = []
  segment.traverse((object) => {
    if ((object as THREE_NS.Mesh).isMesh && !object.userData.wound && !object.userData.stump) meshes.push(object)
  })
  const raycaster = new three.Raycaster(point.clone().addScaledVector(direction, 0.6), direction.clone().negate(), 0, 0.6)
  const hit = raycaster.intersectObjects(meshes)[0]
  if (!hit?.face) return undefined
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
  const radius = 0.012 + Math.min(0.035, damage * 0.00028)
  const star = new three.Mesh(starGeometry(three, random, radius, 5 + (Math.floor(random() * 3) | 0)), materials.flesh)
  segment.add(star)
  star.position.copy(segment.worldToLocal(hit.point.clone().addScaledVector(normal, 0.002)))
  star.lookAt(hit.point.clone().addScaledVector(normal, 1))
  star.rotateZ(random() * 6)
  star.userData.wound = 1
  const inner = new three.Mesh(starGeometry(three, random, radius * 0.45, 4), materials.hole)
  inner.position.z = 0.0005
  star.add(inner)
  return { point: hit.point.clone(), normal, radius }
}

/**
 * Arsenal `gouge`: a blow of 55 or more tears chunks out (7 from 150, 4 from 55, 2 below), leaves a crater with a flesh rim and, on a limb, a splinter
 * of bone. `fling` receives each chunk with its velocity and spin. Returns the crater.
 */
export const gouge = (
  three: Three,
  materials: WoundMaterials,
  random: () => number,
  segment: THREE_NS.Object3D,
  segmentKind: string,
  point: THREE_NS.Vector3,
  normal: THREE_NS.Vector3,
  direction: THREE_NS.Vector3,
  damage: number,
  fling: (chunk: THREE_NS.Object3D, velocity: THREE_NS.Vector3, spin: THREE_NS.Vector3) => void,
): THREE_NS.Mesh => {
  const count = damage >= 150 ? 7 : damage >= 55 ? 4 : 2
  const chunkMaterials = [materials.flesh, materials.bruise, materials.flesh, materials.bone, materials.meat]
  for (let i = 0; i < count; i++) {
    const size = 0.012 + random() * (damage >= 150 ? 0.04 : 0.022)
    const chunk = new three.Mesh(new three.BoxGeometry(size, size * (0.6 + random() * 0.6), size * (0.6 + random() * 0.6)), chunkMaterials[i % 5])
    chunk.position.copy(point)
    const velocity = direction
      .clone()
      .multiplyScalar(0.8 + random() * 1.5)
      .add(normal.clone().multiplyScalar(0.6 + random()))
      .add(new three.Vector3((random() - 0.5) * 0.8, random() * 0.8, (random() - 0.5) * 0.8))
    fling(chunk, velocity, new three.Vector3(random() * 14, random() * 14, random() * 14))
  }
  const radius = 0.018 + Math.min(0.04, damage * 0.00025)
  const crater = new three.Mesh(new three.CircleGeometry(radius, 12), materials.hole)
  segment.add(crater)
  crater.position.copy(segment.worldToLocal(point.clone().addScaledVector(normal, 0.003)))
  crater.lookAt(point.clone().addScaledVector(normal, 1))
  const rim = new three.Mesh(new three.RingGeometry(radius, radius * 1.5, 12), materials.flesh)
  rim.position.z = -0.0005
  crater.add(rim)
  if (['upperArm', 'forearm', 'thigh', 'shin'].includes(segmentKind) && damage >= 55) {
    const splinter = new three.Mesh(new three.CylinderGeometry(0.006, 0.006, 0.03, 6), materials.bone)
    splinter.rotation.x = Math.PI / 2
    splinter.position.z = -0.004
    crater.add(splinter)
  }
  crater.userData.wound = 1
  return crater
}

/** Arsenal `explodeSeg`: 14 chunks the size of the part, thrown from its centre along the blow. */
export const explodeChunks = (
  three: Three,
  materials: WoundMaterials,
  random: () => number,
  box: THREE_NS.Box3,
  direction: THREE_NS.Vector3,
  fling: (chunk: THREE_NS.Object3D, velocity: THREE_NS.Vector3, spin: THREE_NS.Vector3) => void,
): THREE_NS.Vector3 => {
  const centre = box.getCenter(new three.Vector3())
  const size = box.getSize(new three.Vector3()).length()
  const chunkMaterials = [materials.flesh, materials.bruise, materials.bone, materials.flesh, materials.meat]
  for (let i = 0; i < 14; i++) {
    const chunk = new three.Mesh(new three.BoxGeometry(0.015 + random() * size * 0.18, 0.015 + random() * size * 0.14, 0.015 + random() * size * 0.14), chunkMaterials[i % 5])
    chunk.position.copy(centre).add(new three.Vector3((random() - 0.5) * size * 0.4, (random() - 0.5) * size * 0.4, (random() - 0.5) * size * 0.4))
    const velocity = direction.clone().multiplyScalar(1.5).add(new three.Vector3((random() - 0.5) * 3, random() * 2.5, (random() - 0.5) * 3))
    fling(chunk, velocity, new three.Vector3(random() * 15, random() * 15, random() * 15))
  }
  return centre
}
