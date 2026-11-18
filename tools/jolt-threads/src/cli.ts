// Jolt's step in the room's crater explosion, single-threaded vs multithreaded (docs/medicoes/jolt-multithread.md). Never in CI: Chromium with the GPU.
//   node tools/jolt-threads/dist/cli.js round --config mt4-off --round 1 --out docs/medicoes/jolt-multithread.jsonl
//   node tools/jolt-threads/dist/cli.js report --in docs/medicoes/jolt-multithread.jsonl --out docs/medicoes/jolt-multithread-table.md
// A round: the room built by examples/test-room/build.mjs, served cross-origin isolated (serve-room), a fresh page, the house of tools/gpu/room-explosion.mjs built and
// settled, the same C4 on the loose ground beside it (the crater), 600 frames of 1/60 s timed with the page's loop stopped. Run each round under the measuring lock:
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock node tools/jolt-threads/dist/cli.js round ...
import { appendFileSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { cpus, loadavg, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { chromium } from 'playwright-core'

import { ISOLATION, createRoomServer } from '@adatechnology/serve-room-tool'

import { inPage } from '../../gpu/room-explosion.mjs'
import { PROBE_HTML } from './probe-page'
import { THREAD_CONFIGS, configById, poolRounds, summariseRound } from './configs'
import type { JoltInfo, RoundResult, Stats } from './configs'

const QUIET_LOAD = 4
const LOAD_WAIT_MS = 3 * 60 * 60 * 1000
const FRAMES = 600

const argOf = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`)
  return at >= 0 ? process.argv[at + 1] : undefined
}

const waitForQuiet = async (): Promise<number> => {
  const started = Date.now()
  for (;;) {
    const load = loadavg()[0] ?? 0
    if (load < QUIET_LOAD || Date.now() - started > LOAD_WAIT_MS) return load
    console.log(`jolt-threads: load ${load.toFixed(2)} >= ${QUIET_LOAD}, waiting`)
    await sleep(30000)
  }
}

type Host = { __testRoom?: unknown; __joltInfo?: JoltInfo }

const runRound = async (configId: string, round: number, out: string): Promise<void> => {
  const config = configById(configId)
  if (!config) throw new Error(`unknown config ${configId}: ${THREAD_CONFIGS.map((known) => known.id).join(', ')}`)
  const root = resolve(argOf('dist') ?? 'examples/test-room/dist')
  const server = createRoomServer({ root, isolation: ISOLATION.REQUIRE_CORP })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
  const errors: string[] = []
  const load = await waitForQuiet()
  let result: RoundResult
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}/test-room.html?area=floorplan&solver=jolt&blastDebris=1${config.query}`, { timeout: 180000 })
    await page.waitForFunction(() => (window as unknown as Host).__testRoom, null, { timeout: 600000 })
    const info = (await page.evaluate(() => (window as unknown as Host).__joltInfo)) as JoltInfo
    await page.evaluate(inPage, { stage: 'prepare' as const, weather: 'none' })
    const frames = (await page.evaluate(inPage, { stage: 'run' as const, kind: 'crater', frames: FRAMES, frameSeconds: 1 / 60, isRendered: false, stageLabels: ['joltStep'] })) as number[][]
    result = { config: configId, round, load: Math.round(load * 100) / 100, info, ...summariseRound(frames), ...(errors.length ? { error: errors.slice(0, 3).join(' | ') } : {}) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const empty: Stats = { mean: 0, p99: 0, worst: 0 }
    const info: JoltInfo = { build: '?', workerThreads: 0, contactCallbacks: '?', crossOriginIsolated: false, hardwareConcurrency: 0, fallback: null }
    result = { config: configId, round, load: Math.round(load * 100) / 100, info, step: empty, wakeStep: 0, update: empty, frames: 0, error: [message, ...errors].slice(0, 3).join(' | ') }
  } finally {
    await browser.close()
    server.close()
  }
  appendFileSync(out, `${JSON.stringify(result)}\n`)
  console.log(`jolt-threads: ${configId} round ${round}: step mean ${result.step.mean} p99 ${result.step.p99} worst ${result.step.worst} ms (wake ${result.wakeStep}), load ${result.load}${result.error ? `, error ${result.error}` : ''}`)
}

