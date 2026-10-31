import type * as THREE_NS from 'three'
import type { BloodMark, DirtMark, GroundField, Mark, MarkEvent, RockMark, ScorchMark } from '@adatechnology/game-vfx'
import { createMarkTextures } from './canvas'
import type { MarkTextures } from './canvas'
import type { CanvasLike, ThreeLib } from './types'

const MAX_CONFORM_STEPS = 48
const MIN_CONFORM_STEPS = 16
const BLOOD_GROW_RATE = 1.2
const BLOOD_START_GROWTH = 0.05

const DEFAULT_MAX_GROUND_MARKS = 64
const DEFAULT_MAX_ROCKS = 512
const DEFAULT_MAX_BLOOD = 256
/** Geometries of evicted ground marks kept to be refilled; past this the extra ones are freed. */
const MAX_SPARE_GROUND_GEOMETRIES = 16

interface GroundDrawn {
  readonly mesh: THREE_NS.Mesh
  steps: number
}

interface BloodDrawn {
  readonly position: readonly [number, number, number]
  readonly rotation: number
  readonly scaleX: number
  readonly scaleZ: number
  age: number
}

export interface MarkLayer {
  readonly group: THREE_NS.Group
  /** The shared rock and plate shapes, so the debris and the rim rocks use the same geometry. */
  handle(event: MarkEvent): void
  update(dt: number): void
  /** The draw calls the marks cost right now. */
  count(): number
  dispose(): void
}

export interface MarkLayerOptions {
  readonly ground: GroundField | undefined
  readonly createCanvas: (() => CanvasLike) | undefined
  readonly rockGeometry: THREE_NS.BufferGeometry
  readonly plateGeometry: THREE_NS.BufferGeometry
  /** Scorch and dirt meshes alive at once; the oldest is reused for the next. Default 64. */
  readonly maxGroundMarks?: number
  /** Rim rocks and plates alive at once (each shape has its own instanced mesh of this size); the oldest is overwritten. Default 512. */
  readonly maxRocks?: number
  /** Blood pools alive at once; the oldest is overwritten. Default 256. */
  readonly maxBlood?: number
}

/**
 * The scorch, dirt, rim rocks and blood of the Lab as meshes (L443-476). A scorch or dirt mesh follows the ground as it was the moment the mark was
 * made (`conform`), so the renderer builds it from the mark event, not later.
 */
