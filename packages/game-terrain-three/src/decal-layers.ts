import type * as THREE_NS from 'three'
import type { Terrain, TerrainDecal, TerrainDecalKind } from '@adatechnology/game-terrain'

type ThreeLib = typeof THREE_NS

const TEXTURE_SIZE = 128
const DECAL_LIFT = 0.008
const RIPPLE_SECONDS = 1.6
const CRACK_ARMS = 7
const DARK_GROUND_PRINT_TONE = 0.1
/** How dark each kind is against the colour of its material: a crack is a shadow, a splat is the material itself. */
const KIND_TONE: Record<TerrainDecalKind, number> = { crack: 0.16, print: 0.55, rut: 0.5, splat: 1, ripple: 3 }
/** Width over length of what it covers: a print is a sole, a rut a band. */
const KIND_ASPECT: Record<TerrainDecalKind, number> = { crack: 1, print: 0.55, rut: 0.5, splat: 1, ripple: 1 }

type AlphaAt = (u: number, v: number) => number

const hash = (value: number): number => {
  const raw = Math.sin(value * 91.17) * 43758.5453
  return raw - Math.floor(raw)
}
const ellipse = (u: number, v: number, cu: number, cv: number, ru: number, rv: number): number => Math.hypot((u - cu) / ru, (v - cv) / rv)

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - dx * t, py - ay - dy * t)
}

/** Arms that leave the blow and fork on the way out. */
function crackSegments(): number[][] {
  const segments: number[][] = []
  for (let arm = 0; arm < CRACK_ARMS; arm++) {
    let angle = (arm / CRACK_ARMS) * 6.283 + hash(arm) * 0.5
    let [x, y] = [0, 0]
    for (let step = 0; step < 5; step++) {
      const length = 0.075 + hash(arm * 7 + step) * 0.05
      const nextX = x + Math.cos(angle) * length
      const nextY = y + Math.sin(angle) * length
      segments.push([x, y, nextX, nextY])
      if (step > 0 && hash(arm * 13 + step) > 0.55) {
        const branch = angle + (hash(arm + step * 3) > 0.5 ? 0.7 : -0.7)
        segments.push([nextX, nextY, nextX + Math.cos(branch) * length * 0.8, nextY + Math.sin(branch) * length * 0.8])
      }
      x = nextX
      y = nextY
      angle += (hash(arm * 3 + step * 11) - 0.5) * 0.9
    }
  }
  return segments
}

const SHAPES: Record<TerrainDecalKind, () => AlphaAt> = {
  crack() {
    const segments = crackSegments()
    return (u, v) => {
      let nearest = Infinity
      for (const [ax, ay, bx, by] of segments) nearest = Math.min(nearest, segmentDistance(u, v, ax!, ay!, bx!, by!))
      return 1 - Math.min(1, Math.max(0, (nearest - 0.004) / 0.008))
    }
  },
  print: () => (u, v) => {
    // v runs heel to toe
    const sole = ellipse(u, v, 0, 0.17, 0.42, 0.28)
    const heel = ellipse(u, v, 0, -0.27, 0.32, 0.18)
    const inside = Math.min(sole, heel)
    return inside > 1 ? 0 : 0.85 * (Math.sin(v * 70) > -0.3 ? 1 : 0.55)
  },
  rut: () => (u, v) => (Math.abs(u) > 0.46 || Math.abs(v) > 0.5 ? 0 : Math.sin(v * 44 + Math.abs(u) * 18) > -0.2 ? 0.8 : 0.45),
  splat() {
    return (u, v) => {
      const angle = Math.atan2(v, u)
      const edge = 0.3 + 0.08 * Math.sin(angle * 5) + 0.05 * Math.sin(angle * 13 + 1) + 0.04 * Math.sin(angle * 23 + 2)
      const body = 1 - Math.max(0, Math.min(1, (Math.hypot(u, v) - edge) / 0.03))
      return Math.max(body, ellipse(u, v, 0.38, 0.12, 0.05, 0.04) < 1 || ellipse(u, v, -0.22, -0.36, 0.06, 0.05) < 1 ? 1 : 0)
    }
  },
  ripple: () => (u, v) => {
    const r = Math.hypot(u, v)
    return r > 0.5 ? 0 : Math.max(0, Math.sin(r * 42)) * (1 - r * 2) ** 0.5
  },
}

