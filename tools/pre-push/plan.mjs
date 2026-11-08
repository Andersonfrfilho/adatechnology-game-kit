// @ts-check
// What a push has to check, worked out from the workspace and the diff: no process is started here, so every rule has a unit test (tests/plan.test.mjs).
//
// The keys are content hashes, the same in every worktree for the same files: a package whose files and dependencies are the same as in a build
// made by another worktree (or by the daily run on main) takes that build from the cache instead of building again (checks.mjs).
import { createHash } from 'node:crypto'

/** Bump to throw away every cached build and every recorded pass (a change to how a key is made). */
export const CACHE_VERSION = 1

/**
 * @typedef {{ name: string, dir: string, deps: readonly string[], scripts: Readonly<Record<string, string>> }} WorkspacePackage
 * @typedef {ReadonlyMap<string, WorkspacePackage>} Workspace  by package name
 * @typedef {ReadonlyMap<string, string>} FileIds  path -> content id (git blob id, or a hash of the file on disk when it differs from the index)
 */

/** The workspace names among a package.json dependency list. @param {unknown} list @returns {string[]} */
export const workspaceDeps = (list) =>
  list && typeof list === 'object'
    ? Object.entries(/** @type {Record<string, unknown>} */ (list))
        .filter(([, version]) => typeof version === 'string' && version.startsWith('workspace:'))
        .map(([name]) => name)
    : []

/**
 * A workspace package from its folder and package.json.
 * @param {string} dir  e.g. packages/game-floorplan
 * @param {Record<string, unknown>} pkg
 * @returns {WorkspacePackage}
 */
export const toPackage = (dir, pkg) => ({
  name: String(pkg.name),
  dir,
  deps: [...new Set([...workspaceDeps(pkg.dependencies), ...workspaceDeps(pkg.devDependencies), ...workspaceDeps(pkg.peerDependencies)])].sort(),
  scripts: /** @type {Record<string, string>} */ (pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {}),
})

/** @param {readonly WorkspacePackage[]} packages @returns {Workspace} */
export const toWorkspace = (packages) => new Map(packages.map((pkg) => [pkg.name, pkg]))

/** `names` and every workspace package they load, directly or not. @param {Workspace} ws @param {Iterable<string>} names @returns {Set<string>} */
export const withDependencies = (ws, names) => {
  const seen = new Set()
  const stack = [...names]
  for (let name = stack.pop(); name !== undefined; name = stack.pop()) {
    const pkg = ws.get(name)
    if (!pkg || seen.has(name)) continue
    seen.add(name)
    stack.push(...pkg.deps)
  }
  return seen
}

/** `names` and every workspace package that loads them, directly or not. @param {Workspace} ws @param {Iterable<string>} names @returns {Set<string>} */
export const withDependents = (ws, names) => {
  /** @type {Map<string, string[]>} */
  const users = new Map()
  for (const pkg of ws.values()) for (const dep of pkg.deps) users.set(dep, [...(users.get(dep) ?? []), pkg.name])
  const seen = new Set()
  const stack = [...names].filter((name) => ws.has(name))
  for (let name = stack.pop(); name !== undefined; name = stack.pop()) {
    if (seen.has(name)) continue
    seen.add(name)
    stack.push(...(users.get(name) ?? []))
  }
  return seen
}

/** The packages whose folder holds one of the changed files. @param {Workspace} ws @param {readonly string[]} files @returns {Set<string>} */
export const changedPackages = (ws, files) => {
  const byDir = new Map([...ws.values()].map((pkg) => [pkg.dir, pkg.name]))
  const changed = new Set()
  for (const file of files) {
    const name = byDir.get(file.split('/').slice(0, 2).join('/'))
    if (name) changed.add(name)
  }
  return changed
}

/** Files every build stands on: a change to one of them changes every key. */
export const ROOT_INPUTS = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.npmrc', '.nvmrc']

/** Folders outside the packages that the tests and the typecheck of every package may read (the vitest setup files, the global types). */
export const SHARED_TEST_INPUTS = ['test-support', 'types']

/** @param {readonly string[]} parts */
const sha = (parts) => createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32)

/** One id for every file under `prefix` (a folder, or a single file). @param {FileIds} files @param {string} prefix */
export const treeId = (files, prefix) => {
  const parts = []
  for (const [path, id] of files) if (path === prefix || path.startsWith(`${prefix}/`)) parts.push(`${path} ${id}`)
  return sha(parts.sort())
}

/**
 * The build key of every package: its own files (dist and node_modules are never in git), the root inputs, the Node version and, through their own
 * keys, every workspace package it loads. Same key, same dist.
 * @param {Workspace} ws @param {FileIds} files @param {string} nodeVersion
 * @returns {Map<string, string>}
 */
