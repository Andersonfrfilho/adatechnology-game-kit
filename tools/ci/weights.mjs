#!/usr/bin/env node
// @ts-check
// Regenerates the WEIGHTS map of the `matrix` job in .github/workflows/ci.yml from what CI measured.
//   node tools/ci/weights.mjs <run-id> [<run-id> ...]   (needs `gh` logged in; the median over the runs, failed jobs skipped)
//   node tools/ci/weights.mjs --update <run-id> ...     also writes the map into ci.yml
//   node tools/ci/weights.mjs --files <run-id> ...      also lists the 10 slowest test files of the runs (what to split or shard)
// Weight = seconds of `vitest run` for a package that runs inside a `group` job; a package in SHARDS is left out (each shard is a job of its own).
// Packages under 10 s keep the default weight of 10 and are left out. Shard and job times go to stderr, the JSON map to stdout.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const REPO = 'Andersonfrfilho/adatechnology-game-kit'
const WORKFLOW = new URL('../../.github/workflows/ci.yml', import.meta.url)
const MIN_WEIGHT = 10

const args = process.argv.slice(2)
const shouldUpdate = args.includes('--update')
const shouldListFiles = args.includes('--files')
const runIds = args.filter((arg) => !arg.startsWith('--'))
if (!runIds.length) {
  console.error('usage: node tools/ci/weights.mjs [--update] [--files] <run-id> [<run-id> ...]')
  process.exit(2)
}

/** @param {string} path @param {string[]} [extra] @returns {string} */
const gh = (path, extra = []) => execFileSync('gh', ['api', ...extra, path], { encoding: 'utf8', maxBuffer: 1 << 28 })
// eslint-disable-next-line no-control-regex
/** @param {string} text @returns {string} */
const stripColors = (text) => text.replace(/\x1b\[[0-9;]*m/g, '')
/** @param {string} value @param {string} unit @returns {number} */
const seconds = (value, unit) => Number(value) / (unit === 'ms' ? 1000 : 1)
/** @param {number[]} values @returns {number} */
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Per `##[group]<pkg>@<version> : test` block of a log, the vitest `Duration` it printed, and every `✓ tests/<file> (n tests) <time>` line. */
/** @param {string} log */
const readLog = (log) => {
  const packages = new Map()
  const files = []
  let current = ''
  for (const line of stripColors(log).split('\n')) {
    const group = line.match(/##\[group\](@[^@\s]+\/[^@\s]+)@\S+ : test/)
    if (group) current = group[1]
    const duration = line.match(/^\S+\s+Duration\s+([\d.]+)(ms|s)\b/)
    if (duration) packages.set(current, seconds(duration[1], duration[2]))
    const file = line.match(/^\S+\s+✓ (\S+\.test\.\w+) \(\d+ tests?\)(?: \d+ skipped)? (\d+)ms/)
    if (file) files.push({ file: `${current}:${file[1]}`, seconds: Number(file[2]) / 1000 })
  }
  return { packages, files }
}

const perPackage = new Map()
const jobSeconds = new Map()
const slowFiles = new Map()
for (const runId of runIds) {
  const jobs = JSON.parse(gh(`repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`, ['--paginate', '--slurp'])).flatMap((/** @type {{ jobs: { id: number, name: string, conclusion: string, started_at: string, completed_at: string }[] }} */ page) => page.jobs)
  for (const job of jobs) {
    const name = job.name.match(/^test \((.+)\)$/)
    if (!name || job.conclusion !== 'success') continue
    const shard = name[1].match(/^(\S+) (\d+)\/(\d+)$/)
    const isGroup = name[1].startsWith('group ')
    const log = readLog(gh(`repos/${REPO}/actions/jobs/${job.id}/logs`, ['--allow-escape-sequences']))
    const elapsed = (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000
    jobSeconds.set(name[1], [...(jobSeconds.get(name[1]) ?? []), elapsed])
    if (shard && !isGroup) {
      const pkg = `@adatechnology/${shard[1]}`
      for (const file of log.files) slowFiles.set(`${pkg}:${file.file.split(':')[1]}`, [...(slowFiles.get(`${pkg}:${file.file.split(':')[1]}`) ?? []), file.seconds])
      continue
    }
    for (const [pkg, duration] of log.packages) if (pkg) perPackage.set(pkg, [...(perPackage.get(pkg) ?? []), duration])
    for (const file of log.files) slowFiles.set(file.file, [...(slowFiles.get(file.file) ?? []), file.seconds])
  }
}

const sharded = JSON.parse(readFileSync(WORKFLOW, 'utf8').match(/^\s*SHARDS: '([^']*)'$/m)?.[1] ?? '{}')
const weights = Object.fromEntries(
  [...perPackage]
    .filter(([pkg]) => !(pkg in sharded))
    .map(([pkg, values]) => [pkg, Math.round(median(values))])
    .filter(([, weight]) => weight >= MIN_WEIGHT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
)

console.error('test job seconds (median over the runs):')
for (const [name, values] of [...jobSeconds].sort((a, b) => median(b[1]) - median(a[1]))) console.error(`  ${String(Math.round(median(values))).padStart(5)}  ${name}`)
if (shouldListFiles) {
  console.error('slowest test files (median seconds):')
  for (const [file, values] of [...slowFiles].sort((a, b) => median(b[1]) - median(a[1])).slice(0, 10)) console.error(`  ${String(Math.round(median(values))).padStart(5)}  ${file}`)
}

const json = JSON.stringify(weights)
console.log(json)
if (shouldUpdate) {
  const text = readFileSync(WORKFLOW, 'utf8')
  const next = text.replace(/^(\s*WEIGHTS: ')[^']*(')$/m, `$1${json}$2`)
  if (next === text && !text.includes(json)) throw new Error('the WEIGHTS line was not found in ci.yml')
  writeFileSync(WORKFLOW, next)
  console.error('ci.yml updated')
}
