import type { Kernel, Shared } from '../kernel-types.js'

/** The pieces of a house the destruction renderer draws; the breach view reads them from the structure the house assembled. */
export interface BreachViewOptions {
  house: any
  structure: any
  /** The destructible spec the world was given (units and layers per part). */
  spec: () => any
}

/**
 * Collapses the vertices of a range of a merged mesh to one point (the piece vanishes) and returns what it overwrote. The range is listed in
 * `userData.collapsedRanges` and the mesh's first positions kept in `userData._p0`, so a renderer that rewrites the mesh (the destruction renderer's dents
 * and hidden parts) keeps it collapsed and puts back the right positions.
 */
export function collapseRange(mesh: any, v0: number, v1: number): Float32Array {
  const pos = mesh.geometry.attributes.position
  const a = pos.array as Float32Array
  const u = mesh.userData
  if (!u._p0) u._p0 = a.slice()
  const list: Array<[number, number]> = (u.collapsedRanges ??= [])
  if (!list.some((r) => r[0] === v0 && r[1] === v1)) list.push([v0, v1])
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
  const list: Array<[number, number]> | undefined = mesh.userData.collapsedRanges
  if (list) mesh.userData.collapsedRanges = list.filter((r) => r[0] !== v0)
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
/** Patches of plaster off a wall a view keeps (the oldest goes). */
const MAX_FLAKES = 64

/**
 * Damage of a masonry wall or a concrete member, drawn where it happened. At full detail (LOD 0) the first `chip` (a unit that came out, or a crater a
 * shot broke through one) or the opening of stage 2 moves the wall's range of the merged mesh to a mesh of its own with the same geometry, the same
 * paint and the same material, plus a mask in the plane of the wall: the face is cut only where units came out or were broken through, with a ragged
 * edge of plaster around them. Behind the cut the units next to the hole are drawn (brick with its mortar joints, or rough concrete), themselves cut
 * through where a shot broke them (an irregular crater; the rest of the unit stays), so a hole shows the bricks of the wall and goes through where
 * units are missing or broken. The rest of the wall stays exactly as the house painted it. At LOD 1 and 2 the wall goes back to its box (the
 * renderer's patch marks the damage). Fragments, spalling and the rebar cage belong to the destruction renderer.
 */
export function installDestructionBreach(K: Kernel, _shared: Shared): void {
  const { THREE, fragmentMaterial, invalidate, invalidateShadow } = K

  function createBreachView(opts: BreachViewOptions) {
    const { house, structure } = opts
    const views = new Map<string, any>()
    /** Views of walls that broke or fell, whose ranges are still collapsed. */
    const dropped: any[] = []
    let lod = 0
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
      // a mark that lands on the wall where it is cut goes on what is behind (the decals of the destruction renderer ask this)
      mesh.userData.cutAt = (p: { x: number; y: number; z: number }) => {
        const v = local([p.x, p.y, p.z])
        const i = Math.floor(((mask.alongU ? v[0] : v[2]) - mask.start) / mask.len * mask.w), j = Math.floor((v[1] - mask.y0) / mask.height * mask.h)
        return i >= 0 && i < mask.w && j >= 0 && j < mask.h && mask.data[j * mask.w + i] > 127
      }
      mesh.position.copy(it.mesh.position); mesh.quaternion.copy(it.mesh.quaternion); mesh.scale.copy(it.mesh.scale)
      mesh.castShadow = it.mesh.castShadow; mesh.receiveShadow = it.mesh.receiveShadow; mesh.renderOrder = it.mesh.renderOrder
      mesh.onBeforeRender = () => { house.updateMatrixWorld(); toHouse.value.copy(house.matrixWorld).invert().multiply(mesh.matrixWorld) }
      it.mesh.parent.add(mesh)
      mesh.updateMatrixWorld(true)
      toHouse.value.copy(house.matrixWorld).invert().multiply(mesh.matrixWorld)
      return mesh
    }

    /**
     * The material of the units laid bare in a wall: white lit by the colour of each instance, cut through where shots broke the units (`core`, a mask
     * like the wall's), and darker on the faces seen from inside a unit (the walls of a crater).
     */
    function unitsMaterial(core: any) {
      const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      material.onBeforeCompile = (sh: any) => {
        sh.uniforms.uCore = { value: core.texture }
        sh.uniforms.uCoreRect = { value: core.rect }
        sh.uniforms.uCoreAlongX = { value: core.alongU ? 1 : 0 }
        sh.vertexShader = sh.vertexShader
          .replace('void main() {', 'varying vec3 vHousePos;\nvoid main() {')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvHousePos = (instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvHousePos = transformed;\n#endif')
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform sampler2D uCore;\nuniform vec4 uCoreRect;\nuniform float uCoreAlongX;\nvarying vec3 vHousePos;\nvoid main() {\n'
            + '  vec2 cUv = vec2(((uCoreAlongX > 0.5 ? vHousePos.x : vHousePos.z) - uCoreRect.x) / uCoreRect.z, (vHousePos.y - uCoreRect.y) / uCoreRect.w);\n'
            + '  if (cUv.x >= 0.0 && cUv.x <= 1.0 && cUv.y >= 0.0 && cUv.y <= 1.0 && texture2D(uCore, cUv).r > 0.5) discard;')
          .replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.55;')
      }
      material.customProgramCacheKey = () => 'breachCore'
      material.userData.breachCore = core
      return material
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

    /** Distance outside the ellipse inscribed in a box (centre `cs`, `cy`, half sizes `rs`, `ry`), roughly in metres (negative inside). */
    const ellipseDistance = (s: number, y: number, cs: number, cy: number, rs: number, ry: number) =>
      (Math.hypot((s - cs) / Math.max(rs, 1e-4), (y - cy) / Math.max(ry, 1e-4)) - 1) * Math.min(rs, ry)

    /** Share of a cell [a, b] × [y0, y1] the boxes cover (overlaps between them counted once, on a coarse grid). */
    function covered(c: any, boxes: any[]): number {
      const n = 8
      let hit = 0
      for (let j = 0; j < n; j++) {
        const y = c.y0 + ((j + 0.5) / n) * (c.y1 - c.y0)
        for (let i = 0; i < n; i++) {
          const s = c.a + ((i + 0.5) / n) * (c.b - c.a)
          if (boxes.some((k) => s >= k.s0 && s <= k.s1 && y >= k.y0 && y <= k.y1)) hit++
        }
      }
      return hit / (n * n)
    }

    /**
     * The damage of the view, drawn again: which units of each part are gone, where shots broke through the units that stay (a crater: an irregular
     * hole through the unit, the plaster broken off around it), the masks (what is gone or broken through, plus a ragged edge of plaster around it,
     * and the opening) and the units seen inside the edge of the cut.
     */
    function paint(view: any) {
      const { mask, core } = view
      const along = (p: number[]) => (mask.alongU ? p[0] : p[2]) - mask.start
      const holes: { a: number; b: number; y0: number; y1: number }[] = []
      const pits: { s: number; y: number; rs: number; ry: number }[] = []
      const discs: { s: number; y: number; r: number }[] = []
      // where the plaster (or the cover) came off and the unit under it stayed: a patch of the face, ragged at the edge
      const flakes: { s: number; y: number; r: number }[] = []
      const shown: any[] = []
      for (const id of view.parts) {
        const part = structure.byId.get(id), units = specOf(id).units, chips = view.chips.get(id), opening = view.openings.get(id), spalls = view.spalls.get(id)
        const all = cells(part, units)
        const thick = mask.alongU ? part.aabb[3] - part.aabb[1] : part.aabb[2] - part.aabb[0]
        const mid = mask.alongU ? (part.aabb[1] + part.aabb[3]) / 2 : (part.aabb[0] + part.aabb[2]) / 2
        if (opening) discs.push({ s: along(opening.center), y: opening.center[1], r: opening.radius })
        for (const k of spalls) flakes.push({ s: along(k.center), y: k.center[1], r: k.radius })
        const boxes = chips.map((k: any) => ({ s0: along(k.center) - k.along, s1: along(k.center) + k.along, y0: k.center[1] - k.up, y1: k.center[1] + k.up }))
        const gone = (c: any) => covered(c, boxes.filter((k: any) => k.s1 > c.a && k.s0 < c.b && k.y1 > c.y0 && k.y0 < c.y1)) >= 0.9
          || (opening && Math.hypot((c.a + c.b) / 2 - along(opening.center), (c.y0 + c.y1) / 2 - opening.center[1]) < opening.radius)
        const kept = []
        for (const c of all) (gone(c) ? holes : kept).push(c)
        for (const c of kept) shown.push({ c, part, units, thick, mid })
        // the shots that broke a unit and left the rest of it: a crater in it
        for (const k of boxes) {
          if (holes.some((h) => k.s0 >= h.a - 1e-4 && k.s1 <= h.b + 1e-4 && k.y0 >= h.y0 - 1e-4 && k.y1 <= h.y1 + 1e-4)) continue
          pits.push({ s: (k.s0 + k.s1) / 2, y: (k.y0 + k.y1) / 2, rs: (k.s1 - k.s0) / 2, ry: (k.y1 - k.y0) / 2 })
        }
      }
      // the masks: what came out or was broken through goes through, the plaster breaks off around it with a ragged edge
      const reach = SPALL_MIN + SPALL_RAGGED
      const ragged = (s: number, y: number) => 0.6 * noise2(s, y, 0.03) + 0.4 * noise2(s + 7.3, y - 3.1, 0.011)
      mask.data.fill(0)
      core.data.fill(0)
      const stamp = (m: any, s0: number, s1: number, y0: number, y1: number, inside: (s: number, y: number) => boolean) => {
        const i0 = Math.max(0, Math.floor((s0 - reach) / m.len * m.w)), i1 = Math.min(m.w - 1, Math.ceil((s1 + reach) / m.len * m.w))
        const j0 = Math.max(0, Math.floor((y0 - reach - m.y0) / m.height * m.h)), j1 = Math.min(m.h - 1, Math.ceil((y1 + reach - m.y0) / m.height * m.h))
        for (let j = j0; j <= j1; j++) {
          const y = m.y0 + (j + 0.5) / m.h * m.height
          for (let i = i0; i <= i1; i++) {
            const s = (i + 0.5) / m.w * m.len
            if (inside(s, y)) m.data[j * m.w + i] = 255
          }
        }
      }
      const plaster = (d: number, s: number, y: number) => d <= SPALL_MIN + SPALL_RAGGED * ragged(s, y)
      for (const c of holes) stamp(mask, c.a, c.b, c.y0, c.y1, (s, y) => plaster(boxDistance(s, y, c.a, c.b, c.y0, c.y1), s, y))
      for (const d of discs) stamp(mask, d.s - d.r, d.s + d.r, d.y - d.r, d.y + d.r, (s, y) => plaster(Math.max(0, Math.hypot(s - d.s, y - d.y) - d.r), s, y))
      for (const f of flakes) {
        const rough = (s: number, y: number) => Math.hypot(s - f.s, y - f.y) - f.r * (0.65 + 0.7 * ragged(s * 2.3, y * 2.3))
        stamp(mask, f.s - 2 * f.r, f.s + 2 * f.r, f.y - 2 * f.r, f.y + 2 * f.r, (s, y) => rough(s, y) <= 0)
      }
      for (const p of pits) {
        stamp(mask, p.s - p.rs, p.s + p.rs, p.y - p.ry, p.y + p.ry, (s, y) => plaster(Math.max(0, ellipseDistance(s, y, p.s, p.y, p.rs, p.ry)), s, y))
        // the hole through the unit: a little inside the crater, with a broken edge
        stamp(core, p.s - p.rs, p.s + p.rs, p.y - p.ry, p.y + p.ry, (s, y) => ellipseDistance(s, y, p.s, p.y, p.rs, p.ry) <= -0.35 * Math.min(p.rs, p.ry) * noise2(s * 1.7, y * 1.3, 0.012))
      }
      mask.texture.needsUpdate = true
      core.texture.needsUpdate = true
      // the units the cut lays bare: those within reach of a hole or a crater
      const near = (c: any) => holes.some((h) => boxDistance((c.a + c.b) / 2, (c.y0 + c.y1) / 2, h.a - (c.b - c.a) / 2, h.b + (c.b - c.a) / 2, h.y0 - (c.y1 - c.y0) / 2, h.y1 + (c.y1 - c.y0) / 2) <= reach)
        || discs.some((d) => boxDistance(d.s, d.y, c.a, c.b, c.y0, c.y1) <= d.r + reach)
        || pits.some((p) => boxDistance(p.s, p.y, c.a, c.b, c.y0, c.y1) <= Math.max(p.rs, p.ry) + reach)
        || flakes.some((f) => boxDistance(f.s, f.y, c.a, c.b, c.y0, c.y1) <= 2 * f.r)
      const list: { x: number; y: number; z: number; sx: number; sy: number; sz: number; colour: number }[] = []
      const tone = (hex: number, k: number) => tmp.c.setHex(hex).multiplyScalar(k).getHex()
      for (const { c, part, units, thick, mid } of shown) {
        if (!near(c)) continue
        const centre = mask.start + (c.a + c.b) / 2, y = (c.y0 + c.y1) / 2, len = c.b - c.a, h = c.y1 - c.y0
        const at = (s: number, dy: number, d: number, colour: number) => list.push({ x: mask.alongU ? centre : mid, y, z: mask.alongU ? mid : centre, sx: mask.alongU ? s : d, sy: dy, sz: mask.alongU ? d : s, colour })
        const base = fragmentMaterial(part.material).color.getHex()
        const n = noise2(centre * 3.1, y * 2.7, 0.07)
        if (units.mortar === 'concrete') {
          // cast concrete: one face with no joints (the cells only cut it where a shot went through), its grey a little uneven
          at(len, h, thick - 2 * COVER, tone(base, 0.9 + 0.04 * n))
        } else {
          // brick in its mortar: the joint behind, the unit a little smaller and standing out of it
          at(len, h, thick - 2 * COVER - 0.012, 0x9d978c)
          at(len - 0.012, h - 0.012, thick - 2 * COVER, tone(base, 0.8 + 0.35 * n))
        }
      }
      if (view.units) { view.units.removeFromParent(); view.units.dispose() }
      const units = new THREE.InstancedMesh(unitGeometry, view.unitMaterial, Math.max(1, list.length))
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
      view.pits = pits.length
      view.flakes = flakes.length
    }

    /**
     * What a `chip` took out, in the house's space: its centre, and its half extents along the wall (`along`) and up (`up`) from its box in the part's
     * axes turned by its world rotation.
     */
    function chipBox(chip: { center: number[]; size: number[]; rotation: number[] }, alongU: boolean) {
      house.updateMatrixWorld(true)
      const q = tmp.q.set(chip.rotation[0], chip.rotation[1], chip.rotation[2], chip.rotation[3]).premultiply(house.getWorldQuaternion(new THREE.Quaternion()).invert())
      let a = 0, u = 0
      for (let k = 0; k < 3; k++) {
        const axis = tmp.p.set(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).applyQuaternion(q)
        a += Math.abs(alongU ? axis.x : axis.z) * chip.size[k] / 2
        u += Math.abs(axis.y) * chip.size[k] / 2
      }
      return { center: local(chip.center), along: a, up: u }
    }

    /** Takes out of the wall of `partId` (or of the wall that draws it) the units the change removed, and draws the damage again. */
    function draw(partId: string, change: { opening?: { center: number[]; radius: number }; chip?: { center: number[]; size: number[]; rotation: number[] }; spall?: { center: number[]; radius: number } }): boolean {
      if (lod !== 0) return false
      const hostId = hostOf(partId)
      if (!hostId || !specOf(partId)?.units) return false
      let view = views.get(hostId)
      if (!view) {
        const items = structure.meshesOf(hostId).filter((it: any) => it.mesh)
        if (!items.length) return false
        const parts = [hostId, ...riders(hostId)].filter((id) => structure.byId.get(id) && specOf(id)?.units)
        if (!parts.includes(partId)) return false
        const mask = maskOf(hostId, parts), core = maskOf(hostId, parts)
        view = {
          host: hostId, parts, items, mask, core, unitMaterial: unitsMaterial(core), shells: [], saved: null, units: null, gone: 0, pits: 0,
          chips: new Map(parts.map((id) => [id, [] as any[]])), spalls: new Map(parts.map((id) => [id, [] as any[]])), openings: new Map(), flakes: 0,
        }
      }
      if (!view.chips.has(partId)) return false
      if (change.opening) {
        if (view.openings.has(partId)) return false
        view.openings.set(partId, { center: local(change.opening.center), radius: change.opening.radius })
      }
      if (change.chip) view.chips.get(partId).push(chipBox(change.chip, view.mask.alongU))
      if (change.spall) {
        const list = view.spalls.get(partId)
        list.push({ center: local(change.spall.center), radius: change.spall.radius })
        if (list.length > MAX_FLAKES) list.shift()
      }
      if (!view.saved) {
        view.shells = view.items.map((it: any) => shell(it, view.mask))
        // and what shows where it is cut: the units
        for (const m of view.shells) m.userData.behind = () => view.units
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
      view.units.removeFromParent(); view.units.dispose(); view.unitMaterial.dispose()
      for (const m of view.shells) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose() }
      view.mask.texture.dispose(); view.core.texture.dispose()
    }

    return {
      /** Handles a `stage` event of the house's object. Returns true when the wall was cut. */
      stage(event: any): boolean { return event.stage === 2 && !!event.opening ? draw(event.part, { opening: event.opening }) : false },
      /**
       * Handles a `spall` of a wall of units: the coat comes off in a ragged patch and the units show under it, drawn by the house (the destruction
       * renderer leaves its flat patch out on the meshes `claim` marked). Returns true when the wall was cut.
       */
      spall(event: any): boolean {
        const r = Math.sqrt(Math.max(0, event.area) / Math.PI)
        return r > 0 ? draw(event.part, { spall: { center: event.point, radius: r } }) : false
      },
      /**
       * Marks the meshes that draw a wall of units as drawing its spalls itself (`userData.drawnSpalls`, the part ids): the destruction renderer then
       * throws the bits and leaves its patch out. Call it once the spec is known.
       */
      claim(): void {
        for (const q of opts.spec()?.parts ?? []) {
          if (!q.units) continue
          const host = hostOf(q.id)
          if (!host) continue
          for (const it of structure.meshesOf(host)) {
            if (!it.mesh) continue
            const list = (it.mesh.userData.drawnSpalls ??= [])
            if (!list.includes(q.id)) list.push(q.id)
          }
        }
      },
      /**
       * Handles a `chip` event: what came out (a unit, or a crater a shot broke through one) leaves a hole in the wall where it was; a `torn` chip (what a blow
       * tore off a face) leaves the marks the renderer drew. Returns true when the wall was cut.
       */
      chip(event: any): boolean {
        if (event.torn) return false
        return draw(event.part, { chip: { center: event.center, size: event.size ?? [0, 0, 0], rotation: event.rotation ?? [0, 0, 0, 1] } })
      },
      /** The part broke or fell: its damage goes (the plain range stays collapsed, the renderer hides the part). */
      drop(partId: string): void {
        const v = views.get(partId)
        if (!v) return
        dispose(v); views.delete(partId)
        // the range stays collapsed (the renderer hides the part); `restore` puts it back
        if (v.saved) dropped.push(v)
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
        for (const v of dropped) plain(v, true)
        dropped.length = 0
      },
      /** The wall has damage drawn. */
      has(partId: string): boolean { return views.has(partId) },
      /** Walls with damage drawn, units out of them, craters shots broke through units that stay, and units laid bare at the edge of the cuts. */
      statistics: () => ({
        walls: views.size,
        gone: [...views.values()].reduce((n, v) => n + v.gone, 0),
        craters: [...views.values()].reduce((n, v) => n + v.pits, 0),
        flakes: [...views.values()].reduce((n, v) => n + v.flakes, 0),
        units: [...views.values()].reduce((n, v) => n + v.units.count, 0),
      }),
    }
  }

  Object.assign(K, { createBreachView })
}
