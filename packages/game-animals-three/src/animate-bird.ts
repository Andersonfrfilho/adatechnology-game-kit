import type { BirdSpec } from '@adatechnology/game-animals'

import type { AnimateParams } from './animate-types'
import type { AnimalRig } from './types'

const { PI } = Math

/** Advances a bird's cycle (page: `animBird`): steps, flight for the species that fly, wings, peck, alarm, tail. */
export const animateBird = (rig: AnimalRig, params: AnimateParams): void => {
  const { time: t, delta: dt, clip } = params
  const species = rig.species
  const spec = species.body as BirdSpec
  const isVulture = species.id === 'vulture'
  const isChicken = species.id === 'chicken'
  const isLapwing = species.id === 'southern_lapwing'
  const flying = clip === 'run' && !isChicken
  const hz = clip === 'run' && !flying ? species.runHz : clip === 'walk' ? species.walkHz : 0
  rig.phase += dt * (flying ? (isVulture ? 1.1 : 4.5) : hz) * 2 * PI
  const targetHeight = flying ? rig.size * 1.2 : 0
  rig.trunk.position.y += (targetHeight - rig.trunk.position.y) * Math.min(1, dt * 3)
  rig.legs.forEach((leg, index) => {
    if (flying) {
      leg.hip.rotation.x = 1.2
      leg.knee.rotation.x = -1.6
    } else if (clip === 'idle') {
      leg.hip.rotation.x = 0
      leg.knee.rotation.x = 0
    } else {
      const phase = rig.phase + index * PI
      leg.hip.rotation.x = -Math.sin(phase) * 0.45
      leg.knee.rotation.x = -Math.max(0, Math.cos(phase)) * 0.7
    }
    leg.foot.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x)
  })
  rig.wings.forEach((wing) => {
    const { side, shoulder, elbow } = wing
    if (flying) {
      const flap = isVulture ? 0.25 + Math.sin(rig.phase) * 0.18 : Math.sin(rig.phase) * 0.9
      shoulder.rotation.y += (0 - shoulder.rotation.y) * Math.min(1, dt * 6)
      shoulder.rotation.z = side * flap
      elbow.rotation.z = side * (isVulture ? 0.08 : Math.sin(rig.phase - 0.6) * 0.4)
      elbow.rotation.y = 0
      shoulder.scale.x += (1 - shoulder.scale.x) * Math.min(1, dt * 6)
    } else {
      const alert = isLapwing && clip === 'idle' ? Math.max(0, Math.sin(t * 1.3)) * 0.9 : 0
      const flutter = isChicken && clip === 'run' ? Math.abs(Math.sin(rig.phase * 1.5)) * 0.8 : 0
      shoulder.rotation.y += ((side * PI) / 2 * 0.97 - alert * side * 0.9 - shoulder.rotation.y) * Math.min(1, dt * 6)
      shoulder.rotation.z = side * (-0.06 + flutter + alert * 0.6)
      elbow.rotation.z = side * 0.04
      elbow.rotation.y = 0
      shoulder.scale.x += ((alert > 0.1 ? 1 : 0.58) - shoulder.scale.x) * Math.min(1, dt * 6)
    }
  })
  const peck = isChicken && clip === 'idle' ? Math.max(0, Math.sin(t * 1.6)) ** 8 * 1.2 : 0
  if (rig.neck) {
    rig.neck.rotation.x = rig.neckAngle + (clip === 'walk' && !isVulture ? Math.max(0, Math.sin(rig.phase * 2)) * 0.35 : 0) + peck + (flying ? 0.6 : 0)
    rig.neck.rotation.y = clip === 'idle' ? Math.sin(t * 0.9) * 0.5 : 0
  }
  if (rig.jaw) rig.jaw.rotation.x = isLapwing && clip === 'idle' ? Math.max(0, Math.sin(t * 1.3)) * Math.abs(Math.sin(t * 14)) * 0.5 : 0
  if (rig.tailRoot) rig.tailRoot.rotation.x = (spec.tailA || 0) + (flying ? 0.6 : 0)
}
