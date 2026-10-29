import type * as THREE_NS from 'three'
import type { ContainerState, FluidWorld, Vec3 } from '@adatechnology/game-fluids'
import { boxSolid, clipSolid, cylinderSolid } from './clip'
import type { Solid, V3 } from './clip'
import type { MaterialCache } from './materials'
import type { FluidSprites } from './sprites'
import type { QualityProfile } from './quality'
import type { ThreeLib } from './types'

/** How far the liquid is kept inside the container walls so it does not fight with them. */
const INSET = 0.985

/**
 * The liquid inside one bound container: the container's inner shape clipped by the world surface plane, expressed in the bound object's space,
 * so the cap always lies on the plane whatever the tilt. Plus steam puffs above a hot surface.
 */
export class LiquidBody {
  readonly group: THREE_NS.Group
  private mesh: THREE_NS.Mesh | null = null
  private geometry: THREE_NS.BufferGeometry | null = null
  private pos: Float32Array = new Float32Array(0)
  private nor: Float32Array = new Float32Array(0)
  private solid: Solid | null = null
  private shapeKey = ''
  private steamAcc = 0
  private readonly inverse: THREE_NS.Matrix4
  private readonly tmpN: THREE_NS.Vector3
  private readonly tmpP: THREE_NS.Vector3
  vertices = 0

  constructor(
    private readonly THREE: ThreeLib,
    readonly containerId: string,
    readonly object: THREE_NS.Object3D,
    offset: Vec3,
  ) {
    this.group = new THREE.Group()
    this.group.name = 'fluid_liquid_body'
    this.group.position.set(offset[0], offset[1], offset[2])
    this.inverse = new THREE.Matrix4()
    this.tmpN = new THREE.Vector3()
    this.tmpP = new THREE.Vector3()
    object.add(this.group)
  }

  get visible(): boolean {
    return !!this.mesh && this.mesh.visible
  }

  private build(state: ContainerState, quality: QualityProfile): void {
    const shape = state.shape
    if (!shape) return
    const key = JSON.stringify(shape) + quality.bodySegments
    if (key === this.shapeKey) return
    this.shapeKey = key
    this.solid =
      shape.kind === 'cylinder'
        ? cylinderSolid(shape.radius * INSET, shape.height * INSET, quality.bodySegments)
        : boxSolid([shape.size[0] * INSET, shape.size[1] * INSET, shape.size[2] * INSET])
    const T = this.THREE
    this.geometry?.dispose()
    this.pos = new Float32Array(this.solid.maxVertices * 3)
    this.nor = new Float32Array(this.solid.maxVertices * 3)
    this.geometry = new T.BufferGeometry()
    const p = new T.BufferAttribute(this.pos, 3)
    const n = new T.BufferAttribute(this.nor, 3)
    p.setUsage(T.DynamicDrawUsage)
    n.setUsage(T.DynamicDrawUsage)
    this.geometry.setAttribute('position', p)
    this.geometry.setAttribute('normal', n)
    if (!this.mesh) {
      this.mesh = new T.Mesh(this.geometry)
      this.mesh.name = 'fluid_liquid'
      this.mesh.frustumCulled = false
      this.mesh.renderOrder = 3
      this.group.add(this.mesh)
    } else this.mesh.geometry = this.geometry
  }

  update(dt: number, world: FluidWorld, materials: MaterialCache, quality: QualityProfile, particles: FluidSprites): void {
    const state = world.container(this.containerId)
    const def = state?.liquid ? world.liquids.get(state.liquid) : undefined
    if (!state || !state.shape || !def || state.liters <= 1e-6) {
      if (this.mesh) this.mesh.visible = false
      this.vertices = 0
      return
    }
    // Nothing of a sealed opaque shell shows its liquid, and a dent in that shell goes deeper than the liquid wall and would let the liquid through.
    if (state.closed && this.isShellOpaque()) {
      if (this.mesh) this.mesh.visible = false
      this.vertices = 0
      return
    }
    this.build(state, quality)
    if (!this.mesh || !this.solid) return
    this.mesh.material = materials.liquidBody(def)

    // The surface plane in the group's space.
    this.object.updateWorldMatrix(true, false)
    this.group.updateWorldMatrix(true, false)
    this.inverse.copy(this.group.matrixWorld).invert()
    this.tmpN.set(state.surfaceNormal[0], state.surfaceNormal[1], state.surfaceNormal[2]).transformDirection(this.inverse)
    this.tmpP.set(state.surfacePoint[0], state.surfacePoint[1], state.surfacePoint[2]).applyMatrix4(this.inverse)
    const u: V3 = [this.tmpN.x, this.tmpN.y, this.tmpN.z]
    const d = u[0] * this.tmpP.x + u[1] * this.tmpP.y + u[2] * this.tmpP.z

    this.vertices = clipSolid(this.solid, u, d, this.pos, this.nor)
    const geometry = this.geometry as THREE_NS.BufferGeometry
    geometry.setDrawRange(0, this.vertices)
    ;(geometry.getAttribute('position') as THREE_NS.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('normal') as THREE_NS.BufferAttribute).needsUpdate = true
    this.mesh.visible = this.vertices > 0

    // Steam above a hot open surface.
    if (state.steaming && this.vertices > 0) {
      this.steamAcc += dt * quality.steamRate
      while (this.steamAcc >= 1) {
        this.steamAcc -= 1
        const o = this.tmpP.set(state.surfacePoint[0], state.surfacePoint[1], state.surfacePoint[2])
        particles.steam([o.x, o.y + 0.01, o.z])
      }
    } else this.steamAcc = 0
  }

  /** Every mesh of the bound object (the liquid itself aside) is drawn with an opaque material. */
  private isShellOpaque(): boolean {
    let opaque = true
    this.object.traverse((child) => {
      const mesh = child as THREE_NS.Mesh
      if (!opaque || !mesh.isMesh || child === this.mesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some((material) => material.transparent || material.opacity < 1)) opaque = false
    })
    return opaque
  }

  get triangles(): number {
    return this.visible ? Math.floor(this.vertices / 3) : 0
  }

  dispose(): void {
    this.object.remove(this.group)
    this.geometry?.dispose()
    this.geometry = null
    this.mesh = null
  }
}
