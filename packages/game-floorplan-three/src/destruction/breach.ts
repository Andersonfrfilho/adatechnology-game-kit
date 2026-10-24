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

/**
 * Opening of a masonry wall. At full detail (LOD 0) a wall made of units that reaches stage 2 stops being one box: its range in the merged mesh
 * collapses and the wall is drawn again as instanced courses of units (running or stack bond, one instance per unit) without the units inside the
 * opening. The units around the edge show the bare unit colour; the rest keep the colour of the wall the house painted. At LOD 1 and 2 the wall
 * stays a box (the renderer's patch marks the breach). Fragments, spalling and the rebar cage belong to the destruction renderer.
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

    const wallColour = (items: any[]): number | null => {
      for (const it of items) {
        if (!it.mesh) continue
        const c = it.mesh.geometry.attributes.color
        if (!c) continue
        const a = c.array
        tmp.c.setRGB(a[it.v0 * 3], a[it.v0 * 3 + 1], a[it.v0 * 3 + 2])
        return tmp.c.getHex()
      }
      return null
    }

    function courses(part: any, units: any, opening: { center: number[]; radius: number }, paint: number | null) {
      const [u0, v0, u1, v1] = part.aabb
      const alongU = u1 - u0 >= v1 - v0
      const len = alongU ? u1 - u0 : v1 - v0
      const thick = alongU ? v1 - v0 : u1 - u0
      const [ul, uh] = units.size
      const rows = Math.max(1, Math.round((part.y1 - part.y0) / uh))
      const rowH = (part.y1 - part.y0) / rows
      const per = Math.max(1, Math.round(len / ul))
      const w = len / per
      const edge = fragmentMaterial(part.material).color.getHex()
      const list: { x: number; y: number; z: number; sx: number; sy: number; sz: number; colour: number }[] = []
      for (let r = 0; r < rows; r++) {
        const shift = units.bond === 'running' && (r & 1) ? w / 2 : 0
        const cells = per + (shift ? 1 : 0)
        for (let i = 0; i < cells; i++) {
          let a = i * w - shift, b = a + w
          a = Math.max(0, a); b = Math.min(len, b)
          if (b - a < 1e-3) continue
          const mid = (a + b) / 2
          const x = alongU ? u0 + mid : (u0 + u1) / 2
          const z = alongU ? (v0 + v1) / 2 : v0 + mid
          const y = part.y0 + (r + 0.5) * rowH
          const d = Math.hypot(x - opening.center[0], y - opening.center[1], z - opening.center[2])
          if (d < opening.radius) continue
          list.push({ x, y, z, sx: alongU ? b - a : thick, sy: rowH, sz: alongU ? thick : b - a, colour: d < opening.radius + 0.25 || paint === null ? edge : paint })
        }
      }
      return list
    }

    function open(event: any): boolean {
      if (lod !== 0 || views.has(event.part) || !event.opening) return false
      const part = structure.byId.get(event.part)
      const spec = opts.spec()?.parts?.find((q: any) => q.id === event.part)
      if (!part || !spec || !spec.units) return false
      const items = structure.meshesOf(event.part).filter((it: any) => it.mesh)
      if (!items.length) return false
      const list = courses(part, spec.units, event.opening, wallColour(items))
      const mesh = new THREE.InstancedMesh(unitGeometry, unitMaterial, Math.max(1, list.length))
      mesh.name = 'breach:' + event.part
      list.forEach((u, i) => {
        tmp.m.compose(tmp.p.set(u.x, u.y, u.z), tmp.q.identity(), tmp.s.set(u.sx, u.sy, u.sz))
        mesh.setMatrixAt(i, tmp.m)
        mesh.setColorAt(i, tmp.c.setHex(u.colour))
      })
      mesh.count = list.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      house.add(mesh)
      const saved = items.map((it: any) => ({ it, v0: it.v0, data: collapseRange(it.mesh, it.v0, it.v1) }))
      views.set(event.part, { mesh, saved, units: list.length, opening: event.opening })
      invalidate(); invalidateShadow()
      return true
    }

    function plain(view: any, shown: boolean) {
      for (const s of view.saved) {
        if (shown) restoreRange(s.it.mesh, s.v0, s.data)
        else s.data = collapseRange(s.it.mesh, s.v0, s.it.v1)
      }
    }

    return {
      /** Handles a `stage` event of the house's object. Returns true when the wall was redrawn as courses. */
      stage(event: any): boolean { return event.stage === 2 ? open(event) : false },
      /** The part broke or fell: the courses go (the plain range stays collapsed, the renderer hides the part). */
      drop(partId: string): void {
        const v = views.get(partId)
        if (!v) return
        v.mesh.removeFromParent(); v.mesh.dispose(); views.delete(partId)
      },
      /** LOD 0 draws the courses; LOD 1 and 2 give the wall its box back. */
      setLod(level: number): void {
        const was = lod; lod = level
        if ((was === 0) === (level === 0)) return
        for (const v of views.values()) { v.mesh.visible = level === 0; plain(v, level !== 0) }
        invalidate(); invalidateShadow()
      },
      /** Everything back to what it was (after `world.reset`). */
      restore(): void {
        for (const v of views.values()) {
          v.mesh.removeFromParent(); v.mesh.dispose()
          if (lod === 0) plain(v, true)
        }
        views.clear()
      },
      /** The wall's opening, if it has courses. */
      has(partId: string): boolean { return views.has(partId) },
      statistics: () => ({ walls: views.size, units: [...views.values()].reduce((n, v) => n + v.units, 0) }),
    }
  }

  Object.assign(K, { createBreachView })
}
