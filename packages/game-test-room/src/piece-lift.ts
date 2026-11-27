/**
 * Whether the player's hands lift a piece off the floor (`liftCheckFor` of game-player): its mass, from its materials, against the strength, held as far from the body as
 * its size makes it. A sofa is pushed or dragged; a gas bottle goes up. The size is the piece's box in its own space, unrotated.
 */
import type * as THREE_NS from 'three'
import type { DestructibleSpec } from '@adatechnology/game-contracts'
import { liftCheckFor } from '@adatechnology/game-player'
import type { LiftVerdict } from '@adatechnology/game-player'

type Measured = { readonly root: THREE_NS.Object3D; readonly mass: number }

export interface PieceLift {
  /** Centre (into `centre`, from the root) and unrotated size (into `size`) of the piece's box in its own space, to hold it by its middle or cylindrical side. */
  measure(piece: Measured, centre: THREE_NS.Vector3, size: THREE_NS.Vector3): void
  /** The verdict of the hands on the piece; a part taken off by hand (`byHand`) is the size of a grip, and only its weight counts. */
  verdict(piece: Measured, byHand?: boolean): LiftVerdict
  /** The size the last `verdict` measured. */
  readonly size: readonly [number, number, number]
}

export function createPieceLift(THREE: typeof THREE_NS, maxKg: number): PieceLift {
  const centre = new THREE.Vector3()
  const size = new THREE.Vector3()
  const measure: PieceLift['measure'] = (piece, into, sized) => {
    const saved = piece.root.quaternion.clone()
    piece.root.quaternion.identity()
    piece.root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(piece.root)
    box.getCenter(into).sub(piece.root.position)
    box.getSize(sized)
    piece.root.quaternion.copy(saved)
    piece.root.updateMatrixWorld(true)
  }
  return {
    measure,
    verdict(piece, byHand = false) {
      if (byHand) return piece.mass > maxKg ? 'too_heavy' : 'ok'
      measure(piece, centre, size)
      return liftCheckFor({ massKg: piece.mass, size: [size.x, size.y, size.z] }, { maxKg }).verdict
    },
    get size() {
      return [size.x, size.y, size.z] as const
    },
  }
}

/** The mass of an object from its parts: each part's own mass, or its volume times the density of its material (500 kg/m³ for one unknown) times how full it is. */
export function specMassOf(spec: Pick<DestructibleSpec, 'parts'>, densityOf: (material: string) => number | undefined): number {
  let mass = 0
  for (const part of spec.parts) {
    const s = part.shape
    const volume = s.kind === 'box' ? s.size[0] * s.size[1] * s.size[2] : s.kind === 'cylinder' ? Math.PI * s.radius * s.radius * s.height : (4 / 3) * Math.PI * s.radius ** 3
    mass += part.mass ?? volume * (densityOf(part.material) ?? 500) * (part.fill ?? 1)
  }
  return mass
}

type LivePart = { readonly status: string; readonly mass: number; readonly material: string }

/** The mass of what is left of an object: its parts but the broken, melted and burnt ones. */
export const liveMassOf = (parts: readonly LivePart[]): number =>
  parts.reduce((mass, part) => (part.status === 'broken' || part.status === 'melted' || part.status === 'ashes' ? mass : mass + part.mass), 0)

/** The material of the heaviest part still whole (what an object drags and sounds as), or undefined with none. */
export function heaviestMaterialOf(parts: readonly LivePart[]): string | undefined {
  let best: LivePart | undefined
  for (const part of parts) if (part.status !== 'broken' && (!best || part.mass > best.mass)) best = part
  return best?.material
}
