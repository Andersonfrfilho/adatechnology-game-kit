/**
 * The light mode of the team's Frota Leve (frota-leve.js 14202-14310): a built vehicle fused into six meshes, one per class of material,
 * with the meshes nobody sees from outside left out. A literal port: the classes, the thresholds (3 cm prune, 0.99 opacity, 0.5 metalness,
 * 0.25 and 0.45 emissive) and the colours are the team's.
 */

/** The six classes of a fused vehicle, in the order they are added to the group. */
export const LITE_CLASSES = ['paint', 'trim', 'metal', 'glass', 'light', 'plate'] as const
export type LiteClass = (typeof LITE_CLASSES)[number]

/** Smallest extent in metres a piece needs to survive the fusion (the plate is always kept). */
export const PRUNE_BELOW = 0.03

interface Accumulator {
  P: number[]
  N: number[]
  C: number[]
  U: number[]
  I: number[]
  nv: number
  alpha: boolean
  uv: boolean
  map: any
}

export interface LiteFusion {
  acc: Record<LiteClass, Accumulator>
  pruned: number
}

const createAccumulators = (): Record<LiteClass, Accumulator> => {
  const acc = {} as Record<LiteClass, Accumulator>
  for (const name of LITE_CLASSES) acc[name] = { P: [], N: [], C: [], U: [], I: [], nv: 0, alpha: name === 'glass', uv: name === 'plate', map: null }
  return acc
}

/** Which class a material belongs to, or `null` when it is left out. */
export function classify(mat: any, mesh: any, c: any): LiteClass | null {
  if (mat.map) {
    if (mesh.userData.plate) return 'plate'
    if ((mat.userData && mat.userData.grille) || mat.name === 'grille' || (mat.metalness != null && mat.roughness != null && !mat.transparent)) return 'trim'
    return null
  }
  if (mat.transparent && mat.opacity < 0.99) {
    const col = mat.color
    if (col.r > col.g + col.b * 0.9 && col.r > 0.35) return 'light'
    if (col.r > 0.8 && col.g > 0.8 && mat.opacity < 0.3) return null
    return 'glass'
  }
  if (mat.isMeshBasicMaterial) return null
  const e = mat.emissive
  const ei = mat.emissiveIntensity == null ? 1 : mat.emissiveIntensity
  if (e && ((e.r + e.g + e.b) / 3) * ei > 0.25 && !mat.metalness) return 'light'
  if (e && ((e.r + e.g + e.b) / 3) * ei > 0.45) return 'light'
  if (mat.metalness >= 0.5) return 'metal'
  if (c.paints && c.paints.has(mat)) return 'paint'
  if (mat.opacity < 1 && mat.transparent) return null
  return 'trim'
}

/** The vertex colour of a piece of a class. `paintColor` replaces the primary paint. */
export function classColor(mat: any, cls: LiteClass, primary: any, paintColor: any, out: any): any {
  if (cls === 'paint' && paintColor && mat === primary) return out.copy(paintColor)
  if (cls === 'light') {
    const e = mat.emissive
    const ei = mat.emissiveIntensity == null ? 1 : mat.emissiveIntensity
    if (e && e.r + e.g + e.b > 0.05) {
      out.copy(e).multiplyScalar(Math.max(1, ei) * 1.0)
      out.r = Math.min(out.r, 1)
      out.g = Math.min(out.g, 1)
      out.b = Math.min(out.b, 1)
      return out
    }
    return out.copy(mat.color)
  }
  if (mat.map) return out.setRGB(0.12, 0.13, 0.14)
  return out.copy(mat.color)
}

/** The material of each class (vertex colours; glass blends; light is unlit; the plate keeps its canvas texture). */
export function liteMaterials(THREE: any, environment: any): Record<LiteClass, any> {
  return {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.3, side: THREE.DoubleSide, envMap: environment, envMapIntensity: 0.35 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.08, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.85, envMap: environment, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.06, metalness: 0.3, side: THREE.DoubleSide, envMap: environment, envMapIntensity: 0.9 }),
    light: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    plate: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }),
  }
}

/**
 * Walks the built vehicle and collects every visible mesh, in the frame of `pivot`, into one set of arrays per class.
 * `hidden` is the set of materials nobody sees from outside (`kit.lodHiddenMaterials()`).
 */
