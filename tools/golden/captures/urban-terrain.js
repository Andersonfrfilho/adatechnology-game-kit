/* global GoldenTool */
// Capture for the Galeria do Vale Cinzento: the ground of `buildWorld` (spec 001, T7.3c): the square mesh of 181 x 181 vertices, its heights and its vertex colours.
// Needs the recorder flag
//   --expose rng,R,root,LB,IT,WL,WD,env,pin,buildWorld,hW,forestF
// `env` and `pin` are stubbed (lights and map pins are not the ground). The page builds the whole world; the capture reads the terrain mesh out of the root (the only
// PlaneGeometry with vertex colours) and records the hash of its positions and colours, a few sample vertices, and the page's own `hW` and `forestF` on a 9 x 9 grid of the map.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const page = globalThis.GoldenExposed
  const recorder = GoldenTool.createEventRecorder()
  const round4 = (value) => Math.round(value * 1e4) / 1e4 + 0
  page.env = () => {}
  page.pin = () => {}
  page.root = new globalThis.THREE.Group()
  page.R = page.rng(7)
  page.LB = 0
  page.IT.length = 0
  page.WL.length = 0
  page.WD.length = 0
  page.buildWorld()
  const mesh = page.root.children.find((child) => child.geometry && child.geometry.type === 'PlaneGeometry' && child.material && child.material.vertexColors)
  const position = mesh.geometry.attributes.position
  const color = mesh.geometry.attributes.color
  const positions = Array.from(position.array, round4)
  const colors = Array.from(color.array, round4)
  const heights = []
  for (let index = 0; index < position.count; index++) heights.push(position.getY(index))
  recorder.record('terrain', {
    vertices: position.count,
    positionsHash: GoldenTool.hashText(JSON.stringify(positions)),
    colorsHash: GoldenTool.hashText(JSON.stringify(colors)),
    minHeight: round4(Math.min(...heights)),
    maxHeight: round4(Math.max(...heights)),
    receiveShadow: mesh.receiveShadow,
    castShadow: mesh.castShadow,
    flatShading: mesh.material.flatShading,
    roughness: mesh.material.roughness,
    firstThree: positions.slice(0, 9),
    middle: positions.slice(position.count * 1.5 - 3, position.count * 1.5 + 3),
    colorsMiddle: colors.slice(color.count * 1.5 - 3, color.count * 1.5 + 3),
  })
  const samples = []
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
    const px = i * 100
    const py = j * 100
    samples.push([px, py, round4(page.hW(px, py)), round4(page.forestF(px, py))])
  }
  recorder.record('samples', { rows: samples })
  return GoldenTool.createGoldenRecord({ name: 'urban-terrain', seed, events: recorder.events(), scenes: {} })
})()
