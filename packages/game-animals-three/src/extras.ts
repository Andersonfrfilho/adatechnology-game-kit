import type * as THREE_NS from 'three'

import { addMesh } from './context'
import type { RigTools } from './context'
import type { HeadSpecOf, NeckSpecOf } from './extras-types'
import type { AnimalRig, Three } from './types'

export type ExtraContext = { readonly THREE: Three; readonly rig: AnimalRig; readonly tools: RigTools }

export type QuadrupedParts = {
  readonly bodyGroup: THREE_NS.Group
  readonly head: THREE_NS.Group
  readonly neck: THREE_NS.Group
  readonly main: THREE_NS.MeshStandardMaterial
  readonly belly: THREE_NS.MeshStandardMaterial
  readonly dark: THREE_NS.MeshStandardMaterial
  readonly L: number
  readonly Rb: number
  readonly bodyY: number
  readonly hd: HeadSpecOf
  readonly nk: NeckSpecOf
}

export type BirdParts = {
  readonly bodyGroup: THREE_NS.Group
  readonly head: THREE_NS.Group
  readonly neck: THREE_NS.Group
  readonly main: THREE_NS.MeshStandardMaterial
  readonly dark: THREE_NS.MeshStandardMaterial
}

export type QuadrupedExtra = (context: ExtraContext, parts: QuadrupedParts) => void
export type BirdExtra = (context: ExtraContext, parts: BirdParts) => void

const cow: QuadrupedExtra = ({ THREE, tools }, k) => {
  tools.ball(k.bodyGroup, 0.2, k.main, 0, k.Rb * 1.1, k.L * 0.33, 0.95, 1.1, 1.1) // hump
  tools.ball(k.neck, 0.13, k.main, 0, 0.12, 0.08, 0.55, 1.4, 1.05) // dewlap
  for (const side of [-1, 1]) addMesh(THREE, k.head, new THREE.ConeGeometry(0.025, 0.13, 8), tools.material(0xcfc6a8), side * 0.12, k.hd.r * 1.05, k.hd.r * 0.05, 0, 0, side * -0.9)
}

const horse: QuadrupedExtra = ({ THREE, rig, tools }, k) => {
  for (let index = 0; index < 9; index++) addMesh(THREE, k.neck, new THREE.BoxGeometry(0.035, 0.16, 0.08), k.dark, 0, 0.06 + index * 0.065, -0.12 + index * 0.004, -0.25, 0, 0) // mane
  addMesh(THREE, k.head, new THREE.BoxGeometry(0.03, 0.12, 0.06), k.dark, 0, k.hd.r * 1.05, k.hd.r * 0.3, 0.6, 0, 0) // forelock
  const last = rig.tail[rig.tail.length - 1] as THREE_NS.Group
  tools.ball(last, 0.08, k.dark, 0, -0.42, 0, 0.7, 4.5, 0.7) // tail hair
}

const wildBoar: QuadrupedExtra = ({ THREE, tools }, k) => {
  for (let index = 0; index < 12; index++) addMesh(THREE, k.bodyGroup, new THREE.BoxGeometry(0.03, 0.1, 0.06), k.dark, 0, k.Rb * 1.12 - index * 0.004, k.L * 0.38 - index * 0.06, -0.2, 0, 0) // bristles
  for (const side of [-1, 1])
    addMesh(THREE, k.head, new THREE.ConeGeometry(0.012, 0.09, 6), tools.material(0xe8e0cc), side * 0.07, k.hd.r * -0.25 + 0.03, k.hd.r * 0.25 + k.hd.r * k.hd.s[2] * 0.55 + 0.13, -0.6, 0, side * 0.5) // tusks
}

const chicken: BirdExtra = ({ tools }, k) => {
  const red = tools.material(0xc0281e)
  for (let index = 0; index < 4; index++) tools.ball(k.head, 0.014, red, 0, 0.045, -0.012 + index * 0.014, 0.5, 1, 0.8) // comb
  tools.ball(k.head, 0.012, red, 0, -0.04, 0.04, 0.5, 1.3, 0.7) // wattle
}

const southernLapwing: BirdExtra = ({ THREE, tools }, k) => {
  const black = tools.material(0x161616)
  tools.ball(k.bodyGroup, 0.05, black, 0, 0.03, 0.08, 1.1, 0.9, 0.6) // breast patch
  addMesh(THREE, k.head, new THREE.BoxGeometry(0.006, 0.006, 0.06).translate(0, 0, -0.03), black, 0, 0.025, -0.01, 0.5, 0, 0) // crest
  tools.ball(k.head, 0.026, black, 0, -0.005, 0.02, 1.05, 0.7, 0.9) // cap
}

/** The parts the page builds with code for five species (the page's `extra` closures), by species id. */
export const QUADRUPED_EXTRAS: Readonly<Record<string, QuadrupedExtra>> = { cow, horse, wild_boar: wildBoar }
export const BIRD_EXTRAS: Readonly<Record<string, BirdExtra>> = { chicken, southern_lapwing: southernLapwing }
