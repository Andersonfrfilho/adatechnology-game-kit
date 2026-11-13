(async () => {
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
  const base = new Set(r.renderer.pieces().map(p => p.objectId))
  const so = r.world.serializeObject('house3d:1').state; const o = so.position
  const spot = [o[0] - 2.5, 0.6, o[2]]
  const sys = r.renderer.pieceSys
  const meas = b => { const root=b.root; root.updateMatrixWorld(true); const c=new THREE(b.localCenter[0],b.localCenter[1],b.localCenter[2]); root.localToWorld(c); return c.y }
  const T = new Map()
  let frame = 0
  const step = () => {
    const ps = r.renderer.pieces().filter(p => !base.has(p.objectId))
    const before = new Map(ps.map(p => [p.objectId, { y: meas(p), vy: p.velocity[1], asleep: p.sleeping }]))
    r.update(0.05); frame++
    for (const p of r.renderer.pieces()) {
      if (base.has(p.objectId)) continue
      let t = T.get(p.objectId)
      const y = meas(p)
      if (!t) { t = { spawn: y, born: frame, maxRise: 0, lift: 0, launches: 0, maxUp: 0 }; T.set(p.objectId, t); continue }
      t.maxRise = Math.max(t.maxRise, y - t.spawn)
      const b = before.get(p.objectId)
      if (!b || frame - t.born < 3) continue
      const dy = y - b.y
      // a rise or an upward speed while it was not already going up: what the contacts gave it
      if (b.vy <= 0.05 && dy > 0) t.lift += dy
      if (!p.sleeping && p.velocity[1] > 0.05 && b.vy <= 0.05) { t.launches++; t.maxUp = Math.max(t.maxUp, p.velocity[1]) }
    }
  }
  for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5*(k%4), spot[2] + (k%3-1)*0.6], direction: [1,0,0], energy: 8000, radius: 0.5, source: 'player' }); step() }
  const t0 = performance.now()
  for (let i = 0; i < 220; i++) { step(); if (i % 20 === 0) await wait(10) }
  const ms = (performance.now() - t0) / 220
  const ps = r.renderer.pieces().filter(p => !base.has(p.objectId))
  const rows = [...T.values()]
  const max = k => rows.reduce((m, t) => Math.max(m, t[k]), 0)
  return { n: ps.length, asleep: ps.filter(p => p.sleeping).length, maxRise: +max('maxRise').toFixed(3), maxLift: +max('lift').toFixed(4), lifted35: rows.filter(t => t.lift > 0.035).length, launches: rows.reduce((s, t) => s + t.launches, 0), launched: rows.filter(t => t.launches > 0).length, maxUp: +max('maxUp').toFixed(3), msPerUpdate: +ms.toFixed(2) }
})()