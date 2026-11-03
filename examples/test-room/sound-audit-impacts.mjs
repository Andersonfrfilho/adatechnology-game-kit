// Sound audit of material impacts in the real test room: one slab per destruction material, hit with a 9 mm shot, a punch, a kick, a knife and a
// blast. For each action it records the destruction events and every sound the room's engine was asked to play (id, delay from the event, volume),
// so the sound can be checked against the material and the kind of blow (criteria C1, C2, C9 of the sound checklist). A picture of each slab after the hits.
// Run: node build.mjs && node sound-audit-impacts.mjs [--url http://localhost:4280/test-room.html] [--out shots/sound-audit] [--only steel,glass]
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = (() => {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      // next
    }
  }
  throw new Error('playwright not found')
})()
const opt = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const outDir = opt('out', join(here, 'shots/sound-audit'))
const base = opt('url', pathToFileURL(join(here, 'dist/test-room.html')).href)
const materials = JSON.parse(readFileSync(join(here, '../../packages/game-destruction/src/data/materials.json'), 'utf8'))
const all = (Array.isArray(materials) ? materials : (materials.materials ?? Object.values(materials))).map((m) => m.id)
const only = opt('only', '').split(',').filter(Boolean)
const ids = only.length ? all.filter((m) => only.includes(m)) : all
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}${base.includes('?') ? '&' : '?'}ui=0&table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && window.__furnitureReport, null, { timeout: 600000 })

await page.evaluate((mats) => {
  const room = window.__testRoom
  const A = (window.__snd = { sounds: [], events: [] })
  room.audio.unlock()
  const play = room.audio.play.bind(room.audio)
  room.audio.play = (id, o) => {
    const v = play(id, o)
    A.sounds.push({ id, t: performance.now(), volume: o?.volume ?? 1, played: !!v, position: o?.position ? [...o.position] : null })
    return v
  }
  room.world.on('*', (e) => {
    if (['dent', 'hole', 'crack', 'fracture', 'chip', 'stage', 'ricochet', 'damage'].includes(e.type)) { if (A.so && e.object !== A.so.objectId) return; A.events.push({ type: e.type, t: performance.now(), damageType: e.damageType, style: e.style }) }
  })
  const tone = (m) => {
    let h = 0
    for (const c of m) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return 0x404040 + (h & 0x7f7f7f)
  }
  room.loadModule({
    id: 'sound_material_slabs',
    name: 'Placas por material',
    group: 'Placas por material',
    items: () =>
      mats.map((m) => ({
        id: `slab_${m}`,
        name: m,
        movable: false,
        build: (T) => {
          const g = new T.Group()
          const mesh = new T.Mesh(new T.BoxGeometry(0.8, 1, 0.1), new T.MeshStandardMaterial({ color: tone(m) }))
          mesh.position.y = 0.5
          mesh.name = m
          mesh.userData.destructionMaterial = m
          g.add(mesh)
          return g
        },
      })),
  })
  A.at = [-7, 0, -6]
  A.fresh = (m) => {
    room.clear()
    room.setDebugCamera(null)
    A.so = room.spawn(`slab_${m}`, A.at, 0)
    A.sounds.length = 0
    A.events.length = 0
    return A.so.objectId
  }
  A.aim = (tool, dist = 2.5, y = 0.6) => {
    room.setTool(tool)
    room.look([A.at[0], 1.6, A.at[2] + dist], [A.at[0], y, A.at[2]])
  }
  A.material = () => room.world.state(A.so.objectId)?.parts.map((p) => p.material)
}, all)

const sleep = (ms) => page.waitForTimeout(ms)
const collect = () =>
  page.evaluate(() => {
    const A = window.__snd
    const t0 = A.events[0]?.t ?? A.sounds[0]?.t ?? 0
    return {
      events: A.events.map((e) => ({ ...e, t: Math.round(e.t - t0) })),
      // only what sounded at the slab (a blast also reaches the room's scenery)
      sounds: A.sounds.filter((s) => !s.position || Math.hypot(s.position[0] - A.at[0], s.position[2] - A.at[2]) < 1.5).map((s) => ({ ...s, t: Math.round(s.t - t0), volume: Math.round(s.volume * 100) / 100 })),
      others: A.sounds.length,
      parts: A.material(),
      stats: window.__testRoom.audio.stats(),
    }
  })

async function act(m, kind) {
  await page.evaluate((mm) => window.__snd.fresh(mm), m)
  await sleep(300)
  if (kind === 'shot' || kind === 'kick') {
    await page.evaluate((k) => window.__snd.aim(k === 'shot' ? 'pistol_9mm' : 'kick', k === 'shot' ? 3 : 0.6, k === 'shot' ? 0.6 : 0.45), kind)
    await page.evaluate(() => window.__testRoom.waitUntilReady(5))
    await sleep(200)
    await page.evaluate(() => {
      window.__snd.sounds.length = 0
      window.__snd.events.length = 0
      return window.__testRoom.use(0)
    })
  } else {
    await page.evaluate((k) => window.__testRoom.testTable.trial(k, window.__snd.so.objectId), kind)
  }
  await sleep(kind === 'blast' ? 2500 : 1200)
  return collect()
}

const report = { url: base, at: new Date().toISOString(), materials: {}, errors }
for (const m of ids) {
  const r = {}
  for (const kind of ['shot', 'punch', 'kick', 'stab', 'blast']) {
    try {
      r[kind] = await act(m, kind)
    } catch (e) {
      r[kind] = { error: String(e.message ?? e) }
    }
    if (kind === 'shot') {
      await page.evaluate(() => window.__testRoom.setDebugCamera({ position: [-6.2, 1.1, -4.9], target: [-7, 0.55, -6], fov: 50 }))
      await sleep(300)
      await page.screenshot({ path: join(outDir, `${m}-tiro.png`) })
    }
  }
  report.materials[m] = r
  const tally = (list) => Object.entries(list.reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {})).map(([k, n]) => (n > 1 ? `${k}x${n}` : k)).join(' ')
  const brief = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.error ?? `ev[${tally((v.events ?? []).map((e) => e.type + (e.damageType ? ':' + e.damageType : '')))}] snd[${tally((v.sounds ?? []).map((s) => s.id))}] first=${v.sounds?.[0]?.t ?? '-'}ms`]))
  console.log(m, JSON.stringify(brief))
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 1))
await browser.close()
