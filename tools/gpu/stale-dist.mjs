// @ts-check
// A package's dist older than its src is a build from another commit (a `git checkout` does not rebuild): the page bundled from it measures old code.
// Only the packages the page bundles from dist are checked (examples/test-room/page-packages.mjs); the ones bundled from src have nothing to be stale.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { DIST_PACKAGES, distFilesOf } from '../../examples/test-room/page-packages.mjs'

/**
 * @typedef {{ name: string, srcNewestMs: number | undefined, distEntryMs: (number | undefined)[], dependencies: string[] }} PackageTimes
 * `distEntryMs`: the mtime of each dist file the page resolves for the package (undefined when the file is missing).
 * `dependencies`: the workspace packages it depends on (dependencies and peerDependencies). tsup inlines some of them (`noExternal`) into the dist, and which ones is not
 * parsed: all count, so an external one only costs an extra rebuild.
 * @typedef {{ name: string, isMissing: boolean, newerSources: string[] }} StalePackage
 * `newerSources`: the packages (itself first, then the dependencies) whose src is newer than the oldest dist entry.
 */

/**
 * The packages among `checked` whose dist entry is missing or older than the src of the package or of any workspace package it depends on, transitively.
 * @param {PackageTimes[]} packages the graph: every package a checked one reaches @param {string[]} checked @returns {StalePackage[]}
 */
export const stalePackagesOf = (packages, checked) => {
  const byName = new Map(packages.map((entry) => [entry.name, entry]))
  /** @param {string} name @returns {string[]} the package and its transitive dependencies; a cycle is walked once */
  const reachableFrom = (name) => {
    const seen = new Set([name])
    const queue = [name]
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const dependency of byName.get(next)?.dependencies ?? []) {
        if (!byName.has(dependency) || seen.has(dependency)) continue
        seen.add(dependency)
        queue.push(dependency)
      }
    }
    return [...seen]
  }
  /** @type {StalePackage[]} */
  const stale = []
  for (const name of checked) {
    const entry = byName.get(name)
    if (!entry || entry.srcNewestMs === undefined) continue
    const isMissing = entry.distEntryMs.some((entryMs) => entryMs === undefined)
    const oldestEntryMs = Math.min(...entry.distEntryMs.map((entryMs) => entryMs ?? Number.NEGATIVE_INFINITY))
    const newerSources = reachableFrom(name).filter((source) => (byName.get(source)?.srcNewestMs ?? Number.NEGATIVE_INFINITY) > oldestEntryMs)
    if (isMissing || newerSources.length > 0) stale.push({ name, isMissing, newerSources })
  }
  return stale
}

/**
 * The newest mtime of the files and folders under a folder (a delete bumps its folder's mtime, so a removed file still shows), or undefined when it does not exist.
 * @param {string} folder @returns {number | undefined}
 */
export const newestMtimeUnder = (folder) => {
  if (!existsSync(folder)) return undefined
  let newest = statSync(folder).mtimeMs
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    const mtime = entry.isDirectory() ? newestMtimeUnder(path) : statSync(path).mtimeMs
    if (mtime !== undefined && mtime > newest) newest = mtime
  }
  return newest
}

/** The workspace packages a package.json depends on (dependencies and peerDependencies named `@adatechnology/<folder>`). @param {string} file @returns {string[]} */
const workspaceDependenciesOf = (file) => {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  return Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter((name) => name.startsWith('@adatechnology/')).map((name) => name.slice('@adatechnology/'.length))
}

/** @param {string} root @param {string[]} [names] @returns {StalePackage[]} */
export const stalePackagesAt = (root, names = DIST_PACKAGES) => {
  /** @type {Map<string, PackageTimes>} */
  const graph = new Map()
  const pending = [...names]
  for (let name = pending.shift(); name !== undefined; name = pending.shift()) {
    const folder = join(root, 'packages', name)
    if (graph.has(name) || !existsSync(join(folder, 'package.json'))) continue
    const dependencies = workspaceDependenciesOf(join(folder, 'package.json'))
    graph.set(name, { name, dependencies, srcNewestMs: newestMtimeUnder(join(folder, 'src')), distEntryMs: distFilesOf(name).map((file) => (existsSync(join(folder, file)) ? statSync(join(folder, file)).mtimeMs : undefined)) })
    pending.push(...dependencies)
  }
  return stalePackagesOf([...graph.values()], names)
}

/** @param {StalePackage} stale */
const describeStale = ({ name, isMissing, newerSources }) => {
  const reasons = [...(isMissing ? ['dist entry missing'] : []), ...newerSources.map((source) => (source === name ? 'its own src is newer' : `src of ${source} is newer`))]
  return `${name} (${reasons.join('; ')})`
}

/** Throws, naming each package, why, and the rebuild command, when a package the page bundles from dist is older than its src or a workspace dependency's src. @param {string} root @param {string[]} [names] */
export const assertDistsAreFresh = (root, names = DIST_PACKAGES) => {
  const stale = stalePackagesAt(root, names)
  if (stale.length === 0) return
  // `name...` also rebuilds the workspace dependencies: a dependent rebuilt alone would inline the dependency's old dist and pass
  const filters = stale.map(({ name }) => `--filter "@adatechnology/${name}..."`).join(' ')
  throw new Error(`room-explosion: the dist of ${stale.length} package(s) is older than its src or a workspace dependency's, or missing: ${stale.map(describeStale).join(', ')}: the page would bundle old code. Rebuild: pnpm ${filters} build (or pnpm build)`)
}
