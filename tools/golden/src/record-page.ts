import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const THREE_BUILD = join(TOOL_DIR, 'node_modules', 'three', 'build', 'three.min.js')
const THREE_ADDONS = join(TOOL_DIR, 'node_modules', 'three', 'examples', 'js')

/** The three.js r128 `examples/js` scripts the team pages load from jsDelivr, by file name. */
export const THREE_ADDON_FILES = {
  'OrbitControls.js': join(THREE_ADDONS, 'controls', 'OrbitControls.js'),
  'RoundedBoxGeometry.js': join(THREE_ADDONS, 'geometries', 'RoundedBoxGeometry.js'),
  'RoomEnvironment.js': join(THREE_ADDONS, 'environments', 'RoomEnvironment.js'),
} as const

export type PagePatch = {
  /** Text the patch looks for after `after` (the first match wins). */
  readonly before: string
  /** Where to start looking; the start of the page when absent. */
  readonly after?: string
  /** The code put right before `before`. */
  readonly insert: string
}

/**
 * Writes a copy of a team page with extra code inside its closure, to expose what the page keeps private (`window.__team = { hit, sever }`):
 * the page runs as it always did and the capture reaches its own functions. Returns the path of the copy.
 */
export const writePatchedPage = (pagePath: string, patches: readonly PagePatch[], directory = mkdtempSync(join(tmpdir(), 'golden-page-'))): string => {
  let html = readFileSync(pagePath, 'utf8')
  for (const patch of patches) {
    const from = patch.after === undefined ? 0 : html.indexOf(patch.after)
    if (from < 0) throw new Error(`record-page: "${patch.after}" not found in ${basename(pagePath)}`)
    const at = html.indexOf(patch.before, from)
    if (at < 0) throw new Error(`record-page: "${patch.before}" not found in ${basename(pagePath)}`)
    html = `${html.slice(0, at)}${patch.insert}${html.slice(at)}`
  }
  mkdirSync(directory, { recursive: true })
  const patched = join(directory, basename(pagePath))
  writeFileSync(patched, html)
  return patched
}

export type RecordPageOptions = {
  readonly page: string
  readonly capture: string
  readonly out: string
  readonly seed?: number
  readonly params?: Readonly<Record<string, string>>
  readonly ready?: string
  /** Names from `THREE_ADDON_FILES` the page loads. */
  readonly addons?: readonly (keyof typeof THREE_ADDON_FILES)[]
  readonly timeoutMs?: number
}

/** Runs `bin/record.mjs` (headless Chrome, seeded and frozen) for one page and one capture; needs `pnpm build` in this package first. */
export const recordPage = (options: RecordPageOptions): Promise<void> => {
  const args = [
    join(TOOL_DIR, 'bin', 'record.mjs'),
    '--page', resolve(options.page),
    '--capture', resolve(options.capture),
    '--out', resolve(options.out),
    '--seed', String(options.seed ?? 1),
    '--three', THREE_BUILD,
    '--ready', options.ready ?? 'true',
    '--timeout-ms', String(options.timeoutMs ?? 180000),
    ...Object.entries(options.params ?? {}).flatMap(([key, value]) => ['--param', `${key}=${value}`]),
    ...(options.addons ?? []).flatMap((name) => ['--addon', THREE_ADDON_FILES[name]]),
  ]
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    child.once('error', fail)
    child.once('exit', (code) => (code === 0 ? done() : fail(new Error(`record.mjs exited with ${code} for ${basename(options.page)}`))))
  })
}
