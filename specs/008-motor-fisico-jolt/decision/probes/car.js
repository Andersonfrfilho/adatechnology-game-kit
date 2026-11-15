// Parked car probe (T3.0b concern): spawns a sedan, steps the room and counts the updates until the vehicle's colliders stop being pending (the car is solid), with the cost of each update.
// Then 120 steady updates with the car solid. By hand, `drive.mjs`-style: car-drive.mjs injects this file.
(async () => {
  const r = window.__testRoom
  const wait = ms => new Promise(f => setTimeout(f, ms))
  await wait(3000)
  window.requestAnimationFrame = () => 0
  await wait(300)
  const impls = []
  const register = r.world.register.bind(r.world)
  r.world.register = (impl, options) => { impls.push(impl); return register(impl, options) }
  const idleTimes = []
  for (let i = 0; i < 60; i++) { const t0 = performance.now(); r.update(1 / 60); idleTimes.push(performance.now() - t0) }
  const tSpawn0 = performance.now()
  r.spawn('__MODEL__', [4, 0, -4])
  const spawnMs = performance.now() - tSpawn0
  const impl = impls.find(i => typeof i.collidersPending === 'function')
  const fill = []
  let solidAfter = -1
  for (let i = 0; i < 400; i++) {
    const t0 = performance.now(); r.update(1 / 60); fill.push(performance.now() - t0)
    if (solidAfter < 0 && impl && !impl.collidersPending()) { solidAfter = i + 1 }
    if (solidAfter >= 0 && i >= solidAfter + 120) break
    if (i % 20 === 0) await wait(5)
  }
  const stat = a => { const s = [...a].sort((x, y) => x - y); return { p50: +s[Math.floor(s.length * 0.5)].toFixed(2), p99: +s[Math.floor(s.length * 0.99)].toFixed(2), max: +s[s.length - 1].toFixed(2) } }
  const filling = solidAfter > 0 ? fill.slice(0, solidAfter) : fill
  const steady = solidAfter > 0 ? fill.slice(solidAfter) : []
  const colliderCount = impl && impl.colliders ? impl.colliders().length : null
  return { model: '__MODEL__', hasImpl: !!impl, spawnMs: +spawnMs.toFixed(1), solidAfterUpdates: solidAfter, solidAfterSeconds: solidAfter > 0 ? +(solidAfter / 60).toFixed(2) : null, idleBeforeCar: stat(idleTimes), fillingMs: stat(filling), fillingTotalMs: +filling.reduce((a, b) => a + b, 0).toFixed(1), steadyWithCarMs: steady.length ? stat(steady) : null, colliderPieces: colliderCount }
})()
