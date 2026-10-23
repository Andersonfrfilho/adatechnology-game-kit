/** Open and close clips for the doors, the hood and the trunk lid, in the `AnimationClipSpec` of the contracts. */
import type { AnimationClipSpec, AnimationPose } from '@adatechnology/game-contracts'
import type { VehicleContext, VehicleKit } from '../api'
import type { VehicleModel } from './model'
import type { VehicleVisuals } from './visual'

/** Seconds an opening or closing takes. */
const DURATION = 1.2

export function createVehicleClips(model: VehicleModel, vis: VehicleVisuals | null, kit: VehicleKit, c: VehicleContext): AnimationClipSpec[] {
  const zones = kit.zonesOf(c) as any[]
  const doors: Record<string, AnimationPose> = {}
  const hood: Record<string, AnimationPose> = {}
  const lid: Record<string, AnimationPose> = {}
  for (const p of model.parts) {
    if (p.role === 'door') {
      const z = zones.find((q) => q.id === p.zoneId)
      if (!z || (vis && !vis.plates.has(p.id))) continue
      const sgn = z.hinge === 'rear' ? -1 : 1
      doors[p.id] = { rotation: [0, (z.side < 0 ? -1 : 1) * sgn * 1.15, 0] }
    } else if (p.role === 'lid' && (!vis || vis.plates.has(p.id))) lid[p.id] = { rotation: [0, 0, -1.15] }
    else if (p.role === 'hood' && (!vis || vis.hood?.id === p.id)) hood[p.id] = { rotation: [0, 0, (vis?.hood?.open ?? (c as any).hood?.open ?? 1) * (vis?.hood?.sign ?? (c as any).hood?.sign ?? 1)] }
  }
  const clips: AnimationClipSpec[] = []
  const pair = (name: string, poses: Record<string, AnimationPose>, latch: string): void => {
    if (!Object.keys(poses).length) return
    const closed: Record<string, AnimationPose> = {}
    for (const k of Object.keys(poses)) closed[k] = { rotation: [0, 0, 0] }
    clips.push({
      id: `open_${name}`,
      duration: DURATION,
      keys: [{ t: 0, parts: closed }, { t: DURATION, parts: poses }],
      events: [{ t: 0.1, type: 'sound', data: { key: `${latch}_latch` } }],
    })
    clips.push({
      id: `close_${name}`,
      duration: DURATION,
      keys: [{ t: 0, parts: poses }, { t: DURATION, parts: closed }],
      events: [{ t: DURATION, type: 'sound', data: { key: `${latch}_shut` } }],
    })
  }
  pair('doors', doors, 'door')
  pair('hood', hood, 'hood')
  pair('trunk', lid, 'trunk')
  return clips
}
