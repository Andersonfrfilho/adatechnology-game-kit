import { resolveStrings } from './locale'
import { compass, escapeHtml as esc, formatMarkLine, serializeMarks, sortMarks } from './marks'
import { createScenarioRunner } from './scenarios'
import type {
  Bounds,
  Devtools,
  DevtoolsOptions,
  EntityLabel,
  HereInfo,
  Mark,
  PlaceGroup,
  PlayerPosition,
  ProjectionCamera,
  Team,
  ThreeLib,
} from './types'

/** Minimal shape of the optional `window.claude` runtime that provides a shared database. */
interface ClaudeRuntime {
  use(name: 'db' | 'user'): Promise<any>
}
declare global {
  interface Window {
    claude?: ClaudeRuntime
    __scenario?: Devtools['scenario']
    __scenarioCheck?: Devtools['check']
    __scenarioList?: unknown
    __devtools?: Devtools
  }
}

const noop = () => {}

const CSS = `
.gd-pos{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);background:var(--panel,rgba(12,14,14,.72));color:var(--ink,#e6e3d6);border:1px solid var(--line,rgba(230,227,214,.18));padding:5px 10px;font:12px var(--f-mono,ui-monospace,monospace);font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;z-index:3;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis}
.gd-pos b{color:var(--accent,#e3c341);font-weight:600} .gd-pos.flying{border-color:var(--accent,#e3c341)}
.gd-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));max-height:calc(100% - 48px);overflow:auto;background:rgba(14,16,16,.96);color:var(--ink,#e6e3d6);border:1px solid var(--accent,#e3c341);padding:16px;display:grid;gap:10px;z-index:9;font:13px var(--f-mono,ui-monospace,monospace)}
.gd-panel h2{font-family:var(--f-display,inherit);font-weight:800;font-size:26px;margin:0;letter-spacing:.02em}
.gd-panel textarea,.gd-panel select{font:13px var(--f-mono,ui-monospace,monospace);background:#0b0d0d;color:inherit;border:1px solid var(--line,#444);padding:8px;width:100%}
.gd-panel textarea{min-height:84px;resize:vertical} .gd-panel select{width:auto;padding:6px}
.gd-panel button{font:600 13px var(--f-mono,ui-monospace,monospace);padding:7px 12px;cursor:pointer}
.gd-row{display:flex;gap:6px;flex-wrap:wrap} .gd-sub{color:var(--muted,#9a9a8c);font-size:12px;margin:0}
.gd-mark{display:grid;grid-template-columns:1fr auto;gap:4px 10px;border-top:1px dashed var(--line,#444);padding-top:8px}
.gd-mark .t{white-space:pre-wrap;overflow-wrap:anywhere} .gd-mark .w{color:var(--muted,#9a9a8c);font-size:11px} .gd-mark .b{grid-row:1/3;grid-column:2;display:flex;gap:6px;align-items:start}
.gd-panel .gd-copy{min-height:90px;font-size:11px}
.gd-labels{position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden}
.gd-labels div{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:11px var(--f-mono,ui-monospace,monospace);white-space:nowrap;background:rgba(10,12,12,.72);padding:1px 5px;border-left:2px solid;display:none}`

/**
 * Creates the devtools: free-fly, position HUD, marks with notes, control panel, scenarios and entity labels.
 * The game plugs everything in through the options and the registration methods; see the README.
 */