export function createMarkLayer(THREE: ThreeLib, options: MarkLayerOptions): MarkLayer {
  const group = new THREE.Group()
  const textures: MarkTextures = createMarkTextures(THREE, options.createCanvas)
  const owned: { dispose(): void }[] = [...textures.scorch, textures.dirt]
  const scorchMaterials = textures.scorch.map((map) => {
    const material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    owned.push(material)
    return material
  })
  const dirtMaterial = new THREE.MeshStandardMaterial({
    map: textures.dirt, transparent: true, depthWrite: false, roughness: 1, flatShading: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
  owned.push(dirtMaterial)
  const bloodMaterial = new THREE.MeshStandardMaterial({ color: 0x5c0a0a, roughness: 0.15, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  const bloodGeometry = new THREE.CircleGeometry(0.5, 9).rotateX(-Math.PI / 2)
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: true })
  owned.push(bloodMaterial, bloodGeometry, rockMaterial)
  const maxGroundMarks = options.maxGroundMarks ?? DEFAULT_MAX_GROUND_MARKS
  const bloodMesh = createInstanced(bloodGeometry, bloodMaterial, options.maxBlood ?? DEFAULT_MAX_BLOOD)
  const rockMesh = createInstanced(options.rockGeometry, rockMaterial, options.maxRocks ?? DEFAULT_MAX_ROCKS)
  const plateMesh = createInstanced(options.plateGeometry, rockMaterial, options.maxRocks ?? DEFAULT_MAX_ROCKS)
  rockMesh.castShadow = true
  plateMesh.castShadow = true
  group.add(bloodMesh, rockMesh, plateMesh)
  const groundMarks: GroundDrawn[] = []
  const spareGeometries: THREE_NS.BufferGeometry[] = []
  const blood: BloodDrawn[] = []
  const placed = { blood: 0, rock: 0, plate: 0 }
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const scale = new THREE.Vector3()
  const color = new THREE.Color()
  const up = new THREE.Vector3(0, 1, 0)

  function createInstanced(geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, capacity: number): THREE_NS.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    return mesh
  }

  function takeSpare(vertexCount: number): THREE_NS.BufferGeometry | undefined {
    const found = spareGeometries.findIndex((geometry) => geometry.getAttribute('position').count === vertexCount)
    return found < 0 ? undefined : spareGeometries.splice(found, 1)[0]
  }

  function evictOldestGroundMark(): void {
    const oldest = groundMarks.shift()!
    group.remove(oldest.mesh)
    spareGeometries.push(oldest.mesh.geometry)
    if (spareGeometries.length > MAX_SPARE_GROUND_GEOMETRIES) spareGeometries.shift()!.dispose()
  }

  function conform(mark: ScorchMark | DirtMark, material: THREE_NS.Material): void {
    const radius = mark.radius
    const steps = Math.max(MIN_CONFORM_STEPS, Math.min(MAX_CONFORM_STEPS, Math.round(radius * 8)))
    if (groundMarks.length >= maxGroundMarks) evictOldestGroundMark()
    const geometry = takeSpare((steps + 1) * (steps + 1)) ?? new THREE.PlaneGeometry(2, 2, steps, steps).rotateX(-Math.PI / 2)
    const grid = geometry.attributes.position!
    const cell = 2 / steps
    const cos = Math.cos(mark.rotation)
    const sin = Math.sin(mark.rotation)
    for (let index = 0; index < grid.count; index++) {
      // the unit grid of `PlaneGeometry(2, 2)` turned flat, in float32 like the buffer it would be read back from, so a reused geometry lands where a fresh one does
      const localX = Math.fround((index % (steps + 1)) * cell - 1) * radius
      const localZ = Math.fround(Math.floor(index / (steps + 1)) * cell - 1) * radius
      const worldX = mark.x + localX * cos - localZ * sin
      const worldZ = mark.z + localX * sin + localZ * cos
      grid.setXYZ(index, worldX, (options.ground?.heightAt(worldX, worldZ) ?? 0) + mark.lift, worldZ)
    }
    grid.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.attributes.normal!.needsUpdate = true
    geometry.boundingSphere = null
    geometry.boundingBox = null
    const mesh = new THREE.Mesh(geometry, material as THREE_NS.MeshStandardMaterial)
    mesh.receiveShadow = true
    group.add(mesh)
    groundMarks.push({ mesh, steps })
  }

  function addRock(mark: RockMark): void {
    const mesh = mark.plate ? plateMesh : rockMesh
    const slot = mark.plate ? 'plate' : 'rock'
    const index = placed[slot]++ % mesh.instanceMatrix.count
    quaternion.setFromEuler(euler.set(mark.rotation[0], mark.rotation[1], mark.rotation[2]))
    mesh.setMatrixAt(index, matrix.compose(position.set(mark.x, mark.y, mark.z), quaternion, scale.set(mark.scale[0], mark.scale[1], mark.scale[2])))
    mesh.setColorAt(index, color.set(mark.color))
    mesh.count = Math.min(placed[slot], mesh.instanceMatrix.count)
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
  }

  function writeBlood(index: number, drawn: BloodDrawn, growth: number): void {
    quaternion.setFromAxisAngle(up, drawn.rotation)
    bloodMesh.setMatrixAt(index, matrix.compose(position.set(drawn.position[0], drawn.position[1], drawn.position[2]), quaternion, scale.set(drawn.scaleX * growth, 1, drawn.scaleZ * growth)))
    bloodMesh.instanceMatrix.needsUpdate = true
  }

  function addBlood(mark: BloodMark): void {
    const index = placed.blood++ % bloodMesh.instanceMatrix.count
    const drawn: BloodDrawn = { position: [mark.x, mark.y, mark.z], rotation: mark.rotation, scaleX: mark.scaleX, scaleZ: mark.scaleZ, age: 0 }
    blood[index] = drawn
    writeBlood(index, drawn, BLOOD_START_GROWTH)
    bloodMesh.count = Math.min(placed.blood, bloodMesh.instanceMatrix.count)
  }

  function build(mark: Mark): void {
    if (mark.kind === 'scorch') conform(mark, scorchMaterials[mark.variant]!)
    else if (mark.kind === 'dirt') conform(mark, dirtMaterial)
    else if (mark.kind === 'rock') addRock(mark)
    else addBlood(mark)
  }

  function clearMarks(): void {
    for (const drawn of groundMarks) group.remove(drawn.mesh)
    for (const drawn of groundMarks) drawn.mesh.geometry.dispose()
    groundMarks.length = 0
    for (const geometry of spareGeometries) geometry.dispose()
    spareGeometries.length = 0
    blood.length = 0
    placed.blood = placed.rock = placed.plate = 0
    bloodMesh.count = rockMesh.count = plateMesh.count = 0
  }

  return {
    group,
    handle(event) {
      if (event.type === 'clear') clearMarks()
      else build(event.mark)
    },
    update(dt) {
      for (let index = 0; index < blood.length; index++) {
        const drawn = blood[index]
        if (!drawn || drawn.age > 1) continue
        drawn.age += dt * BLOOD_GROW_RATE
        writeBlood(index, drawn, Math.max(BLOOD_START_GROWTH, 1 - Math.pow(1 - Math.min(1, drawn.age), 2.5)))
      }
    },
    count: () => groundMarks.length + Number(bloodMesh.count > 0) + Number(rockMesh.count > 0) + Number(plateMesh.count > 0),
    dispose() {
      clearMarks()
      for (const mesh of [bloodMesh, rockMesh, plateMesh]) mesh.dispose()
      for (const item of owned) item.dispose()
    },
  }
}
