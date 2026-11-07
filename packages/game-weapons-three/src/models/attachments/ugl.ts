import type * as THREE_NS from 'three'
import type { ModelKit } from '../kit'
import type { AttachmentModel, AttachmentModelBuilder } from './types'

// The three launchers under the barrel as their reference photos show them (assets/weapon-references.json): metres from the mount frame, x along the barrel towards the
// muzzle, y up; the frame sits 2 cm under the handguard, which the rail clamp on top of each launcher closes. The 40 mm tube hangs from the sliding pivot the reload clip moves.

/** Where the tube lies (from its rear to its muzzle along x), its radius, and how far below the frame its axis runs. */
interface Tube {
  readonly from: number
  readonly to: number
  readonly radius: number
  readonly axisY: number
}

type LauncherDraw = (kit: ModelKit, fixed: THREE_NS.Group) => Tube

const PI = Math.PI

/** The rail clamp along the top of a launcher, from `from` to `to`: it closes the gap up to the handguard of the host. */
const clamp = (kit: ModelKit, fixed: THREE_NS.Group, from: number, to: number): void => {
  const { M, box } = kit
  kit.roundness = 0.15
  box(fixed, to - from, 0.022, 0.03, M.dark, (from + to) / 2, 0.009, 0)
  kit.roundness = null
  for (const x of [from + 0.02, to - 0.02]) box(fixed, 0.012, 0.006, 0.036, M.metal, x, 0.016, 0)
}

/** A raked pistol grip with its foot, hanging from `top` (its front upper corner). */
const pistolGrip = (kit: ModelKit, fixed: THREE_NS.Group, top: readonly [number, number], length: number): void => {
  const { M, box } = kit
  const grip = kit.pivot(fixed, top[0], top[1], 0)
  grip.rotation.z = -0.3
  kit.roundness = 0.3
  box(grip, 0.032, length, 0.03, M.poly, -0.016, -length / 2, 0)
  kit.roundness = null
  for (let i = 0; i < 3; i++) box(grip, 0.006, 0.012, 0.028, M.poly, 0.001, -length * 0.25 - i * 0.02, 0)
}

/** A trigger guard as a squared loop under a housing whose bottom is at `bottom`, from `back` to `front`, with the trigger inside. */
const triggerGuard = (kit: ModelKit, fixed: THREE_NS.Group, back: number, front: number, bottom: number): void => {
  const { M, box } = kit
  const drop = 0.03
  box(fixed, front - back, 0.005, 0.01, M.dark, (back + front) / 2, bottom - drop, 0)
  box(fixed, 0.005, drop, 0.01, M.dark, front, bottom - drop / 2, 0)
  box(fixed, 0.005, 0.02, 0.006, M.metal, back + (front - back) * 0.45, bottom - 0.011, 0, 0.25)
}

// M203 (Wikimedia Commons, M4 Carbine with M203 Grenade Launcher): 380 mm, the 305 mm aluminium barrel in its ribbed handguard, the receiver behind it with the trigger and
// its long loop guard just ahead of the rifle's magazine.
const m203: LauncherDraw = (kit, fixed) => {
  const { M, box } = kit
  const tube: Tube = { from: 0, to: 0.305, radius: 0.025, axisY: -0.03 }
  clamp(kit, fixed, -0.075, 0.29)
  kit.roundness = 0.18
  box(fixed, 0.078, 0.056, 0.05, M.dark, -0.037, tube.axisY + 0.002, 0)
  kit.roundness = null
  box(fixed, 0.02, 0.012, 0.052, M.metal, -0.07, tube.axisY + 0.012, 0)
  triggerGuard(kit, fixed, -0.07, -0.012, tube.axisY - 0.026)
  return tube
}

