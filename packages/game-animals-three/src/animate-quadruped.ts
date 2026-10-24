import type { GaitPhases, QuadrupedSpec } from '@adatechnology/game-animals'

import type { AnimateParams } from './animate-types'
import type { AnimalRig } from './types'

const { PI } = Math

/** Advances a quadruped's step cycle (page: `animQuad`): legs by gait phase, trunk bob, neck, head, jaw and tail; a dead one lies down. */
export const animateQuadruped = (rig: AnimalRig, params: AnimateParams, gaits: { readonly walk: GaitPhases; readonly trot: GaitPhases; readonly gallop: GaitPhases }): void => {
  const { time: t, delta: dt, clip } = params
  const species = rig.species
  const spec = species.body as QuadrupedSpec
  if (rig.dead) {
    rig.root.rotation.z += (PI / 2 * 0.97 - rig.root.rotation.z) * Math.min(1, dt * 3)
    rig.root.position.y += (spec.R * (spec.sx || 1) * 0.85 - rig.root.position.y) * Math.min(1, dt * 3)
    rig.legs.forEach((leg) => {
      leg.hip.rotation.x = leg.angle1 + (leg.isFront ? -0.5 : 0.4)
      leg.knee.rotation.x = 0.05
      leg.foot.rotation.x = 0
    })
    if (rig.neck) rig.neck.rotation.x = rig.neckAngle + 0.35
    if (rig.jaw) rig.jaw.rotation.x = 0.25
    return
  }
  const hz = (clip === 'run' ? species.runHz : clip === 'walk' ? species.walkHz : 0) * (rig.infected ? 1.2 : 1)
  rig.phase += dt * hz * 2 * PI
  const gait = clip === 'run' ? (species.gallop ? gaits.gallop : gaits.trot) : gaits.walk
  const amplitude = clip === 'run' ? 0.62 : 0.34
  const flex = clip === 'run' ? 1.15 : 0.75
  rig.legs.forEach((leg, index) => {
    if (clip === 'idle') {
      leg.hip.rotation.x = leg.angle1
      leg.knee.rotation.x = leg.angle2
    } else {
      const phase = rig.phase + (gait[index] as number)
      const limit = rig.infected && index === 1 ? 0.35 : 1
      leg.hip.rotation.x = leg.angle1 - Math.sin(phase) * amplitude * limit
      leg.knee.rotation.x = leg.angle2 + Math.max(0, Math.cos(phase)) * flex * limit
    }
    leg.foot.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x) * 0.85
  })
  const bob = clip === 'idle' ? 0 : Math.abs(Math.sin(rig.phase)) * (clip === 'run' ? 0.05 : 0.018) * rig.size
  rig.trunk.position.y = bob * 0.6
  const bodyGroup = rig.bodyGroup
  if (bodyGroup) {
    bodyGroup.rotation.x = clip === 'run' && species.gallop ? Math.sin(rig.phase + PI * 0.4) * 0.07 : 0
    bodyGroup.scale.y = 1 + (clip === 'idle' ? Math.sin(t * 2.2) * 0.012 : 0)
  }
  const low = rig.infected ? 0.35 : 0
  if (rig.neck) {
    rig.neck.rotation.x = rig.neckAngle + low + (clip === 'idle' ? Math.sin(t * 0.7) * 0.08 : Math.sin(rig.phase * 2) * 0.04)
    rig.neck.rotation.y = clip === 'idle' ? Math.sin(t * 0.45) * 0.35 : 0
  }
  if (rig.head) rig.head.rotation.z = rig.infected ? Math.sin(t * 11) * Math.sin(t * 1.7) * 0.12 : 0
  if (rig.jaw) rig.jaw.rotation.x = rig.infected ? 0.25 + Math.max(0, Math.sin(t * 6)) * 0.25 : clip === 'run' ? 0.12 : 0
  const wagging = species.id === 'dog' && !rig.infected
  rig.tail.forEach((segment, index) => {
    segment.rotation.z = Math.sin(t * (wagging ? 9 : 2.2) - index * 0.6) * (wagging ? 0.35 : 0.12)
  })
}
