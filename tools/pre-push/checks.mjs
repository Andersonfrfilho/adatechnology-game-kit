#!/usr/bin/env node
// @ts-check
// The CPU half of the pre-push hook (.githooks/pre-push runs it under a lock, one push at a time on this machine; the GPU half comes after, under
// a lock of its own, so one push opens its pages while the next one builds). What it does, in parallel where it can:
//   - lint: the files the branch changed (the whole repository when the lint rules changed); CI lints everything.
//   - build: every package, but a package whose files and dependencies are the same as a build already made in any worktree (or by the daily run)
//     takes that dist from the cache instead of building (~/.cache/adatechnology-game-kit/pre-push/build, by content key, plan.mjs). Only what
//     changed is built, in parallel, in dependency order.
//   - typecheck and tests of the packages the branch changed (with PRE_PUSH_DEPENDENTS=1 also of the packages that load them; CI tests every package
//     on the pull request, and the merge waits for it). A typecheck or a test run that passed with the same files is not run again.
// Each step prints how long it took, and every run adds a line to ~/.cache/adatechnology-game-kit/pre-push/times.ndjson.
//   PRE_PUSH_ALL=1          typecheck and test every package
//   PRE_PUSH_DEPENDENTS=1   also the packages that depend on the changed ones
//   PRE_PUSH_JOBS=n         packages tested at once (default: 2; 1 under 8 threads)
//   PRE_PUSH_NO_CACHE=1     build, typecheck and test again even when the cache has them
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { availableParallelism, homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildKeys,
  changedPackages,
  checkKey,
  formatDuration,
  lintTargets,
  outsideReads,
  parseLsFiles,
  parseStatus,
  testJobs,
  toPackage,
  toWorkspace,
  withDependents,
} from './plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cacheRoot = process.env.PRE_PUSH_CACHE ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'adatechnology-game-kit/pre-push')
const noCache = Boolean(process.env.PRE_PUSH_NO_CACHE)
const cpus = availableParallelism()
const KEY_FILE = '.pre-push-key'
const KEEP_DAYS = 14
const started = Date.now()

/** @param {string} line */
const say = (line) => console.log(`pre-push: ${line}`)
/** @param {string[]} args */
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

// --- the workspace and what changed -----------------------------------------------------------------------------------------------------------

/** @param {string} group */
const packagesIn = (group) =>
  readdirSync(join(root, group))
    .map((dir) => `${group}/${dir}`)
    .filter((dir) => existsSync(join(root, dir, 'package.json')))
    .map((dir) => toPackage(dir, JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))))
const ws = toWorkspace([...packagesIn('packages'), ...packagesIn('tools')])

