/** Glass cracks, shattering and tempered or laminated breakage textures. */
import type { Kit } from './types'
import { clamp } from './util'

export function installGlassDamage(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const document = kit.document
  const { DOUBLE_SIDE, MATERIALS, crease, cutGeometry, mergeGeometries, subdivide, tumble } = I

  /* ================= glass: cracks and shattering ================= */
  function glassUV(msh: any, pLocal: any) {
    const pos = msh.geometry.attributes.position
    const uv = msh.geometry.attributes.uv
    if (!uv) return [0.5, 0.5]
    const inv = new THREE.Matrix4().copy(msh.matrix).invert()
    const q = pLocal.clone().applyMatrix4(inv)
    let best = 1e9
    let bi = 0
    const v = new V3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const d = v.distanceToSquared(q)
      if (d < best) {
        best = d
        bi = i
      }
    }
    return [uv.getX(bi), uv.getY(bi)]
  }
  /* Crack web: thick opaque lines at the centre, thinning outward, with a dark outline so it reads from afar. */
  function drawWeb(x: any, cx: any, cy: any, s: any, ax: any, rnd: any) {
    const n = 16 + Math.floor(rnd() * 8)
    const spokes: any = []
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
    function seg(p: any, q: any, wd: any, col: any) {
      x.strokeStyle = col
      x.lineWidth = wd
      x.beginPath()
      x.moveTo(p[0], p[1])
      x.lineTo(q[0], q[1])
      x.stroke()
    }
    ;[
      ['rgba(8,12,14,0.55)', 2.2],
      ['rgba(244,248,250,0.97)', 0],
    ].forEach(function (pass: any) {
      spokes.forEach(function (pts: any) {
        for (let k = 1; k < pts.length; k++) {
          const t = k / pts.length
          seg(pts[k - 1], pts[k], Math.max(0.8, 4.2 * (1 - t) + 0.6) + pass[1], pass[0])
        }
      })
      for (let r = 1; r <= 4; r++) {
        x.lineWidth = Math.max(0.8, 2.6 - r * 0.45) + pass[1] * 0.6
        x.strokeStyle = pass[0]
        x.beginPath()
        spokes.forEach(function (sp: any, j: any) {
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
  function crackGlass(c: any, msh: any, p: any, force: any, sc?: any) {
    const G = msh.userData.glass
    if (!G.cv) {
      G.cv = document.createElement('canvas')
      G.cv.width = G.cv.height = 256
      const x0 = G.cv.getContext('2d')
      x0.fillStyle = 'rgba(48,66,72,0.5)'
      x0.fillRect(0, 0, 256, 256)
      G.tex = new THREE.CanvasTexture(G.cv)
      msh.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: G.tex,
        emissive: 0x6a7276,
        emissiveMap: G.tex,
        transparent: true,
        roughness: 0.25,
        metalness: 0.1,
        side: DOUBLE_SIDE,
        depthWrite: false,
      })
    }
    const uv = glassUV(msh, p)
    const x = G.cv.getContext('2d')
    drawWeb(x, uv[0] * 256, (1 - uv[1]) * 256, sc != null ? sc : 0.6 + force * 0.5, Math.max(0.4, G.aspect || 1), c.rand)
    G.tex.needsUpdate = true
    G.hits++
  }
  /* irregular edge attached to the frame for glass without an outline (cut from the shell): only the strip near the open edges remains */
  function glassRim(geo: any, rnd: any) {
    const src = geo.index ? geo.toNonIndexed() : geo
    const p = src.attributes.position
    const cnt: any = {}
    const toColor: any = []
    function key(i: any) {
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
    function dist(x: any, y: any, z: any) {
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
        sdf: function (x: any, y: any, z: any) {
          return 0.02 + 0.07 * nz(x * 9 + z * 5, y * 9 + z * 3) * nz(x * 23, y * 23 + z * 17) - dist(x, y, z)
        },
      },
    ])
    if (!r.geo.attributes.position.count) return null
    return crease(r.geo, 60)
  }
  function shatterGlass(c: any, msh: any, force: any, dir: any) {
    const G = msh.userData.glass
    if (G.broken) return
    G.broken = true
    const cubesAt = []
    if (G.outline && G.T !== undefined) {
      const out = G.outline
      let cx = 0
      let cy = 0
      out.forEach(function (p: any) {
        cx += p.x
        cy += p.y
      })
      cx /= out.length
      cy /= out.length
      const shp = new THREE.Shape(
        out.map(function (p: any) {
          return new THREE.Vector2(p.x, p.y)
        }),
      )
      const hole = new THREE.Path()
      out.forEach(function (p: any, i: any) {
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
      msh.material = MATERIALS.glassEdge
      let minx = 1e9
      let maxx = -1e9
      let miny = 1e9
      let maxy = -1e9
      out.forEach(function (p: any) {
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
      const bb = msh.geometry.boundingBox.clone().applyMatrix4(msh.matrix)
      const rim = glassRim(msh.geometry, c.rand)
      if (rim) {
        msh.geometry.dispose()
        msh.geometry = rim
        msh.material = MATERIALS.glassEdge
      } else msh.visible = false
      for (let j = 0; j < 36; j++)
        cubesAt.push(
          new V3(
            bb.min.x + (bb.max.x - bb.min.x) * c.rand(),
            bb.min.y + (bb.max.y - bb.min.y) * c.rand(),
            bb.min.z + (bb.max.z - bb.min.z) * c.rand(),
          ),
        )
    }
    const seatGeo: any = []
    const d = dir.clone().normalize()
    cubesAt.forEach(function (p, i) {
      if (i % 3 === 0 && c.seatTops.length && !c.rollState && !c.flipped) {
        let best: any = null
        let bd = 1e9
        c.seatTops.forEach(function (s: any) {
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
  function hitGlass(c: any, msh: any, p: any, dir: any, force: any) {
    const G = msh && msh.userData.glass
    if (!G || G.broken) return
    if (G.type === 'laminated') {
      crackGlass(c, msh, p, force)
      I.burst(c, 'shard', c.toEffects(p), 4 + Math.round(force * 4), { dir: c.dirToEffects(dir.clone().negate()), speed: 1.2 })
    } else shatterGlass(c, msh, force, dir)
  }
  kit.hitGlass = hitGlass
  function breakLight(c: any, L: any, dir: any) {
    if (!L || L.broken) return
    L.broken = true
    L.lens.forEach(function (m: any) {
      m.visible = false
    })
    L.inner.forEach(function (m: any) {
      m.material = MATERIALS.bulbBroken
    })
    ;(L.halo || []).forEach(function (h: any) {
      h.visible = false
    })
    const p = L.group ? L.group.position.clone() : L.inner[0] ? L.inner[0].position.clone() : new V3()
    I.burst(c, 'lens', c.toEffects(p), 10, { dir: c.dirToEffects(dir.clone().negate()), speed: 1.4, variant: L.tint === 'red' ? 'red' : 'clear' })
    I.burst(c, 'plastic', c.toEffects(p), 2, { dir: c.dirToEffects(dir.clone().negate()), speed: 1.0 })
  }
  kit.breakLight = breakLight

  Object.assign(I, { glassUV, drawWeb, crackGlass, glassRim, shatterGlass, hitGlass, breakLight })
}
