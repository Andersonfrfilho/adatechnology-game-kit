/* global GoldenTool */
// Capture for the Bichos do Vale page: the 13 species the page builds (`quad`, `bird`, `snake`), alive, infected or dead (`setInfected`), and after
// the three step clips (`animQuad`, `animBird`, `animSnake`), each as a scene hash with its nodes. `__SLICES.species` has `{ id, sourceId }` per species.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const team = globalThis.__team
  const recorder = GoldenTool.createEventRecorder()
  const scenes = {}
  const CLIPS = ['walk', 'trot', 'gallop']
  // the nodes are kept for the alive animal (to see which part changed); the other states keep only the hash
  const snapshot = (label, root, keepNodes = false) => {
    const taken = GoldenTool.snapshotScene(root)
    scenes[label] = { objects: taken.objects, hash: taken.hash, lines: keepNodes ? taken.lines : [] }
  }
  const visible = (animal) => ({ infected: animal.infected === true, dead: animal.dead === true, earsVisible: animal.ears.length === 0 ? true : animal.ears[0].visible, poolVisible: animal.pool ? animal.pool.visible : false, triangles: animal.tris })

  for (const species of globalThis.__SLICES.species) {
    const animal = team.ANIMALS.find((entry) => entry.id === species.sourceId)
    snapshot(`${species.id}_alive`, animal.root, true)
    recorder.record('alive', { species: species.id, ...visible(animal) })
    team.setInfected(animal, true)
    snapshot(`${species.id}_bitten`, animal.root)
    recorder.record('bitten', { species: species.id, ...visible(animal) })
    team.setInfected(animal, false)
    recorder.record('healed', { species: species.id, ...visible(animal) })
    for (const clip of CLIPS) {
      team.st.clip = clip
      team.st.sel = animal.id
      const animate = animal.sp.snake ? team.animSnake : animal.sp.b ? team.animBird : team.animQuad
      animate(animal, 0.5, 1 / 60)
      snapshot(`${species.id}_${clip}`, animal.root)
    }
  }
  return { schema: 1, name: 'animals-page', seed: Number(seed), events: recorder.events(), scenes }
})()