function createAlphaTexture(THREE: ThreeLib, alphaAt: AlphaAt): THREE_NS.DataTexture {
  const size = TEXTURE_SIZE
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4
      data[at] = data[at + 1] = data[at + 2] = 255
      data[at + 3] = Math.round(Math.max(0, Math.min(1, alphaAt((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5))) * 255)
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

const KINDS = Object.keys(SHAPES) as TerrainDecalKind[]

/** The marks of no depth, one instanced mesh per kind so that each has its shape. */
export function createDecalLayers(THREE: ThreeLib, terrain: Terrain): { group: THREE_NS.Group; sync(): void; dispose(): void } {
  const group = new THREE.Group()
  group.name = 'terrain-decals'
  const geometry = new THREE.PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  const layers = KINDS.map((kind) => {
    const texture = createAlphaTexture(THREE, SHAPES[kind]())
    const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: kind === 'ripple' ? 0.2 : 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
    const mesh = new THREE.InstancedMesh(geometry, material, terrain.budget.maxDecals)
    mesh.name = `terrain-decal-${kind}`
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    mesh.renderOrder = 2
    group.add(mesh)
    return { kind, mesh, material, texture }
  })
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Matrix4()
  const scale = new THREE.Matrix4()
  const colour = new THREE.Color()
  let seen = -1

  const place = (decal: TerrainDecal): boolean => {
    const water = terrain.waterAt(decal.x, decal.z)
    const grow = decal.kind === 'ripple' ? 0.5 + (decal.age / RIPPLE_SECONDS) * 1.5 : 1
    const size = decal.radius * 2 * grow
    rotation.makeRotationY(decal.angle)
    scale.makeScale(size * KIND_ASPECT[decal.kind], 1, size)
    matrix.multiplyMatrices(rotation, scale)
    matrix.setPosition(decal.x, (decal.kind === 'ripple' ? (water?.level ?? terrain.heightAt(decal.x, decal.z)) : terrain.heightAt(decal.x, decal.z)) + DECAL_LIFT, decal.z)
    return true
  }

  return {
    group,
    sync() {
      const decals = terrain.decals()
      const rippling = decals.some((decal) => decal.kind === 'ripple')
      if (seen === terrain.decalsVersion && !rippling) return
      seen = terrain.decalsVersion
      for (const layer of layers) {
        let count = 0
        for (const decal of decals) {
          if (decal.kind !== layer.kind || !place(decal)) continue
          layer.mesh.setMatrixAt(count, matrix)
          const [r, g, b] = terrain.material(decal.material).color
          const fade = decal.kind === 'ripple' ? Math.max(0, 1 - decal.age / RIPPLE_SECONDS) : 1
          // a print is a shadow: on a pale ground it greys, on a dark one it has to go nearly black to show
          const tone = (decal.kind === 'print' || decal.kind === 'rut') && r < 0.5 ? DARK_GROUND_PRINT_TONE : KIND_TONE[decal.kind]
          layer.mesh.setColorAt(count, colour.setRGB(Math.min(1, r * tone + (decal.kind === 'ripple' ? 0.5 : 0)) * fade, Math.min(1, g * tone + (decal.kind === 'ripple' ? 0.55 : 0)) * fade, Math.min(1, b * tone + (decal.kind === 'ripple' ? 0.6 : 0)) * fade))
          count++
        }
        layer.mesh.count = count
        layer.mesh.instanceMatrix.needsUpdate = true
        if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true
      }
    },
    dispose() {
      geometry.dispose()
      for (const layer of layers) {
        layer.material.dispose()
        layer.texture.dispose()
      }
      group.removeFromParent()
    },
  }
}
