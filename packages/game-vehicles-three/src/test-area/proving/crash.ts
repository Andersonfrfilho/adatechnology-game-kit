/**
 * The proving ground's crash against an immovable wall: the driven car stops dead, the pulse goes to `ejectionOf` of `game-vehicles-driving`, and an
 * occupant without a belt breaks the glass of the exit and flies out: a person of the host's catalogue thrown with `launchBody`, so the module that
 * animates it flies, lands, slides and lays it down as it does a body a blast knocked over. Everything it adds goes on `dispose`.
 */
import { launchBody } from '@adatechnology/game-contracts'
import type { ModuleHost, Vec3 } from '@adatechnology/game-contracts'
import { ejectionOf } from '@adatechnology/game-vehicles-driving'
import type { Ejection } from '@adatechnology/game-vehicles-driving'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'

/** Energy of the body against the glass, joules: enough to break a windshield or a side window. */
const GLASS_BLOW = 6000

type Root = { position: { x: number; y: number; z: number }; userData: Record<string, unknown> }

export interface ProvingCrash {
  /** Stops the car dead against a wall: answers the ejection, or null when the occupant stays in. */
  crash(params: { car: { position: Root['position']; rotationY: number }; u: number; w: number; belted: boolean; destructible: VehicleDestructible | null }): Ejection | null
  dispose(): void
}

export function createProvingCrash(host: ModuleHost, occupant: string | undefined): ProvingCrash {
  const thrown: Array<() => void> = []
  const breakGlass = (destructible: VehicleDestructible | null, exit: Ejection['exit'], forward: Vec3): void => {
    if (!destructible) return
    const want = exit === 'windshield' ? 'windshield' : exit === 'rear_window' ? 'rear' : exit.startsWith('left') ? 'left' : 'right'
    const pane = destructible.describe().parts.find((p) => p.id.includes(exit === 'windshield' || exit === 'rear_window' ? want : 'window') && (exit === 'windshield' || exit === 'rear_window' || p.id.includes(want)))
    if (!pane) return
    destructible.hit({ type: 'blunt', partId: pane.id, point: destructible.partWorldCenter(pane.id), direction: forward, energy: GLASS_BLOW, radius: 0.35, source: 'occupant' } as never)
  }
  return {
    crash({ car, u, w, belted, destructible }) {
      const ejection = ejectionOf({ before: { u, w }, after: { u: 0, w: 0 } }, belted)
      if (!ejection) return null
      // the game frame: front +z, right −x, turned by the car's yaw
      const s = Math.sin(car.rotationY)
      const c = Math.cos(car.rotationY)
      const forward: Vec3 = [s, 0, c]
      const right: Vec3 = [-c, 0, s]
      breakGlass(destructible, ejection.exit, forward)
      const [vf, vr, vu] = ejection.velocity
      const start: Vec3 = [car.position.x + forward[0] * 1.2, 1.1, car.position.z + forward[2] * 1.2]
      const placed = occupant ? host.addObject?.(occupant, { position: start, rotationY: car.rotationY }) : null
      if (placed) {
        launchBody(placed.root as Root, [forward[0] * vf + right[0] * vr, vu, forward[2] * vf + right[2] * vr])
        thrown.push(placed.remove)
      }
      return ejection
    },
    dispose() {
      for (const remove of thrown.splice(0)) remove()
    },
  }
}