export function fuse(THREE: any, c: any, pivot: any, paintColor: any, primary: any, hidden: ReadonlySet<any>): LiteFusion {
  const acc = createAccumulators()
  const mw = new THREE.Matrix4()
  const nm = new THREE.Matrix3()
  const v = new THREE.Vector3()
  const col = new THREE.Color()
  const tmp = new THREE.Box3()
  let pruned = 0
  c.vehicle.updateMatrixWorld(true)
  c.vehicle.traverse((o: any) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return
    for (let p = o; p; p = p.parent) if (p.visible === false) return
    if (o.userData && (o.userData.ghost || o.userData.skipLite)) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const geo = o.geometry
    mw.multiplyMatrices(pivot, o.matrixWorld)
    nm.getNormalMatrix(mw)
    const flip = mw.determinant() < 0
    geo.computeBoundingBox()
    tmp.copy(geo.boundingBox).applyMatrix4(mw)
    const ext = Math.max(tmp.max.x - tmp.min.x, tmp.max.y - tmp.min.y, tmp.max.z - tmp.min.z)
    const pa = geo.attributes.position
    const na = geo.attributes.normal
    const ua = geo.attributes.uv
    const ca = geo.attributes.color
    const ix = geo.index
    const tot = ix ? ix.count : pa.count
    const groups = Array.isArray(o.material) && geo.groups.length ? geo.groups : [{ start: 0, count: tot, materialIndex: 0 }]
    groups.forEach((gr: any) => {
      const mat = mats[gr.materialIndex] || mats[0]
      if (!mat || hidden.has(mat)) return
      const cls = classify(mat, o, c)
      if (!cls) return
      if (ext < PRUNE_BELOW && cls !== 'plate') {
        pruned++
        return
      }
      const A = acc[cls]
      const a0 = Math.min(gr.start, tot)
      let n0 = Math.min(gr.count, tot - a0)
      n0 -= n0 % 3
      if (n0 < 3) return
      const cc = classColor(mat, cls, primary, paintColor, col)
      const alpha = cls === 'glass' ? (mat.transparent ? mat.opacity : 1) : 1
      if (cls === 'plate' && A.map && mat.map !== A.map) return
      if (cls === 'plate') A.map = mat.map
      const remap = new Map<number, number>()
      for (let i = 0; i < n0; i++) {
        const vi = ix ? ix.getX(a0 + i) : a0 + i
        if (remap.has(vi)) continue
        remap.set(vi, A.nv++)
        v.fromBufferAttribute(pa, vi).applyMatrix4(mw)
        A.P.push(v.x, v.y, v.z)
        if (na) {
          v.fromBufferAttribute(na, vi).applyMatrix3(nm).normalize()
          A.N.push(v.x, v.y, v.z)
        } else A.N.push(0, 1, 0)
        let cr = cc.r
        let cg = cc.g
        let cb = cc.b
        if (ca && cls !== 'plate') {
          cr *= ca.getX(vi)
          cg *= ca.getY(vi)
          cb *= ca.getZ(vi)
        }
        if (A.alpha) A.C.push(cr, cg, cb, alpha)
        else A.C.push(cr, cg, cb)
        if (A.uv) A.U.push(ua ? ua.getX(vi) : 0, ua ? ua.getY(vi) : 0)
      }
      for (let t = 0; t < n0; t += 3) {
        const i0 = remap.get(ix ? ix.getX(a0 + t) : a0 + t) as number
        const i1 = remap.get(ix ? ix.getX(a0 + t + 1) : a0 + t + 1) as number
        const i2 = remap.get(ix ? ix.getX(a0 + t + 2) : a0 + t + 2) as number
        if (flip) A.I.push(i0, i2, i1)
        else A.I.push(i0, i1, i2)
      }
    })
  })
  return { acc, pruned }
}

/** One mesh per class that has triangles. */
export function liteMeshes(THREE: any, fusion: LiteFusion, materials: Record<LiteClass, any>): any[] {
  const meshes: any[] = []
  for (const name of LITE_CLASSES) {
    const A = fusion.acc[name]
    if (!A.I.length) continue
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(A.N, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(A.C, A.alpha ? 4 : 3))
    if (A.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(A.U, 2))
    g.setIndex(A.nv > 65535 ? new THREE.Uint32BufferAttribute(A.I, 1) : new THREE.Uint16BufferAttribute(A.I, 1))
    g.computeBoundingBox()
    g.computeBoundingSphere()
    let mt = materials[name]
    if (name === 'plate') {
      mt = mt.clone()
      mt.map = A.map
      if (mt.map) mt.map.needsUpdate = true
    }
    const mesh = new THREE.Mesh(g, mt)
    mesh.name = name
    mesh.castShadow = name !== 'glass' && name !== 'light'
    mesh.receiveShadow = name !== 'light'
    meshes.push(mesh)
  }
  return meshes
}
