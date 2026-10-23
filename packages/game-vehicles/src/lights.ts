/** Headlights and taillights in several styles, with beams and glow. */
import type { Kit } from './types'
import { clamp } from './util'

export function installLights(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const document = kit.document
  const { MATERIALS, mergeGeometries, roundedBoxGeometry, taper } = I

  /* ================= headlights, taillights, grilles ================= */
  function lampGroup(c: any, x: any, y: any, z: any, rotY: any) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = rotY || 0
    g.userData.rigid = true
    c.vehicle.add(g)
    return g
  }
  function gm(g: any, geo: any, mat: any, x?: any, y?: any, z?: any) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x || 0, y || 0, z || 0)
    m.castShadow = false
    g.add(m)
    return m
  }
  function wedgeY(geo: any, w: any, s: any, k: any) {
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = clamp((p.getZ(i) * s) / w + 0.5, 0, 1)
      p.setY(i, p.getY(i) * (1 - k * t) + k * t * 0.0)
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }
  /* additive halo of the headlight/taillight (sprite without raycast) */
  let haloTex: any = null
  function glowTexture() {
    if (haloTex) return haloTex
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const x: any = cv.getContext('2d')
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.18, 'rgba(255,255,255,0.55)')
    gr.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = gr
    x.fillRect(0, 0, 64, 64)
    haloTex = new THREE.CanvasTexture(cv)
    return haloTex
  }
  const haloMats: any = {}
  function halo(parent: any, x: any, y: any, z: any, size: any, hex: any, op: any) {
    const key = hex + op
    if (!haloMats[key])
      haloMats[key] = new THREE.SpriteMaterial({
        map: glowTexture(),
        color: new THREE.Color(hex),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: op,
      })
    const sp = new THREE.Sprite(haloMats[key])
    sp.position.set(x, y, z)
    sp.scale.set(size, size, 1)
    sp.raycast = function () {}
    sp.userData.decal = true
    sp.userData.halo = true
    sp.renderOrder = 4
    parent.add(sp)
    return sp
  }
  kit.halo = halo
  function lampKit(g: any, d: any, inner: any, lens: any, lensMat: any, refl?: any) {
    refl = refl || MATERIALS.reflector
    return {
      housing: function (w: any, h: any, y?: any, z?: any, geoFn?: any) {
        const geo = roundedBoxGeometry(d, h, w, Math.min(0.03, h * 0.4))
        if (geoFn) geoFn(geo)
        return gm(g, geo, MATERIALS.housing, 0, y || 0, z || 0)
      },
      lens: function (w: any, h: any, y?: any, z?: any, geoFn?: any) {
        const geo = roundedBoxGeometry(0.03, h + 0.006, w + 0.006, Math.min(0.025, h * 0.4))
        if (geoFn) geoFn(geo)
        const L = gm(g, geo, lensMat, d / 2 - 0.004, y || 0, z || 0)
        L.renderOrder = 3
        lens.push(L)
        return L
      },
      glow: function (geo: any, mat: any, x: any, y: any, z: any) {
        const m = gm(g, geo, mat, x, y, z)
        inner.push(m)
        return m
      },
      proj: function (y: any, z: any, r: any, mat: any) {
        const bz = gm(g, new THREE.CylinderGeometry(r * 1.3, r * 1.45, 0.03, 18), refl, d / 2 - 0.03, y, z)
        bz.rotation.z = -PI / 2
        if (refl !== MATERIALS.reflector) inner.push(bz)
        const e = gm(g, new THREE.SphereGeometry(r, 14, 10), mat, d / 2 - 0.022, y, z)
        e.scale.x = 0.55
        inner.push(e)
        return e
      },
    }
  }
  /* Headlight. o: { style: round|dround|rect|slim|split|wedge|ledbar|truck, x, y, z, w, h, d, side (+1 right / -1 left), yaw, mat, label } */
  kit.headlight = function (c: any, o: any) {
    const st = o.style || 'rect'
    const w = o.w || 0.32
    const h = o.h || 0.12
    const d = o.d || 0.09
    const s = o.side || (o.z >= 0 ? 1 : -1)
    const g = lampGroup(c, o.x, o.y, o.z, -s * (o.yaw || 0))
    const inner: any = []
    const lens: any = []
    const B = o.mat || MATERIALS.head
    const K = lampKit(g, d, inner, lens, o.lens || MATERIALS.lens, MATERIALS.reflectorLit)
    if (st === 'round' || st === 'dround') {
      const nR = st === 'dround' ? 2 : 1
      const r = Math.min(h / 2, w / (2 * nR)) * 0.95
      for (let i = 0; i < nR; i++) {
        const pz = nR === 1 ? 0 : ((i ? 1 : -1) * w) / 4
        const back = gm(g, new THREE.CylinderGeometry(r * 1.06, r * 1.06, d * 0.8, 22), MATERIALS.housing, 0, 0, pz)
        back.rotation.z = PI / 2
        const ring = gm(g, new THREE.TorusGeometry(r * 1.02, 0.013, 8, 30), MATERIALS.chrome, d / 2 - 0.006, 0, pz)
        ring.rotation.y = PI / 2
        const bowl = gm(g, new THREE.SphereGeometry(r * 0.96, 18, 10, 0, PI * 2, 0, PI / 2), MATERIALS.reflectorLit, d / 2 - 0.012, 0, pz)
        bowl.rotation.z = PI / 2
        bowl.scale.y = 0.55
        inner.push(bowl)
        K.glow(new THREE.SphereGeometry(r * 0.24, 12, 8), B, d / 2 - r * 0.3, 0, pz)
        const ln = gm(g, new THREE.SphereGeometry(r, 18, 10, 0, PI * 2, 0, PI / 2), o.lens || MATERIALS.lens, d / 2 - 0.008, 0, pz)
        ln.rotation.z = -PI / 2
        ln.scale.y = 0.3
        ln.renderOrder = 3
        lens.push(ln)
      }
    } else if (st === 'rect' || st === 'truck') {
      K.housing(w, h)
      const pr = Math.min(h * 0.3, w * 0.14)
      K.proj(0, -w * 0.2, pr, B)
      K.proj(0, st === 'truck' ? w * 0.08 : w * 0.18, pr, B)
      if (st === 'truck') K.glow(roundedBoxGeometry(0.02, h * 0.8, w * 0.2, 0.01), MATERIALS.amber, d / 2 - 0.02, 0, s * w * 0.38)
      else K.glow(roundedBoxGeometry(0.012, h * 0.2, w * 0.16, 0.006), MATERIALS.amber, d / 2 - 0.016, -h * 0.34, s * w * 0.4)
      K.lens(w, h)
    } else if (st === 'slim' || st === 'ledbar') {
      K.housing(w, h)
      K.glow(roundedBoxGeometry(0.012, Math.max(0.012, h * 0.18), w * 0.92, 0.005), MATERIALS.led, d / 2 - 0.014, h * 0.3, 0)
      K.proj(-h * 0.08, -s * w * 0.22, h * 0.26, B)
      K.proj(-h * 0.08, s * w * 0.06, h * 0.22, B)
      K.lens(w, h)
    } else if (st === 'split') {
      const hu = h * 0.26
      const hl = h * 0.62
      K.housing(w, hu, h / 2 - hu / 2)
      K.glow(roundedBoxGeometry(0.012, hu * 0.45, w * 0.92, 0.005), MATERIALS.led, d / 2 - 0.014, h / 2 - hu / 2, 0)
      K.lens(w, hu, h / 2 - hu / 2)
      K.housing(w * 0.8, hl, -h / 2 + hl / 2, -s * w * 0.08)
      K.proj(-h / 2 + hl / 2, -s * w * 0.25, hl * 0.3, B)
      K.proj(-h / 2 + hl / 2, s * w * 0.05, hl * 0.3, B)
      K.lens(w * 0.8, hl, -h / 2 + hl / 2, -s * w * 0.08)
    } else if (st === 'wedge') {
      const wf = function (geo: any) {
        wedgeY(geo, w, s, 0.45)
      }
      K.housing(w, h, 0, 0, wf)
      K.proj(h * 0.05, -s * w * 0.24, h * 0.25, B)
      K.proj(h * 0.05, s * w * 0.0, h * 0.2, B)
      K.glow(roundedBoxGeometry(0.012, 0.014, w * 0.72, 0.005), MATERIALS.led, d / 2 - 0.014, -h * 0.32, -s * w * 0.1)
      K.glow(roundedBoxGeometry(0.012, h * 0.42, 0.014, 0.005), MATERIALS.led, d / 2 - 0.014, -h * 0.14, s * w * 0.26)
      K.lens(w, h, 0, 0, wf)
    }
    const L: any = { group: g, inner: inner, lens: lens, kind: 'headlight', tint: 'clear', broken: false }
    if (o.halo !== false) L.halo = [halo(g, d / 2 + 0.03, 0, 0, Math.max(w, h) * 1.9 + 0.12, '#ffe7b8', 0.55)]
    c.lights.push(L)
    if (!o.noPart) {
      const pt = c.part('headlight', o.label || kit.t('parts.headlight', { s }), g, new V3(o.x, o.y, o.z), o.reach || 0.8)
      pt.light = L
    }
    return L
  }
  /* Taillight. o: { style: wrap|bar|vertical|L|round2, x, y, z, w, h, d, side, wrap (length of the wrap-around) } */
  kit.taillight = function (c: any, o: any) {
    const st = o.style || 'wrap'
    const w = o.w || 0.3
    const h = o.h || 0.14
    const d = o.d || 0.08
    const s = o.side || (o.z >= 0 ? 1 : -1)
    const ls = -s
    const g = lampGroup(c, o.x, o.y, o.z, PI)
    const inner: any = []
    const lens: any = []
    const K = lampKit(g, d, inner, lens, MATERIALS.lensRed)
    if (st === 'round2') {
      ;[-1, 1].forEach(function (q) {
        const r = Math.min(h / 2, w / 4) * 0.92
        const pz = (q * w) / 4
        const back = gm(g, new THREE.CylinderGeometry(r * 1.08, r * 1.08, d * 0.7, 20), MATERIALS.housing, 0, 0, pz)
        back.rotation.z = PI / 2
        const e = gm(g, new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.012, 20), q * ls > 0 ? MATERIALS.tail : MATERIALS.tail, d / 2 - 0.02, 0, pz)
        e.rotation.z = PI / 2
        inner.push(e)
        const ring = gm(g, new THREE.TorusGeometry(r, 0.01, 6, 24), MATERIALS.chrome, d / 2 - 0.004, 0, pz)
        ring.rotation.y = PI / 2
        const ln = gm(g, new THREE.SphereGeometry(r, 16, 8, 0, PI * 2, 0, PI / 2), MATERIALS.lensRed, d / 2 - 0.01, 0, pz)
        ln.rotation.z = -PI / 2
        ln.scale.y = 0.25
        ln.renderOrder = 3
        lens.push(ln)
      })
    } else if (st === 'vertical') {
      K.housing(w, h)
      K.glow(roundedBoxGeometry(0.012, h * 0.55, w * 0.8, 0.006), MATERIALS.tail, d / 2 - 0.016, h * 0.18, 0)
      K.glow(roundedBoxGeometry(0.012, h * 0.16, w * 0.8, 0.006), MATERIALS.amber, d / 2 - 0.016, -h * 0.22, 0)
      K.glow(roundedBoxGeometry(0.012, h * 0.12, w * 0.8, 0.006), MATERIALS.rev, d / 2 - 0.016, -h * 0.4, 0)
      K.lens(w, h)
    } else if (st === 'L') {
      const th = h * 0.42
      K.housing(w, th, h / 2 - th / 2)
      K.glow(roundedBoxGeometry(0.012, th * 0.6, w * 0.9, 0.006), MATERIALS.tail, d / 2 - 0.016, h / 2 - th / 2, 0)
      K.lens(w, th, h / 2 - th / 2)
      K.housing(w * 0.3, h - th, -th / 2, ls * w * 0.35)
      K.glow(roundedBoxGeometry(0.012, (h - th) * 0.7, w * 0.22, 0.006), MATERIALS.tail, d / 2 - 0.016, -th / 2, ls * w * 0.35)
      K.lens(w * 0.3, h - th, -th / 2, ls * w * 0.35)
      K.glow(roundedBoxGeometry(0.012, th * 0.4, w * 0.25, 0.006), MATERIALS.rev, d / 2 - 0.016, -h * 0.25, -ls * w * 0.1)
    } else {
      K.housing(w, h)
      K.glow(roundedBoxGeometry(0.012, h * 0.42, w * 0.88, 0.006), MATERIALS.tail, d / 2 - 0.016, h * 0.18, 0)
      K.glow(roundedBoxGeometry(0.012, h * 0.22, w * 0.3, 0.006), MATERIALS.rev, d / 2 - 0.016, -h * 0.22, -ls * w * 0.25)
      K.glow(roundedBoxGeometry(0.012, h * 0.22, w * 0.3, 0.006), MATERIALS.amber, d / 2 - 0.016, -h * 0.22, ls * w * 0.2)
      K.lens(w, h)
      if (st === 'wrap') {
        const wl = o.wrap || 0.2
        const side = gm(g, roundedBoxGeometry(wl, h * 0.9, 0.04, 0.015), MATERIALS.housing, d / 2 - wl / 2, 0, ls * (w / 2 - 0.01))
        const sg = gm(g, roundedBoxGeometry(wl * 0.85, h * 0.5, 0.012, 0.005), MATERIALS.tail, d / 2 - wl / 2, h * 0.12, ls * (w / 2 + 0.008))
        inner.push(sg)
        const sl = gm(g, roundedBoxGeometry(wl, h * 0.9 + 0.006, 0.014, 0.006), MATERIALS.lensRed, d / 2 - wl / 2, 0, ls * (w / 2 + 0.016))
        sl.renderOrder = 3
        lens.push(sl)
        side.castShadow = false
      }
    }
    const L: any = { group: g, inner: inner, lens: lens, kind: 'taillight', tint: 'red', broken: false }
    if (o.halo !== false) L.halo = [halo(g, d / 2 + 0.03, 0, 0, Math.max(w, h) * 1.5 + 0.08, '#ff2a1a', 0.4)]
    c.lights.push(L)
    if (!o.noPart) {
      const pt = c.part('taillight', o.label || kit.t('parts.taillight', { s }), g, new V3(o.x, o.y, o.z), o.reach || 0.8)
      pt.light = L
    }
    return L
  }
  /* light bar from end to end (ledbar at the front, bar at the rear). face: +1 front, -1 rear */
  kit.lightBar = function (c: any, x: any, y: any, z0: any, z1: any, h: any, face: any, mat: any) {
    const len = Math.abs(z1 - z0)
    const zc = (z0 + z1) / 2
    const f = face || 1
    const hs = c.roundBox(0.04, h + 0.012, len, 0.008, MATERIALS.housing, x, y, zc)
    hs.castShadow = false
    const gl = c.roundBox(0.014, h, len, 0.006, mat || (f > 0 ? MATERIALS.led : MATERIALS.tail), x + f * 0.016, y, zc)
    gl.castShadow = false
    const ln = c.roundBox(0.012, h + 0.014, len + 0.006, 0.006, f > 0 ? MATERIALS.lens : MATERIALS.lensRed, x + f * 0.026, y, zc)
    ln.castShadow = false
    ln.renderOrder = 3
    const L = { group: null, inner: [gl], lens: [ln], kind: f > 0 ? 'headlight' : 'taillight', tint: f > 0 ? 'clear' : 'red', broken: false }
    c.lights.push(L)
    const pt = c.part(f > 0 ? 'headlight' : 'taillight', { key: f > 0 ? 'led_bar' : 'taillight_bar' }, gl, new V3(x, y, zc), 0.6)
    pt.light = L
    return L
  }
  /* Generic emblem (chrome circle with a bar), never a real logo */
  kit.emblem = function (c: any, x: any, y: any, z: any, r: any, parent: any) {
    r = r || 0.045
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.userData.rigid = true
    ;(parent || c.vehicle).add(g)
    const d1 = gm(g, new THREE.CylinderGeometry(r, r, 0.012, 24), MATERIALS.chrome)
    d1.rotation.z = PI / 2
    const d2 = gm(g, new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.014, 24), MATERIALS.trim)
    d2.rotation.z = PI / 2
    gm(g, roundedBoxGeometry(0.016, r * 0.32, r * 1.4, 0.005), MATERIALS.chrome)
    gm(g, roundedBoxGeometry(0.016, r * 1.0, r * 0.22, 0.005), MATERIALS.chrome, 0, 0, r * 0.25).rotation.x = 0.5
    return g
  }
  /* Grille. o: { style: bars|mesh|big|seven|closed|truck, x, y, z, w, h, col, emblem } */
  kit.grille = function (c: any, o: any) {
    const st = o.style || 'bars'
    const w = o.w || 0.6
    const h = o.h || 0.16
    const g = lampGroup(c, o.x, o.y, o.z || 0, 0)
    let i
    const paint = c.paint(o.col || c.meta.color || '#6a6a6a')
    if (st === 'bars') {
      gm(g, roundedBoxGeometry(0.05, h, w, Math.min(0.03, h * 0.3)), MATERIALS.trim)
      const nb = Math.max(2, Math.round(h / 0.05))
      for (i = 0; i < nb; i++) gm(g, roundedBoxGeometry(0.02, 0.016, w * 0.92, 0.006), MATERIALS.chrome, 0.03, -h / 2 + ((i + 0.5) * h) / nb, 0)
    } else if (st === 'mesh') {
      gm(g, roundedBoxGeometry(0.05, h, w, Math.min(0.03, h * 0.3)), MATERIALS.housing)
      const cell = 0.026
      const list = []
      const rows = Math.floor((h * 0.85) / (cell * 1.6))
      const cols = Math.floor((w * 0.9) / (cell * 1.8))
      for (let rI = 0; rI < rows; rI++)
        for (let cI = 0; cI < cols; cI++) {
          const hg = new THREE.CylinderGeometry(cell, cell, 0.02, 6)
          hg.rotateZ(PI / 2)
          hg.rotateX(PI / 6)
          hg.translate(0.026, -h * 0.42 + ((rI + 0.5) * h * 0.85) / rows, -w * 0.45 + ((cI + 0.5 + (rI % 2) * 0.5 - 0.25) * w * 0.9) / cols)
          list.push(hg)
        }
      if (list.length) gm(g, mergeGeometries(list), MATERIALS.trim)
      gm(g, roundedBoxGeometry(0.022, 0.014, w, 0.006), MATERIALS.chrome, 0.03, h / 2 - 0.008, 0)
    } else if (st === 'big') {
      const fr = roundedBoxGeometry(0.06, h, w, 0.03)
      taper(fr, { sz: 1.12 })
      gm(g, fr, MATERIALS.chrome)
      gm(g, roundedBoxGeometry(0.064, h * 0.82, w * 0.9, 0.02), MATERIALS.housing, 0.002, 0, 0)
      const nb2 = Math.max(3, Math.round(h / 0.06))
      for (i = 0; i < nb2; i++)
        gm(g, roundedBoxGeometry(0.02, 0.02, w * (0.84 + (0.1 * i) / nb2), 0.006), MATERIALS.chrome, 0.036, -h * 0.38 + (i * h * 0.76) / (nb2 - 1), 0)
    } else if (st === 'seven') {
      gm(g, roundedBoxGeometry(0.04, h, w, Math.min(0.03, h * 0.3)), paint)
      for (i = 0; i < 7; i++) gm(g, roundedBoxGeometry(0.03, h * 0.72, w * 0.07, 0.01), MATERIALS.housing, 0.008, 0, -w * 0.42 + i * w * 0.14)
    } else if (st === 'closed') {
      gm(g, roundedBoxGeometry(0.03, h, w, Math.min(0.03, h * 0.4)), paint)
      gm(g, roundedBoxGeometry(0.012, 0.012, w * 0.9, 0.005), MATERIALS.chrome, 0.018, -h * 0.25, 0)
    } else if (st === 'truck') {
      gm(g, roundedBoxGeometry(0.06, h + 0.04, w + 0.04, 0.03), MATERIALS.chrome)
      gm(g, roundedBoxGeometry(0.064, h, w, 0.02), MATERIALS.housing, 0.004, 0, 0)
      const nb3 = Math.max(4, Math.round(h / 0.1))
      for (i = 0; i < nb3; i++) gm(g, roundedBoxGeometry(0.024, 0.03, w * 0.94, 0.008), MATERIALS.chrome, 0.04, -h / 2 + ((i + 0.5) * h) / nb3, 0)
    }
    g.children.forEach(function (m: any) {
      m.castShadow = true
    })
    if (o.emblem !== false) kit.emblem(c, 0.05, st === 'closed' ? h * 0.12 : 0, 0, Math.min(0.05, h * 0.3), g)
    return g
  }

  Object.assign(I, { lampGroup, gm, wedgeY, haloTex, glowTexture, haloMats, halo, lampKit })
}
