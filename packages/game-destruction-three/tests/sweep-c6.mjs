// C6 of spec 008: the robustness sweep over 8 processes, then the table. Run from the package: `node tests/sweep-c6.mjs` (SWEEP_SEEDS=n for a shorter one).
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PROCESSES = 8
const SEEDS = Number(process.env.SWEEP_SEEDS ?? 64)
const per = Math.ceil(SEEDS / PROCESSES)
const dir = mkdtempSync(join(tmpdir(), 'sweep-c6-'))
const started = Date.now()

const runChunk = (index) =>
  new Promise((resolve) => {
    const count = Math.min(per, SEEDS - index * per)
    if (count <= 0) return resolve(0)
    const child = spawn('npx', ['vitest', 'run', 'tests/sweep-c6.test.ts'], {
      env: { ...process.env, SWEEP: '1', PIECE_SOLVER: 'jolt', SWEEP_FROM: String(1 + index * per), SWEEP_COUNT: String(count), SWEEP_OUT: join(dir, `${index}.jsonl`) },
      stdio: 'ignore',
    })
    child.on('exit', resolve)
  })

await Promise.all(Array.from({ length: PROCESSES }, (_, index) => runChunk(index)))

const rows = []
for (let index = 0; index < PROCESSES; index++) {
  const file = join(dir, `${index}.jsonl`)
  if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) if (line) rows.push(JSON.parse(line))
}
const key = (r) => `${r.scenario} | dt ${r.dt} | it ${r.iterations} | push-out x${r.pushOutFactor}`
const cells = new Map()
for (const r of rows) {
  const cell = cells.get(key(r)) ?? { runs: 0, failed: 0, kinds: {}, c1: -Infinity, c2: 0, c2u: 0, c3: 0, c4: 0, deepest: -Infinity, fell: 0 }
  cell.runs++
  if (r.failed.length > 0) cell.failed++
  for (const kind of r.failed) cell.kinds[kind] = (cell.kinds[kind] ?? 0) + 1
  cell.c1 = Math.max(cell.c1, r.c1Excess)
  cell.c2 = Math.max(cell.c2, r.c2Gain)
  cell.c2u = Math.max(cell.c2u, r.c2GainUnconditioned)
  cell.c3 = Math.max(cell.c3, r.c3Lift)
  cell.c4 = Math.max(cell.c4, r.c4AsleepAfter)
  cell.deepest = Math.max(cell.deepest, r.deepest)
  cell.fell = Math.max(cell.fell, r.fellThrough)
  cells.set(key(r), cell)
}
const f = (n, d = 4) => n.toFixed(d)
console.log('scenario | dt | iterations | push-out | pass/runs | failing criteria | worst C1 | C2 (conditioned) | C2 unconditioned (information only) | C3 | C4 s | deepest | fellThrough')
for (const [name, c] of cells) {
  console.log(`${name} | ${c.runs - c.failed}/${c.runs} | ${JSON.stringify(c.kinds)} | ${f(c.c1)} | ${f(c.c2)} | ${f(c.c2u)} | ${f(c.c3)} | ${f(c.c4, 2)} | ${f(c.deepest)} | ${c.fell}`)
}
const failedRows = rows.filter((r) => r.failed.length > 0)
console.log(`\nruns ${rows.length}, failed ${failedRows.length}`)
// more work never worsens: a seed, scenario, dt and push-out that pass with fewer iterations must not fail with more
const iterationsRun = [...new Set(rows.map((r) => r.iterations))].sort((a, b) => a - b)
const outcome = new Map(rows.map((r) => [`${r.scenario}|${r.seed}|${r.dt}|${r.pushOutFactor}|${r.iterations}`, r.failed.length > 0]))
let worse = 0
for (const r of rows) {
  const at = r.iterations === iterationsRun.at(-1) ? undefined : iterationsRun[iterationsRun.indexOf(r.iterations) + 1]
  const higher = outcome.get(`${r.scenario}|${r.seed}|${r.dt}|${r.pushOutFactor}|${at}`)
  if (at !== undefined && higher !== undefined && !outcome.get(`${r.scenario}|${r.seed}|${r.dt}|${r.pushOutFactor}|${r.iterations}`) && higher) worse++
}
console.log(`more iterations made a passing case fail: ${worse}`)
const worstFive = [...failedRows].sort((a, b) => b.c1Excess - a.c1Excess).slice(0, 12)
for (const r of worstFive) console.log(`worst: ${r.scenario} seed ${r.seed} dt ${r.dt} it ${r.iterations} x${r.pushOutFactor} ${r.failed.join(',')} C1 ${f(r.c1Excess)} C2 ${f(r.c2Gain)} C2u ${f(r.c2GainUnconditioned)} C3 ${f(r.c3Lift)}`)
console.log(`wall ${((Date.now() - started) / 1000).toFixed(0)} s, raw lines in ${dir}`)
// the floor is the production cell (the largest iteration count run): the others are for comparison and may fail
const floorFailures = failedRows.filter((r) => r.iterations === iterationsRun.at(-1))
console.log(`failures at the production floor (${iterationsRun.at(-1)} iterations): ${floorFailures.length}`)
process.exit(floorFailures.length > 0 || worse > 0 ? 1 : 0)