// GP-25 Kostyor (Wikimedia Commons, AK-74 w GP-25 display): 323 mm, a short 205 mm muzzle-loaded barrel at the front, the body behind it with the quadrant sight on the left,
// its own raked pistol grip and the bare trigger ahead of it.
const gp25: LauncherDraw = (kit, fixed) => {
  const { M, box } = kit
  const tube: Tube = { from: 0.07, to: 0.275, radius: 0.024, axisY: -0.032 }
  clamp(kit, fixed, -0.04, 0.27)
  kit.roundness = 0.2
  box(fixed, 0.125, 0.054, 0.046, M.metal, 0.012, tube.axisY + 0.001, 0)
  kit.roundness = null
  box(fixed, 0.03, 0.026, 0.006, M.dark, 0.03, tube.axisY + 0.006, -0.026)
  pistolGrip(kit, fixed, [-0.012, tube.axisY - 0.022], 0.1)
  box(fixed, 0.005, 0.022, 0.006, M.metal, 0.012, tube.axisY - 0.034, 0, 0.3)
  box(fixed, 0.03, 0.004, 0.008, M.dark, 0.016, tube.axisY - 0.046, 0)
  return tube
}

// AG36 (Wikimedia Commons, HK G36 with AG36): 350 mm, the long polymer housing that clamps under the rifle and over the side-swinging barrel, the ladder sight on
// its left, and the full pistol grip with its loop guard at the rear.
const ag36: LauncherDraw = (kit, fixed) => {
  const { M, box } = kit
  const tube: Tube = { from: 0.04, to: 0.295, radius: 0.022, axisY: -0.066 }
  kit.roundness = 0.12
  box(fixed, 0.315, 0.044, 0.05, M.poly, 0.13, -0.02, 0)
  box(fixed, 0.09, 0.03, 0.046, M.poly, 0.01, -0.054, 0)
  kit.roundness = null
  clamp(kit, fixed, -0.02, 0.28)
  box(fixed, 0.24, 0.004, 0.051, M.dark, 0.16, -0.03, 0)
  box(fixed, 0.04, 0.022, 0.005, M.dark, 0.02, -0.008, -0.028)
  pistolGrip(kit, fixed, [-0.012, -0.069], 0.105)
  triggerGuard(kit, fixed, 0.0, 0.06, -0.069)
  return tube
}

const LAUNCHERS: Readonly<Record<string, LauncherDraw>> = { m203, gp_25: gp25, ag36 }

/** The 40 mm barrel in the sliding pivot: the tube, the ribbed sleeve of the M203, the muzzle ring and the bore; returns the muzzle mark. */
const drawTube = (kit: ModelKit, slide: THREE_NS.Object3D, tube: Tube, ribbed: boolean): THREE_NS.Object3D => {
  const { M, box, cylinderX } = kit
  const length = tube.to - tube.from
  cylinderX(slide, tube.radius, length, M.metal, tube.from + length / 2, tube.axisY, 0, 24)
  if (ribbed) {
    cylinderX(slide, tube.radius * 1.1, length * 0.68, M.poly, tube.from + length * 0.42, tube.axisY, 0, 24)
    for (let i = 0; i < 9; i++) {
      for (const angle of [PI / 2, -PI / 2, PI]) {
        box(slide, 0.004, 0.022, 0.003, M.dark, tube.from + length * 0.14 + i * length * 0.065, tube.axisY + Math.cos(angle) * tube.radius * 1.1, Math.sin(angle) * tube.radius * 1.1, 0, 0, angle - PI / 2)
      }
    }
  }
  cylinderX(slide, tube.radius * 1.08, 0.012, M.dark, tube.to - 0.006, tube.axisY, 0, 24)
  cylinderX(slide, tube.radius * 0.8, 0.004, M.hole, tube.to + 0.0005, tube.axisY, 0, 20)
  const muzzle = kit.mark(slide, tube.to + 0.01, tube.axisY, 0)
  muzzle.name = 'ugl_muzzle'
  return muzzle
}

/**
 * A launcher under the barrel drawn from its photo: on the weapon, the clamp, the housing, the sights and the trigger (and the grip of the GP-25 and AG36); in the sliding pivot
 * the reload clip moves, the 40 mm tube (the barrel of the real ones slides forward to open the breech). The muzzle mark `ugl_muzzle` is where the shot flashes.
 */
export const buildUnderbarrelLauncher: AttachmentModelBuilder = ({ kit, attachment, slide }): AttachmentModel | null => {
  const draw = LAUNCHERS[attachment.model]
  if (!draw || !slide) return null
  const fixed = kit.group()
  const tube = draw(kit, fixed)
  const muzzle = drawTube(kit, slide, tube, attachment.model === 'm203')
  return {
    object: fixed,
    muzzle,
    dispose() {
      slide.remove(...slide.children)
    },
  }
}
