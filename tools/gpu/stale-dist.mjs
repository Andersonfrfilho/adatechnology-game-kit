// @ts-check
// A package's dist older than its src is a build from another commit (a `git checkout` does not rebuild): the page bundled from it measures old code.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {{ name: string, srcNewestMs: number | undefined, distNewestMs: number | undefined }} PackageTimes
 */

/**
 * The packages whose dist is missing or older than their src. A package with no src files is never stale.
 * @param {PackageTimes[]} packages @returns {string[]}
 */
export const stalePackagesOf = (packages) =>
  packages
    .filter(({ srcNewestMs, distNewestMs }) => srcNewestMs !== undefined && (distNewestMs === undefined || srcNewestMs > distNewestMs))
    .map(({ name }) => name)

/** The newest mtime of the files under a folder, or undefined when there are none. @param {string} folder @returns {number | undefined} */
export const newestMtimeUnder = (folder) => {
  if (!existsSync(folder)) return undefined
  /** @type {number | undefined} */
  let newest
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    const mtime = entry.isDirectory() ? newestMtimeUnder(path) : statSync(path).mtimeMs
    if (mtime !== undefined && (newest === undefined || mtime > newest)) newest = mtime
  }
  return newest
}

/**
 * The packages the page can bundle: no reliable list exists (test-room and interactables-test-area each name their own and the second one bundles most of the kit),
 * so it is every `packages/*` with a `src` folder and a `build` script.
 * @param {string} root @returns {string[]}
 */
export const buildablePackagesOf = (root) =>
  readdirSync(join(root, 'packages'))
    .filter((name) => existsSync(join(root, 'packages', name, 'src')) && existsSync(join(root, 'packages', name, 'package.json')))
    .filter((name) => typeof JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8')).scripts?.build === 'string')

/** @param {string} root @returns {string[]} */
export const stalePackagesAt = (root) =>
  stalePackagesOf(buildablePackagesOf(root).map((name) => ({ name, srcNewestMs: newestMtimeUnder(join(root, 'packages', name, 'src')), distNewestMs: newestMtimeUnder(join(root, 'packages', name, 'dist')) })))

/** Throws, naming the packages and the rebuild command, when any package the page bundles has a dist older than its src. @param {string} root */
export const assertDistsAreFresh = (root) => {
  const stale = stalePackagesAt(root)
  if (stale.length === 0) return
  const filters = stale.map((name) => `--filter @adatechnology/${name}`).join(' ')
  throw new Error(`room-explosion: the dist of ${stale.length} package(s) is older than its src or missing (${stale.join(', ')}): the page would bundle old code. Rebuild: pnpm ${filters} build (or pnpm build)`)
}
