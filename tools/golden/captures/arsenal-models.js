/* global GoldenTool, THREE */
// Capture for the Galeria 3D do Arsenal: the model of each weapon and each cartridge, built by the page's own builders and hashed node by node.
// The builders live inside the page's closure, so the capture cuts them out of the script text (from the materials to the explosives, plus the
// casing builders) and evaluates that slice with the page's three.js. Params: seed, indexes (`all` or a comma list of WEAP positions), lines (`1` keeps
// the text of each node, so that a mismatch shows which node changed; `0` keeps only the hash).
(() => {
  const { seed, indexes = 'all', lines = '1' } = globalThis.__GOLDEN_PARAMS
  const source = [...document.scripts].map((script) => script.textContent).find((text) => text.includes('function buildWeapon'))
  const from = source.indexOf('const T = THREE')
  const to = source.indexOf('/* ---------- explosivos')
  const casingFrom = source.indexOf('function casingMesh')
  const casingTo = source.indexOf('function restFlat')
  const body = `${source.slice(from, to)}\n${source.slice(casingFrom, casingTo)}\nreturn { buildWeapon, WEAP, AMMO, cartridge }`
  const { buildWeapon, WEAP, AMMO, cartridge } = new Function('THREE', body)(THREE)

  const wanted = indexes === 'all' ? WEAP.map((_, index) => index) : indexes.split(',').map(Number)
  const recorder = GoldenTool.createEventRecorder()
  const scenes = {}
  for (const index of wanted) {
    const [name, , caliber, , length, barrel] = WEAP[index]
    recorder.record('weapon', { index, name, caliber, length, barrel })
    scenes[`weapon_${String(index).padStart(2, '0')}`] = buildWeapon(WEAP[index])
  }
  AMMO.forEach((ammo, index) => {
    recorder.record('cartridge', { index, name: ammo[0] })
    scenes[`cartridge_${String(index).padStart(2, '0')}`] = cartridge(ammo)
  })
  const record = GoldenTool.createGoldenRecord({ name: 'arsenal-gallery-models', seed, events: recorder.events(), scenes })
  if (lines === '1') return record
  return { ...record, scenes: Object.fromEntries(Object.entries(record.scenes).map(([label, scene]) => [label, { ...scene, lines: [] }])) }
})()
