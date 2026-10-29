import type * as THREE_NS from 'three'
import type { ModelKit } from '../kit'
import type { AttachmentModel, AttachmentModelBuilder } from './types'

interface LauncherLook {
  /** Radius of the 40 mm tube and how much of the data length it takes. */
  readonly tubeRadius: number
  readonly tubeFraction: number
  /** The housing around the breech: length (along the weapon), height and width. */
  readonly housing: readonly [number, number, number]
  /** The Soviet and the German ones have a muzzle ring and a front grip; the American one a plain tube. */
  readonly hasFrontGrip: boolean
}

const LAUNCHERS: Readonly<Record<string, LauncherLook>> = {
  m203: { tubeRadius: 0.0215, tubeFraction: 0.8, housing: [0.1, 0.05, 0.05], hasFrontGrip: false },
  gp_25: { tubeRadius: 0.023, tubeFraction: 0.78, housing: [0.08, 0.055, 0.05], hasFrontGrip: false },
  ag36: { tubeRadius: 0.02, tubeFraction: 0.8, housing: [0.13, 0.06, 0.05], hasFrontGrip: true },
}

const drawFixed = (kit: ModelKit, group: THREE_NS.Object3D, look: LauncherLook, length: number): void => {
  const { M, box, cylinderY } = kit
  const [housingLength, housingHeight, housingWidth] = look.housing
  box(group, housingLength, housingHeight, housingWidth, M.dark, housingLength / 2 - 0.02, -look.tubeRadius, 0)
  // the sights and the trigger of the launcher, under the receiver
  box(group, 0.05, 0.004, 0.012, M.metal, housingLength * 0.45, -look.tubeRadius - housingHeight / 2 - 0.004, 0)
  box(group, 0.004, 0.02, 0.008, M.dark, housingLength * 0.6, -look.tubeRadius - housingHeight / 2 - 0.016, 0)
  if (look.hasFrontGrip) {
    cylinderY(group, 0.012, 0.07, M.poly, length * 0.55, -look.tubeRadius - 0.04, 0, 12)
    box(group, 0.04, 0.01, 0.03, M.dark, length * 0.55, -look.tubeRadius - 0.004, 0)
  }
}

/**
 * A launcher under the barrel, drawn from the primitives of the kit: the housing and trigger on the weapon, and the 40 mm tube in the sliding pivot the reload clip moves
 * (the barrel of the real ones slides forward to open the breech). The muzzle mark `ugl_muzzle` is where the shot flashes.
 */
export const buildUnderbarrelLauncher: AttachmentModelBuilder = ({ kit, attachment, slide }): AttachmentModel | null => {
  const look = LAUNCHERS[attachment.model]
  if (!look || !slide) return null
  const { M, cylinderX } = kit
  const length = attachment.dims?.length ?? 0.35
  const fixed = kit.group()
  drawFixed(kit, fixed, look, length)
  const tubeLength = length * look.tubeFraction
  const start = -0.02
  cylinderX(slide, look.tubeRadius, tubeLength, M.metal, start + tubeLength / 2, -look.tubeRadius, 0, 18)
  cylinderX(slide, look.tubeRadius * 1.12, 0.012, M.dark, start + tubeLength - 0.006, -look.tubeRadius, 0, 18)
  cylinderX(slide, look.tubeRadius * 0.7, 0.004, M.hole, start + tubeLength + 0.0005, -look.tubeRadius, 0, 14)
  const muzzle = kit.mark(slide, start + tubeLength + 0.01, -look.tubeRadius, 0)
  muzzle.name = 'ugl_muzzle'
  return {
    object: fixed,
    muzzle,
    dispose() {
      slide.remove(...slide.children)
    },
  }
}
