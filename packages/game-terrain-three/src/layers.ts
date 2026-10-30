import type * as THREE_NS from 'three'
import type { Terrain, TerrainDebrisKind } from '@adatechnology/game-terrain'

type ThreeLib = typeof THREE_NS

const MARK_LIFT = 0.006
const MARK_REACH = 1.5
const MARK_TEXTURE_SIZE = 64
const MARK_DARKEN = 0.85
/** How a piece of each kind is stretched: a shard is a flake, a splinter a long sliver. */
const PIECE_SHAPE: Record<TerrainDebrisKind, readonly [number, number, number]> = { clods: [1, 0.85, 1], chips: [1, 0.6, 0.8], shards: [1.3, 0.2, 1], splinters: [0.3, 0.25, 2.4], dust: [1, 0.8, 1] }

/** A pock as an alpha disc: dark in the middle, a broken lighter ring where the surface chipped. */
function createMarkTexture(THREE: ThreeLib): THREE_NS.DataTexture {
  const size = MARK_TEXTURE_SIZE
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5
      const v = (y + 0.5) / size - 0.5
      const angle = Math.atan2(v, u)
      const lobes = 0.86 + 0.09 * Math.sin(angle * 5) + 0.05 * Math.sin(angle * 13 + 1)
      const q = Math.hypot(u, v) / (0.5 * lobes)
      const shade = q < 0.55 ? 0.42 + q * 0.5 : 0.7 + (q - 0.55) * 0.8
      const at = (y * size + x) * 4
      data[at] = data[at + 1] = data[at + 2] = Math.round(Math.min(1, shade) * 255)
      data[at + 3] = q < 0.8 ? 255 : q < 1 ? Math.round((1 - (q - 0.8) / 0.2) * 255) : 0
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createMarkLayer(THREE: ThreeLib, terrain: Terrain, drawDistance: number): { mesh: THREE_NS.InstancedMesh; sync(camera: { x: number; z: number }): void; dispose(): void } {
  const geometry = new THREE.PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  const texture = createMarkTexture(THREE)
  const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const mesh = new THREE.InstancedMesh(geometry, material, terrain.budget.maxMarks)
  mesh.name = 'terrain-marks'
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.receiveShadow = true
  mesh.renderOrder = 1
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Matrix4()
  const scale = new THREE.Matrix4()
  const colour = new THREE.Color()
  let seen = ''
  let cameraX = Infinity
  let cameraZ = Infinity
  return {
    mesh,
    sync(camera) {
      const marks = terrain.marks()
      let blows = 0
      for (const mark of marks) blows += mark.count
      const stamp = `${terrain.marksVersion}:${blows}`
      if (stamp === seen && Math.hypot(camera.x - cameraX, camera.z - cameraZ) < 5) return
      seen = stamp
      cameraX = camera.x
      cameraZ = camera.z
      let count = 0
      for (const mark of marks) {
        if (Math.hypot(mark.x - camera.x, mark.z - camera.z) > drawDistance) continue
        const size = mark.radius * 2 * MARK_REACH
        rotation.makeRotationY(mark.id * 2.399)
        scale.makeScale(size, 1, size)
        matrix.multiplyMatrices(rotation, scale)
        matrix.setPosition(mark.x, terrain.heightAt(mark.x, mark.z) + MARK_LIFT, mark.z)
        mesh.setMatrixAt(count, matrix)
        const [r, g, b] = terrain.material(mark.material).color
        colour.setRGB(r * MARK_DARKEN + 0.04, g * MARK_DARKEN + 0.04, b * MARK_DARKEN + 0.04)
        mesh.setColorAt(count, colour)
        count++
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      texture.dispose()
      mesh.removeFromParent()
    },
  }
}

export function createDebrisLayer(THREE: ThreeLib, terrain: Terrain): { mesh: THREE_NS.InstancedMesh; sync(): void; dispose(): void } {
  const geometry = new THREE.IcosahedronGeometry(1, 0)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true })
  const mesh = new THREE.InstancedMesh(geometry, material, terrain.budget.maxDebris)
  mesh.name = 'terrain-debris'
  mesh.count = 0
  mesh.castShadow = true
  mesh.frustumCulled = false
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const colour = new THREE.Color()
  return {
    mesh,
    sync() {
      const pieces = terrain.debris()
      let count = 0
      for (const piece of pieces) {
        const [x, y, z] = piece.position
        // the turn follows the distance travelled, so that a piece at rest stays as it landed
        const travelled = x * 1.7 + z * 1.3 + y
        euler.set(piece.spin[0] * travelled * 0.2 + piece.id, piece.spin[1] * travelled * 0.2, piece.spin[2] * travelled * 0.2)
        const shape = PIECE_SHAPE[piece.kind]
        scale.set(shape[0] * piece.radius, shape[1] * piece.radius, shape[2] * piece.radius)
        matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler), scale)
        mesh.setMatrixAt(count, matrix)
        const [r, g, b] = terrain.material(piece.material).color
        const tone = 0.85 + ((piece.id * 37) % 30) / 100
        mesh.setColorAt(count, colour.setRGB(r * tone, g * tone, b * tone))
        count++
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      mesh.removeFromParent()
    },
  }
}
