/** Armoured vehicle details (plating, hatches, add-on armour) and the applyArmor helper. */
import type { Kit } from './types'
import { clamp, hash } from './util'

export function installArmor(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, MATERIALS } = I

  /* ================= modified state ================= */
  const STEEL_MATERIAL = makeMaterial('#4e534f', { metalness: 0.55, roughness: 0.5 })
  const PLATE_MATERIALS = ['#4f5450', '#5b605b', '#454a47', '#56584f', '#4b4d4a'].map(function (h) {
    return makeMaterial(h, { metalness: 0.5, roughness: 0.55 })
  })
  kit.steelMaterial = STEEL_MATERIAL
  function jerryCan(c: any, x: any, y: any, z: any, col: any) {
    c.roundBox(0.34, 0.44, 0.16, 0.04, makeMaterial(col, { roughness: 0.5 }), x, y, z)
    c.tube(
      [
        [x - 0.1, y + 0.22, z],
        [x - 0.05, y + 0.28, z],
        [x + 0.05, y + 0.28, z],
        [x + 0.1, y + 0.22, z],
      ],
      0.015,
      makeMaterial(col),
    )
    c.cylinder(0.025, 0.025, 0.05, MATERIALS.trim, x + 0.12, y + 0.24, z)
  }
  kit.jerryCan = jerryCan
  function applyArmor(c: any) {
    const m = c.meta
    const k = m.kind
    if (k === 'bike') {
      /* box resting on the roof rack (meta.rack = height) with a jerry can on top */
      const ry = m.rack || (m.belt || 0.8) - 0.05
      const bxx = (m.rear || -0.9) + 0.3
      const bh = m.length < 1.9 ? 0.26 : 0.32
      c.roundBox(m.length < 1.9 ? 0.36 : 0.42, bh, 0.32, 0.03, m.length < 1.9 ? MATERIALS.wood : makeMaterial('#3d3a2e'), bxx, ry + bh / 2, 0)
      jerryCan(c, bxx, ry + bh + 0.22, 0, '#8e2a20')
      if (m.length >= 1.9)
        [1, -1].forEach(function (s2) {
          c.tube(
            [
              [0.38, 0.9, s2 * 0.18],
              [0.45, 0.6, s2 * 0.32],
              [0.1, 0.3, s2 * 0.3],
            ],
            0.02,
            MATERIALS.steel,
          )
        })
      return
    }
    if (k === 'boat') {
      const bx = m.front - 1.5
      const x0 = m.rear + 1.2
      const yt = m.top + 0.5
      for (let z = -0.6; z <= 0.61; z += 0.2) c.rod(new V3(x0, yt, z), new V3(bx, yt, z), 0.012, STEEL_MATERIAL)
      ;[x0, bx].forEach(function (x) {
        ;[-0.65, 0.65].forEach(function (zz) {
          c.rod(new V3(x, m.belt, zz), new V3(x, yt, zz), 0.03, STEEL_MATERIAL)
        })
      })
      ;[0.5, 0.2, -0.1].forEach(function (zz, i) {
        jerryCan(c, m.rear + 1.3, m.belt + 0.1, zz, i % 2 ? '#3e5a34' : '#8e2a20')
      })
      c.cylinder(0.14, 0.1, 0.2, MATERIALS.steel, bx, yt + 0.12, 0, 'x')
      c.cylinder(0.11, 0.11, 0.02, MATERIALS.head, bx + 0.1, yt + 0.12, 0, 'x')
      return
    }
    if (k === 'plane' || k === 'heli') {
      const wz = k === 'plane' ? 2.6 : 1.05
      const wy = k === 'plane' ? m.top - 0.25 : 0.55
      const pod = makeMaterial('#5c6158', { metalness: 0.4, roughness: 0.5 })
      ;[1, -1].forEach(function (s) {
        c.cylinder(0.18, 0.18, 1.3, pod, 0.2, wy - 0.25, s * wz, 'x')
        c.sphere(0.18, pod, 0.85, wy - 0.25, s * wz, 1.6, 1, 1)
        c.sphere(0.18, pod, -0.45, wy - 0.25, s * wz, 1.3, 1, 1)
        c.rod(new V3(0.2, wy - 0.1, s * wz), new V3(0.2, wy, s * wz), 0.02, MATERIALS.steel)
      })
      c.cylinder(0.16, 0.12, 0.22, MATERIALS.steel, m.front - 0.6, 0.85, 0.3, 'x')
      c.cylinder(0.13, 0.13, 0.02, MATERIALS.head, m.front - 0.48, 0.85, 0.3, 'x')
      return
    }
    if (!m.bullet) {
      c.glass.slice().forEach(function (gm2: any) {
        if (!gm2.parent) return
        const b = new THREE.Box3().setFromObject(gm2)
        const dx = b.max.x - b.min.x
        const dz = b.max.z - b.min.z
        const h = (b.max.y - b.min.y) * 0.96
        const yc = (b.max.y + b.min.y) / 2
        if (gm2.userData.ghost) {
          for (let xx = b.min.x; xx <= b.max.x; xx += 0.15)
            [b.min.z - 0.03, b.max.z + 0.03].forEach(function (zz) {
              c.rod(new V3(xx, b.min.y, zz), new V3(xx, b.max.y, zz), 0.014, STEEL_MATERIAL)
            })
        } else if (dz < 0.25 && dx > 0.2) {
          const z0 = b.max.z > 0 ? b.max.z + 0.035 : b.min.z - 0.035
          for (let x = b.min.x + 0.06; x < b.max.x - 0.03; x += 0.12)
            c.rod(new V3(x, yc - h / 2, z0), new V3(x, yc + h / 2, z0), 0.014, STEEL_MATERIAL)
          ;[yc - h / 2, yc + h / 2].forEach(function (y) {
            c.rod(new V3(b.min.x, y, z0), new V3(b.max.x, y, z0), 0.02, STEEL_MATERIAL)
          })
        }
      })
      c.quads.forEach(function (q: any) {
        const off = 0.06
        const bx2 = q.b[0] + q.n[0] * off
        const by2 = q.b[1] + q.n[1] * off
        const tx = q.t[0] + q.n[0] * off
        const ty = q.t[1] + q.n[1] * off
        for (let f = -1; f <= 1.0001; f += 0.14) c.rod(new V3(bx2, by2, f * q.hb), new V3(tx, ty, f * q.ht), 0.014, STEEL_MATERIAL)
        c.rod(new V3(bx2, by2, -q.hb), new V3(bx2, by2, q.hb), 0.02, STEEL_MATERIAL)
        c.rod(new V3(tx, ty, -q.ht), new V3(tx, ty, q.ht), 0.02, STEEL_MATERIAL)
      })
    }
    /* ram: an almost vertical blade flush with the bumper, held by arms back to the frame rail */
    const ph = clamp(Math.min(m.bodyHeight, 0.9) * 0.8, 0.32, 0.7)
    const yb = Math.max(0.1, m.clearance * 0.55)
    const fy = yb + ph / 2
    const fx = m.front + 0.11
    c.roundBox(0.07, ph, m.width * 1.02, 0.03, STEEL_MATERIAL, fx, fy, 0, { rot: [0, 0, -0.1] })
    ;[-0.3, 0.3].forEach(function (zf) {
      c.rod(new V3(m.front - 0.35, yb + 0.05, m.width * zf), new V3(fx - 0.03, yb + 0.05, m.width * zf), 0.035, MATERIALS.trim)
      c.rod(new V3(m.front - 0.25, yb + 0.05, m.width * zf), new V3(fx - 0.03, fy + ph * 0.25, m.width * zf), 0.025, MATERIALS.trim)
    })
    for (let bar = 0; bar < 3; bar++)
      c.rod(
        new V3(fx + 0.045, yb + ph * (0.2 + bar * 0.3), -m.width * 0.5),
        new V3(fx + 0.045, yb + ph * (0.2 + bar * 0.3), m.width * 0.5),
        0.02,
        STEEL_MATERIAL,
      )
    const n = Math.max(4, Math.round(m.width / 0.32))
    const spk = makeMaterial('#8a8e8a', { metalness: 0.7, roughness: 0.35 })
    for (let i = 0; i < n; i++) {
      const sp = c.add(
        new THREE.ConeGeometry(0.035, 0.26, 10),
        spk,
        fx + 0.17,
        yb + ph * (i % 2 ? 0.35 : 0.65),
        -m.width * 0.44 + (i + 0.5) * ((m.width * 0.88) / n),
      )
      sp.rotation.z = -PI / 2
    }
    /* side plates: between the bumpers, cut out over the wheels, glued to the curve of the side */
    if (k !== 'tractor') {
      const x0 = m.rear + 0.15
      const x1 = m.front - 0.15
      const brk = [x0, x1]
      const wl: any = []
      c.wheels.forEach(function (w: any) {
        if (!w.parent) return
        const r = w.userData.r || 0.33
        wl.push([w.position.x - r - 0.07, w.position.x + r + 0.07, w.position.y + r + 0.05])
      })
      wl.forEach(function (w: any) {
        if (w[0] > x0 && w[0] < x1) brk.push(w[0])
        if (w[1] > x0 && w[1] < x1) brk.push(w[1])
      })
      brk.sort(function (a, b) {
        return a - b
      })
      const yTop = Math.min(m.belt - 0.06, m.clearance + 0.15 + Math.min(m.bodyHeight, 1.0) * 0.75)
      const pieces: any = []
      for (let b = 0; b < brk.length - 1; b++) {
        const a0 = brk[b]
        const a1 = brk[b + 1]
        const mid = (a0 + a1) / 2
        let bot = m.clearance + 0.1
        wl.forEach(function (w: any) {
          if (mid > w[0] && mid < w[1]) bot = Math.max(bot, w[2])
        })
        if (yTop - bot < 0.14 || a1 - a0 < 0.12) continue
        const np = Math.max(1, Math.round((a1 - a0) / 1.0))
        for (let q = 0; q < np; q++) pieces.push([a0 + ((a1 - a0) * q) / np, a0 + ((a1 - a0) * (q + 1)) / np, bot])
      }
      ;[1, -1].forEach(function (s2) {
        pieces.forEach(function (pc: any, j: any) {
          const pl = pc[1] - pc[0] - 0.03
          const px = (pc[0] + pc[1]) / 2
          const plH = yTop - pc[2]
          const py = pc[2] + plH / 2
          function zAt(x: any) {
            const h = I.probe(c, new V3(x, py, s2 * (m.width / 2 + 2)), new V3(0, 0, -s2), 2 + m.width * 0.4)
            return h && Math.abs(h.p.z) > m.width * 0.3 ? h.p.z : (s2 * m.width) / 2
          }
          const za = zAt(px - pl * 0.4)
          const zb = zAt(px + pl * 0.4)
          const pz = (zAt(px) + (za + zb) / 2) / 2 + s2 * 0.035
          const yaw = -Math.atan2(zb - za, pl * 0.8)
          const pm = c.roundBox(pl, plH, 0.035, 0.012, PLATE_MATERIALS[(j * 2 + (s2 > 0 ? 0 : 1)) % PLATE_MATERIALS.length], px, py, pz, {
            rot: [(hash(j, s2, 2) - 0.5) * 0.04, yaw, (hash(j, s2, 1) - 0.5) * 0.06],
          })
          ;[-1, 1].forEach(function (u) {
            ;[-1, 1].forEach(function (v) {
              c.sphere(
                0.016,
                MATERIALS.steel,
                px + u * pl * 0.42 * Math.cos(yaw),
                py + v * plH * 0.38,
                pz + s2 * 0.02 - u * Math.sin(yaw) * pl * 0.42,
              )
            })
          })
          pm.userData.armorPlate = true
        })
      })
    }
    if (m.roof) {
      const r = m.roof
      const ry = (r.y || m.top) + 0.12
      const rl = r.x1 - r.x0
      const rw = r.w
      c.tube(
        [
          [r.x0, ry, -rw / 2],
          [r.x1, ry, -rw / 2],
          [r.x1, ry, rw / 2],
          [r.x0, ry, rw / 2],
          [r.x0, ry, -rw / 2],
        ],
        0.022,
        MATERIALS.trim,
        { seg: 40 },
      )
      ;[r.x0 + 0.05, r.x1 - 0.05].forEach(function (x) {
        ;[-rw / 2, rw / 2].forEach(function (zz) {
          c.rod(new V3(x, ry - 0.12, zz), new V3(x, ry, zz), 0.02, MATERIALS.trim)
        })
      })
      for (let xs = r.x0 + 0.2; xs < r.x1; xs += 0.3) c.rod(new V3(xs, ry, -rw / 2), new V3(xs, ry, rw / 2), 0.012, MATERIALS.trim)
      const cans = Math.max(1, Math.min(4, Math.floor(rl / 0.45)))
      for (let q = 0; q < cans; q++) jerryCan(c, r.x0 + 0.25 + q * 0.4, ry + 0.24, -rw * 0.28, q % 2 ? '#3e5a34' : '#8e2a20')
      if (rl > 1.0 && rw > 0.9) {
        const sp2 = c.wheel(r.x1 - 0.45, 0.001, 0.32, 0.2, { noPart: true })
        sp2.rotation.x = PI / 2
        sp2.position.set(r.x1 - 0.45, ry + 0.11, rw * 0.2)
        c.wheels.pop()
      }
    }
    if (m.bed) {
      jerryCan(c, m.bed.x0 + 0.3, m.bed.y + 0.23, 0.6, '#8e2a20')
      jerryCan(c, m.bed.x0 + 0.3, m.bed.y + 0.23, 0.4, '#8e2a20')
      c.roundBox(0.8, 0.45, 0.6, 0.05, makeMaterial('#4a4b3c'), m.bed.x0 + 0.9, m.bed.y + 0.23, -0.4)
      c.roundBox(0.5, 0.3, 0.4, 0.04, MATERIALS.wood, m.bed.x0 + 0.8, m.bed.y + 0.15, 0.3)
    }
  }
  kit.applyArmor = applyArmor

  Object.assign(I, { STEEL_MATERIAL, PLATE_MATERIALS, jerryCan, applyArmor })
}
