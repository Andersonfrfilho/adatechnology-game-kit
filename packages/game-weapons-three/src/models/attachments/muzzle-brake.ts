import type * as THREE_NS from 'three'
import type { Parent, ModelKit } from '../kit'

/** The muzzle brake of the gallery's rifles (`brake` 1 the plain one, 2 the heavy one with eight sides), its end flush with the muzzle at `x`. `heat` receives the body so a builder can make it glow. */
export function buildBrake(kit: ModelKit, parent: Parent, kind: 1 | 2, x: number, y: number, barrelRadius: number, heat: (body: THREE_NS.Mesh) => void = () => undefined): void {
  const { M, box, cylinderX } = kit
  const scale = kind === 2 ? 3.2 : 2.0
  const length = kind === 2 ? 0.12 : 0.06
  heat(cylinderX(parent, barrelRadius * scale, length, M.dark, x - length / 2, y, 0, kind === 2 ? 8 : 16))
  for (let i = 0; i < 3; i++) box(parent, length * 0.16, barrelRadius * scale * 1.3, barrelRadius * scale * 2.2, M.hole, x - length * 0.25 - i * length * 0.25, y, 0)
}
