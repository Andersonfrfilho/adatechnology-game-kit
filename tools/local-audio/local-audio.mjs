// @ts-check
// A local sound pack (game-audio's `LocalSoundPack`) on this machine only. `audio.local.json` at the repo root (git-ignored) says where the files are
// (`root`, an absolute folder) and which SDK id each one answers. The files never enter the repo nor any build:
//   link <dist>   points `<dist>/local-audio/files` at `root` (a symlink, never a copy) and writes `<dist>/local-audio/pack.json` for the page;
//   guard <dir>   fails when <dir> holds an audio file that is not one of the SDK's own (`packages/game-audio/assets/sfx/manifest.json`) or a copied
//                 `local-audio` folder (the symlink is allowed: it is not followed and no deploy dereferences it);
//   guard-git     fails when git tracks or stages the config, a `local-audio/` folder or an audio file outside the SDK's sfx folders.
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CONFIG = process.env.LOCAL_AUDIO_CONFIG ?? join(REPO, 'audio.local.json')
const AUDIO = /\.(wav|ogg|mp3|flac|aif|aiff|m4a|opus)$/i
const LOCAL_DIR = 'local-audio'
// the SDK's own sound folders: converted files and the credited inbox
const SDK_AUDIO = [/^packages\/game-audio\/assets\/sfx\//, /^assets\/sfx-inbox\//, /^packages\/game-audio\/tests\/fixtures\//]

/** @param {string} message */
const fail = (message) => {
  console.error(`local-audio: ${message}`)
  process.exit(1)
}

/** @returns {{ root: string, sounds: Record<string, unknown> }} */
function readConfig() {
  if (!existsSync(CONFIG)) fail(`no ${relative(REPO, CONFIG)} (copy examples/test-room/audio.local.example.json and fill it)`)
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(CONFIG, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null) fail('the config is not an object')
  const config = /** @type {{ root?: unknown, sounds?: unknown }} */ (parsed)
  if (typeof config.root !== 'string' || !existsSync(config.root)) fail('`root` must be an existing folder')
  if (typeof config.sounds !== 'object' || config.sounds === null) fail('`sounds` must be an object of id → entry')
  return { root: /** @type {string} */ (config.root), sounds: /** @type {Record<string, unknown>} */ (config.sounds) }
}

/** @param {string} dist */
function link(dist) {
  const { root, sounds } = readConfig()
  const target = join(dist, LOCAL_DIR)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  symlinkSync(root, join(target, 'files'), 'dir')
  writeFileSync(join(target, 'pack.json'), JSON.stringify({ version: 1, baseUrl: `${LOCAL_DIR}/files/`, sounds }))
  console.log(`local-audio: ${Object.keys(sounds).length} ids linked into ${relative(REPO, target)} (files stay in ${root})`)
}

/** The SDK's own audio files, as paths relative to its sfx folder. */
function sdkFiles() {
  const manifest = join(REPO, 'packages/game-audio/assets/sfx/manifest.json')
  if (!existsSync(manifest)) return new Set()
  /** @type {{ sounds: { layers: Record<string, { file: string }[]> }[] }} */
  const parsed = JSON.parse(readFileSync(manifest, 'utf8'))
  return new Set(parsed.sounds.flatMap((sound) => Object.values(sound.layers).flat().map((entry) => entry.file)))
}

/** @param {string} dir @returns {string[]} problems */
function guardDir(dir) {
  const allowed = sdkFiles()
  /** @type {string[]} */
  const problems = []
  /** @param {string} folder */
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) continue
      const rel = relative(dir, path).split(sep).join('/')
      if (stat.isDirectory()) {
        walk(path)
        continue
      }
      if (rel.split('/').includes(LOCAL_DIR) && name !== 'pack.json') problems.push(`${rel}: a copied local-audio file`)
      else if (AUDIO.test(name) && !allowed.has(rel.replace(/^.*?sfx\//, ''))) problems.push(`${rel}: audio that is not one of the SDK's files`)
    }
  }
  if (existsSync(dir)) walk(dir)
  return problems
}

/** @returns {string[]} problems */
function guardGit() {
  const tracked = execFileSync('git', ['ls-files', '--cached'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
  return tracked.flatMap((file) => {
    if (/(^|\/)audio\.local\.json$/.test(file)) return [`${file}: the local config is tracked`]
    if (/(^|\/)dist\/local-audio\/|^local-audio\//.test(file)) return [`${file}: a local-audio folder is tracked`]
    if (AUDIO.test(file) && !SDK_AUDIO.some((pattern) => pattern.test(file))) return [`${file}: audio outside the SDK's sfx folders`]
    return []
  })
}

const [command, argument] = process.argv.slice(2)
if (command === 'link' && argument) link(resolve(argument))
else if (command === 'guard' && argument) {
  const problems = guardDir(resolve(argument))
  if (problems.length > 0) fail(`${problems.length} file(s) must not ship:\n  ${problems.slice(0, 20).join('\n  ')}`)
} else if (command === 'guard-git') {
  const problems = guardGit()
  if (problems.length > 0) fail(`${problems.length} file(s) must not be in git:\n  ${problems.slice(0, 20).join('\n  ')}`)
} else fail('usage: local-audio.mjs link <dist> | guard <dir> | guard-git')
