import type { DestructibleImpl, DestructibleSpec, DestructionEvent, Hit, ObjectState } from '@adatechnology/game-contracts'
import type { Terrain, TerrainBlowResult } from './types'

const PART_ID = 'ground'
const PART_DEPTH = 3
const RAY_BACKOFF = 1
const GROUND_HP = 1e12

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
  const centerColumn = Math.max(0, Math.min(terrain.columns, Math.round((x1 - x0) / 2 / terrain.cellSize)))
  const centerRow = Math.max(0, Math.min(terrain.rows, Math.round((z1 - z0) / 2 / terrain.cellSize)))
  const centerMaterial = (): string => terrain.vertexMaterial(centerColumn, centerRow).id
  const buildSpec = (material: string): DestructibleSpec => ({
    name: options.name ?? 'Ground',
    parts: [
      {
        id: PART_ID,
        material,
        shape: { kind: 'box', size: [x1 - x0, PART_DEPTH, z1 - z0] },
        position: [(x0 + x1) / 2, -PART_DEPTH / 2, (z0 + z1) / 2],
        hp: GROUND_HP,
        anchored: true,
        tags: ['terrain'],
      },
    ],
    joints: [],
  })
  let cachedSpec: DestructibleSpec | undefined
  const spec = (): DestructibleSpec => {
    const material = centerMaterial()
    if (cachedSpec?.parts[0]?.material !== material) cachedSpec = buildSpec(material)
    return cachedSpec
  }
  const buildState = (material: string): ObjectState => ({
    id,
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    parts: [{ id: PART_ID, material, status: 'intact', hp: GROUND_HP, maxHp: GROUND_HP, mass: 0, temperature: 0, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 }],
    joints: [],
    groups: [[PART_ID]],
    destroyed: false,
  })
  let cachedState: ObjectState | undefined
  const state = (): ObjectState => {
    const material = centerMaterial()
    if (cachedState?.parts[0]?.material !== material) cachedState = buildState(material)
    return cachedState
  }
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
      return [{ type: 'damage', object: id, time: 0, part: PART_ID, amount: 0, hp: GROUND_HP, damageType: hit.type, ...(hit.source ? { source: hit.source } : {}) }]
    },
    update(dt) {
      terrain.update(dt)
      return []
    },
    state,
    reset() {
      terrain.reset()
    },
    serialize: () => terrain.serialize(),
    load(data) {
      terrain.load(data as ReturnType<Terrain['serialize']>)
    },
  }
}
