import { buttpad } from './details'
import { heatify } from './kit'
import type * as THREE_NS from 'three'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The FN PS90 as the reference photo shows it (assets/weapon-references.json): metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the barrel.

const WIDTH = 0.046
const BEVEL = 0.005

type Material = THREE_NS.Material
type Point = readonly [number, number]

// the outline of the stock seen from the right, then the thumbhole and the trigger guard cut through it
const BODY_OUTLINE: readonly Point[] = [
  [0.017, -0.078], [0.03, -0.09], [0.07, -0.097], [0.13, -0.1], [0.3, -0.1], [0.395, -0.101], [0.43, -0.092], [0.452, -0.07], [0.457, -0.04], [0.457, 0.012], [0.44, 0.02],
  [0.19, 0.02], [0.155, 0.02], [0.15, 0.038], [0.04, 0.04], [0.02, 0.034], [0.015, 0.02], [0.015, -0.06],
]
const THUMBHOLE: readonly Point[] = [[0.316, -0.035], [0.3, -0.011], [0.25, -0.003], [0.205, -0.017], [0.19, -0.055], [0.205, -0.089], [0.25, -0.096], [0.3, -0.089], [0.318, -0.06]]
const TRIGGER_GUARD: readonly Point[] = [[0.342, -0.04], [0.352, -0.013], [0.376, -0.007], [0.4, -0.017], [0.409, -0.045], [0.393, -0.067], [0.36, -0.067]]
const OPTIC_HOUSING: readonly Point[] = [[0.289, 0.05], [0.289, 0.082], [0.31, 0.09], [0.4, 0.1], [0.435, 0.104], [0.465, 0.104], [0.468, 0.098], [0.468, 0.05]]

/** A closed curve through the points (Catmull-Rom), sampled into a polygon: the extrusion takes straight edges. */
function smoothClosed(points: readonly Point[], samples: number): Point[] {
  const at = (index: number): Point => points[(index + points.length) % points.length] as Point
  const out: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let step = 0; step < samples; step++) {
      const t = step / samples
      const blend = (axis: 0 | 1): number => 0.5 * (2 * p1[axis] + (p2[axis] - p0[axis]) * t + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t * t + (3 * p1[axis] - p0[axis] - 3 * p2[axis] + p3[axis]) * t * t * t)
      out.push([blend(0), blend(1)])
    }
  }
  return out
}

/** One flat profile pushed through the width of the weapon, with its holes and softened edges. */
function extrudeProfile(kit: ModelKit, parent: Parent, outline: readonly Point[], holes: readonly (readonly Point[])[], width: number, material: Material): void {
  const { THREE } = kit
  const toVector = ([x, y]: Point): THREE_NS.Vector2 => new THREE.Vector2(x, y)
  const shape = new THREE.Shape(outline.map(toVector))
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(toVector)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2 })
  geometry.translate(0, 0, -(width - 2 * BEVEL) / 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
}

/** The one-piece olive body with the thumbhole and the trigger guard cut through it, and the butt pad. */
function buildBody(kit: ModelKit, group: Parent): void {
  extrudeProfile(kit, group, BODY_OUTLINE, [smoothClosed(THUMBHOLE, 5), smoothClosed(TRIGGER_GUARD, 5)], WIDTH, kit.M.olive)
  buttpad(kit, group, 0.006, -0.0225, 0.108, WIDTH)
}

/** The barrel under the magazine, its mount in the front wall and the flash hider. */
function buildBarrel(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  cylinderX(group, 0.014, 0.05, M.dark, 0.455, 0, 0, 18)
  heatify(parts.glow, cylinderX(group, 0.0065, 0.407, M.metal, length - 0.2035, 0, 0, 14))
  cylinderX(group, 0.0075, 0.034, M.dark, length - 0.017, 0, 0, 14)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4
    box(group, 0.02, 0.002, 0.003, M.hole, length - 0.02, Math.cos(angle) * 0.0074, Math.sin(angle) * 0.0074, 0, 0, angle)
  }
  cylinderX(group, 0.0035, 0.004, M.hole, length + 0.0005, 0, 0, 10)
}

/** The magazine lying on top, the smoked body seen through with the rounds across it, and the housing of the integrated optic over it. */
function buildTop(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box, cylinderX, cylinderZ } = kit
  const magazine = kit.pivot(group, 0.295, 0.036, 0)
  parts.mag = magazine
  parts.magDir = 1
  parts.magDrop = 0.08
  box(magazine, 0.28, 0.028, 0.05, M.glass, 0, 0, 0)
  box(magazine, 0.285, 0.004, 0.052, M.dark, 0, 0.0145, 0)
  for (let i = 0; i < 12; i++) cylinderZ(magazine, 0.0045, 0.04, M.brass, -0.121 + i * 0.022, 0, 0, 8)
  extrudeProfile(kit, group, OPTIC_HOUSING, [], 0.042, M.dark)
  cylinderX(group, 0.017, 0.004, M.lens, 0.288, 0.07, 0, 18)
}

/** The FN PS90: the semi-automatic civilian P90, with the 407 mm barrel that sticks out of the body, the thumbhole stock and the translucent magazine on top. */
export function buildPs90(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box } = kit
  const group = kit.group()
  const length = (options.L ?? 668) / 1000
  const parts: ModelParts = { family: 'p90', stroke: 0.04, kick: 0.6, glow: [] }
  buildBody(kit, group)
  buildBarrel(kit, group, parts, length)
  buildTop(kit, group, parts)
  const grip = kit.pivot(group, 0.32, -0.04, 0.0085)
  parts.grip = grip
  parts.trigger = box(group, 0.004, 0.018, 0.006, M.dark, 0.345, -0.02, 0, 0.2)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(bolt, 0.02, 0.01, 0.012, M.dark, 0.2, 0.045, 0.026)
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: 0.0055,
    receiverStart: 0.15,
    receiverEnd: 0.4,
    receiverHeight: 0.14,
    receiverWidth: WIDTH,
    handguardEnd: 0.466,
    magazineX: 0.295,
    gripX: 0.32,
    hasRail: false,
  }
  parts.muzzle = kit.mark(group, length, 0, 0)
  parts.eject = kit.mark(group, 0.12, -0.092, 0)
  return { group, parts }
}
