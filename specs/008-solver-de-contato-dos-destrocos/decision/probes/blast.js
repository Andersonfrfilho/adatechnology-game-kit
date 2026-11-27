(async () => {
  const KIND = 'blast'
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
  const cy = p => { p.root.updateMatrixWorld(true); return v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld).y }
  const S = new Map()
  let measuring = false
  const ou = r.update.bind(r)
  r.update = (dt) => {
    const before = r.renderer.pieces().filter(p => !base.has(p.objectId)).map(p => [p, cy(p), p.velocity[1]])
    const t0 = performance.now()
    ou(dt)
    const ms = performance.now() - t0
    for (const [p, y, vy] of before) {
      let s = S.get(p.objectId)
      if (!s) { s = { seen: 0, spawn: y, lift: 0, launches: 0, up: 0, rise: 0 }; S.set(p.objectId, s) }
      s.seen++
      const y1 = cy(p)
      if (measuring && s.seen > 2) {
        s.lift += Math.max(0, y1 - y - Math.max(0, vy) * dt)
        if (p.velocity[1] > 0.05 && p.velocity[1] > Math.max(0, vy) + 1e-9) { s.launches++; s.up = Math.max(s.up, p.velocity[1]); if (vy > -0.3) { s.restLaunches = (s.restLaunches || 0) + 1; s.restUp = Math.max(s.restUp || 0, p.velocity[1]) } }
        s.rise = Math.max(s.rise, y1 - s.spawn)
      }
    }
    return ms
  }
  if (KIND === 'blast') { r.blastAt('c4', spot); measuring = true }
  else { for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5*(k%4), spot[2] + (k%3-1)*0.6], direction: [1,0,0], energy: 8000, radius: 0.5, source: 'player' }); r.update(0.05) } measuring = true }
  const times = []
  for (let i = 0; i < 220; i++) { times.push(r.update(0.05)); if (i % 20 === 0) await wait(10) }
  const ps = r.renderer.pieces().filter(p => !base.has(p.objectId))
  const rows = [...S.entries()]
  const max = k => rows.reduce((m, [, s]) => Math.max(m, s[k]), 0)
  times.sort((a, b) => a - b)
  return { n: ps.length, asleep: ps.filter(p => p.sleeping).length, maxLift: +max('lift').toFixed(4), launches: rows.reduce((m, [, s]) => m + s.launches, 0), restLaunches: rows.reduce((m, [, s]) => m + (s.restLaunches || 0), 0), restUp: +rows.reduce((m, [, s]) => Math.max(m, s.restUp || 0), 0).toFixed(3), launchedPieces: rows.filter(([, s]) => s.launches > 0).length, maxUp: +max('up').toFixed(3), maxRise: +max('rise').toFixed(3), liftOver35: rows.filter(([, s]) => s.lift > 0.035).length, updateMedianMs: +times[110].toFixed(2), worst: rows.sort((a, b) => b[1].lift - a[1].lift).slice(0, 5).map(([id, s]) => [id, +s.lift.toFixed(3), s.launches, +s.up.toFixed(3), +s.rise.toFixed(3)]) }
})()
