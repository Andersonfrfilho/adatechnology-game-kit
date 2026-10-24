import type * as THREE_NS from 'three'
import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { BuiltModel, ModelParts } from './types'

const PI = Math.PI
const BARRELS = 6
// the barrels sit on a circle around the rotor axis
const CLUSTER_RADIUS = 0.03
const BARREL_RADIUS = 0.0078
const BARREL_END = 0.8

/** The six barrels and their clamps in one pivot on the rotor axis: the viewmodel turns `parts.barrels` while the gun fires. */
function buildBarrelCluster(kit: ModelKit, parts: ModelParts, group: BuiltModel['group']): void {
  const { M, cylinderX } = kit
  const barrels = kit.pivot(group, 0, 0, 0)
  parts.barrels = barrels
  const length = BARREL_END - 0.3
  let heated: THREE_NS.Material | undefined
  for (let i = 0; i < BARRELS; i++) {
    const angle = (i * 2 * PI) / BARRELS
    const y = Math.cos(angle) * CLUSTER_RADIUS
    const z = Math.sin(angle) * CLUSTER_RADIUS
    const barrel = cylinderX(barrels, BARREL_RADIUS, length, M.metal, 0.3 + length / 2, y, z, 14)
    // the six barrels heat together: one material of their own, shared
    if (heated) barrel.material = heated
    else heated = heatify(parts.glow, barrel).material as THREE_NS.Material
    cylinderX(barrels, BARREL_RADIUS * 0.55, 0.004, M.hole, BARREL_END + 0.0005, y, z, 10)
  }
  cylinderX(barrels, 0.012, length, M.steel, 0.3 + length / 2, 0, 0, 12)
  for (const x of [0.42, 0.58, 0.74]) cylinderX(barrels, CLUSTER_RADIUS + BARREL_RADIUS * 1.6, 0.014, M.steel, x, 0, 0, 24)
  cylinderX(barrels, CLUSTER_RADIUS + BARREL_RADIUS * 1.8, 0.03, M.dark, BARREL_END - 0.015, 0, 0, 24)
}

/** Housing with the motor, the rotor housing and the two spade grips with the trigger switch of the hand-held gun. */
function buildHousing(kit: ModelKit, parts: ModelParts, group: BuiltModel['group']): void {
  const { M, box, cylinderX, cylinderZ } = kit
  box(group, 0.3, 0.14, 0.15, M.metal, 0.18, 0, 0)
  cylinderX(group, 0.052, 0.12, M.dark, 0.06, 0, 0, 20)
  cylinderX(group, 0.062, 0.2, M.dark, 0.38, 0, 0, 22)
  for (let i = 0; i < 4; i++) cylinderX(group, 0.064, 0.008, M.steel, 0.3 + i * 0.05, 0, 0, 22)
  box(group, 0.04, 0.05, 0.2, M.dark, 0.1, 0.095, 0)
  box(group, 0.2, 0.012, 0.045, M.dark, 0.22, 0.158, 0)
  box(group, 0.012, 0.05, 0.045, M.dark, 0.13, 0.13, 0)
  box(group, 0.012, 0.05, 0.045, M.dark, 0.31, 0.13, 0)
  for (const side of [-1, 1]) {
    box(group, 0.03, 0.03, 0.1, M.poly, 0.06, -0.01, side * 0.14)
    cylinderZ(group, 0.016, 0.07, M.poly, 0.06, -0.01, side * 0.2, 14)
  }
  parts.trigger = box(group, 0.012, 0.02, 0.016, M.dark, 0.1, 0.085, 0.14, 0.3)
  parts.safety = box(group, 0.014, 0.006, 0.01, M.dark, 0.2, 0.073, -0.076, 0.4)
}

/** The belt box on the left, the feed chute that carries the belt to the rotor, the cover over it and the charging piece. */
function buildFeed(kit: ModelKit, parts: ModelParts, group: BuiltModel['group']): void {
  const { M, box, cylinderX } = kit
  const belt = kit.pivot(group, 0.2, -0.13, -0.16)
  parts.belt = belt
  box(belt, 0.16, 0.12, 0.1, M.olive, 0, 0, 0)
  box(belt, 0.162, 0.012, 0.102, M.dark, 0, 0.056, 0)
  for (let i = 0; i < 8; i++) cylinderX(belt, 0.0046, 0.04, M.brass, -0.07 + i * 0.02, 0.075, 0.04, 10)
  box(group, 0.1, 0.03, 0.1, M.metal, 0.22, -0.06, -0.1, 0, 0, 0.5)
  const cover = kit.pivot(group, 0.1, 0.075, 0)
  parts.cover = cover
  box(cover, 0.24, 0.012, 0.15, M.metal, 0.12, 0.006, 0)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.03
  box(bolt, 0.03, 0.012, 0.012, M.steelL, 0.28, 0.02, 0.078)
}

/** The M134 Minigun: a rotary machine gun of six barrels, electric driven, belt fed. A creation of the kit (the team pages have none): there is no page golden, the model has its own. */
export function buildM134(kit: ModelKit): BuiltModel {
  const group = kit.group()
  const parts: ModelParts = { family: 'belt', kick: 0.9, glow: [] }
  buildHousing(kit, parts, group)
  buildBarrelCluster(kit, parts, group)
  buildFeed(kit, parts, group)
  parts.frames = {
    length: BARREL_END,
    barrelY: 0,
    barrelRadius: BARREL_RADIUS,
    receiverStart: 0.06,
    receiverEnd: 0.48,
    receiverHeight: 0.14,
    receiverWidth: 0.15,
    handguardEnd: 0.6,
    magazineX: 0.2,
    gripX: 0.06,
    hasRail: false,
    // the tripod head, where the gun balances (the tripod of the counters joins here too)
    underbarrel: [0.4, -0.1],
  }
  parts.muzzle = kit.mark(group, BARREL_END + 0.01, 0, 0)
  parts.eject = kit.mark(group, 0.3, -0.07, 0.08)
  return { group, parts }
}
