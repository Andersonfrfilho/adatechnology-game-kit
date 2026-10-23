import type { Motion, ObjectSpec } from '@adatechnology/game-interactables'
import { poseOf } from './pose'
import type { ThreeLib, ThreeNS } from './types'

export interface MergeOptions {
  /** Idle flutter of merged cloth (see `SwayOptions.amplitude`). Default 0.04. */
  swayAmplitude?: number
}

/** Posed by `syncObject` in place of the part groups it replaced. */
export interface PoseBatch {
  kind: 'pose'
  /** Part ids that moved into the batch. */
  ids: string[]
  /** Applies the motion at `t` to every vertex, each around its own pivot. */
  apply(motion: Motion, t: number): void
}

/** Cloth hanging from a line: every merged cloth swings with its own (ax, az). */
export interface SwayBatch {
  kind: 'sway'
  /** Soft volume id -> index. */
  index: Record<string, number>
  setAt(index: number, ax: number, az: number): void
  setTime(time: number): void
}

export type MergedGroup = ThreeNS.Group & { userData: { merged: PoseBatch | SwayBatch } }

const QROT = /* glsl */ `
vec3 batchRotate(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`

function patchProgram<M extends ThreeNS.Material>(material: M, key: string, patchShader: (shader: { uniforms: Record<string, any>; vertexShader: string }) => void, inherit?: ThreeNS.Material): M {
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    patchShader(shader)
  }
  const inherited = inherit?.customProgramCacheKey
  material.customProgramCacheKey = inherited && inherit ? () => `${inherited.call(inherit)}|${key}` : () => key
  return material
}

/**
 * `Material.clone()` drops `onBeforeCompile`, `customProgramCacheKey` and (for some classes) `defines`. A merged group must still look
 * like the material the host passed in (a light mask, a fog patch...), so the clone gets them back before the batch patch is chained on.
 */
function cloneKeepingHooks(base: ThreeNS.Material): ThreeNS.Material {
  const clone = base.clone()
  if (base.defines) clone.defines = { ...(clone.defines ?? {}), ...base.defines }
  if (base.onBeforeCompile !== Object.getPrototypeOf(base).onBeforeCompile) clone.onBeforeCompile = base.onBeforeCompile
  clone.userData = { ...base.userData, mergedFrom: base.uuid }
  return clone
}

/** Material, depth material and distance material patched by the same function, so shadows follow the animation. */
function patchedSet(THREE: ThreeLib, base: ThreeNS.Material, key: string, patchShader: (shader: { uniforms: Record<string, any>; vertexShader: string }) => void) {
  return {
    material: patchProgram(cloneKeepingHooks(base), key, patchShader, base),
    depth: patchProgram(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), key, patchShader),
    distance: patchProgram(new THREE.MeshDistanceMaterial(), key, patchShader),
  }
}

interface Piece {
  geometry: ThreeNS.BufferGeometry
  matrix: ThreeNS.Matrix4
  /** Per-vertex extra attributes of this piece. */
  extra: Record<string, number[]>
}

