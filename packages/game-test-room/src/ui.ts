import type { WritableLog } from './log'
import type { RoomStrings } from './locale'
import type { AnimationInfo, LogEntry, ScenarioReport, TestRoomItem, TestRoomScenario } from './types'

export interface InspectInfo {
  object: string
  objectId: string
  part: string
  material: string
  status: string
  hp: number
  maxHp: number
  temperature: number
  burning: boolean
  char: number
  melt: number
  liters?: number
  dents: number
  holes: number
  cracks: number
  mass: number
  /** Structural load in kg and stress (load / capacity) when the core reports them. */
  load?: number
  stress?: number
  joints: Array<{ id: string; kind: string; tools: string[]; open: boolean; progress: number }>
  note?: string
  distance: number
}

export interface HudState {
  toolName: string
  toolId: string
  ammo: string
  slots: string[]
  slot: number
  page: number
  pages: number
  status: string
  progress: { label: string; value: number } | null
  held: { name: string; uses: Array<{ key: string; label: string }>; weapon?: string; using: string } | null
  inspect: InspectInfo | null
  /** Animations of the aimed or held item. */
  animations: AnimationInfo | null
  locked: boolean
  timeScale: number
  fast: boolean
  tap: boolean
  quality: string
  objects: number
}

export interface UiOptions {
  container: HTMLElement
  strings: RoomStrings
  t: (key: string, vars?: Record<string, string | number>) => string
  log: WritableLog
  groups: () => Map<string, TestRoomItem[]>
  loadout: () => Array<{ id: string; name: string }>
  onSpawn: (itemId: string) => void
  onEquip: (itemId: string) => void
  onClear: () => void
  onResetAll: () => void
  onSlow: (on: boolean) => void
  onFast: (on: boolean) => void
  onQuality: (q: 'low' | 'medium' | 'high') => void
  quality: 'low' | 'medium' | 'high'
  scenarios: () => TestRoomScenario[]
  onRun: (s: TestRoomScenario) => Promise<ScenarioReport | void>
  onRunAll: () => Promise<ScenarioReport | void>
  onTool: (index: number) => void
  onTap: () => void
  onPlay: (objectId: string, clipId: string) => void
  onResize: () => void
}

export interface RoomUi {
  hud(state: HudState): void
  toast(text: string): void
  /** Re-read the catalogue and the scenarios (after `loadModule`). */
  refresh(): void
  togglePanels(): void
  dispose(): void
}

