import type { DestructibleSpec, PartSpec } from '../src'

export const plate = (material: string, w: number, h: number, thickness: number, id = 'plate', extra: Partial<PartSpec> = {}): DestructibleSpec => ({
  parts: [{ id, material, shape: { kind: 'box', size: [w, h, thickness] }, position: [0, 0, 0], thickness, ...extra }],
})

/** Chair: seat, four legs, back. */
export const chair = (): DestructibleSpec => {
  const leg = (id: string, x: number, z: number): PartSpec => ({ id, material: 'wood_soft', shape: { kind: 'box', size: [0.04, 0.4, 0.04] }, position: [x, 0.2, z] })
  return {
    name: 'chair',
    parts: [
      { id: 'seat', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.04, 0.4] }, position: [0, 0.42, 0] },
      leg('leg_fl', 0.18, 0.18), leg('leg_fr', -0.18, 0.18), leg('leg_bl', 0.18, -0.18), leg('leg_br', -0.18, -0.18),
      { id: 'back', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.4, 0.03] }, position: [0, 0.64, -0.185] },
    ],
  }
}