/** The multithreaded build with and without the JS contact listener, in Chromium, cross-origin isolated: the evidence behind `JOLT_WORKERS_WITH_JS_CALLBACKS`. */
const probeCallbacks = async (): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'jolt-probe-'))
  const jolt = createRequire(resolve('packages/game-physics-jolt/package.json')).resolve('jolt-physics/wasm-compat-multithread')
  copyFileSync(jolt, join(dir, 'jolt-physics.multithread.wasm-compat.js'))
  writeFileSync(join(dir, 'probe.html'), PROBE_HTML)
  const server = createRoomServer({ root: dir, isolation: ISOLATION.REQUIRE_CORP })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  for (const [threads, listener] of [[0, 'on'], [1, 'on'], [4, 'on'], [4, 'off']] as const) {
    const page = await browser.newPage()
    const workerErrors: string[] = []
    page.on('console', (message) => message.text().includes('worker sent an error') && workerErrors.push(message.text()))
    await page.goto(`${base}/probe.html?threads=${threads}&listener=${listener}`)
    await page.waitForFunction(() => 'crossOriginIsolated' in window && ((window as unknown as { __probe?: unknown }).__probe || (window as unknown as { __probeError?: unknown }).__probeError), null, { timeout: 60000 }).catch(() => undefined)
    const outcome = await page.evaluate(() => ({ isolated: self.crossOriginIsolated, probe: (window as unknown as { __probe?: unknown }).__probe ?? null, error: (window as unknown as { __probeError?: unknown }).__probeError ?? null }))
    console.log(`probe: workers ${threads}, JS listener ${listener}: ${JSON.stringify({ ...outcome, workerErrors: workerErrors.slice(0, 1) })}`)
    await page.close()
  }
  await browser.close()
  server.close()
}

const cell = (stats: Stats): string => `${stats.mean} | ${stats.p99} | ${stats.worst}`

const writeReport = (input: string, out: string): void => {
  const rounds = readFileSync(input, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as RoundResult)
  const lines = [
    `Máquina: ${cpus()[0]?.model ?? '?'} (${cpus().length} threads). Cena: ?area=floorplan&solver=jolt&blastDebris=1, casa single_storey_a semente 1, C4 no solo solto ao lado (cratera), ${FRAMES} quadros de 1/60 s, quadro 0 (despertar) à parte.`,
    '',
    '| Configuração | Válida p/ jogo | Rodadas | Passo Jolt média (ms) | p99 | pior | Passo no quadro 0 (mediana) | Update inteiro média | p99 | pior | Carga no início |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ]
  for (const config of THREAD_CONFIGS) {
    const mine = rounds.filter((round) => round.config === config.id)
    if (mine.length === 0) continue
    const ok = mine.filter((round) => !round.error)
    const wakes = ok.map((round) => round.wakeStep).sort((a, b) => a - b)
    const threads = ok[0]?.info.workerThreads
    const label = threads !== undefined && config.id === 'mtN-off' ? `${config.label} (${threads})` : config.label
    lines.push(
      `| ${label} | ${config.isGameValid ? 'sim' : 'não'} | ${ok.length}/${mine.length} | ${cell(poolRounds(mine, (round) => round.step))} | ${wakes[Math.floor(wakes.length / 2)] ?? '-'} | ${cell(poolRounds(mine, (round) => round.update))} | ${mine.map((round) => round.load).join(', ')} |`,
    )
  }
  const failed = rounds.filter((round) => round.error)
  if (failed.length) lines.push('', 'Rodadas com erro:', ...failed.map((round) => `- ${round.config} #${round.round}: ${round.error}`))
  writeFileSync(out, `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
}

const command = process.argv[2]
if (command === 'round') await runRound(argOf('config') ?? 'single', Number(argOf('round') ?? 1), resolve(argOf('out') ?? join('docs', 'medicoes', 'jolt-multithread.jsonl')))
else if (command === 'report') writeReport(resolve(argOf('in') ?? 'docs/medicoes/jolt-multithread.jsonl'), resolve(argOf('out') ?? 'docs/medicoes/jolt-multithread-table.md'))
else if (command === 'probe-callbacks') await probeCallbacks()
else throw new Error('usage: cli.js round --config <id> --round <n> --out <file.jsonl> | report --in <file.jsonl> --out <file.md>')
