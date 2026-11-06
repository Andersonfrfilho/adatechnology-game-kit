import type * as THREE from 'three'

export type DesignName = 'p320' | 'usp' | 'p99'
export type FrameFinish = 'poly' | 'olive' | 'tan'

/** What tells one modern polymer pistol from another in a side photo: the numbers the design builder reads. */
export interface PistolDesign {
  readonly slideHeight: number
  readonly slideWidth: number
  readonly slideRoundness: number
  readonly frameFinish: FrameFinish
  readonly gripAngle: number
  readonly gripDepth: number
  readonly gripWidth: number
  readonly gripLength: number
  /** Length of the trigger guard opening, front to the grip. */
  readonly guardLength: number
  readonly rearSerrations: number
  readonly rearSerrationTilt: number
  readonly frontSerrations: number
  /** Distance from the muzzle to the front of the trigger guard, and how far it drops below the slide. */
  /** x of the top of the backstrap, and how much the magwell flares at the baseplate. */
  readonly gripRearX: number
  readonly magwellFlare: number
  readonly guardRound: boolean
  readonly guardDrop: number
  readonly guardHook: boolean
  readonly railSlots: number
  readonly hasHammer: boolean
  readonly hasBackstrap: boolean
  readonly hasFrontStrapRidges: boolean
  readonly hasDimples: boolean
}

export const PISTOL_DESIGNS: Readonly<Record<DesignName, PistolDesign>> = {
  p320: {
    slideHeight: 0.028, slideWidth: 0.026, slideRoundness: 0.1, frameFinish: 'tan', gripAngle: -0.27, gripDepth: 0.053, gripWidth: 0.032, gripLength: 0.092, guardLength: 0.062,
    rearSerrations: 6, rearSerrationTilt: 0, frontSerrations: 5, gripRearX: 0.01, magwellFlare: 0.01, guardRound: false, guardDrop: 0.043, guardHook: false, railSlots: 4, hasHammer: false, hasBackstrap: false, hasFrontStrapRidges: false, hasDimples: false,
  },
  usp: {
    slideHeight: 0.027, slideWidth: 0.028, slideRoundness: 0.05, frameFinish: 'poly', gripAngle: -0.32, gripDepth: 0.054, gripWidth: 0.033, gripLength: 0.092, guardLength: 0.066,
    rearSerrations: 8, rearSerrationTilt: -0.3, frontSerrations: 0, gripRearX: 0.014, magwellFlare: 0.002, guardRound: true, guardDrop: 0.045, guardHook: true, railSlots: 0, hasHammer: true, hasBackstrap: true, hasFrontStrapRidges: true, hasDimples: false,
  },
  p99: {
    slideHeight: 0.027, slideWidth: 0.026, slideRoundness: 0.06, frameFinish: 'olive', gripAngle: -0.33, gripDepth: 0.05, gripWidth: 0.031, gripLength: 0.092, guardLength: 0.06,
    rearSerrations: 9, rearSerrationTilt: 0, frontSerrations: 0, gripRearX: 0.01, magwellFlare: 0.003, guardRound: true, guardDrop: 0.044, guardHook: false, railSlots: 0, hasHammer: false, hasBackstrap: true, hasFrontStrapRidges: true, hasDimples: true,
  },
}

export const isDesignName = (value: string): value is DesignName => value in PISTOL_DESIGNS

export type DesignMaterial = THREE.Material
