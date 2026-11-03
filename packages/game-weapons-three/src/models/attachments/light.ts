import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { Group, MeshStandardMaterial } from 'three'
import type { LightBudget } from '@adatechnology/game-render-three'
import type { AttachmentBuildContext, AttachmentModel, AttachmentModelBuilder } from './types'

// candela of the spot: bright enough to read against the room lights at the range of the data
const LIGHT_INTENSITY = 150
const LENS_GLOW = 3
const LIGHT_COLOR = 0xfff1d0
const DEFAULT_CONE_DEG = 30
const DEFAULT_RANGE = 60

/**
 * The weapon light: a body with a lens on its rail, and a real `SpotLight` along the barrel with the cone and the range of the data. Off until it is turned on.
 * The spot stays in the scene (visible, at intensity 0) while the light is fitted: toggling it changes the intensity only, because a change in the number of lights makes three.js
 * recompile every lit material. The one recompile happens when the accessory is fitted or removed, which is rare and already takes seconds of work.
 */
export const buildLight: AttachmentModelBuilder = ({ kit, attachment, frame, lights }): AttachmentModel => {
  const { THREE, M, box, cylinderX } = kit
  const length = attachment.dims?.length ?? 0.1
  const radius = (attachment.dims?.diameter ?? 0.03) / 2
  const group = kit.group()
  const offset = frame.side === 0 ? { y: -(radius + 0.004), z: 0 } : { y: 0, z: frame.side * (radius + 0.004) }
  box(group, 0.035, 0.012, 0.03, M.dark, 0, frame.side === 0 ? -0.002 : 0, 0)
  cylinderX(group, radius, length, M.dark, 0, offset.y, offset.z, 14)
  cylinderX(group, radius * 1.08, 0.012, M.metal, length / 2 - 0.006, offset.y, offset.z, 14)
  const lens = new THREE.MeshStandardMaterial({ color: 0xfff2c8, roughness: 0.1, metalness: 0.2, emissive: 0xfff2c8, emissiveIntensity: 0 })
  cylinderX(group, radius * 0.82, 0.004, lens, length / 2 + 0.001, offset.y, offset.z, 14)
  const cone = (attachment.light?.coneDeg ?? DEFAULT_CONE_DEG) * (Math.PI / 180)
  const range = attachment.light?.range ?? DEFAULT_RANGE
  if (lights) return budgetedLight({ THREE, lights, group, lens, cone, range, at: [length / 2 + 0.01, offset.y, offset.z] })
  // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
  const spot = new THREE.SpotLight(LIGHT_COLOR, LIGHT_INTENSITY, range, cone / 2, 0.35, 1.2)
  spot.position.set(length / 2 + 0.01, offset.y, offset.z)
  spot.intensity = 0
  const target = new THREE.Object3D()
  target.position.set(length / 2 + 1, offset.y, offset.z)
  group.add(spot, target)
  spot.target = target
  return {
    object: group,
    setOn(on) {
      spot.intensity = on ? LIGHT_INTENSITY : 0
      lens.emissiveIntensity = on ? LENS_GLOW : 0
    },
    dispose() {
      lens.dispose()
      spot.dispose()
    },
  }
}

type BudgetedLightParams = {
  readonly THREE: AttachmentBuildContext['kit']['THREE']
  readonly lights: LightBudget
  readonly group: Group
  readonly lens: MeshStandardMaterial
  readonly cone: number
  readonly range: number
  readonly at: readonly [number, number, number]
}

/** The same spot as a source of the host's budget: it competes for a slot only while on, and follows the lens (whose -z points along the barrel, +x of the wrapper). */
function budgetedLight({ THREE, lights, group, lens, cone, range, at }: BudgetedLightParams): AttachmentModel {
  const aim = new THREE.Object3D()
  aim.position.set(at[0], at[1], at[2])
  aim.rotation.y = -Math.PI / 2
  group.add(aim)
  const source = lights.addSource({ owner: 'weapons.light', kind: 'spot', priority: LIGHT_PRIORITY.weaponLight, color: LIGHT_COLOR, intensity: 0, distance: range, decay: 1.2, angle: cone / 2, penumbra: 0.35, position: [0, 0, 0], follow: aim })
  return {
    object: group,
    setOn(on) {
      source.update({ intensity: on ? LIGHT_INTENSITY : 0 })
      lens.emissiveIntensity = on ? LENS_GLOW : 0
    },
    dispose() {
      source.remove()
      lens.dispose()
    },
  }
}
