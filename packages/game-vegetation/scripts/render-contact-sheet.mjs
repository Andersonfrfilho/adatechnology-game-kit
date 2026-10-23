#!/usr/bin/env node
// Visual check helper (not published): renders a contact sheet PNG of species using the built IIFE bundles,
// three (r160, from node_modules) and headless Chromium via Playwright.
//
//   node scripts/render-contact-sheet.mjs out.png [--ids a,b,c] [--cols 6] [--lod 0] [--condition healthy]
//        [--season summer] [--seed 1] [--size 1800x1100] [--zoom 1] [--specs file.json] [--filter tag]
//        [--cell 3] [--yaw 0] [--pitch 50] [--fit]
//        [--group trees|palms|shrubs|flowers|cacti|succulents|vines|potted]
//
// Plants are rendered at TRUE relative scale (one shared scale, a 1.8 m reference pole in each cell) unless --fit is
// given (or neither --group nor --ids is used), which scales each plant to fill its own cell.
//
// Needs `pnpm build` first (packages/game-vegetation/dist/index.global.js and, unless --specs is used,
// packages/game-vegetation-species/dist/index.global.js). Chromium is expected at $PLAYWRIGHT_BROWSERS_PATH
// or /opt/pw-browsers/chromium; never run `playwright install` here.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')
const speciesDist = path.resolve(pkgRoot, '../game-vegetation-species/dist/index.global.js')
const engineDist = path.join(pkgRoot, 'dist/index.global.js')
const threeFile = path.join(pkgRoot, 'node_modules/three/build/three.module.js')

const args = process.argv.slice(2)
const out = args.find((a) => !a.startsWith('--')) ?? 'contact-sheet.png'
const opt = (name, def) => {
  const i = args.indexOf('--' + name)
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : def
}
const flag = (name) => args.includes('--' + name)

const cfg = {
  ids: opt('ids', ''),
  filter: opt('filter', ''),
  cols: Number(opt('cols', 0)),
  lod: Number(opt('lod', 0)),
  condition: opt('condition', 'healthy'),
  season: opt('season', ''),
  seed: opt('seed', '1'),
  zoom: Number(opt('zoom', 1)),
  cell: Number(opt('cell', 3)),
  yaw: Number(opt('yaw', 0)),
  pitch: Number(opt('pitch', 50)),
  group: opt('group', ''),
  fit: flag('fit'),
  fov: Number(opt('fov', 13)),
  specs: opt('specs', ''),
}
const [W, H] = opt('size', '1800x1100').split('x').map(Number)

