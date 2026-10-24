/* global GoldenTool, THREE */
// Capture for the game's instanced body (`buildBody` at 16, 10 and 5 segments, with the joints `J` of the game), cut out of jogo.js and run against
// the game's own three.js (r160): the merged geometry of each LOD, hashed attribute by attribute (FNV-1a 32 over `Math.round(value * 1e4)`).
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const { buildBody } = new Function('THREE', `${globalThis.__SLICES.instanced}\nreturn { buildBody }`)(THREE)
  const recorder = GoldenTool.createEventRecorder()
  const scenes = {}
  const fnv = (array) => {
    let hash = 0x811c9dc5
    for (let index = 0; index < array.length; index++) hash = Math.imul(hash ^ (Math.round(array[index] * 1e4) | 0), 0x01000193) >>> 0
    return hash.toString(16).padStart(8, '0')
  }
  recorder.record('hash', { algorithm: 'fnv1a-32 over round(value * 1e4)' })
  for (const segments of [16, 10, 5]) {
    const geometry = buildBody(segments)
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, fnv(attribute.array)]))
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    recorder.record('body', { segments, vertices: geometry.attributes.position.count, triangles: geometry.attributes.position.count / 3, box: [min.x, min.y, min.z, max.x, max.y, max.z], ...attributes })
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }))
    const snapshot = GoldenTool.snapshotScene(mesh)
    scenes[`body_${segments}`] = { objects: snapshot.objects, hash: snapshot.hash, lines: [] }
  }
  return { schema: 1, name: 'game-instanced-body', seed: Number(seed), events: recorder.events(), scenes }
})()
