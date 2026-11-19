import { describe, expect, it } from 'vitest'
import type { Hit } from '@adatechnology/game-contracts'
import { buildVehicleItem, createVehicleDestructible, type VehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'

/** A round aimed at a part from outside: lands on its near face (same shape as the hits of `destructible.test.ts`). */
function bullet(d: VehicleDestructible, part: string, from: [number, number, number], energy = 500, caliber = 9): Hit {
  const target = d.partWorldCenter(part)
  const dir: [number, number, number] = [target[0] - from[0], target[1] - from[1], target[2] - from[2]]
  const n = Math.hypot(...dir)
  const unit = dir.map((v) => v / n) as [number, number, number]
  const spec = d.describe().parts.find((p) => p.id === part)!
  const half = spec.shape.kind === 'box' ? spec.shape.size : [0, 0, 0]
  const point: [number, number, number] = [target[0] - unit[0] * half[0] * 0.5, target[1] - unit[1] * half[1] * 0.5, target[2] - unit[2] * half[2] * 0.5]
  return { type: 'ballistic', point, direction: unit, energy, caliber }
}

type Drawable = { isMesh?: boolean; isInstancedMesh?: boolean; visible?: boolean; count?: number; userData?: Record<string, unknown> }

/** The decal marks a host submits to the renderer: each lone mesh or instanced batch is one draw call. */
function decalStats(root: { traverse(f: (o: Drawable) => void): void }): { batches: number; instances: number; loneMeshes: number } {
  let batches = 0
  let instances = 0
  let loneMeshes = 0
  root.traverse((o) => {
    if (!o.isMesh || o.visible === false || !o.userData?.decal) return
    if (o.isInstancedMesh) {
      batches += 1
      instances += o.count ?? 0
    } else {
      loneMeshes += 1
    }
  })
  return { batches, instances, loneMeshes }
}

describe('bullet holes stay one draw call no matter how many rounds', () => {
  it('ten 9 mm rounds through the door add ten holes but one draw call', () => {
    const kit = makeKit()
    const item = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'proto_1', frame: item.root })
    const before = decalStats(item.root)

    const shots = 10
    for (let i = 0; i < shots; i++) d.hit(bullet(d, 'door_front_left', [-6, 0.7, 0]))

    const after = decalStats(item.root)
    const door = d.state().parts.find((p) => p.id === 'door_front_left')!
    expect(door.holes).toHaveLength(shots)

    // every round still leaves a visible hole...
    expect(after.instances - before.instances).toBe(shots)
    // ...but they are drawn by one instanced batch, never one mesh each
    expect(after.batches - before.batches + (after.loneMeshes - before.loneMeshes)).toBeLessThanOrEqual(1)
    expect(after.loneMeshes).toBe(before.loneMeshes)
  })
})
