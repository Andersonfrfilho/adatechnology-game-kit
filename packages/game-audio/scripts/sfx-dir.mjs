// @ts-check
// Where the kit's recorded sound files live on this machine. The SDK is public and ships no audio: git holds only the references
// (`packages/game-audio/assets/sfx/manifest.json`: id → relative path, with source, author and licence) and the files stay in the game's repository
// (ZombiAdA `assets/sfx/<categoria>/`). A build, a test or a tool that needs the files asks here; when the folder is missing they are skipped and every
// sound plays its synthesized recipe.
//
// The folder, in this order:
//   1. the environment: KIT_SFX_DIR (converted .ogg) and KIT_SFX_INBOX (originals the converter reads);
//   2. `.sfx-local.json` at the repo root (ignored by git): { "kit": "../zombiada/assets/sfx", "inbox": "../zombiada/assets/sfx-originais" },
//      paths relative to the repo root or absolute;
//   3. `.sfx/` and `.sfx-inbox/` at the repo root (ignored by git).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository root of the kit. */
export const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** The references the kit keeps in git: the manifest and the credits of every file. */
export const KIT_SFX_MANIFEST_DIR = join(KIT_ROOT, 'packages/game-audio/assets/sfx')

/** @param {string} root @returns {{ kit?: unknown, inbox?: unknown }} */
function localConfig(root) {
  const file = join(root, '.sfx-local.json')
  if (!existsSync(file)) return {}
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  return typeof parsed === 'object' && parsed !== null ? parsed : {}
}

/** @param {string} root @param {unknown} value @returns {string | undefined} */
const fromConfig = (root, value) => (typeof value === 'string' && value.length > 0 ? (isAbsolute(value) ? value : resolve(root, value)) : undefined)

/**
 * The folder of the converted files (`<categoria>/<nome>.ogg`), whether it exists or not.
 * @param {string} [root]
 * @returns {string}
 */
export function kitSfxDir(root = KIT_ROOT) {
  return process.env.KIT_SFX_DIR ? resolve(process.env.KIT_SFX_DIR) : (fromConfig(root, localConfig(root).kit) ?? join(root, '.sfx'))
}

/**
 * The folder of the originals the converter reads (`<categoria>/<nome>.wav` and `CREDITOS.md`), whether it exists or not.
 * @param {string} [root]
 * @returns {string}
 */
export function kitSfxInbox(root = KIT_ROOT) {
  return process.env.KIT_SFX_INBOX ? resolve(process.env.KIT_SFX_INBOX) : (fromConfig(root, localConfig(root).inbox) ?? join(root, '.sfx-inbox'))
}

/**
 * Whether this machine has the kit's files (the folder exists and holds at least the first file of the manifest).
 * @param {string} [root]
 * @returns {boolean}
 */
export function hasKitSfx(root = KIT_ROOT) {
  const dir = kitSfxDir(root)
  const manifestFile = join(root, 'packages/game-audio/assets/sfx/manifest.json')
  if (!existsSync(dir) || !existsSync(manifestFile)) return false
  /** @type {{ sounds: { layers: Record<string, { file: string }[]> }[] }} */
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  const first = manifest.sounds.flatMap((sound) => Object.values(sound.layers).flat())[0]
  return first !== undefined && existsSync(join(dir, first.file))
}
