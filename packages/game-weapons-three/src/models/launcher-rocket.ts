import type * as THREE from 'three'
import type { ModelKit } from './kit'
import { heatify } from './kit'
import { buildRecoillessRound, buildRocketGrenade } from './launcher-rounds'
import type { ModelParts } from './types'

/** The RPG-7: tube, wooden heat shield, two grips, optic and the grenade in the muzzle. */
function buildRpg(kit: ModelKit, group: THREE.Group, parts: ModelParts): void {
  const { M, box, cylinderX } = kit
  parts.kick = 1.6
  cylinderX(group, 0.036, 0.13, M.dark, 0.065, 0, 0, 20, 0.021)
  cylinderX(group, 0.038, 0.012, M.metal, 0, 0, 0, 20)
  heatify(parts.glow, cylinderX(group, 0.021, 0.83, M.steel, 0.545, 0, 0, 18))
  cylinderX(group, 0.03, 0.3, M.wood, 0.47, 0, 0, 16)
  cylinderX(group, 0.031, 0.012, M.metal, 0.32, 0, 0, 16)
  cylinderX(group, 0.031, 0.012, M.metal, 0.62, 0, 0, 16)
  cylinderX(group, 0.024, 0.02, M.metal, 0.94, 0, 0, 16)
  box(group, 0.09, 0.03, 0.032, M.metal, 0.46, -0.028, 0)
  const frontGrip = kit.pivot(group, 0.4, -0.04, 0)
  frontGrip.rotation.z = -0.22
  box(frontGrip, 0.03, 0.1, 0.03, M.wood, 0, -0.05, 0)
  const rearGrip = kit.pivot(group, 0.5, -0.04, 0)
  rearGrip.rotation.z = -0.18
  box(rearGrip, 0.03, 0.1, 0.03, M.wood, 0, -0.05, 0)
  box(group, 0.06, 0.004, 0.012, M.metal, 0.53, -0.05, 0)
  box(group, 0.004, 0.025, 0.012, M.metal, 0.56, -0.04, 0)
  parts.trigger = box(group, 0.004, 0.018, 0.004, M.dark, 0.535, -0.045, 0, 0.15)
  const hammer = kit.pivot(group, 0.44, -0.012, 0)
  parts.hammer = hammer
  box(hammer, 0.012, 0.02, 0.01, M.dark, 0, 0, 0)
  box(group, 0.006, 0.03, 0.006, M.dark, 0.78, 0.032, 0)
  box(group, 0.02, 0.022, 0.014, M.dark, 0.46, 0.032, 0)
  box(group, 0.12, 0.042, 0.032, M.dark, 0.5, 0.04, -0.04)
  cylinderX(group, 0.013, 0.05, M.rubber, 0.42, 0.048, -0.04, 14)
  cylinderX(group, 0.016, 0.004, M.lens, 0.565, 0.048, -0.04, 14)
  box(group, 0.04, 0.012, 0.012, M.metal, 0.5, 0.016, -0.03)
  const round = buildRocketGrenade(kit)
  round.position.x = 0.95
  group.add(round)
  parts.round = round
  parts.roundRest = 0.95
  parts.makeRound = () => buildRocketGrenade(kit)
  parts.muzzle = kit.pivot(group, 0.95, 0, 0)
  parts.rear = kit.pivot(group, 0, 0, 0)
}

/** The M72 LAW: a disposable tube with its sight flaps and the firing pin. */
function buildM72(kit: ModelKit, group: THREE.Group, parts: ModelParts): void {
  const { M, box, cylinderX, cylinderY } = kit
  parts.kick = 1.1
  parts.disposable = true
  heatify(parts.glow, cylinderX(group, 0.0365, 0.6, M.olive, 0.58, 0, 0, 20))
  cylinderX(group, 0.032, 0.32, M.olive, 0.16, 0, 0, 20)
  cylinderX(group, 0.039, 0.03, M.rubber, 0.866, 0, 0, 20)
  cylinderX(group, 0.035, 0.025, M.rubber, 0.012, 0, 0, 20)
  cylinderX(group, 0.037, 0.015, M.yellow, 0.8, 0, 0, 20)
  cylinderX(group, 0.037, 0.012, M.dark, 0.3, 0, 0, 20)
  box(group, 0.004, 0.05, 0.05, M.dark, 0.79, 0.055, 0)
  box(group, 0.004, 0.006, 0.04, M.dark, 0.79, 0.078, 0)
  box(group, 0.004, 0.035, 0.024, M.dark, 0.38, 0.05, 0)
  cylinderY(group, 0.004, 0.006, M.lens, 0.38, 0.064, 0, 8)
  parts.trigger = box(group, 0.05, 0.016, 0.024, M.rubber, 0.5, 0.042, 0)
  box(group, 0.1, 0.01, 0.03, M.dark, 0.47, 0.036, 0)
  box(group, 0.02, 0.03, 0.01, M.dark, 0.66, -0.035, 0.03)
  box(group, 0.008, 0.03, 0.008, M.metal, 0.25, -0.04, 0.03)
  parts.muzzle = kit.pivot(group, 0.881, 0, 0)
  parts.rear = kit.pivot(group, 0, 0, 0)
}

