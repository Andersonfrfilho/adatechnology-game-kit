import type * as THREE_NS from 'three'

import type { AnimalRig, AnimalsThreeOptions, Three } from './types'

export type MaterialExtras = Partial<THREE_NS.MeshStandardMaterialParameters>

/** The mulberry32 stream of the page (`rng`): the same numbers for the same seed. */
export const createStream = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The page's `add`: a mesh at a position and rotation under a parent, casting and receiving shadows. */
export const addMesh = (
  THREE: Three,
  parent: THREE_NS.Object3D,
  geometry: THREE_NS.BufferGeometry,
  material: THREE_NS.Material,
  x?: number,
  y?: number,
  z?: number,
  rx?: number,
  ry?: number,
  rz?: number,
): THREE_NS.Mesh => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x || 0, y || 0, z || 0)
  if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** The part builders of the page's `Animal` (`M`, `ball`, `limb`, `joint`, `pivot`), bound to one rig. */
export type RigTools = {
  material(color: number, extras?: MaterialExtras): THREE_NS.MeshStandardMaterial
  ball(parent: THREE_NS.Object3D, radius: number, material: THREE_NS.Material, x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number): THREE_NS.Mesh
  /** A cylinder hanging from the origin; `radius1` is the one the page calls the top, but the geometry takes it as the bottom (kept as the page has it). */
  limb(parent: THREE_NS.Object3D, radius1: number, radius2: number, length: number, material: THREE_NS.Material): THREE_NS.Mesh
  joint(parent: THREE_NS.Object3D, radius: number, material: THREE_NS.Material, x?: number, y?: number, z?: number): THREE_NS.Mesh
  pivot(parent: THREE_NS.Object3D, x: number, y: number, z: number, offset?: THREE_NS.Vector3): THREE_NS.Group
  eyes(head: THREE_NS.Object3D, radius: number, x: number, y: number, z: number): void
}

export const createRigTools = (THREE: Three, rig: AnimalRig): RigTools => {
  const tools: RigTools = {
    material(color, extras) {
      const material = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0, flatShading: false }, extras || {}))
      material.userData.base = material.color.clone()
      rig.materials.push(material)
      return material
    },
    ball(parent, radius, material, x, y, z, sx, sy, sz) {
      const mesh = addMesh(THREE, parent, new THREE.SphereGeometry(radius, 16, 12), material, x, y, z)
      if (sx) mesh.scale.set(sx, sy as number, sz as number)
      return mesh
    },
    limb: (parent, radius1, radius2, length, material) => addMesh(THREE, parent, new THREE.CylinderGeometry(radius2, radius1, length, 14, 1).translate(0, -length / 2, 0), material),
    joint(parent, radius, material, x, y, z) {
      const joint = tools.ball(parent, radius, material, x, y, z)
      joint.userData.joint = 1
      rig.joints.push(joint)
      return joint
    },
    pivot(parent, x, y, z, offset) {
      const group = new THREE.Group()
      group.position.set(x, y, z)
      parent.add(group)
      rig.pivots.push({ group, rest: group.position.clone(), offset: offset || new THREE.Vector3() })
      return group
    },
    eyes(head, radius, x, y, z) {
      const eyeMaterial = tools.material(0x111111, { roughness: 0.25 })
      rig.eyeMaterial = eyeMaterial
      for (const side of [-1, 1]) rig.eyes.push(tools.ball(head, radius, eyeMaterial, side * x, y, z))
    },
  }
  return tools
}

export const createRig = (THREE: Three, species: AnimalRig['species'], options: AnimalsThreeOptions & { phase: number }): AnimalRig => {
  const rig: AnimalRig = {
    species,
    root: new THREE.Group(),
    trunk: new THREE.Group(),
    materials: [],
    joints: [],
    pivots: [],
    legs: [],
    tail: [],
    ears: [],
    infectionParts: [],
    eyes: [],
    wings: [],
    segments: [],
    phase: options.phase,
    size: 1,
    segmentLength: 0,
    segmentCount: 0,
    home: new THREE.Vector3(),
    infected: false,
    dead: false,
    neckAngle: 0,
    headAngle: 0,
    triangles: 0,
  }
  rig.root.add(rig.trunk)
  return rig
}
