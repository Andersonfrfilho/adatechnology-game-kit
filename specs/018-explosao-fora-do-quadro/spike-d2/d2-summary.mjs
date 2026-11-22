// SPIKE D2: tables from the JSON of specs/018-explosao-fora-do-quadro/spike-d2/d2-espalhar.mjs.  node tools/gpu/d2-summary.mjs <json>
import { readFileSync } from 'node:fs'
import { FRAME_LABELS, STAGE_LABELS } from '../../../tools/gpu/room-explosion.mjs'

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const f = (v, n = 1) => (v === undefined || v === null ? '-' : Number(v).toFixed(n))
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
const meta = (r) => `load ${f(r.load, 2)} cpu ${r.temperatureAfter?.cpuMaxC ?? '?'}C gpu ${r.temperatureAfter?.gpu ?? '?'}`
console.log(`series ${data.series}  gpu ${data.machine.gpu.renderer}  head ${String(data.head).slice(0, 9)}  page ${data.pageFile.split('/').pop()}`)
if (data.series === 'm1') {
  const base = 6 + STAGE_LABELS.length
  const extra = base + FRAME_LABELS.length
  for (const r of data.results) {
    if (r.error) { console.log('ERROR', r.error); continue }
    console.log(`\nround ${r.round} (${meta(r)})`)
    console.log('frame  update  render  total | ' + ['explode', 'destrEvents', 'action', 'fragments', 'world', 'vfxSim', 'vfxLayers', 'modules', 'matrices', 'sysSimulate', 'sysSimulateEnd'].join(' '))
    r.timings.slice(0, 10).forEach((row, i) => {
      const part = (l) => row[base + FRAME_LABELS.indexOf(l)]
      console.log(`${String(i).padStart(3)}  ${f(row[4]).padStart(7)} ${f(row[extra]).padStart(7)} ${f(row[4] + row[extra]).padStart(7)} | ` + ['explode', 'destrEvents', 'action', 'fragments', 'world', 'vfxSim', 'vfxLayers', 'modules', 'matrices', 'sysSimulate', 'sysSimulateEnd'].map((l) => f(part(l)).padStart(l.length)).join(' '))
    })
  }
} else {
  for (const r of data.results) {
    if (r.error) { console.log(r.variant, r.round, 'ERROR', r.error); continue }
    console.log(`\n${r.variant} round ${r.round} (${meta(r)})${r.doneFrame != null ? ` doneFrame ${r.doneFrame}` : ''} simTicks ${r.simulatedTicks}${r.stateHash !== undefined ? ` stateHash ${r.stateHash} events ${r.eventCount} eventHash ${r.eventHash}` : ''}`)
    const header = 'fr mode        total update render adv  fire' + (r.rows[0].appliedFragMs !== undefined ? '  fragApplyN/ms  otherApplyN/ms struct rebuild' : '')
    console.log(header)
    r.rows.slice(0, 24).forEach((x) => console.log(`${String(x.frame).padStart(2)} ${x.mode.padEnd(11)} ${f(x.totalMs).padStart(6)} ${f(x.updateMs).padStart(6)} ${f(x.renderCpu).padStart(6)} ${f(x.advanceMs).padStart(5)} ${f(x.fireMs).padStart(5)}` + (x.appliedFragMs !== undefined ? `  ${String(x.appliedFragN).padStart(4)}/${f(x.appliedFragMs).padStart(5)}  ${String(x.appliedOtherN).padStart(4)}/${f(x.appliedOtherMs).padStart(5)} ${f(x.structMs).padStart(6)} ${f(x.rebuildMs).padStart(6)}` : '')))
    const p = r.probe
    if (p && p.rayMs.length) {
      const s = [...p.rayMs].sort((a, b) => a - b)
      console.log(`probe: rays ${p.raysCast} setup ${f(p.setupMs)} fragPhase ${f(p.fragMs)} wave ${f(p.waveMs)} | ray ms p50 ${f(pct(s, 0.5), 3)} p90 ${f(pct(s, 0.9), 3)} p99 ${f(pct(s, 0.99), 3)} max ${f(s.at(-1), 3)} sum ${f(s.reduce((a, b) => a + b, 0))} | events by phase ${JSON.stringify(p.eventsByPhase)} | rayEvents total ${p.rayEvents.reduce((a, b) => a + b, 0)} max ${Math.max(...p.rayEvents)}`)
    }
    if (r.applied) console.log('applied byType', JSON.stringify(Object.fromEntries(Object.entries(r.applied.byType).map(([k, v]) => [k, `${v.n}/${v.ms.toFixed(1)}`]))))
  }
}
