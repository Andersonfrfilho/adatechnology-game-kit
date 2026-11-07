// The index of a local server of the test room (examples/test-room/dist, the 4280): the site's landing page, with every other example's build
// linked next to the room and each card opening its page there. Written by the room's build, so a rebuild never leaves the server without it.
import { existsSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderLanding } from './landing.mjs'

/** @typedef {{ name: string, version?: string, description?: string, scripts?: Record<string, string> }} PackageJson */

const ROOM = 'test-room'
const ROOM_PAGE = 'test-room.html'

/** @param {string} path @returns {PackageJson} */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
/** @param {string} base */
const dirs = (base) => readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
/** @param {string} dir */
const firstPage = (dir) => (existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.html')).sort()[0] : undefined)

/** @param {string} link @param {string} target */
function relink(link, target) {
  rmSync(link, { recursive: true, force: true })
  symlinkSync(target, link, 'dir')
}

/**
 * Links each example's dist/ (and the site's thumbnails) into the room's dist and writes its index.html. An example not built yet still gets its
 * card: the link points at its folder, which holds the page once `node build.mjs` runs there.
 * @param {{ root: string, dist: string }} params
 * @returns {{ examples: number, built: number }}
 */
export function writeLocalIndex({ root, dist }) {
  /** @type {Map<string, string>} */
  const hrefs = new Map([[ROOM, ROOM_PAGE]])
  const examples = [{ name: ROOM, description: readJson(join(root, 'examples', ROOM, 'package.json')).description ?? '' }]
  let built = 1
  for (const name of dirs(join(root, 'examples'))) {
    const pkgPath = join(root, 'examples', name, 'package.json')
    if (name === ROOM || !existsSync(pkgPath)) continue
    const pkg = readJson(pkgPath)
    if (!pkg.scripts?.build) continue
    const exampleDist = join(root, 'examples', name, 'dist')
    relink(join(dist, name), exampleDist)
    const page = firstPage(exampleDist)
    if (page) built += 1
    hrefs.set(name, `${name}/${page ?? ''}`)
    examples.push({ name, description: pkg.description ?? '' })
  }
  const thumbsDir = join(root, 'site/thumbs')
  const thumbs = new Set(existsSync(thumbsDir) ? readdirSync(thumbsDir).filter((file) => file.endsWith('.jpg')).map((file) => file.slice(0, -4)) : [])
  if (thumbs.size) relink(join(dist, 'thumbs'), thumbsDir)
  const packages = dirs(join(root, 'packages'))
    .filter((name) => existsSync(join(root, 'packages', name, 'package.json')))
    .map((name) => readJson(join(root, 'packages', name, 'package.json')))
    .map((pkg) => ({ name: pkg.name, version: pkg.version ?? '', description: pkg.description ?? '' }))
  const html = renderLanding({ examples, packages, hasThumb: (key) => thumbs.has(key), hrefOf: (name) => hrefs.get(name) ?? `${name}/` })
  writeFileSync(join(dist, 'index.html'), html)
  return { examples: examples.length, built }
}
