// @ts-check
// The test room's own sounds come from two places: a game's folder named by `.sfx-local.json` ("root" and "manifest") and `.sfx-local/`, the
// files `sfx:user` converts from `user-sounds/picks.json`. Both are served under one `sfx-local/`: the game's manifest as it is, and every sound of
// `.sfx-local/` the game does not answer, its files under `prefix` (the folder the build links `.sfx-local/` to). The game wins on a shared id.

/** @typedef {{ readonly file: string }} MergeFile */
/** @typedef {{ readonly id: string, readonly layers?: Readonly<Record<string, readonly MergeFile[] | undefined>> }} MergeSound */
/** @typedef {{ readonly version?: number, readonly sounds: readonly MergeSound[] }} MergeManifest */

/**
 * @param {MergeManifest} game the game's manifest (file paths relative to its root)
 * @param {MergeManifest} user `.sfx-local/manifest.json` (file paths relative to `.sfx-local/`)
 * @param {string} prefix where `.sfx-local/` is linked next to the game's folders, ending in `/`
 * @returns {{ manifest: MergeManifest, added: string[] }}
 */
export function mergeUserSfxManifests(game, user, prefix) {
  const ids = new Set(game.sounds.map((sound) => sound.id))
  /** @type {MergeSound[]} */
  const extra = []
  for (const sound of user.sounds) {
    if (ids.has(sound.id)) continue
    ids.add(sound.id)
    /** @type {Record<string, MergeFile[]>} */
    const layers = {}
    for (const [layer, files] of Object.entries(sound.layers ?? {})) if (files) layers[layer] = files.map((entry) => ({ ...entry, file: `${prefix}${entry.file}` }))
    extra.push({ ...sound, layers })
  }
  return { manifest: { ...game, sounds: [...game.sounds, ...extra] }, added: extra.map((sound) => sound.id) }
}