export const buildKeys = (ws, files, nodeVersion) => {
  const root = sha([`v${CACHE_VERSION}`, nodeVersion, ...ROOT_INPUTS.map((path) => `${path} ${files.get(path) ?? '-'}`)])
  /** @type {Map<string, string>} */
  const keys = new Map()
  /** @param {string} name @param {Set<string>} path @returns {string} */
  const keyOf = (name, path) => {
    const known = keys.get(name)
    if (known) return known
    const pkg = ws.get(name)
    if (!pkg) return '-'
    // a cycle in the workspace graph would recurse forever: the package on the cycle is keyed by its name there
    if (path.has(name)) return `cycle:${name}`
    path.add(name)
    const key = sha([root, pkg.name, treeId(files, pkg.dir), ...pkg.deps.map((dep) => `${dep} ${keyOf(dep, path)}`)])
    path.delete(name)
    keys.set(name, key)
    return key
  }
  for (const name of ws.keys()) keyOf(name, new Set())
  return keys
}

/**
 * What the tests and the typecheck of a package read outside it, found in its sources: `../../<sibling package>` paths and `../../../specs` or
 * `../../../tools`. Unknown readers are covered by CI, which tests everything on every pull request.
 * @param {string} text
 * @returns {{ siblings: string[], roots: string[] }}
 */
export const outsideReads = (text) => {
  const siblings = new Set()
  const roots = new Set()
  for (const match of text.matchAll(/\.\.\/\.\.\/(?:\.\.\/)?(game-[a-z0-9-]+|specs|tools|examples|site|docs)\b/g)) {
    const target = /** @type {string} */ (match[1])
    if (target.startsWith('game-')) siblings.add(target)
    else roots.add(target)
  }
  return { siblings: [...siblings].sort(), roots: [...roots].sort() }
}

/**
 * The key under which a typecheck or a test run that passed is remembered: the build key plus what the package's tests read outside it.
 * @param {string} buildKey @param {FileIds} files @param {{ siblings: readonly string[], roots: readonly string[] }} reads
 */
export const checkKey = (buildKey, files, reads) =>
  sha([
    buildKey,
    ...SHARED_TEST_INPUTS.map((dir) => `${dir} ${treeId(files, dir)}`),
    ...reads.siblings.map((dir) => `packages/${dir} ${treeId(files, `packages/${dir}`)}`),
    ...reads.roots.map((dir) => `${dir} ${treeId(files, dir)}`),
  ])

/** Files whose change means the whole repository is linted again: the rules, their plugins and the counted exceptions. */
const LINT_CONFIG = [/^eslint\.config\.mjs$/, /^eslint-suppressions\.json$/, /^tools\/eslint\//, /^package\.json$/, /^pnpm-lock\.yaml$/]
const LINTED = /\.(ts|tsx|js|cjs|mjs)$/

/**
 * What eslint runs on: the whole repository when the rules changed, else only the changed script files (the rules look at one file at a time, with
 * no type information, so an unchanged file gives the same answer; CI lints everything).
 * @param {readonly string[]} changed  files changed since the base and still present
 * @returns {{ all: true } | { all: false, files: string[] }}
 */
export const lintTargets = (changed) => {
  if (changed.some((file) => LINT_CONFIG.some((rule) => rule.test(file)))) return { all: true }
  return { all: false, files: changed.filter((file) => LINTED.test(file) && !file.startsWith('specs/')).sort() }
}

/**
 * Parses `git ls-files -s -z`: mode, blob id, stage, path.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export const parseLsFiles = (text) => {
  /** @type {Map<string, string>} */
  const files = new Map()
  for (const entry of text.split('\0')) {
    const tab = entry.indexOf('\t')
    if (tab < 0) continue
    const [, id] = entry.slice(0, tab).split(' ')
    if (id) files.set(entry.slice(tab + 1), id)
  }
  return files
}

/**
 * The paths `git status --porcelain=v1 -z -uall` lists as different from the index: changed, added, untracked or deleted. A rename lists both sides.
 * @param {string} text
 * @returns {string[]}
 */
export const parseStatus = (text) => {
  const entries = text.split('\0')
  const paths = []
  for (let i = 0; i < entries.length; i++) {
    const entry = /** @type {string} */ (entries[i])
    if (entry.length < 4) continue
    paths.push(entry.slice(3))
    // a rename or copy is followed by its source path
    if (entry[0] === 'R' || entry[0] === 'C') {
      const from = entries[++i]
      if (from) paths.push(from)
    }
  }
  return paths
}

/** How many packages test at once: a quarter of the threads, so vitest's own workers have room. @param {number} cpus @param {string | undefined} env */
export const testJobs = (cpus, env) => {
  const asked = Number(env)
  if (Number.isInteger(asked) && asked > 0) return asked
  return Math.max(1, Math.floor(cpus / 4))
}

/** @param {number} ms */
export const formatDuration = (ms) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}
