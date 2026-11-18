// Bundles src/kit-worker.js (the room's worker: installWorkerHost with the kinds of the room's modules) into one classic script, as text: the
// pages embed it with esbuild's `define` (`__KIT_WORKER_SOURCE__`) and make their workers from it with `sourceSpawn`.
import { join } from 'node:path'

/**
 * @param {{ build: (options: Record<string, unknown>) => Promise<{ outputFiles: { text: string }[] }> }} esbuild
 * @param {string} root the repository root
 * @param {string} [entry] the worker's file in this example: the coordinator's worker, or `src/sim-worker.js` (the horde's simulation thread)
 * @returns {Promise<string>}
 */
export async function kitWorkerSource(esbuild, root, entry = 'src/kit-worker.js') {
  const pkg = (/** @type {string} */ name) => join(root, 'packages', name, 'dist/index.js')
  const result = await esbuild.build({
    entryPoints: [join(root, 'examples/crowd-test-area', entry)],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    alias: Object.fromEntries(['game-crowd', 'game-workers', 'game-contracts', 'game-characters'].map((p) => [`@adatechnology/${p}`, pkg(p)])),
  })
  return result.outputFiles[0].text
}
