import { heatify } from './kit'
import type { ModelKit } from './kit'
import type * as THREE_NS from 'three'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The Winchester 1887 as the reference photo shows it: metres in the model's frame, x from the butt to the muzzle, y up, z to the right, the barrel on y = 0.

const RECEIVER_START = 0.3
const RECEIVER_END = 0.49
const RECEIVER_HEIGHT = 0.1
const FOREND_END = 0.77

/** Lever-action shotgun: the tall blued receiver over the big lever loop, a thick barrel with the magazine tube under it, wood forend and one-piece wood stock. */
export function buildLeverShotgun(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, cylinderX, sphere, cylinderZ } = kit
  const group = kit.group()
  const length = (options.L ?? 0) / 1000
  const parts: ModelParts = { family: 'lever', glow: [] }
  const radius = options.br ?? 0.012
  const { THREE } = kit
  const middle = (RECEIVER_START + RECEIVER_END) / 2
  const profile = (points: readonly (readonly [number, number])[], depth: number, material: typeof M.wood, holes: readonly THREE_NS.Path[] = []): THREE_NS.Mesh => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
    shape.holes.push(...holes)
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 24 })
    geometry.translate(0, 0, -depth / 2)
    return kit.torus(group, geometry as unknown as THREE_NS.TorusGeometry, material, 0, 0, 0)
  }
  const barrelLength = length - RECEIVER_END
  heatify(parts.glow, cylinderX(group, radius, barrelLength, M.metal, RECEIVER_END + barrelLength / 2, 0, 0, 20))
  cylinderX(group, radius * 0.55, 0.004, M.hole, length + 0.0005, 0, 0, 12)
  sphere(group, 0.0028, M.white, length - 0.012, radius + 0.002, 0, 1)
  const tubeEnd = RECEIVER_END + barrelLength * 0.68
  cylinderX(group, 0.009, tubeEnd - RECEIVER_END, M.metal, (tubeEnd + RECEIVER_END) / 2, -0.04, 0, 14)
  cylinderX(group, 0.0105, 0.012, M.dark, tubeEnd, -0.04, 0, 14)
  box(group, 0.012, 0.062, 0.03, M.metal, tubeEnd - 0.03, -0.02, 0)
  box(group, FOREND_END - RECEIVER_END, 0.052, 0.044, M.wood, (FOREND_END + RECEIVER_END) / 2, -0.0215, 0)
  profile([[0.49, -0.07], [0.49, 0.013], [0.42, 0.015], [0.385, 0.028], [0.35, 0.036], [0.318, 0.022], [0.3, -0.01], [0.31, -0.09], [0.4, -0.097]], 0.036, M.steel)
  box(group, 0.1, 0.05, 0.004, M.metal, middle + 0.02, -0.04, 0.0192)
  cylinderZ(group, 0.005, 0.04, M.steelL, middle - 0.03, -0.05, 0, 10)
  box(group, 0.012, 0.03, 0.01, M.dark, 0.325, 0.048, 0, -0.5)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(group, 0.05, 0.03, 0.004, M.hole, middle + 0.04, -0.015, 0.0186)
  box(bolt, 0.044, 0.018, 0.006, M.steelL, middle + 0.04, -0.015, 0.0186)
  profile([[0, -0.07], [0.22, -0.066], [0.28, -0.04], [0.32, -0.006], [0.345, -0.006], [0.345, -0.09], [0.31, -0.1], [0.27, -0.125], [0.22, -0.148], [0.02, -0.21], [0, -0.205]], 0.036, M.wood)
  box(group, 0.014, 0.142, 0.04, M.rubber, 0.004, -0.138, 0, 0.05)
  parts.trigger = box(group, 0.004, 0.018, 0.004, M.dark, 0.37, -0.1, 0, 0.1)
  const lever = kit.pivot(group, 0.4, -0.09, 0)
  parts.lever = lever
  const hole = new THREE.Path()
  hole.absellipse(-0.065, -0.045, 0.062, 0.034, 0, Math.PI * 2, false, 0)
  const outer = new THREE.Shape()
  outer.absellipse(-0.065, -0.045, 0.092, 0.058, 0, Math.PI * 2, false, 0)
  outer.holes.push(hole)
  const ring = new THREE.ExtrudeGeometry(outer, { depth: 0.014, bevelEnabled: false, curveSegments: 28 })
  ring.translate(0, 0, -0.007)
  kit.torus(lever, ring as unknown as THREE_NS.TorusGeometry, M.metal, 0, 0, 0)
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, middle + 0.02, 0.012, 0.01)
  parts.loadPort = kit.mark(group, middle + 0.03, -0.035, 0.02)
  parts.topLoad = parts.eject
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: radius,
    receiverStart: RECEIVER_START,
    receiverEnd: RECEIVER_END,
    receiverHeight: RECEIVER_HEIGHT,
    receiverWidth: 0.034,
    handguardEnd: FOREND_END,
    magazineX: middle,
    gripX: 0.3,
    hasRail: false,
  }
  return { group, parts }
}
