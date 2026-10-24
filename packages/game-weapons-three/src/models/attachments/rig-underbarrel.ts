import type * as THREE_NS from 'three'
import type { WeaponDef } from '@adatechnology/game-weapons'
import type { WeaponModel } from '../index'
import { mountFrame } from './mount-frames'

const LAUNCHER_INTERFACES: ReadonlySet<string> = new Set(['m203', 'gp25', 'ag36'])

/**
 * After the model is built: when the weapon has a place for a launcher under the barrel, adds the empty pivot `ugl` there. The reload clip slides it (the tube of the launcher is drawn
 * inside it when one is fitted); done after the build so that the model the golden hashes is the one the builder made.
 */
export function rigUnderbarrel(THREE: typeof THREE_NS, model: WeaponModel, def: Pick<WeaponDef, 'mounts'>): void {
  const place = def.mounts?.find((mount) => mount.kind === 'underbarrel' && mount.interfaces.some((name) => LAUNCHER_INTERFACES.has(name)))
  const frame = place ? mountFrame(model, 'underbarrel') : undefined
  if (!frame) return
  const pivot = new THREE.Group()
  pivot.name = 'ugl'
  pivot.position.set(...frame.position)
  model.root.add(pivot)
  model.parts.ugl = pivot
}
