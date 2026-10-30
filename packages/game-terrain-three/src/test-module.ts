import type * as THREE_NS from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { DestructibleSpec, GroundLayout, ModuleArea, ModuleHost, TestableItem, TestableModule } from '@adatechnology/game-contracts'
import { locale as localeTable } from './locale'

type ThreeLib = typeof THREE_NS

/** The strips of the area, side by side, one of each ground. */
export const TERRAIN_STRIPS = ['dirt', 'lawn', 'sand', 'road', 'concrete_slab', 'wood_floor', 'tile_floor', 'stone_paving'] as const
const STRIP_WIDTH = 3
const STRIP_Z0 = 4
const STRIP_Z1 = 13
const stripRect = (index: number): readonly [number, number, number, number] => {
  const x0 = (index - TERRAIN_STRIPS.length / 2) * STRIP_WIDTH
  return [x0, STRIP_Z0, x0 + STRIP_WIDTH, STRIP_Z1]
}
export const TERRAIN_AREA_GROUND: GroundLayout = {
  surface: 'concrete_slab',
  zones: TERRAIN_STRIPS.map((surface, index) => ({ rect: stripRect(index), surface })),
}

const WEIGHT_SIDE = 0.32
const WEIGHT_HEIGHT = 4
const LABEL_Y = 0.02
const LABEL_WIDTH = 2.6
const LABEL_HEIGHT = 0.5

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

function buildLabel(THREE: ThreeLib, text: string, x: number): THREE_NS.Object3D | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = 'rgba(0,0,0,0.55)'
  context.fillRect(0, 0, 512, 96)
  context.fillStyle = '#fff'
  context.font = 'bold 54px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 50)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }))
  // read from the start of the area, looking along +z
  markKitOrigin(mesh, { owner: 'game-terrain-three', kind: 'room' })
  mesh.rotation.set(-Math.PI / 2, 0, Math.PI)
  mesh.position.set(x, LABEL_Y, STRIP_Z0 - LABEL_HEIGHT)
  return mesh
}

/**
 * The ground bench: a strip of each surface side by side to shoot, blow up, burn and drop weights on. Opening the area lays the strips (`ground`) and drops a concrete block
 * on each from four metres.
 */
export function createTerrainTestModule(options: { readonly locale?: string } = {}): TestableModule {
  let labels: THREE_NS.Object3D[] = []
  const text = localeTable(options.locale ?? 'en')
  return {
    id: 'terrain',
    name: text.name,
    group: text.group,
    ground: TERRAIN_AREA_GROUND,
    items(): TestableItem[] {
      return [{ id: 'terrain_weight', name: text.weight, build: (THREE) => buildWeight(THREE as ThreeLib), spec: weightSpec, movable: true }]
    },
    area(): ModuleArea {
      for (const label of labels) label.visible = true
      return {
        placements: TERRAIN_STRIPS.map((_, index) => {
          const [x0] = stripRect(index)
          return { item: 'terrain_weight', position: [x0 + STRIP_WIDTH / 2, WEIGHT_HEIGHT, STRIP_Z1 - 1.2] }
        }),
        view: { eye: [0, 1.7, 1.5], target: [0, 0, 8] },
      }
    },
    attach(host: ModuleHost): () => void {
      const THREE = host.THREE as ThreeLib
      const scene = host.scene as THREE_NS.Scene
      labels = TERRAIN_STRIPS.flatMap((surface, index) => {
        const [x0] = stripRect(index)
        const label = buildLabel(THREE, text.surfaces[surface], x0 + STRIP_WIDTH / 2)
        if (!label) return []
        label.visible = false
        scene.add(label)
        return [label]
      })
      const stop = host.onClear?.(() => {
        for (const label of labels) label.visible = false
      })
      return () => {
        stop?.()
        for (const label of labels) label.removeFromParent()
        labels = []
      }
    },
  }
}
