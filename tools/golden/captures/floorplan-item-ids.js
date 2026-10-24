/* global GoldenTool, PlantasSDK */
// Capture for the Visor de casas 3D: the ids of the items of each generated plan, in order, as the installations (gas, electricity,
// plumbing, outbuildings) refer to them. The package that ports them puts its own ids (`living.tv_unit_back`) back to these by position.
// Params: seedFrom (1), seedTo (25), states (comma list, default every state), templates (comma list, default all).
(() => {
  const { seed, seedFrom = '1', seedTo = '25', states = '', templates = '' } = globalThis.__GOLDEN_PARAMS
  const recorder = GoldenTool.createEventRecorder()
  const wantedStates = states ? states.split(',') : PlantasSDK.estados
  const wantedTemplates = templates ? templates.split(',') : PlantasSDK.listarTemplates().map((entry) => entry.id)
  for (const template of wantedTemplates) {
    for (let planSeed = Number(seedFrom); planSeed <= Number(seedTo); planSeed++) {
      for (const state of wantedStates) {
        const res = PlantasSDK.gerar(template, { semente: planSeed, estado: state })
        const items = res.moveis.filter((item) => item.tipo !== 'botijao_gas')
        recorder.record('item-ids', { template, seed: planSeed, state, ids: items.map((item) => item.id).join('|') })
      }
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'vc3-item-ids', seed, events: recorder.events() })
})()
