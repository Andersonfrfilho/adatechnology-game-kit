/* global GoldenTool, PlantasSDK, Casa3DSDK, Moveis3DSDK */
// Capture for the Visor de casas 3D: the scene Casa3DSDK.construir draws for a plan (spec 001, T2.4e).
// Params: pairs (comma list of template:seed, default the six of game-floorplan-three), state (default normal).
// Casa3DSDK.criar gets neither the interactables kit nor the car fleet nor a Reflector, so the golden holds the house itself: walls, doors,
// windows, floors, slabs, stairs, furniture, lights, roofs, lot, gutters, utilities. Roots per pair: house (the whole group), lot, roof and
// one per floor. The ids of the plan (rooms, doors, windows, items) are recorded in the pair's event so a package test can map the new ids
// to the legacy ones for the seeded draws (`seedKey` option of the renderer).
// Node names are left out of the hash: the new package names its meshes in English, the page's in Portuguese.
// Then the LOD planner (Casa3DSDK.planejaLOD): the houses stand 60 m apart along x and the planner runs for a few foci and draw-call budgets;
// each `lod-plan` event holds the levels, the total and the level each house ended on.
// It needs the page's own three.js (an importmap module), hence the async function (the recorder awaits it).
;(async () => {
  const THREE = await import('three')
  const { seed, pairs = 'casaA:3,sobrado:3,apartamento:1,media_terrea_moderna:3,mercado:3,farmacia:2', state = 'normal' } = globalThis.__GOLDEN_PARAMS
  const recorder = GoldenTool.createEventRecorder()
  const sdk = Casa3DSDK.criar(THREE, { Moveis3DSDK, document })
  const scenes = {}
  const built = []
  for (const pair of pairs.split(',')) {
    const [template, n] = pair.split(':')
    const plan = PlantasSDK.gerar(template, { semente: Number(n), estado: state })
    const house = sdk.construir(plan, { qualidade: 'alta', noite: false })
    const key = `${template}_${n}`
    recorder.record('house', {
      key, template, seed: Number(n), state,
      ids: { template: plan.template, rooms: plan.comodos.map((c) => c.id), doors: plan.portas.map((d) => d.id), windows: plan.janelas.map((w) => w.id), items: plan.moveis.map((m) => m.id) },
      floors: house.andares.length,
    })
    built.push({ key, house })
    scenes[`${key}/house`] = house.grupo
    if (house.lote) scenes[`${key}/lot`] = house.lote
    if (house.telhado) scenes[`${key}/roof`] = house.telhado
    house.andares.forEach((floor, i) => { scenes[`${key}/floor${i}`] = floor })
  }
  built.forEach(({ key, house }, i) => {
    house.grupo.position.x = i * 60
    house.grupo.updateMatrixWorld(true)
    recorder.record('stats', { key, drawCalls: house.stats.drawCalls, drawCallsLOD1: house.stats.drawCallsLOD1, triangles: house.stats.triangulos })
  })
  const houses = built.map((b) => b.house)
  const foci = [[0, 0, 0], [150, 0, 0], [300, 0, 0], [-500, 0, 0], [120, 0, 40]]
  const budgets = [1e9, 1200, 800, 400, 200]
  for (const [fx, fy, fz] of foci) {
    for (const budget of budgets) {
      const plan = Casa3DSDK.planejaLOD(houses, { x: fx, y: fy, z: fz }, budget)
      recorder.record('lod-plan', { focus: [fx, fy, fz], budget, total: plan.total, levels: plan.niveis, order: plan.casas.map((h) => built.findIndex((b) => b.house === h)), applied: houses.map((h) => h.lod ?? h.lodAtual) })
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'house-scene', seed, events: recorder.events(), scenes, hashOptions: { ignoreNames: true } })
})()
