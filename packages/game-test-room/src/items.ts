import type { DestructibleSpec, JointSpec, PartSpec, Vec3 } from '@adatechnology/game-destruction'

const box = (id: string, material: string, size: Vec3, position: Vec3, extra: Partial<Omit<PartSpec, 'id' | 'material' | 'shape' | 'position'>> = {}): PartSpec => ({ id, material, shape: { kind: 'box', size }, position, ...extra })
const joint = (a: string, b: string, kind: JointSpec['kind'], extra: Partial<JointSpec> = {}): JointSpec => ({ a, b, kind, ...extra })

/** Spec of the brick target wall: `cols` x `rows` brick panels, the bottom row anchored, mortar joints between neighbours. */
export function brickWallSpec(cols = 8, rows = 6, panel: Vec3 = [1.25, 0.5, 0.2]): DestructibleSpec {
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  const id = (c: number, r: number): string => `brick_${r}_${c}`
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      parts.push(box(id(c, r), 'brick', panel, [(c - (cols - 1) / 2) * panel[0], panel[1] / 2 + r * panel[1], 0], { anchored: r === 0 }))
      if (c > 0) joints.push(joint(id(c - 1, r), id(c, r), 'mortar'))
      if (r > 0) joints.push(joint(id(c, r - 1), id(c, r), 'mortar'))
    }
  }
  return { name: 'brick wall', parts, joints, tags: ['structure'] }
}
