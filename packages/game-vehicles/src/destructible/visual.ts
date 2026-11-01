/**
 * What the player sees of the destruction model: hinged door and lid panels, the battery, tow hitch and mirrors that the zones do not draw,
 * bullet holes, lights out, tyres that melt and the parts that come off and fall.
 *
 * It only uses the kit (`kit._` helpers such as `fling`, `cutPanel`, `pivotOf`), so a part that comes off is flung with the same ballistic
 * animation the explosion uses, and a vehicle that is rebuilt (`reset`) gets a fresh set of meshes.
 */
import type { VehicleContext, VehicleKit } from '../api'
import type { PartDef, VehicleModel } from './model'
import { warmTriIndex } from '../tri-index'
import type { CreaseWork } from './crease-queue'

type Obj = any

export interface DetachOptions {
  /** `tool` drops the part gently, `break` throws it. */
  by: 'tool' | 'break'
  /** Impulse direction in `c.vehicle` coordinates (default: away from the vehicle centre). */
  away?: [number, number, number]
}

/** A hole's mark is wider than the bore: the chipped paint and bare metal around it. */
const HOLE_DECAL_SCALE = 2.4
/** From a door's skin to its inner card, metres. */
const DOOR_DEPTH = 0.07
/** Points per side of a door's edge band, each at the height of the skin there: the side of a car is curved. */
const DOOR_EDGE_PIECES = 16
/** The inner face of a door, trim grey: a lit surface, not a hole. */
const DOOR_CARD_COLOR = '#3b3e42'
const HOLE_TEXTURE_SIZE = 64
/** A mirror the model draws: small, and this near where the part stands, metres. */
const DRAWN_MIRROR_SIZE = 0.3
const DRAWN_MIRROR_REACH = 0.4
/** Per material: the ring the round leaves around the bore. */
const HOLE_RIM: Record<string, string> = { steel: '#b7bcc0', aluminium: '#d3d6d8', plastic: '#d9d6cc', rubber: '#141414', glass: '#eef3f5' }
const holeMaterials = new WeakMap<object, Map<string, any>>()
let holeDisc: any = null

function holeDiscGeometry(THREE: any): any {
  holeDisc = holeDisc ?? new THREE.CircleGeometry(1, 12)
  return holeDisc
}
/** Dark bore, the bare ring and the jagged edge of the chipped finish, shared by every hole of one material. */
function holeMaterial(kit: VehicleKit, material: string): any {
  const key = kit as unknown as object
  const cache = holeMaterials.get(key) ?? new Map<string, any>()
  holeMaterials.set(key, cache)
  const known = cache.get(material)
  if (known) return known
  const I = (kit as any)._
  const THREE = (kit as any).THREE
  const canvas = (kit as any).document?.createElement?.('canvas')
  const x = canvas?.getContext?.('2d')
  let made: any = I.MATERIALS.dark
  if (x) {
    canvas.width = canvas.height = HOLE_TEXTURE_SIZE
    const mid = HOLE_TEXTURE_SIZE / 2
    x.fillStyle = HOLE_RIM[material] ?? HOLE_RIM.steel
    x.beginPath()
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const r = mid * (i % 2 ? 0.98 : 0.76)
      x.lineTo(mid + Math.cos(a) * r, mid + Math.sin(a) * r)
    }
    x.closePath()
    x.fill()
    x.fillStyle = '#050505'
    x.beginPath()
    x.arc(mid, mid, mid * 0.42, 0, Math.PI * 2)
    x.fill()
    const map = new THREE.CanvasTexture(canvas)
    made = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.55, metalness: material === 'steel' || material === 'aluminium' ? 0.6 : 0 })
  }
  cache.set(material, made)
  return made
}

export class VehicleVisuals implements CreaseWork {
  readonly kit: VehicleKit
  readonly c: VehicleContext
  readonly model: VehicleModel
  private readonly I: Record<string, any>
  private readonly THREE: any
  private readonly byId = new Map<string, PartDef>()
  /** Meshes created for parts the vehicle does not draw (battery, hitch, generated mirrors). */
  private readonly extra = new Map<string, Obj[]>()
  /** Hinged panels created for the doors and the lid, by part id. */
  readonly plates = new Map<string, Obj>()
  private readonly gone = new Set<string>()
  /** Shows or hides the plate and the recess of a door or lid by its state (see `showWhenOpen`). */
  private readonly syncPlates = new Map<string, () => void>()
  /** Doors and lids whose own skin was cut from the body and hung on the hinge (true), or that had none to take and keep the plate (false). */
  private readonly skins = new Map<string, boolean>()
  private lightsOn = true
  /** Heavy body meshes whose triangle index is still to build (null once done). */
  private warming: Obj[] | null
  /** A panel was torn off since the last `pump`: that frame already paid for the cut, the smoothing starts on the next one. */
  private tornThisFrame = false
  /** A shared crease queue owns the smoothing: `pump` only closes the frame of the cut. */
  private queued = false
  /** A panel was torn and the queue has not asked yet: the first `pendingUnits(frame)` after it holds the work for that frame. */
  private holdArmed = false
  private holdFrame = -1
  /** Normal smoothing still running, by mesh: a mesh cut again gets a new task and the old one is dropped. */
  private readonly smoothing = new Map<Obj, { geo: any; step: (deadline: number) => boolean }>()
  readonly hood: { id: string; open: number; sign: number } | null

