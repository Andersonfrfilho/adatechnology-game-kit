// Captura a mesma granada nas três versões (Laboratório, jogo, SDK) nos mesmos instantes depois da detonação.
// Uso: node capturar.mjs   (precisa do site do kit em http://localhost:4801 e serve esta pasta em http://localhost:4810)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'quadros')
const MOMENTOS = [0.08, 0.25, 0.5, 1, 2, 4]
const VIEW = { width: 640, height: 400 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HIDE = `(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  for (let n = c; n && n !== document.body; n = n.parentElement) for (const s of n.parentElement.children) if (s !== n) s.style.setProperty('display', 'none', 'important')
  const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, scale: 1 } })()`

// cada versão: a página, quando está pronta e como detonar a granada com a câmera do Laboratório (a 18 m, de cima e de lado)
const VERSOES = [
  { id: 'laboratorio', url: 'http://localhost:4810/laboratorio.html', ready: 'window.__lab',
    detonar: `(() => { window.__t0 = window.__lab.simT; window.__lab.select('granada') })()`, detonou: 'window.__lab.simT >= window.__t0 + 2.9',
    relogio: 'window.__lab.simT - window.__t0 - 2.9' }, // a granada explode 2,4 s depois do arremesso (fuse em SC.granada)
  { id: 'jogo', url: 'http://localhost:4810/jogo-site.html', ready: 'window.__cmp',
    antes: `(async () => { window.__cmp.start(); await new Promise((r) => setTimeout(r, 2500)) })()`,
    detonar: `(() => { const p = window.__cmp.player, x = p.x + 3, z = p.z; window.__cam = { p: [x + 7, 15, z + 10], t: [x, 0.8, z] }; window.__cmp.explode('granada', x, 0.2, z) })()`, detonou: 'true' },
  { id: 'sdk', url: 'http://localhost:4801/test-room/?ui=0', ready: 'window.__testRoom',
    detonar: `(() => { const r = window.__testRoom; r.setTool('frag_grenade'); r.look([0, 1.7, 5], [0, 0.6, -3]); r.use() })()`,
    detonou: `window.__testRoom.log.entries().some((e) => e.type === 'explode')`,
    depois: `(() => { const r = window.__testRoom; const e = r.log.entries().find((x) => x.type === 'explode'); const p = e.data.point; r.look([p[0] + 10, 6.5, p[2] + 14], [p[0], 1.6, p[2]]) })()` },
]

const chrome = spawn('google-chrome-stable', ['--headless=new', '--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9337', `--window-size=${VIEW.width},${VIEW.height}`, `--user-data-dir=/tmp/claude-1000/cmp-${Date.now()}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' })
let t
for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9337/json')).json(); break } catch { await sleep(250) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pend = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id) pend.get(m.id)?.(m) })
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: 1, mobile: false })
mkdirSync(out, { recursive: true })
const relatorio = {}
for (const v of VERSOES) {
  await send('Page.navigate', { url: v.url })
  for (let i = 0; i < 200; i++) { const r = await ev(`Boolean(${v.ready})`); if (r?.result?.value) break; await sleep(300) }
  if (v.antes) await ev(v.antes)
  const clip = (await ev(HIDE))?.result?.value
  const r = await ev(v.detonar)
  if (r?.exceptionDetails) { relatorio[v.id] = 'erro: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); continue }
  for (let i = 0; i < 300; i++) { const d = await ev(`Boolean(${v.detonou})`); if (d?.result?.value) break; await sleep(30) }
  if (v.depois) await ev(v.depois)
  const t0 = Date.now()
  for (const m of MOMENTOS) {
    // com relógio próprio (simulação mais lenta que o tempo real sem placa de vídeo), espera o tempo da simulação
    if (v.relogio) { for (let i = 0; i < 2000; i++) { const c = await ev(v.relogio); if ((c?.result?.value ?? 0) >= m) break; await sleep(20) } }
    else { const espera = m * 1000 - (Date.now() - t0); if (espera > 0) await sleep(espera) }
    const { result } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80, ...(clip ? { clip } : {}) })
    writeFileSync(join(out, `${v.id}-${String(m).replace('.', '_')}.jpg`), Buffer.from(result.data, 'base64'))
  }
  relatorio[v.id] = 'ok'
}
console.log(JSON.stringify(relatorio))
ws.close(); chrome.kill()