/** Concatenates pieces (positions and normals moved by their matrices) into one geometry with the extra attributes. */
function concat(THREE: ThreeLib, pieces: Piece[], extraSizes: Record<string, number>): ThreeNS.BufferGeometry {
  let verts = 0
  let idx = 0
  for (const p of pieces) {
    verts += p.geometry.getAttribute('position').count
    idx += p.geometry.index!.count
  }
  const pos = new Float32Array(verts * 3)
  const nor = new Float32Array(verts * 3)
  const col = new Float32Array(verts * 3)
  const uv = new Float32Array(verts * 2)
  const index = new Uint32Array(idx)
  const extra: Record<string, Float32Array> = {}
  for (const [k, n] of Object.entries(extraSizes)) extra[k] = new Float32Array(verts * n)
  const v = new THREE.Vector3()
  const n3 = new THREE.Matrix3()
  let vo = 0
  let io = 0
  for (const p of pieces) {
    const g = p.geometry
    const count = g.getAttribute('position').count
    n3.getNormalMatrix(p.matrix)
    const gp = g.getAttribute('position')
    const gn = g.getAttribute('normal')
    const gc = g.getAttribute('color')
    const gu = g.getAttribute('uv')
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(gp, i).applyMatrix4(p.matrix)
      pos.set([v.x, v.y, v.z], (vo + i) * 3)
      v.fromBufferAttribute(gn, i).applyMatrix3(n3).normalize()
      nor.set([v.x, v.y, v.z], (vo + i) * 3)
      col.set([gc.getX(i), gc.getY(i), gc.getZ(i)], (vo + i) * 3)
      uv.set([gu.getX(i), gu.getY(i)], (vo + i) * 2)
    }
    for (const [k, values] of Object.entries(p.extra)) extra[k].set(values, vo * extraSizes[k])
    const gi = g.index!
    for (let i = 0; i < gi.count; i++) index[io + i] = gi.getX(i) + vo
    vo += count
    io += gi.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('color', new THREE.BufferAttribute(col, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  for (const [k, n] of Object.entries(extraSizes)) out.setAttribute(k, new THREE.BufferAttribute(extra[k], n))
  out.setIndex(new THREE.BufferAttribute(verts > 65535 ? index : new Uint16Array(index), 1))
  out.computeBoundingSphere()
  out.computeBoundingBox()
  return out
}

function meshesOf(group: ThreeNS.Object3D): ThreeNS.Mesh[] {
  return group.children.filter((c): c is ThreeNS.Mesh => (c as ThreeNS.Mesh).isMesh)
}

/**
 * Merges parts after `finish()` to cut draw calls (the `mergeParts` option of `createMeshApi`):
 *
 * - parts of one `PartSpec.group` with the same motion (blind slats) become one mesh per material whose vertices carry their own pivot;
 *   `syncObject` poses them with one set of uniforms and the shadow materials follow;
 * - `cloth` soft volumes (clothes on a line) become one mesh per material with a per-vertex cloth index and anchor height; each
 *   cloth keeps its own swing.
 *
 * The merged group is added to `root`, the part groups are removed, and `parts[id]` points at the merged group for every member.
 * Parts that carry a mirror, that are turned (`ry`) or that stand alone are left as they are.
 */
export function mergeParts(THREE: ThreeLib, root: ThreeNS.Group, parts: Record<string, ThreeNS.Group>, spec: ObjectSpec, options: MergeOptions = {}): void {
  const amplitude = options.swayAmplitude ?? 0.04
  const skip = new Set<string>()
  for (const m of spec.mirrors ?? []) if (m.part) skip.add(m.part)
  for (const [id, g] of Object.entries(parts)) if (Math.abs(g.rotation.y) > 1e-9 || g.userData.merged) skip.add(id)

  const take = (ids: string[]): ThreeNS.Group[] => ids.map((id) => parts[id])
  const retire = (ids: string[], merged: ThreeNS.Group): void => {
    for (const id of ids) {
      const g = parts[id]
      g.removeFromParent()
      for (const m of meshesOf(g)) m.geometry.dispose()
      parts[id] = merged
    }
    root.add(merged)
  }
  const byMaterial = (groups: ThreeNS.Group[], extra: (g: ThreeNS.Group, count: number) => Record<string, number[]>) => {
    const map = new Map<string, { base: ThreeNS.Material; pieces: Piece[]; mesh: ThreeNS.Mesh }>()
    for (const g of groups) {
      g.updateMatrix()
      for (const mesh of meshesOf(g)) {
        const key = `${String(mesh.userData.material)}|${(mesh.material as ThreeNS.Material).uuid}`
        let e = map.get(key)
        if (!e) {
          e = { base: mesh.material as ThreeNS.Material, pieces: [], mesh }
          map.set(key, e)
        }
        e.pieces.push({ geometry: mesh.geometry, matrix: g.matrix, extra: extra(g, mesh.geometry.getAttribute('position').count) })
      }
    }
    return map
  }
  const finishMesh = (name: string, key: string, geometry: ThreeNS.BufferGeometry, template: ThreeNS.Mesh, set: ReturnType<typeof patchedSet>, group: ThreeNS.Group): void => {
    const mesh = new THREE.Mesh(geometry, set.material)
    mesh.name = `${name}:${key}`
    mesh.userData.material = key
    mesh.castShadow = template.castShadow
    mesh.receiveShadow = template.receiveShadow
    mesh.customDepthMaterial = set.depth
    mesh.customDistanceMaterial = set.distance
    group.add(mesh)
  }

  // ---- cloth: one swing per soft volume, merged per material -------------------------------------------------------------------
  const cloths = (spec.soft ?? []).filter((s) => s.kind === 'cloth' && parts[s.part ?? s.id] && !skip.has(s.part ?? s.id))
  const clothPart = (s: { id: string; part?: string }) => s.part ?? s.id
  const toggled = new Set<string>()
  for (const i of spec.interactions ?? []) {
    const a = i.action as { do: string; part?: string }
    if (a.do === 'toggle_part' && a.part) toggled.add(a.part)
  }
  const swing = cloths.filter((s) => !toggled.has(clothPart(s)))
  if (swing.length >= 2) {
    const ids = swing.map(clothPart)
    const index: Record<string, number> = {}
    swing.forEach((s, i) => (index[s.id] = i))
    const indexOfPart = new Map(swing.map((s, i) => [clothPart(s), i]))
    const anchorOfPart = new Map(swing.map((s) => [clothPart(s), s.anchor[1]]))
    const n = swing.length
    const uniforms = { time: { value: 0 }, axz: { value: Array.from({ length: n }, () => new THREE.Vector2()) } }
    const groups = take(ids)
    const partIdOf = new Map(groups.map((g, i) => [g, ids[i]]))
    const plan = byMaterial(groups, (g, count) => {
      const id = partIdOf.get(g)!
      return { swayId: new Array(count).fill(indexOf(indexOfPart, id)), swayAnchor: new Array(count).fill(anchorOfPart.get(id) ?? 0) }
    })
    const merged = new THREE.Group() as unknown as MergedGroup
    merged.name = 'merge:cloth'
    const patch = (shader: { uniforms: Record<string, any>; vertexShader: string }): void => {
      shader.uniforms.swayTime = uniforms.time
      shader.uniforms.swayAxz = uniforms.axz
      shader.vertexShader =
        `attribute float swayId;\nattribute float swayAnchor;\nuniform float swayTime;\nuniform vec2 swayAxz[${n}];\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  vec2 swayA = swayAxz[int(swayId + 0.5)];
  float swayHang = max(swayAnchor - position.y, 0.0);
  float swayFlutter = ${amplitude.toFixed(4)} * sin(swayTime * 1.9 + swayId * 1.7 + position.x * 4.0 + position.z * 3.0 + swayHang * 3.0);
  transformed.x += swayHang * (sin(swayA.y) + swayFlutter);
  transformed.z += swayHang * (-sin(swayA.x) + swayFlutter * 0.6);
  transformed.y += swayHang * (1.0 - cos(swayA.y) * cos(swayA.x));
}`,
        )
    }
    for (const e of plan.values()) {
      const key = String(e.mesh.userData.material)
      const set = patchedSet(THREE, e.base, `swayBatch:${n}:${amplitude}`, patch)
      finishMesh('merge:cloth', key, concat(THREE, e.pieces, { swayId: 1, swayAnchor: 1 }), e.mesh, set, merged)
    }
    const batch: SwayBatch = {
      kind: 'sway',
      index,
      setAt(i, ax, az) {
        uniforms.axz.value[i].set(ax, az)
      },
      setTime(t) {
        uniforms.time.value = t
      },
    }
    merged.userData.merged = batch
    retire(ids, merged)
    for (const id of ids) skip.add(id)
  }

  // ---- grouped parts with identical motion (blind slats) -----------------------------------------------------------------------
  const bySignature = new Map<string, string[]>()
  for (const p of spec.parts ?? []) {
    if (!p.group || !parts[p.id] || skip.has(p.id)) continue
    const sig = `${p.group}|${JSON.stringify(p.motion)}`
    const list = bySignature.get(sig)
    if (list) list.push(p.id)
    else bySignature.set(sig, [p.id])
  }
  for (const [sig, ids] of bySignature) {
    if (ids.length < 2) continue
    const motion = (spec.parts ?? []).find((p) => p.id === ids[0])!.motion
    const uniforms = { q: { value: new THREE.Vector4(0, 0, 0, 1) }, pos: { value: new THREE.Vector3() }, scale: { value: new THREE.Vector3(1, 1, 1) } }
    const groups = take(ids)
    const plan = byMaterial(groups, (g, count) => {
      const pv = new Array<number>(count * 3)
      for (let i = 0; i < count; i++) {
        pv[i * 3] = g.position.x
        pv[i * 3 + 1] = g.position.y
        pv[i * 3 + 2] = g.position.z
      }
      return { batchPivot: pv }
    })
    const merged = new THREE.Group() as unknown as MergedGroup
    merged.name = `merge:${sig.split('|')[0]}`
    const patch = (shader: { uniforms: Record<string, any>; vertexShader: string }): void => {
      shader.uniforms.batchQ = uniforms.q
      shader.uniforms.batchPos = uniforms.pos
      shader.uniforms.batchScale = uniforms.scale
      let src = `attribute vec3 batchPivot;\nuniform vec4 batchQ;\nuniform vec3 batchPos;\nuniform vec3 batchScale;\n${QROT}${shader.vertexShader}`
      src = src.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = batchPivot + batchRotate(batchQ, (position - batchPivot) * batchScale) + batchPos;')
      src = src.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = batchRotate(batchQ, objectNormal);')
      shader.vertexShader = src
    }
    for (const e of plan.values()) {
      const key = String(e.mesh.userData.material)
      const set = patchedSet(THREE, e.base, 'poseBatch', patch)
      finishMesh(merged.name, key, concat(THREE, e.pieces, { batchPivot: 3 }), e.mesh, set, merged)
    }
    const batch: PoseBatch = {
      kind: 'pose',
      ids,
      apply(m, t) {
        const pose = poseOf(m, t)
        uniforms.q.value.set(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3])
        uniforms.pos.value.set(pose.position[0], pose.position[1], pose.position[2])
        uniforms.scale.value.set(pose.scale[0], pose.scale[1], pose.scale[2])
      },
    }
    batch.apply(motion, 0)
    merged.userData.merged = batch
    retire(ids, merged)
  }
}

function indexOf(map: Map<string, number>, id: string): number {
  return map.get(id) ?? 0
}
