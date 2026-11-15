import type * as THREE_NS from 'three'
import type { GroundLayout } from '@adatechnology/game-contracts'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { Terrain } from '@adatechnology/game-terrain'

type ThreeLib = typeof THREE_NS

const LABEL_LIFT = 0.025
const LABEL_HEIGHT = 0.42
const LABEL_MAX_WIDTH = 3
const WATER_COLOUR = 0x2c5a68
const WATER_OPACITY = 0.62
const WATER_ROUGHNESS = 0.08
const WAVE_SIZE = 64
const WAVE_TILES_PER_METRE = 0.6
const WAVE_SPEED = 0.012

function buildSign(THREE: ThreeLib, text: string): THREE_NS.Mesh | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 72
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = 'rgba(0,0,0,0.65)'
  context.fillRect(0, 0, 512, 72)
  context.fillStyle = '#fff'
  context.font = 'bold 46px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 38)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(LABEL_MAX_WIDTH, LABEL_HEIGHT), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }))
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

/** A gentle bump map as normals, tiled over the water: it moves in `sync`. */
function createWaveTexture(THREE: ThreeLib): THREE_NS.DataTexture {
  const data = new Uint8Array(WAVE_SIZE * WAVE_SIZE * 4)
  const tau = Math.PI * 2 / WAVE_SIZE
  for (let y = 0; y < WAVE_SIZE; y++) {
    for (let x = 0; x < WAVE_SIZE; x++) {
      const dx = Math.cos(x * tau * 2 + y * tau) * 0.5 + Math.cos(x * tau * 5 - y * tau * 2) * 0.3
      const dy = Math.cos(y * tau * 3 + x * tau) * 0.5 + Math.cos(y * tau * 4 - x * tau * 3) * 0.3
      const at = (y * WAVE_SIZE + x) * 4
      data[at] = Math.round((dx * 0.25 + 0.5) * 255)
      data[at + 1] = Math.round((dy * 0.25 + 0.5) * 255)
      data[at + 2] = 255
      data[at + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, WAVE_SIZE, WAVE_SIZE, THREE.RGBAFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** What a layout lays over the ground: the water of the zones that have it and the sign of the zones that say what they are. Follows the layout as it changes. */
export function createZoneLayer(THREE: ThreeLib, terrain: Terrain): { group: THREE_NS.Group; sync(): void; dispose(): void } {
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-terrain-three', kind: 'ground' })
  group.name = 'terrain-zones'
  const waves = createWaveTexture(THREE)
  // where the water meets the bed at its edge the two lie on one plane: the offset draws the water in front instead of flickering
  const water = new THREE.MeshStandardMaterial({ color: WATER_COLOUR, transparent: true, opacity: WATER_OPACITY, roughness: WATER_ROUGHNESS, metalness: 0.1, normalMap: waves, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  let drawnFor: GroundLayout | null = null
  const throwAway = (): void => {
    for (const child of [...group.children]) {
      group.remove(child)
      const mesh = child as THREE_NS.Mesh
      mesh.geometry.dispose()
      if (mesh.material !== water) {
        const material = mesh.material as THREE_NS.MeshBasicMaterial
        material.map?.dispose()
        material.dispose()
      }
    }
  }
  const isWater = (surface: string): boolean => terrain.profileList.some((profile) => profile.id === surface && profile.water)
  const draw = (layout: GroundLayout): void => {
    throwAway()
    const [x0, z0, x1, z1] = terrain.bounds
    const rects: (readonly [number, number, number, number])[] = isWater(layout.surface) ? [[x0, z0, x1, z1]] : []
    for (const zone of layout.zones ?? []) {
      if (isWater(zone.surface)) rects.push(zone.rect)
      if (!zone.label) continue
      const sign = buildSign(THREE, zone.label)
      if (!sign) continue
      const [ax, , bx, bz] = zone.rect
      sign.scale.x = Math.min(1, (bx - ax - 0.1) / LABEL_MAX_WIDTH)
      sign.position.set((ax + bx) / 2, LABEL_LIFT, bz - LABEL_HEIGHT / 2 - 0.03)
      sign.renderOrder = 3
      group.add(sign)
    }
    for (const [ax, az, bx, bz] of rects) {
      const plane = new THREE.PlaneGeometry(bx - ax, bz - az)
      plane.rotateX(-Math.PI / 2)
      const uv = plane.getAttribute('uv') as THREE_NS.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (bx - ax) * WAVE_TILES_PER_METRE, uv.getY(i) * (bz - az) * WAVE_TILES_PER_METRE)
      const mesh = new THREE.Mesh(plane, water)
      mesh.name = 'terrain-water'
      mesh.position.set((ax + bx) / 2, terrain.waterAt((ax + bx) / 2, (az + bz) / 2)?.level ?? 0, (az + bz) / 2)
      mesh.renderOrder = 1
      group.add(mesh)
    }
  }
  return {
    group,
    sync() {
      const layout = terrain.layout()
      if (layout !== drawnFor) {
        drawnFor = layout
        draw(layout)
      }
      const shift = (Date.now() % 1_000_000) * 0.001 * WAVE_SPEED
      waves.offset.set(shift, shift * 0.7)
    },
    dispose() {
      throwAway()
      water.dispose()
      waves.dispose()
      group.removeFromParent()
    },
  }
}
