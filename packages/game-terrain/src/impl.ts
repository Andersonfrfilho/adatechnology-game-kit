import type { DestructibleImpl, DestructibleSpec, DestructionEvent, Hit, ObjectState } from '@adatechnology/game-contracts'
import type { Terrain, TerrainBlowResult } from './types'

const PART_ID = 'ground'
const PART_DEPTH = 3
const RAY_BACKOFF = 1

export interface TerrainImplOptions {
  readonly id: string
  readonly name?: string
  /** Every blow that left its mark, with what it did. */
  readonly onBlow?: (result: TerrainBlowResult, hit: Hit) => void
}

/**
 * The ground as an object of the destruction world (`DestructionWorld.register`): shots, blows, blasts and flames reach it through the world's own raycast and blast like anything else.
 * The collision part is a flat box; a ray that enters it goes on to the real surface, so a round fired into a crater lands on its floor.
 */
export function createTerrainImpl(terrain: Terrain, options: TerrainImplOptions): DestructibleImpl {
  const { id } = options
  const [x0, z0, x1, z1] = terrain.bounds
  const spec = (): DestructibleSpec => ({
    name: options.name ?? 'Ground',
    parts: [
      {
        id: PART_ID,
        material: terrain.columnAt((x0 + x1) / 2, (z0 + z1) / 2).material,
        shape: { kind: 'box', size: [x1 - x0, PART_DEPTH, z1 - z0] },
        position: [(x0 + x1) / 2, -PART_DEPTH / 2, (z0 + z1) / 2],
        hp: 1e12,
        anchored: true,
        tags: ['terrain'],
      },
    ],
    joints: [],
  })
  const resolve = (hit: Hit): Hit => {
    if (hit.type !== 'ballistic' && hit.type !== 'blunt' && hit.type !== 'slash') return hit
    if (!hit.direction) return { ...hit, point: [hit.point[0], terrain.heightAt(hit.point[0], hit.point[2]), hit.point[2]] }
    const [dx, dy, dz] = hit.direction
    const from = [hit.point[0] - dx * RAY_BACKOFF, hit.point[1] - dy * RAY_BACKOFF, hit.point[2] - dz * RAY_BACKOFF]
    const onGround = terrain.raycast(from, hit.direction, RAY_BACKOFF + PART_DEPTH)
    return onGround ? { ...hit, point: onGround.point } : hit
  }
  return {
    id,
    ...(options.name ? { name: options.name } : {}),
    describe: spec,
    hit(hit): DestructionEvent[] {
      const landed = resolve(hit)
      const result = terrain.applyHit(landed)
      if (!result || result.radius <= 0) return []
      options.onBlow?.(result, landed)
      return [{ type: 'damage', object: id, time: 0, part: PART_ID, amount: 0, hp: 1e12, damageType: hit.type, ...(hit.source ? { source: hit.source } : {}) }]
    },
    update(dt) {
      terrain.update(dt)
      return []
    },
    state(): ObjectState {
      return {
        id,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        parts: [],
        joints: [],
        groups: [[PART_ID]],
        destroyed: false,
      }
    },
    reset: () => terrain.reset(),
    serialize: () => terrain.serialize(),
    load: (data) => terrain.load(data as ReturnType<Terrain['serialize']>),
  }
}
