// @ts-check
// A package's dist older than its src is a build from another commit (a `git checkout` does not rebuild): the page bundled from it measures old code.
// Only the packages the page bundles from dist are checked (examples/test-room/page-packages.mjs); the ones bundled from src have nothing to be stale.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { DIST_PACKAGES, distFilesOf } from '../../examples/test-room/page-packages.mjs'

/**
 * @typedef {{ name: string, srcNewestMs: number | undefined, distEntryMs: (number | undefined)[] }} PackageTimes
 * `distEntryMs`: the mtime of each dist file the page resolves for the package (undefined when the file is missing).
 */

/**
 * The packages whose dist entry is missing or older than their src. A package with no src is never stale.
 * @param {PackageTimes[]} packages @returns {string[]}
 */
export const stalePackagesOf = (packages) =>
  packages
    .filter(({ srcNewestMs, distEntryMs }) => srcNewestMs !== undefined && distEntryMs.some((entryMs) => entryMs === undefined || srcNewestMs > entryMs))
    .map(({ name }) => name)

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

/** @param {string} root @param {string[]} [names] @returns {string[]} */
export const stalePackagesAt = (root, names = DIST_PACKAGES) =>
  stalePackagesOf(
    names.map((name) => {
      const folder = join(root, 'packages', name)
      return { name, srcNewestMs: newestMtimeUnder(join(folder, 'src')), distEntryMs: distFilesOf(name).map((file) => (existsSync(join(folder, file)) ? statSync(join(folder, file)).mtimeMs : undefined)) }
    }),
  )

/** Throws, naming the packages and the rebuild command, when a package the page bundles from dist has an entry older than its src or missing. @param {string} root @param {string[]} [names] */
export const assertDistsAreFresh = (root, names = DIST_PACKAGES) => {
  const stale = stalePackagesAt(root, names)
  if (stale.length === 0) return
  const filters = stale.map((name) => `--filter @adatechnology/${name}`).join(' ')
  throw new Error(`room-explosion: the dist of ${stale.length} package(s) is older than its src or missing (${stale.join(', ')}): the page would bundle old code. Rebuild: pnpm ${filters} build (or pnpm build)`)
}
