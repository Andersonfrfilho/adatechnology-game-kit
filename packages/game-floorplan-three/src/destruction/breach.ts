import type { Kernel, Shared } from '../kernel-types.js'

/** The pieces of a house the destruction renderer draws; the breach view reads them from the structure the house assembled. */
export interface BreachViewOptions {
  house: any
  structure: any
  /** The destructible spec the world was given (units and layers per part). */
  spec: () => any
}

/** Collapses the vertices of a range of a merged mesh to one point (the piece vanishes) and returns what it overwrote. */
export function collapseRange(mesh: any, v0: number, v1: number): Float32Array {
  const pos = mesh.geometry.attributes.position
  const a = pos.array as Float32Array
  const saved = a.slice(v0 * 3, v1 * 3)
  const x = a[v0 * 3], y = a[v0 * 3 + 1], z = a[v0 * 3 + 2]
  for (let k = v0; k < v1; k++) { a[k * 3] = x; a[k * 3 + 1] = y; a[k * 3 + 2] = z }
  pos.needsUpdate = true
  return saved
}

/** Puts back what `collapseRange` overwrote. */
export function restoreRange(mesh: any, v0: number, saved: Float32Array): void {
  const pos = mesh.geometry.attributes.position
  ;(pos.array as Float32Array).set(saved, v0 * 3)
  pos.needsUpdate = true
}

/** Value noise in [0, 1] on a metric grid (`cell` metres), stable for a point: the ragged edge of the plaster around a hole. */
function noise2(x: number, y: number, cell: number): number {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s) }
  const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v)
  return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv) + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv
}

/** Metres per texel of the mask that cuts a wall where its units came out. */
const MASK_TEXEL = 0.02
/** Plaster (or concrete cover) that breaks off around a hole: the least and the extra a ragged edge adds, in metres. */
const SPALL_MIN = 0.025, SPALL_RAGGED = 0.045
/** Depth of the plaster over the units: what is seen inside the edge of a hole is the units this far behind the face. */
const COVER = 0.015

/**
 * Damage of a masonry wall or a concrete member, drawn where it happened. At full detail (LOD 0) the first unit that comes out (a `chip`, or the
 * opening of stage 2) moves the wall's range of the merged mesh to a mesh of its own with the same geometry, the same paint and the same material,
 * plus a mask in the plane of the wall: the face is cut only where units came out, with a ragged edge of plaster around them. Behind the cut the
 * units next to the hole are drawn (brick with its mortar joints, or rough concrete), so a hole shows the bricks of the wall and goes through
 * where units are missing. The rest of the wall stays exactly as the house painted it. At LOD 1 and 2 the wall goes back to its box (the
 * renderer's patch marks the damage). Fragments, spalling and the rebar cage belong to the destruction renderer.
 */
