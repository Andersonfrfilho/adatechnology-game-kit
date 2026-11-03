import { markKitOrigin } from '@adatechnology/game-contracts'
import { createStaticBatcher } from '@adatechnology/game-render-three'
import type { StaticBatcher } from '@adatechnology/game-render-three'

import { fuse, liteMaterials, liteMeshes } from './lite'
import { primaryPaint } from './build'

/** Past this distance (m) an untouched vehicle draws fused: nobody sees a door seam from here, and the full model costs hundreds of draw calls. */
export const VEHICLE_LOD_DISTANCE = 14
const BATCH_BUDGET_MS = 2

export type VehicleLod = {
  /** `touched`: hit or driven, from now on it always draws in full (its damage only exists there); `posed`: a door, hood or lid is open now (fused only while all are shut). */
  update(distance: number, touched: boolean, posed?: boolean): void
  readonly fused: boolean
  dispose(): void
}

const isShown = (object: any, top: any): boolean => {
  for (let node = object; node && node !== top; node = node.parent) if (node.visible === false) return false
  return true
}

/** Shows `full` near and the kit's fused light mode (one mesh per class of material) far, in `root`'s own space. Hit tests read the full model, visible or not. */
export function createVehicleLod(kit: any, context: any, root: any, full: any): VehicleLod {
  const THREE = kit.THREE
  // the full model is drawn whole once, off-camera parts included, before it may hide: its buffers reach the GPU then, not in the frame of a
  // blast. A model rebuilt in place (the destructible's reset) is new geometry, so it is drawn whole again.
  let isUploaded = false
  let modelKey = ''
  const culled = new Map<any, boolean>()
  const keyOf = (): string => full.children.filter((child: any) => child.name !== 'static-batches').map((child: any) => child.uuid).join()
  const armUpload = (): void => {
    // a model rebuilt again before its first draw (frames skipped on a slow machine) lets go of the old one's meshes
    for (const [mesh, wasCulled] of culled) mesh.frustumCulled = wasCulled
    culled.clear()
    modelKey = keyOf()
    isUploaded = false
    full.traverse((object: any) => {
      if (!object.isMesh || culled.has(object)) return
      culled.set(object, object.frustumCulled)
      object.frustumCulled = false
    })
    const probe = [...culled.keys()][0]
    if (!probe) {
      isUploaded = true
      return
    }
    const before = probe.onAfterRender
    probe.onAfterRender = function (this: any, ...args: unknown[]) {
      isUploaded = true
      probe.onAfterRender = before
      before?.apply(this, args)
    }
  }
  armUpload()
  let lite: any = null
  let isFused = false
  let isLocked = false
  // near, the full model draws its still parts in batches by material; a part that moves, dents or falls draws on its own again
  let batcher: StaticBatcher | null = null
  let shadow: any = null
  const castsShadow = new Set<any>()
  /** One mesh with the shape of the fused body, drawn only into the shadow map. */
  const shadowProxyOf = (fused: any): any => {
    const positions: number[] = []
    const indices: number[] = []
    for (const mesh of fused.children) {
      if (!mesh.isMesh || !mesh.castShadow) continue
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix)
      const offset = positions.length / 3
      const position = geometry.attributes.position
      for (let at = 0; at < position.count; at++) positions.push(position.getX(at), position.getY(at), position.getZ(at))
      const index = geometry.index ? Array.from(geometry.index.array as ArrayLike<number>) : Array.from({ length: position.count }, (_, at) => at)
      for (const vertex of index) indices.push(vertex + offset)
      geometry.dispose()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    const proxy = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
    proxy.name = 'vehicle-shadow'
    markKitOrigin(proxy, { owner: 'game-vehicles-three', kind: 'vehicle', id: root.name })
    proxy.castShadow = true
    proxy.userData.skipLite = true
    proxy.raycast = () => undefined
    root.add(proxy)
    return proxy
  }
  const drawFull = (): void => {
    // a vehicle hit in play is changing part by part: its batches would be given back as fast as they are made
    if (!batcher && isLocked) return
    if (!batcher) {
      lite ??= build()
      lite.visible = isFused
      shadow ??= shadowProxyOf(lite)
      shadow.visible = !isFused
      // the shadow comes from the one proxy, not from each part: a part's own shadow would be one more pass per draw
      full.traverse((object: any) => {
        if (!object.isMesh || !object.castShadow) return
        castsShadow.add(object)
        object.castShadow = false
      })
      // merged a material at a time over the next frames (BATCH_BUDGET_MS each), never in one frame
      batcher = createStaticBatcher(THREE, full, { budgetMs: BATCH_BUDGET_MS })
      batcher.group.traverse((object: any) => (object.userData.skipLite = true))
      markKitOrigin(batcher.group, { owner: 'game-vehicles-three', kind: 'vehicle', id: root.name })
      return
    }
    batcher.update()
    // every part changed (the model was rebuilt, or all of it dented): batch what stands now
    if (!isLocked && batcher.stats().batched === 0 && batcher.stats().released > 0) {
      batcher.dispose()
      batcher = null
    }
  }
  const build = (): any => {
    root.updateMatrixWorld(true)
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
    // a painted texture (a livery, a lettering) does not survive the fusion into vertex colours: those meshes stay as they are, drawn from the same geometry
    const textured: any[] = []
    full.traverse((object: any) => {
      if (!object.isMesh || object.userData.skipLite || !isShown(object, full)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material: any) => material?.map && !/plate/i.test(material.name ?? '')) && !/plate/i.test(object.name ?? '')) textured.push(object)
    })
    for (const mesh of textured) mesh.userData.skipLite = true
    const fusion = fuse(THREE, { ...context, vehicle: full }, inverse, null, primaryPaint(context), kit.lodHiddenMaterials())
    for (const mesh of textured) delete mesh.userData.skipLite
    const group = new THREE.Group()
    group.name = 'vehicle-lite'
    markKitOrigin(group, { owner: 'game-vehicles-three', kind: 'vehicle', id: root.name })
    for (const mesh of liteMeshes(THREE, fusion, liteMaterials(THREE, kit.studioEnvironment()))) group.add(mesh)
    for (const mesh of textured) {
      const copy = new THREE.Mesh(mesh.geometry, mesh.material)
      copy.matrixAutoUpdate = false
      copy.matrix.multiplyMatrices(inverse, mesh.matrixWorld)
      copy.castShadow = mesh.castShadow
      copy.receiveShadow = mesh.receiveShadow
      group.add(copy)
    }
    root.add(group)
    return group
  }
  const show = (shouldFuse: boolean): void => {
    if (shouldFuse === isFused) return
    isFused = shouldFuse
    full.visible = !shouldFuse
    if (lite) lite.visible = shouldFuse
    if (shadow) shadow.visible = !shouldFuse
  }
  const api: VehicleLod = {
    update(distance, touched, posed = false) {
      isLocked ||= touched
      if (keyOf() !== modelKey) {
        // the fused copy and the batches were made from the old model
        api.dispose()
        armUpload()
      }
      if (!isUploaded) return show(false)
      if (culled.size > 0) {
        for (const [mesh, wasCulled] of culled) mesh.frustumCulled = wasCulled
        culled.clear()
      }
      const shouldFuse = !isLocked && !posed && distance > (isFused ? VEHICLE_LOD_DISTANCE * 0.9 : VEHICLE_LOD_DISTANCE)
      if (shouldFuse && !lite) lite = build()
      show(shouldFuse)
      if (!shouldFuse) drawFull()
    },
    get fused() {
      return isFused
    },
    dispose() {
      show(false)
      batcher?.dispose()
      batcher = null
      for (const mesh of castsShadow) mesh.castShadow = true
      castsShadow.clear()
      shadow?.removeFromParent()
      shadow?.geometry.dispose()
      shadow = null
      if (!lite) return
      lite.removeFromParent()
      lite.traverse((object: any) => object.geometry?.dispose())
      lite = null
    },
  }
  return api
}
