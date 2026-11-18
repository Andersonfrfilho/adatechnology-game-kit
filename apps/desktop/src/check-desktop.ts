// The desktop app driven by Playwright (`_electron.launch`), as the area pages are driven in Chromium: opens the app on --area, checks that the page is cross-origin
// isolated and which Jolt it booted, and writes the prints to apps/desktop/shots/. Opens a GPU window: never in CI nor in the pre-push (CLAUDE.md §9).
//   pnpm check:desktop                               the start menu, then the room on floorplan_area with the house, a C4 crater beside it, and the badge
//   pnpm check:desktop --area=weather_area           any area id (the room's ?area= or an example's id), print only
//   KIT_DESKTOP_SHOTS=/some/dir pnpm check:desktop   where the prints go
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron } from 'playwright-core'
import type { ElectronApplication, Page } from 'playwright-core'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const shots = resolve(process.env.KIT_DESKTOP_SHOTS ?? join(appDir, 'shots'))
const areaArg = process.argv.find((arg) => arg.startsWith('--area='))?.slice('--area='.length)
const area = areaArg ?? 'floorplan_area'
const isCraterRun = areaArg === undefined || area === 'floorplan_area'
const electronBinary = createRequire(join(appDir, 'package.json'))('electron') as unknown as string
const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

type PageState = { isolated: boolean; jolt: unknown; hasRoom: boolean }

const launch = async (launchArea: string | undefined): Promise<{ electron: ElectronApplication; page: Page }> => {
  const electron = await _electron.launch({ executablePath: electronBinary, args: [appDir, ...(launchArea ? [`--area=${launchArea}`] : [])], env: { ...process.env } as Record<string, string> })
  const page = await electron.firstWindow()
  await page.setViewportSize({ width: 1600, height: 900 })
  return { electron, page }
}

const stateOf = (page: Page): Promise<PageState> =>
  page.evaluate(() => {
    const host = window as unknown as { __testRoom?: unknown; __joltInfo?: unknown }
    return { isolated: self.crossOriginIsolated === true, jolt: host.__joltInfo ?? null, hasRoom: Boolean(host.__testRoom) }
  })

const shootMenu = async (): Promise<void> => {
  const { electron, page } = await launch(undefined)
  await page.waitForSelector('h1', { timeout: 60000 })
  // the first start reads the room's areas in a hidden window; the menu reloads itself when they come
  await page.waitForFunction(() => document.querySelectorAll('a.card').length > 3, null, { timeout: 600000 }).catch(() => undefined)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(shots, 'desktop-menu.png') })
  console.log(`check-desktop: menu, ${await page.locator('a.card').count()} entries, isolated ${(await stateOf(page)).isolated}`)
  await electron.close()
}

/** In the page: the house built from the floorplan bench, then a C4 on the nearest loose ground beside it, the camera on it. Returns the charge point. */
const buildHouseAndBlast = async (page: Page): Promise<number[]> => {
  await page.evaluate(() => {
    type Bench = { set(key: string, value: unknown): void; act(name: string): void }
    const room = (window as unknown as { __testRoom: { bench(id: string): Bench | null } }).__testRoom
    const bench = room.bench('floorplan_area')
    if (!bench) throw new Error('no floorplan bench')
    bench.set('package', 'residential')
    bench.set('template', 'single_storey_a')
    bench.set('seed', 1)
    bench.act('build')
  })
  await wait(9000)
  return page.evaluate(() => {
    type Room = {
      world: { serialize(): { objects: { id: string; state: { position: number[] } }[] } }
      terrain: { bounds: number[]; columnAt(x: number, z: number): { material: string }; material(id: string): { reposeDegrees?: number }; heightAt(x: number, z: number): number }
      look(eye: number[], target: number[]): void
      blastAt(weapon: string, point: number[]): boolean
    }
    const room = (window as unknown as { __testRoom: Room }).__testRoom
    const house = room.world.serialize().objects.find((object) => object.id === 'house3d:1')
    const [hx = 0, , hz = 0] = house?.state.position ?? [0, 0, 0]
    const [minX = 0, minZ = 0, maxX = 0, maxZ = 0] = room.terrain.bounds
    const loose = (x: number, z: number): boolean => x > minX && x < maxX && z > minZ && z < maxZ && room.terrain.material(room.terrain.columnAt(x, z).material).reposeDegrees !== undefined
    let best: number[] | undefined
    let bestDistance = Infinity
    for (let dx = -16; dx <= 16; dx += 0.5) for (let dz = -16; dz <= 16; dz += 0.5) {
      const x = hx - 2.5 + dx, z = hz + dz
      const distance = Math.hypot(dx, dz)
      if (distance < bestDistance && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox = 0, oz = 0]) => loose(x + ox, z + oz))) {
        best = [x, room.terrain.heightAt(x, z) + 0.1, z]
        bestDistance = distance
      }
    }
    if (!best) throw new Error('no loose ground near the house')
    const [x = 0, y = 0, z = 0] = best
    room.look([x + 7, y + 5, z + 7], [x, y, z])
    room.blastAt('c4', best)
    return best
  })
}

const shootRoom = async (): Promise<void> => {
  const { electron, page } = await launch(area)
  await page.waitForFunction(() => Boolean((window as unknown as { __testRoom?: unknown }).__testRoom), null, { timeout: 600000 })
  await page.waitForFunction(() => document.getElementById('kit-desktop-badge') !== null, null, { timeout: 60000 })
  await page.waitForTimeout(2000)
  const state = await stateOf(page)
  writeFileSync(join(shots, 'desktop-state.json'), `${JSON.stringify({ area, ...state }, null, 2)}\n`)
  console.log(`check-desktop: ${area}: crossOriginIsolated ${state.isolated}, jolt ${JSON.stringify(state.jolt)}`)
  await page.screenshot({ path: join(shots, `desktop-${area}-badge.png`) })
  if (isCraterRun) {
    const point = await buildHouseAndBlast(page)
    await page.waitForTimeout(350)
    await page.screenshot({ path: join(shots, 'desktop-crater-explosion.png') })
    await page.waitForTimeout(5000)
    await page.screenshot({ path: join(shots, 'desktop-crater-after.png') })
    console.log(`check-desktop: C4 at ${point.map((value) => value.toFixed(1)).join(', ')}, prints in ${shots}`)
  }
  const errors = await page.evaluate(() => (window as unknown as { __errors?: unknown[] }).__errors?.length ?? 0)
  await electron.close()
  if (!state.isolated) throw new Error('the app page is not cross-origin isolated')
  if (errors) console.log(`check-desktop: ${errors} page errors recorded`)
}

mkdirSync(shots, { recursive: true })
if (areaArg === undefined) await shootMenu()
await shootRoom()
