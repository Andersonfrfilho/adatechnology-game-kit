import type * as THREE from 'three'
import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { ModelParts } from './types'

type Point = [number, number, number]

const hose = (kit: ModelKit, group: THREE.Group, points: Point[], radius: number, material: THREE.Material): void => {
  const { THREE } = kit
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 8, false), material)
  tube.castShadow = tube.receiveShadow = true
  group.add(tube)
}

/** The pilot light at the nozzle; its two flames carry `userData.flame` for the effect that flickers them. */
const pilot = (kit: ModelKit, group: THREE.Group, x: number, y: number): void => {
  const { M, cylinderX } = kit
  cylinderX(group, 0.006, 0.03, M.fire2, x + 0.015, y, 0, 6, 0).userData.flame = 1
  cylinderX(group, 0.004, 0.022, M.fire, x + 0.012, y, 0, 6, 0).userData.flame = 1
}

/** The M2 flamethrower: nozzle gun, hose and the two fuel tanks with the pressure bottle and its gauge. */
export function buildFlamethrower(kit: ModelKit, group: THREE.Group, parts: ModelParts): void {
  const { M, box, cylinderX, cylinderY, sphere } = kit
  parts.kick = 0.15
  heatify(parts.glow, cylinderX(group, 0.016, 0.62, M.steel, 0.42, 0, 0, 14))
  cylinderX(group, 0.022, 0.1, M.dark, 0.78, 0, 0, 14)
  heatify(parts.glow, cylinderX(group, 0.013, 0.1, M.steel, 0.88, 0, 0, 12, 0.009))
  cylinderX(group, 0.018, 0.02, M.metal, 0.73, 0, 0, 14)
  cylinderX(group, 0.012, 0.06, M.metal, 0.84, -0.025, 0, 10)
  pilot(kit, group, 0.92, -0.012)
  const foreGrip = kit.pivot(group, 0.6, -0.02, 0)
  foreGrip.rotation.z = -0.1
  box(foreGrip, 0.03, 0.1, 0.03, M.wood, 0, -0.05, 0)
  const lever = kit.pivot(group, 0.62, -0.02, 0)
  parts.trigger = box(lever, 0.008, 0.05, 0.006, M.metal, 0.02, -0.03, 0, 0.3)
  const rearGrip = kit.pivot(group, 0.17, -0.02, 0)
  rearGrip.rotation.z = -0.28
  box(rearGrip, 0.03, 0.1, 0.03, M.wood, 0, -0.05, 0)
  box(group, 0.05, 0.004, 0.012, M.metal, 0.2, -0.035, 0)
  cylinderX(group, 0.02, 0.04, M.metal, 0.1, 0, 0, 12)
  hose(kit, group, [[0.08, 0, 0], [0, -0.04, 0], [-0.08, -0.2, 0.05], [-0.18, -0.32, 0.08], [-0.25, -0.33, 0.08]], 0.011, M.rubber)
  for (const z of [-0.1, 0.1]) {
    cylinderY(group, 0.085, 0.5, M.olive, -0.3, -0.05, z, 20)
    sphere(group, 0.085, M.olive, -0.3, 0.2, z, 2).scale.y = 0.45
    sphere(group, 0.085, M.olive, -0.3, -0.3, z, 2).scale.y = 0.45
    cylinderY(group, 0.03, 0.03, M.metal, -0.3, 0.24, z, 12)
  }
  sphere(group, 0.075, M.olive, -0.3, 0.1, 0, 2).position.x = -0.39
  box(group, 0.03, 0.6, 0.24, M.dark, -0.4, -0.05, 0)
  cylinderY(group, 0.03, 0.012, M.metal, -0.39, 0.18, 0, 14)
  const gauge = kit.pivot(group, -0.39, 0.18, 0.003)
  parts.gauge = gauge
  box(gauge, 0.002, 0.022, 0.002, M.red, 0, 0.008, 0.012)
  parts.muzzle = kit.pivot(group, 0.94, 0, 0)
  parts.rear = kit.pivot(group, 0.1, 0, 0)
}

/** The improvised flamethrower: a copper pipe, a fire extinguisher as the tank and a rubber hose. */
export function buildImprovisedFlamethrower(kit: ModelKit, group: THREE.Group, parts: ModelParts): void {
  const { M, box, cylinderX, cylinderY, sphere } = kit
  parts.kick = 0.12
  heatify(parts.glow, cylinderX(group, 0.011, 0.66, M.pipe, 0.38, 0, 0, 12))
  heatify(parts.glow, cylinderX(group, 0.015, 0.06, M.steel, 0.74, 0, 0, 12, 0.01))
  cylinderX(group, 0.006, 0.05, M.metal, 0.735, -0.02, 0, 8)
  pilot(kit, group, 0.77, -0.02)
  cylinderY(group, 0.012, 0.04, M.redPaint, 0.72, -0.055, 0, 10)
  box(group, 0.02, 0.03, 0.012, M.dark, 0.72, -0.085, 0)
  cylinderX(group, 0.06, 0.42, M.redPaint, 0.3, -0.09, 0, 22)
  sphere(group, 0.06, M.redPaint, 0.51, -0.09, 0, 2).scale.x = 0.5
  sphere(group, 0.06, M.redPaint, 0.09, -0.09, 0, 2).scale.x = 0.5
  cylinderX(group, 0.02, 0.04, M.dark, 0.04, -0.09, 0, 12)
  box(group, 0.02, 0.06, 0.005, M.white, 0.3, -0.09, 0.06)
  for (const x of [0.15, 0.3, 0.45]) cylinderX(group, 0.063, 0.03, M.tape, x, -0.09, 0, 22)
  cylinderX(group, 0.016, 0.03, M.tape, 0.3, 0, 0, 12)
  hose(kit, group, [[0.04, -0.09, 0], [-0.02, -0.06, 0.02], [0, 0, 0.02], [0.05, 0, 0]], 0.007, M.rubber)
  const rearGrip = kit.pivot(group, 0.12, -0.01, 0)
  rearGrip.rotation.z = -0.3
  box(rearGrip, 0.03, 0.1, 0.03, M.wood, 0, -0.05, 0)
  const lever = kit.pivot(group, 0.17, -0.02, 0)
  parts.trigger = box(lever, 0.008, 0.04, 0.006, M.metal, 0, -0.02, 0, 0.2)
  parts.muzzle = kit.pivot(group, 0.78, 0, 0)
  parts.rear = kit.pivot(group, 0.05, 0, 0)
}