export function installDestructionBreach(K: Kernel, _shared: Shared): void {
  const { THREE, fragmentMaterial, invalidate, invalidateShadow } = K

  function createBreachView(opts: BreachViewOptions) {
    const { house, structure } = opts
    const views = new Map<string, any>()
    let lod = 0
    const unitMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
    const unitGeometry = new THREE.BoxGeometry(1, 1, 1)
    const tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }

    /** A world point in the house's own space (the space of the structure's parts). */
    const local = (p: number[]): number[] => {
      house.updateMatrixWorld(true)
      const v = house.worldToLocal(tmp.p.set(p[0], p[1], p[2]))
      return [v.x, v.y, v.z]
    }

    /** The units of a part: one cell per unit of its courses (running or stack bond), along the wall from `u0`/`v0` and up from `y0`. */
    function cells(part: any, units: any) {
      const [u0, v0, u1, v1] = part.aabb
      const alongU = u1 - u0 >= v1 - v0
      const len = alongU ? u1 - u0 : v1 - v0
      const [ul, uh] = units.size
      const rows = Math.max(1, Math.round((part.y1 - part.y0) / uh))
      const rowH = (part.y1 - part.y0) / rows
      const per = Math.max(1, Math.round(len / ul))
      const w = len / per
      const out: { a: number; b: number; y0: number; y1: number; r: number; i: number }[] = []
      for (let r = 0; r < rows; r++) {
        const shift = units.bond === 'running' && (r & 1) ? w / 2 : 0
        for (let i = 0; i < per + (shift ? 1 : 0); i++) {
          const a = Math.max(0, i * w - shift), b = Math.min(len, i * w - shift + w)
          if (b - a > 1e-3) out.push({ a, b, y0: part.y0 + r * rowH, y1: part.y0 + (r + 1) * rowH, r, i })
        }
      }
      return out
    }

    const specOf = (id: string) => opts.spec()?.parts?.find((q: any) => q.id === id)
    const same = (a: number[], b: number[]) => a.every((x, k) => Math.abs(x - b[k]) < 1e-3)

    /**
     * The part whose mesh draws `partId`: itself, or for a beam the house draws inside the wall under it (a bond beam behind the wall's plaster), that
     * wall.
     */
    function hostOf(partId: string): string | null {
      if (structure.meshesOf(partId).some((it: any) => it.mesh)) return partId
      const part = structure.byId.get(partId)
      if (!part) return null
      for (const q of structure.parts) {
        if (q.id !== partId && same(q.aabb, part.aabb) && Math.abs(q.y1 - part.y0) < 0.01 && structure.meshesOf(q.id).some((it: any) => it.mesh)) return q.id
      }
      return null
    }

    /** The beams with units the house draws inside the range of `hostId` (see `hostOf`). */
    const riders = (hostId: string): string[] =>
      structure.parts.filter((q: any) => q.id !== hostId && specOf(q.id)?.units && hostOf(q.id) === hostId && !structure.meshesOf(q.id).some((it: any) => it.mesh)).map((q: any) => q.id)

    /** The wall's range of the merged mesh as a mesh of its own, same transform, with a clone of its material that discards what the mask cuts. */
    function shell(it: any, mask: any) {
      const g0 = it.mesh.geometry, g = new THREE.BufferGeometry()
      const src = it.mesh.userData._p0 || g0.attributes.position.array
      for (const [name, attr] of Object.entries<any>(g0.attributes)) {
        const k = attr.itemSize
        g.setAttribute(name, new THREE.BufferAttribute((name === 'position' ? src : attr.array).slice(it.v0 * k, it.v1 * k), k))
      }
      if (g0.index) {
        const ix = g0.index.array.slice(it.i0, it.i1)
        for (let k = 0; k < ix.length; k++) ix[k] -= it.v0
        g.setIndex(new THREE.BufferAttribute(ix, 1))
      }
      g.computeBoundingBox(); g.computeBoundingSphere()
      const base = it.mesh.material
      const material = base.clone()
      const toHouse = { value: new THREE.Matrix4() }
      material.onBeforeCompile = (sh: any) => {
        base.onBeforeCompile?.(sh)
        sh.uniforms.uToHouse = toHouse
        sh.uniforms.uMask = { value: mask.texture }
        sh.uniforms.uMaskRect = { value: mask.rect }
        sh.uniforms.uMaskAlongX = { value: mask.alongU ? 1 : 0 }
        sh.vertexShader = sh.vertexShader
          .replace('void main() {', 'uniform mat4 uToHouse;\nvarying vec3 vHousePos;\nvoid main() {')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHousePos = (uToHouse * vec4(transformed, 1.0)).xyz;')
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform sampler2D uMask;\nuniform vec4 uMaskRect;\nuniform float uMaskAlongX;\nvarying vec3 vHousePos;\nvoid main() {\n'
            + '  vec2 mUv = vec2(((uMaskAlongX > 0.5 ? vHousePos.x : vHousePos.z) - uMaskRect.x) / uMaskRect.z, (vHousePos.y - uMaskRect.y) / uMaskRect.w);\n'
            + '  if (mUv.x >= 0.0 && mUv.x <= 1.0 && mUv.y >= 0.0 && mUv.y <= 1.0 && texture2D(uMask, mUv).r > 0.5) discard;')
      }
      material.customProgramCacheKey = () => 'breachMask' + (base.customProgramCacheKey?.() ?? '')
      const mesh = new THREE.Mesh(g, material)
      mesh.name = 'breach-shell'
      mesh.userData.breachMask = mask
      mesh.position.copy(it.mesh.position); mesh.quaternion.copy(it.mesh.quaternion); mesh.scale.copy(it.mesh.scale)
      mesh.castShadow = it.mesh.castShadow; mesh.receiveShadow = it.mesh.receiveShadow; mesh.renderOrder = it.mesh.renderOrder
      mesh.onBeforeRender = () => { house.updateMatrixWorld(); toHouse.value.copy(house.matrixWorld).invert().multiply(mesh.matrixWorld) }
      it.mesh.parent.add(mesh)
      mesh.updateMatrixWorld(true)
      toHouse.value.copy(house.matrixWorld).invert().multiply(mesh.matrixWorld)
      return mesh
    }

    /** The mask in the plane of the host wall (along the wall × height), spanning the host and the beams it draws. */
    function maskOf(hostId: string, parts: string[]) {
      const host = structure.byId.get(hostId)
      const [u0, v0, u1, v1] = host.aabb
      const alongU = u1 - u0 >= v1 - v0
      const y0 = Math.min(...parts.map((id) => structure.byId.get(id).y0)), y1 = Math.max(...parts.map((id) => structure.byId.get(id).y1))
      const len = alongU ? u1 - u0 : v1 - v0
      const w = Math.max(2, Math.min(2048, Math.ceil(len / MASK_TEXEL))), h = Math.max(2, Math.min(1024, Math.ceil((y1 - y0) / MASK_TEXEL)))
      const data = new Uint8Array(w * h)
      const texture = new THREE.DataTexture(data, w, h, THREE.RedFormat)
      texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true
      return { data, texture, w, h, alongU, start: alongU ? u0 : v0, len, y0, height: y1 - y0, rect: new THREE.Vector4(alongU ? u0 : v0, y0, len, y1 - y0) }
    }

    /** Distance from a point (along, y) to a box [a, b] × [c, d] (0 inside). */
    const boxDistance = (s: number, y: number, a: number, b: number, c: number, d: number) => Math.hypot(Math.max(a - s, 0, s - b), Math.max(c - y, 0, y - d))

    /**
     * The damage of the view, drawn again: which units of each part are gone, the mask (the gone units plus a ragged edge of plaster around them,
     * and the opening), and the units seen inside the edge of the cut.
     */
    function paint(view: any) {
      const { mask } = view
      const along = (p: number[]) => (mask.alongU ? p[0] : p[2]) - mask.start
      const holes: { a: number; b: number; y0: number; y1: number }[] = []
      const discs: { s: number; y: number; r: number }[] = []
      const shown: any[] = []
      for (const id of view.parts) {
        const part = structure.byId.get(id), units = specOf(id).units, chips = view.chips.get(id), opening = view.openings.get(id)
        const all = cells(part, units)
        const thick = mask.alongU ? part.aabb[3] - part.aabb[1] : part.aabb[2] - part.aabb[0]
        const mid = mask.alongU ? (part.aabb[1] + part.aabb[3]) / 2 : (part.aabb[0] + part.aabb[2]) / 2
        if (opening) discs.push({ s: along(opening.center), y: opening.center[1], r: opening.radius })
        const gone = (c: any) => chips.some((p: number[]) => p[1] >= c.y0 && p[1] <= c.y1 && along(p) >= c.a && along(p) <= c.b)
          || (opening && Math.hypot((c.a + c.b) / 2 - along(opening.center), (c.y0 + c.y1) / 2 - opening.center[1]) < opening.radius)
        const kept = []
        for (const c of all) (gone(c) ? holes : kept).push(c)
        for (const c of kept) shown.push({ c, part, units, thick, mid })
      }
      // the mask: what came out goes through, the plaster breaks off around it with a ragged edge
      const reach = SPALL_MIN + SPALL_RAGGED
      mask.data.fill(0)
      const stamp = (s0: number, s1: number, y0: number, y1: number, inside: (s: number, y: number) => number) => {
        const i0 = Math.max(0, Math.floor((s0 - reach) / mask.len * mask.w)), i1 = Math.min(mask.w - 1, Math.ceil((s1 + reach) / mask.len * mask.w))
        const j0 = Math.max(0, Math.floor((y0 - reach - mask.y0) / mask.height * mask.h)), j1 = Math.min(mask.h - 1, Math.ceil((y1 + reach - mask.y0) / mask.height * mask.h))
        for (let j = j0; j <= j1; j++) {
          const y = mask.y0 + (j + 0.5) / mask.h * mask.height
          for (let i = i0; i <= i1; i++) {
            const s = (i + 0.5) / mask.w * mask.len
            const edge = SPALL_MIN + SPALL_RAGGED * (0.6 * noise2(s, y, 0.03) + 0.4 * noise2(s + 7.3, y - 3.1, 0.011))
            if (inside(s, y) <= edge) mask.data[j * mask.w + i] = 255
          }
        }
      }
      for (const c of holes) stamp(c.a, c.b, c.y0, c.y1, (s, y) => boxDistance(s, y, c.a, c.b, c.y0, c.y1))
      for (const d of discs) stamp(d.s - d.r, d.s + d.r, d.y - d.r, d.y + d.r, (s, y) => Math.max(0, Math.hypot(s - d.s, y - d.y) - d.r))
      mask.texture.needsUpdate = true
      // the units the cut lays bare: those within reach of a hole
      const near = (c: any) => holes.some((h) => boxDistance((c.a + c.b) / 2, (c.y0 + c.y1) / 2, h.a - (c.b - c.a) / 2, h.b + (c.b - c.a) / 2, h.y0 - (c.y1 - c.y0) / 2, h.y1 + (c.y1 - c.y0) / 2) <= reach)
        || discs.some((d) => boxDistance(d.s, d.y, c.a, c.b, c.y0, c.y1) <= d.r + reach)
      const list: { x: number; y: number; z: number; sx: number; sy: number; sz: number; colour: number }[] = []
      const tone = (hex: number, k: number) => tmp.c.setHex(hex).multiplyScalar(k).getHex()
      for (const { c, part, units, thick, mid } of shown) {
        if (!near(c)) continue
        const centre = mask.start + (c.a + c.b) / 2, y = (c.y0 + c.y1) / 2, len = c.b - c.a, h = c.y1 - c.y0
        const at = (s: number, dy: number, d: number, colour: number) => list.push({ x: mask.alongU ? centre : mid, y, z: mask.alongU ? mid : centre, sx: mask.alongU ? s : d, sy: dy, sz: mask.alongU ? d : s, colour })
        const base = fragmentMaterial(part.material).color.getHex()
        const n = noise2(centre * 3.1, y * 2.7, 0.07)
        if (units.mortar === 'concrete') {
          // cast concrete: no joints, a rough face that goes in and out
          at(len, h, thick - 2 * COVER - 0.03 * n, tone(base, 0.86 + 0.2 * n))
        } else {
          // brick in its mortar: the joint behind, the unit a little smaller and standing out of it
          at(len, h, thick - 2 * COVER - 0.012, 0x9d978c)
          at(len - 0.012, h - 0.012, thick - 2 * COVER, tone(base, 0.8 + 0.35 * n))
        }
      }
      if (view.units) { view.units.removeFromParent(); view.units.dispose() }
      const units = new THREE.InstancedMesh(unitGeometry, unitMaterial, Math.max(1, list.length))
      units.name = 'breach:' + view.host
      list.forEach((u, i) => {
        tmp.m.compose(tmp.p.set(u.x, u.y, u.z), tmp.q.identity(), tmp.s.set(u.sx, u.sy, u.sz))
        units.setMatrixAt(i, tmp.m)
        units.setColorAt(i, tmp.c.setHex(u.colour))
      })
      units.count = list.length
      units.instanceMatrix.needsUpdate = true
      if (units.instanceColor) units.instanceColor.needsUpdate = true
      units.castShadow = true
      units.receiveShadow = true
      units.visible = lod === 0
      house.add(units)
      view.units = units
      view.gone = holes.length
    }

    /** Takes out of the wall of `partId` (or of the wall that draws it) the units the change removed, and draws the damage again. */
    function draw(partId: string, change: { opening?: { center: number[]; radius: number }; chip?: number[] }): boolean {
      if (lod !== 0) return false
      const hostId = hostOf(partId)
      if (!hostId || !specOf(partId)?.units) return false
      let view = views.get(hostId)
      if (!view) {
        const items = structure.meshesOf(hostId).filter((it: any) => it.mesh)
        if (!items.length) return false
        const parts = [hostId, ...riders(hostId)].filter((id) => structure.byId.get(id) && specOf(id)?.units)
        if (!parts.includes(partId)) return false
        const mask = maskOf(hostId, parts)
        view = { host: hostId, parts, items, mask, shells: [], saved: null, units: null, gone: 0, chips: new Map(parts.map((id) => [id, [] as number[][]])), openings: new Map() }
      }
      if (!view.chips.has(partId)) return false
      if (change.opening) {
        if (view.openings.has(partId)) return false
        view.openings.set(partId, { center: local(change.opening.center), radius: change.opening.radius })
      }
      if (change.chip) view.chips.get(partId).push(local(change.chip))
      if (!view.saved) {
        view.shells = view.items.map((it: any) => shell(it, view.mask))
        view.saved = view.items.map((it: any) => ({ it, v0: it.v0, data: collapseRange(it.mesh, it.v0, it.v1) }))
      }
      paint(view)
      views.set(hostId, view)
      invalidate(); invalidateShadow()
      return true
    }

    function plain(view: any, shown: boolean) {
      for (const s of view.saved) {
        if (shown) restoreRange(s.it.mesh, s.v0, s.data)
        else s.data = collapseRange(s.it.mesh, s.v0, s.it.v1)
      }
    }

    function dispose(view: any) {
      view.units.removeFromParent(); view.units.dispose()
      for (const m of view.shells) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose() }
      view.mask.texture.dispose()
    }

    return {
      /** Handles a `stage` event of the house's object. Returns true when the wall was cut. */
      stage(event: any): boolean { return event.stage === 2 && !!event.opening ? draw(event.part, { opening: event.opening }) : false },
      /** Handles a `chip` event: the unit that came out leaves a hole in the wall where it was. Returns true when the wall was cut. */
      chip(event: any): boolean { return draw(event.part, { chip: event.center }) },
      /** The part broke or fell: its damage goes (the plain range stays collapsed, the renderer hides the part). */
      drop(partId: string): void {
        const v = views.get(partId)
        if (!v) return
        dispose(v); views.delete(partId)
      },
      /** LOD 0 draws the cut wall; LOD 1 and 2 give the wall its box back. */
      setLod(level: number): void {
        const was = lod; lod = level
        if ((was === 0) === (level === 0)) return
        for (const v of views.values()) {
          v.units.visible = level === 0
          for (const m of v.shells) m.visible = level === 0
          plain(v, level !== 0)
        }
        invalidate(); invalidateShadow()
      },
      /** Everything back to what it was (after `world.reset`). */
      restore(): void {
        for (const v of views.values()) {
          dispose(v)
          if (lod === 0) plain(v, true)
        }
        views.clear()
      },
      /** The wall has damage drawn. */
      has(partId: string): boolean { return views.has(partId) },
      /** Walls with damage drawn, units out of them, and units laid bare at the edge of the cuts. */
      statistics: () => ({
        walls: views.size,
        gone: [...views.values()].reduce((n, v) => n + v.gone, 0),
        units: [...views.values()].reduce((n, v) => n + v.units.count, 0),
      }),
    }
  }

  Object.assign(K, { createBreachView })
}
