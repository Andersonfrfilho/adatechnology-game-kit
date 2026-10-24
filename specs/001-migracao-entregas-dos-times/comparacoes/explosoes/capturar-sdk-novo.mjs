// Captura a granada do SDK depois da Fase 5 (a explosão do Laboratório em game-vfx, desenhada por game-vfx-three) nos mesmos instantes e com a mesma câmera
// de `capturar.mjs`: quadros `quadros/sdk-novo-<s>.jpg`. Os quadros `sdk-*` da coluna "SDK antes" ficam como estavam.
// Uso: node examples/test-room/build.mjs && node capturar-sdk-novo.mjs   (Chromium do Playwright, GL por software, sem rede; a simulação anda em passos
// de 1/60 s, então os instantes são exatos)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const page = join(here, '../../../../examples/test-room/dist/test-room.html')
if (!existsSync(page)) throw new Error('examples/test-room/dist/test-room.html não existe: rode node examples/test-room/build.mjs')
const require = createRequire(import.meta.url)
const { chromium } = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean) ?? {}
if (!chromium) throw new Error('playwright não encontrado')
const MOMENTOS = [0.08, 0.25, 0.5, 1, 2, 4]
const out = join(here, 'quadros')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const p = await browser.newPage({ viewport: { width: 640, height: 400 } })
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
await p.goto(`${pathToFileURL(page).href}?ui=0`)
await p.waitForFunction(() => window.__testRoom, null, { timeout: 90000 })
// arremessa a granada e anda até ela explodir (o fusível é de 2,4 s), depois põe a câmera do Laboratório
const explodiu = await p.evaluate(() => {
  const r = window.__testRoom
  r.setTool('frag_grenade')
  for (let i = 0; i < 60; i++) r.update(1 / 60) // o tempo de sacar a arma
  r.look([0, 1.7, 5], [0, 0.6, -3])
  r.use()
  for (let i = 0; i < 600; i++) {
    r.update(1 / 60)
    const e = r.log.entries().find((x) => x.type === 'explode')
    if (e?.data?.point) {
      const point = e.data.point
      r.look([point[0] + 10, 6.5, point[2] + 14], [point[0], 1.6, point[2]])
      return { at: i, point }
    }
  }
  return null
})
if (!explodiu) throw new Error('a granada não explodiu')
let passado = 0
for (const momento of MOMENTOS) {
  const passos = Math.round((momento - passado) * 60)
  await p.evaluate((n) => { for (let i = 0; i < n; i++) window.__testRoom.update(1 / 60) }, passos)
  passado = momento
  await p.waitForTimeout(150)
  await p.screenshot({ path: join(out, `sdk-novo-${String(momento).replace('.', '_')}.jpg`), type: 'jpeg', quality: 80 })
}
console.log(JSON.stringify({ explodiu, erros: errors.slice(0, 3) }))
await browser.close()