const CSS = `
.tr-root{position:absolute;inset:0;pointer-events:none;font:12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8eaee;overflow:hidden}
.tr-root *{box-sizing:border-box}
.tr-root button,.tr-root select,.tr-root label{pointer-events:auto}
.tr-cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px}
.tr-cross:before,.tr-cross:after{content:"";position:absolute;background:#fff;opacity:.85;box-shadow:0 0 2px #000}
.tr-cross:before{left:8px;top:0;width:2px;height:18px}.tr-cross:after{top:8px;left:0;height:2px;width:18px}
.tr-cross i{position:absolute;left:6px;top:6px;width:6px;height:6px;background:#0b0c0e;border-radius:50%;z-index:1}
.tr-top{position:absolute;top:8px;left:50%;transform:translateX(-50%);text-align:center;max-width:46vw}
.tr-tool{display:inline-block;background:rgba(10,12,16,.72);padding:4px 12px;border-radius:6px;font-size:14px;font-weight:600}
.tr-tool small{font-weight:400;opacity:.8;margin-left:8px}
.tr-status{margin-top:4px;min-height:16px;color:#ffd23f;text-shadow:0 1px 2px #000}
.tr-prog{margin:4px auto 0;width:260px;background:rgba(10,12,16,.72);border-radius:6px;padding:4px 8px;display:none}
.tr-prog b{display:block;font-weight:500;margin-bottom:3px}
.tr-bar{height:7px;background:#2a2e36;border-radius:4px;overflow:hidden}
.tr-bar i{display:block;height:100%;background:#4fc3f7;width:0}
.tr-bar.hp i{background:#66bb6a}.tr-bar.warn i{background:#ffb300}.tr-bar.bad i{background:#ef5350}
.tr-bottom{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);text-align:center;max-width:56vw}
.tr-held{margin-bottom:6px;background:rgba(10,12,16,.72);padding:4px 10px;border-radius:6px;display:none}
.tr-held kbd,.tr-help kbd{background:#2a2e36;border:1px solid #4a505c;border-radius:3px;padding:0 4px;font:inherit;font-weight:700}
.tr-hotbar{display:inline-flex;gap:3px;flex-wrap:wrap;justify-content:center}
.tr-slot{pointer-events:auto;min-width:64px;max-width:92px;padding:3px 5px;background:rgba(10,12,16,.68);border:1px solid #3a404c;border-radius:5px;color:#cfd3da;cursor:pointer;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tr-slot b{color:#ffd23f;margin-right:3px}
.tr-slot.on{border-color:#ffd23f;color:#fff;background:rgba(60,50,10,.8)}
.tr-help{position:absolute;left:8px;bottom:8px;max-width:360px;opacity:.75;font-size:11px;background:rgba(10,12,16,.55);padding:4px 8px;border-radius:6px}
.tr-left{position:absolute;top:8px;left:8px;bottom:70px;width:min(400px,36vw);display:flex;flex-direction:column;gap:8px}
.tr-right{position:absolute;top:8px;right:8px;bottom:8px;width:min(310px,34vw);display:flex;flex-direction:column;gap:8px}
.tr-panel{background:rgba(12,14,19,.82);border:1px solid #2c313b;border-radius:8px;padding:8px;pointer-events:auto;overflow:auto}
.tr-panel h3{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#9aa3b2;font-weight:600}
.tr-insp{flex:0 0 auto;max-height:46%;min-height:60px}
.tr-insp .r{display:flex;justify-content:space-between;gap:8px}.tr-insp .r span:first-child{color:#9aa3b2}
.tr-insp .t{font-weight:600;font-size:13px;margin-bottom:3px}
.tr-log{flex:1 1 auto;display:flex;flex-direction:column;min-height:120px;overflow:hidden}
.tr-logbar{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;align-items:center}
.tr-logbody{flex:1;overflow:auto;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:#090a0d;border-radius:5px;padding:4px 6px}
.tr-logbody div{white-space:pre-wrap;word-break:break-word;border-bottom:1px solid #15171c}
.tr-logbody .action{color:#8fd3ff}.tr-logbody .event{color:#dfe3ea}.tr-logbody .check{color:#c8e6c9}.tr-logbody .check.fail{color:#ff8a80;font-weight:700}.tr-logbody .check.pass{color:#9be59f}
.tr-logbody time{color:#6b7280;margin-right:6px}
.tr-btn,.tr-root button.tr-btn{background:#232831;border:1px solid #3a404c;color:#e8eaee;border-radius:5px;padding:3px 8px;cursor:pointer;font:inherit}
.tr-btn:hover{background:#2d3440}.tr-btn.on{background:#3b3a14;border-color:#ffd23f;color:#fff}
.tr-btn.pass{border-color:#4caf50}.tr-btn.fail{border-color:#ef5350;background:#3a1d1d}
.tr-tabs{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px}
.tr-items{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.tr-item{display:flex;gap:2px}.tr-item .tr-btn:first-child{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tr-cat{flex:0 1 auto;max-height:40%}
.tr-anim{flex:0 0 auto;max-height:18%}
.tr-anim .list{display:flex;flex-wrap:wrap;gap:4px}.tr-anim .sub{color:#9aa3b2;margin-bottom:4px}
.tr-tests{flex:1 1 auto;min-height:100px}
.tr-tests .list{display:flex;flex-direction:column;gap:3px;margin-top:6px}.tr-tests .list .tr-btn{text-align:left}
.tr-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center}
.tr-toggle{position:absolute;top:8px;right:8px;display:none}
.tr-summary{margin-top:6px;color:#9aa3b2}
@media (max-width:980px){.tr-left,.tr-right{display:none}.tr-root.open .tr-left,.tr-root.open .tr-right{display:flex}.tr-toggle{display:block;pointer-events:auto}.tr-root.open .tr-toggle{right:min(310px,34vw)}.tr-left{width:min(400px,46vw)}.tr-help{display:none}}
`

