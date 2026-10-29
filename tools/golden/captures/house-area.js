/* global GoldenTool, HouseArea */
// Capture for the "Casas e prédios" test area (sala-de-testes/area-casas): the page's six scenarios run on the page's own destruction world,
// and every event the world emits while one runs is recorded (type, part, rounded numbers). Also records each scenario's own checks.
// Params: seed. Needs window.__testRoom and HouseArea (both globals of the page).
(async () => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const room = globalThis.__testRoom
  const recorder = GoldenTool.createEventRecorder()
  HouseArea.loadInto(room)
  const plain = (value) => {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null) return value
    if (Array.isArray(value)) return value.map(plain)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).filter((key) => typeof value[key] !== 'function' && value[key] !== undefined).map((key) => [key, plain(value[key])]))
    }
    return null
  }
  const scenarios = room.scenarios.filter((scenario) => scenario.id.startsWith('house_'))
  for (const scenario of scenarios) {
    const seen = []
    const stop = room.world.on('*', (event) => seen.push(plain(event)))
    const report = await room.runScenarios([scenario])
    stop()
    recorder.record('scenario', { id: scenario.id, passed: report.passed, failed: report.failed, checks: report.results[0].checks.map((check) => check.ok), events: seen.length })
    for (const event of seen) recorder.record('world', { scenario: scenario.id, event })
  }
  return GoldenTool.createGoldenRecord({ name: 'house-area', seed, events: recorder.events() })
})()
