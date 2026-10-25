/* global GoldenTool */
// Capture for the Galeria do Vale Cinzento: the pieces of the urban pattern (spec 001, T7.3a): the five poles with the light budget, roads, walks, the street grid, a filled block and the props.
// Needs the recorder flag
//   --expose rng,R,root,LB,IT,WL,WD,flush,poleLED,poleConcrete,poleIron,poleWood,floodTower,road,walk,ground,streetGrid,fillBlock,FAC,building,fence,tent,pine,tree,container,watchtower,sandbags,stripLabel,wires
// Each case runs with a fresh root group and the page's own seeded generator rng(7) and a light budget of 99 unless the case says otherwise. The scene hash is the root's after the page's `flush()`
// (the instanced boxes and windows); the lists the page keeps before the flush (instanced boxes, lit and dark windows) are recorded as events, since the hash does not read instance matrices.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const page = globalThis.GoldenExposed
  const recorder = GoldenTool.createEventRecorder()
  const round = (list) => list.map((entry) => entry.map((value) => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value)))
  const CASES = [
    ['led_on', () => page.poleLED(0, 0, true)],
    ['led_off', () => page.poleLED(0, 0, false)],
    ['led_rotated', () => page.poleLED(4, -3, true, 0.7)],
    ['led_flicker', () => page.poleLED(0, 0, true, 0, true)],
    ['led_no_budget', () => { page.LB = 0; page.poleLED(0, 0, true) }],
    ['concrete_on', () => page.poleConcrete(0, 0, 1, true, false)],
    ['concrete_off', () => page.poleConcrete(0, 0, 1, false, false)],
    ['concrete_negative_arm', () => page.poleConcrete(5, 2, -1, true, false)],
    ['concrete_transformer', () => page.poleConcrete(0, 0, 1, true, true)],
    ['iron_on', () => page.poleIron(0, 0, true)],
    ['iron_off', () => page.poleIron(0, 0, false)],
    ['wood_on', () => page.poleWood(0, 0, true)],
    ['wood_off', () => page.poleWood(0, 0, false)],
    ['flood_on', () => page.floodTower(0, 0, true)],
    ['flood_off', () => page.floodTower(0, 0, false)],
    ['budget_of_two', () => { page.LB = 2; page.poleLED(0, 0, true); page.poleConcrete(8, 0, 1, true, false); page.poleIron(16, 0, true); page.poleWood(24, 0, true); page.floodTower(32, 0, true) }],
    ['road_x', () => page.road(0, 0, 7, 60, 'x')],
    ['road_z', () => page.road(10, 5, 6, 42, 'z')],
    ['walk', () => page.walk(3, 4, 60, 2)],
    ['ground', () => page.ground(0x15181a, 500)],
    ['street_grid', () => page.streetGrid(36, 2, 10)],
    ['block_default', () => page.fillBlock(0, 0, 26, 12, 36, page.FAC, { lit: 0.05, shop: 0.5 })],
    ['block_three_by_three', () => page.fillBlock(30, -20, 40, 8, 20, page.FAC, { k: 3, gap: 0.3, lit: 0.1 })],
    ['building_alone', () => page.building(0, 0, 12, 14, 20, 0x8a8a86, { lit: 0.2, shop: 1 })],
    ['fence', () => page.fence(0, 0, 9, 4, 1.2, 0x5a4630)],
    ['fence_default_colour', () => page.fence(-3, 2, 3, 2, 0.9)],
    ['tent', () => page.tent(2, 3, 0.4, 6, 8)],
    ['pine', () => page.pine(1, 2, 1.4)],
    ['tree', () => page.tree(1, 2, 1.2)],
    ['container', () => page.container(3, 0, 4, 0.2, 0x8a3a2a)],
    ['watchtower_plain', () => page.watchtower(0, 0, false)],
    ['watchtower_searchlight', () => page.watchtower(2, -3, true)],
    ['sandbags', () => page.sandbags(0, 0, 10, 'x', 3)],
    ['sandbags_z', () => page.sandbags(2, 1, 6, 'z', 2)],
    ['label', () => page.stripLabel(0, 20, 'CENTRO', 'avenida 2 × 7 m · LED branco a cada 25 m')],
    ['wires', () => page.wires([[0, 0], [10, 2], [28, -1]], 6.9)],
  ]
  const scenes = {}
  for (const [label, build] of CASES) {
    page.root = new globalThis.THREE.Group()
    page.R = page.rng(7)
    page.LB = 99
    page.IT.length = 0
    page.WL.length = 0
    page.WD.length = 0
    build()
    recorder.record('lists', {
      label,
      items: page.IT.length,
      itemsHash: GoldenTool.hashText(JSON.stringify(round(page.IT))),
      lit: page.WL.length,
      litHash: GoldenTool.hashText(JSON.stringify(round(page.WL))),
      dark: page.WD.length,
      darkHash: GoldenTool.hashText(JSON.stringify(round(page.WD))),
      lightBudgetLeft: page.LB,
    })
    page.flush()
    // what the scene hash does not read: shadows, the surface of each material and the settings of each light
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
    recorder.record('surface', { label, nodes: extra.length, hash: GoldenTool.hashText(JSON.stringify(extra)) })
    scenes[label] = page.root
  }
  return GoldenTool.createGoldenRecord({ name: 'urban-parts', seed, events: recorder.events(), scenes })
})()
