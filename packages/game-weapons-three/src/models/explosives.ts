import { markKitOrigin } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

import { modelKit } from './kit'
import type { ModelKit } from './kit'

type ExplosiveBuilder = (kit: ModelKit, group: THREE_NS.Group) => void

// Port of the gallery's `buildExp` (Galeria 3D do Arsenal, explosivos): same measures in metres, same parts, same order; each stands on its base, y up.
// The `handle` mark is where the hand closes: the middle of the body.
const grenade: ExplosiveBuilder = (kit, group) => {
  const { M, sphere, cylinderY, box, torus, THREE } = kit
  sphere(group, 0.032, M.olive, 0, 0.032, 0, 1)
  cylinderY(group, 0.011, 0.022, M.metal, 0, 0.072, 0)
  box(group, 0.012, 0.07, 0.006, M.metal, 0.016, 0.05, 0, 0.2)
  torus(group, new THREE.TorusGeometry(0.0085, 0.0016, 6, 12), M.steel, -0.012, 0.082, 0)
  kit.mark(group, 0, 0.032, 0).name = 'handle'
}

const molotov: ExplosiveBuilder = (kit, group) => {
  const { M, cylinderY, box } = kit
  cylinderY(group, 0.036, 0.17, M.bottle, 0, 0.085, 0, 10)
  cylinderY(group, 0.012, 0.06, M.bottle, 0, 0.2, 0, 8, 0.036)
  box(group, 0.03, 0.08, 0.02, M.white, 0.005, 0.25, 0, 0.3)
  cylinderY(group, 0.02, 0.07, M.fire, 0.01, 0.31, 0, 6, 0).userData.flame = true
  kit.mark(group, 0, 0.085, 0).name = 'handle'
}

const pipeBomb: ExplosiveBuilder = (kit, group) => {
  const { M, cylinderX, cylinderY } = kit
  cylinderX(group, 0.025, 0.2, M.metal, 0, 0.03, 0, 8)
  cylinderX(group, 0.031, 0.025, M.dark, -0.1, 0.03, 0, 6)
  cylinderX(group, 0.031, 0.025, M.dark, 0.1, 0.03, 0, 6)
  cylinderY(group, 0.002, 0.06, M.white, 0.1, 0.07, 0)
  kit.mark(group, 0, 0.03, 0).name = 'handle'
}

const dynamite: ExplosiveBuilder = (kit, group) => {
  const { M, cylinderX } = kit
  for (const [z, y] of [[-0.015, 0], [0.015, 0], [0, 0.026]] as const) cylinderX(group, 0.014, 0.2, M.dynamite, 0, 0.016 + y, z, 8)
  cylinderX(group, 0.031, 0.03, M.dark, -0.04, 0.025, 0, 8)
  cylinderX(group, 0.031, 0.03, M.dark, 0.05, 0.025, 0, 8)
  cylinderX(group, 0.002, 0.1, M.white, 0.14, 0.03, 0, 4)
  kit.mark(group, 0, 0.025, 0).name = 'handle'
}

const c4: ExplosiveBuilder = (kit, group) => {
  const { M, box, cylinderY } = kit
  box(group, 0.28, 0.05, 0.11, M.c4, 0, 0.025, 0)
  box(group, 0.05, 0.03, 0.04, M.dark, 0.06, 0.065, 0)
  cylinderY(group, 0.004, 0.05, M.metal, 0.03, 0.07, 0)
  box(group, 0.24, 0.003, 0.003, M.wire, 0.18, 0.055, 0.02)
  box(group, 0.24, 0.003, 0.003, M.metal, 0.18, 0.055, 0.03)
  kit.mark(group, 0, 0.025, 0).name = 'handle'
}

const claymore: ExplosiveBuilder = (kit, group) => {
  const { M, box } = kit
  for (const i of [-1, 0, 1]) box(group, 0.075, 0.083, 0.035, M.olive, i * 0.072, 0.12, Math.abs(i) * 0.012, 0, -i * 0.25)
  for (const [x, z] of [[-0.07, 0.03], [-0.07, -0.03], [0.07, 0.03], [0.07, -0.03]] as const) box(group, 0.004, 0.09, 0.004, M.metal, x, 0.04, z, x > 0 ? -0.25 : 0.25)
  kit.mark(group, 0, 0.12, 0).name = 'handle'
}

const flashbang: ExplosiveBuilder = (kit, group) => {
  const { M, cylinderY, box } = kit
  cylinderY(group, 0.022, 0.13, M.olive, 0, 0.065, 0, 10)
  for (let i = 0; i < 4; i++) cylinderY(group, 0.023, 0.008, M.dark, 0, 0.025 + i * 0.028, 0, 10)
  cylinderY(group, 0.012, 0.02, M.metal, 0, 0.14, 0)
  box(group, 0.01, 0.08, 0.005, M.metal, 0.024, 0.1, 0, 0.15)
  kit.mark(group, 0, 0.065, 0).name = 'handle'
}

// the explosives of game-weapons each builder draws (the gallery's keys: granada, molotov, pipe, dyn, c4, claymore, flash)
const BUILDERS: Readonly<Record<string, ExplosiveBuilder>> = {
  m67: grenade,
  molotov,
  pipe_bomb: pipeBomb,
  dynamite,
  c4,
  claymore,
  flashbang,
}

/** The explosive ids of game-weapons the gallery drew (`m67`, `molotov`, `pipe_bomb`, `dynamite`, `c4`, `claymore`, `flashbang`). */
export const EXPLOSIVE_MODEL_IDS: readonly string[] = Object.keys(BUILDERS)

export const hasExplosiveModel = (explosiveId: string): boolean => explosiveId in BUILDERS

/** The gallery model of an explosive standing on its base (y up, origin at the bottom centre, a `handle` mark where the hand closes); undefined for one the gallery did not draw. */
export function buildExplosiveModel(THREE: typeof THREE_NS, explosiveId: string): THREE_NS.Group | undefined {
  const builder = BUILDERS[explosiveId]
  if (!builder) return undefined
  const kit = modelKit(THREE)
  const group = markKitOrigin(kit.group(), { owner: 'game-weapons-three', kind: 'explosive', id: explosiveId })
  group.name = explosiveId
  builder(kit, group)
  return group
}