  constructor(kit: VehicleKit, c: VehicleContext, model: VehicleModel) {
    this.kit = kit
    this.c = c
    this.model = model
    this.I = (kit as any)._
    this.THREE = kit.THREE
    for (const p of model.parts) this.byId.set(p.id, p)
    c.root.updateMatrixWorld(true)
    this.hood = this.nameHood()
    this.warming = (c.deform as Obj[]).filter((msh) => msh.geometry && msh.geometry.attributes.position && msh.geometry.attributes.position.count >= 1500)
    if (!this.warming.length) this.warming = null
    for (const p of model.parts) {
      if (p.role === 'door' || p.role === 'lid') this.makePlate(p)
      else if (p.role === 'mirror' && !this.mirrorObjects(p).length) this.makeMirror(p)
      else if (p.role === 'battery' && p.mechanical) this.makeBattery(p)
      else if (p.role === 'hitch') this.makeHitch(p)
    }
  }

  // ---- lookups -----------------------------------------------------------------------------------------------------------------------------
  private zone(p: PartDef): any {
    return p.zoneId ? (this.kit.zonesOf(this.c) as any[]).find((z) => z.id === p.zoneId) : undefined
  }
  private nameHood() {
    const c: any = this.c
    if (!c.hood) return null
    const z = (this.kit.zonesOf(this.c) as any[]).find((q) => q.type === 'hood')
    const id = z ? z.id : this.model.parts.find((p) => p.role === 'hood')?.id
    if (!id) return null
    c.hood.piv.name = id
    c.hood.piv.userData.plateOf = id
    return { id, open: c.hood.open as number, sign: (c.hood.sign || 1) as number }
  }
  private mirrorObjects(p: PartDef): Obj[] {
    const own = this.extra.get(p.id)
    if (own) return own
    const door = (this.kit.zonesOf(this.c) as any[]).find((z) => z.type === 'door' && p.tags.includes(z.side < 0 ? 'left' : 'right') && (z.mirrors ?? []).length)
    return door ? (door.mirrors as Obj[]).filter((o) => o.parent) : []
  }

  /** The objects that make a part, as they are now (empty when the part has no visible mesh or it has already come off). */
  objectsOf(partId: string): Obj[] {
    const p = this.byId.get(partId)
    if (!p || this.gone.has(partId)) return []
    const z = this.zone(p)
    switch (p.role) {
      case 'door':
      case 'lid': {
        const g = this.plates.get(p.id)
        return g && g.parent ? [g] : []
      }
      case 'hood':
        return (this.c as any).hood && this.hood?.id === p.id ? [(this.c as any).hood.piv] : []
      case 'bumper':
        return z ? (z.owned as Obj[]).filter((o) => o.parent) : []
      case 'light':
        return z ? (z.lights as any[]).map((L) => L.group).filter((g) => g && g.parent) : []
      case 'rim':
        return z ? (z.wheels as Obj[]).filter((o) => o.parent) : []
      case 'tyre': {
        const zz = this.zone(p)
        return zz ? (zz.wheels as Obj[]).flatMap((w) => (this.I.tireMeshes(w) as Obj[]).filter((m) => m.parent)) : []
      }
      case 'mirror':
        return this.mirrorObjects(p)
      default:
        return (this.extra.get(p.id) ?? []).filter((o) => o.parent)
    }
  }