/** The AT4: a heavier disposable tube with the fire-control box and the front grip. */
function buildAt4(kit: ModelKit, group: THREE.Group, parts: ModelParts): void {
  const { M, box, cylinderX } = kit
  parts.kick = 1.3
  parts.disposable = true
  heatify(parts.glow, cylinderX(group, 0.05, 0.86, M.olive, 0.51, 0, 0, 24))
  cylinderX(group, 0.056, 0.08, M.dark, 0.98, 0, 0, 24)
  cylinderX(group, 0.058, 0.07, M.dark, 0.04, 0, 0, 24, 0.05)
  cylinderX(group, 0.051, 0.015, M.yellow, 0.86, 0, 0, 24)
  box(group, 0.16, 0.026, 0.05, M.dark, 0.42, 0.058, 0)
  box(group, 0.03, 0.012, 0.016, M.red, 0.47, 0.075, 0)
  parts.trigger = box(group, 0.022, 0.012, 0.018, M.rubber, 0.5, 0.074, 0)
  box(group, 0.012, 0.07, 0.02, M.dark, 0.35, 0.09, -0.035)
  box(group, 0.012, 0.05, 0.02, M.dark, 0.71, 0.08, -0.035)
  const grip = kit.pivot(group, 0.68, -0.05, 0)
  grip.rotation.z = -0.15
  parts.grip = grip
  box(grip, 0.035, 0.11, 0.032, M.dark, 0, -0.05, 0)
  box(group, 0.14, 0.035, 0.06, M.rubber, 0.32, -0.06, 0)
  box(group, 0.3, 0.012, 0.055, M.dark, 0.5, -0.05, 0)
  parts.muzzle = kit.pivot(group, 1.02, 0, 0)
  parts.rear = kit.pivot(group, 0, 0, 0)
}

/** The Carl Gustaf M4: a reusable recoilless rifle with a hinged breech that takes a round from behind. */
function buildCarlGustaf(kit: ModelKit, group: THREE.Group, parts: ModelParts): void {
  const { M, box, cylinderX } = kit
  parts.kick = 1.4
  heatify(parts.glow, cylinderX(group, 0.045, 0.72, M.dark, 0.59, 0, 0, 24))
  cylinderX(group, 0.05, 0.04, M.rubber, 0.93, 0, 0, 24)
  const breech = kit.pivot(group, 0.21, 0, 0.05)
  parts.breech = [breech]
  cylinderX(breech, 0.06, 0.16, M.dark, -0.1, 0, -0.05, 24, 0.046)
  cylinderX(breech, 0.062, 0.015, M.metal, -0.18, 0, -0.05, 24)
  box(group, 0.025, 0.03, 0.02, M.metal, 0.22, 0, 0.052)
  const foreGrip = kit.pivot(group, 0.62, -0.05, 0)
  foreGrip.rotation.z = -0.2
  box(foreGrip, 0.035, 0.11, 0.034, M.dark, 0, -0.05, 0)
  parts.trigger = box(group, 0.004, 0.018, 0.004, M.dark, 0.66, -0.06, 0, 0.15)
  box(group, 0.06, 0.004, 0.012, M.metal, 0.66, -0.07, 0)
  const rearGrip = kit.pivot(group, 0.4, -0.05, 0)
  rearGrip.rotation.z = -0.25
  box(rearGrip, 0.035, 0.1, 0.034, M.dark, 0, -0.05, 0)
  box(group, 0.13, 0.04, 0.07, M.rubber, 0.28, -0.065, 0)
  box(group, 0.16, 0.05, 0.045, M.dark, 0.56, 0.07, -0.035)
  cylinderX(group, 0.016, 0.05, M.rubber, 0.46, 0.075, -0.035, 14)
  cylinderX(group, 0.02, 0.004, M.lens, 0.645, 0.075, -0.035, 14)
  box(group, 0.06, 0.02, 0.02, M.metal, 0.56, 0.04, -0.03)
  box(group, 0.22, 0.01, 0.02, M.dark, 0.6, 0.06, 0.03)
  box(group, 0.01, 0.03, 0.02, M.dark, 0.5, 0.05, 0.03)
  box(group, 0.01, 0.03, 0.02, M.dark, 0.7, 0.05, 0.03)
  parts.makeRound = () => buildRecoillessRound(kit)
  parts.muzzle = kit.pivot(group, 0.95, 0, 0)
  parts.rear = kit.pivot(group, 0.05, 0, 0)
}

export const ROCKET_BUILDERS: Record<string, (kit: ModelKit, group: THREE.Group, parts: ModelParts) => void> = {
  rpg: buildRpg,
  m72: buildM72,
  at4: buildAt4,
  carl: buildCarlGustaf,
}
