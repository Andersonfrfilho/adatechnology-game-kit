// Spec 004 T0.1 prototype: the third-person body seen from inside. Opens the test room with the player area, shows the body in first person with the
// camera at the eyes of the body, and measures what the spec has to decide: the eye height in each pose next to today's camera, which parts of the body
// come near the lens as the view turns, and the head hidden two ways (a layer, a material that writes no colour). Prints JSON; `--shots <dir>` saves a
// picture of each view. Run after `pnpm build` and `node build.mjs` in examples/test-room (and the interactables area for the seats).
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const page = join(here, '../test-room/dist/test-room.html')
const require = createRequire(import.meta.url)
const playwright = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean).map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright || !existsSync(page)) {
  console.log('skipped (no playwright or no room page)')
  process.exit(0)
}
const shotsAt = process.argv.indexOf('--shots')
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null
if (shots) mkdirSync(shots, { recursive: true })

const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
tab.on('pageerror', (error) => errors.push(String(error)))
await tab.goto(`${pathToFileURL(page).href}?lang=pt-BR&ui=0`)
await tab.waitForFunction(() => window.__testRoom, null, { timeout: 180000 })
await tab.evaluate(() => window.__testRoom.waitUntilReady())

// the prototype's hooks: the eye of the body and the two ways to hide the head, installed on the page
await tab.evaluate(() => {
  const T = window.__THREE
  const room = window.__testRoom
  const avatar = room.avatar.avatar
  const rig = avatar.rig
  const Hd = rig.headG.children[0]
  // the eyes of the builder, in the head's own frame (best-builder: eyes at y 1.815, z about 0.16)
  const EYES = new T.Vector3(0, 1.815, 0.16)
  const neck = []
  rig.upper.traverse((o) => { if (o.isMesh && o.geometry?.type === 'CylinderGeometry' && o.parent !== null && !rig.headG.getObjectById(o.id) && Math.abs(o.position.y - 1.7) < 0.08 && Math.abs(o.position.x) < 0.01) neck.push(o) })
  const headMeshes = []
  rig.headG.traverse((o) => { if (o.isMesh) headMeshes.push(o) })
  const hidden = [...headMeshes, ...neck]
  const original = new Map(hidden.map((m) => [m, m.material]))
  window.__proto = {
    neckFound: neck.length,
    headMeshes: headMeshes.length,
    eye() {
      avatar.root.updateMatrixWorld(true)
      return Hd.localToWorld(EYES.clone())
    },
    hide(way) {
      for (const m of hidden) {
        m.layers.set(0)
        m.material = original.get(m)
        if (way === 'layer') m.layers.set(5)
        if (way === 'material') {
          const list = Array.isArray(m.material) ? m.material : [m.material]
          const clones = list.map((mat) => Object.assign(mat.clone(), { colorWrite: false, depthWrite: false }))
          m.material = Array.isArray(m.material) ? clones : clones[0]
        }
      }
    },
    nearest(camera) {
      const out = []
      const box = new T.Box3()
      avatar.root.updateMatrixWorld(true)
      avatar.root.traverse((o) => {
        if (!o.isMesh || hidden.includes(o)) return
        box.setFromObject(o)
        const d = box.distanceToPoint(camera.position)
        out.push({ d, at: o.parent === rig.arms[0].el || o.parent === rig.arms[1].el ? 'forearm' : rig.upper.getObjectById(o.id) ? 'upper' : rig.legs.some((l) => l.g.getObjectById(o.id)) ? 'leg' : 'other' })
      })
      return out.sort((a, b) => a.d - b.d).slice(0, 3).map((x) => ({ at: x.at, d: Math.round(x.d * 1000) / 1000 }))
    },
  }
})

const measure = (label, setup) =>
  tab.evaluate(
    ([label, setup]) => {
      const room = window.__testRoom
      room.setCameraMode('first')
      room.setAvatarState({ crouch: false, down: false })
      if (room.seat) room.stand()
      // eslint-disable-next-line no-new-func
      new Function('room', setup)(room)
      for (let i = 0; i < 90; i++) room.update(1 / 60)
      const camera = room.camera
      const eye = window.__proto.eye()
      const feet = room.playerPosition
      return { label, roomEye: +(camera.position.y - feet[1]).toFixed(3), bodyEye: +(eye.y - feet[1]).toFixed(3), bodyEyeAhead: +Math.hypot(eye.x - camera.position.x, eye.z - camera.position.z).toFixed(3) }
    },
    [label, setup],
  )

const poses = []
poses.push(await measure('standing', ''))
poses.push(await measure('crouched', "room.setAvatarState({ crouch: true })"))
poses.push(await measure('down', "room.setAvatarState({ down: true })"))
poses.push(await measure('sitting (armchair)', "const so = room.spawn('armchair', [3, 0, 3], 0); room.look([3, 1.7, 4.6], [3, 0.5, 3]); room.sit(so.objectId)"))
poses.push(await measure('lying (bed)', "const so = room.spawn('bed_double', [-3, 0, 3], 0); room.look([-3, 1.7, 5.2], [-3, 0.5, 3]); room.sit(so.objectId)"))

// near the lens: the camera at the body's eye, looking around, the body drawn in first person
const lens = await tab.evaluate(() => {
  const room = window.__testRoom
  if (room.seat) room.stand()
  room.setAvatarState({ crouch: false, down: false })
  for (let i = 0; i < 30; i++) room.update(1 / 60)
  const out = []
  for (const pitch of [-1.4, -0.9, -0.4, 0, 0.6, 1.2]) {
    for (const turn of [0, 0.8]) {
      const p = room.playerPosition
      const yaw = turn
      room.look([p[0], 1.7, p[2]], [p[0] - Math.sin(yaw), 1.7 + Math.tan(pitch), p[2] - Math.cos(yaw)])
      for (let i = 0; i < 10; i++) room.update(1 / 60)
      const eye = window.__proto.eye()
      const cam = room.camera.clone()
      cam.position.copy(eye)
      cam.updateMatrixWorld(true)
      out.push({ pitch, turn, nearest: window.__proto.nearest(cam) })
    }
  }
  return out
})

const result = { neckFound: await tab.evaluate(() => window.__proto.neckFound), headMeshes: await tab.evaluate(() => window.__proto.headMeshes), poses, lens, errors }

if (shots) {
  for (const way of ['none', 'layer', 'material']) {
    await tab.evaluate((way) => {
      const room = window.__testRoom
      window.__proto.hide(way)
      room.setCameraMode('first')
      room.avatar.root.visible = true
      const p = room.playerPosition
      room.look([p[0], 1.7, p[2]], [p[0], 0.2, p[2] - 1.2])
      for (let i = 0; i < 10; i++) room.update(1 / 60)
      const eye = window.__proto.eye()
      room.setDebugCamera({ position: [eye.x, eye.y, eye.z], target: [p[0], 0.2, p[2] - 1.2], fov: 75 })
      for (let i = 0; i < 4; i++) room.update(1 / 60)
    }, way)
    await tab.screenshot({ path: join(shots, `fp-body-${way}.png`) })
  }
}

console.log(JSON.stringify(result, null, 1))
await browser.close()