function requirePlaywright() {
  const cands = [process.env.PLAYWRIGHT_MODULE, '/opt/node22/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)
  for (const c of cands) {
    try {
      return createRequire(import.meta.url)(c)
    } catch {}
  }
  throw new Error('playwright not found; set PLAYWRIGHT_MODULE')
}

const extraSpecs = cfg.specs
  ? cfg.specs.endsWith('.mjs')
    ? (await import(path.resolve(cfg.specs))).default
    : JSON.parse(fs.readFileSync(cfg.specs, 'utf8'))
  : null

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:#9fc7e8}
body{background:linear-gradient(#7fb4e6 0%,#bcd9ef 45%,#dfeadf 62%)}
canvas{display:block}
.lab{position:absolute;transform:translate(-50%,0);font:600 12px/1.15 system-ui,sans-serif;color:#10231a;background:rgba(255,255,255,.72);padding:1px 5px;border-radius:3px;white-space:nowrap;pointer-events:none}
.lab small{font-weight:400;color:#35503f}
</style></head><body><script src="/engine.js"></script>${extraSpecs ? '' : '<script src="/species.js"></script>'}
<script type="module">
import * as THREE from '/three.js'
const cfg = ${JSON.stringify(cfg)}
const W = ${W}, H = ${H}
const extra = ${JSON.stringify(extraSpecs)}
let list = []
if (extra) list = Object.entries(extra).map(([id, spec]) => ({ id, spec }))
else {
  const S = window.GameVegetationSpecies
  list = S.species.map((s) => ({ id: s.id, spec: S.toSpec ? S.toSpec(s) : { archetype: s.archetype, ...s.params }, tags: s.tags }))
}
if (cfg.ids) { const want = cfg.ids.split(','); list = want.map((id) => list.find((s) => s.id === id)).filter(Boolean) }
if (cfg.filter) list = list.filter((s) => (s.tags || []).includes(cfg.filter) || s.spec.archetype === cfg.filter)
const GROUPS = {
  trees: (s) => ['broadleaf_tree', 'conifer', 'dead_tree'].includes(s.spec.archetype),
  palms: (s) => ['palm', 'banana'].includes(s.spec.archetype),
  shrubs: (s) => s.spec.archetype === 'shrub',
  flowers: (s) => s.spec.archetype === 'flower_plant',
  cacti: (s) => /cactus/.test(s.spec.archetype),
  succulents: (s) => ['rosette', 'grass_tuft', 'fern'].includes(s.spec.archetype),
  vines: (s) => s.spec.archetype === 'vine',
  potted: (s) => s.spec.archetype === 'potted',
}
if (cfg.ids) { const want = cfg.ids.split(','); list = want.map((id) => list.find((s) => s.id === id)).filter(Boolean) }
if (cfg.group) list = list.filter(GROUPS[cfg.group])
if (cfg.filter) list = list.filter((s) => (s.tags || []).includes(cfg.filter) || s.spec.archetype === cfg.filter)
const fitMode = cfg.fit || (!cfg.group && !cfg.ids)
const n = list.length
const cols = cfg.cols || Math.ceil(Math.sqrt(n * (W / H) * 0.8))
const rows = Math.ceil(n / cols)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setSize(W, H)
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6b7a4a, 0.95))
const V = window.GameVegetation
const mats = V.createVegetationMaterials(THREE)
// generate everything first so the layout can use true sizes
const genOpts = (id) => { const o = { seed: cfg.seed + '', lod: cfg.lod, condition: cfg.condition, species: id }; if (cfg.season) o.season = cfg.season; return o }
const items = []
for (const it of list) {
  try { items.push({ it, plant: V.generate(it.spec, genOpts(it.id)) }) } catch (e) { console.log('ERR ' + it.id + ' ' + e.stack) }
}
let maxR = 0.1
for (const x of items) maxR = Math.max(maxR, x.plant.bounds.radius)
const S = fitMode ? cfg.cell : Math.max(1.2, maxR * 2.1)
const pr = (cfg.pitch * Math.PI) / 180
const rowH = []
for (let r = 0; r < rows; r++) {
  let h = 0
  for (const x of items.slice(r * cols, (r + 1) * cols)) h = Math.max(h, x.plant.bounds.height)
  rowH.push(fitMode ? S : h)
}
const rowZ = []
let zc = 0
for (let r = 0; r < rows; r++) {
  // gap in front of the previous row must keep this row's plants (rising on screen) off the previous row's labels
  const gap = fitMode ? S * 1.45 : Math.max(S * 1.3, rowH[r] * Math.cos(pr) / Math.sin(pr) * 1.02 + S * 0.7)
  zc += r === 0 ? 0 : gap
  rowZ.push(zc)
}
const gw = cols * S, gd = zc + S
const zOff = zc / 2
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4)
sun.position.set(-gw * 0.35, Math.max(gw, gd) * 0.9, gd * 0.55)
sun.target.position.set(0, 0, 0)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
const ext = Math.max(gw, gd) * 0.75
Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: Math.max(gw, gd) * 4 })
sun.shadow.bias = -0.0012
sun.shadow.normalBias = 0.09
scene.add(sun, sun.target)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw + 80, gd + 80), new THREE.MeshStandardMaterial({ color: 0x6f8f58, roughness: 1 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)
const labels = []
const info = []
const poleR = Math.max(0.05, S * 0.009)
items.forEach(({ it, plant }, i) => {
  const cx = ((i % cols) - (cols - 1) / 2) * S
  const cz = rowZ[Math.floor(i / cols)] - zOff
  const tile = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.47, S * 0.47, 0.04, 40), new THREE.MeshStandardMaterial({ color: (Math.floor(i / cols) + (i % cols)) % 2 ? 0xb9a47c : 0xc4b088, roughness: 1 }))
  tile.position.set(cx, 0.01, cz)
  tile.receiveShadow = true
  scene.add(tile)
  const obj = V.createPlantObject(THREE, plant, mats)
  const fit = Math.min((S * 1.0) / Math.max(0.2, plant.bounds.height), (S * 0.5) / Math.max(0.1, plant.bounds.radius)) * cfg.zoom
  const sc = fitMode ? Math.min(fit, 6) : cfg.zoom
  obj.scale.setScalar(sc)
  obj.position.set(cx, 0.02, cz)
  obj.rotation.y = cfg.yaw
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  scene.add(obj)
  if (!fitMode) {
    // 1.8 m human-height reference pole: 3 alternating bands of 0.6 m
    for (let b = 0; b < 3; b++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, 0.6, 8), new THREE.MeshStandardMaterial({ color: b % 2 ? 0xf2f2f2 : 0xd23b2f, roughness: 0.8 }))
      seg.position.set(cx - S * 0.4, 0.04 + 0.3 + b * 0.6, cz + S * 0.28)
      seg.castShadow = true
      scene.add(seg)
    }
  }
  info.push(it.id + ' tris=' + plant.triangleCount + ' h=' + plant.bounds.height.toFixed(2) + ' r=' + plant.bounds.radius.toFixed(2))
  labels.push({ pos: new THREE.Vector3(cx, 0, cz + S * 0.5), text: it.id, sub: plant.triangleCount + ' tris · ' + plant.bounds.height.toFixed(1) + 'm' })
})
const camera = new THREE.PerspectiveCamera(cfg.fov, W / H, 0.1, 500)
const pitch = (cfg.pitch * Math.PI) / 180
const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).normalize()
const corners = []
for (let r = 0; r < rows; r++) for (const x of [-gw / 2, gw / 2]) for (const [z, y] of [[rowZ[r] - zOff - S * 0.5, 0], [rowZ[r] - zOff + S * 0.75, 0], [rowZ[r] - zOff, rowH[r] * (fitMode ? 0.95 : 1.02)]]) corners.push(new THREE.Vector3(x, y, z))
const target = new THREE.Vector3(0, (fitMode ? S : Math.max(2, ...rowH)) * 0.15, 0)
let lo = 1, hi = 3000
for (let it = 0; it < 40; it++) {
  const mid = (lo + hi) / 2
  camera.position.copy(target).addScaledVector(dir, mid)
  camera.lookAt(target)
  camera.updateMatrixWorld(); camera.updateProjectionMatrix()
  const ok = corners.every((c) => { const p = c.clone().project(camera); return Math.abs(p.x) < 0.96 && Math.abs(p.y) < 0.94 })
  if (ok) hi = mid; else lo = mid
}
camera.position.copy(target).addScaledVector(dir, hi)
camera.lookAt(target)
camera.updateMatrixWorld()
mats.setWind && mats.setWind({ direction: [1, 0], strength: 0, gust: 0 })
mats.update && mats.update(0)
renderer.render(scene, camera)
for (const l of labels) {
  const p = l.pos.clone().project(camera)
  const d = document.createElement('div')
  d.className = 'lab'
  d.innerHTML = l.text + '<br><small>' + l.sub + '</small>'
  d.style.left = ((p.x + 1) / 2) * W + 'px'
  d.style.top = ((1 - p.y) / 2) * H + 'px'
  document.body.appendChild(d)
}
console.log(info.join('\\n'))
window.__done = true
</script></body></html>`

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0]
  const send = (file, type) => {
    try {
      res.writeHead(200, { 'content-type': type })
      res.end(fs.readFileSync(file))
    } catch {
      res.writeHead(404)
      res.end('missing ' + file)
    }
  }
  if (u === '/') {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(html)
  } else if (u === '/engine.js') send(engineDist, 'text/javascript')
  else if (u === '/species.js') send(speciesDist, 'text/javascript')
  else if (u === '/three.js') send(threeFile, 'text/javascript')
  else {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const { chromium } = requirePlaywright()
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-background-networking', '--no-proxy-server'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('console', (m) => console.log(m.text()))
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto(`http://127.0.0.1:${port}/`)
await page.waitForFunction('window.__done === true', null, { timeout: 120000 })
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
await page.screenshot({ path: out })
await browser.close()
server.close()
console.log('wrote', out)
