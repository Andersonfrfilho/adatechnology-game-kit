/* global GoldenTool, PlantasSDK, Casa3DSDK */
// Capture for the Visor de casas 3D: structure and utilities of each generated plan, plus the destruction spec Casa3DSDK.specDe builds from it
// (coarse = one piece per wall as the team does; vedacao = bearing walls demoted to partitions).
// Params: seedFrom (1), seedTo (25), states (comma list, default every state), templates (comma list, default all), rows (1 adds the readable JSON of each piece).
// Every value is the canonical JSON of the team's own object (keys sorted, numbers rounded to 3 decimals) hashed with GoldenTool.hashText.
(() => {
  const { seed, seedFrom = '1', seedTo = '25', states = '', templates = '', rows: withRows = '0' } = globalThis.__GOLDEN_PARAMS
  const recorder = GoldenTool.createEventRecorder()
  const canonical = (value) => {
    if (typeof value === 'number') return Math.round(value * 1000) / 1000 + 0
    if (Array.isArray(value)) return value.map(canonical)
    if (value === undefined || typeof value === 'function') return null
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    return value
  }
  const text = (value) => JSON.stringify(canonical(value))
  const hashOf = (value) => GoldenTool.hashText(text(value))
  const hashRows = (list) => GoldenTool.hashText(list.map(text).join('\n'))

  const wantedStates = states ? states.split(',') : PlantasSDK.estados
  const wantedTemplates = templates ? templates.split(',') : PlantasSDK.listarTemplates().map((entry) => entry.id)
  for (const template of wantedTemplates) {
    for (let planSeed = Number(seedFrom); planSeed <= Number(seedTo); planSeed++) {
      for (const state of wantedStates) {
        const res = PlantasSDK.gerar(template, { semente: planSeed, estado: state })
        const structure = res.estrutura
        const coarse = Casa3DSDK.specDe(structure, {})
        const enclosure = Casa3DSDK.specDe(structure, { vedacao: true })
        const lists = { pieces: structure.pecas, supports: structure.apoios, coarseParts: coarse.parts, coarseJoints: coarse.joints, enclosureParts: enclosure.parts, enclosureJoints: enclosure.joints }
        const counts = Object.fromEntries(Object.entries(lists).map(([name, list]) => [name, list.length]))
        const hashes = Object.fromEntries(Object.entries(lists).map(([name, list]) => [name, hashRows(list)]))
        const singles = { levels: [structure.niveis, structure.elevacao], construction: res.construcao, roof: res.telhado, waterTank: res.caixaDagua, outbuildings: res.edificacoes, gas: res.gas, electrical: res.eletrica, solar: res.paineisSolares, plumbing: res.hidraulica }
        const utilities = Object.fromEntries(Object.entries(singles).map(([name, value]) => [name, hashOf(value)]))
        recorder.record('structure', {
          template, seed: planSeed, state, counts, hashes, utilities,
          ...(withRows === '1' ? { rows: { pieces: structure.pecas.map(text), coarseParts: coarse.parts.map(text), enclosureParts: enclosure.parts.map(text), roof: text(res.telhado), construction: text(res.construcao) } } : {}),
        })
      }
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'vc3-floorplan-structure', seed, events: recorder.events() })
})()
