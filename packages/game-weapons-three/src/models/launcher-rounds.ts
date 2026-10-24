import type * as THREE from 'three'
import type { ModelKit } from './kit'

const PI = Math.PI

/** The PG-7V grenade of the RPG-7: warhead, body and the booster. */
export function buildRocketGrenade(kit: ModelKit): THREE.Group {
  const { M, cylinderX } = kit
  const round = kit.group()
  cylinderX(round, 0.018, 0.15, M.olive, -0.05, 0, 0, 14)
  cylinderX(round, 0.02, 0.07, M.olive, 0.035, 0, 0, 18, 0.0425)
  cylinderX(round, 0.0425, 0.12, M.olive, 0.13, 0, 0, 20)
  cylinderX(round, 0.0428, 0.012, M.dark, 0.09, 0, 0, 20)
  cylinderX(round, 0.0425, 0.13, M.olive, 0.255, 0, 0, 20, 0.011)
  cylinderX(round, 0.011, 0.03, M.metal, 0.335, 0, 0, 10, 0.004)
  return round
}

/** The 84 mm round of the Carl Gustaf. */
export function buildRecoillessRound(kit: ModelKit): THREE.Group {
  const { M, cylinderX } = kit
  const round = kit.group()
  cylinderX(round, 0.041, 0.32, M.green, -0.16, 0, 0, 20)
  cylinderX(round, 0.0415, 0.02, M.yellow, -0.05, 0, 0, 20)
  cylinderX(round, 0.041, 0.12, M.green, 0.06, 0, 0, 20, 0.012)
  cylinderX(round, 0.043, 0.03, M.brass, -0.33, 0, 0, 20)
  return round
}

/** The rocket that flies off a disposable tube or a rocket launcher without a model of its own round. */
export function buildFlyingRocket(kit: ModelKit, launcherType: string | undefined): THREE.Group {
  const { M, box, cylinderX } = kit
  const rocket = kit.group()
  const diameter = launcherType === 'at4' || launcherType === 'carl' ? 0.041 : 0.032
  cylinderX(rocket, diameter * 0.5, 0.2, M.dark, -0.1, 0, 0, 10)
  cylinderX(rocket, diameter, 0.3, M.olive, 0.15, 0, 0, 18)
  cylinderX(rocket, diameter, 0.12, M.olive, 0.36, 0, 0, 18, diameter * 0.25)
  for (let i = 0; i < 4; i++) {
    const fin = box(rocket, 0.06, 0.002, diameter * 1.4, M.metal, -0.17, 0, 0)
    fin.rotation.x = (i * PI) / 4
  }
  return rocket
}
