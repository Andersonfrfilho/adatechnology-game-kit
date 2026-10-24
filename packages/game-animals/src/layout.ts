import type { BirdSpec, QuadrupedSpec } from './types'

export type QuadrupedLayout = {
  /** Height of the front and the hind hips above the ground. */
  readonly frontHipHeight: number
  readonly hindHipHeight: number
  readonly footHeight: number
  /** Height of the body centre. */
  readonly bodyHeight: number
  /** Distance between the shoulders and the hips. */
  readonly span: number
  /** Largest dimension, used to scale the offsets of the split view and the blood pool. */
  readonly size: number
}

/** The rest-pose geometry of a quadruped: leg lengths and angles decide how high the body stands. */
export const quadrupedLayout = (spec: QuadrupedSpec): QuadrupedLayout => {
  const leg = spec.leg
  const frontAngle1 = leg.fa1 ?? 0.06
  const frontAngle2 = leg.fa2 ?? -0.08
  const hindAngle1 = leg.ha1 ?? -0.32
  const hindAngle2 = leg.ha2 ?? 0.58
  const footHeight = leg.hoof ? leg.r * 1.1 : leg.r * 0.7
  const frontHipHeight = leg.fu * Math.cos(frontAngle1) + leg.fl * Math.cos(frontAngle1 + frontAngle2) + footHeight
  const hindHipHeight = leg.hu * Math.cos(hindAngle1) + leg.hl * Math.cos(hindAngle1 + hindAngle2) + footHeight
  const bodyHeight = (frontHipHeight + hindHipHeight) / 2 + (spec.up ?? 0) * spec.R
  return { frontHipHeight, hindHipHeight, footHeight, bodyHeight, span: spec.L * spec.span, size: Math.max(spec.L, bodyHeight + spec.R) }
}

/** The size of a bird: the largest of its body and its standing height. */
export const birdSize = (spec: BirdSpec): number => Math.max(spec.r * 3, spec.tars + spec.shank * 0.9 + spec.r * 2)

/** The length a species takes in a line-up: used to space the animals apart. */
export const lineUpLength = (body: QuadrupedSpec | BirdSpec | { readonly kind: 'snake' }): number => {
  if (body.kind === 'quadruped') return body.L * 1.3
  if (body.kind === 'snake') return 0.9
  return body.r * 4
}
