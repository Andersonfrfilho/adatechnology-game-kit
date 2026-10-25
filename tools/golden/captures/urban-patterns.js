/* global GoldenTool */
// Capture for the Galeria do Vale Cinzento: the sample sheet of the nine neighbourhood patterns and the military cell (`buildPadraoRuas`, spec 001, T7.3b).
// Needs the recorder flag
//   --expose rng,R,root,LB,IT,WL,WD,flush,buildPadraoRuas,car,env,pin
// The page runs as the game runs it, with two stubs the SDK does not own: `env` (the lights and the fog of the scene) and `car` (the page's own box car, which the lite fleet replaces
// through the vehicle provider). `car` draws nothing from the random, so the sequence is the page's. The page's `flush()` is wrapped to record the lists it keeps (instanced boxes, lit and
// dark windows) before it empties them, since the scene hash does not read instance matrices. The scene is the root after the page's own `flush()`.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const page = globalThis.GoldenExposed
  const recorder = GoldenTool.createEventRecorder()
  const round = (list) => list.map((entry) => entry.map((value) => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value)))
  const realFlush = page.flush
  page.env = () => {}
  page.car = () => {}
  page.pin = (x, y, z, kind, label, detail) => recorder.record('pin', { x, y, z, kind, label, detail })
  page.flush = () => {
    recorder.record('lists', {
      items: page.IT.length,
      itemsHash: GoldenTool.hashText(JSON.stringify(round(page.IT))),
      lit: page.WL.length,
      litHash: GoldenTool.hashText(JSON.stringify(round(page.WL))),
      dark: page.WD.length,
      darkHash: GoldenTool.hashText(JSON.stringify(round(page.WD))),
      lightBudgetLeft: page.LB,
    })
    realFlush()
  }
  page.root = new globalThis.THREE.Group()
  page.R = page.rng(7)
  page.LB = 0
  page.IT.length = 0
  page.WL.length = 0
  page.WD.length = 0
  page.buildPadraoRuas()
  recorder.record('after', { next: page.R(), lightBudgetLeft: page.LB })
  const extra = []
  page.root.traverse((node) => {
    const material = node.material
    extra.push([
      node.type,
      node.castShadow ? 1 : 0,
      node.receiveShadow ? 1 : 0,
      material ? [material.type, material.roughness, material.metalness, material.flatShading ? 1 : 0, material.transparent ? 1 : 0, material.side, material.depthWrite ? 1 : 0].join(':') : '',
      node.isLight ? [node.color.getHex(), node.intensity, node.distance, node.decay, node.angle, node.penumbra].join(':') : '',
      node.count ?? '',
    ])
  })
  recorder.record('surface', { nodes: extra.length, hash: GoldenTool.hashText(JSON.stringify(extra)) })
  return GoldenTool.createGoldenRecord({ name: 'urban-patterns', seed, events: recorder.events(), scenes: { sample_sheet: page.root } })
})()
