import { shapeGeometries } from '@adatechnology/game-shapes-three'
import type * as THREE_NS from 'three'
import { createRoundedBoxGeometry } from './rounded-box'

type Three = typeof THREE_NS
type Material = THREE_NS.Material
export type Parent = THREE_NS.Object3D

const PI = Math.PI

const createMaterials = (THREE: Three) => {
  const standard = (color: number, roughness = 0.7, metalness = 0.2, extra: THREE_NS.MeshStandardMaterialParameters = {}): THREE_NS.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
  const basic = (color: number, extra: THREE_NS.MeshBasicMaterialParameters = {}): THREE_NS.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, ...extra })
  const additive = { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }
  return {
    metal: standard(0x34373a, 0.42, 0.75),
    steel: standard(0x6c6f72, 0.32, 0.85),
    steelL: standard(0x8a8d90, 0.28, 0.9),
    dark: standard(0x1a1c1d, 0.55, 0.5),
    poly: standard(0x242622, 0.8, 0.05),
    olive: standard(0x4b5231, 0.8, 0.05),
    tan: standard(0x9c8a63, 0.8, 0.05),
    wood: standard(0x4a2c17, 0.55, 0),
    woodL: standard(0x5e3a1f, 0.55, 0),
    brass: standard(0xc39a45, 0.28, 0.9),
    copper: standard(0xb06a3b, 0.3, 0.85),
    lead: standard(0x6d6f73, 0.5, 0.5),
    shell: standard(0xa3271c, 0.5, 0.05),
    glass: standard(0x7fa3a8, 0.05, 0.1, { transparent: true, opacity: 0.42 }),
    lens: standard(0x23465a, 0.05, 0.3, { transparent: true, opacity: 0.9, emissive: 0x061820 }),
    rubber: standard(0x151515, 0.85, 0),
    white: standard(0xcfc8b4, 0.8, 0),
    hole: standard(0x080807, 1, 0),
    bake: standard(0x5a3220, 0.55, 0),
    rust: standard(0x6b3a1e, 0.95, 0.3),
    rustD: standard(0x4a2a18, 0.95, 0.25),
    worn: standard(0x55585a, 0.6, 0.6),
    fire: basic(0xff7a22),
    fire2: basic(0xffcf5a),
    flashA: basic(0xffb347, additive),
    flashB: basic(0xfff1c0, additive),
    smokeP: standard(0x8a8a86, 1, 0, { transparent: true, opacity: 0.35, depthWrite: false }),
    /** Launcher paints. */
    yellow: standard(0xb08f22, 0.6, 0),
    red: standard(0x8e1c14, 0.45, 0.1),
    redPaint: standard(0xa3231a, 0.35, 0.2),
    tape: standard(0x8a8c88, 0.9, 0),
    pipe: standard(0x9a5a32, 0.35, 0.8),
    green: standard(0x3a4428, 0.75, 0.05),
    /** Magazine finishes named by the options. */
    bakelite: standard(0x6a2e1c, 0.6, 0),
    polyMag: standard(0x2a2a26, 0.85, 0),
  }
}
export type ModelMaterials = ReturnType<typeof createMaterials>

/**
 * The gallery's primitives on the host's three.js. Each takes the parent first and the position last as the page does (`box(parent, w, h, d, material, x, y, z, rz, ry, rx)`),
 * so that the builders read like the originals. `roundness` is the page's `RF`: how round the next boxes are, `null` for the default.
 */