const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function createUi(o: UiOptions): RoomUi {
  const { t } = o
  const style = mk('style')
  style.textContent = CSS
  const root = mk('div', 'tr-root')
  const pos = getComputedStyle?.(o.container)?.position
  if (!pos || pos === 'static') o.container.style.position = 'relative'
  root.appendChild(style)
  o.container.appendChild(root)

  // crosshair, top bar
  const cross = mk('div', 'tr-cross')
  cross.appendChild(mk('i'))
  const top = mk('div', 'tr-top')
  const toolBox = mk('div', 'tr-tool')
  const status = mk('div', 'tr-status')
  const prog = mk('div', 'tr-prog')
  const progLabel = mk('b')
  const progBar = mk('div', 'tr-bar')
  const progFill = mk('i')
  progBar.appendChild(progFill)
  prog.append(progLabel, progBar)
  top.append(toolBox, status, prog)

  // bottom: held hint and hotbar
  const bottom = mk('div', 'tr-bottom')
  const held = mk('div', 'tr-held')
  const hotbar = mk('div', 'tr-hotbar')
  bottom.append(held, hotbar)
  const help = mk('div', 'tr-help')
  help.textContent = t('ui.help')

  // left: inspector + log
  const left = mk('div', 'tr-left')
  const insp = mk('div', 'tr-panel tr-insp')
  const logPanel = mk('div', 'tr-panel tr-log')
  left.append(insp, logPanel)

  // log panel
  const logTitle = mk('h3', undefined, t('ui.log'))
  const logBar = mk('div', 'tr-logbar')
  const logBody = mk('div', 'tr-logbody')
  const filters: Record<LogEntry['channel'], boolean> = { action: true, event: true, check: true }
  const filterBtns: HTMLButtonElement[] = []
  for (const ch of ['action', 'event', 'check'] as const) {
    const b = mk('button', 'tr-btn on', t(`ui.filter.${ch}`))
    b.type = 'button'
    b.onclick = () => {
      filters[ch] = !filters[ch]
      b.classList.toggle('on', filters[ch])
      rebuildLog()
    }
    filterBtns.push(b)
    logBar.appendChild(b)
  }
  let autoscroll = true
  const asLabel = mk('label')
  const asBox = mk('input')
  asBox.type = 'checkbox'
  asBox.checked = true
  asBox.onchange = () => {
    autoscroll = asBox.checked
  }
  asLabel.append(asBox, document.createTextNode(' ' + t('ui.autoscroll')))
  logBar.appendChild(asLabel)
  const logBtn = (label: string, fn: () => void): void => {
    const b = mk('button', 'tr-btn', label)
    b.type = 'button'
    b.onclick = fn
    logBar.appendChild(b)
  }
  logBtn(t('ui.copy_json'), () => {
    const text = o.log.toJSON()
    try {
      void navigator.clipboard.writeText(text)
    } catch {
      const ta = mk('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand?.('copy')
      ta.remove()
    }
  })
  logBtn(t('ui.download_ndjson'), () => o.log.download('ndjson'))
  logBtn(t('ui.download_txt'), () => o.log.download('txt'))
  logBtn(t('ui.clear_log'), () => {
    o.log.clear()
    logBody.textContent = ''
    nodes.clear()
  })
  logPanel.append(logTitle, logBar, logBody)

  const MAX_LINES = 200
  const nodes = new Map<number, HTMLElement>()
  const fmtTime = (s: number): string => `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`
  const lineClass = (e: LogEntry): string => `${e.channel}${e.type === 'fail' || e.type === 'scenario_fail' ? ' fail' : e.type === 'pass' || e.type === 'scenario_pass' ? ' pass' : ''}`
  const fill = (n: HTMLElement, e: LogEntry): void => {
    n.className = lineClass(e)
    n.textContent = ''
    const tm = mk('time', undefined, fmtTime(e.t))
    n.append(tm, document.createTextNode(e.text))
  }
  const addNode = (e: LogEntry): void => {
    if (!filters[e.channel]) return
    const n = mk('div')
    fill(n, e)
    nodes.set(e.seq, n)
    logBody.appendChild(n)
    while (logBody.childElementCount > MAX_LINES) {
      const first = logBody.firstElementChild as HTMLElement
      for (const [k, v] of nodes) if (v === first) nodes.delete(k)
      first.remove()
    }
    if (autoscroll) logBody.scrollTop = logBody.scrollHeight
  }
  function rebuildLog(): void {
    logBody.textContent = ''
    nodes.clear()
    for (const e of o.log.entries().slice(-MAX_LINES * 3)) addNode(e)
  }
  const offLog = o.log.on((e, updated) => {
    if (updated) {
      const n = nodes.get(e.seq)
      if (n) fill(n, e)
    } else addNode(e)
  })

  // right: catalogue and tests
  const right = mk('div', 'tr-right')
  const cat = mk('div', 'tr-panel tr-cat')
  const anim = mk('div', 'tr-panel tr-anim')
  const tests = mk('div', 'tr-panel tr-tests')
  right.append(cat, anim, tests)

  cat.appendChild(mk('h3', undefined, t('ui.catalog')))
  const tabs = mk('div', 'tr-tabs')
  const items = mk('div', 'tr-items')
  cat.append(tabs, items)
  let activeGroup = ''
  const renderItems = (): void => {
    items.textContent = ''
    for (const it of o.groups().get(activeGroup) ?? []) {
      const wrap = mk('div', 'tr-item')
      const b = mk('button', 'tr-btn', it.name)
      b.type = 'button'
      b.title = it.note ?? it.name
      b.onclick = () => o.onSpawn(it.id)
      wrap.appendChild(b)
      if (it.weapon) {
        const w = mk('button', 'tr-btn', '⚔')
        w.type = 'button'
        w.title = t('ui.equip')
        w.onclick = () => o.onEquip(it.id)
        wrap.appendChild(w)
      }
      items.appendChild(wrap)
    }
  }
  const renderTabs = (): void => {
    tabs.textContent = ''
    const groupNames = [...o.groups().keys()]
    if (!groupNames.includes(activeGroup)) activeGroup = groupNames[0] ?? ''
    for (const g of groupNames) {
      const b = mk('button', g === activeGroup ? 'tr-btn on' : 'tr-btn', g)
      b.type = 'button'
      b.onclick = () => {
        activeGroup = g
        renderTabs()
      }
      tabs.appendChild(b)
    }
    renderItems()
  }
  renderTabs()

  const controls = mk('div', 'tr-row')
  const ctl = (label: string, fn: (b: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = mk('button', 'tr-btn', label)
    b.type = 'button'
    b.onclick = () => fn(b)
    controls.appendChild(b)
    return b
  }
  ctl(t('ui.clear'), () => o.onClear())
  ctl(t('ui.reset_all'), () => o.onResetAll())
  let slow = false
  ctl(t('ui.slow'), (b) => {
    slow = !slow
    b.classList.toggle('on', slow)
    o.onSlow(slow)
  })
  let fast = false
  ctl(t('ui.fast'), (b) => {
    fast = !fast
    b.classList.toggle('on', fast)
    o.onFast(fast)
  })
  const tapBtn = ctl(t('ui.tap'), () => o.onTap())
  const qSel = mk('select')
  for (const q of ['low', 'medium', 'high'] as const) {
    const op = mk('option', undefined, t(`ui.quality.${q}`))
    op.value = q
    qSel.appendChild(op)
  }
  qSel.value = o.quality
  qSel.onchange = () => o.onQuality(qSel.value as 'low' | 'medium' | 'high')
  const qLabel = mk('label', undefined, t('ui.quality') + ' ')
  qLabel.appendChild(qSel)
  controls.appendChild(qLabel)
  const count = mk('span')
  controls.appendChild(count)
  cat.appendChild(controls)

  // tests
  tests.appendChild(mk('h3', undefined, t('ui.tests')))
  const runAll = mk('button', 'tr-btn', t('ui.run_all'))
  runAll.type = 'button'
  const summary = mk('div', 'tr-summary')
  const list = mk('div', 'list')
  tests.append(runAll, summary, list)
  const scBtns = new Map<string, HTMLButtonElement>()
  let busy = false
  const mark = (rep: ScenarioReport | void): void => {
    if (!rep) return
    for (const r of rep.results) {
      const b = scBtns.get(r.id)
      if (!b) continue
      b.classList.remove('pass', 'fail')
      b.classList.add(r.ok ? 'pass' : 'fail')
      b.textContent = `${r.ok ? '✓' : '✗'} ${r.name}`
    }
    summary.textContent = t('ui.report', { passed: rep.passed, failed: rep.failed })
  }
  const renderScenarios = (): void => {
    list.textContent = ''
    scBtns.clear()
    for (const s of o.scenarios()) {
      const b = mk('button', 'tr-btn', s.name)
      b.type = 'button'
      b.onclick = async () => {
        if (busy) return
        busy = true
        try {
          mark(await o.onRun(s))
        } finally {
          busy = false
        }
      }
      scBtns.set(s.id, b)
      list.appendChild(b)
    }
  }
  renderScenarios()
  runAll.onclick = async () => {
    if (busy) return
    busy = true
    summary.textContent = t('ui.running')
    try {
      mark(await o.onRunAll())
    } finally {
      busy = false
    }
  }

  const toggle = mk('button', 'tr-btn tr-toggle', t('ui.panel'))
  toggle.type = 'button'
  const togglePanels = (): void => {
    root.classList.toggle('open')
    o.onResize()
  }
  toggle.onclick = togglePanels

  root.append(cross, top, bottom, help, left, right, toggle)

  // inspector
  const bar = (value: number, max: number, cls: string): HTMLElement => {
    const b = mk('div', `tr-bar ${cls}`)
    const i = mk('i')
    i.style.width = `${Math.max(0, Math.min(100, (value / Math.max(1e-9, max)) * 100))}%`
    b.appendChild(i)
    return b
  }
  const row = (k: string, v: string): HTMLElement => {
    const r = mk('div', 'r')
    r.append(mk('span', undefined, k), mk('span', undefined, v))
    return r
  }
  const num = (n: number, d = 1): string => {
    const s = (Math.round(n * 10 ** d) / 10 ** d).toFixed(d)
    return t('locale.decimal') === ',' ? s.replace('.', ',') : s
  }
  const renderInspector = (i: InspectInfo | null): void => {
    insp.textContent = ''
    insp.appendChild(mk('h3', undefined, t('ui.inspector')))
    if (!i) {
      insp.appendChild(mk('div', undefined, t('ui.aim_at_something')))
      return
    }
    insp.appendChild(mk('div', 't', `${i.object} › ${i.part}`))
    insp.appendChild(row(t('ins.material'), i.material))
    insp.appendChild(row(t('ins.status'), i.status + (i.burning ? ` · ${t('ins.burning')}` : '')))
    insp.appendChild(row(t('ins.hp'), `${num(i.hp, 0)} / ${num(i.maxHp, 0)}`))
    const frac = i.hp / Math.max(1e-9, i.maxHp)
    insp.appendChild(bar(i.hp, i.maxHp, frac < 0.25 ? 'bad' : frac < 0.6 ? 'warn' : 'hp'))
    insp.appendChild(row(t('ins.temperature'), `${num(i.temperature, 0)} °C`))
    if (i.char > 0.01) insp.appendChild(row(t('ins.char'), `${num(i.char * 100, 0)} %`))
    if (i.melt > 0.01) insp.appendChild(row(t('ins.melt'), `${num(i.melt * 100, 0)} %`))
    if (i.liters !== undefined) insp.appendChild(row(t('ins.liters'), `${num(i.liters, 2)} l`))
    const cn = (what: string, n: number): string => t(`count.${what}.${n === 1 ? 'one' : 'other'}`, { n })
    insp.appendChild(row(t('ins.damage'), t('ins.damage_counts', { dents: cn('dent', i.dents), holes: cn('hole', i.holes), cracks: cn('crack', i.cracks) })))
    insp.appendChild(row(t('ins.mass'), `${num(i.mass, 1)} kg`))
    if (i.load !== undefined) insp.appendChild(row(t('ins.load'), `${num(i.load, 0)} kg`))
    if (i.stress !== undefined) {
      insp.appendChild(row(t('ins.stress'), `${num(i.stress * 100, 0)} %`))
      insp.appendChild(bar(Math.min(i.stress, 1.2), 1.2, i.stress > 1 ? 'bad' : i.stress > 0.7 ? 'warn' : 'hp'))
    }
    if (i.joints.length) {
      insp.appendChild(mk('div', undefined, t('ins.joints') + ':'))
      for (const j of i.joints) {
        const tools = j.tools.length ? j.tools.join(', ') : t('tool.none')
        insp.appendChild(mk('div', undefined, `• ${j.kind} (${j.id})${j.open ? ` · ${t('ins.open')}` : ` → ${tools}`}`))
      }
    }
    if (i.note) insp.appendChild(mk('div', undefined, i.note))
  }

  let lastAnim = ''
  const renderAnimations = (a: AnimationInfo | null): void => {
    anim.textContent = ''
    anim.appendChild(mk('h3', undefined, t('ui.animations')))
    if (!a) {
      anim.appendChild(mk('div', 'sub', t('ui.animations_aim')))
      return
    }
    anim.appendChild(mk('div', 'sub', a.name))
    if (a.clips.length === 0) {
      anim.appendChild(mk('div', 'sub', t('ui.animations_none')))
      return
    }
    const l = mk('div', 'list')
    for (const c of a.clips) {
      const b = mk('button', a.playing === c.id ? 'tr-btn on' : 'tr-btn', `▶ ${t(`anim.${c.id}`) === `anim.${c.id}` ? c.id : t(`anim.${c.id}`)} (${num(c.duration, 1)} s)`)
      b.type = 'button'
      b.onclick = () => o.onPlay(a.objectId, c.id)
      l.appendChild(b)
    }
    anim.appendChild(l)
  }
  renderAnimations(null)

  let toastTimer: ReturnType<typeof setTimeout> | null = null
  const slotsEl: HTMLButtonElement[] = []
  let lastSlotsKey = ''
  let lastInspect = ''
  let hudPage = 0

  const api: RoomUi = {
    hud(s) {
      toolBox.textContent = ''
      toolBox.append(document.createTextNode(s.toolName))
      if (s.ammo) toolBox.append(mk('small', undefined, s.ammo))
      if (s.status) status.textContent = s.status
      else if (!toastTimer) status.textContent = ''
      if (s.progress) {
        prog.style.display = 'block'
        progLabel.textContent = s.progress.label
        progFill.style.width = `${Math.round(s.progress.value * 100)}%`
      } else prog.style.display = 'none'
      if (s.held) {
        held.style.display = 'block'
        held.textContent = ''
        held.append(document.createTextNode(`${s.held.name} · `))
        const keys: Array<[string, string]> = [
          ['E', t('hud.drop')],
          ['R', t('hud.rotate')],
          ['G', t('hud.throw')],
          ['Z', t('hud.tilt')],
          ...s.held.uses.map((u) => [u.key, u.label] as [string, string]),
        ]
        if (s.held.weapon) keys.push(['H', t('hud.equip', { weapon: s.held.weapon })])
        for (const [k, label] of keys) {
          held.append(mk('kbd', undefined, k), document.createTextNode(` ${label}  `))
        }
      } else held.style.display = 'none'
      const key = s.slots.join('|') + s.page
      if (key !== lastSlotsKey) {
        lastSlotsKey = key
        hotbar.textContent = ''
        slotsEl.length = 0
        hudPage = s.page - 1
        s.slots.forEach((name, i) => {
          const b = mk('button', 'tr-slot')
          b.type = 'button'
          b.append(mk('b', undefined, String((i + 1) % 10)), document.createTextNode(name))
          b.title = name
          b.onclick = () => o.onTool(hudPage * 10 + i)
          hotbar.appendChild(b)
          slotsEl.push(b)
        })
      }
      slotsEl.forEach((b, i) => b.classList.toggle('on', i === s.slot))
      tapBtn.classList.toggle('on', s.tap)
      count.textContent = t('ui.objects', { n: s.objects })
      const ak = JSON.stringify(s.animations)
      if (ak !== lastAnim) {
        lastAnim = ak
        renderAnimations(s.animations)
      }
      const ik = JSON.stringify(s.inspect)
      if (ik !== lastInspect) {
        lastInspect = ik
        renderInspector(s.inspect)
      }
    },
    toast(text) {
      status.textContent = text
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        toastTimer = null
      }, 2000)
    },
    refresh() {
      renderTabs()
      renderScenarios()
    },
    togglePanels,
    dispose() {
      offLog()
      if (toastTimer) clearTimeout(toastTimer)
      root.remove()
    },
  }
  rebuildLog()
  return api
}
