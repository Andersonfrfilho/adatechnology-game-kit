// SPIKE D2: per-variant table of the m4 series.  node tools/gpu/d2-m4-table.mjs <m4.json>
import { readFileSync } from 'node:fs'
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const f = (v) => v.toFixed(1)
const by = new Map()
for (const r of d.results) if (!r.error) by.set(r.variant, [...(by.get(r.variant) ?? []), r])
console.log('variant              | f0 total (3 rounds) | frozen frames | per-frame totals f0..f(done+3), round 1 | worst frame after f0 (3 rounds) | frames over 33.3 (3 rounds)')
for (const [name, rs] of by) {
  const f0 = rs.map((r) => f(r.rows[0].totalMs)).join('/')
  const frozen = rs.map((r) => r.rows.filter((x) => x.mode !== 'normal').length).join('/')
  const done = rs[0].doneFrame
  const upto = done == null ? 10 : done + 4
  const first = rs[0].rows.slice(0, upto).map((x) => `${f(x.totalMs)}${x.mode === 'normal' ? '' : '*'}`).join(' ')
  const worstAfter = rs.map((r) => f(Math.max(...r.rows.slice(1, 25).map((x) => x.totalMs)))).join('/')
  const over = rs.map((r) => r.rows.slice(0, 25).filter((x) => x.totalMs > 33.3).length).join('/')
  console.log(`${name.padEnd(20)} | ${f0.padEnd(20)} | ${frozen.padEnd(9)} | ${first} | ${worstAfter} | ${over}`)
}
console.log('\n(* = frame with the world frozen)  columns of round 1, adv = slice ms, resume frame detail:')
for (const [name, rs] of by) {
  if (rs[0].doneFrame == null) continue
  for (const r of rs) {
    const rows = r.rows.slice(0, r.doneFrame + 3)
    console.log(`${name} r${r.round} load ${r.load.toFixed(2)} cpu ${r.temperatureAfter.cpuMaxC}C: ` + rows.map((x) => `[${x.frame}:${x.mode[0]} adv${f(x.advanceMs)} fire${f(x.fireMs)} upd${f(x.updateMs)} rnd${f(x.renderCpu)} =${f(x.totalMs)}]`).join(' '))
  }
}
// probe numbers inside the sliced runs: setup + rays + wave
for (const [name, rs] of by) {
  const p = rs.map((r) => r.probe).filter(Boolean)
  if (!p.length) continue
  console.log(`${name.padEnd(20)} rays ${p.map((x) => x.raysCast).join('/')} setup ${p.map((x) => f(x.setupMs)).join('/')} fragPhase ${p.map((x) => f(x.fragMs)).join('/')} wave ${p.map((x) => f(x.waveMs)).join('/')}`)
}