export interface ModelKit {
  readonly THREE: Three
  readonly M: ModelMaterials
  roundness: number | null
  group(): THREE_NS.Group
  box(parent: Parent, w: number, h: number, d: number, material: Material, x: number, y: number, z: number, rz?: number, ry?: number, rx?: number): THREE_NS.Mesh
  /** Cylinders along x, y and z. `radiusEnd` makes a cone. */
  cylinderX(parent: Parent, radius: number, length: number, material: Material, x: number, y: number, z: number, segments?: number, radiusEnd?: number): THREE_NS.Mesh
  cylinderY(parent: Parent, radius: number, height: number, material: Material, x: number, y: number, z: number, segments?: number, radiusEnd?: number): THREE_NS.Mesh
  cylinderZ(parent: Parent, radius: number, length: number, material: Material, x: number, y: number, z: number, segments?: number): THREE_NS.Mesh
  sphere(parent: Parent, radius: number, material: Material, x: number, y: number, z: number, detail?: number): THREE_NS.Mesh
  torus(parent: Parent, geometry: THREE_NS.TorusGeometry, material: Material, x: number, y: number, z: number): THREE_NS.Mesh
  mark(parent: Parent, x: number, y: number, z: number): THREE_NS.Object3D
  pivot(parent: Parent, x?: number, y?: number, z?: number): THREE_NS.Group
}

const kits = new WeakMap<Three, ModelKit>()

/**
 * One kit per three.js namespace: the materials and the geometry cache are shared by every model built with it. The kit's `THREE` is
 * `shapeGeometries(host)`: box, cylinder, cone, sphere and torus come from game-shapes (the same bytes, the same classes); the rest is the host's.
 */
export function modelKit(host: Three): ModelKit {
  const cached = kits.get(host)
  if (cached) return cached
  const THREE = shapeGeometries(host)
  const geometries = new Map<string, THREE_NS.BufferGeometry>()
  const shadowed = <TObject extends THREE_NS.Mesh>(mesh: TObject): TObject => {
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  const place = (parent: Parent, mesh: THREE_NS.Mesh, x: number, y: number, z: number): THREE_NS.Mesh => {
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const kit: ModelKit = {
    THREE,
    M: createMaterials(THREE),
    roundness: null,
    group: () => new THREE.Group(),
    box(parent, w, h, d, material, x, y, z, rz = 0, ry = 0, rx = 0) {
      const radius = Math.min(w, h, d) * (kit.roundness ?? 0.2)
      const key = `${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)},${radius.toFixed(5)}`
      let geometry = geometries.get(key)
      if (!geometry) {
        geometry = radius > 0.00025 ? createRoundedBoxGeometry(THREE, w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d)
        geometries.set(key, geometry)
      }
      const mesh = place(parent, shadowed(new THREE.Mesh(geometry, material)), x, y, z)
      mesh.rotation.set(rx, ry, rz)
      return mesh
    },
    cylinderX(parent, radius, length, material, x, y, z, segments = 16, radiusEnd) {
      const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd ?? radius, radius, length, segments), material))
      mesh.rotation.z = -PI / 2
      return place(parent, mesh, x, y, z)
    },
    cylinderY(parent, radius, height, material, x, y, z, segments = 16, radiusEnd) {
      return place(parent, shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd ?? radius, radius, height, segments), material)), x, y, z)
    },
    cylinderZ(parent, radius, length, material, x, y, z, segments = 16) {
      const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material))
      mesh.rotation.x = PI / 2
      return place(parent, mesh, x, y, z)
    },
    sphere(parent, radius, material, x, y, z, detail = 1) {
      return place(parent, shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material)), x, y, z)
    },
    torus: (parent, geometry, material, x, y, z) => place(parent, shadowed(new THREE.Mesh(geometry, material)), x, y, z),
    mark(parent, x, y, z) {
      const object = new THREE.Object3D()
      object.position.set(x, y, z)
      parent.add(object)
      return object
    },
    pivot(parent, x = 0, y = 0, z = 0) {
      const group = new THREE.Group()
      group.position.set(x, y, z)
      parent.add(group)
      return group
    },
  }
  kits.set(host, kit)
  return kit
}

/** Gives the mesh its own copy of the material, and lists it among the parts that glow with heat. */
export function heatify<TMesh extends THREE_NS.Mesh>(glow: THREE_NS.Mesh[], mesh: TMesh): TMesh {
  mesh.material = (mesh.material as Material).clone()
  glow.push(mesh)
  return mesh
}
