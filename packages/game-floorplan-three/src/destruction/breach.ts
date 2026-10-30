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

    /** A world point in the house's own space (the space of the structure's parts). */
    const local = (p: number[]): number[] => {
      house.updateMatrixWorld(true)
      const v = house.worldToLocal(tmp.p.set(p[0], p[1], p[2]))
      return [v.x, v.y, v.z]
    }

    /** Units of the wall, without those inside the opening and those a `chip` knocked out (`chips`: house-local points inside each unit that came out). */
    function courses(part: any, units: any, opening: { center: number[]; radius: number } | null, chips: number[][], paint: number | null) {
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
          const d = opening ? Math.hypot(x - opening.center[0], y - opening.center[1], z - opening.center[2]) : Infinity
          if (opening && d < opening.radius) continue
          // a unit that came out: its centre falls in this unit's span along the wall and in its course
          const gone = (c: number[]) => Math.abs(c[1] - y) <= rowH / 2 && (alongU ? c[0] >= u0 + a && c[0] <= u0 + b : c[2] >= v0 + a && c[2] <= v0 + b)
          if (chips.some(gone)) continue
          const near = (opening && d < opening.radius + 0.25) || chips.some((c) => Math.hypot(c[0] - x, c[1] - y, c[2] - z) < 0.15)
          list.push({ x, y, z, sx: alongU ? b - a : thick, sy: rowH, sz: alongU ? thick : b - a, colour: near || paint === null ? edge : paint })
        }
      }
      return list
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

    /**
     * Draws the wall of `partId` as its courses (the first time its range in the merged mesh collapses), and the beams the house draws inside it as their
     * blocks, without what their opening and their chips took out.
     */
    function draw(partId: string, change: { opening?: { center: number[]; radius: number }; chip?: number[] }): boolean {
      if (lod !== 0) return false
      const hostId = hostOf(partId)
      if (!hostId || !specOf(partId)?.units) return false
      let view = views.get(hostId)
      if (!view) {
        const items = structure.meshesOf(hostId).filter((it: any) => it.mesh)
        if (!items.length) return false
        const parts = [hostId, ...riders(hostId)].filter((id) => structure.byId.get(id) && specOf(id)?.units)
        view = { mesh: null, saved: null, items, paint: wallColour(items), units: 0, opening: null, chips: new Map(parts.map((id) => [id, [] as number[][]])), openings: new Map() }
      }
      if (!view.chips.has(partId)) return false
      if (change.opening) {
        if (view.openings.has(partId)) return false
        view.openings.set(partId, { center: local(change.opening.center), radius: change.opening.radius })
        if (partId === hostId) view.opening = view.openings.get(partId)
      }
      if (change.chip) view.chips.get(partId).push(local(change.chip))
      const list: any[] = []
      for (const [id, chips] of view.chips) list.push(...courses(structure.byId.get(id), specOf(id).units, view.openings.get(id) ?? null, chips, view.paint))
      if (view.mesh) { view.mesh.removeFromParent(); view.mesh.dispose() }
      const mesh = new THREE.InstancedMesh(unitGeometry, unitMaterial, Math.max(1, list.length))
      mesh.name = 'breach:' + hostId
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
      if (!view.saved) view.saved = view.items.map((it: any) => ({ it, v0: it.v0, data: collapseRange(it.mesh, it.v0, it.v1) }))
      view.mesh = mesh
      view.units = list.length
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

    return {
      /** Handles a `stage` event of the house's object. Returns true when the wall was redrawn as courses. */
      stage(event: any): boolean { return event.stage === 2 && !!event.opening ? draw(event.part, { opening: event.opening }) : false },
      /** Handles a `chip` event: the unit that came out leaves a gap in the courses. Returns true when the wall was redrawn. */
      chip(event: any): boolean { return draw(event.part, { chip: event.center }) },
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
