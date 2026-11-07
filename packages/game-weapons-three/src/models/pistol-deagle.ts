import type * as THREE_NS from 'three'
import type { ModelKit, Parent } from './kit'
import { heatify } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

type Material = THREE_NS.Material

// The Desert Eagle Mark XIX as the reference photo shows it (Wikimedia Commons, Desert-Eagle-p1030134.jpg): 270 mm long, 150 mm tall, 32 mm wide. One flat-topped upper
// from the rear to the muzzle with the rail on top (the slide behind, the fixed barrel ahead, the same steel, only a seam between them), the barrel's triangular nose on the
// front face, the frame under it to the muzzle, the large squared trigger guard joined to the frame and to the grip, the ring hammer and the thick grip raked back about 18°.
const SLIDE_HEIGHT = 0.036
const WIDTH = 0.032
const FRAME_HEIGHT = 0.015
const FRAME_BOTTOM = -SLIDE_HEIGHT / 2 - FRAME_HEIGHT
const GRIP = { angle: -0.314, depth: 0.052, width: 0.034, length: 0.1, rearX: 0.014 } as const
const GUARD = { drop: 0.038, front: 0.064, bar: 0.0065, depth: 0.011 } as const
const SLIDE_SHARE = 0.55

/** A flat piece cut from an outline in (x, y), with an optional hole, `depth` thick and centred on z. */
const plate = (kit: ModelKit, parent: Parent, outline: readonly (readonly [number, number])[], hole: readonly (readonly [number, number])[] | null, depth: number, material: Material): THREE_NS.Mesh => {
  const { THREE } = kit
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)))
  if (hole) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1 })
  geometry.translate(0, 0, -depth / 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** The upper: the slide (which recoils) behind and the barrel block ahead, one silhouette; the rail, the serrations, the port and the sights. Returns the height of the bore. */
const buildUpper = (kit: ModelKit, group: THREE_NS.Group, slide: THREE_NS.Group, parts: ModelParts, length: number, metal: Material): number => {
  const { M, box, cylinderX } = kit
  const slideLength = length * SLIDE_SHARE
  const barrelLength = length - slideLength
  kit.roundness = 0.06
  box(slide, slideLength, SLIDE_HEIGHT, WIDTH, metal, slideLength / 2, 0, 0)
  const barrel = heatify(parts.glow ?? [], box(group, barrelLength, SLIDE_HEIGHT, WIDTH, metal, slideLength + barrelLength / 2, 0, 0))
  barrel.name = 'barrel'
  kit.roundness = null
  box(group, 0.0012, SLIDE_HEIGHT * 0.9, WIDTH + 0.0004, M.dark, slideLength, 0, 0)
  for (let i = 0; i < 9; i++) box(slide, 0.0022, SLIDE_HEIGHT * 0.66, WIDTH + 0.0012, M.dark, 0.008 + i * 0.0048, -0.003, 0)
  box(slide, length * 0.08, 0.003, WIDTH * 0.5, M.hole, length * 0.42, SLIDE_HEIGHT / 2, WIDTH * 0.12)
  box(slide, 0.007, 0.006, 0.014, M.dark, 0.008, SLIDE_HEIGHT / 2 + 0.003, 0)
  box(slide, 0.003, 0.002, 0.004, M.hole, 0.008, SLIDE_HEIGHT / 2 + 0.005, 0)
  box(group, barrelLength * 0.9, 0.004, WIDTH * 0.42, metal, slideLength + barrelLength * 0.5, SLIDE_HEIGHT / 2 + 0.002, 0)
  for (let i = 0; i < 7; i++) box(group, 0.004, 0.0015, WIDTH * 0.43, M.hole, slideLength + 0.01 + i * 0.013, SLIDE_HEIGHT / 2 + 0.004, 0)
  box(group, 0.004, 0.006, 0.004, M.dark, length - 0.006, SLIDE_HEIGHT / 2 + 0.006, 0)
  // the triangular nose of the barrel on the front face: narrow at the rail, wide at the frame
  const nose = plate(kit, group, [[-WIDTH / 2, -SLIDE_HEIGHT / 2 + 0.002], [WIDTH / 2, -SLIDE_HEIGHT / 2 + 0.002], [WIDTH * 0.16, SLIDE_HEIGHT / 2 - 0.002], [-WIDTH * 0.16, SLIDE_HEIGHT / 2 - 0.002]], null, 0.003, metal)
  nose.rotation.y = Math.PI / 2
  nose.position.set(length + 0.0015, 0, 0)
  const boreY = -SLIDE_HEIGHT * 0.12
  cylinderX(group, 0.0064, 0.004, M.hole, length + 0.003, boreY, 0, 14)
  return boreY
}

/** The grip raked back, with the steel frame inside the wrap-around rubber, the magazine flush with its foot. Returns the x of the front strap at a height. */
const buildGrip = (kit: ModelKit, group: THREE_NS.Group, parts: ModelParts, metal: Material): ((y: number) => number) => {
  const { M, box } = kit
  const { angle, depth, width, length } = GRIP
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const topY = FRAME_BOTTOM + 0.006
  const centerX = GRIP.rearX + (depth / 2) * cos + (length / 2) * sin
  const centerY = topY - (length / 2) * cos + (depth / 2) * sin
  const grip = kit.pivot(group, centerX, centerY, 0)
  grip.rotation.z = angle
  parts.grip = grip
  kit.roundness = 0.22
  box(grip, depth, length, width * 0.86, metal, 0, 0, 0)
  box(grip, depth * 0.86, length * 0.84, width, M.rubber, -0.002, 0.002, 0)
  kit.roundness = null
  for (let i = 0; i < 8; i++) box(grip, depth * 0.66, 0.002, width + 0.0012, M.dark, -0.003, -length * 0.36 + i * 0.0105, 0)
  const magazine = kit.pivot(grip)
  parts.mag = magazine
  parts.magDrop = length * 1.15
  box(magazine, depth * 0.62, length * 0.94, width * 0.66, M.dark, 0.002, -0.004, 0)
  box(magazine, depth * 0.98, 0.006, width * 0.9, metal, 0, -length / 2 + 0.003, 0)
  const frontTopX = centerX + (depth / 2) * cos - (length / 2) * sin
  const frontTopY = centerY + (depth / 2) * sin + (length / 2) * cos
  return (y) => frontTopX + (frontTopY - y) * Math.tan(angle)
}

/** The squared trigger guard as one piece of the frame: its back runs down the front strap, its front rises into the frame, the trigger hangs from the frame inside it. */
const buildGuard = (kit: ModelKit, group: THREE_NS.Group, frontStrapAt: (y: number) => number, metal: Material): number => {
  const top = FRAME_BOTTOM + 0.002
  const bottom = FRAME_BOTTOM - GUARD.drop
  const backTop = frontStrapAt(top) - 0.004
  const backBottom = frontStrapAt(bottom) - 0.004
  const front = backTop + GUARD.front
  const bar = GUARD.bar
  const corner = 0.008
  const outline: Array<[number, number]> = [
    [backTop, top],
    [backBottom, bottom],
    [front - corner, bottom],
    [front, bottom + corner],
    [front + 0.002, top],
  ]
  const hole: Array<[number, number]> = [
    [backTop + bar + 0.002, top - 0.002],
    [front - bar + 0.001, top - 0.002],
    [front - bar, bottom + bar + corner * 0.6],
    [front - bar - corner * 0.6, bottom + bar],
    [backBottom + bar + 0.004, bottom + bar],
  ]
  plate(kit, group, outline, hole, GUARD.depth, metal)
  return bottom
}

/** The Desert Eagle (`deagle` style) drawn from its photo instead of the generic pistol: the anchors (`slide`, `grip`, `mag`, `trigger`, `hammer`, `muzzle`, `eject`) are the pistol's. */
export function buildDeagle(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, torus, THREE } = kit
  const length = ((options.L ?? 0) / 1000) * 0.97
  const metal = options.steel ? M.steel : options.stain ? M.steelL : M.metal
  const group = kit.group()
  const parts: ModelParts = { family: 'pistol', kick: 1.8, glow: [] }
  const slide = kit.pivot(group)
  parts.slide = slide
  parts.stroke = length * 0.12
  const boreY = buildUpper(kit, group, slide, parts, length, metal)
  kit.roundness = 0.1
  box(group, length * 0.95, FRAME_HEIGHT, WIDTH * 0.94, metal, length * 0.5 - 0.002, -SLIDE_HEIGHT / 2 - FRAME_HEIGHT / 2, 0)
  kit.roundness = null
  box(group, length * 0.3, 0.003, WIDTH * 0.94 + 0.001, M.dark, length * 0.72, -SLIDE_HEIGHT / 2 - FRAME_HEIGHT * 0.6, 0)
  box(group, 0.026, 0.009, WIDTH * 0.9, metal, -0.002, FRAME_BOTTOM + 0.004, 0, 0.3)
  box(group, 0.016, 0.005, 0.004, M.dark, length * 0.36, -SLIDE_HEIGHT / 2 - 0.005, -WIDTH / 2 - 0.0014)
  const frontStrapAt = buildGrip(kit, group, parts, metal)
  buildGuard(kit, group, frontStrapAt, metal)
  const triggerX = frontStrapAt(FRAME_BOTTOM) + 0.02
  parts.trigger = box(group, 0.006, 0.026, 0.007, M.steel, triggerX, FRAME_BOTTOM - 0.008, 0, 0.28)
  const hammer = kit.pivot(group, 0.002, SLIDE_HEIGHT * 0.05, 0)
  parts.hammer = hammer
  box(hammer, 0.012, 0.02, 0.01, M.dark, -0.004, 0.004, 0, 0.35)
  const ring = torus(hammer, new THREE.TorusGeometry(0.0068, 0.0024, 8, 16), M.dark, -0.01, 0.014, 0)
  ring.scale.z = 2
  parts.safety = box(slide, 0.014, 0.008, 0.004, M.dark, 0.02, SLIDE_HEIGHT * 0.1, -WIDTH / 2 - 0.002, 0.2)
  box(slide, 0.014, 0.008, 0.004, M.dark, 0.02, SLIDE_HEIGHT * 0.1, WIDTH / 2 + 0.002, 0.2)
  parts.muzzle = kit.mark(group, length + 0.006, boreY, 0)
  parts.eject = kit.mark(group, length * 0.42, SLIDE_HEIGHT / 2, WIDTH * 0.25)
  return { group, parts }
}
