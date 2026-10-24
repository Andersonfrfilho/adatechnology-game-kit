import type * as THREE_NS from 'three'
import type { BloodMark, DirtMark, GroundField, Mark, MarkEvent, RockMark, ScorchMark } from '@adatechnology/game-vfx'
import { createMarkTextures } from './canvas'
import type { MarkTextures } from './canvas'
import type { CanvasLike, ThreeLib } from './types'

const MAX_CONFORM_STEPS = 48
const MIN_CONFORM_STEPS = 16
const BLOOD_GROW_RATE = 1.2

interface BloodDrawn {
  readonly mesh: THREE_NS.Mesh
  readonly scaleX: number
  readonly scaleZ: number
  age: number
}

export interface MarkLayer {
  readonly group: THREE_NS.Group
  /** The shared rock and plate shapes, so the debris and the rim rocks use the same geometry. */
  handle(event: MarkEvent): void
  update(dt: number): void
  /** The meshes in the group right now. */
  count(): number
  dispose(): void
}

export interface MarkLayerOptions {
  readonly ground: GroundField | undefined
  readonly createCanvas: (() => CanvasLike) | undefined
  readonly rockGeometry: THREE_NS.BufferGeometry
  readonly plateGeometry: THREE_NS.BufferGeometry
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
  owned.push(bloodMaterial, bloodGeometry)
  const rockMaterials = new Map<number, THREE_NS.MeshStandardMaterial>()
  const blood: BloodDrawn[] = []
  let meshCount = 0

  function rockMaterial(color: number): THREE_NS.MeshStandardMaterial {
    let material = rockMaterials.get(color)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true })
      rockMaterials.set(color, material)
      owned.push(material)
    }
    return material
  }

  function conform(mark: ScorchMark | DirtMark, material: THREE_NS.Material): THREE_NS.Mesh {
    const radius = mark.radius
    const steps = Math.max(MIN_CONFORM_STEPS, Math.min(MAX_CONFORM_STEPS, Math.round(radius * 8)))
    const geometry = new THREE.PlaneGeometry(2, 2, steps, steps).rotateX(-Math.PI / 2)
    const position = geometry.attributes.position!
    const cos = Math.cos(mark.rotation)
    const sin = Math.sin(mark.rotation)
    for (let index = 0; index < position.count; index++) {
      const localX = position.getX(index) * radius
      const localZ = position.getZ(index) * radius
      const worldX = mark.x + localX * cos - localZ * sin
      const worldZ = mark.z + localX * sin + localZ * cos
      position.setXYZ(index, worldX, (options.ground?.heightAt(worldX, worldZ) ?? 0) + mark.lift, worldZ)
    }
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, material as THREE_NS.MeshStandardMaterial)
    mesh.receiveShadow = true
    return mesh
  }

  function addRock(mark: RockMark): THREE_NS.Mesh {
    const mesh = new THREE.Mesh(mark.plate ? options.plateGeometry : options.rockGeometry, rockMaterial(mark.color))
    mesh.position.set(mark.x, mark.y, mark.z)
    mesh.scale.set(mark.scale[0], mark.scale[1], mark.scale[2])
    mesh.rotation.set(mark.rotation[0], mark.rotation[1], mark.rotation[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  function addBlood(mark: BloodMark): THREE_NS.Mesh {
    const mesh = new THREE.Mesh(bloodGeometry, bloodMaterial)
    mesh.position.set(mark.x, mark.y, mark.z)
    mesh.scale.set(mark.scaleX, 1, mark.scaleZ)
    mesh.rotation.y = mark.rotation
    mesh.receiveShadow = true
    mesh.scale.multiplyScalar(0.05)
    blood.push({ mesh, scaleX: mark.scaleX, scaleZ: mark.scaleZ, age: 0 })
    return mesh
  }

  function build(mark: Mark): THREE_NS.Mesh {
    if (mark.kind === 'scorch') return conform(mark, scorchMaterials[mark.variant]!)
    if (mark.kind === 'dirt') return conform(mark, dirtMaterial)
    if (mark.kind === 'rock') return addRock(mark)
    return addBlood(mark)
  }

  function clearMeshes(): void {
    for (const child of [...group.children]) {
      group.remove(child)
      const geometry = (child as THREE_NS.Mesh).geometry
      if (geometry !== options.rockGeometry && geometry !== options.plateGeometry && geometry !== bloodGeometry) geometry.dispose()
    }
    blood.length = 0
    meshCount = 0
  }

  return {
    group,
    handle(event) {
      if (event.type === 'clear') {
        clearMeshes()
        return
      }
      group.add(build(event.mark))
      meshCount++
    },
    update(dt) {
      for (const drawn of blood) {
        if (drawn.age > 1) continue
        drawn.age += dt * BLOOD_GROW_RATE
        const ease = 1 - Math.pow(1 - Math.min(1, drawn.age), 2.5)
        drawn.mesh.scale.set(drawn.scaleX * Math.max(0.05, ease), 1, drawn.scaleZ * Math.max(0.05, ease))
      }
    },
    count: () => meshCount,
    dispose() {
      clearMeshes()
      for (const item of owned) item.dispose()
    },
  }
}