const base = (() => {
  try {
    return git(['merge-base', 'HEAD', 'origin/main']).trim()
  } catch {
    return ''
  }
})()
const all = Boolean(process.env.PRE_PUSH_ALL) || !base
const changedFiles = base ? git(['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean) : []
const changed = all ? new Set(ws.keys()) : changedPackages(ws, changedFiles)
const toCheck = all ? changed : process.env.PRE_PUSH_DEPENDENTS ? withDependents(ws, changed) : changed

// The id of every file as it is on disk: git's blob id, or a hash of the file where it differs from the index (or is not in git yet).
const files = parseLsFiles(git(['ls-files', '-s', '-z']))
for (const path of parseStatus(git(['status', '--porcelain=v1', '-z', '-uall']))) {
  const full = join(root, path)
  if (existsSync(full) && statSync(full).isFile()) files.set(path, `disk:${createHash('sha1').update(readFileSync(full)).digest('hex')}`)
  else files.delete(path)
}
const keys = buildKeys(ws, files, process.version)

/** @param {string} name */
const safe = (name) => name.replace(/^@/, '').replace(/\//g, '__')

// --- a pool of child processes ---------------------------------------------------------------------------------------------------------------

/**
 * @typedef {{ label: string, ok: boolean, ms: number, output: string }} Done
 * @param {string} label @param {string} command @param {string[]} args @param {string} cwd @returns {Promise<Done>}
 */
const runCaptured = (label, command, args, cwd) =>
  new Promise((done) => {
    const t0 = Date.now()
    let output = ''
    const child = spawn(command, args, { cwd, env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('error', (error) => done({ label, ok: false, ms: Date.now() - t0, output: `${output}\n${error.message}` }))
    child.on('close', (code) => done({ label, ok: code === 0, ms: Date.now() - t0, output }))
  })

/**
 * Runs the tasks, at most `limit` at once, and prints each as it ends.
 * @param {string} step @param {number} limit @param {Array<() => Promise<Done>>} tasks @returns {Promise<Done[]>}
 */
const pool = async (step, limit, tasks) => {
  /** @type {Done[]} */
  const results = []
  let next = 0
  const worker = async () => {
    for (let i = next++; i < tasks.length; i = next++) {
      const result = await /** @type {() => Promise<Done>} */ (tasks[i])()
      results.push(result)
      say(`  ${step} ${result.ok ? 'ok ' : 'FAILED'} ${result.label} (${formatDuration(result.ms)})`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/** @param {Done[]} failed */
const printFailures = (failed) => {
  for (const result of failed) {
    console.error(`\n----- ${result.label} -----`)
    console.error(result.output.trimEnd())
  }
}

// --- lint ----------------------------------------------------------------------------------------------------------------------------------

// eslint's own cache, by file content, one per worktree (its entries are absolute paths): a second push lints only what changed since the first
const eslint = ['-s', 'exec', 'eslint', '--cache', '--cache-strategy', 'content', '--cache-location', join(cacheRoot, 'eslint', `${createHash('sha1').update(root).digest('hex').slice(0, 12)}.cache`)]
mkdirSync(join(cacheRoot, 'eslint'), { recursive: true })
const lint = (() => {
  if (all) return runCaptured('lint (whole repository)', 'pnpm', [...eslint, '.'], root)
  const targets = lintTargets(changedFiles.filter((file) => existsSync(join(root, file))))
  if (targets.all) return runCaptured('lint (whole repository: the lint rules changed)', 'pnpm', [...eslint, '.'], root)
  if (targets.files.length === 0) return Promise.resolve({ label: 'lint (no script changed)', ok: true, ms: 0, output: '' })
  return runCaptured(`lint (${targets.files.length} changed file(s))`, 'pnpm', [...eslint, '--no-warn-ignored', ...targets.files], root)
})()

// --- build, with the cache ---------------------------------------------------------------------------------------------------------------

const buildCache = join(cacheRoot, 'build')
const t0Build = Date.now()
const buildable = [...ws.values()].filter((pkg) => pkg.scripts.build)
let restored = 0
let current = 0
/** @type {typeof buildable} */
const misses = []
for (const pkg of buildable) {
  const key = /** @type {string} */ (keys.get(pkg.name))
  const dist = join(root, pkg.dir, 'dist')
  const cached = join(buildCache, safe(pkg.name), key)
  if (!noCache && readText(join(dist, KEY_FILE)) === key) {
    current++
    touch(cached)
  } else if (!noCache && existsSync(join(cached, KEY_FILE))) {
    rmSync(dist, { recursive: true, force: true })
    cpSync(cached, dist, { recursive: true })
    touch(cached)
    restored++
  } else {
    // a stale dist could leave files the new build no longer writes
    rmSync(dist, { recursive: true, force: true })
    misses.push(pkg)
  }
}
say(`build: ${current} up to date, ${restored} from the cache, ${misses.length} to build`)
if (misses.length) {
  const filters = misses.flatMap((pkg) => ['--filter', pkg.name])
  const built = await runCaptured(`build ${misses.length} package(s)`, 'pnpm', [...filters, `--workspace-concurrency=${cpus}`, 'run', 'build'], root)
  if (!built.ok) {
    printFailures([built])
    fail('build failed')
  }
  for (const pkg of misses) {
    const key = /** @type {string} */ (keys.get(pkg.name))
    const dist = join(root, pkg.dir, 'dist')
    if (!existsSync(dist)) mkdirSync(dist, { recursive: true })
    writeFileSync(join(dist, KEY_FILE), key)
    saveToCache(dist, join(buildCache, safe(pkg.name), key))
  }
}
const buildMs = Date.now() - t0Build
say(`build done (${formatDuration(buildMs)})`)

// --- typecheck and tests of what changed -----------------------------------------------------------------------------------------------------

const passed = join(cacheRoot, 'passed')
/** @type {Map<string, string>} */
const checkKeys = new Map()
for (const name of toCheck) {
  const pkg = /** @type {import('./plan.mjs').WorkspacePackage} */ (ws.get(name))
  checkKeys.set(name, checkKey(/** @type {string} */ (keys.get(name)), files, outsideReads(sourcesOf(pkg.dir))))
}
/** @param {'typecheck' | 'test'} script @param {string} name */
const stamp = (script, name) => join(passed, script, `${safe(name)}-${checkKeys.get(name)}`)

/** @param {'typecheck' | 'test'} script @param {number} limit */
const check = async (script, limit) => {
  const t0 = Date.now()
  const names = [...toCheck].filter((name) => ws.get(name)?.scripts[script]).sort()
  const todo = names.filter((name) => noCache || !existsSync(stamp(script, name)))
  say(`${script}: ${names.length} package(s), ${names.length - todo.length} already passed with these files, ${todo.length} to run (${limit} at once)`)
  const results = await pool(
    script,
    limit,
    todo.map((name) => () => runCaptured(name, 'pnpm', ['-s', 'run', script], join(root, /** @type {string} */ (ws.get(name)?.dir)))),
  )
  for (const result of results) if (result.ok) touchNew(stamp(script, result.label))
  return { script, ms: Date.now() - t0, failed: results.filter((result) => !result.ok) }
}

say(all ? 'checking every package' : `changed since ${base.slice(0, 9)}: ${[...changed].sort().join(', ') || 'no package'}`)
if (!all && process.env.PRE_PUSH_DEPENDENTS) say(`with their dependents: ${toCheck.size} package(s)`)
// typecheck is one tsc per package; vitest starts its own workers, so fewer packages test at once
const [typecheck, tests, linted] = await Promise.all([check('typecheck', Math.max(1, Math.floor(cpus / 2))), check('test', testJobs(cpus, process.env.PRE_PUSH_JOBS)), lint])
say(`  ${linted.label}: ${linted.ok ? 'ok' : 'FAILED'} (${formatDuration(linted.ms)})`)

const failures = [...typecheck.failed, ...tests.failed, ...(linted.ok ? [] : [linted])]
record(failures.length === 0)
prune()
if (failures.length) {
  printFailures(failures)
  fail(`${failures.map((result) => result.label).join(', ')} failed`)
}
say(
  `CPU checks passed in ${formatDuration(Date.now() - started)} (build ${formatDuration(buildMs)}, typecheck ${formatDuration(typecheck.ms)}, tests ${formatDuration(tests.ms)}, lint ${formatDuration(linted.ms)})`,
)

// --- helpers -----------------------------------------------------------------------------------------------------------------------------------

/** @param {string} reason @returns {never} */
function fail(reason) {
  console.error(`pre-push: ${reason} (skip once with git push --no-verify)`)
  process.exit(1)
}

/** @param {string} file */
function readText(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** Marks a cache entry as used, so the weekly prune keeps it. @param {string} path */
function touch(path) {
  try {
    const now = new Date()
    utimesSync(path, now, now)
  } catch {}
}

/** @param {string} file */
function touchNew(file) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, '')
}

/** Copies a fresh dist into the cache: into a temporary folder first, so another push never sees half of it. @param {string} dist @param {string} target */
function saveToCache(dist, target) {
  if (existsSync(target)) return
  const temp = `${target}.tmp-${process.pid}`
  try {
    mkdirSync(dirname(target), { recursive: true })
    cpSync(dist, temp, { recursive: true })
    renameSync(temp, target)
  } catch {
    // another push saved the same key first, or the disk is full: the cache is only a shortcut
    rmSync(temp, { recursive: true, force: true })
  }
}

/** The text of the files a package's tests and configs are made of, to find what they read outside the package. @param {string} dir */
function sourcesOf(dir) {
  const prefix = `${dir}/`
  let text = ''
  for (const path of files.keys()) {
    if (!path.startsWith(prefix) || !/\.(ts|tsx|js|mjs|cjs|json)$/.test(path)) continue
    if (path.includes('/fixtures/') || path.includes('/dist/')) continue
    text += readText(join(root, path))
  }
  return text
}

/** @param {boolean} ok */
function record(ok) {
  try {
    mkdirSync(cacheRoot, { recursive: true })
    const line = {
      at: new Date().toISOString(),
      ok,
      head: git(['rev-parse', '--short', 'HEAD']).trim(),
      cwd: root,
      changed: [...changed],
      built: misses.length,
      restored,
      ms: Date.now() - started,
      buildMs,
      typecheckMs: typecheck.ms,
      testMs: tests.ms,
      lintMs: linted.ms,
    }
    appendFileSync(join(cacheRoot, 'times.ndjson'), `${JSON.stringify(line)}\n`)
  } catch {}
}

/** Drops builds and passes not used for KEEP_DAYS days. */
function prune() {
  const limit = Date.now() - KEEP_DAYS * 86_400_000
  for (const group of [buildCache, join(passed, 'typecheck'), join(passed, 'test')]) {
    if (!existsSync(group)) continue
    for (const entry of readdirSync(group)) {
      const path = join(group, entry)
      try {
        const stat = statSync(path)
        if (stat.isDirectory() && group === buildCache) {
          for (const key of readdirSync(path)) {
            const keyPath = join(path, key)
            if (statSync(keyPath).mtimeMs < limit) rmSync(keyPath, { recursive: true, force: true })
          }
        } else if (stat.mtimeMs < limit) rmSync(path, { recursive: true, force: true })
      } catch {}
    }
  }
}
