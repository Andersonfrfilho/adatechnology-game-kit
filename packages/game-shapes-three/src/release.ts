import type * as THREE_NS from 'three'

/** What `releaseObject3D` freed. */
export interface ReleaseReport {
  geometries: number
  materials: number
  textures: number
}

export interface ReleaseOptions {
  /**
   * Trees that stay drawn (usually the scene): a geometry, material or texture any of them still uses is kept, so a resource shared by a clone that is
   * still on screen (a catalogue model, a material of the kit's palette) is not freed under it.
   */
  keep?: THREE_NS.Object3D | readonly THREE_NS.Object3D[]
}

type Disposable = { dispose(): void; userData?: Record<string, unknown> }
type Owner = {
  geometry?: Disposable
  material?: THREE_NS.Material | THREE_NS.Material[]
  skeleton?: { dispose(): void }
  traverse(fn: (o: THREE_NS.Object3D) => void): void
}

const isTexture = (v: unknown): v is THREE_NS.Texture => !!v && typeof v === 'object' && (v as { isTexture?: boolean }).isTexture === true

function texturesOf(material: THREE_NS.Material, out: Set<THREE_NS.Texture>): void {
  for (const value of Object.values(material)) if (isTexture(value)) out.add(value)
  const uniforms = (material as { uniforms?: Record<string, { value?: unknown }> }).uniforms
  if (uniforms) for (const u of Object.values(uniforms)) if (isTexture(u?.value)) out.add(u.value)
}

function collect(roots: readonly THREE_NS.Object3D[]): { geometries: Set<Disposable>; materials: Set<THREE_NS.Material>; textures: Set<THREE_NS.Texture>; skeletons: Set<{ dispose(): void }> } {
  const geometries = new Set<Disposable>()
  const materials = new Set<THREE_NS.Material>()
  const textures = new Set<THREE_NS.Texture>()
  const skeletons = new Set<{ dispose(): void }>()
  for (const root of roots) {
    root.traverse((object) => {
      const o = object as unknown as Owner
      if (o.geometry && typeof o.geometry.dispose === 'function') geometries.add(o.geometry)
      if (o.skeleton && typeof o.skeleton.dispose === 'function') skeletons.add(o.skeleton)
      const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
      for (const m of list) {
        if (!m || typeof m.dispose !== 'function') continue
        materials.add(m)
        texturesOf(m, textures)
      }
    })
  }
  return { geometries, materials, textures, skeletons }
}

const marked = new WeakSet<object>()
/**
 * Marks geometries, materials or textures as shared on purpose (a palette, a model kit, a catalog): `releaseObject3D` and `discardObject3D` never free
 * them. Same as `userData.shared = true`, without touching the resource (its bytes and userData stay as they were, for digests and goldens).
 */
export function markShared<T extends object>(...resources: T[]): T[] {
  for (const resource of resources) marked.add(resource)
  return resources
}
const shared = (r: { userData?: Record<string, unknown> }): boolean => r.userData?.shared === true || marked.has(r)

/**
 * Free the GPU side of trees taken out of the scene: their geometries, materials, textures (maps and shader uniforms) and skeletons. three.js keeps a removed
 * mesh's buffers, programs and textures on the GPU (and the JS objects in its caches) until `dispose()`, so every object a game removes without this stays
 * in memory for good. A resource marked `userData.shared = true`, or still used by a tree in `keep`, is left alone. Disposing a resource that is used again
 * later is safe: three.js uploads it again on the next draw.
 */
export function releaseObject3D(roots: THREE_NS.Object3D | readonly THREE_NS.Object3D[], options: ReleaseOptions = {}): ReleaseReport {
  const list = (Array.isArray(roots) ? roots : [roots]) as THREE_NS.Object3D[]
  const report: ReleaseReport = { geometries: 0, materials: 0, textures: 0 }
  if (list.length === 0) return report
  const found = collect(list)
  const keepRoots = options.keep === undefined ? [] : ((Array.isArray(options.keep) ? options.keep : [options.keep]) as THREE_NS.Object3D[])
  // a released tree still hanging under a kept one is not "kept": skip it while walking the kept trees
  const releasing = new Set<THREE_NS.Object3D>(list)
  for (const keep of keepRoots) {
    const walk = (o: THREE_NS.Object3D): void => {
      if (releasing.has(o)) return
      const owner = o as unknown as Owner
      if (owner.geometry) found.geometries.delete(owner.geometry)
      if (owner.skeleton) found.skeletons.delete(owner.skeleton)
      const mats = Array.isArray(owner.material) ? owner.material : owner.material ? [owner.material] : []
      for (const m of mats) {
        if (!m) continue
        found.materials.delete(m)
        const t = new Set<THREE_NS.Texture>()
        texturesOf(m, t)
        for (const x of t) found.textures.delete(x)
      }
      for (const c of o.children) walk(c)
    }
    walk(keep)
  }
  for (const g of found.geometries) {
    if (shared(g)) continue
    g.dispose()
    report.geometries++
  }
  for (const m of found.materials) {
    if (shared(m as unknown as Disposable)) continue
    m.dispose()
    report.materials++
  }
  for (const t of found.textures) {
    if (shared(t as unknown as Disposable)) continue
    t.dispose()
    report.textures++
  }
  for (const s of found.skeletons) s.dispose()
  return report
}

/**
 * Take `objects` out of their trees and free what only they used (`releaseObject3D`, keeping whatever the rest of those trees, usually the scene,
 * still draws). The one call for pieces, fragments, helpers or bodies that leave the game for good. A list costs one walk of each scene, so pass
 * the whole list instead of calling it once per object.
 */
export function discardObject3D(objects: THREE_NS.Object3D | readonly THREE_NS.Object3D[], options: ReleaseOptions = {}): ReleaseReport {
  const list = (Array.isArray(objects) ? objects : [objects]) as THREE_NS.Object3D[]
  const keep = options.keep === undefined ? [] : Array.isArray(options.keep) ? [...(options.keep as THREE_NS.Object3D[])] : [options.keep as THREE_NS.Object3D]
  for (const object of list) {
    let top = object
    while (top.parent) top = top.parent
    object.removeFromParent()
    if (top !== object && !keep.includes(top)) keep.push(top)
  }
  return releaseObject3D(list, { keep })
}