export function create(THREE: ThreeLib, options: DevtoolsOptions = {}): Devtools {
  const S = resolveStrings(options.locale, options.strings)
  const C = {
    marksStorageKey: 'game-devtools-marks',
    collection: 'marks',
    fileName: S.fileName,
    teams: [['general', S.defaultTeam]] as Team[],
    area: (() => '') as (x: number, z: number) => string,
    time: (() => '') as () => string,
    notify: noop as (text: string, seconds?: number) => void,
    pause: noop as (paused: boolean) => void,
    position: (() => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 })) as () => PlayerPosition,
    bounds: { x: [-1e4, 1e4], y: [0.4, 400], z: [-1e4, 1e4] } as Bounds,
    speed: 14,
    labelsMax: 48,
    labelsDistance: 45,
    ...stripUndefined(options),
  }

  const dt0 = {
    toggles: [] as Array<{ id: string; label: string; get: () => boolean; set: (on: boolean) => boolean | void }>,
    actions: [] as Array<{ id: string; label: string | (() => string); fn: () => boolean | void }>,
    times: [] as Array<[string, unknown]>,
    setTime: undefined as ((value: unknown) => void) | undefined,
    placeGroups: (() => []) as () => PlaceGroup[],
    labelsFn: (() => []) as (camera: ProjectionCamera) => EntityLabel[],
  }
  const runner = createScenarioRunner()

  // ---- interface ----
  const css = document.createElement('style')
  css.textContent = CSS
  document.head.appendChild(css)
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent: HTMLElement = document.body): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    parent.appendChild(e)
    return e
  }
  const posEl = el('div', 'gd-pos')
  posEl.id = 'gd-pos'
  const form = el('section', 'gd-panel')
  form.hidden = true
  form.id = 'gd-form'
  form.setAttribute('aria-label', S.markFormLabel)
  const list = el('section', 'gd-panel')
  list.hidden = true
  list.id = 'gd-list'
  list.setAttribute('aria-label', S.panelTitle)
  const labelBox = el('div', 'gd-labels')
  labelBox.id = 'gd-labels'
  const LABELS: HTMLDivElement[] = []
  for (let k = 0; k < C.labelsMax; k++) LABELS.push(el('div', '', labelBox))

  const dev = {
    flying: false,
    x: 0,
    y: 0,
    z: 0,
    speed: C.speed,
    hud: true,
    openPanel: null as Devtools['openPanel'],
    showLabels: false,
    db: null as any,
    marks: [] as Mark[],
    goTo: null as Devtools['goTo'],
    extras: (() => '') as () => string,
    openGroups: [0],
  } as unknown as Devtools & { openGroups: number[] }

  Object.defineProperties(dev, {
    scenarioList: { get: () => runner.list, enumerable: true },
    activeScenario: { get: () => runner.active, enumerable: true },
  })

  // ---- position ----
  dev.compass = (yaw) => compass(yaw, S.compass) // yaw 0 looks toward -z (north)
  dev.here = (): HereInfo => {
    const p = C.position()
    const [heading, degrees] = dev.compass(p.yaw)
    return {
      x: +p.x.toFixed(1),
      y: +p.y.toFixed(1),
      z: +p.z.toFixed(1),
      yaw: +p.yaw.toFixed(3),
      pitch: +p.pitch.toFixed(3),
      area: C.area(p.x, p.z),
      heading,
      degrees,
      look: Math.round((-p.pitch * 180) / Math.PI),
      time: C.time(),
      flying: dev.flying,
    }
  }
  dev.line = (m) => formatMarkLine(m, C.teams, S)

  // ---- free-fly: keys = { forward, strafe, up, fast } (-1..1); positive pitch looks down ----
  dev.fly = (dt, yaw, pitch, k) => {
    const sp = dev.speed * (k.fast ? 4 : 1) * dt
    const cy = Math.cos(pitch)
    const sy = Math.sin(pitch)
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const L = C.bounds
    dev.x += (fx * cy * k.forward - fz * k.strafe) * sp
    dev.z += (fz * cy * k.forward + fx * k.strafe) * sp
    dev.y += (-sy * k.forward + k.up) * sp
    dev.x = Math.min(L.x[1], Math.max(L.x[0], dev.x))
    dev.y = Math.min(L.y[1], Math.max(L.y[0], dev.y))
    dev.z = Math.min(L.z[1], Math.max(L.z[0], dev.z))
  }
  dev.flyCamera = (cam, yaw, pitch) => {
    const cy = Math.cos(pitch)
    cam.position.set(dev.x, dev.y, dev.z)
    cam.lookAt(dev.x - Math.sin(yaw) * cy, dev.y - Math.sin(pitch), dev.z - Math.cos(yaw) * cy)
  }
  const onWheel = (e: WheelEvent) => {
    if (dev.flying && !dev.openPanel) dev.speed = Math.min(120, Math.max(2, dev.speed * (e.deltaY > 0 ? 0.8 : 1.25)))
  }
  window.addEventListener('wheel', onWheel, { passive: true })

  // ---- what the game offers in the panel ----
  dev.toggle = (id, label, get, set) => {
    dt0.toggles.push({ id, label, get, set })
    return dev
  }
  dev.action = (id, label, fn) => {
    dt0.actions.push({ id, label, fn })
    return dev
  }
  dev.timesOfDay = (l, set) => {
    dt0.times = l
    dt0.setTime = set
    return dev
  } // l: [[label, value]]
  dev.places = (fn) => {
    dt0.placeGroups = fn
    return dev
  } // fn() -> [[group, [[name, go()]]]]
  dev.labelsFor = (fn) => {
    dt0.labelsFn = fn
    return dev
  } // fn(camera) -> [{x,y,z,text,color}] already sorted by proximity

  // ---- test scenarios: { id, ... } + apply(s) + check(s) -> { criterion: { ok, note } } ----
  dev.scenarios = (l, apply, check) => {
    runner.set(l, apply as never, check as never)
    return dev
  }
  dev.scenario = (id) => runner.run(id)
  dev.check = (id) => runner.check(id)

  // ---- marks: the artifact database when there is one (Claude reads it), otherwise the browser ----
  const lsRead = (): Mark[] => {
    try {
      return JSON.parse(localStorage.getItem(C.marksStorageKey) || '[]')
    } catch (e) {
      return []
    }
  }
  const lsWrite = (a: Mark[]) => {
    try {
      localStorage.setItem(C.marksStorageKey, JSON.stringify(a))
    } catch (e) {}
  }
  dev.marks = lsRead()
  ;(async () => {
    try {
      if (!window.claude || !window.claude.use) return
      const db = await window.claude.use('db')
      if (!db) return
      dev.db = db
      db.collection(C.collection).onSnapshot(
        (s: any) => {
          dev.marks = s.docs.map((d: any) => ({ id: d.id, ...d.data() }))
          if (dev.openPanel === 'list') render()
        },
        () => {},
      )
    } catch (e) {}
  })()
  async function saveMark(m: Mark) {
    if (dev.db) {
      try {
        const u = await window.claude!.use('user')
        if (u) m.by = await u.id()
      } catch (e) {}
      try {
        await dev.db.collection(C.collection).add(m)
        C.notify(S.savedServerMsg, 2)
        return
      } catch (e) {
        C.notify(S.serverFailMsg, 3)
      }
    }
    m.id = 'm' + m.at
    const a = lsRead()
    a.push(m)
    lsWrite(a)
    dev.marks = a
    C.notify(S.savedBrowserMsg, 2.5)
  }
  async function deleteMark(id: string) {
    if (dev.db && !id.startsWith('m')) {
      try {
        await dev.db.collection(C.collection).doc(id).delete()
      } catch (e) {}
      return
    }
    const a = lsRead().filter((m) => m.id !== id)
    lsWrite(a)
    dev.marks = a
    render()
  }
  dev.goTo = null // the game sets it: (x, y, z, yaw, pitch) => void

  // ---- panels ----
  let here0: HereInfo | null = null
  dev.open = (which) => {
    if (dev.openPanel) return
    dev.openPanel = which
    C.pause(true)
    if (which === 'form') {
      here0 = dev.here()
      form.innerHTML = `<h2>${esc(S.markHereTitle)}</h2><p class="gd-sub">${esc(`${here0.area} · x ${here0.x} y ${here0.y} z ${here0.z} · ${S.lookingAt} ${here0.heading} · ${here0.time}`)}</p>
<label class="gd-sub">${esc(S.teamLabel)} <select id="gd-team">${C.teams.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></label>
<textarea id="gd-note" placeholder="${esc(S.notePlaceholder)}"></textarea>
<div class="gd-row"><button type="button" data-f="save">${esc(S.saveButton)}</button><button type="button" class="ghost" data-f="close">${esc(S.cancelButton)}</button></div>`
      form.hidden = false
      setTimeout(() => form.querySelector('textarea')!.focus(), 30)
    } else {
      render()
      list.hidden = false
    }
  }
  dev.close = () => {
    if (!dev.openPanel) return
    dev.openPanel = null
    form.hidden = list.hidden = true
    C.pause(false)
  }
  form.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      form.querySelector<HTMLButtonElement>('[data-f="save"]')!.click()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      dev.close()
    }
  })
  form.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button')
    if (!b) return
    if (b.dataset.f === 'save')
      saveMark({
        ...here0!,
        team: form.querySelector<HTMLSelectElement>('#gd-team')!.value,
        text: form.querySelector<HTMLTextAreaElement>('#gd-note')!.value.trim(),
        at: Date.now(),
      } as Mark)
    dev.close()
  })
  let places: PlaceGroup[] = []
  function render() {
    const ms = sortMarks(dev.marks)
    places = dt0.placeGroups()
    const toggleBtn = (c: (typeof dt0.toggles)[number]) => {
      const on = !!c.get()
      return `<button type="button" class="${on ? '' : 'ghost'}" data-toggle="${esc(c.id)}">${esc(c.label)}: ${on ? S.yes : S.no}</button>`
    }
    list.innerHTML = `<h2>${esc(S.panelTitle)}</h2>
<div class="gd-row">${dt0.toggles.map(toggleBtn).join('')}</div>
${dt0.actions.length ? `<div class="gd-row">${dt0.actions.map((a) => `<button type="button" class="ghost" data-action="${esc(a.id)}">${esc(typeof a.label === 'function' ? a.label() : a.label)}</button>`).join('')}</div>` : ''}
<h2>${esc(S.placesTitle)}</h2>
${dt0.times.length ? `<div class="gd-row">${dt0.times.map((h, i) => `<button type="button" class="ghost" data-time="${i}">${esc(h[0])}</button>`).join('')}</div>` : ''}
${places.map(([n, ps], i) => `<details data-g="${i}"${dev.openGroups.includes(i) ? ' open' : ''}><summary class="gd-sub">${esc(n)} (${ps.length})</summary><div class="gd-row" style="margin-top:6px">${ps.map((p, j) => `<button type="button" class="ghost" data-place="${i}:${j}">${esc(p[0])}</button>`).join('')}</div></details>`).join('')}
<h2>${esc(S.marksTitle(ms.length))}</h2>
<p class="gd-sub">${dev.db ? S.savedOnServer : S.savedInBrowser}</p>
${ms.map((m) => `<div class="gd-mark"><div class="t">${esc(m.text || S.noNote)}</div><div class="w">${esc(dev.line({ ...m, text: '' }))}</div><div class="b"><button type="button" data-goto="${esc(m.id)}">${esc(S.goButton)}</button><button type="button" class="ghost" data-delete="${esc(m.id)}">${esc(S.deleteButton)}</button></div></div>`).join('') || `<p class="gd-sub">${esc(S.noMarks)}</p>`}
<textarea class="gd-copy" id="gd-copy" readonly>${esc(ms.map(dev.line).join('\n'))}</textarea>
<div class="gd-row"><button type="button" data-f="copy">${esc(S.copyAll)}</button>${dev.db ? '' : `<button type="button" class="ghost" data-f="download" id="gd-download">${esc(S.downloadFile)}</button>`}<button type="button" class="ghost" data-f="close">${esc(S.closeButton)}</button></div>`
  }
  dev.render = render
  list.addEventListener(
    'toggle',
    (e) => {
      const d = (e.target as Element).closest('details')
      if (!d) return
      const i = +d.dataset.g!
      const a = new Set(dev.openGroups)
      if (d.open) a.add(i)
      else a.delete(i)
      dev.openGroups = [...a]
    },
    true,
  )
  list.addEventListener('click', async (e) => {
    const b = (e.target as Element).closest('button')
    if (!b) return
    const d = b.dataset
    if (d.f === 'close') return dev.close()
    if (d.f === 'download') {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([serializeMarks(dev.marks, C.teams, S).file], { type: 'text/plain' }))
      a.download = C.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }
    if (d.f === 'copy') {
      const t = list.querySelector<HTMLTextAreaElement>('#gd-copy')!
      try {
        await navigator.clipboard.writeText(t.value)
        b.textContent = S.copied
      } catch (err) {
        t.select()
        b.textContent = S.copySelected
      }
      return
    }
    if (d.place) {
      const [i, j] = d.place.split(':').map(Number)
      dev.close()
      places[i][1][j][1]()
      return
    }
    if (d.toggle) {
      const c = dt0.toggles.find((c) => c.id === d.toggle)!
      const close = c.set(!c.get())
      return close ? dev.close() : render()
    }
    if (d.action) {
      const a = dt0.actions.find((a) => a.id === d.action)!
      const keep = a.fn()
      return keep ? render() : dev.close()
    }
    if (d.time) {
      dt0.setTime!(dt0.times[+d.time][1])
      return render()
    }
    if (d.goto) {
      const m = dev.marks.find((m) => m.id === d.goto)
      if (m && dev.goTo) {
        dev.close()
        dev.goTo(m.x, m.y, m.z, m.yaw, m.pitch)
      }
      return
    }
    if (d.delete) deleteMark(d.delete)
  })
  const onKeydown = (e: KeyboardEvent) => {
    if (dev.openPanel === 'list' && e.key === 'Escape' && !e.defaultPrevented) dev.close()
  }
  window.addEventListener('keydown', onKeydown)

  // ---- every frame: position (10 times per second) and labels ----
  let acc = 0
  const _v = new THREE.Vector3()
  dev.extras = () => '' // the game may append text to the position line
  dev.update = (dt, cam, visible = true) => {
    // labels
    let k = 0
    if (dev.showLabels && visible) {
      const W = innerWidth
      const H = innerHeight
      for (const t of dt0.labelsFn(cam)) {
        if (k >= LABELS.length) break
        _v.set(t.x, t.y, t.z).project(cam)
        if (_v.z > 1 || _v.x < -1.05 || _v.x > 1.05 || _v.y < -1.05 || _v.y > 1.05) continue
        const d = LABELS[k++]
        if (d.textContent !== t.text) d.textContent = t.text
        d.style.borderColor = d.style.color = t.color || '#9fd0ff'
        d.style.left = (((_v.x + 1) / 2) * W).toFixed(0) + 'px'
        d.style.top = (((1 - _v.y) / 2) * H).toFixed(0) + 'px'
        d.style.display = ''
      }
    }
    for (; k < LABELS.length; k++) if (LABELS[k].style.display !== 'none') LABELS[k].style.display = 'none'
    posEl.hidden = !dev.hud || !visible
    posEl.classList.toggle('flying', dev.flying)
    if ((acc += Math.max(0, dt || 0)) < 0.1) return // the first frame may come with a negative dt
    acc = 0
    const a = dev.here()
    posEl.innerHTML = `<b>${esc(a.area)}</b> · x ${a.x} · y ${a.y} · z ${a.z} · ${a.heading} ${a.degrees}° · ${S.hudLook} ${a.look}° · ${esc(a.time)}${dev.flying ? ` · <b>${S.hudFlight(dev.speed.toFixed(0))}</b>` : ''}${dev.extras()} · ${S.hudMarks(dev.marks.length)}`
  }
  // for automated browser tests (Playwright): window.__scenario(id), __scenarioCheck(id), __scenarioList, __devtools
  dev.expose = () => {
    window.__scenario = dev.scenario
    window.__scenarioCheck = dev.check
    window.__scenarioList = runner.list
    window.__devtools = dev
  }
  dev.dispose = () => {
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKeydown)
    css.remove()
    posEl.remove()
    form.remove()
    list.remove()
    labelBox.remove()
  }
  return dev
}

// `{ ...defaults, ...options }` must not let an explicit `undefined` erase a default
function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
