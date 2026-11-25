// The hands and the weapon in the real room (owner, 2026-11-25), in third and first person: with a rifle in the hands, E on a bottle swings the rifle onto its sling
// (seen, the hand on its grip), then the hand reaches the bottle, closes on it and lifts it; the rifle hangs on the chest; H brings it back. A pistol in the hands before both
// hands take a big thing goes to the hip holster. Prints the measures and saves shots/hands-*.png.
// Run: node build.mjs && node hands-test.mjs [url]   (default dist/test-room.html; GPU flags as tools/gpu/room-explosion.mjs; outside CI, CLAUDE.md §9)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = /** @type {typeof import('playwright')} */ (createRequire(import.meta.url)('playwright')) // NODE_PATH points at it, as in test.mjs
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : pathToFileURL(join(here, 'dist/test-room.html')).href

const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
// the owner's page: hands and holster with a hip holster and the back (the rifle brings its own sling)
await page.goto(`${base}?bodySlots=hip,back&table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && typeof window.__testRoom.spawn === 'function', null, { timeout: 240000 })
await page.waitForTimeout(3000)

/** @type {string[]} */
const failures = []
const check = (/** @type {unknown} */ ok, /** @type {string} */ label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
const shot = (/** @type {string} */ name) => page.screenshot({ path: join(shots, `hands-${name}.png`), timeout: 60000 })
/** Runs `code` with the room as `r` and `arg` as `a`. */
const room = (/** @type {string} */ code, /** @type {unknown} */ arg = null) => page.evaluate(({ c, a }) => new Function('r', 'a', c)(window.__testRoom, a), { c: code, a: arg })
/** The first of `ids` the catalogue has, once the teams' modules loaded it. */
const pick = async (/** @type {string[]} */ ids) => {
  const found = await page.waitForFunction((list) => list.find((id) => window.__testRoom.measure(id)), ids, { timeout: 240000, polling: 500 }).catch(() => null)
  const id = found ? await found.jsonValue() : null
  if (typeof id !== 'string') throw new Error(`none of ${ids.join(', ')} in the catalogue`)
  return id
}
const tap = async (/** @type {string} */ code) => {
  await page.keyboard.down(code)
  await page.waitForTimeout(40)
  await page.keyboard.up(code)
}
/** The hands now: the targets the body reaches and what is in the hands. */
const hands = () => room('const h = r.handState(); return { stance: h.stance, R: h.targets?.R?.position ?? null, L: h.targets?.L?.position ?? null, grip: h.targets?.grip ?? null, gripL: h.targets?.gripL ?? null, tool: r.tool.def.id }')
const logged = (/** @type {string} */ type) => room('return r.log.entries().filter((e) => e.type === a).length', type)

const bottle = await pick(['item_glass_bottle', 'item_water_bottle', 'item_pet_bottle', 'item_plastic_bottle'])
const table = await pick(['item_camp_table', 'camp_table'])
console.log('bottle', bottle, 'table', table)

for (const mode of /** @type {const} */ (['third', 'first'])) {
  console.log(`--- ${mode} person`)
  await room('r.clear(); r.setSlowMotion(false)')
  const tableSize = await room('return r.measure(a)', table)
  await room('r.spawn(a.table, [0, 0, 2.2], 0); r.spawn(a.bottle, [0.18, a.h + 0.02, 2.35], 0)', { table, bottle, h: tableSize.h })
  await page.waitForTimeout(1500)
  // the aim finds the bottle from the eye (the shoulder view's ray runs over it): aimed in first person, then the view of this run
  await room('r.setCameraMode("first")')
  await room('r.setTool("ak_47")')
  await room('r.look([0, 1.65, 3.05], [0.18, a, 2.35])', tableSize.h)
  await page.waitForTimeout(600)
  const aimed = await room('return r.inspectInfo()?.name ?? null')
  check(aimed === null || !/chão|floor|ground/i.test(aimed), `${mode}: the aim is on the bottle`)
  await room('r.setCameraMode(a)', mode)
  await page.waitForTimeout(900)
  const before = await hands()
  check(before.tool === 'ak_47', `${mode}: the rifle is in the hands (${before.tool})`)
  await shot(`${mode}-0-rifle-in-hands`)
  // a quarter of the speed, so the shots catch each step
  await room('r.setSlowMotion(true)')
  await room('r.setCameraMode("first")')
  await tap('KeyE')
  await room('r.setCameraMode(a)', mode)
  // third person: seen from in front and to the side, across the table, the whole body and both hands in the frame
  if (mode === 'third') await room('r.setDebugCamera({ position: [1.7, 1.7, 1.2], target: [0, 1.0, 3.0] })')
  // stepped in short runs and paused to look: the rifle on its way to the sling (the right hand on it), then the hand on its way to the bottle, open, nothing held yet
  const grabsBefore = await logged('grab')
  let stowing = null
  let reached = false
  await room('r.pause()')
  for (let i = 0; i < 80 && !reached; i++) {
    await room('r.resume()')
    await page.waitForTimeout(60)
    await room('r.pause()')
    const state = await room('const t = r.handState().targets; return { grab: r.log.entries().filter((e) => e.type === "grab").length > a, reach: !!(t?.L || t?.R) && (t.gripL ?? t.grip ?? 1) < 0.3, moving: r.tool.def.id === "hand" && !!t?.R && (t.grip ?? 0) > 0.8 && !t?.L }', grabsBefore)
    if (process.env.HANDS_DEBUG) console.log(i, JSON.stringify(state))
    if (state.grab) break
    if (state.moving && !stowing) {
      stowing = await hands()
      await shot(`${mode}-1-rifle-to-sling`)
    }
    reached = state.reach
  }
  check(stowing !== null, `${mode}: the rifle is seen going to the sling with the right hand on its grip (R ${JSON.stringify(stowing?.R)})`)
  check(reached, `${mode}: the hand is seen on its way to the bottle, open, before it is held`)
  if (reached) await shot(`${mode}-2-hand-reaches-bottle`)
  await room('r.resume()')
  await page.waitForFunction((n) => window.__testRoom.log.entries().filter((e) => e.type === 'grab').length > n, grabsBefore, { timeout: 20000 })
  await page.waitForTimeout(2000)
  await room('r.setSlowMotion(false)')
  await page.waitForTimeout(800)
  await room('r.setDebugCamera(null)')
  const holding = await hands()
  const measured = await room(`
    const held = r.spawned().find((s) => s.itemId === a)
    const h = r.handState().targets
    const palm = h?.L?.position ?? h?.R?.position
    const p = held.root.position
    return { root: [p.x, p.y, p.z], palm, gap: palm ? Math.hypot(p.x - palm[0], p.y - palm[1], p.z - palm[2]) : null }`, bottle)
  console.log('held', JSON.stringify(measured), JSON.stringify(holding))
  check((await logged('hands_sling')) >= 1, `${mode}: the log says the rifle went onto its sling`)
  check(measured.gap !== null && measured.gap < 0.25, `${mode}: the bottle is at the palm (its origin ${measured.gap?.toFixed(3)} m from the palm's middle)`)
  check((holding.gripL ?? holding.grip ?? 0) > 0.6, `${mode}: the fingers are closed on it (${holding.gripL ?? holding.grip})`)
  await shot(`${mode}-3-holding-bottle`)
  if (mode === 'third') {
    // from the front, to see the rifle hanging on the chest
    const at = await room('return r.playerPosition')
    await room('r.setDebugCamera({ position: [a[0] + 0.7, 1.45, a[2] - 1.5], target: [a[0], 1.05, a[2]] })', at)
    await page.waitForTimeout(400)
    await shot(`${mode}-4-rifle-on-sling-front`)
    await room('r.setDebugCamera(null)')
  } else {
    // looking down at the chest: the rifle hangs on the sling
    const at = await room('return r.playerPosition')
    await room('r.look([a[0], 1.65, a[2]], [a[0] - 0.1, 0.6, a[2] - 0.6])', at)
    await page.waitForTimeout(500)
    await shot(`${mode}-4-rifle-on-sling-look-down`)
  }
  // H: the bottle is let go and the rifle comes back from the sling to the hands, the right hand on it all the way (stepped and paused to look)
  if (mode === 'third') {
    const at = await room('return r.playerPosition')
    await room('r.setDebugCamera({ position: [a[0] + 1.0, 1.55, a[2] - 1.6], target: [a[0], 1.05, a[2]] })', at)
  }
  await room('r.setSlowMotion(true)')
  await tap('KeyH')
  let drawing = false
  for (let i = 0; i < 80; i++) {
    await room('r.pause()')
    const state = await room('const t = r.handState().targets; return { tool: r.tool.def.id, R: !!t?.R }')
    if (state.tool === 'ak_47') break
    if (state.tool === 'hand' && state.R && !drawing && i > 2) {
      drawing = true
      await shot(`${mode}-5-rifle-coming-back`)
    }
    await room('r.resume()')
    await page.waitForTimeout(60)
  }
  await room('r.resume(); r.setSlowMotion(false)')
  check(drawing, `${mode}: the rifle is seen coming back from the sling with the right hand on it`)
  await page.waitForFunction(() => window.__testRoom.tool.def.id === 'ak_47', null, { timeout: 20000 }).catch(() => undefined)
  await page.waitForTimeout(800)
  await shot(`${mode}-6-rifle-back-in-hands`)
  await room('r.setDebugCamera(null)')
  check((await hands()).tool === 'ak_47', `${mode}: H brings the rifle back to the hands`)
}

// a pistol before both hands take a big thing: it goes to the hip holster, seen, and comes back when the hands let go
await room('r.clear(); r.setSlowMotion(false); r.setCameraMode("third")')
// the camp table: longer than a hand carries alone, so both hands take it
await room('r.spawn(a, [0, 0, 3.4], 0)', table)
await room('r.setTool("glock_17")')
await page.waitForTimeout(800)
await room('r.setCameraMode("first"); r.look([0, 1.65, 4.4], [0, 0.6, 3.5])')
await page.waitForTimeout(800)
await room('r.setSlowMotion(true)')
await tap('KeyE')
await room('r.setCameraMode("third"); r.setDebugCamera({ position: [1.3, 1.25, 4.9], target: [0, 0.9, 4.4] })')
await page.waitForTimeout(800)
await shot('third-7-pistol-to-holster')
await page.waitForTimeout(1200)
await shot('third-8-pistol-holstered-both-hands')
await room('r.setDebugCamera(null)')
await room('r.setSlowMotion(false)')
await page.waitForTimeout(2500)
console.log('pistol', JSON.stringify(await room('return r.log.entries().filter((e) => e.type.startsWith("hands_")).map((e) => e.type + ": " + e.text)')))

console.log('errors', JSON.stringify(errors.slice(0, 5)))
await browser.close()
if (failures.length > 0) {
  console.log(`${failures.length} failed`)
  process.exitCode = 1
}
