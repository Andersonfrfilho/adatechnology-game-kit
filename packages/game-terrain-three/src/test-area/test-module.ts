import type * as THREE_NS from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { DestructibleSpec, GroundLayout, ModuleArea, TestableItem, TestableModule } from '@adatechnology/game-contracts'
import { locale as localeTable } from './locale'

type ThreeLib = typeof THREE_NS

/** The lots of the area, side by side in two rows, one of each ground: soft ones in the back row, built ones in front. */
export const TERRAIN_STRIPS = ['lawn', 'dirt', 'sand', 'mud', 'dry_clay', 'gravel_bed', 'snow', 'shallow_water', 'road', 'cobblestone', 'paver_floor', 'stone_paving', 'concrete_slab', 'suspended_slab', 'tile_floor', 'wood_floor'] as const
const LOT_WIDTH = 3.4
const LOT_DEPTH = 3.8
const LOTS_PER_ROW = 8
/** Between the target wall and the table of the room: what the player sees on arriving, and clear of the furniture. */
const LOTS_Z1 = -1.4
const lotRect = (index: number): readonly [number, number, number, number] => {
  const row = Math.floor(index / LOTS_PER_ROW)
  const x0 = ((index % LOTS_PER_ROW) - LOTS_PER_ROW / 2) * LOT_WIDTH
  // the first row is the far one
  const z1 = LOTS_Z1 - (1 - row) * LOT_DEPTH
  return [x0, z1 - LOT_DEPTH, x0 + LOT_WIDTH, z1]
}

/** A lot of each ground, with its sign. A host lays it to give a room every ground to try (`createTestRoom`'s `ground`). */
export function terrainLotsGround(locale = 'en'): GroundLayout {
  const text = localeTable(locale)
  return { surface: 'concrete_slab', zones: TERRAIN_STRIPS.map((surface, index) => ({ rect: lotRect(index), surface, label: text.surfaces[surface] })) }
}
export const TERRAIN_AREA_GROUND: GroundLayout = terrainLotsGround()

const WEIGHT_SIDE = 0.32
const WEIGHT_HEIGHT = 4

function weightSpec(): DestructibleSpec {
  return { name: 'Weight', parts: [{ id: 'block', material: 'concrete', shape: { kind: 'box', size: [WEIGHT_SIDE, WEIGHT_SIDE, WEIGHT_SIDE] }, position: [0, WEIGHT_SIDE / 2, 0] }], joints: [] }
}

function buildWeight(THREE: ThreeLib): THREE_NS.Object3D {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(WEIGHT_SIDE, WEIGHT_SIDE, WEIGHT_SIDE), new THREE.MeshStandardMaterial({ color: 0xb4b4ae, roughness: 0.9 }))
  mesh.name = 'block'
  mesh.position.y = WEIGHT_SIDE / 2
  mesh.castShadow = true
  const root = markKitOrigin(new THREE.Group(), { owner: 'game-terrain-three', kind: 'item' })
  root.add(mesh)
  return root
}

/**
 * The ground bench: a lot of each surface side by side to shoot, blow up, burn and drop weights on. Opening the area lays the lots with their signs (`ground`) and drops a concrete block
 * on each from four metres.
 */
export function createTerrainTestModule(options: { readonly locale?: string } = {}): TestableModule {
  const text = localeTable(options.locale ?? 'en')
  return {
    id: 'terrain',
    name: text.name,
    group: text.group,
    ground: terrainLotsGround(options.locale ?? 'en'),
    items(): TestableItem[] {
      return [{ id: 'terrain_weight', name: text.weight, build: (THREE) => buildWeight(THREE as ThreeLib), spec: weightSpec, movable: true }]
    },
    area(): ModuleArea {
      return {
        placements: TERRAIN_STRIPS.map((_, index) => {
          const [x0, z0] = lotRect(index)
          return { item: 'terrain_weight', position: [x0 + LOT_WIDTH / 2, WEIGHT_HEIGHT, z0 + 1.2] }
        }),
        view: { eye: [0, 1.7, 1.5], target: [0, 0, -6] },
      }
    },
  }
}
