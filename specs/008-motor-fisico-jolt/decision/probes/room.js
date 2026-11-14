// Room probe (blast or hammer) measured with the one ruler of spec 008 (`packages/game-destruction-three/tests/energy-ruler.ts`).
// `drive.mjs` puts the ruler's exports in scope as `EnergyRuler` and swaps the kind marker (blast | hammer).
// Ruler of the room: only the gain with no input from outside counts (C2); sleep counts from the last input from outside (C4).
(async () => {
  const KIND = '__KIND__'
  const r = window.__testRoom
  const wait = ms => new Promise(f => setTimeout(f, ms))
  r.openArea('floorplan_area')
  const b = r.bench('floorplan_area')
  b.set('package', 'residential'); b.set('template', 'single_storey_a'); b.set('seed', 1)
  b.act('build')
  await wait(8000)
  window.requestAnimationFrame = () => 0
  await wait(300)
  const THREE = r.camera.position.constructor
  const v = new THREE()
  const base = new Set(r.renderer.pieces().map(p => p.objectId))
  const o = r.world.serialize().objects.find(x => x.id === 'house3d:1').state.position
  const spot = [o[0] - 2.5, 0.6, o[2]]
  const sampleOf = p => {
    p.root.updateMatrixWorld(true)
    const c = v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld)
    const centre = [c.x, c.y, c.z]
    const w = v.set(p.angularVelocity[0], p.angularVelocity[1], p.angularVelocity[2]).applyQuaternion(p.root.quaternion.clone().invert())
    const [hx, hy, hz] = p.halfExtents
    return {
      id: p.objectId, mass: p.mass, centre, radius: Math.hypot(hx, hy, hz),
      energyHeight: EnergyRuler.energyHeightOf({ centreY: centre[1], velocity: p.velocity, bodyAngularVelocity: [w.x, w.y, w.z], halfExtents: p.halfExtents }),
      velocityY: p.velocity[1], speed: Math.hypot(...p.velocity), spin: Math.hypot(...p.angularVelocity), sleeping: p.sleeping,
    }
  }
  const steps = []
  const seen = new Map()
  let stepNo = 0
  const ruler = new EnergyRuler.EnergyRuler()
  let input = 'none'
  const ou = r.update.bind(r)
  r.update = (dt) => {
    const all = r.renderer.pieces().filter(p => !base.has(p.objectId))
    // a piece born in the previous update has its mesh at a pre-sync pose until its first step: it enters the ruler from its second observation
    const pieces = all.filter(p => (seen.get(p.objectId) ?? 0) >= 1)
    const before = pieces.map(sampleOf)
    const t0 = performance.now()
    ou(dt)
    const ms = performance.now() - t0
    const after = pieces.map(sampleOf)
    for (let k = 0; k < before.length; k++) {
      const rise = after[k].energyHeight - before[k].energyHeight
      if (input === 'none' && rise > 0.02) steps.push({ step: stepNo, id: before[k].id, mass: +before[k].mass.toFixed(1), rise: +rise.toFixed(3), speedBefore: +before[k].speed.toFixed(2), speedAfter: +after[k].speed.toFixed(2), y: +after[k].centre[1].toFixed(3), yBefore: +before[k].centre[1].toFixed(3), seen: (seen.get(before[k].id) ?? 0), xz: [+after[k].centre[0].toFixed(2), +after[k].centre[2].toFixed(2)], sleepingBefore: before[k].sleeping, kin: before[k].mass > 500 ? { dy: +(after[k].centre[1] - before[k].centre[1]).toFixed(3), vyBefore: +before[k].velocityY.toFixed(2), vyAfter: +after[k].velocityY.toFixed(2), spinBefore: +before[k].spin.toFixed(2), spinAfter: +after[k].spin.toFixed(2), radius: +before[k].radius.toFixed(2) } : undefined, near: rise > 1 ? after.map((o, j) => ({ id: o.id, d: +Math.hypot(o.centre[0] - after[k].centre[0], o.centre[1] - after[k].centre[1], o.centre[2] - after[k].centre[2]).toFixed(2), mass: +o.mass.toFixed(1), speedBefore: +before[j].speed.toFixed(2), speedAfter: +o.speed.toFixed(2), y: +o.centre[1].toFixed(2) })).filter(o => o.id !== before[k].id).sort((a, b) => a.d - b.d).slice(0, 4) : undefined })
    }
    for (const q of all) seen.set(q.objectId, (seen.get(q.objectId) ?? 0) + 1)
    stepNo++
    ruler.step(before, after, dt, input)
    input = 'none'
    return ms
  }
  let wakeFrameMs = 0
  if (KIND === 'blast') { input = 'energy'; r.blastAt('c4', spot); wakeFrameMs = r.update(0.05) }
  else { for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5*(k%4), spot[2] + (k%3-1)*0.6], direction: [1,0,0], energy: 8000, radius: 0.5, source: 'player' }); input = 'energy'; wakeFrameMs = Math.max(wakeFrameMs, r.update(0.05)) } }
  const times = []
  for (let i = 0; i < 220; i++) { times.push(r.update(0.05)); if (i % 20 === 0) await wait(10) }
  const pieces = r.renderer.pieces().filter(p => !base.has(p.objectId))
  times.sort((a, b) => a - b)
  const engine = r.renderer.pieceSys && r.renderer.pieceSys.engine
  ruler.recordFellThrough(engine ? engine.fellThrough : 0)
  return { kind: KIND, n: pieces.length, asleep: pieces.filter(p => p.sleeping).length, c2Limit: EnergyRuler.C2_LIMIT, ...ruler.result(), worstRises: steps.sort((a, b) => b.rise - a.rise).slice(0, 8), risingSteps: steps.length, frameMs: { p50: +times[110].toFixed(2), p99: +times[Math.floor(times.length * 0.99)].toFixed(2), max: +times[times.length - 1].toFixed(2), wakeFrame: +wakeFrameMs.toFixed(2) } }
})()
