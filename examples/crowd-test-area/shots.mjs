// The visual proof of the horde (T4b.9): renders the crowd area with the variety on, close and far, in Chrome with the real GPU, and prints what the room measured.
//   NODE_PATH=<playwright-core>/node_modules PERF_CHROME=/usr/bin/google-chrome-stable node shots.mjs <outDir> [count]
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2] ?? join(here, 'shots')
const count = Number(process.argv[3] ?? 2000)
mkdirSync(outDir, { recursive: true })
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const browser = await chromium.launch({
  args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--no-sandbox'],
  ...(process.env.PERF_CHROME ? { executablePath: process.env.PERF_CHROME } : {}),
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
await page.goto(`${pathToFileURL(join(here, 'dist/sala-multidao.html')).href}?variety=1&lang=en`)
await page.waitForFunction(() => window.__crowdReport, null, { timeout: 120000 })

// the room's panels float over the canvas: leave only the canvas on the picture
await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  for (const element of document.querySelectorAll('body *')) {
    if (element === canvas || element.contains(canvas) || canvas.contains(element) || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue
    if (getComputedStyle(element).position === 'fixed' || getComputedStyle(element).position === 'absolute') element.style.display = 'none'
  }
})
const view = (name, camera) =>
  page.evaluate(
    ({ camera, count }) => {
      const room = window.__testRoom
      const bench = room.bench('crowd_area')
      bench.set('count', count)
      const THREE = window.__THREE
      for (const child of room.camera.children) child.visible = false // the room's hand and viewmodel
      room.camera.position.set(camera.x, camera.y, camera.z)
      room.camera.lookAt(new THREE.Vector3(camera.lookAt.x, camera.lookAt.y, camera.lookAt.z))
      room.camera.updateMatrixWorld(true)
      for (let step = 0; step < camera.steps; step++) {
        room.camera.position.set(camera.x, camera.y, camera.z)
        room.camera.lookAt(new THREE.Vector3(camera.lookAt.x, camera.lookAt.y, camera.lookAt.z))
        room.camera.updateMatrixWorld(true)
        room.update(1 / 30)
      }
      room.webgl.info.autoReset = false
      room.webgl.info.reset()
      room.webgl.render(room.scene, room.camera)
      const calls = room.webgl.info.render.calls
      room.webgl.info.autoReset = true
      return { metrics: room.metrics().module, calls, triangles: room.webgl.info.render.triangles }
    },
    { camera, count },
  )
const near = await view('near', { x: 34, y: 1.7, z: -45, lookAt: { x: 0, y: 1.0, z: -45 }, steps: Number(process.env.NEAR_STEPS ?? 6) })
await page.waitForTimeout(500)
await page.screenshot({ path: join(outDir, 'horde-near.png') })
console.log('NEAR', JSON.stringify(near))
const far = await view('far', { x: 0, y: 30, z: 110, lookAt: { x: 0, y: 0, z: -45 }, steps: 1 })
await page.waitForTimeout(500)
await page.screenshot({ path: join(outDir, 'horde-far.png') })
console.log('FAR', JSON.stringify(far))
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)))
await browser.close()
