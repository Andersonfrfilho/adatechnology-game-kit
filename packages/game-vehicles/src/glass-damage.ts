/** Glass cracks, shattering and tempered or laminated breakage textures. */
import type { BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D, Texture, Vector2, Vector3 } from 'three'

import type { VehicleLamp } from './api'
import type { BuildContext, Kit, Three } from './types'
import { clamp } from './util'

/** The material of a pane with cracks drawn on it. A host warms its program at load with any texture: the first crack is in the middle of a blast. */
export function crackedGlassMaterial(THREE: Three, texture: Texture): MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    emissive: 0x6a7276,
    emissiveMap: texture,
    transparent: true,
    roughness: 0.25,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

/** What `crackLight` reads of a lamp the kit drew (`c.lights`) and of its vehicle. */
type LampMesh = Mesh
type CrackedLamp = {
  lens: LampMesh[]
  inner: LampMesh[]
  halo?: Array<{ visible: boolean }>
  group: Object3D | null
  tint: string
  broken: unknown
  cracked?: boolean
  dark?: boolean
}

export function installGlassDamage(kit: Kit) {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const document = kit.document
  const { MATERIALS, crease, cutGeometry, mergeGeometries, subdivide, tumble } = I

  /* ================= glass: cracks and shattering ================= */
  /* The point of the pane nearest the hit, on the triangle under it: a pane has few vertices, the web starts where the round landed. */
  function glassUV(c: BuildContext, msh: Mesh, pLocal: Vector3) {
    const pos = msh.geometry.attributes.position
    const uv = msh.geometry.attributes.uv
    if (!uv) return [0.5, 0.5]
    c.root.updateMatrixWorld(true)
    const q = msh.worldToLocal(c.vehicle.localToWorld(pLocal.clone()))
    const idx = msh.geometry.index
    const tri = new THREE.Triangle()
    const near = new V3()
    const bary = new V3()
    let best = Infinity
    const out = [0.5, 0.5]
    const count = idx ? idx.count : pos.count
    for (let f = 0; f + 2 < count; f += 3) {
      const ia = idx ? idx.getX(f) : f
      const ib = idx ? idx.getX(f + 1) : f + 1
      const ic = idx ? idx.getX(f + 2) : f + 2
      tri.a.fromBufferAttribute(pos, ia)
      tri.b.fromBufferAttribute(pos, ib)
      tri.c.fromBufferAttribute(pos, ic)
      tri.closestPointToPoint(q, near)
      const d = near.distanceToSquared(q)
      if (d >= best) continue
      best = d
      tri.getBarycoord(near, bary)
      out[0] = uv.getX(ia) * bary.x + uv.getX(ib) * bary.y + uv.getX(ic) * bary.z
      out[1] = uv.getY(ia) * bary.x + uv.getY(ib) * bary.y + uv.getY(ic) * bary.z
    }
    return out
  }
  /* Crack web: thick opaque lines at the centre, thinning outward, with a dark outline so it reads from afar. */
  function drawWeb(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, ax: number, rnd: () => number) {
    const n = 16 + Math.floor(rnd() * 8)
    const spokes: number[][][] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + (rnd() - 0.5) * 0.35
      const L = (70 + rnd() * 95) * s
      const pts = [[cx, cy]]
      for (let k = 1; k <= 6; k++) {
        const aa = a + (rnd() - 0.5) * 0.28
        const rr = (L * k) / 6
        pts.push([cx + (Math.cos(aa) * rr) / ax, cy + Math.sin(aa) * rr])
      }
      spokes.push(pts)
    }
    x.lineCap = 'round'
    x.lineJoin = 'round'
    function seg(p: number[], q: number[], wd: number, col: string) {
      x.strokeStyle = col
      x.lineWidth = wd
      x.beginPath()
      x.moveTo(p[0], p[1])
      x.lineTo(q[0], q[1])
      x.stroke()
    }
    ;([
      ['rgba(8,12,14,0.55)', 2.2],
      ['rgba(244,248,250,0.97)', 0],
    ] as [string, number][]).forEach(function (pass) {
      spokes.forEach(function (pts) {
        for (let k = 1; k < pts.length; k++) {
          const t = k / pts.length
          seg(pts[k - 1], pts[k], Math.max(0.8, 4.2 * (1 - t) + 0.6) + pass[1], pass[0])
        }
      })
      for (let r = 1; r <= 4; r++) {
        x.lineWidth = Math.max(0.8, 2.6 - r * 0.45) + pass[1] * 0.6
        x.strokeStyle = pass[0]
        x.beginPath()
        spokes.forEach(function (sp, j) {
          const p = sp[Math.min(r, sp.length - 1)]
          const q = spokes[(j + 1) % spokes.length][Math.min(r, sp.length - 1)]
          if (rnd() < 0.8) {
            x.moveTo(p[0], p[1])
            x.quadraticCurveTo((p[0] + q[0]) / 2 + (rnd() - 0.5) * 6, (p[1] + q[1]) / 2 + (rnd() - 0.5) * 6, q[0], q[1])
          }
        })
        x.stroke()
      }
    })
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, 26 * s)
    gr.addColorStop(0, 'rgba(248,250,252,1)')
    gr.addColorStop(0.45, 'rgba(236,242,244,0.75)')
    gr.addColorStop(1, 'rgba(236,242,244,0)')
    x.fillStyle = gr
    x.beginPath()
    x.arc(cx, cy, 26 * s, 0, PI * 2)
    x.fill()
  }
  // a 2D context that draws nothing: every call and gradient is a no-op
  const NO_CANVAS = new Proxy(function () {}, { get: () => NO_CANVAS, apply: () => NO_CANVAS, set: () => true }) as unknown as CanvasRenderingContext2D
  function crackGlass(c: BuildContext, msh: Mesh, p: Vector3, force: number, sc?: number | null) {
    const G = msh.userData.glass
    // a pane already gone shows its edge, not the crack layer (freed when it broke): the web is drawn on nothing, so the random stream (and every
    // seeded result after it) stays the same as when the hidden canvas was still drawn on
    if (G.cracksFreed) {
      drawWeb(NO_CANVAS, 0, 0, sc != null ? sc : 0.6 + force * 0.5, Math.max(0.4, G.aspect || 1), c.rand)
      G.hits++
      return
    }
    if (!G.cv) {
      G.cv = document.createElement('canvas')
      G.cv.width = G.cv.height = 256
      const x0 = G.cv.getContext('2d')
      x0.fillStyle = 'rgba(48,66,72,0.5)'
      x0.fillRect(0, 0, 256, 256)
      G.tex = new THREE.CanvasTexture(G.cv)
      msh.material = crackedGlassMaterial(THREE, G.tex)
    }
    const uv = glassUV(c, msh, p)
    const x = G.cv.getContext('2d')
    drawWeb(x, uv[0] * 256, (1 - uv[1]) * 256, sc != null ? sc : 0.6 + force * 0.5, Math.max(0.4, G.aspect || 1), c.rand)
    G.tex.needsUpdate = true
    G.hits++
  }
  /* irregular edge attached to the frame for glass without an outline (cut from the shell): only the strip near the open edges remains */
  function glassRim(geo: BufferGeometry, rnd: () => number) {
    const src = geo.index ? geo.toNonIndexed() : geo
    const p = src.attributes.position
    const cnt: Record<string, { n: number; a: number; b: number }> = {}
    const toColor: Vector3[][] = []
    function key(i: number) {
      return Math.round(p.getX(i) * 1000) + ',' + Math.round(p.getY(i) * 1000) + ',' + Math.round(p.getZ(i) * 1000)
    }
    for (let f = 0; f < p.count; f += 3)
      for (let k = 0; k < 3; k++) {
        const a = f + k
        const b = f + ((k + 1) % 3)
        const ka = key(a)
        const kb = key(b)
        const e = ka < kb ? ka + '|' + kb : kb + '|' + ka
        if (!cnt[e]) cnt[e] = { n: 0, a: a, b: b }
        cnt[e].n++
      }
    Object.keys(cnt).forEach(function (e) {
      const q = cnt[e]
      if (q.n === 1) toColor.push([new V3().fromBufferAttribute(p, q.a), new V3().fromBufferAttribute(p, q.b)])
    })
    if (toColor.length < 3 || toColor.length > 900) return null
    const nz = I.valueNoise(Math.floor(rnd() * 999))
    const ab = new V3()
    const ap = new V3()
    const q2 = new V3()
    function dist(x: number, y: number, z: number) {
      let best = 1e9
      q2.set(x, y, z)
      for (let i = 0; i < toColor.length; i++) {
        const A = toColor[i][0]
        const B = toColor[i][1]
        ab.subVectors(B, A)
        ap.subVectors(q2, A)
        const t = clamp(ap.dot(ab) / (ab.lengthSq() || 1), 0, 1)
        ap.addScaledVector(ab, -t)
        const d = ap.lengthSq()
        if (d < best) best = d
      }
      return Math.sqrt(best)
    }
    const sub = subdivide(src, 0.03)
    const r = cutGeometry(sub, [
      {
        sdf: function (x: number, y: number, z: number) {
          return 0.02 + 0.07 * nz(x * 9 + z * 5, y * 9 + z * 3) * nz(x * 23, y * 23 + z * 17) - dist(x, y, z)
        },
      },
    ])
    if (!r.geo.attributes.position.count) return null
    return crease(r.geo, 60)
  }
  function shatterGlass(c: BuildContext, msh: Mesh, force: number, dir: Vector3) {
    const G = msh.userData.glass
    if (G.broken) return
    G.broken = true
    // the crack layer (its own material over a 256 px canvas) is replaced by the edge below: free it, or every broken pane keeps a texture on the GPU for good
    const freeCracks = function () {
      if (!G.tex) return
      if (msh.material !== MATERIALS.glassEdge && (msh.material as MeshStandardMaterial)?.map === G.tex) (msh.material as Material).dispose()
      G.tex.dispose()
      G.tex = null
      G.cv = null
      G.cracksFreed = true
    }
    const cubesAt: Vector3[] = []
    if (G.outline && G.T !== undefined) {
      const out = G.outline
      let cx = 0
      let cy = 0
      out.forEach(function (p: Vector2) {
        cx += p.x
        cy += p.y
      })
      cx /= out.length
      cy /= out.length
      const shp = new THREE.Shape(
        out.map(function (p: Vector2) {
          return new THREE.Vector2(p.x, p.y)
        }),
      )
      const hole = new THREE.Path()
      out.forEach(function (p: Vector2, i: number) {
        const dx = cx - p.x
        const dy = cy - p.y
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(d * 0.45, 0.025 + c.rand() * (i % 3 === 0 ? 0.11 : 0.05))
        const q = [p.x + (dx / d) * k, p.y + (dy / d) * k]
        if (i === 0) hole.moveTo(q[0], q[1])
        else hole.lineTo(q[0], q[1])
      })
      shp.holes.push(hole)
      const geo = new THREE.ShapeGeometry(shp)
      geo.translate(0, 0, G.zpos + 0.004)
      tumble(geo, G.T)
      geo.computeVertexNormals()
      msh.geometry.dispose()
      msh.geometry = geo
      freeCracks()
      msh.material = MATERIALS.glassEdge
      let minx = 1e9
      let maxx = -1e9
      let miny = 1e9
      let maxy = -1e9
      out.forEach(function (p: Vector2) {
        minx = Math.min(minx, p.x)
        maxx = Math.max(maxx, p.x)
        miny = Math.min(miny, p.y)
        maxy = Math.max(maxy, p.y)
      })
      for (let i = 0; i < 46; i++) {
        const x = minx + (maxx - minx) * (0.1 + c.rand() * 0.8)
        const y = miny + (maxy - miny) * (0.1 + c.rand() * 0.8)
        cubesAt.push(new V3(x, y, G.side * I.halfAt(G.Wg, G.T, y)))
      }
    } else {
      msh.geometry.computeBoundingBox()
      const bb = msh.geometry.boundingBox!.clone().applyMatrix4(msh.matrix)
      const rim = glassRim(msh.geometry, c.rand)
      if (rim) {
        msh.geometry.dispose()
        msh.geometry = rim
        freeCracks()
        msh.material = MATERIALS.glassEdge
      } else {
        freeCracks()
        msh.visible = false
      }
      for (let j = 0; j < 36; j++)
        cubesAt.push(
          new V3(
            bb.min.x + (bb.max.x - bb.min.x) * c.rand(),
            bb.min.y + (bb.max.y - bb.min.y) * c.rand(),
            bb.min.z + (bb.max.z - bb.min.z) * c.rand(),
          ),
        )
    }
    const seatGeo: BufferGeometry[] = []
    const d = dir.clone().normalize()
    /* a pane on an open door falls from where the door has it, not from where the door was closed */
    if (msh.parent && msh.parent !== c.vehicle) {
      c.root.updateMatrixWorld(true)
      const toVehicle = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert().multiply(msh.parent.matrixWorld)
      cubesAt.forEach(function (q) {
        q.applyMatrix4(toVehicle)
      })
    }
    cubesAt.forEach(function (p, i) {
      if (i % 3 === 0 && c.seatTops.length && !c.rollState && !c.flipped) {
        let best = null as (typeof c.seatTops)[number] | null
        let bd = 1e9
        c.seatTops.forEach(function (s) {
          const dd = Math.hypot(s.x - p.x, s.z - p.z)
          if (dd < bd) {
            bd = dd
            best = s
          }
        })
        if (best && bd < 1.6) {
          const g = new THREE.BoxGeometry(0.014, 0.014, 0.014)
          g.rotateY(c.rand() * 3)
          g.translate(best.x + (c.rand() - 0.5) * best.l * 0.8, best.y + 0.007, best.z + (c.rand() - 0.5) * best.w * 0.8)
          seatGeo.push(g)
          return
        }
      }
      const v = d
        .clone()
        .multiplyScalar(0.4 + force * c.rand() * 1.4)
        .add(new V3((c.rand() - 0.5) * 0.8, c.rand() * 0.6, (c.rand() - 0.5) * 0.8))
      kit.spawn(c, 'cube', c.toEffects(p), c.dirToEffects(v))
    })
    if (seatGeo.length) {
      const sm = new THREE.Mesh(mergeGeometries(seatGeo), I.PARTICLE_MATERIALS.cube)
      sm.castShadow = false
      c.vehicle.add(sm)
    }
  }
  function hitGlass(c: BuildContext, msh: Mesh | null | undefined, p: Vector3, dir: Vector3, force: number) {
    const G = msh && msh.userData.glass
    if (!G || G.broken) return
    if (G.type === 'laminated') {
      crackGlass(c, msh, p, force)
      I.burst(c, 'shard', c.toEffects(p), 4 + Math.round(force * 4), { dir: c.dirToEffects(dir.clone().negate()), speed: 1.2 })
    } else shatterGlass(c, msh, force, dir)
  }
  kit.hitGlass = hitGlass
  function breakLight(c: BuildContext, L: VehicleLamp | null | undefined, dir: Vector3) {
    if (!L || L.broken) return
    L.broken = true
    L.lens.forEach(function (m: Mesh) {
      // a lens broken by a hit leaves its jagged edge in the bezel, as a broken pane does; a lamp broken by the zone's band keeps the old look
      const rim = L.lensMaterial ? glassRim(m.geometry, c.rand) : null
      if (!rim) {
        m.visible = false
        return
      }
      m.geometry.dispose()
      m.geometry = rim
      m.material = MATERIALS.glassEdge
      m.userData.lensRim = true
    })
    // without its lens and its bulb the housing is a dark hollow: the reflector, a lit chrome bowl while the lamp worked, shows dull and dark
    if (L.lensMaterial)
      ((L.reflector || []) as { material: unknown }[]).forEach(function (m) {
        m.material = MATERIALS.broken
      })
    L.inner.forEach(function (m: Mesh) {
      m.material = MATERIALS.bulbBroken
    })
    ;(L.halo || []).forEach(function (h: Object3D) {
      h.visible = false
    })
    const p = L.group ? L.group.position.clone() : L.inner[0] ? L.inner[0].position.clone() : new V3()
    // glass bursts into many small shards; a plastic lens breaks out in fewer, larger pieces. Either way they land and stay on the ground
    const glass = L.lensMaterial !== 'plastic'
    I.burst(c, 'lens', c.toEffects(p), glass ? 10 : 5, { dir: c.dirToEffects(dir.clone().negate()), speed: glass ? 1.4 : 1.1, variant: L.tint === 'red' ? 'red' : 'clear' })
    I.burst(c, 'plastic', c.toEffects(p), glass ? 2 : 5, { dir: c.dirToEffects(dir.clone().negate()), speed: 1.0 })
  }
  kit.breakLight = breakLight
  /* A cracked polycarbonate or acrylic lens turns hazy white along its cracks (crazing): the crack texture on a lens dense enough to show it. */
  const crazedCache = new Map<Material, Material>()
  const CRAZED_OPACITY = 0.6
  function crazed(material: Material): Material {
    const known = crazedCache.get(material)
    if (known) return known
    const m = I.crackLens(material).clone()
    m.opacity = Math.max(m.opacity ?? 1, CRAZED_OPACITY)
    m.transparent = true
    m.userData.shared = true
    crazedCache.set(material, m)
    return m
  }
  /* A lamp whose lens is holed or cracked but still in place (polycarbonate, acrylic): the lens shows the cracks and sheds a few chips; a round
     through it wrecks the bulb or LED behind it, so the lamp goes dark. */
  function crackLight(c: BuildContext, L: CrackedLamp, dir: Vector3, pierced: boolean): void {
    if (!L || L.broken) return
    if (!L.cracked) {
      L.cracked = true
      for (const m of L.lens) if (m.material && !Array.isArray(m.material)) m.material = crazed(m.material)
    }
    const p = L.group ? L.group.position.clone() : L.inner[0] ? L.inner[0].position.clone() : new V3()
    I.burst(c, 'lens', c.toEffects(p), 3, { dir: c.dirToEffects(dir.clone().negate()), speed: 0.9, variant: L.tint === 'red' ? 'red' : 'clear' })
    if (!pierced || L.dark) return
    L.dark = true
    for (const m of L.inner) m.material = MATERIALS.bulbBroken
    for (const h of L.halo ?? []) h.visible = false
  }
  kit.crackLight = crackLight

  const shared = { glassUV, drawWeb, crackGlass, glassRim, shatterGlass, hitGlass, breakLight, crackLight }

  Object.assign(I, shared)

  return shared
}
