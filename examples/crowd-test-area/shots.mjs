// The visual proof of the horde (T4b.9): renders the crowd area with the variety on, close and far, in Chrome with the real GPU, and prints what the room measured.
//   NODE_PATH=<playwright-core>/node_modules PERF_CHROME=/usr/bin/google-chrome-stable node shots.mjs <outDir> [count]
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

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
const errors = []
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.goto(`${pathToFileURL(join(here, 'dist/sala-multidao.html')).href}?variety=1&lang=en${process.env.CLIPS === '1' ? '&clips=1' : ''}`)
  await page.waitForFunction(() => window.__crowdReport, null, { timeout: 120000 })
  // the room's panels float over the canvas: leave only the canvas on the picture
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    for (const element of document.querySelectorAll('body *')) {
      if (element === canvas || element.contains(canvas) || canvas.contains(element) || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue
      if (getComputedStyle(element).position === 'fixed' || getComputedStyle(element).position === 'absolute') element.style.display = 'none'
    }
  })
  return page
}
const view = (page, camera) =>
  page.evaluate(
    ({ camera, count }) => {
      const room = window.__testRoom
      const bench = room.bench('crowd_area')
      bench.set('count', count)
      for (const child of room.camera.children) child.visible = false // the room's hand and viewmodel
      room.look([camera.x, camera.y, camera.z], [camera.lookAt.x, camera.lookAt.y, camera.lookAt.z])
      for (let step = 0; step < camera.steps; step++) {
        room.look([camera.x, camera.y, camera.z], [camera.lookAt.x, camera.lookAt.y, camera.lookAt.z])
        room.update(1 / 30)
      }
      room.camera.zoom = camera.zoom ?? 1
      room.camera.updateProjectionMatrix()
      room.camera.zoom = camera.zoom ?? 1
      room.camera.updateProjectionMatrix()
      room.camera.updateMatrixWorld(true)
      room.webgl.info.autoReset = false
      room.webgl.info.reset()
      room.webgl.render(room.scene, room.camera)
      const calls = room.webgl.info.render.calls
      room.webgl.info.autoReset = true
      // read the canvas in the same task as the render: the room's own loop would draw its camera over it before a screenshot
      return { metrics: room.metrics().module, calls, triangles: room.webgl.info.render.triangles, picture: room.webgl.domElement.toDataURL('image/png') }
    },
    { camera, count },
  )
const nearPage = await open()
const near = await view(nearPage, { x: 34, y: 1.7, z: -45, lookAt: { x: 0, y: 1.0, z: -45 }, steps: Number(process.env.NEAR_STEPS ?? 6) })
writeFileSync(join(outDir, 'horde-near.png'), Buffer.from(near.picture.split(',')[1], 'base64'))
console.log('NEAR', JSON.stringify({ ...near, picture: undefined }))
const farPage = await open()
const far = await view(farPage, { x: 0, y: 30, z: 110, lookAt: { x: 0, y: 0, z: -45 }, steps: 1 })
const zoom = await view(farPage, { x: 0, y: 30, z: 110, lookAt: { x: 0, y: 0, z: -45 }, steps: 0, zoom: 5 })
writeFileSync(join(outDir, 'horde-far-zoom.png'), Buffer.from(zoom.picture.split(',')[1], 'base64'))
writeFileSync(join(outDir, 'horde-far.png'), Buffer.from(far.picture.split(',')[1], 'base64'))
console.log('FAR', JSON.stringify({ ...far, picture: undefined }))
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)))
await browser.close()
