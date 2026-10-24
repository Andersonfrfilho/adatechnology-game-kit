// Records a golden from a team page in headless Chrome (CDP) under a seeded, frozen-clock environment.
// Usage: node bin/record.mjs --page <html> --capture <script.js> --out <golden.json> [--seed 1] [--param key=value]...
//        [--ready "<expression>"] [--three <three.min.js>] [--addon <three example script>]... [--timeout-ms 90000]
// Needs `pnpm build` first (the bundle in dist/index.global.js is injected into the page). CHROME_BIN overrides the browser.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' }
const CHROME_BIN = process.env.CHROME_BIN ?? 'google-chrome-stable'
const CDP_CALL_TIMEOUT_MS = 30000
const THREE_ADDON_URL = /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/examples\/js\/.+\/([^/]+\.js)$/
const THREE_URL = /^https:\/\/(cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/[^/]+|(cdn\.jsdelivr\.net\/npm|unpkg\.com)\/three@[^/]+\/build)\/three(\.min)?\.js(\?.*)?$/
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const { values } = parseArgs({
  options: {
    page: { type: 'string' },
    capture: { type: 'string' },
    out: { type: 'string' },
    seed: { type: 'string', default: '1' },
    param: { type: 'string', multiple: true, default: [] },
    ready: { type: 'string', default: 'true' },
    three: { type: 'string' },
    addon: { type: 'string', multiple: true, default: [] },
    'timeout-ms': { type: 'string', default: '90000' },
  },
})
for (const required of ['page', 'capture', 'out']) {
  if (!values[required]) throw new Error(`missing --${required} (see the header of bin/record.mjs)`)
}
const seed = Number(values.seed)
if (!Number.isInteger(seed)) throw new Error(`--seed must be an integer, got "${values.seed}"`)
const timeoutMs = Number(values['timeout-ms'])
const params = { seed, ...Object.fromEntries(values.param.map((entry) => [entry.split('=')[0], entry.slice(entry.indexOf('=') + 1)])) }

// A published artifact page references its scripts relative to a folder with the page's own name; serve both under "/".
function startStaticServer(pagePath) {
  const pageDir = dirname(resolve(pagePath))
  const assetDir = join(pageDir, basename(pagePath, extname(pagePath)))
  const server = createServer((request, response) => {
    let urlPath
    try {
      urlPath = decodeURIComponent(new URL(request.url, 'http://local').pathname)
    } catch {
      return response.writeHead(400).end()
    }
    const relative = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
    const candidates = urlPath === '/' ? [resolve(pagePath)] : [join(assetDir, relative), join(pageDir, relative)]
    const file = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    if (!file) return response.writeHead(404).end()
    response.writeHead(200, { 'content-type': MIME_TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file))
  })
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)))
}

// Chrome picks its own debugging port (--remote-debugging-port=0) and writes it to <profile>/DevToolsActivePort; a fixed port could be
// another Chrome that is already running.
async function connect(profile) {
  const portFile = join(profile, 'DevToolsActivePort')
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const port = readFileSync(portFile, 'utf8').split('\n')[0].trim()
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
      await new Promise((done, fail) => {
        socket.addEventListener('open', done)
        socket.addEventListener('error', fail)
      })
      return socket
    } catch {
      await sleep(250)
    }
  }
  throw new Error(`Chrome did not publish a debugging port in ${portFile}`)
}

function createClient(socket, onEvent) {
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) pending.get(message.id)(message)
    else if (message.method) onEvent(message)
  })
  const send = (method, params = {}, limitMs = CDP_CALL_TIMEOUT_MS) =>
    new Promise((done, fail) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        fail(new Error(`CDP ${method} got no answer in ${limitMs} ms`))
      }, limitMs)
      pending.set(id, (message) => {
        clearTimeout(timer)
        done(message)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const { result, error } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs)
    if (error) throw new Error(error.message)
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  return { send, evaluate }
}

async function waitFor(client, expression) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await client.evaluate(`Boolean(${expression})`).catch(() => false)) return
    await sleep(250)
  }
  throw new Error(`the page never became ready: ${expression}`)
}

// Offline and repeatable: the page's three.js CDN URL is answered from disk and every other external request is refused.
function answerRequests(client, origin) {
  // an answer can arrive after Chrome was stopped; it must not become an unhandled rejection that fails a finished recording
  const answer = (method, params) => void client.send(method, params).catch(() => {})
  const threeSource = values.three ? readFileSync(resolve(values.three)).toString('base64') : undefined
  const addons = new Map(values.addon.map((file) => [basename(file), readFileSync(resolve(file)).toString('base64')]))
  return (message) => {
    if (message.method !== 'Fetch.requestPaused') return
    const { requestId, request } = message.params
    if (request.url.startsWith(origin)) return answer('Fetch.continueRequest', { requestId })
    const addon = addons.get(THREE_ADDON_URL.exec(request.url)?.[1] ?? '')
    if (addon) {
      const headers = [{ name: 'content-type', value: 'text/javascript' }]
      return answer('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: headers, body: addon })
    }
    if (threeSource && THREE_URL.test(request.url)) {
      const headers = [{ name: 'content-type', value: 'text/javascript' }]
      return answer('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: headers, body: threeSource })
    }
    answer('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
  }
}

async function record() {
  const bundle = readFileSync(join(TOOL_DIR, 'dist/index.global.js'), 'utf8')
  const captureScript = readFileSync(resolve(values.capture), 'utf8')
  const server = await startStaticServer(values.page)
  const origin = `http://127.0.0.1:${server.address().port}`
  const profile = mkdtempSync(join(tmpdir(), 'golden-tool-'))
  const chrome = spawn(
    CHROME_BIN,
    ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' },
  )
  try {
    let handleEvent = () => {}
    const client = createClient(await connect(profile), (message) => handleEvent(message))
    handleEvent = answerRequests(client, origin)
    await client.send('Page.enable')
    await client.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
    const setup = `${bundle}\n;globalThis.__GOLDEN_PARAMS = ${JSON.stringify(params)};GoldenTool.stepFrames = GoldenTool.installDeterminism({ seed: ${seed} }).stepFrames`
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: setup })
    await client.send('Page.navigate', { url: `${origin}/` })
    await waitFor(client, values.ready)
    const goldenRecord = await client.evaluate(captureScript)
    mkdirSync(dirname(resolve(values.out)), { recursive: true })
    writeFileSync(resolve(values.out), JSON.stringify(goldenRecord, null, 1) + '\n')
    console.log(`golden written to ${values.out}`)
  } finally {
    const exited = new Promise((done) => chrome.once('exit', done))
    chrome.kill()
    await exited
    server.close()
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

await record()
// pending CDP timers (answers that never came back after Chrome stopped) would keep the process alive
process.exit(0)