  // ---- generated meshes --------------------------------------------------------------------------------------------------------------------
  private paint(): any {
    return this.c.paint(this.c.meta.color || '#777777')
  }
  private box(w: number, h: number, d: number, mat: any, x: number, y: number, z: number, parent?: Obj): Obj {
    const m = new this.THREE.Mesh(new this.THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    ;(parent ?? this.c.vehicle).add(m)
    return m
  }
  private surface(axis: 'x' | 'z', sign: number, B: any, samples: Array<[number, number]>): number | null {
    // ray from outside towards the vehicle at a few points of the panel; the median hit is the skin
    const V3 = this.THREE.Vector3
    const hits: number[] = []
    const far = 3
    for (const [u, v] of samples) {
      const o = axis === 'z' ? new V3(u, v, sign * (Math.max(Math.abs(B.z0), Math.abs(B.z1)) + 1)) : new V3(sign * (Math.max(Math.abs(B.x0), Math.abs(B.x1)) + 1), u, v)
      const d = axis === 'z' ? new V3(0, 0, -sign) : new V3(-sign, 0, 0)
      const h = this.I.probe(this.c, o, d, far)
      if (h) hits.push(axis === 'z' ? h.p.z : h.p.x)
    }
    if (!hits.length) return null
    hits.sort((a, b) => a - b)
    return hits[Math.floor(hits.length / 2)]
  }
  /** A thin panel hinged on the door (front edge) or the lid (top edge), over a dark recess so the opening shows when it swings. */
  private makePlate(p: PartDef): void {
    const z = this.zone(p)
    if (!z) return
    const B = z.box
    const THREE = this.THREE
    const mats = this.I.MATERIALS
    const grid = (a0: number, a1: number, b0: number, b1: number): Array<[number, number]> => {
      const out: Array<[number, number]> = []
      for (const fa of [0.25, 0.5, 0.75]) for (const fb of [0.3, 0.7]) out.push([a0 + (a1 - a0) * fa, b0 + (b1 - b0) * fb])
      return out
    }
    if (p.role === 'door') {
      const s = z.side < 0 ? -1 : 1
      const sk = this.surface('z', s, B, grid(B.x0, B.x1, B.y0, B.y1))
      if (sk == null) return
      const len = B.x1 - B.x0 - 0.06
      const hgt = B.y1 - B.y0 - 0.1
      const hingeFront = z.hinge !== 'rear'
      const hx = hingeFront ? B.x1 - 0.03 : B.x0 + 0.03
      const cy = (B.y0 + B.y1) / 2
      const recess = this.box(len - 0.04, hgt - 0.04, 0.01, mats.dark, (B.x0 + B.x1) / 2, cy, sk + s * 0.004)
      recess.userData.noFollow = true
      const piv = new THREE.Group()
      piv.name = p.id
      piv.userData.plateOf = p.id
      piv.position.set(hx, cy, sk + s * 0.016)
      piv.userData.rigid = true
      this.c.vehicle.add(piv)
      const panel = this.box(len, hgt, 0.022, this.paint(), hingeFront ? -len / 2 : len / 2, 0, 0, piv)
      this.plates.set(p.id, piv)
      this.extra.set(`recess_${p.id}`, [recess])
      this.showWhenOpen(p.id, piv, panel, recess)
    } else {
      // the lid is the rear panel: it hinges on its top edge and lifts away from the body
      const sk = this.surface('x', -1, B, grid(B.y0, B.y1, B.z0, B.z1))
      if (sk == null) return
      const wy = B.y1 - B.y0 - 0.1
      const wz = B.z1 - B.z0 - 0.1
      const recess = this.box(0.01, wy - 0.04, wz - 0.04, mats.dark, sk + 0.004, (B.y0 + B.y1) / 2, 0)
      recess.userData.noFollow = true
      const piv = new THREE.Group()
      piv.name = p.id
      piv.userData.plateOf = p.id
      piv.position.set(sk - 0.016, B.y1 - 0.05, 0)
      piv.userData.rigid = true
      this.c.vehicle.add(piv)
      const panel = this.box(0.022, wy, wz, this.paint(), 0, -wy / 2, 0, piv)
      this.plates.set(p.id, piv)
      this.extra.set(`recess_${p.id}`, [recess])
      this.showWhenOpen(p.id, piv, panel, recess)
    }
  }
  /**
   * A closed door or lid is the body's own surface: the flat plate over it and the dark recess under it show only while it swings open or once it has come off, so the closed car
   * keeps the shape of its model instead of flat panels over its curved sides. Follows the hinge's rotation, whoever turns it (the clips of a host, `detach`).
   */
  private showWhenOpen(id: string, piv: Obj, panel: Obj, recess: Obj): void {
    let busy = false
    const sync = (): void => {
      if (busy) return
      const r = piv.rotation
      const open = Math.abs(r.x) + Math.abs(r.y) + Math.abs(r.z) > 1e-3 || this.gone.has(id) || piv.parent !== this.c.vehicle
      // the first time it swings, the door takes its own skin, window and trim off the body: what opens is the door the model draws
      if (open && !this.gone.has(id) && piv.parent === this.c.vehicle && !this.skins.has(id)) {
        busy = true
        try {
          this.skins.set(id, this.takeSkin(id, piv))
        } finally {
          busy = false
        }
      }
      // with its own skin hung on the hinge the opening shows the cabin; the flat plate and its dark recess stay for a model with no skin to take
      panel.visible = open && !this.skins.get(id)
      recess.visible = open && !this.skins.get(id)
    }
    const euler = piv.rotation
    const quaternion = piv.quaternion
    const onEuler = euler._onChangeCallback
    const onQuaternion = quaternion._onChangeCallback
    euler._onChange(() => {
      onEuler()
      sync()
    })
    quaternion._onChange(() => {
      onQuaternion()
      sync()
    })
    this.syncPlates.set(id, sync)
    sync()
  }
  /**
   * Cuts the skin of a door or lid zone out of the body (as the damage's hanging door does) and hangs it, with the thin parts on it (trim, handle) and, for a door, the side
   * window over it, on the hinge. Done with the hinge closed, so every piece keeps its place; answers whether there was skin to take.
   */
  private takeSkin(id: string, piv: Obj): boolean {
    const p = this.byId.get(id)
    const z = p && this.zone(p)
    if (!p || !z) return false
    const I = this.I
    const B = z.box
    const q = piv.quaternion.clone()
    piv.quaternion.identity()
    this.c.root.updateMatrixWorld(true)
    const inv = I.worldInverseOf(this.c)
    let objs: Obj[] = []
    try {
      if (p.role === 'door') {
        const dirty = new Set<Obj>()
        const rect = [B.x0 + 0.03, B.x1 - 0.03, B.y0 + Math.min(0.08, (B.y1 - B.y0) * 0.1), B.y1 - 0.02]
        const pcs = (I.cutPanel(this.c, z, rect, true, dirty, { anyN: true }) as Array<{ mesh?: Obj }>).map((x) => x.mesh).filter((m): m is Obj => !!m)
        this.mend(dirty)
        if (pcs.length) {
          const panes = I.windowsOver(this.c, z, inv) as Obj[]
          const seals = panes.map((g) => I.paneSeals.get(g) as Obj | undefined).filter((s): s is Obj => !!s)
          const mirrors = this.mirrorsOn(z)
          objs = [...pcs, ...this.doorCards(pcs, z), ...(I.followersIn(this.c, z, inv) as Obj[]), ...panes, ...seals, ...mirrors]
        }
      } else {
        const pcs = this.cutZone(z)
        if (pcs.length) objs = [...pcs, ...(I.followersIn(this.c, z, inv) as Obj[])]
      }
    } catch {
      objs = []
    }
    const deform: Obj[] = (this.c as any).deform ?? []
    for (const o of objs) {
      if (!o.parent || o === piv) continue
      piv.attach(o)
      o.traverse((x: Obj) => {
        x.userData.noFollow = true
      })
      const di = deform.indexOf(o)
      if (di >= 0) deform.splice(di, 1)
    }
    if (p.role === 'door' && objs.length > 0) {
      this.doorEdges(piv, z)
      this.doorSill(piv, z, inv, objs)
    }
    piv.quaternion.copy(q)
    this.c.root.updateMatrixWorld(true)
    return objs.length > 0
  }
  /** A door has edges: a band that follows the skin all round closes it to its card and hides where the cut followed the triangles of the shell; the same band, dark, lines the opening. */
  private doorEdges(piv: Obj, z: any): void {
    const THREE = this.THREE
    const B = z.box
    const side = z.side < 0 ? -1 : 1
    const flat = piv.position.z - side * 0.016
    const x0 = B.x0 + 0.03
    const x1 = B.x1 - 0.03
    const y0 = B.y0 + Math.min(0.08, (B.y1 - B.y0) * 0.1)
    const y1 = B.y1 - 0.02
    const loop: Array<[number, number]> = []
    const run = (ax: number, ay: number, bx: number, by: number): void => {
      for (let i = 0; i < DOOR_EDGE_PIECES; i++) loop.push([ax + ((bx - ax) * i) / DOOR_EDGE_PIECES, ay + ((by - ay) * i) / DOOR_EDGE_PIECES])
    }
    run(x0, y0, x1, y0)
    run(x1, y0, x1, y1)
    run(x1, y1, x0, y1)
    run(x0, y1, x0, y0)
    const heights = loop.map(([x, y]) => this.surface('z', side, B, [[x, y]]) ?? flat)
    const band = (lift: number): any => {
      const position: number[] = []
      const index: number[] = []
      loop.forEach(([x, y], i) => {
        position.push(x, y, heights[i]! + side * lift, x, y, heights[i]! + side * (lift - DOOR_DEPTH))
        const a = i * 2
        const b = ((i + 1) % loop.length) * 2
        index.push(a, a + 1, b, b, a + 1, b + 1)
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
      g.setIndex(index)
      g.computeVertexNormals()
      return g
    }
    const paint = this.paint().clone()
    paint.side = THREE.DoubleSide
    const inner = this.I.MATERIALS.dark.clone()
    inner.side = THREE.DoubleSide
    const edges = new THREE.Mesh(band(0.002), paint)
    const lining = new THREE.Mesh(band(-0.012), inner)
    for (const m of [edges, lining]) {
      m.userData.noFollow = true
      m.castShadow = false
      this.c.vehicle.add(m)
    }
    piv.attach(edges)
  }
  /** A front door carries the mirror drawn at its corner. */
  private mirrorsOn(z: any): Obj[] {
    if (!z.mirror) return []
    const own = ((z.mirrors ?? []) as Obj[]).filter((o) => o.parent)
    if (own.length) return own
    const part = this.model.parts.find((q) => q.role === 'mirror' && Math.sign(q.box.center[2]) === Math.sign(z.side))
    return part ? (this.extra.get(part.id) ?? []).filter((o) => o.parent) : []
  }
  /** The top of a door, from the skin in to its pane: the glass comes out of the door and does not float over it. */
  private doorSill(piv: Obj, z: any, inv: any, objs: Obj[]): void {
    const panes = objs.filter((o) => o.userData.glass)
    if (!panes.length) return
    const THREE = this.THREE
    const B = z.box
    const side = z.side < 0 ? -1 : 1
    const box = new THREE.Box3()
    for (const g of panes) box.union(this.I.localBox(this.c, g, inv))
    const top = B.y1 - 0.02
    const skin = this.surface('z', side, B, [[(B.x0 + B.x1) / 2, top]]) ?? piv.position.z - side * 0.016
    const paneZ = side > 0 ? box.min.z : box.max.z
    const height = Math.max(0.02, box.min.y - top + 0.015)
    const depth = Math.max(0.02, Math.abs(skin - paneZ) + 0.012)
    const sill = this.box(B.x1 - B.x0 - 0.06, height, depth, this.I.MATERIALS.trim ?? this.I.MATERIALS.dark, (B.x0 + B.x1) / 2, top + height / 2, (skin + paneZ) / 2)
    sill.userData.noFollow = true
    sill.castShadow = false
    piv.attach(sill)
  }
  /** The inside of a door: its skin brought in by the depth of the door, in the trim's dark plastic, so the open door is a door and not one sheet of paint. */
  private doorCards(skins: Obj[], z: any): Obj[] {
    const cardMaterial = this.I.makeMaterial(DOOR_CARD_COLOR, { roughness: 0.8 })
    return skins.map((skin) => {
      const card = new this.THREE.Mesh(skin.geometry, cardMaterial)
      card.position.copy(skin.position)
      card.quaternion.copy(skin.quaternion)
      card.scale.copy(skin.scale)
      const side = z.side < 0 ? -1 : 1
      const inward = -side * DOOR_DEPTH
      card.position.z += inward
      card.userData.noFollow = true
      card.castShadow = false
      this.c.vehicle.add(card)
      return card
    })
  }
  private mend(dirty: Set<Obj>): void {
    dirty.forEach((msh) => {
      const g = msh.geometry
      if (g.userData.crease || !g.index) this.I.crease(g, 42)
      else g.computeVertexNormals()
      g.computeBoundingSphere()
      g.computeBoundingBox()
    })
  }
  /** The mirror the model already draws around where the part says, if it draws one. */
  private drawnMirror(p: PartDef): Obj[] {
    const THREE = this.THREE
    const [cx, cy, cz] = p.box.center
    this.c.root.updateMatrixWorld(true)
    const inv = this.I.worldInverseOf(this.c)
    return (this.c.vehicle.children as Obj[]).filter((o) => {
      if (o.userData.glass || o.userData.decal || !(o.isMesh || o.isGroup) || !o.visible || (this.c as any).deform?.includes(o)) return false
      const box = this.I.localBox(this.c, o, inv)
      if (box.isEmpty()) return false
      const size = box.getSize(new THREE.Vector3())
      const at = box.getCenter(new THREE.Vector3())
      return Math.max(size.x, size.y, size.z) < DRAWN_MIRROR_SIZE && Math.hypot(at.x - cx, at.y - cy, at.z - cz) < DRAWN_MIRROR_REACH && Math.abs(at.z) > Math.abs(cz) - DRAWN_MIRROR_REACH / 2
    })
  }
  private makeMirror(p: PartDef): void {
    const drawn = this.drawnMirror(p)
    if (drawn.length) {
      this.extra.set(p.id, drawn)
      return
    }
    const [cx, cy, cz] = p.box.center
    const s = cz < 0 ? -1 : 1
    const mats = this.I.MATERIALS
    const g = new this.THREE.Group()
    g.name = `obj_${p.id}`
    g.position.set(cx, cy, cz)
    this.c.vehicle.add(g)
    this.box(0.05, 0.04, 0.1, mats.dark, 0, -0.04, -s * 0.07, g)
    const housing = this.box(0.1, 0.12, 0.05, mats.plastic ?? mats.dark, 0, 0, s * 0.02, g)
    housing.userData.mirrorHousing = true
    const glass = this.box(0.095, 0.1, 0.006, mats.chrome ?? mats.dark, 0, 0, s * 0.048, g)
    glass.userData.mirrorGlass = true
    g.userData.rigid = true
    this.extra.set(p.id, [g])
  }
  private makeBattery(p: PartDef): void {
    const mats = this.I.MATERIALS
    const g = new this.THREE.Group()
    g.position.set(...p.box.center)
    this.c.vehicle.add(g)
    this.box(p.box.size[0], p.box.size[1] * 0.85, p.box.size[2], this.I.makeMaterial('#2b2f33', { roughness: 0.6 }), 0, 0, 0, g)
    this.box(0.035, 0.04, 0.035, mats.chrome ?? mats.dark, -p.box.size[0] * 0.3, p.box.size[1] * 0.5, 0, g)
    this.box(0.035, 0.04, 0.035, this.I.makeMaterial('#b3261e', { roughness: 0.5 }), p.box.size[0] * 0.3, p.box.size[1] * 0.5, 0, g)
    g.userData.noFollow = true
    this.extra.set(p.id, [g])
  }
  private makeHitch(p: PartDef): void {
    const mats = this.I.MATERIALS
    const g = new this.THREE.Group()
    g.position.set(...p.box.center)
    this.c.vehicle.add(g)
    this.box(0.3, 0.05, 0.08, mats.steel, 0, 0, 0, g)
    const ball = new this.THREE.Mesh(new this.THREE.SphereGeometry(0.035, 12, 8), mats.chrome ?? mats.steel)
    ball.position.set(-0.12, 0.06, 0)
    g.add(ball)
    g.userData.noFollow = true
    this.extra.set(p.id, [g])
  }

  // ---- marks -------------------------------------------------------------------------------------------------------------------------------
  /** A bullet hole: a dark disc lying on the surface at `point` (`c.vehicle` coordinates). */
  holeDecal(point: [number, number, number], normal: [number, number, number], diameter: number, part?: PartDef): void {
    const THREE = this.THREE
    // a pane that broke has no surface left to carry the hole
    const pane = part?.role === 'glass' ? this.panesOf(part).find((g) => g.visible) : undefined
    if (part?.role === 'glass' && (!pane || pane.userData.glass?.broken)) return
    const radius = Math.max(0.006, diameter / 2) * HOLE_DECAL_SCALE
    const m = new THREE.Mesh(holeDiscGeometry(THREE), holeMaterial(this.kit, part?.material ?? 'steel'))
    m.scale.set(radius, radius, 1)
    const n = new THREE.Vector3(...normal)
    m.position.set(...point).addScaledVector(n, 0.003)
    this.c.vehicle.add(m)
    m.lookAt(this.c.vehicle.localToWorld(m.position.clone().add(n)))
    m.userData.decal = true
    m.userData.noFollow = true
    m.renderOrder = 3
    m.raycast = () => {}
    // the mark is on the panel, so it goes where the panel goes (a door that swings, a pane on it)
    const carrier = (part && (this.plates.get(part.id) ?? (part.id === this.hood?.id ? (this.c as any).hood?.piv : undefined))) ?? (pane && pane.parent !== this.c.vehicle ? pane.parent : null)
    if (carrier) carrier.attach(m)
  }
  /** The door or lid a hinge group stands for. */
  plateIdOf(o: Obj): string | undefined {
    return o.userData.plateOf
  }
  spark(point: [number, number, number], dir: [number, number, number], count = 8): void {
    const V3 = this.THREE.Vector3
    this.I.burst(this.c, 'spark', this.c.toEffects(new V3(...point)), count, { dir: this.c.dirToEffects(new V3(...dir).negate()), speed: 2.5, spread: 1.4 })
  }

  // ---- states ------------------------------------------------------------------------------------------------------------------------------
  /** Headlights and taillights on or off (a dead battery or a missing alternator). */
  setLights(on: boolean): void {
    if (on === this.lightsOn) return
    this.lightsOn = on
    const dark = this.I.MATERIALS.bulbBroken
    for (const L of this.c.lights as any[]) {
      if (L.broken) continue
      for (const h of L.halo ?? []) h.visible = on
      for (const m of L.inner ?? []) {
        if (on) {
          if (m.userData.litMat) m.material = m.userData.litMat
        } else {
          if (!m.userData.litMat) m.userData.litMat = m.material
          m.material = dark
        }
      }
    }
  }
  /** The lens of a light breaks and its unit stays (damaged) or goes (destroyed). */
  breakLight(p: PartDef, gone: boolean): void {
    const z = this.zone(p)
    if (!z) return
    for (const L of z.lights as any[]) {
      this.kit.breakLight(this.c, L, new this.THREE.Vector3(p.box.center[0] > 0 ? -1 : 1, 0, 0))
      if (gone) {
        if (L.group) L.group.visible = false
        L.broken = 'gone'
      }
    }
    if (gone) this.gone.add(p.id)
  }
  /** Glass: cracks (laminated) or shatters (tempered); returns whether it broke. */
  hitGlass(p: PartDef, point: [number, number, number], dir: [number, number, number], force: number): boolean {
    const V3 = this.THREE.Vector3
    const list = this.panesOf(p).filter((g) => g.parent && g.visible)
    if (!list.length) return false
    const pt = new V3(...point)
    let best = list[0]
    let bd = Infinity
    for (const g of list) {
      g.geometry.computeBoundingBox()
      const bb = g.geometry.boundingBox.clone().applyMatrix4(g.matrix)
      const d = bb.distanceToPoint(pt)
      if (d < bd) {
        bd = d
        best = g
      }
    }
    this.kit.hitGlass(this.c, best, pt, new V3(...dir), force)
    return !!best.userData.glass?.broken
  }
  private panesOf(p: PartDef): Obj[] {
    return p.panes ?? (this.zone(p)?.glass as Obj[] | undefined) ?? []
  }
  glassBreak(p: PartDef): void {
    const z = this.zone(p)
    if (!z) {
      for (const g of p.panes ?? []) if (g.parent && g.visible) this.kit.hitGlass(this.c, g, g.position.clone(), new this.THREE.Vector3(0, -1, 0), 0.6)
      this.gone.add(p.id)
      return
    }
    for (const g of z.glass as Obj[]) if (g.parent && g.visible) this.I.glassBand(this.c, z, g, 4)
    this.gone.add(p.id)
  }
  tyreFlat(p: PartDef, k: number): void {
    const z = this.zone(p)
    if (!z) return
    for (const w of z.wheels as Obj[]) if (w.parent) this.I.flattenTire(w, k)
  }
  /** Burning rubber: the tyre sags and goes black as it melts. */
  tyreMelt(p: PartDef, melt: number): void {
    const z = this.zone(p)
    if (!z) return
    for (const w of z.wheels as Obj[]) {
      if (!w.parent) continue
      for (const m of this.I.tireMeshes(w) as Obj[]) {
        if (!m.userData.charred) {
          m.userData.charred = true
          m.material = this.I.BURNT_RUB
        }
      }
      this.I.flattenTire(w, Math.min(0.5, 0.12 + 0.38 * melt))
    }
  }
  /** Smooths the normals of a cut mesh a slice per frame (see `pump`); until then it draws with flat face normals. */
  private smoothLater(msh: Obj): void {
    this.smoothing.set(msh, this.I.creaseTask(msh.geometry, 42))
    this.tornThisFrame = true
    this.holdArmed = true
  }
  /** Spends at most `budgetMs` finishing the pending normal smoothing. Call once per frame. */
  pump(budgetMs = 2.5): void {
    if (this.tornThisFrame) {
      this.tornThisFrame = false
      return
    }
    if (this.queued) return
    if (!this.smoothing.size && !this.warming) return
    const deadline = performance.now() + budgetMs
    for (const [msh, task] of this.smoothing) {
      if (msh.geometry !== task.geo || task.step(deadline)) this.smoothing.delete(msh)
      if (performance.now() >= deadline) return
    }
    this.warmIndexes(deadline)
  }
  setQueued(isQueued: boolean): void {
    this.queued = isQueued
  }
  /** Units the shared queue may run now: 0 in the frame of the cut (the first ask after it holds the work for that frame, or `pump` closes it when there is no frame). */
  pendingUnits(frame?: number): number {
    if (this.holdArmed && frame !== undefined) {
      this.holdArmed = false
      this.holdFrame = frame
    }
    if (frame !== undefined && frame === this.holdFrame) return 0
    if (frame === undefined && this.tornThisFrame) return 0
    return this.smoothing.size + (this.warming ? 1 : 0)
  }
  /** One slice of the pending work, for the shared queue. */
  runStep(deadline: number): boolean {
    const next = this.smoothing.entries().next()
    if (!next.done) {
      const [msh, task] = next.value
      if (msh.geometry !== task.geo || task.step(deadline)) this.smoothing.delete(msh)
      return true
    }
    if (!this.warming) return false
    this.warmIndexes(deadline)
    return true
  }
  finishAll(): void {
    while (this.runStep(Infinity));
  }
  /** Measures the triangles of the heavy body meshes once, a slice per frame, so the first panel torn off finds them ready (see `triIndexOf`). */
  private warmIndexes(deadline: number): void {
    if (!this.warming) return
    this.warming = this.warming.filter((msh) => !warmTriIndex(msh.geometry, deadline))
    if (!this.warming.length) this.warming = null
  }
  /** Moves the panel of a lost zone out of the body (the kit's torn-off look). */
  tearOff(p: PartDef): void {
    const z = this.zone(p)
    if (!z) return
    const dirty = new Set<Obj>()
    try {
      if (z.type === 'hood') this.I.hoodBand(this.c, z, 4, dirty)
      else this.I.panelBand(this.c, z, 4, dirty)
    } catch {
      // a zone with nothing to cut
    }
    dirty.forEach((msh) => {
      const g = msh.geometry
      if (g.userData.crease || !g.index) this.smoothLater(msh)
      else g.computeVertexNormals()
      this.I.refreshBounds(g)
    })
    this.gone.add(p.id)
  }

  // ---- parts coming off --------------------------------------------------------------------------------------------------------------------
  private outward(p: PartDef, away?: [number, number, number]): any {
    const V3 = this.THREE.Vector3
    if (away) return new V3(...away).normalize()
    const m = this.c.meta
    const cx = ((m.front ?? 1) + (m.rear ?? -1)) / 2
    const v = new V3(p.box.center[0] - cx, 0, p.box.center[2])
    if (v.lengthSq() < 1e-4) v.set(0, 0, 1)
    return v.normalize()
  }
  private fling(obj: Obj, v: any, w: any, trail: number): void {
    const piece = this.I.fling(this.c, obj, v, w)
    if (piece) piece.trail = trail
  }
  /** Brings a part off the vehicle and throws it. Returns whether something visible moved. */
  detach(p: PartDef, o: DetachOptions): boolean {
    if (this.gone.has(p.id)) return false
    const V3 = this.THREE.Vector3
    const c: any = this.c
    const out = this.outward(p, o.away)
    const gentle = o.by === 'tool'
    const speed = gentle ? 0.7 : 3.2
    const up = gentle ? 0.4 : 3.5
    const vel = (k = 1) => c.dirToEffects(new V3(out.x * speed * k, up * k, out.z * speed * k))
    const spin = () => new V3((gentle ? 0.3 : 4) * (out.z || 1), (gentle ? 0.2 : 2) * (out.x || 1), (gentle ? 0.3 : 5) * (out.x || -1))
    const trail = 0
    let moved = false
    this.gone.add(p.id)
    this.syncPlates.get(p.id)?.()
    switch (p.role) {
      case 'door':
      case 'lid':
      case 'mirror':
      case 'battery':
      case 'hitch':
      case 'light': {
        if (p.role === 'battery') {
          // out of the engine bay: the hood pops a little so it is seen leaving
          if (c.hood) c.hood.latch = Math.max(c.hood.latch, 0.35)
        }
        for (const obj of this.objectsOfGone(p)) {
          this.fling(obj, p.role === 'battery' ? c.dirToEffects(new V3(0.6, 4.2, out.z * 1.2)) : vel(), spin(), trail)
          moved = true
        }
        if (p.role === 'light') {
          const z = this.zone(p)
          for (const L of (z?.lights ?? []) as any[]) {
            L.broken = L.broken || true
            for (const h of L.halo ?? []) h.visible = false
          }
        }
        break
      }
      case 'hood':
        if (c.hood && this.hood?.id === p.id) {
          this.fling(c.hood.piv, c.dirToEffects(new V3(1.2, 6.5, 0)), new V3(0, 0.5, 3), trail)
          c.hood = null
          c.parts.forEach((q: any) => {
            if (q.kind === 'hood') q.done = true
          })
          moved = true
        }
        break
      case 'bumper': {
        const z = this.zone(p)
        const objs = this.objectsOfGone(p)
        const todo = new Set<Obj>()
        for (const obj of objs) todo.add(obj.parent && obj.parent !== c.vehicle && obj.parent.userData.rigid ? obj.parent : obj)
        if (!todo.size && z) for (const q of this.cutZone(z)) todo.add(q)
        for (const obj of todo) {
          const di = c.deform.indexOf(obj)
          if (di >= 0) c.deform.splice(di, 1)
          this.fling(obj, vel(), spin(), trail)
          moved = true
        }
        break
      }
      case 'fender': {
        const z = this.zone(p)
        if (z) for (const q of this.cutZone(z)) {
          this.fling(q, vel(), spin(), trail)
          moved = true
        }
        break
      }
      case 'rim': {
        const z = this.zone(p)
        for (const w of this.objectsOfGone(p)) {
          const i = c.wheels.indexOf(w)
          if (i >= 0) c.wheels.splice(i, 1)
          c.parts.forEach((q: any) => {
            if (q.obj === w) q.done = true
          })
          c.spin = c.spin.filter((s: any) => s.o !== w)
          this.fling(w, c.dirToEffects(new V3(out.x * speed, up * 0.6, out.z * speed * 1.3)), new V3(0, 0, gentle ? 0.4 : 6 * (out.z || 1)), trail)
          this.sag(w)
          moved = true
        }
        // the tyre went with the rim unless it was already off
        const tp = this.model.parts.find((q) => q.role === 'tyre' && q.zoneId === p.zoneId)
        if (tp) this.gone.add(tp.id)
        void z
        break
      }
      case 'tyre': {
        const z = this.zone(p)
        const meshes = z ? (z.wheels as Obj[]).flatMap((w) => (this.I.tireMeshes(w) as Obj[]).filter((m) => m.parent)) : []
        if (meshes.length) {
          const w = meshes[0].parent
          const g = new this.THREE.Group()
          w.add(g)
          for (const m of meshes) g.attach(m)
          this.fling(g, vel(), new V3(0, 0, gentle ? 0.5 : 8), trail)
          moved = true
        }
        break
      }
      default:
        break
    }
    return moved
  }
  /** Objects of a part that has just been marked gone (the lookup in `objectsOf` skips them). */
  private objectsOfGone(p: PartDef): Obj[] {
    this.gone.delete(p.id)
    const r = this.objectsOf(p.id)
    this.gone.add(p.id)
    return r
  }
  private cutZone(z: any): Obj[] {
    const I = this.I
    const B = z.box
    const a = I.axisOf(z.dir)
    const ax = [0, 1, 2].filter((k) => k !== a)
    const u0 = I.boxLo(B, ax[0])
    const u1 = I.boxHi(B, ax[0])
    const v0 = I.boxLo(B, ax[1])
    const v1 = I.boxHi(B, ax[1])
    const mg = Math.min(0.05, (u1 - u0) * 0.08, (v1 - v0) * 0.08)
    const dirty = new Set<Obj>()
    let pcs: Array<{ mesh?: Obj }> = []
    const pieceTasks = new Map<Obj, { geo: any; step: (deadline: number) => boolean }>()
    try {
      pcs = I.cutPanel(this.c, z, [u0 + mg, u1 - mg, v0 + mg, v1 - mg], true, dirty, { pieceTasks })
    } catch {
      pcs = []
    }
    pieceTasks.forEach((task, mesh) => this.smoothing.set(mesh, task))
    this.tornThisFrame = true
    this.holdArmed = true
    dirty.forEach((msh) => {
      const g = msh.geometry
      if (g.userData.crease || !g.index) this.smoothLater(msh)
      else g.computeVertexNormals()
      I.refreshBounds(g)
    })
    return pcs.map((q) => q.mesh).filter((m): m is Obj => !!m)
  }
  /** The corner of a vehicle that lost a wheel settles on its brake: tilt and lower the body. */
  private sag(w: Obj): void {
    const c: any = this.c
    const m = c.meta
    if (m.kind === 'plane' || m.kind === 'heli' || m.kind === 'boat') return
    const r = w.userData.r || 0.3
    const cx = ((m.front ?? 1) + (m.rear ?? -1)) / 2
    const dx = w.position.x - cx
    const dz = w.position.z
    const d = r * 0.8
    const clamp = (v: number) => Math.max(-0.25, Math.min(0.25, v))
    if (Math.abs(dx) > 0.2) c.vehicle.rotation.z += clamp(-d / (2 * dx))
    if (Math.abs(dz) > 0.2) c.vehicle.rotation.x += clamp(d / (2 * dz))
    c.vehicle.position.y -= d / 4
  }
}
