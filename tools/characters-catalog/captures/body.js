/* global GoldenTool, THREE */
// Capture for the game's Bestiário v17 body (`BEST.build`, `bakeBody`), cut out of jogo.js and run against the game's own three.js (r160).
// `__SLICES.best` is the cut code, `__SLICES.types` the 13 types as `{ id, name }` (English id, the name the builder looks up) and
// `__SLICES.variantCounts` the variants per type of the ZVAR block. Scenes keep only their hash (the nodes are many and the hash says which changed).
// Hash of an array: FNV-1a 32 over `Math.round(value * 1e4)` of every element, the same function the SDK test uses.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const slices = globalThis.__SLICES
  const { BEST, bakeBody } = new Function('THREE', `${slices.best}\nreturn { BEST, bakeBody }`)(THREE)
  const recorder = GoldenTool.createEventRecorder()
  const scenes = {}
  const LODS = [1, 0.5, 0.28]
  const DECAYS = [0, 1, 2, 3]
  const SEEDS = [1, 2, 3, 4, 5]
  const fnv = (array) => {
    let hash = 0x811c9dc5
    for (let index = 0; index < array.length; index++) {
      hash = Math.imul(hash ^ (Math.round(array[index] * 1e4) | 0), 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
  }
  recorder.record('hash', { algorithm: 'fnv1a-32 over round(value * 1e4)' })

  for (const type of slices.types) {
    for (const decay of DECAYS) {
      for (const bodySeed of SEEDS) {
        for (const lod of LODS) {
          BEST.setLOD(lod)
          const root = BEST.build({ type: type.name, decay, seed: bodySeed })
          const snapshot = GoldenTool.snapshotScene(root)
          scenes[`best_${type.id}_d${decay}_s${bodySeed}_l${lod}`] = { objects: snapshot.objects, hash: snapshot.hash, lines: [] }
        }
      }
    }
  }

  for (const type of slices.types) {
    const variants = slices.variantCounts[type.id]
    for (let variant = 0; variant < variants; variant++) {
      const spec = { type: type.name, decay: [1, 2, 1, 2][variant % 4], seed: 7000 + type.index * 101 + variant * 13 }
      for (const lod of LODS) {
        const baked = bakeBody(spec, lod)
        const attributes = Object.fromEntries(Object.entries(baked.geo.attributes).map(([name, attribute]) => [name, fnv(attribute.array)]))
        recorder.record('bake', { type: type.id, variant, decay: spec.decay, seed: spec.seed, lod, vertices: baked.verts, scale: baked.s, bulk: baked.bulk, indices: baked.geo.index.count, ...attributes, index: fnv(baked.geo.index.array) })
      }
    }
  }
  return { schema: 1, name: 'game-best-body', seed: Number(seed), events: recorder.events(), scenes }
})()
