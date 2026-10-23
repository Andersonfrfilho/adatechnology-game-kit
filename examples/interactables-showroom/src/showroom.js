/* global THREE, Reflector, RoomEnvironment, GameInteractables, GameInteractablesHousehold, GameInteractablesThree */
// Walkable showroom of every household interactive object. Plain browser JS on top of the globals set by src/entry.js.
// Generic example of @adatechnology/game-interactables (+ household pack + three adapter): nothing here is specific to a game.
;(function () {
  'use strict'

  const T = THREE
  const GI = GameInteractables
  const GT = GameInteractablesThree
  const HHP = GameInteractablesHousehold
  const $ = (s) => document.querySelector(s)

  // ---------------------------------------------------------------------------------------------------------------------------
  // Constants and small helpers
  // ---------------------------------------------------------------------------------------------------------------------------
  const CEIL = 2.7 // ceiling height
  const EYE = 1.6
  const RADIUS = 0.24 // player collision radius
  const HOUSE = { x0: 0, z0: 0, x1: 12, z1: 8 }
  const LOT = { x0: -0.7, z0: -1.4, x1: 13.7, z1: 13.7 }
  const CIRCUITS = [
    ['lights', 'Luzes'],
    ['sockets', 'Tomadas'],
    ['shower', 'Chuveiro'],
  ]
  const GROUP_NAMES = {
    storage: 'Armazenamento',
    kitchen: 'Cozinha e banheiro',
    bathroom: 'Banheiro',
    electrical: 'Elétrica e aparelhos',
    seating: 'Assentos e camas',
    window: 'Janelas',
    yard: 'Quintal',
    rural: 'Casa rural',
    camp: 'Acampamento',
    house: 'Casa',
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const hash = (s) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
  }
  function mulberry(seed) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  /** Object-local point to world, with the engine's convention (ry turns +z toward +x). */
  function toWorld(tr, p) {
    const c = Math.cos(tr.ry)
    const s = Math.sin(tr.ry)
    return [tr.x + p[0] * c + p[2] * s, (tr.y || 0) + p[1], tr.z - p[0] * s + p[2] * c]
  }

  const params = new URLSearchParams(location.search)
  const state = {
    quality: params.get('q') === 'high' || params.get('q') === 'game' ? params.get('q') : innerWidth < 800 ? 'game' : 'high',
    night: false,
    rain: false,
    wind: false,
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Procedural textures (canvas, no assets)
  // ---------------------------------------------------------------------------------------------------------------------------
  function canvasTexture(w, h, draw, anisotropy) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d'), w, h)
    const t = new T.CanvasTexture(c)
    t.wrapS = t.wrapT = T.RepeatWrapping
    t.colorSpace = T.SRGBColorSpace
    t.anisotropy = anisotropy || 4
    return t
  }
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`

  function woodTexture() {
    const rnd = mulberry(7)
    return canvasTexture(512, 512, (g, w, h) => {
      const planks = 6
      const pw = w / planks
      for (let i = 0; i < planks; i++) {
        let y = -rnd() * 200
        while (y < h) {
          const len = 220 + rnd() * 220
          const k = 0.88 + rnd() * 0.22
          g.fillStyle = rgb(176 * k, 128 * k, 84 * k)
          g.fillRect(i * pw, y, pw, len)
          for (let n = 0; n < 14; n++) {
            g.strokeStyle = `rgba(80,48,24,${0.05 + rnd() * 0.08})`
            g.lineWidth = 1
            const gx = i * pw + 3 + rnd() * (pw - 6)
            g.beginPath()
            g.moveTo(gx, y)
            g.lineTo(gx + (rnd() - 0.5) * 6, y + len)
            g.stroke()
          }
          g.fillStyle = 'rgba(40,24,12,0.55)'
          g.fillRect(i * pw, y, pw, 1.5)
          y += len
        }
        g.fillStyle = 'rgba(40,24,12,0.55)'
        g.fillRect(i * pw, 0, 1.5, h)
      }
    })
  }
  function tileTexture(a, b, grout) {
    return canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = grout
      g.fillRect(0, 0, w, h)
      const n = 2
      const s = w / n
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          g.fillStyle = (x + y) % 2 ? a : b
          g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6)
          const grad = g.createLinearGradient(x * s, y * s, (x + 1) * s, (y + 1) * s)
          grad.addColorStop(0, 'rgba(255,255,255,0.14)')
          grad.addColorStop(1, 'rgba(0,0,0,0.06)')
          g.fillStyle = grad
          g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6)
        }
      }
    })
  }
  function grassTexture() {
    const rnd = mulberry(3)
    return canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#5d8c3e'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 3200; i++) {
        const k = 0.75 + rnd() * 0.5
        g.fillStyle = rgb(80 * k, 130 * k, 52 * k)
        g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2)
      }
    })
  }
  function concreteTexture() {
    const rnd = mulberry(5)
    return canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#b9b6ae'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 2500; i++) {
        const k = 0.9 + rnd() * 0.2
        g.fillStyle = rgb(185 * k, 182 * k, 174 * k)
        g.fillRect(rnd() * w, rnd() * h, 2, 2)
      }
      g.strokeStyle = 'rgba(70,68,62,0.55)'
      g.lineWidth = 2
      g.strokeRect(1, 1, w - 2, h - 2)
    })
  }
  function rugTexture() {
    return canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#8c4a3a'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#e8d6a8'
      g.lineWidth = 8
      g.strokeRect(14, 14, w - 28, h - 28)
      g.strokeStyle = '#3d5a73'
      g.lineWidth = 6
      g.strokeRect(36, 36, w - 72, h - 72)
      g.fillStyle = '#e8d6a8'
      for (let i = 0; i < 5; i++) {
        g.save()
        g.translate(w / 2, h / 2)
        g.rotate(Math.PI / 4)
        g.fillRect(-26 + i * 0, -26, 52, 52)
        g.restore()
        break
      }
    })
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Geometry helpers: a batch of colored boxes merged into one geometry (walls, fence, tables: one draw call each)
  // ---------------------------------------------------------------------------------------------------------------------------
  const FACES = [
    // [normal, corners CCW seen from outside] as [fx, fy, fz] selectors on (x0|x1, y0|y1, z0|z1)
    { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ]
  class BoxBatch {
    constructor(seed) {
      this.pos = []
      this.nor = []
      this.col = []
      this.uv = []
      this.idx = []
      this.rnd = mulberry(seed || 1)
      this.c = new T.Color()
    }
    /** Box from two corners. `color` is a hex number, or [px, nx, py, ny, pz, nz]. */
    box(x0, y0, z0, x1, y1, z1, color, jitter) {
      const xs = [Math.min(x0, x1), Math.max(x0, x1)]
      const ys = [Math.min(y0, y1), Math.max(y0, y1)]
      const zs = [Math.min(z0, z1), Math.max(z0, z1)]
      const j = 1 + (this.rnd() - 0.5) * (jitter === undefined ? 0.05 : jitter)
      for (let f = 0; f < 6; f++) {
        const face = FACES[f]
        const base = this.pos.length / 3
        this.c.setHex(Array.isArray(color) ? color[f] : color)
        for (let k = 0; k < 4; k++) {
          const v = face.v[k]
          const x = xs[v[0]]
          const y = ys[v[1]]
          const z = zs[v[2]]
          this.pos.push(x, y, z)
          this.nor.push(face.n[0], face.n[1], face.n[2])
          this.col.push(this.c.r * j, this.c.g * j, this.c.b * j)
          this.uv.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0)
        }
        this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }
    mesh(material, cast, receive) {
      const g = new T.BufferGeometry()
      g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3))
      g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3))
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3))
      g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2))
      g.setIndex(this.pos.length / 3 > 65535 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1))
      g.computeBoundingSphere()
      const m = new T.Mesh(g, material)
      m.castShadow = !!cast
      m.receiveShadow = receive !== false
      return m
    }
  }
  /** Merges non-indexed copies of geometries (with per-geometry vertex color) into one. */
  function mergeColored(list) {
    const pos = []
    const nor = []
    const col = []
    const c = new T.Color()
    for (const { geo, matrix, color } of list) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone()
      g.applyMatrix4(matrix)
      c.setHex(color)
      const p = g.getAttribute('position').array
      const n = g.getAttribute('normal').array
      for (let i = 0; i < p.length; i++) {
        pos.push(p[i])
        nor.push(n[i])
      }
      for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b)
    }
    const out = new T.BufferGeometry()
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3))
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3))
    return out
  }
  function texturedPlane(x0, z0, x1, z1, y, material, meters) {
    const g = new T.PlaneGeometry(x1 - x0, z1 - z0)
    g.rotateX(-Math.PI / 2)
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / meters, (uv.getY(i) * (z1 - z0)) / meters)
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
    const m = new T.Mesh(g, material)
    m.receiveShadow = true
    return m
  }


  // ---------------------------------------------------------------------------------------------------------------------------
  // Renderer, scene, lights, sky
  // ---------------------------------------------------------------------------------------------------------------------------
  const canvas = $('#c')
  let renderer
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
  } catch (err) {
    $('#loadingMsg').textContent = 'Este navegador não conseguiu iniciar o WebGL.'
    throw err
  }
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap
  // three resets renderer.info after the shadow pass (and the mirror's nested render resets it again): count every pass ourselves
  renderer.info.autoReset = false

  const scene = new T.Scene()
  scene.fog = new T.Fog(0xcfe0ec, 45, 150)
  const camera = new T.PerspectiveCamera(72, 1, 0.06, 400)
  camera.rotation.order = 'YXZ'
  scene.add(camera)

  const pmrem = new T.PMREMGenerator(renderer)
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTexture

  const hemi = new T.HemisphereLight(0xdceaff, 0x8c7a62, 1.1)
  scene.add(hemi)
  const sun = new T.DirectionalLight(0xfff0d8, 3.2)
  sun.castShadow = true
  sun.shadow.camera.left = -22
  sun.shadow.camera.right = 22
  sun.shadow.camera.top = 22
  sun.shadow.camera.bottom = -22
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 90
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.035
  sun.position.set(-5, 30, 30)
  sun.target.position.set(6, 0, 5)
  scene.add(sun, sun.target)
  // soft fill from the north, no shadows: lights the north-facing inner faces the sun never reaches
  const fill = new T.DirectionalLight(0xe6edfb, 0.9)
  fill.position.set(10, 14, -22)
  scene.add(fill)

  const sky = (() => {
    const g = new T.SphereGeometry(250, 24, 14)
    const p = g.getAttribute('position')
    const col = []
    const top = new T.Color(0x4f93dd)
    const hor = new T.Color(0xe3eef6)
    const c = new T.Color()
    for (let i = 0; i < p.count; i++) {
      const k = clamp(p.getY(i) / 250, 0, 1)
      c.copy(hor).lerp(top, Math.pow(k, 0.6))
      col.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3))
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }))
    m.renderOrder = -10
    m.frustumCulled = false
    scene.add(m)
    return m
  })()

  // ---------------------------------------------------------------------------------------------------------------------------
  // Environment: walls, floors, ground, fence, trees. Everything static is merged (a handful of draw calls).
  // ---------------------------------------------------------------------------------------------------------------------------
  const env = { wallRects: [], solidRects: [], group: new T.Group(), materials: null }
  scene.add(env.group)

  function buildEnvironment() {
    const q = state.quality
    const std = (p) => (q === 'game' ? new T.MeshLambertMaterial(p) : new T.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, p)))
    const vc = std({ vertexColors: true })
    const glassMat = std({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false })
    const woodFloor = std({ map: woodTexture() })
    const tileKitchen = std({ map: tileTexture('#e9e2d3', '#d9d0bd', '#a9a291') })
    const tileBath = std({ map: tileTexture('#a9cdd6', '#9cc1cb', '#e6f0f2') })
    const grass = std({ map: grassTexture() })
    const concrete = std({ map: concreteTexture() })
    const rug = std({ map: rugTexture() })
    const ceilingMat = std({ color: 0xfaf6ee, side: T.BackSide, emissive: 0x9c9890 })
    env.materials = { vc, glassMat, woodFloor, tileKitchen, tileBath, grass, concrete, rug, ceilingMat }
    env.wallRects.length = 0
    env.solidRects.length = 0
    while (env.group.children.length) {
      const o = env.group.children.pop()
      o.traverse((n) => n.geometry && n.geometry.dispose())
    }

    const walls = new BoxBatch(11)
    const glass = new BoxBatch(12)
    const trim = new BoxBatch(13)
    const props = new BoxBatch(14)
    const Y0 = -0.05
    const CAP = 0xe6e1d8
    const TRIM = 0xf4f1ea

    // walls running along x (thickness z0..z1) or along z (thickness x0..x1)
    function run(axis, c0, c1, a, b, o) {
      const ops = (o.openings || []).slice().sort((p, r) => p.a - r.a)
      const H = CEIL
      const at = (u0, v0, u1, v1) => (axis === 'x' ? [u0, v0, c0, u1, v1, c1] : [c0, v0, u0, c1, v1, u1])
      const piece = (u0, u1, y0, y1) => {
        if (u1 - u0 < 0.002 || y1 - y0 < 0.002) return
        const [x0, ya, z0, x1, yb, z1] = at(u0, y0, u1, y1)
        const colors = axis === 'x' ? [CAP, CAP, CAP, CAP, o.plus, o.minus] : [o.plus, o.minus, CAP, CAP, CAP, CAP]
        walls.box(x0, y0 === 0 ? Y0 : ya, z0, x1, yb, z1, colors, 0.03)
        if (y0 === 0) {
          env.wallRects.push([x0, z0, x1, z1])
          // skirting boards on the finished sides
          if (axis === 'x') {
            if (o.skirtPlus !== false) trim.box(x0, 0, z1, x1, 0.09, z1 + 0.012, TRIM, 0)
            if (o.skirtMinus !== false) trim.box(x0, 0, z0 - 0.012, x1, 0.09, z0, TRIM, 0)
          } else {
            if (o.skirtPlus !== false) trim.box(x1, 0, z0, x1 + 0.012, 0.09, z1, TRIM, 0)
            if (o.skirtMinus !== false) trim.box(x0 - 0.012, 0, z0, x0, 0.09, z1, TRIM, 0)
          }
        }
      }
      let cur = a
      for (const op of ops) {
        piece(cur, op.a, 0, H)
        if (op.y0 > 0) piece(op.a, op.b, 0, op.y0)
        if (op.y1 < H) piece(op.a, op.b, op.y1, H)
        const t = 0.012
        const f = 0.07
        const frame = (u0, u1, y0, y1) => {
          const [x0, ya, z0, x1, yb, z1] = at(u0, y0, u1, y1)
          if (axis === 'x') trim.box(x0, ya, z0 - t, x1, yb, z1 + t, TRIM, 0)
          else trim.box(x0 - t, ya, z0, x1 + t, yb, z1, TRIM, 0)
        }
        if (op.y0 === 0) {
          frame(op.a - f, op.a, 0, op.y1 + f)
          frame(op.b, op.b + f, 0, op.y1 + f)
          frame(op.a - f, op.b + f, op.y1, op.y1 + f)
        } else {
          // window: frame, mullion, sill, glass
          const mid = (c0 + c1) / 2
          const bar = 0.045
          const fr = (u0, u1, y0, y1) => {
            const [x0, ya, z0, x1, yb, z1] = at(u0, y0, u1, y1)
            if (axis === 'x') trim.box(x0, ya, mid - 0.03, x1, yb, mid + 0.03, TRIM, 0)
            else trim.box(mid - 0.03, ya, z0, mid + 0.03, yb, z1, TRIM, 0)
          }
          fr(op.a, op.a + bar, op.y0, op.y1)
          fr(op.b - bar, op.b, op.y0, op.y1)
          fr(op.a, op.b, op.y0, op.y0 + bar)
          fr(op.a, op.b, op.y1 - bar, op.y1)
          fr((op.a + op.b) / 2 - 0.02, (op.a + op.b) / 2 + 0.02, op.y0, op.y1)
          const sill = (u0, u1, y0, y1) => {
            const [x0, ya, z0, x1, yb, z1] = at(u0, y0, u1, y1)
            if (axis === 'x') trim.box(x0, ya, z0 - 0.05, x1, yb, z1 + 0.05, TRIM, 0)
            else trim.box(x0 - 0.05, ya, z0, x1 + 0.05, yb, z1, TRIM, 0)
          }
          sill(op.a - 0.05, op.b + 0.05, op.y0 - 0.035, op.y0)
          const [gx0, gy0, gz0, gx1, gy1, gz1] = at(op.a, op.y0, op.b, op.y1)
          if (axis === 'x') glass.box(gx0, gy0, mid - 0.006, gx1, gy1, mid + 0.006, 0xcde6f2, 0)
          else glass.box(mid - 0.006, gy0, gz0, mid + 0.006, gy1, gz1, 0xcde6f2, 0)
        }
        cur = op.b
      }
      piece(cur, b, 0, H)
    }

    // Colors per room
    const KITCHEN = 0xe9d9a6
    const LIVING = 0xdfc9a8
    const BED = 0xb3c6d8
    const BATH = 0xaed3d8
    const OUT = 0xcdbea2
    const DOOR_H = 2.1
    // exterior walls (inner face on the nominal line)
    run('x', -0.12, 0, -0.12, 8, { plus: KITCHEN, minus: OUT, skirtMinus: false, openings: [{ a: 1.76, b: 2.56, y0: 1.3, y1: 2.1 }] }) // north, kitchen
    run('x', -0.12, 0, 8, 12.12, { plus: BATH, minus: OUT, skirtMinus: false, openings: [] }) // north, bathroom
    run('z', -0.12, 0, 0, 3.6, { plus: KITCHEN, minus: OUT, skirtMinus: false, openings: [] }) // west, kitchen
    run('z', -0.12, 0, 3.6, 8, { plus: LIVING, minus: OUT, skirtMinus: false, openings: [] }) // west, living
    run('z', 12, 12.12, 0, 3.6, { plus: OUT, minus: BATH, skirtPlus: false, openings: [{ a: 1.2, b: 2.0, y0: 1.3, y1: 2.1 }] }) // east, bathroom
    run('z', 12, 12.12, 3.6, 8, { plus: OUT, minus: BED, skirtPlus: false, openings: [{ a: 4.35, b: 5.85, y0: 0.9, y1: 2.2 }] }) // east, bedroom
    run('x', 8, 8.12, -0.12, 8, { plus: OUT, minus: LIVING, skirtPlus: false, openings: [{ a: 1.15, b: 2.15, y0: 1.2, y1: 2.1 }, { a: 5.0, b: 6.0, y0: 0, y1: DOOR_H }] }) // south, living
    run('x', 8, 8.12, 8, 12.12, { plus: OUT, minus: BED, skirtPlus: false, openings: [{ a: 9.7, b: 11.1, y0: 0.9, y1: 2.2 }] }) // south, bedroom
    // partitions
    run('z', 7.95, 8.05, 0, 3.6, { plus: BATH, minus: KITCHEN, openings: [{ a: 2.5, b: 3.4, y0: 0, y1: DOOR_H }] })
    run('z', 7.95, 8.05, 3.6, 8, { plus: BED, minus: LIVING, openings: [{ a: 4.3, b: 5.2, y0: 0, y1: DOOR_H }] })
    run('x', 3.55, 3.65, 8.05, 12, { plus: BED, minus: BATH, openings: [] })

    // ceiling (seen only from below; casts no shadow so the sun still reaches the rooms)
    const ceil = new T.Mesh(new T.PlaneGeometry(12.24, 8.24), ceilingMat)
    ceil.rotation.x = -Math.PI / 2
    ceil.position.set(6, CEIL, 4)
    ceil.receiveShadow = false
    env.group.add(ceil)

    // floors
    env.group.add(texturedPlane(0, 0, 7.95, 3.55, 0, tileKitchen, 0.6))
    env.group.add(texturedPlane(0, 3.55, 7.95, 8, 0, woodFloor, 1))
    env.group.add(texturedPlane(8.05, 0, 12, 3.55, 0, tileBath, 0.6))
    env.group.add(texturedPlane(8.05, 3.65, 12, 8, 0, woodFloor, 1))
    // thresholds under the partitions
    trim.box(7.95, 0, 0, 8.05, 0.004, 8, 0xb59a78, 0)
    trim.box(8.05, 0, 3.55, 12, 0.004, 3.65, 0xb59a78, 0)
    // rug
    const rugMesh = texturedPlane(1.7, 5.6, 4.3, 7.4, 0.006, rug, 2.6)
    rugMesh.material = rug
    rugMesh.material.polygonOffset = true
    rugMesh.material.polygonOffsetFactor = -2
    env.group.add(rugMesh)

    // ground: a ring around the house footprint, patio and walkway
    const ring = [
      [-250, -250, -0.12, 250],
      [12.12, -250, 250, 250],
      [-0.12, -250, 12.12, -0.12],
      [-0.12, 8.12, 12.12, 250],
    ]
    for (const r of ring) env.group.add(texturedPlane(r[0], r[1], r[2], r[3], 0, grass, 3))
    const patio = texturedPlane(2.2, 8.12, 9.4, 11.6, 0.004, concrete, 1.6)
    patio.material.polygonOffset = true
    patio.material.polygonOffsetFactor = -2
    env.group.add(patio)
    const walk = texturedPlane(6.55, 11.6, 7.55, 14.4, 0.004, concrete, 1.6)
    env.group.add(walk)
    const pad = texturedPlane(9.6, 12.4, 11.6, 13.9, 0.004, concrete, 1.6)
    env.group.add(pad)

    // fence (lot): pickets and rails, gate gap on the south side
    function fenceX(x0, x1, z) {
      for (const [ya, yb] of [[0.25, 0.32], [0.75, 0.82]]) trim.box(x0, ya, z - 0.03, x1, yb, z + 0.03, 0xd7cfc1, 0.02)
      for (let x = x0; x < x1 - 0.05; x += 0.14) props.box(x, 0, z - 0.012, x + 0.09, 1.05, z + 0.012, 0xe4ddcf, 0.08)
      env.solidRects.push([x0, z - 0.05, x1, z + 0.05])
    }
    function fenceZ(z0, z1, x) {
      for (const [ya, yb] of [[0.25, 0.32], [0.75, 0.82]]) trim.box(x - 0.03, ya, z0, x + 0.03, yb, z1, 0xd7cfc1, 0.02)
      for (let z = z0; z < z1 - 0.05; z += 0.14) props.box(x - 0.012, 0, z, x + 0.012, 1.05, z + 0.09, 0xe4ddcf, 0.08)
      env.solidRects.push([x - 0.05, z0, x + 0.05, z1])
    }
    fenceX(-1, 6.55, 14)
    fenceX(7.55, 14, 14)
    fenceZ(0, 14, -1)
    fenceZ(0, 14, 14)
    for (const gx of [6.5, 7.6]) props.box(gx - 0.06, 0, 13.94, gx + 0.06, 1.3, 14.06, 0xb9ad98, 0.02)
    for (const [fx, fz] of [[-1, 0], [-1, 14], [14, 0], [14, 14], [-1, 7], [14, 7]]) props.box(fx - 0.06, 0, fz - 0.06, fx + 0.06, 1.2, fz + 0.06, 0xb9ad98, 0.02)

    // dining table, coffee table, picture frames
    const table = (cx, cz, w, d, h, top, leg) => {
      props.box(cx - w / 2, h - 0.045, cz - d / 2, cx + w / 2, h, cz + d / 2, top, 0.03)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) props.box(cx + sx * (w / 2 - 0.08) - 0.03, 0, cz + sz * (d / 2 - 0.08) - 0.03, cx + sx * (w / 2 - 0.08) + 0.03, h - 0.045, cz + sz * (d / 2 - 0.08) + 0.03, leg, 0.03)
      env.solidRects.push([cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2])
    }
    table(6.7, 2.2, 1.4, 0.85, 0.76, 0xb88653, 0x8d6137)
    table(3.0, 6.55, 1.0, 0.55, 0.42, 0x6e4b33, 0x4c3322)
    // a vase and a bowl so the tables are not empty
    props.box(6.55, 0.76, 2.1, 6.75, 0.77, 2.3, 0xe8e2d4, 0)
    props.box(6.6, 0.77, 2.15, 6.7, 0.95, 2.25, 0x4f8a6b, 0)

    env.group.add(walls.mesh(vc, true, true), trim.mesh(vc, true, true), props.mesh(vc, true, true), glass.mesh(glassMat, false, false))
    return env
  }

  // trees (instanced, one draw call)
  function buildTrees() {
    const parts = []
    const m = new T.Matrix4()
    parts.push({ geo: new T.CylinderGeometry(0.16, 0.24, 2.2, 7), matrix: m.clone().makeTranslation(0, 1.1, 0), color: 0x6b4a2f })
    for (const [y, r] of [[2.6, 1.5], [3.7, 1.15], [4.6, 0.75]]) parts.push({ geo: new T.IcosahedronGeometry(r, 0), matrix: m.clone().makeTranslation(0, y, 0), color: 0x3f7a42 })
    const geo = mergeColored(parts)
    const mat = state.quality === 'game' ? new T.MeshLambertMaterial({ vertexColors: true }) : new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
    const spots = [[-4, -6, 1.3], [3, -8, 1.6], [10, -7, 1.2], [17, -3, 1.5], [18, 6, 1.1], [19, 14, 1.4], [16, 20, 1.2], [8, 22, 1.5], [0, 21, 1.3], [-6, 17, 1.6], [-8, 7, 1.2], [-7, -1, 1.4], [14, -9, 1.7], [-12, 12, 1.5]]
    const inst = new T.InstancedMesh(geo, mat, spots.length)
    const o = new T.Object3D()
    spots.forEach((s, i) => {
      o.position.set(s[0], 0, s[1])
      o.scale.setScalar(s[2] * 0.62)
      o.rotation.y = i * 1.7
      o.updateMatrix()
      inst.setMatrixAt(i, o.matrix)
    })
    inst.castShadow = true
    inst.receiveShadow = true
    inst.frustumCulled = false
    return inst
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // World, content pack, three adapter
  // ---------------------------------------------------------------------------------------------------------------------------
  const hh = HHP.createHousehold({ locale: 'pt-BR', region: 'br' })
  const OWN = {
    'pt-BR': { 'type.ceiling_lamp': 'luminária de teto', 'type.water_tank': "caixa d'água" },
    en: { 'type.ceiling_lamp': 'ceiling lamp', 'type.water_tank': 'water tank' },
  }
  const events = [] // last events, for tests
  const pack = [] // backpack: [{ type, qty }]
  const world = GI.createWorld({
    locale: 'pt-BR',
    seed: 'showroom',
    items: hh.items,
    loot: hh.loot,
    strings: { 'pt-BR': Object.assign({}, hh.strings['pt-BR'], OWN['pt-BR']), en: Object.assign({}, hh.strings.en, OWN.en) },
    onEvent: (e) => {
      events.push(e)
      if (events.length > 200) events.shift()
      onWorldEvent(e)
    },
  })
  const gfx = GT.createThreeAdapter(T, { document, Reflector, envMap: envTexture })

  let mats = null
  function makeMaterials() {
    const m = GT.createDefaultMaterials(T, state.quality)
    for (const k of Object.keys(m)) if ('envMapIntensity' in m[k]) m[k].envMapIntensity = k === 'metal' ? 0.9 : 0.5
    return m
  }

  /** entries: id -> { id, type, x, z, ry, item, name, root, group, parts, extra } */
  const entries = new Map()
  const order = []

  function buildVisual(type, item) {
    const mesh = gfx.createMeshApi({ quality: state.quality, materials: mats, shadows: true, swayAmplitude: 0.035 })
    const spec = hh.build(type, item, mesh.api)
    const res = mesh.finish(spec) // game quality merges blind slats and clothes into a few meshes
    for (const l of res.lights) l.removeFromParent() // the showroom owns the lights (a handful of PointLights, constant count)
    return { spec, group: res.group, parts: res.parts }
  }

  /** Mirrors, sway, screens, wires: everything that needs the group of an object (rebuilt with the quality). */
  const mirrorsApi = gfx.createMirrors({ max: 1, resolution: 512 })
  const screens = new Map() // object id -> screen
  const wireMats = {
    cord: new T.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.6 }),
    drop: new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }),
    conduit: new T.MeshStandardMaterial({ color: 0xcfcdc4, roughness: 0.6 }),
    cable: new T.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.7 }),
  }
  const mirrorMeshes = new Map()

  function finishVisual(e) {
    const spec = world.get(e.id).spec
    e.group.traverse((o) => {
      if (!o.isMesh) return
      const mk = o.userData.material
      if (mk === 'glass' || mk === 'water' || mk === 'emissive') o.castShadow = false
    })
    // TV: the only emissive mesh is the screen
    if (spec.devices && spec.devices.some((d) => d.kind === 'screen')) {
      const mesh = e.group.children.find((c) => c.isMesh && c.userData.material === 'emissive')
      if (mesh) {
        let sc = screens.get(e.id)
        if (!sc) {
          sc = gfx.createScreen({ w: 160, h: 90, seed: hash(e.id) })
          screens.set(e.id, sc)
        }
        mesh.material = sc.material
        mesh.castShadow = false
      }
    }
    // soft cloth and curtains sway in the vertex shader (shadow follows)
    for (const s of spec.soft || []) {
      if (s.kind !== 'cloth' && s.kind !== 'curtain') continue
      const g = e.parts[s.part || s.id]
      if (!g || g.userData.merged) continue // merged cloth already carries its own sway shader
      g.traverse((o) => {
        if (o.isMesh && !o.userData.sway) gfx.attachSway(o, { amplitude: s.kind === 'cloth' ? 0.035 : 0.02 })
      })
    }
    // mirrors: a plane of our own on the part (or the object), registered for the Reflector
    for (const m of spec.mirrors || []) {
      const id = `${e.id}:${m.id}`
      mirrorsApi.unregister(id)
      const old = mirrorMeshes.get(id)
      if (old) old.removeFromParent()
      const mesh = new T.Mesh(UNIT_PLANE, mirrorsApi.envMaterial)
      mesh.scale.set(m.w, m.h, 1)
      const n = new T.Vector3(m.normal[0], m.normal[1], m.normal[2]).normalize()
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n)
      const host = m.part ? e.parts[m.part] : e.group
      const pv = m.part ? spec.parts.find((p) => p.id === m.part).pivot : [0, 0, 0]
      mesh.position.set(m.center[0] - pv[0] + n.x * 0.003, m.center[1] - pv[1] + n.y * 0.003, m.center[2] - pv[2] + n.z * 0.003)
      host.add(mesh)
      mirrorMeshes.set(id, mesh)
      mirrorsApi.register(id, mesh)
    }
    // fixed wires (conduits, drop, earth, gas hose); cords are drawn with the plugs
    for (const w of spec.wires || []) {
      if (w.kind === 'cord') continue
      const mesh = gfx.createCord(w.points, w.radius || 0.01, wireMats[w.kind] || wireMats.cable)
      e.root.add(mesh)
    }
  }
  const UNIT_PLANE = new T.PlaneGeometry(1, 1)

  function placeHousehold(p) {
    const item = Object.assign({ seed: hash(p.id) % 100000 }, p.item || {})
    const v = buildVisual(p.type, item)
    const root = new T.Group()
    root.name = p.id
    root.position.set(p.x, 0, p.z)
    root.rotation.y = p.ry
    root.add(v.group)
    scene.add(root)
    world.add(p.id, v.spec, { x: p.x, y: 0, z: p.z, ry: p.ry })
    const e = { id: p.id, type: p.type, x: p.x, z: p.z, ry: p.ry, item, root, group: v.group, parts: v.parts, hh: true, view: p.view }
    entries.set(p.id, e)
    order.push(p.id)
    finishVisual(e)
    return e
  }

  function rebuildVisuals() {
    for (const e of entries.values()) {
      if (!e.hh) continue
      const old = e.group
      e.root.remove(old)
      old.traverse((o) => {
        if (o.geometry && o.geometry !== UNIT_PLANE) o.geometry.dispose()
      })
      // wires were children of root: drop everything but the new group
      for (const c of e.root.children.slice()) c.removeFromParent()
      const v = buildVisual(e.type, e.item)
      e.root.add(v.group)
      e.group = v.group
      e.parts = v.parts
      finishVisual(e)
    }
  }

  // --- lamps and the water tank: showroom-only objects, still driven by the engine --------------------------------------------
  const lamps = []
  function placeLamp(id, x, z, name) {
    const spec = { type: 'ceiling_lamp', devices: [{ id: 'lamp', kind: 'lamp', watts: 40, circuit: 'lights' }], interactions: [] }
    world.add(id, spec, { x, y: 0, z, ry: 0 })
    const g = new T.Group()
    g.position.set(x, CEIL, z)
    const white = new T.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.6 })
    const canopy = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 16), white)
    canopy.position.y = -0.015
    const stem = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.3, 6), white)
    stem.position.y = -0.18
    const bulbMat = new T.MeshBasicMaterial({ color: 0x8a8578 })
    const shade = new T.Mesh(new T.SphereGeometry(0.14, 20, 12), bulbMat)
    shade.position.y = -0.4
    const cap = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.02, 20), white)
    cap.position.y = -0.31
    g.add(canopy, stem, cap, shade)
    const light = new T.PointLight(0xffd8a6, 0, 10, 1.5)
    light.position.set(0, -0.5, 0)
    g.add(light)
    scene.add(g)
    const e = { id, type: 'ceiling_lamp', x, z, ry: 0, name, root: g, custom: true, view: { dist: 0.1, look: [x, 2.3, z], at: [x, z + 1.2] } }
    entries.set(id, e)
    order.push(id)
    lamps.push({ id, light, bulbMat, on: false })
  }

  const TANK = { id: 'water_tank', x: 11.8, z: 9.5, gauge: null, fill: null }
  function placeTank() {
    const spec = {
      type: 'water_tank',
      tanks: [{ id: 'main', capacity: 500, level: 500, rainArea: 40 }],
      damage: [{ target: 'main', kind: 'water', hp: 100 }],
      colliders: [{ id: 'body', center: [0, 0.8, 0], half: [0.58, 0.8, 0.58] }],
      interactions: [],
    }
    world.add(TANK.id, spec, { x: TANK.x, y: 0, z: TANK.z, ry: 0 })
    const g = new T.Group()
    g.position.set(TANK.x, 0, TANK.z)
    const concrete = new T.MeshStandardMaterial({ color: 0x9d9a92, roughness: 0.95 })
    const poly = new T.MeshStandardMaterial({ color: 0x2f6fa6, roughness: 0.55 })
    const dark = new T.MeshStandardMaterial({ color: 0x1d2630, roughness: 0.6 })
    const stand = new T.Mesh(new T.BoxGeometry(1.1, 0.6, 1.1), concrete)
    stand.position.y = 0.3
    const body = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1.0, 28), poly)
    body.position.y = 1.1
    const lid = new T.Mesh(new T.CylinderGeometry(0.42, 0.46, 0.1, 28), poly)
    lid.position.y = 1.65
    const ring1 = new T.Mesh(new T.TorusGeometry(0.505, 0.015, 6, 36), dark)
    ring1.rotation.x = Math.PI / 2
    ring1.position.y = 0.85
    const ring2 = ring1.clone()
    ring2.position.y = 1.35
    const gaugeBack = new T.Mesh(new T.BoxGeometry(0.1, 0.9, 0.02), dark)
    gaugeBack.position.set(0, 1.1, 0.505)
    const fill = new T.Mesh(new T.BoxGeometry(0.06, 0.86, 0.02), new T.MeshBasicMaterial({ color: 0x66c9ff }))
    fill.geometry.translate(0, 0.43, 0)
    fill.position.set(0, 0.67, 0.516)
    const pipe = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.4, 8), new T.MeshStandardMaterial({ color: 0xcfcdc4, roughness: 0.6 }))
    pipe.rotation.x = Math.PI / 2
    pipe.position.set(0.2, 0.75, -0.7)
    g.add(stand, body, lid, ring1, ring2, gaugeBack, fill, pipe)
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o !== fill
        o.receiveShadow = true
      }
    })
    scene.add(g)
    TANK.fill = fill
    const e = { id: TANK.id, type: 'water_tank', x: TANK.x, z: TANK.z, ry: 0, root: g, custom: true, view: { dist: 1.9, look: [TANK.x, 1.1, TANK.z], at: [TANK.x, TANK.z + 1.9] } }
    entries.set(TANK.id, e)
    order.push(TANK.id)
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Layout: every household type placed sensibly (x, z = center of the footprint, ry = rotation around +y, front = +z)
  // ---------------------------------------------------------------------------------------------------------------------------
  const PI = Math.PI
  const H = PI / 2
  const SOCK = { circuit: 'sockets' }
  const LAYOUT = [
    // kitchen: counter run along the north wall (fridge right next to the west wall)
    ['fridge', 'fridge', 0.37, 0.36, 0, { hinge: 'right' }],
    ['cabinet_1', 'kitchen_cabinet_base', 1.14, 0.31, 0],
    ['sink_kitchen', 'sink_kitchen', 2.16, 0.31, 0],
    ['stove', 'stove', 3.08, 0.335, 0],
    ['gas_bottle', 'gas_bottle', 3.6, 0.2, 0],
    ['cabinet_2', 'kitchen_cabinet_base', 4.22, 0.31, 0],
    ['microwave', 'microwave', 4.22, 0.2, 0],
    ['pantry', 'pantry', 5.05, 0.235, 0],
    ['wall_cabinet_1', 'kitchen_cabinet_wall', 1.14, 0.185, 0],
    ['wall_cabinet_2', 'kitchen_cabinet_wall', 4.22, 0.185, 0],
    ['socket_counter_1', 'wall_socket', 0.9, 0.015, 0, { y: 1.05, circuit: 'sockets' }],
    ['socket_counter_2', 'wall_socket', 3.75, 0.015, 0, { y: 1.05, circuit: 'sockets' }],
    ['switch_kitchen', 'wall_switch', 5.75, 0.015, 0, { controls: ['lamp_kitchen:lamp'] }],
    ['electrical_panel', 'electrical_panel', 6.9, 0.06, 0, { circuits: CIRCUITS.map(([id, label]) => ({ id, label })) }],
    // dining
    ['chair_1', 'dining_chair', 6.2, 1.5, 0],
    ['chair_2', 'dining_chair', 7.2, 1.5, 0],
    ['chair_3', 'dining_chair', 6.2, 2.95, PI],
    ['chair_4', 'dining_chair', 7.2, 2.95, PI],
    // laundry on the west wall
    ['washing_machine', 'washing_machine', 0.31, 4.55, H],
    ['utility_sink', 'utility_sink', 0.285, 5.4, H],
    ['socket_laundry', 'wall_socket', 0.015, 4.98, H, { y: 0.95, circuit: 'sockets' }],
    ['switch_living', 'wall_switch', 0.015, 3.85, H, { controls: ['lamp_living:lamp'] }],
    // living
    ['sofa', 'sofa', 3.0, 5.1, 0],
    ['tv', 'tv', 3.0, 7.88, PI],
    ['socket_tv_1', 'wall_socket', 2.2, 7.985, PI, SOCK],
    ['socket_tv_2', 'wall_socket', 3.9, 7.985, PI, SOCK],
    ['armchair', 'armchair', 4.5, 6.8, -0.94],
    ['bed_single', 'bed_single', 0.49, 6.99, 0],
    ['fridge_compact', 'fridge_compact', 7.4, 7.715, PI],
    ['socket_fridge', 'wall_socket', 6.8, 7.985, PI, SOCK],
    // bathroom
    ['shower', 'shower', 8.52, 0.46, 0],
    ['toilet', 'toilet', 9.75, 0.36, 0],
    ['sink_bathroom', 'sink_bathroom', 11.2, 0.235, 0],
    ['bathroom_cabinet', 'bathroom_cabinet', 11.2, 0.085, 0],
    ['switch_bath', 'wall_switch', 8.065, 2.2, H, { controls: ['lamp_bath:lamp'] }],
    // bedroom
    ['bed_double', 'bed_double', 10.3, 4.7, 0],
    ['nightstand_1', 'nightstand', 9.15, 3.87, 0],
    ['nightstand_2', 'nightstand', 11.45, 3.87, 0],
    ['dresser', 'dresser', 8.95, 7.74, PI],
    ['wardrobe', 'wardrobe', 11.69, 7.19, -H],
    ['blinds', 'blinds', 10.4, 7.95, PI],
    ['curtain', 'curtain', 11.945, 5.1, -H],
    ['switch_bedroom', 'wall_switch', 8.065, 5.6, H, { controls: ['lamp_bedroom:lamp'] }],
    // electricity outside and conduits
    ['service_entrance', 'service_entrance', 13.2, 2.6, 0, { house: [-1.05, 2.5, -1.0] }],
    ['power_meter', 'power_meter', 12.2, 2.5, H],
    ['conduit_east', 'conduit_run', 0, 0, 0, { points: [[12.15, 2.5, 1.6], [12.15, 1.2, 1.6], [12.15, 1.2, 3.4], [12.15, 0.35, 3.4]] }],
    ['conduit_kitchen', 'conduit_run', 0, 0, 0, { points: [[5.75, 1.3, 0.04], [5.75, 2.58, 0.04], [3.0, 2.58, 0.04]] }],
    ['conduit_bedroom', 'conduit_run', 0, 0, 0, { points: [[8.1, 1.3, 5.6], [8.1, 2.6, 5.6], [10.3, 2.6, 5.6], [10.3, 2.6, 5.8]] }],
    // yard
    ['clothesline', 'clothesline', 4.2, 11.0, 0],
    ['bbq', 'bbq', 10.5, 13.3, PI],
    ['trash_bin', 'trash_bin', 0.9, 13.65, PI],
    ['wheelie_bin', 'wheelie_bin', 1.9, 13.5, PI],
    ['mailbox', 'mailbox', 5.9, 13.65, PI],
    ['dog_house', 'dog_house', 12.9, 10.6, -H],
    ['bench', 'bench', 8.4, 8.42, 0],
    // rural and camping corner
    ['fireplace', 'fireplace', 1.0, 8.6, 0],
    ['wood_stove', 'wood_stove', 2.6, 9.4, 0],
    ['bunk_bed', 'bunk_bed', 0.7, 11.4, 0],
    ['outhouse', 'outhouse', 2.3, 12.4, 0],
    ['well', 'well', 6.8, 10.9, 0],
    ['campfire', 'campfire', 9.6, 11.0, 0],
    ['camp_chair_1', 'camp_chair', 10.7, 11.0, -H],
    ['camp_chair_2', 'camp_chair', 8.5, 11.0, H],
    ['camp_table', 'camp_table', 9.4, 9.5, 0],
    ['camp_stove', 'camp_stove', 9.0, 9.5, 0, { y: 0.72 }],
    ['gas_canister', 'gas_canister', 9.4, 9.5, 0, { y: 0.72 }],
    ['lantern', 'lantern_lamp', 9.8, 9.5, 0, { y: 0.72 }],
    ['cooler', 'cooler', 7.6, 9.3, 0],
  ]

  const typeInfo = new Map(hh.types.map((t) => [t.id, t]))

  function buildWorld() {
    mats = makeMaterials()
    const names = new Map()
    for (const row of LAYOUT) {
      const [id, type, x, z, ry, item] = row
      const e = placeHousehold({ id, type, x, z, ry, item })
      const n = (names.get(type) || 0) + 1
      names.set(type, n)
      e.nth = n
    }
    for (const e of entries.values()) {
      if (e.hh && names.get(e.type) > 1) e.name = `${typeInfo.get(e.type).name} ${e.nth}`
      else if (e.hh) e.name = typeInfo.get(e.type).name
    }
    placeLamp('lamp_kitchen', 3.0, 1.8, 'Luminária da cozinha')
    placeLamp('lamp_living', 3.0, 5.4, 'Luminária da sala')
    placeLamp('lamp_bath', 10.0, 1.8, 'Luminária do banheiro')
    placeLamp('lamp_bedroom', 10.3, 6.0, 'Luminária do quarto')
    placeTank()
    world.water.setDefaultTank(`${TANK.id}:main`)
    fitAll()
  }

  function wallBlocked(x, z) {
    for (const r of env.wallRects) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return true
    return false
  }
  const sweeps = {}
  function fitAll() {
    for (const o of world.objects()) {
      for (const p of o.spec.parts || []) {
        if (!p.sweep) continue
        sweeps[`${o.id}:${p.id}`] = world.fitSweep(o.id, p.id, wallBlocked)
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Plugged cords: from the device plug (hh draws the first bit) to the socket it found, with the adapter's createCord
  // ---------------------------------------------------------------------------------------------------------------------------
  const cordMeshes = []
  function buildCords() {
    for (const m of cordMeshes.splice(0)) {
      m.removeFromParent()
      m.geometry.dispose()
    }
    for (const e of entries.values()) {
      if (!e.hh) continue
      const o = world.get(e.id)
      const spec = o.spec
      for (const d of spec.devices || []) {
        if (!d.plug) continue
        const wire = (spec.wires || []).find((w) => w.id === `${d.id}_cord`)
        const pts = (wire ? wire.points : [d.plug]).map((p) => toWorld(o.transform, p))
        const sid = world.power.pluggedInto(e.id, d.id)
        if (sid) {
          const cut = sid.indexOf(':')
          const so = world.get(sid.slice(0, cut))
          const sk = so && so.spec.sockets.find((s) => s.id === sid.slice(cut + 1))
          if (so && sk) {
            const sp = toWorld(so.transform, sk.pos)
            const dir = [Math.sin(so.transform.ry), Math.cos(so.transform.ry)]
            const last = pts[pts.length - 1]
            if (last[1] < 0.3) {
              const foot = [sp[0] + dir[0] * 0.035, 0.012, sp[2] + dir[1] * 0.035]
              const mid1 = [last[0] + (foot[0] - last[0]) * 0.4, 0.012, last[2] + (foot[2] - last[2]) * 0.4]
              const mid2 = [last[0] + (foot[0] - last[0]) * 0.75, 0.012, last[2] + (foot[2] - last[2]) * 0.75]
              pts.push(mid1, mid2, foot, [foot[0], Math.max(0.1, sp[1] - 0.04), foot[2]], [sp[0] + dir[0] * 0.012, sp[1] - 0.01, sp[2] + dir[1] * 0.012])
            } else {
              const hang = GT.catenary(last, [sp[0] + dir[0] * 0.012, sp[1] - 0.01, sp[2] + dir[1] * 0.012], 0.1, 8)
              hang.shift()
              for (const p of hang) pts.push(p)
            }
          }
        }
        const mesh = gfx.createCord(pts, 0.006, wireMats.cord)
        scene.add(mesh)
        cordMeshes.push(mesh)
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Items in containers: small simple meshes at world.slotPosition (instanced: a few draw calls for hundreds of items)
  // ---------------------------------------------------------------------------------------------------------------------------
  const SHAPES = {
    can: [['cyl', 1, 1, 1, 0, 1]],
    bottle: [['cyl', 0.9, 0.72, 0.9, 0, 1], ['cyl', 0.36, 0.3, 0.36, 0.7, 0.55]],
    jar: [['cyl', 1, 0.86, 1, 0, 1], ['cyl', 1.02, 0.14, 1.02, 0.86, 0.6]],
    cup: [['cyl', 1, 1, 1, 0, 1]],
    dish: [['cyl', 1, 0.3, 1, 0, 1]],
    roll: [['cyl', 1, 1, 1, 0, 1]],
    tube: [['cyl', 0.6, 1, 0.6, 0, 1]],
    fruit: [['sph', 1, 1, 1, 0, 1]],
    bag: [['box', 1, 0.9, 1, 0, 1], ['box', 0.9, 0.1, 0.5, 0.9, 0.7]],
    box: [['box', 1, 1, 1, 0, 1]],
    cloth: [['box', 1, 1, 1, 0, 1]],
    paper: [['box', 1, 1, 1, 0, 1]],
    tool: [['box', 1, 1, 1, 0, 1]],
    shoe: [['box', 1, 0.7, 1, 0, 1]],
  }
  const items = (() => {
    const mk = (geo) => {
      const mat = state.quality === 'game' ? new T.MeshLambertMaterial() : new T.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 })
      const mesh = new T.InstancedMesh(geo, mat, 900)
      mesh.frustumCulled = false
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.count = 0
      mesh.setColorAt(0, new T.Color(1, 1, 1))
      scene.add(mesh)
      return mesh
    }
    return { cyl: mk(new T.CylinderGeometry(0.5, 0.5, 1, 14)), box: mk(new T.BoxGeometry(1, 1, 1)), sph: mk(new T.SphereGeometry(0.5, 12, 8)) }
  })()
  const itemTmp = { o: new T.Object3D(), c: new T.Color() }
  let itemCount = 0

  function updateItems() {
    const cx = camera.position.x
    const cz = camera.position.z
    const n = { cyl: 0, box: 0, sph: 0 }
    const o = itemTmp.o
    for (const e of entries.values()) {
      if (!e.hh) continue
      if (Math.abs(e.x - cx) > 14 || Math.abs(e.z - cz) > 14) continue
      const spec = world.get(e.id).spec
      for (const c of spec.containers || []) {
        if (c.access && world.partT(e.id, c.access) < 0.02) continue
        const stacks = world.contents(e.id, c.id)
        for (let i = 0; i < stacks.length; i++) {
          const st = stacks[i]
          if (!st) continue
          const def = hh.items[st.type]
          if (!def) continue
          const p = world.slotPosition(e.id, c.id, i)
          const shape = SHAPES[def.shape] || SHAPES.box
          for (const part of shape) {
            const kind = part[0]
            const mesh = items[kind]
            if (n[kind] >= mesh.instanceMatrix.count) continue
            const sx = def.size[0] * part[1]
            const sy = def.size[1] * part[2]
            const sz = def.size[2] * part[3]
            o.position.set(p[0], p[1] + def.size[1] * part[4] + sy / 2, p[2])
            o.rotation.set(0, e.ry, 0)
            o.scale.set(sx, sy, sz)
            o.updateMatrix()
            mesh.setMatrixAt(n[kind], o.matrix)
            itemTmp.c.setHex(def.color == null ? 0xcccccc : def.color).multiplyScalar(part[5])
            mesh.setColorAt(n[kind], itemTmp.c)
            n[kind]++
          }
        }
      }
    }
    itemCount = n.cyl + n.box + n.sph
    for (const k of Object.keys(items)) {
      const m = items[k]
      m.count = n[k]
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Effects (smoke, fire, steam, water, flames), screens, lamps, rain
  // ---------------------------------------------------------------------------------------------------------------------------
  const effects = gfx.createEffects({ scene, camera, maxParticles: 2800, seed: 11, document })
  const markerMat = new T.SpriteMaterial({ map: (() => canvasTexture(64, 64, (g, w, h) => {
    g.beginPath()
    g.arc(w / 2, h / 2, 22, 0, Math.PI * 2)
    g.lineWidth = 6
    g.strokeStyle = 'rgba(255,200,110,0.95)'
    g.stroke()
    g.beginPath()
    g.arc(w / 2, h / 2, 6, 0, Math.PI * 2)
    g.fillStyle = 'rgba(255,200,110,0.95)'
    g.fill()
  }))(), depthTest: false, transparent: true, opacity: 0.0 })
  const marker = new T.Sprite(markerMat)
  marker.renderOrder = 999
  marker.scale.setScalar(0.09)
  scene.add(marker)

  const rain = (() => {
    const N = 700
    const pos = new Float32Array(N * 6)
    const base = new Float32Array(N * 3)
    const rnd = mulberry(99)
    for (let i = 0; i < N; i++) {
      base[i * 3] = (rnd() - 0.5) * 30
      base[i * 3 + 1] = rnd() * 12
      base[i * 3 + 2] = (rnd() - 0.5) * 30
    }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.BufferAttribute(pos, 3))
    const m = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xbcd0e0, transparent: true, opacity: 0.45, fog: true }))
    m.frustumCulled = false
    m.visible = false
    scene.add(m)
    return { mesh: m, pos, base, N, t: 0 }
  })()
  function updateRain(dt) {
    if (!rain.mesh.visible) return
    rain.t += dt
    const cx = camera.position.x
    const cz = camera.position.z
    const wind = state.wind ? 1.2 : 0.3
    for (let i = 0; i < rain.N; i++) {
      let y = rain.base[i * 3 + 1] - rain.t * 14
      y = ((y % 12) + 12) % 12
      const dx = ((((rain.base[i * 3] - cx) % 30) + 45) % 30) - 15
      const dz = ((((rain.base[i * 3 + 2] - cz) % 30) + 45) % 30) - 15
      const x = cx + dx + (12 - y) * 0.06 * wind
      const z = cz + dz
      const inside = x > HOUSE.x0 - 0.1 && x < HOUSE.x1 + 0.1 && z > HOUSE.z0 - 0.1 && z < HOUSE.z1 + 0.1 && y < CEIL + 0.05
      const k = i * 6
      if (inside) {
        rain.pos[k] = rain.pos[k + 3] = 0
        rain.pos[k + 1] = rain.pos[k + 4] = -50
        rain.pos[k + 2] = rain.pos[k + 5] = 0
      } else {
        rain.pos[k] = x
        rain.pos[k + 1] = y
        rain.pos[k + 2] = z
        rain.pos[k + 3] = x + 0.02 * wind
        rain.pos[k + 4] = y + 0.55
        rain.pos[k + 5] = z
      }
    }
    rain.mesh.geometry.attributes.position.needsUpdate = true
  }

  const envScale = [] // { m, base } materials whose environment reflection fades at night
  function registerEnv() {
    envScale.length = 0
    const add = (m) => {
      if (m && 'envMapIntensity' in m) envScale.push({ m, base: m.envMapIntensity })
    }
    for (const k of Object.keys(mats)) add(mats[k])
    for (const k of Object.keys(env.materials)) add(env.materials[k])
  }
  function applyTime() {
    const night = state.night
    const wet = state.rain ? 0.55 : 1
    sun.intensity = night ? 0.1 : 2.5 * wet
    fill.intensity = night ? 0 : 0.9 * (state.rain ? 0.7 : 1)
    sun.color.setHex(night ? 0x8aa4ff : 0xfff0d8)
    hemi.intensity = night ? 0.12 : 0.62 * (state.rain ? 0.8 : 1)
    hemi.color.setHex(night ? 0x34457a : 0xdceaff)
    hemi.groundColor.setHex(night ? 0x151a26 : 0xb8ab97)
    renderer.toneMappingExposure = night ? 1.15 : 1
    sky.material.color.setHex(night ? 0x0a1126 : state.rain ? 0x9aa4ad : 0xffffff)
    scene.fog.color.setHex(night ? 0x0a1020 : state.rain ? 0x9aa7b0 : 0xcfe0ec)
    env.materials.ceilingMat.emissive.setHex(night ? 0x0c0c10 : 0x9c9890)
    for (const r of envScale) r.m.envMapIntensity = r.base * (night ? 0.05 : state.rain ? 0.45 : 0.7)
  }

  function updateLamps() {
    for (const l of lamps) {
      const on = world.power.isOn(l.id, 'lamp') && world.power.isPowered(l.id, 'lamp')
      if (on !== l.on) {
        l.on = on
        l.bulbMat.color.setHex(on ? 0xfff0c8 : 0x8a8578)
      }
      const target = on ? 22 : 0
      l.light.intensity += (target - l.light.intensity) * 0.35
      if (Math.abs(l.light.intensity - target) < 0.05) l.light.intensity = target
    }
  }
  function updateScreens(dt) {
    for (const [id, sc] of screens) {
      const on = world.power.isOn(id, 'tv') && world.power.isPowered(id, 'tv')
      if (sc.on !== on) sc.setOn(on)
      const ch = world.power.channel(id, 'tv')
      if (sc.channel !== ch) sc.setChannel(ch)
      sc.update(dt)
    }
  }
  function updateTank() {
    const lvl = world.water.level(`${TANK.id}:main`)
    TANK.fill.scale.y = Math.max(0.001, lvl / 500)
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Player: first person, collision against walls and world.colliders() (soft volumes are never colliders)
  // ---------------------------------------------------------------------------------------------------------------------------
  const player = { x: 6.1, z: 5.3, yaw: 0.35, pitch: -0.12, vx: 0, vz: 0, seat: null, eye: EYE }
  const keys = new Set()
  const stick = { x: 0, y: 0 }
  let colliders = []

  function circleRect(x, z, r, rect) {
    const nx = clamp(x, rect[0], rect[2])
    const nz = clamp(z, rect[1], rect[3])
    return (x - nx) * (x - nx) + (z - nz) * (z - nz) < r * r
  }
  function circleObb(x, z, r, c) {
    const dx = x - c.cx
    const dz = z - c.cz
    const cs = Math.cos(c.ry)
    const sn = Math.sin(c.ry)
    const lx = dx * cs - dz * sn
    const lz = dx * sn + dz * cs
    const nx = clamp(lx, -c.hw, c.hw)
    const nz = clamp(lz, -c.hd, c.hd)
    return (lx - nx) * (lx - nx) + (lz - nz) * (lz - nz) < r * r
  }
  function collides(x, z) {
    if (x < LOT.x0 || x > LOT.x1 || z < LOT.z0 || z > LOT.z1) return true
    for (const r of env.wallRects) if (circleRect(x, z, RADIUS, r)) return true
    for (const r of env.solidRects) if (circleRect(x, z, RADIUS, r)) return true
    for (const c of colliders) {
      if (c.y1 < 0.2 || c.y0 > 1.35) continue
      if (circleObb(x, z, RADIUS, c)) return true
    }
    return false
  }
  function tryMove(dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08))
    const sx = dx / steps
    const sz = dz / steps
    for (let i = 0; i < steps; i++) {
      if (!collides(player.x + sx, player.z)) player.x += sx
      if (!collides(player.x, player.z + sz)) player.z += sz
    }
  }
  function movePlayer(dt) {
    let fwd = 0
    let side = 0
    if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1
    if (keys.has('KeyD')) side += 1
    if (keys.has('KeyA')) side -= 1
    fwd += -stick.y
    side += stick.x
    const len = Math.hypot(fwd, side)
    if (len > 1) {
      fwd /= len
      side /= len
    }
    if (keys.has('ArrowLeft')) player.yaw += 1.8 * dt
    if (keys.has('ArrowRight')) player.yaw -= 1.8 * dt
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.4 : 2.5
    const sn = Math.sin(player.yaw)
    const cs = Math.cos(player.yaw)
    const vx = (-sn * fwd + cs * side) * speed
    const vz = (-cs * fwd - sn * side) * speed
    player.vx = vx
    player.vz = vz
    if (player.seat) return
    const x0 = player.x
    const z0 = player.z
    if (vx || vz) tryMove(vx * dt, vz * dt)
    player.vx = (player.x - x0) / Math.max(dt, 1e-6)
    player.vz = (player.z - z0) / Math.max(dt, 1e-6)
  }
  function updateCamera() {
    if (player.seat) camera.position.set(player.seat.eye[0], player.seat.eye[1], player.seat.eye[2])
    else camera.position.set(player.x, player.eye, player.z)
    camera.rotation.set(player.pitch, player.yaw, 0)
  }
  function eyeState() {
    return { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: player.yaw, pitch: player.pitch }
  }
  function lookAt(x, y, z) {
    const dx = x - camera.position.x
    const dz = z - camera.position.z
    const dy = y - camera.position.y
    player.yaw = Math.atan2(-dx, -dz)
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz))
    updateCamera()
  }

  // --- seats ------------------------------------------------------------------------------------------------------------------
  function seatEye(objectId, seatId) {
    const o = world.get(objectId)
    const seat = o.spec.seats.find((s) => s.id === seatId)
    const eye = toWorld(o.transform, [seat.pos[0], seat.pos[1] + (seat.eye === undefined ? (seat.pose === 'lie' ? 0.18 : 0.62) : seat.eye), seat.pos[2]])
    return { eye, yaw: o.transform.ry + seat.ry + PI, pose: seat.pose, exit: toWorld(o.transform, seat.exit) }
  }
  function onSeat(e) {
    if (e.actor !== 'player') return
    if (e.seated) {
      const s = seatEye(e.object, e.seat)
      player.seat = { object: e.object, seat: e.seat, eye: s.eye, pose: s.pose }
      player.yaw = s.yaw
      player.pitch = s.pose === 'lie' ? 0.55 : -0.08
      showToast(s.pose === 'lie' ? 'Deitado. Espaço para levantar.' : 'Sentado. Espaço para levantar.')
    } else if (player.seat) {
      const s = seatEye(player.seat.object, player.seat.seat)
      player.seat = null
      player.x = s.exit[0]
      player.z = s.exit[2]
      if (collides(player.x, player.z)) {
        const spot = freeSpotNear(player.x, player.z)
        player.x = spot[0]
        player.z = spot[1]
      }
    }
  }
  function freeSpotNear(x, z) {
    for (let r = 0.1; r < 2; r += 0.1) {
      for (let a = 0; a < 12; a++) {
        const px = x + Math.cos((a / 12) * Math.PI * 2) * r
        const pz = z + Math.sin((a / 12) * Math.PI * 2) * r
        if (!collides(px, pz)) return [px, pz]
      }
    }
    return [x, z]
  }
  function standUp() {
    if (!player.seat) return false
    world.stand('player')
    return true
  }

  // --- interaction ------------------------------------------------------------------------------------------------------------
  function currentTarget() {
    return world.target(eyeState(), { reach: 2.3, cone: 0.5 })
  }
  /** Item slot looked at in an open container: { id, container, slot, stack, pos, angle, dist }. */
  function pickSlot(maxAngle) {
    const ex = camera.position.x
    const ey = camera.position.y
    const ez = camera.position.z
    const dir = [-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)]
    let best = null
    for (const e of entries.values()) {
      if (!e.hh || Math.abs(e.x - ex) > 4 || Math.abs(e.z - ez) > 4) continue
      const spec = world.get(e.id).spec
      for (const c of spec.containers || []) {
        if (!world.accessible(e.id, c.id)) continue
        const stacks = world.contents(e.id, c.id)
        for (let i = 0; i < stacks.length; i++) {
          if (!stacks[i]) continue
          const def = hh.items[stacks[i].type]
          if (def && def.pickable === false) continue
          const p = world.slotPosition(e.id, c.id, i)
          const hgt = def ? def.size[1] / 2 : 0.05
          const v = [p[0] - ex, p[1] + hgt - ey, p[2] - ez]
          const dist = Math.hypot(v[0], v[1], v[2])
          if (dist > 2.2 || dist < 0.05) continue
          const cos = clamp((v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / dist, -1, 1)
          const angle = Math.acos(cos)
          if (angle > (maxAngle || 0.3)) continue
          if (!best || angle < best.angle) best = { id: e.id, container: c.id, slot: i, stack: stacks[i], pos: p, angle, dist }
        }
      }
    }
    return best
  }
  function itemName(type) {
    return world.t(`item.${type}`)
  }
  function takeSlot(s) {
    if (!s) return null
    return world.take(s.id, s.container, s.slot, 'player')
  }
  function interactTarget(t) {
    if (!t) return false
    const ok = t.act('player')
    return ok
  }
  function pressUse() {
    const s = pickSlot(0.12)
    if (s) return !!takeSlot(s)
    return interactTarget(currentTarget())
  }
  function pressTake() {
    return !!takeSlot(pickSlot(0.3))
  }
  function addToPack(st) {
    const found = pack.find((p) => p.type === st.type)
    if (found) found.qty += st.qty
    else pack.push({ type: st.type, qty: st.qty })
    renderPack()
  }

  // --- world events -------------------------------------------------------------------------------------------------------------
  let shadowHold = 0
  function onWorldEvent(e) {
    if (e.type === 'part') shadowHold = 0.8
    else if (e.type === 'pickup') {
      if (e.actor === 'player') {
        addToPack(e.stack)
        showToast(`Pegou: ${itemName(e.stack.type)}${e.stack.qty > 1 ? ' x' + e.stack.qty : ''}`)
      }
    } else if (e.type === 'seat') onSeat(e)
    else if (e.type === 'message') {
      const warn = /^(no_|locked|empty|full)/.test(e.key)
      showToast(e.text, warn ? 'warn' : '', e.key.startsWith('letter') ? 7000 : 2600)
    } else if (e.type === 'explosion') showToast('Explosão!', 'warn')
    else if (e.type === 'leak') showToast("Vazamento na caixa d'água.", 'warn')
  }

  // --- teleport to an object ------------------------------------------------------------------------------------------------------
  function standSpot(e) {
    if (e.view && e.view.at) return { x: e.view.at[0], z: e.view.at[1] }
    const def = typeInfo.get(e.type)
    const d = def ? def.d : 0.5
    const tall = def && def.h > 4
    const cands = tall ? [4.2, 3.2, 5] : [d / 2 + 1.15, d / 2 + 0.9, d / 2 + 1.5, d / 2 + 0.7, d / 2 + 2]
    for (const dist of cands) {
      const x = e.x + Math.sin(e.ry) * dist
      const z = e.z + Math.cos(e.ry) * dist
      if (!collides(x, z)) return { x, z }
    }
    const f = freeSpotNear(e.x + Math.sin(e.ry) * 1.2, e.z + Math.cos(e.ry) * 1.2)
    return { x: f[0], z: f[1] }
  }
  function teleport(id) {
    const e = entries.get(id)
    if (!e) return false
    if (player.seat) standUp()
    const s = standSpot(e)
    player.eye = EYE
    player.x = s.x
    player.z = s.z
    player.vx = player.vz = 0
    updateCamera()
    if (e.view && e.view.look) lookAt(e.view.look[0], e.view.look[1], e.view.look[2])
    else {
      const def = typeInfo.get(e.type)
      const c = toWorld({ x: e.x, y: 0, z: e.z, ry: e.ry }, [0, def ? def.y + Math.min(def.h * 0.5, 1.6) : 1, 0])
      lookAt(c[0], c[1], c[2])
    }
    return true
  }
  function setView(v) {
    if (v.x !== undefined) player.x = v.x
    if (v.z !== undefined) player.z = v.z
    if (v.eye !== undefined) player.eye = v.eye
    if (v.yaw !== undefined) player.yaw = v.yaw
    if (v.pitch !== undefined) player.pitch = v.pitch
    if (v.fov !== undefined) {
      camera.fov = v.fov
      camera.updateProjectionMatrix()
    }
    updateCamera()
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------------------------------------
  let clock = 0
  let lastShadow = 0
  let lastCalls = 0
  let hudTimer = 0
  let paused = false
  let fpsAcc = 0
  let fpsN = 0
  let fps = 0
  const softIds = []

  function leakEmitter() {
    const hp = world.hp(TANK.id, 'main')
    if (hp === null || hp >= 100 || world.water.level(`${TANK.id}:main`) <= 0) return null
    return { id: `${TANK.id}:leak`, object: TANK.id, kind: 'water', pos: [TANK.x + 0.52, 0.55, TANK.z + 0.1], dir: [1, -0.25, 0.1], size: 0.09, intensity: 0.7 }
  }

  /** One simulation step (no drawing). */
  function sim(dt) {
    clock += dt
    colliders = world.colliders()
    movePlayer(dt)
    if (!player.seat) world.push([player.x, 0, player.z], 0.32, [player.vx, 0, player.vz])
    world.update(dt)
    updateCamera()
    for (const id of order) {
      const e = entries.get(id)
      if (e.hh) gfx.syncObject(world, id, e.parts, { time: clock })
    }
    const em = world.emitters()
    const leak = leakEmitter()
    if (leak) em.push(leak)
    effects.update(dt, em)
    updateItems()
    updateScreens(dt)
    updateLamps()
    updateTank()
    updateRain(dt)
    mirrorsApi.update(camera, world.mirrors([camera.position.x, camera.position.y, camera.position.z], 7, 3))
    sky.position.copy(camera.position)
    // the sun's shadow map only needs a redraw when something moves
    shadowHold = Math.max(0, shadowHold - dt)
    let swaying = state.wind
    if (!swaying) {
      for (const [o, s] of softIds) {
        const w = world.sway(o, s)
        if (Math.abs(w.ax) + Math.abs(w.az) > 0.004) {
          swaying = true
          break
        }
      }
    }
    if (shadowHold > 0 || swaying || state.quality === 'high' || clock - lastShadow > 0.25) {
      renderer.shadowMap.needsUpdate = true
      lastShadow = clock
    }
  }
  function render() {
    renderer.info.reset()
    renderer.render(scene, camera)
    lastCalls = renderer.info.render.calls
  }

  function frame(now) {
    requestAnimationFrame(frame)
    if (paused) return
    const dt = clamp((now - (frame.last || now)) / 1000, 0, 0.05)
    frame.last = now
    sim(dt)
    updateHud(dt)
    render()
    fpsAcc += dt
    fpsN++
    if (fpsAcc >= 0.5) {
      fps = fpsN / fpsAcc
      fpsAcc = 0
      fpsN = 0
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // HUD and panel (pt-BR)
  // ---------------------------------------------------------------------------------------------------------------------------
  const el = {
    cross: $('#cross'),
    prompt: $('#prompt'),
    toast: $('#toast'),
    fps: $('#fps'),
    calls: $('#calls'),
    pack: $('#pack'),
    packList: $('#packList'),
    packEmpty: $('#packEmpty'),
    packCount: $('#packCount'),
    panel: $('#panel'),
  }
  let toastTimer = 0
  function showToast(text, kind, ms) {
    el.toast.textContent = text
    el.toast.className = kind || ''
    el.toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      el.toast.hidden = true
    }, ms || 2400)
  }
  function renderPack() {
    el.packList.textContent = ''
    let total = 0
    for (const p of pack) {
      total += p.qty
      const li = document.createElement('li')
      const sw = document.createElement('span')
      sw.className = 'sw'
      const def = hh.items[p.type]
      sw.style.background = '#' + ((def && def.color) || 0xcccccc).toString(16).padStart(6, '0')
      const name = document.createElement('span')
      name.textContent = itemName(p.type)
      const q = document.createElement('span')
      q.className = 'q'
      q.textContent = `×${p.qty}`
      li.append(sw, name, q)
      el.packList.append(li)
    }
    el.packEmpty.hidden = pack.length > 0
    el.packCount.textContent = String(total)
  }
  function setPromptHtml(main, sub) {
    el.prompt.textContent = ''
    el.prompt.append(main)
    if (sub) {
      const s = document.createElement('span')
      s.className = 'sub'
      s.textContent = sub
      el.prompt.append(s)
    }
  }
  const kbd = (k) => {
    const b = document.createElement('kbd')
    b.textContent = k
    return b
  }
  function updateHud(dt) {
    hudTimer -= dt
    if (hudTimer > 0) return
    hudTimer = 0.08
    const slot = pickSlot(0.3)
    const t = currentTarget()
    if (slot) {
      const tight = slot.angle < 0.12
      const span = document.createElement('span')
      span.append(kbd(tight ? 'E / F' : 'F'), ` Pegar ${itemName(slot.stack.type)}${slot.stack.qty > 1 ? ' ×' + slot.stack.qty : ''}`)
      setPromptHtml(span, t && !tight ? `${t.label} (E)` : '')
      el.prompt.hidden = false
      el.cross.classList.add('on')
      marker.position.set(slot.pos[0], slot.pos[1] + 0.05, slot.pos[2])
      markerMat.opacity = 0.9
    } else if (t) {
      const span = document.createElement('span')
      span.append(kbd('E'), ` ${t.label}`)
      setPromptHtml(span, '')
      el.prompt.hidden = false
      el.cross.classList.add('on')
      marker.position.set(t.pos[0], t.pos[1], t.pos[2])
      markerMat.opacity = 0.85
    } else {
      el.prompt.hidden = true
      el.cross.classList.remove('on')
      markerMat.opacity = 0
    }
    el.fps.textContent = `${Math.round(fps)} fps`
    el.calls.textContent = `${lastCalls} draw calls`
    syncPanel()
  }

  const ui = {}
  function buildPanel() {
    // breakers
    const br = $('#breakers')
    for (const [id, label] of CIRCUITS) {
      const l = document.createElement('label')
      l.className = 'chip'
      const i = document.createElement('input')
      i.type = 'checkbox'
      i.checked = true
      i.dataset.circuit = id
      i.addEventListener('change', () => world.power.setBreaker(id, i.checked))
      l.append(i, ` Disjuntor: ${label}`)
      br.append(l)
    }
    ui.grid = $('#tGrid')
    ui.grid.addEventListener('change', () => world.power.setGrid(ui.grid.checked))
    ui.gas = $('#tGas')
    ui.gas.addEventListener('change', () => {
      if (gasOpen() !== ui.gas.checked) world.act('gas_bottle:use_gas')
    })
    $('#tNight').addEventListener('change', (ev) => setNight(ev.target.checked))
    $('#tRain').addEventListener('change', (ev) => setRain(ev.target.checked))
    $('#tWind').addEventListener('change', (ev) => setWind(ev.target.checked))
    $('#bFill').addEventListener('click', () => world.water.refill(`${TANK.id}:main`, 500))
    $('#bDrain').addEventListener('click', drainTank)
    $('#bLeak').addEventListener('click', () => world.damage(TANK.id, 'main', 60, 'water'))
    for (const b of document.querySelectorAll('#qualitySeg button')) b.addEventListener('click', () => setQuality(b.dataset.q))
    // object list, grouped
    const list = $('#objList')
    const groups = new Map()
    for (const id of order) {
      const e = entries.get(id)
      const def = typeInfo.get(e.type)
      const g = e.hh ? (def.group === 'bathroom' ? 'kitchen' : def.group) : 'house'
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g).push(e)
    }
    const names = ['house', 'storage', 'kitchen', 'electrical', 'seating', 'window', 'yard']
    for (const g of names) {
      const arr = groups.get(g)
      if (!arr) continue
      const h = document.createElement('h4')
      h.textContent = GROUP_NAMES[g] || g
      list.append(h)
      for (const e of arr) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = e.name || e.type
        b.dataset.id = e.id
        b.addEventListener('click', () => {
          teleport(e.id)
          for (const x of list.querySelectorAll('button.cur')) x.classList.remove('cur')
          b.classList.add('cur')
          if (matchMedia('(max-width: 760px)').matches) setPanel(false)
          canvas.focus()
        })
        list.append(b)
      }
    }
    $('#objCount').textContent = `(${order.length})`
    $('#packBtn').addEventListener('click', () => {
      el.pack.hidden = !el.pack.hidden
    })
    $('#packClose').addEventListener('click', () => {
      el.pack.hidden = true
    })
    $('#panelBtn').addEventListener('click', () => setPanel(!el.panel.classList.contains('open')))
    renderPack()
    syncQuality()
  }
  function setPanel(open) {
    el.panel.classList.toggle('open', open)
    $('#panelBtn').setAttribute('aria-expanded', String(open))
  }
  function gasOpen() {
    return world.partT('gas_bottle', 'valve') > 0.5
  }
  function syncQuality() {
    for (const b of document.querySelectorAll('#qualitySeg button')) b.classList.toggle('on', b.dataset.q === state.quality)
  }
  function syncPanel() {
    ui.grid.checked = world.power.grid
    for (const i of document.querySelectorAll('#breakers input')) i.checked = world.power.breaker(i.dataset.circuit)
    ui.gas.checked = gasOpen()
    const gas = world.fuelLevel('gas_bottle', 'gas')
    $('#gasBar').style.width = `${clamp((gas / 13) * 100, 0, 100)}%`
    $('#gasTxt').textContent = `${gas.toFixed(1)} kg`
    const tank = world.water.level(`${TANK.id}:main`)
    $('#tankBar').style.width = `${clamp((tank / 500) * 100, 0, 100)}%`
    $('#tankTxt').textContent = `${Math.round(tank)} L`
  }

  function drainTank() {
    const st = world.serialize()
    st.objects[TANK.id].tanks.main = 0
    world.load(st)
    fitAll()
  }
  function setNight(on) {
    state.night = !!on
    $('#tNight').checked = state.night
    applyTime()
  }
  function setRain(on) {
    state.rain = !!on
    $('#tRain').checked = state.rain
    world.water.setRain(on ? 60 : 0)
    rain.mesh.visible = state.rain
    applyTime()
  }
  function setWind(on) {
    state.wind = !!on
    $('#tWind').checked = state.wind
    world.setWind(on ? 3.5 : 0, on ? 1.5 : 0)
    effects.setWind(on ? 3.5 : 0, on ? 1.5 : 0)
  }
  function applyQuality() {
    const high = state.quality === 'high'
    renderer.setPixelRatio(high ? Math.min(devicePixelRatio || 1, 2) : 1)
    sun.shadow.mapSize.set(high ? 4096 : 2048, high ? 4096 : 2048)
    if (sun.shadow.map) {
      sun.shadow.map.dispose()
      sun.shadow.map = null
    }
    resize()
  }
  function setQuality(q) {
    if (q !== 'high' && q !== 'game') return
    if (q === state.quality) return
    state.quality = q
    syncQuality()
    mats = makeMaterials()
    buildEnvironment()
    registerEnv()
    rebuildVisuals()
    applyQuality()
    applyTime()
    renderer.shadowMap.needsUpdate = true
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------------------------------------------------------
  let locked = false
  let drag = null
  function look(dx, dy, k) {
    player.yaw -= dx * k
    player.pitch = clamp(player.pitch - dy * k, -1.45, 1.45)
  }
  function bindInput() {
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas
    })
    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      canvas.focus()
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }
      try {
        canvas.setPointerCapture(ev.pointerId)
      } catch (_err) {
        /* not fatal */
      }
      if (ev.pointerType === 'mouse' && !locked && canvas.requestPointerLock) {
        try {
          const r = canvas.requestPointerLock()
          if (r && r.catch) r.catch(() => {})
        } catch (_err) {
          /* drag-look keeps working */
        }
      }
    })
    canvas.addEventListener('pointermove', (ev) => {
      if (locked) look(ev.movementX, ev.movementY, 0.0022)
      else if (drag && drag.id === ev.pointerId) {
        look(ev.clientX - drag.x, ev.clientY - drag.y, ev.pointerType === 'touch' ? 0.0048 : 0.0026)
        drag.x = ev.clientX
        drag.y = ev.clientY
      }
    })
    const end = (ev) => {
      if (drag && drag.id === ev.pointerId) drag = null
    }
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)
    window.addEventListener('keydown', (ev) => {
      if (ev.target && ev.target.tagName === 'INPUT' && ev.target.type === 'text') return
      if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault()
      if (ev.repeat) return
      keys.add(ev.code)
      if (ev.code === 'KeyE') pressUse()
      else if (ev.code === 'KeyF') pressTake()
      else if (ev.code === 'Space') standUp()
      else if (ev.code === 'KeyB') el.pack.hidden = !el.pack.hidden
    })
    window.addEventListener('keyup', (ev) => keys.delete(ev.code))
    window.addEventListener('blur', () => keys.clear())
    window.addEventListener('resize', resize)
    // touch controls
    const touch = matchMedia('(pointer: coarse)').matches || params.has('touch')
    if (touch) {
      $('#touch').hidden = false
      const st = $('#stick')
      const knob = $('#knob')
      let sid = null
      const move = (ev) => {
        const r = st.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        let dx = (ev.clientX - cx) / (r.width / 2)
        let dy = (ev.clientY - cy) / (r.height / 2)
        const l = Math.hypot(dx, dy)
        if (l > 1) {
          dx /= l
          dy /= l
        }
        stick.x = dx
        stick.y = dy
        knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`
      }
      st.addEventListener('pointerdown', (ev) => {
        sid = ev.pointerId
        st.setPointerCapture(ev.pointerId)
        move(ev)
      })
      st.addEventListener('pointermove', (ev) => {
        if (ev.pointerId === sid) move(ev)
      })
      const stop = (ev) => {
        if (ev.pointerId !== sid) return
        sid = null
        stick.x = stick.y = 0
        knob.style.transform = ''
      }
      st.addEventListener('pointerup', stop)
      st.addEventListener('pointercancel', stop)
      $('#tE').addEventListener('click', () => pressUse())
      $('#tF').addEventListener('click', () => pressTake())
      $('#tUp').addEventListener('click', () => standUp())
    }
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth
    const h = canvas.clientHeight || innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.fov = w / h < 0.9 ? 82 : 72
    camera.updateProjectionMatrix()
    effects.setViewHeight(renderer.domElement.height)
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------------------------------------------------------
  function start() {
    buildEnvironment()
    scene.add(buildTrees())
    renderer.shadowMap.autoUpdate = false
    buildWorld()
    registerEnv()
    buildCords()
    for (const id of order) {
      const e = entries.get(id)
      if (!e.hh) continue
      for (const s of world.get(id).spec.soft || []) softIds.push([id, s.id])
    }
    buildPanel()
    applyQuality()
    applyTime()
    bindInput()
    updateCamera()
    sim(1 / 60)
    render()
    $('#loading').hidden = true
    requestAnimationFrame(frame)
  }

  // The API the automated test (and curious people in the console) use.
  window.__showroom = {
    THREE: T, world, hh, scene, camera, renderer, player, entries, state, env, gfx, effects, mirrors: mirrorsApi, screens, lamps, pack, events, sweeps, items,
    TANK, LAYOUT,
    sim, render, step(seconds, hz) {
      const dt = 1 / (hz || 30)
      for (let t = 0; t < seconds - 1e-9; t += dt) sim(dt)
    },
    pause(on) {
      paused = on !== false
    },
    teleport, setView, lookAt, pickSlot, currentTarget, pressUse, pressTake, standUp, drainTank, fitAll, buildCords, wallBlocked, collides,
    setQuality, setNight, setRain, setWind, setPanel,
    seatEye,
    hud() {
      hudTimer = 0
      updateHud(0.001)
    },
    drawCalls: () => lastCalls,
    itemCount: () => itemCount,
    /** Walks by input for `seconds` with a world-space direction (dx, dz), through the same collision as the keyboard. */
    walk(dx, dz, seconds) {
      const yawSave = player.yaw
      player.yaw = Math.atan2(-dx, -dz)
      keys.add('KeyW')
      const dt = 1 / 30
      for (let t = 0; t < seconds; t += dt) sim(dt)
      keys.delete('KeyW')
      player.yaw = yawSave
      updateCamera()
    },
    showToast,
  }

  start()
})()
