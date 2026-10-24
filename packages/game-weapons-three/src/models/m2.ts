import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { BuiltModel, ModelParts } from './types'

/** Port of the gallery's `m2`: the Browning .50 on its tripod, with the cover, the belt box and the bolt. */
export function buildM2(kit: ModelKit): BuiltModel {
  const { M, box, cylinderX, cylinderZ } = kit
  const group = kit.group()
  const parts: ModelParts = { family: 'belt', kick: 2.2, stroke: 0.08, glow: [] }
  box(group, 0.52, 0.13, 0.12, M.metal, 0.36, 0, 0)
  for (let i = 0; i < 5; i++) cylinderZ(group, 0.006, 0.124, M.dark, 0.15 + i * 0.1, -0.03, 0, 10)
  heatify(parts.glow, cylinderX(group, 0.016, 1.14, M.metal, 1.14, 0.01, 0, 16))
  cylinderX(group, 0.034, 0.24, M.dark, 0.74, 0.01, 0, 16)
  for (let i = 0; i < 6; i++) cylinderX(group, 0.036, 0.012, M.metal, 0.66 + i * 0.035, 0.01, 0, 16)
  cylinderX(group, 0.022, 0.05, M.dark, 1.69, 0.01, 0, 16)
  box(group, 0.04, 0.09, 0.03, M.wood, 0.05, -0.02, 0.05)
  box(group, 0.04, 0.09, 0.03, M.wood, 0.05, -0.02, -0.05)
  box(group, 0.06, 0.02, 0.12, M.metal, 0.09, -0.02, 0)
  const belt = kit.pivot(group, 0.38, -0.05, -0.12)
  parts.belt = belt
  box(belt, 0.16, 0.12, 0.09, M.olive, 0, 0, 0)
  for (let i = 0; i < 8; i++) cylinderX(belt, 0.006, 0.05, M.brass, -0.08 + i * 0.02, 0.08, 0.04, 8)
  const cover = kit.pivot(group, 0.12, 0.065, 0)
  parts.cover = cover
  box(cover, 0.4, 0.012, 0.12, M.metal, 0.2, 0.006, 0)
  box(group, 0.04, 0.05, 0.04, M.dark, 0.66, 0.1, 0)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(bolt, 0.03, 0.03, 0.02, M.metal, 0.5, 0, 0.07)
  const tripod = kit.group()
  tripod.position.set(0.42, -0.1, 0)
  group.add(tripod)
  box(tripod, 0.03, 0.06, 0.03, M.metal, 0, 0, 0)
  box(tripod, 0.012, 0.62, 0.012, M.metal, -0.2, -0.25, 0, 0.75)
  box(tripod, 0.012, 0.62, 0.012, M.metal, 0.22, -0.25, 0.16, -0.75, 0, 0.3)
  box(tripod, 0.012, 0.62, 0.012, M.metal, 0.22, -0.25, -0.16, -0.75, 0, -0.3)
  parts.muzzle = kit.mark(group, 1.72, 0.01, 0)
  parts.eject = kit.mark(group, 0.3, -0.07, 0)
  return { group, parts }
}
