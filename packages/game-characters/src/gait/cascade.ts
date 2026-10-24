import { CASCADE } from './profile'
import type { CascadeJoint } from './profile'

/** One joint moving toward its target: it covers `dt · rate` of the distance each step (never more than all of it). */
export const stepCascade = (current: number, target: number, dt: number, joint: CascadeJoint, rates: Readonly<Record<CascadeJoint, number>> = CASCADE): number =>
  current + (target - current) * Math.min(1, dt * rates[joint])

/** Between two poses by joint name: a joint `from` does not name starts at the target (the Bestiário's `lerpPose`). */
export const lerpPose = <TPose extends Readonly<Record<string, number>>>(from: Partial<TPose>, to: TPose, amount: number): TPose => {
  const result: Record<string, number> = {}
  for (const name of Object.keys(to)) {
    const start = from[name]
    const end = to[name] as number
    result[name] = start === undefined ? end : (start as number) + (end - (start as number)) * amount
  }
  return result as TPose
}
