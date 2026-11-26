import { quadrupedLayout } from './layout'
import type { QuadrupedSpec } from './types'

export type Point = readonly [number, number, number]

/** A bone as a segment with a radius, in metres, standing on the ground at the origin and facing +z. */
export type Bone = { readonly start: Point; readonly end: Point; readonly radius: number }

export type QuadrupedAnatomy = {
  readonly trunk: Bone
  readonly neck: Bone
  readonly head: Bone
  /** Front right, front left, hind right, hind left (the order of the gaits). */
  readonly legs: readonly { readonly isFront: boolean; readonly upper: Bone; readonly lower: Bone }[]
  readonly frontHipHeight: number
  readonly hindHipHeight: number
  readonly span: number
}

const LEG_SIDES: readonly (readonly [number, number, boolean])[] = [
  [1, 1, true],
  [-1, 1, true],
  [1, -1, false],
  [-1, -1, false],
]

const along = (start: Point, angle: number, length: number): Point => [start[0], start[1] + Math.cos(angle) * length, start[2] + Math.sin(angle) * length]

/**
 * The rest pose of a quadruped as bones, from the same numbers the three.js builder uses (`quadrupedLayout`, the neck and head angles, the leg angles): body
 * on its length, the neck rising from the shoulders, the head along the neck's end, each leg as an upper and a lower bone (the lower one reaches the ground).
 */
export const anatomyOf = (spec: QuadrupedSpec): QuadrupedAnatomy => {
  const layout = quadrupedLayout(spec)
  const { leg, neck, head } = spec
  const trunkRadius = (spec.R * ((spec.sx ?? 1) + (spec.sy ?? 1))) / 2
  const centre = layout.bodyHeight
  const trunk: Bone = { start: [0, centre, -spec.L / 2], end: [0, centre, spec.L / 2], radius: trunkRadius }
  const neckStart: Point = [0, centre + spec.R * (spec.sy ?? 1) * (neck.y ?? 0.35), (spec.L / 2) * (neck.z ?? 0.78)]
  const neckBone: Bone = { start: neckStart, end: along(neckStart, neck.ang, neck.len), radius: neck.r }
  const headForward = head.down ?? 0
  const headLength = head.r * head.s[2] + head.sl
  const headEnd: Point = [0, neckBone.end[1] - Math.sin(headForward) * headLength, neckBone.end[2] + Math.cos(headForward) * headLength]
  const headBone: Bone = { start: neckBone.end, end: headEnd, radius: head.r * Math.max(head.s[0], head.s[1]) }
  const legs = LEG_SIDES.map(([side, direction, isFront]) => {
    const upperLength = isFront ? leg.fu : leg.hu
    const lowerLength = (isFront ? leg.fl : leg.hl) + layout.footHeight
    const angle1 = isFront ? (leg.fa1 ?? 0.06) : (leg.ha1 ?? -0.32)
    const angle2 = isFront ? (leg.fa2 ?? -0.08) : (leg.ha2 ?? 0.58)
    const hip: Point = [side * spec.R * (spec.sx ?? 1) * 0.55, isFront ? layout.frontHipHeight : layout.hindHipHeight, (direction * layout.span) / 2]
    // the page's legs hang down (-y) and swing about x: a positive angle moves the foot toward -z
    const hanging = (start: Point, angle: number, length: number): Point => [start[0], start[1] - Math.cos(angle) * length, start[2] - Math.sin(angle) * length]
    const knee = hanging(hip, angle1, upperLength)
    return {
      isFront,
      upper: { start: hip, end: knee, radius: leg.r * 1.25 },
      lower: { start: knee, end: hanging(knee, angle1 + angle2, lowerLength), radius: leg.r },
    }
  })
  return { trunk, neck: neckBone, head: headBone, legs, frontHipHeight: layout.frontHipHeight, hindHipHeight: layout.hindHipHeight, span: layout.span }
}
