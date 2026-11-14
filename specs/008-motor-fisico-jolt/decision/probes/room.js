// Room probe (blast or hammer) measured with the one ruler of spec 008 (`packages/game-destruction-three/tests/energy-ruler.ts`).
// Not run by tests. `run.sh` puts the ruler's exports in scope as `EnergyRuler` (`EnergyRuler.EnergyRuler`, `.energyHeightOf`, `.C2_LIMIT`) and replaces __KIND__ (blast | hammer).
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
  const so = r.world.serializeObject('house3d:1').state; const o = so.position
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
  const ruler = new EnergyRuler.EnergyRuler()
  let input = 'none'
  const ou = r.update.bind(r)
  r.update = (dt) => {
    const pieces = r.renderer.pieces().filter(p => !base.has(p.objectId))
    const before = pieces.map(sampleOf)
    const t0 = performance.now()
    ou(dt)
    const ms = performance.now() - t0
    ruler.step(before, pieces.map(sampleOf), dt, input)
    input = 'none'
    return ms
  }
  if (KIND === 'blast') { input = 'energy'; r.blastAt('c4', spot); r.update(0.05) }
  else { for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5*(k%4), spot[2] + (k%3-1)*0.6], direction: [1,0,0], energy: 8000, radius: 0.5, source: 'player' }); input = 'energy'; r.update(0.05) } }
  const times = []
  for (let i = 0; i < 220; i++) { times.push(r.update(0.05)); if (i % 20 === 0) await wait(10) }
  const pieces = r.renderer.pieces().filter(p => !base.has(p.objectId))
  times.sort((a, b) => a - b)
  const engine = r.renderer.pieceSys && r.renderer.pieceSys.engine
  ruler.recordFellThrough(engine ? engine.fellThrough : 0)
  return { kind: KIND, n: pieces.length, asleep: pieces.filter(p => p.sleeping).length, c2Limit: EnergyRuler.C2_LIMIT, ...ruler.result(), updateMedianMs: +times[110].toFixed(2) }
})()
