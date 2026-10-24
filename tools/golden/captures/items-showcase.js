/* global GoldenTool, THREE */
// Capture for the Itens do Vale Cinzento page (the 3D showcase): the 24 model builders and the wear stages, as the page's own code runs them.
// The builders live inside the page's `vitrine()` closure, so the capture cuts them out of the script text, from the materials (`const mats = []`) to the end of
// `MODELS`, plus `STAGE_TARGET`, `AMT` and `setStage` (its `draw()` call is a stub here), and evaluates that slice with the page's three.js (r128).
// Each model is hashed as the builder returns it, BEFORE the page's normalisation to 1.55 units (`sc = 1.55 / max(size)`), which the SDK replaces with a real scale.
// Params: seed, lines (`1` keeps the text of each node, so that a mismatch shows which node changed; `0` keeps only the hash).
(() => {
  const { seed, lines = '1' } = globalThis.__GOLDEN_PARAMS
  const source = [...document.scripts].map((script) => script.textContent).find((text) => text.includes('const MODELS = ['))
  const from = source.indexOf('const mats = []')
  const modelsEnd = source.indexOf('const STAGE_TARGET')
  const stageFrom = modelsEnd
  const setStageAt = source.indexOf('function setStage(s)')
  const stageEnd = source.indexOf('\n  }\n', setStageAt) + 4
  const body = `const T = THREE;\nconst draw = () => {};\n${source.slice(from, modelsEnd)}\n${source.slice(stageFrom, stageEnd)}\nreturn { mats, MODELS, setStage }`
  const { mats, MODELS, setStage } = new Function('THREE', body)(THREE)

  const round = (value) => Math.round(value * 10000) / 10000
  const recorder = GoldenTool.createEventRecorder()
  const scenes = {}
  const owned = []
  MODELS.forEach(([id, build], index) => {
    const before = mats.length
    const group = build()
    owned.push([before, mats.length])
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    recorder.record('model', { index, id, box: [round(size.x), round(size.y), round(size.z)], materials: mats.length - before })
    scenes[`model_${String(index).padStart(2, '0')}`] = group
  })
  // the materials of each model at the three stages: tag, colour as stored (r128 keeps hex values as given), roughness, metalness, opacity
  for (const stage of [0, 1, 2]) {
    setStage(stage)
    MODELS.forEach(([id], index) => {
      const [start, end] = owned[index]
      const rows = mats.slice(start, end).map((m) => [m.userData.tag, round(m.color.r), round(m.color.g), round(m.color.b), round(m.roughness), round(m.metalness), round(m.opacity)])
      recorder.record('wear', { index, id, stage, rows })
    })
  }
  setStage(0)
  const record = GoldenTool.createGoldenRecord({ name: 'items-showcase', seed, events: recorder.events(), scenes })
  if (lines === '1') return record
  return { ...record, scenes: Object.fromEntries(Object.entries(record.scenes).map(([label, scene]) => [label, { ...scene, lines: [] }])) }
})()
