/* global GoldenTool */
// Capture for the Garagem artifact (VehicleSDK global).
// Params: key = the page's vehicle key (e.g. hatch), seed, gameOnlyFlags = comma list of crash flags that only the game adds (e.g. blood).
(() => {
  const { key, seed, gameOnlyFlags = '' } = globalThis.__GOLDEN_PARAMS
  const ZG = globalThis.VehicleSDK
  const gameOnly = gameOnlyFlags.split(',').filter(Boolean)
  // the page's Portuguese scenario ids, recorded under the SDK's English ids
  const SCENARIOS = { front_crash: 'frontal', rollover: 'capotado' }
  const recorder = GoldenTool.createEventRecorder()

  function runScenario(vehicle, pageId) {
    const result = ZG.zoneScenario(vehicle, pageId)
    for (const flag of gameOnly) delete result.flags[flag]
    return result
  }

  const probe = ZG.build(key, 'intacto')
  const scenes = {
    intact: ZG.build(key, 'intacto').root,
    damaged: ZG.build(key, 'danificado', runScenario(probe, ZG.config.damagedScenario)).root,
    modified: ZG.build(key, 'modificado').root,
  }
  for (const [id, pageId] of Object.entries(SCENARIOS)) {
    const result = runScenario(probe, pageId)
    const flags = Object.keys(result.flags).filter((flag) => result.flags[flag]).sort()
    recorder.record('scenario', { id, flags, health: result.h })
  }
  return GoldenTool.createGoldenRecord({ name: `garage-${key}`, seed, events: recorder.events(), scenes })
})()
