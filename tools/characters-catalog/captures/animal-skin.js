/* global GoldenTool, THREE */
// Capture for the game's GPU animal skin (`bichoPele`): the 13 species built by the game's copy of the Bichos do Vale builders (`BICHOS`) and merged
// into one skinned geometry, cut out of jogo.js and run against the game's own three.js (r160). Attributes are hashed (FNV-1a 32 over `Math.round(value * 1e4)`).
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const slices = globalThis.__SLICES
  const { BICHOS, bichoPele } = new Function('THREE', 'scene', `${slices.animals}\nreturn { BICHOS, bichoPele }`)(THREE, new THREE.Scene())
  const recorder = GoldenTool.createEventRecorder()
  const fnv = (array) => {
    let hash = 0x811c9dc5
    for (let index = 0; index < array.length; index++) hash = Math.imul(hash ^ (Math.round(array[index] * 1e4) | 0), 0x01000193) >>> 0
    return hash.toString(16).padStart(8, '0')
  }
  recorder.record('hash', { algorithm: 'fnv1a-32 over round(value * 1e4)' })
  for (const species of slices.species) {
    const sp = BICHOS.SPECIES.find((entry) => entry.id === species.sourceId)
    for (const infected of [false, true]) {
      const animal = sp.snake ? BICHOS.snake(sp) : sp.b ? BICHOS.bird(sp) : BICHOS.quad(sp)
      animal.id = species.sourceId
      animal.home = animal.root.position.clone() // the page sets it when it lines the animals up; `setInfected` reads it for the pool of a dead one
      if (infected) BICHOS.setInfected(animal, true)
      const skin = bichoPele(animal)
      const attributes = Object.fromEntries(Object.entries(skin.mesh.geometry.attributes).map(([name, attribute]) => [name, fnv(attribute.array)]))
      recorder.record('skin', { species: species.id, infected, nodes: skin.nos.length, vertices: skin.mesh.geometry.attributes.position.count, size: animal.size, infectedVisual: animal.infected === true, dead: animal.dead === true, ...attributes })
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'game-animal-skin', seed: Number(seed), events: recorder.events() })
})()
