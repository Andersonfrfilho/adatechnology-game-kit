// @ts-check
// What the test-room page bundles, in one place: build.mjs bundles from it and tools/gpu/stale-dist.mjs checks it.

/** Packages bundled from their `dist/index.js`. */
export const DIST_PACKAGES = ['game-audio', 'game-player', 'game-runtime', 'game-contracts', 'game-destruction', 'game-destruction-three', 'game-weapons', 'game-fluids', 'game-fluids-three', 'game-vfx', 'game-vfx-three', 'game-render-three', 'game-terrain', 'game-terrain-three', 'game-characters', 'game-characters-people', 'game-characters-three', 'game-kit-defaults', 'game-floorplan', 'game-floorplan-structure', 'game-floorplan-residential', 'game-floorplan-interactables', 'game-floorplan-three', 'game-props3d', 'game-shapes', 'game-shapes-three', 'game-weapons-three', 'game-graphics', 'game-graphics-three', 'game-test-room', 'game-workers', 'game-crowd']

/** Packages bundled from `src` (the page's joltBoot): their source is read directly, so there is no dist to be stale. */
export const SOURCE_PACKAGES = ['game-physics', 'game-physics-jolt']

/** Subpath imports of a dist package (`@adatechnology/<package>/<subpath>` -> `dist/<subpath>.js`). */
export const DIST_SUBPATHS = /** @type {Record<string, string[]>} */ ({
  'game-graphics': ['screen'],
  'game-audio': ['fitted'],
  'game-destruction-three': ['worker-kinds'],
  'game-shapes': ['worker-kinds'],
  'game-vehicles': ['worker-kinds'],
  'game-kit-defaults': ['world'],
  'game-player': ['hud'],
})

/** Other dist files the build reads (inlined as a classic script). */
export const DIST_EXTRA_FILES = /** @type {Record<string, string[]>} */ ({ 'game-kit-defaults': ['dist/kit-worker.global.js'] })

/** The dist files of a package the page resolves, relative to the package folder. @param {string} name @returns {string[]} */
export const distFilesOf = (name) => ['dist/index.js', ...(DIST_SUBPATHS[name] ?? []).map((subpath) => `dist/${subpath}.js`), ...(DIST_EXTRA_FILES[name] ?? [])]
