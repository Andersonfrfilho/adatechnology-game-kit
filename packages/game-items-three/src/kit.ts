import type * as THREE_NS from 'three'

type Three = typeof THREE_NS

/** The material tags the team's showcase wears: what `setWear` turns toward its spoiled colour. */
export const WEAR_TAGS = ['metal', 'wood', 'cloth', 'plastic', 'paper', 'food', 'glass'] as const
export type WearTag = (typeof WEAR_TAGS)[number]

/** What a material of the kit remembers so that `setWear` can go back to new: the colour it was made with (as three read it, and as sRGB floats), its tag and its roughness. */
export interface ItemMaterialData {
  base: THREE_NS.Color
  baseRgb: readonly [number, number, number]
  tag: string
  rough: number
}

export type Vec3Tuple = readonly [number, number, number]
type Triple = [number, number, number]

/**
 * The helpers the showcase page defines before its models (`M`, `mesh`, `cyl`, `bx`, `lathe`, `torus`, `extrude`, `G` and the seven material makers), so that the
 * builders ported from the page read the same as the originals. `T` is the three.js the kit was made with; `materials` lists every material it made, in order.
 */
export interface ItemKit {
  readonly T: Three
  readonly materials: THREE_NS.MeshStandardMaterial[]
  M(color: number, tag: string, options?: THREE_NS.MeshStandardMaterialParameters): THREE_NS.MeshStandardMaterial
  mesh(geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, position?: Vec3Tuple, rotation?: Vec3Tuple, scale?: Vec3Tuple): THREE_NS.Mesh
  cyl(radiusTop: number, radiusBottom: number, height: number, segments?: number): THREE_NS.CylinderGeometry
  bx(width: number, height: number, depth: number): THREE_NS.BoxGeometry
  lathe(points: ReadonlyArray<readonly [number, number]>, segments?: number): THREE_NS.LatheGeometry
  torus(radius: number, tube: number, arc?: number): THREE_NS.TorusGeometry
  extrude(points: ReadonlyArray<readonly [number, number]>, depth: number, bevel?: number): THREE_NS.ExtrudeGeometry
  G(...children: THREE_NS.Object3D[]): THREE_NS.Group
  metal(color: number): THREE_NS.MeshStandardMaterial
  wood(color: number): THREE_NS.MeshStandardMaterial
  cloth(color: number): THREE_NS.MeshStandardMaterial
  plastic(color: number): THREE_NS.MeshStandardMaterial
  paper(color: number): THREE_NS.MeshStandardMaterial
  food(color: number): THREE_NS.MeshStandardMaterial
  glass(color: number, opacity: number): THREE_NS.MeshStandardMaterial
}

/** sRGB floats of a colour made from a hex, the way r128 (the team's three.js) stores them: as given, with no conversion. */
const srgbOf = (color: THREE_NS.Color): readonly [number, number, number] => {
  const out = { r: 0, g: 0, b: 0 }
  color.getRGB(out, 'srgb')
  return [out.r, out.g, out.b]
}

/** The helpers of the showcase page on a given three.js; every kit has its own list of materials. */
export function createItemKit(T: Three): ItemKit {
  const materials: THREE_NS.MeshStandardMaterial[] = []
  const M: ItemKit['M'] = (color, tag, options = {}) => {
    const material = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.78, metalness: 0 }, options))
    const base = new T.Color(color)
    const data: ItemMaterialData = { base, baseRgb: srgbOf(base), tag, rough: material.roughness }
    material.userData = data
    materials.push(material)
    return material
  }
  const mesh: ItemKit['mesh'] = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale) => {
    const object = new T.Mesh(geometry, material)
    object.position.set(...(position as Triple))
    object.rotation.set(...(rotation as Triple))
    if (scale) object.scale.set(...(scale as Triple))
    return object
  }
  return {
    T,
    materials,
    M,
    mesh,
    cyl: (radiusTop, radiusBottom, height, segments = 14) => new T.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    bx: (width, height, depth) => new T.BoxGeometry(width, height, depth),
    lathe: (points, segments = 16) => new T.LatheGeometry(points.map(([x, y]) => new T.Vector2(x, y)), segments),
    torus: (radius, tube, arc = Math.PI * 2) => new T.TorusGeometry(radius, tube, 8, 18, arc),
    extrude: (points, depth, bevel = 0.015) => {
      const shape = new T.Shape()
      points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)))
      return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 })
    },
    G: (...children) => {
      const group = new T.Group()
      children.forEach((child) => group.add(child))
      return group
    },
    metal: (color) => M(color, 'metal', { metalness: 0.55, roughness: 0.45 }),
    wood: (color) => M(color, 'wood'),
    cloth: (color) => M(color, 'cloth', { roughness: 0.95 }),
    plastic: (color) => M(color, 'plastic', { roughness: 0.6 }),
    paper: (color) => M(color, 'paper', { roughness: 0.9 }),
    food: (color) => M(color, 'food', { roughness: 0.85 }),
    glass: (color, opacity) => M(color, 'glass', { roughness: 0.15, metalness: 0.1, transparent: true, opacity }),
  }
}
