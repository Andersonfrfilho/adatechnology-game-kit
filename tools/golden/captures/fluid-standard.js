/* global GoldenTool, GoldenExposed */
// Capture for the Padrão de Fluidos: the 5 scenes x 5 fluids, each started with the page's own seed formula (`runN` = 0), at speed x20,
// stepped with the page's own loop (renderer silenced). Records the thickness and dryness grids as hashes at 0.5, 1, 2, 5 and 10 s,
// the wet-cell count and how many drops were launched.
(() => {
  const X = GoldenExposed
  const FRAME_MS = 1000 / 60
  const INSTANT_FRAMES = [30, 60, 120, 300, 600]
  const SPEED = 20
  const round4 = (value) => Math.round(value * 1e4) / 1e4 + 0
  const hashArray = (array) => GoldenTool.hashText(Array.from(array, (value) => round4(value)).join(','))
  const recorder = GoldenTool.createEventRecorder()
  let launches = 0
  const launch = X.launch
  X.launch = (...args) => {
    launches++
    return launch(...args)
  }
  X.renderer.render = () => {}
  X.speed = SPEED
  const wetCells = () => {
    let cells = 0
    for (let index = 0; index < X.h.length; index++) if (X.h[index] > 0.035) cells++
    return cells
  }
  for (const scene of X.SKEYS) {
    for (const fluid of X.FKEYS) {
      X.setFluid(fluid)
      X.sk = scene
      X.runN = 0
      launches = 0
      X.runScene(true)
      let frame = 0
      for (const target of INSTANT_FRAMES) {
        GoldenTool.stepFrames(target - frame, FRAME_MS)
        frame = target
        recorder.record('fluid', { scene, fluid, seconds: round4(target / 60), h: hashArray(X.h), dry: hashArray(X.dry), wet: wetCells(), launches })
      }
    }
  }
  X.launch = launch
  return GoldenTool.createGoldenRecord({ name: 'fluid-standard', seed: 0, events: recorder.events(), scenes: {} })
})()
