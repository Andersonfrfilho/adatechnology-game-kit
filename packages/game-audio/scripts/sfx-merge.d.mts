// The types of sfx-merge.mjs, for the tests and tools in TypeScript (the script itself is checked by tsconfig.scripts.json).
export type MergeFile = { readonly file: string }
export type MergeSound = { readonly id: string; readonly layers?: Readonly<Record<string, readonly MergeFile[] | undefined>> }
export type MergeManifest = { readonly version?: number; readonly sounds: readonly MergeSound[] }

/** The game's manifest with every sound of `user` it does not answer, those files under `prefix`. The game wins on a shared id. */
export function mergeUserSfxManifests(game: MergeManifest, user: MergeManifest, prefix: string): { manifest: MergeManifest; added: string[] }
