// Audit of one object against the physics criteria of docs/criterios-fisica-objetos.md, in the real test room (dist/test-room.html).
// For each action (shot high and low, punch, kick, knife, flame, blast, grab and throw, use, among other objects, the player walking into it, persistence)
// it records what the destruction world and the room reported (events by type, holes, dents, cracks, broken parts, burning, how far the object moved),
// the room metrics before and at the peak (frame time, draw calls, fragments, particles, decals) and a picture.
// Run: node build.mjs && node audit.mjs <itemId> [--out shots/audit] [--url http://localhost:4280/test-room.html]
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = (() => {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* next */
    }
  }
  throw new Error('playwright not found')
})()

const args = process.argv.slice(2)
const itemId = args.find((a) => !a.startsWith('--'))
if (!itemId) throw new Error('usage: node audit.mjs <itemId> [--out dir] [--url url] [--only a,b]')
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const outDir = opt('out', join(here, 'shots/audit', itemId))
const base = opt('url', pathToFileURL(join(here, 'dist/test-room.html')).href)
const only = opt('only', '')
  .split(',')
  .filter(Boolean)
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}${base.includes('?') ? '&' : '?'}ui=0&table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && window.__furnitureReport, null, { timeout: 600000 })

// helpers inside the page
await page.evaluate(() => {
  const room = window.__testRoom
  const A = (window.__audit = {})
  A.spawnAt = [-7, 0, -6]
  A.fresh = (id, extra = []) => {
    room.clear()
    room.setDebugCamera(null)
    const so = room.spawn(id, A.spawnAt, 0)
    const others = extra.map(([eid, pos]) => room.spawn(eid, pos, 0))
    A.so = so
    so.root.updateMatrixWorld(true)
    const b0 = new window.__THREE.Box3().setFromObject(so.root)
    A.box0 = { min: b0.min.toArray(), max: b0.max.toArray() }
    A.others = others
    A.start = room.root ? null : [so.root.position.x, so.root.position.y, so.root.position.z]
    room.log.clear()
    return { objectId: so.objectId, movable: so.movable }
  }
  A.box = () => {
    const box = new window.__THREE.Box3().setFromObject(A.so.root)
    return { min: box.min.toArray(), max: box.max.toArray() }
  }
  A.state = () => {
    const st = room.world.state(A.so.objectId)
    if (!st) return { gone: true }
    const parts = st.parts
    const count = (k) => parts.reduce((n, p) => n + (p[k]?.length ?? 0), 0)
    const p = A.so.root.position
    const q = A.so.root.quaternion
    const tilt = (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI
    return {
      holes: count('holes'),
      dents: count('dents'),
      cracks: count('cracks'),
      broken: parts.filter((x) => x.status !== 'intact' && x.status !== 'damaged').map((x) => `${x.id}:${x.status}`),
      damaged: parts.filter((x) => x.hp < x.maxHp).length,
      burning: parts.filter((x) => x.burning).length,
      charred: parts.filter((x) => x.char > 0.05).length,
      melted: parts.filter((x) => x.melt > 0.05).length,
      maxTemp: Math.round(Math.max(...parts.map((x) => x.temperature))),
      pieces: st.groups.length,
      destroyed: st.destroyed,
      moved: Math.round(Math.hypot(p.x - A.spawnAt[0], p.z - A.spawnAt[2]) * 100) / 100,
      tiltDeg: Math.round(tilt),
    }
  }
  A.events = () => {
    const by = {}
    for (const e of room.log.entries()) by[`${e.channel}:${e.type}`] = (by[`${e.channel}:${e.type}`] ?? 0) + 1
    return by
  }
  A.metrics = () => room.metrics().room
  A.look3q = (dist = 2.4) => {
    const b = A.box0
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
    const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
    const d = Math.max(dist, size * 2.2)
    room.setDebugCamera({ position: [c[0] + d * 0.6, c[1] + d * 0.45, c[2] + d * 0.75], target: c, fov: 50 })
  }
})

const sleep = (ms) => page.waitForTimeout(ms)
/** Run `act` in the page, then sample the metrics every 100 ms for `seconds` (frame time at the peak, the most fragments and particles). */
async function measure(act, seconds = 2.5, arg) {
  const before = await page.evaluate(() => window.__audit.metrics())
  const cost = await page.evaluate(act, arg)
  const peak = {}
  for (let t = 0; t < seconds * 10; t++) {
    await sleep(100)
    const m = await page.evaluate(() => window.__audit.metrics())
    for (const [k, v] of Object.entries(m)) if (typeof v === 'number' && k !== 'fps') peak[k] = Math.max(peak[k] ?? 0, v)
  }
  return { before, peak, cost }
}

const report = { itemId, steps: {}, errors }
async function step(name, fn) {
  if (only.length && !only.includes(name)) return
  const t0 = Date.now()
  try {
    report.steps[name] = await fn()
  } catch (e) {
    report.steps[name] = { error: String(e.message ?? e) }
  }
  report.steps[name].seconds = Math.round((Date.now() - t0) / 100) / 10
  console.log(name, JSON.stringify(report.steps[name]))
}
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`), timeout: 180000 })
const snap = async (name, dist) => {
  await page.evaluate((d) => window.__audit.look3q(d), dist)
  await sleep(300)
  await shot(name)
}
const fresh = (extra) => page.evaluate(([id, ex]) => window.__audit.fresh(id, ex), [itemId, extra ?? []])
const result = async (name, m, dist) => {
  const out = { state: await page.evaluate(() => window.__audit.state()), events: await page.evaluate(() => window.__audit.events()), perf: m }
  await snap(name, dist)
  return out
}

const info = await fresh()
report.info = { ...info, ...(await page.evaluate(() => {
  const st = window.__testRoom.world.state(window.__audit.so.objectId)
  const mats = {}
  for (const p of st.parts) mats[p.material] = Math.round(((mats[p.material] ?? 0) + p.mass) * 100) / 100
  return { parts: st.parts.length, massKg: Math.round(st.parts.reduce((m, p) => m + p.mass, 0) * 10) / 10, materials: mats, clips: (window.__testRoom.animations?.() ?? null) }
})) }
console.log('info', JSON.stringify(report.info))
await snap('00-inteiro')

const trial = (kind) => async () => {
  await fresh()
  const m = await measure((k) => {
    const t = performance.now()
    window.__testRoom.testTable.trial(k, window.__audit.so.objectId)
    return Math.round((performance.now() - t) * 10) / 10
  }, kind === 'fire' ? 4 : 2.5, kind)
  return result(`trial-${kind}`, m)
}
// a shot aimed at a height: `h` 0..1 of the object's height, from 3 m in front
const shotAt = (h, weapon) => async () => {
  await fresh()
  await page.evaluate(([hh, w]) => {
    const A = window.__audit
    const room = window.__testRoom
    const b = A.box()
    const y = b.min[1] + (b.max[1] - b.min[1]) * hh
    const cx = (b.min[0] + b.max[0]) / 2
    room.setTool(w)
    room.look([cx, y, b.max[2] + 3], [cx, y, (b.min[2] + b.max[2]) / 2])
  }, [h, weapon])
  // the weapon is drawn first (the arsenal's draw time), as a player does
  await page.waitForFunction(() => { const t = window.__testRoom.tool; return !t._phase || t._phase.id !== "draw" }, null, { timeout: 30000 }).catch(() => {})
  await sleep(1500)
  const m = await measure(() => {
    const t = performance.now()
    window.__testRoom.use(0)
    return Math.round((performance.now() - t) * 10) / 10
  })
  await sleep(400)
  await shot(`tiro-${weapon}-${Math.round(h * 100)}-mira`)
  return result(`tiro-${weapon}-${Math.round(h * 100)}`, m)
}

await step('tiro_9mm_alto', shotAt(0.85, 'pistol_9mm'))
await step('tiro_9mm_baixo', shotAt(0.15, 'pistol_9mm'))
await step('tiro_fuzil_meio', shotAt(0.5, 'rifle_7_62x39'))
await step('soco', trial('punch'))
await step('chute', async () => {
  await fresh()
  await page.evaluate(() => {
    const A = window.__audit
    const room = window.__testRoom
    const b = A.box()
    const cx = (b.min[0] + b.max[0]) / 2
    const y = Math.min(b.max[1], b.min[1] + 0.45)
    room.setTool('kick')
    room.look([cx, 1.6, b.max[2] + 0.5], [cx, y, (b.min[2] + b.max[2]) / 2])
  })
  await page.waitForFunction(() => { const t = window.__testRoom.tool; return !t._phase || t._phase.id !== "draw" }, null, { timeout: 30000 }).catch(() => {})
  await sleep(1500)
  const m = await measure(() => {
    const t = performance.now()
    window.__testRoom.use(0)
    return Math.round((performance.now() - t) * 10) / 10
  })
  return result('chute', m)
})
await step('faca', trial('stab'))
await step('fogo', trial('fire'))
await step('explosao', trial('blast'))
await step('pegar_e_jogar', async () => {
  await fresh()
  const r = await page.evaluate(() => {
    const A = window.__audit
    const room = window.__testRoom
    const b = A.box()
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
    room.setTool('hand')
    room.look([c[0], 1.6, b.max[2] + 1.2], c)
    return { grabbed: room.grab() }
  })
  await sleep(600)
  await shot('pegar-segurando')
  const m = await measure(() => {
    const t = performance.now()
    window.__testRoom.throwHeld(6)
    return Math.round((performance.now() - t) * 10) / 10
  }, 3)
  return { ...r, ...(await result('pegar-jogado', m)) }
})
await step('usar', async () => {
  await fresh()
  const clips = await page.evaluate(() => {
    const room = window.__testRoom
    const A = window.__audit
    const b = A.box()
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
    room.look([c[0], 1.6, b.max[2] + 1.2], c)
    const info = room.animations()
    const ids = info?.clips?.map((x) => x.id) ?? []
    if (ids[0]) room.playAnimation(ids[0], A.so.objectId)
    return ids
  })
  await sleep(1500)
  return { clips, ...(await result('usar', { cost: 0 })) }
})
await step('entre_objetos', async () => {
  await fresh([
    ['trash_bin', [-6.2, 0, -6]],
    ['dining_chair', [-7.8, 0, -6]],
    ['nightstand', [-7, 0, -7.2]],
  ])
  const m = await measure(() => {
    const room = window.__testRoom
    const t = performance.now()
    room.testTable.trial('blast', window.__audit.so.objectId)
    return Math.round((performance.now() - t) * 10) / 10
  }, 3)
  const others = await page.evaluate(() => window.__audit.others.map((o) => ({ id: o.itemId, x: Math.round(o.root.position.x * 100) / 100, z: Math.round(o.root.position.z * 100) / 100 })))
  return { others, ...(await result('entre-objetos', m, 4)) }
})
await step('jogador_esbarra', async () => {
  await fresh()
  const r = await page.evaluate(() => {
    const room = window.__testRoom
    room.look([-7, 1.6, -4], [-7, 1.0, -6])
    room.walk([-7, 0, -9], 4)
    // the walk in simulated time, 60 steps a second (a software-rendered page runs a few frames a second)
    for (let i = 0; i < 300; i++) room.update(1 / 60)
    return true
  })
  await sleep(500)
  const player = await page.evaluate(() => window.__testRoom.camera.position.toArray().map((v) => Math.round(v * 100) / 100))
  return { walked: r, playerEnd: player, ...(await result('jogador-esbarra', { cost: 0 })) }
})
await step('empurrado_por_objeto', async () => {
  await fresh()
  const m = await measure(() => {
    const room = window.__testRoom
    room.spawn('item_cement_bag', [-7, 0, -4.5], 0)
    room.setTool('hand')
    room.look([-7, 1.6, -3.6], [-7, 0.1, -4.5])
    const grabbed = room.grab()
    room.look([-7, 1.6, -3.6], [-7, 0.4, -6])
    const t = performance.now()
    room.throwHeld(9)
    if (!grabbed) throw new Error('could not grab the cement bag')
    return Math.round((performance.now() - t) * 10) / 10
  }, 3)
  return result('empurrado-por-objeto', m)
})
await step('persistencia', async () => {
  await fresh()
  await page.evaluate(() => window.__testRoom.testTable.trial('blast', window.__audit.so.objectId))
  const samples = []
  for (const s of [1, 10, 30, 60, 120]) {
    const wait = s - (samples.at(-1)?.s ?? 0)
    await sleep(wait * 1000)
    samples.push({ s, ...(await page.evaluate(() => window.__audit.metrics())) })
  }
  return { samples, ...(await result('persistencia-120s', { cost: 0 })) }
})

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 1))
console.log(`\n${outDir}/report.json`, errors.length ? `page errors: ${errors.length}` : '')
await browser.close()
