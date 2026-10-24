// Captures the landing page thumbnails into site/thumbs/ from a running demo site.
// Usage: node site/capture-thumbs.mjs [baseUrl] [--only=<example name>]   (default http://localhost:4801, needs Chrome; CHROME_BIN overrides; --only keeps the other thumbnails as they are)
// Thumbnails are committed: the Docker build only copies them, so it needs no browser.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXAMPLES } from './catalog.mjs'

const args = process.argv.slice(2)
const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length)
const baseUrl = (args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:4801').replace(/\/$/, '')
const thumbsDir = join(dirname(fileURLToPath(import.meta.url)), 'thumbs')
const chromeBin = process.env.CHROME_BIN ?? 'google-chrome-stable'
const PORT = 9335
const VIEWPORT = { width: 960, height: 600 }
const SETTLE_MS = 700
const READY_TIMEOUT_MS = 90000

// Hides everything that is not the 3D canvas or one of its ancestors.
const HIDE_PANELS = `(() => {
  const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!canvas) return null
  for (let node = canvas; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) if (sibling !== node) sibling.style.setProperty('display', 'none', 'important')
  }
  const box = canvas.getBoundingClientRect()
  return { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 }
})()`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function connect() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      const socket = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((resolve) => socket.addEventListener('open', resolve))
      return socket
    } catch {
      await sleep(250)
    }
  }
  throw new Error(`Chrome não respondeu na porta ${PORT}`)
}

function createClient(socket) {
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) pending.get(message.id)(message)
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  return { send, evaluate }
}

async function waitFor(client, expression) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await client.evaluate(`Boolean(${expression})`).catch(() => false)) return
    await sleep(300)
  }
  throw new Error(`a página não ficou pronta: ${expression}`)
}

async function capture({ client, key, url, ready, setup }) {
  await client.send('Page.navigate', { url: `${baseUrl}/${url}` })
  await waitFor(client, ready)
  if (setup) await client.evaluate(setup)
  const clip = await client.evaluate(HIDE_PANELS)
  await sleep(SETTLE_MS)
  const { result } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 78, ...(clip ? { clip } : {}) })
  writeFileSync(join(thumbsDir, `${key}.jpg`), Buffer.from(result.data, 'base64'))
  console.log(`  ${key}.jpg`)
}

async function main() {
  mkdirSync(thumbsDir, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'game-kit-thumbs-'))
  const chrome = spawn(chromeBin, [
    '--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`, `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  try {
    const client = createClient(await connect())
    await client.send('Page.enable')
    await client.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false })
    for (const example of EXAMPLES.filter((entry) => !only || entry.name === only)) {
      console.log(`> ${example.name}`)
      await capture({ client, key: example.name, url: example.url, ready: example.ready, setup: example.setup })
      for (const area of example.areas) {
        await capture({ client, key: `${example.name}-${area.id}`, url: example.url, ready: example.ready, setup: area.setup })
      }
    }
  } finally {
    const exited = new Promise((resolve) => chrome.once('exit', resolve))
    chrome.kill()
    await exited
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

await main()
