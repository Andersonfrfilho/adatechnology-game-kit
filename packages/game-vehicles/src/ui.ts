/** Damage-map widgets (SVG top-down map, band buttons, legend, health bar, scenario buttons). Optional: nothing else depends on it. */
import type { Kit } from './types'

const SVGNS = 'http://www.w3.org/2000/svg'
/** Label colour on each band tile (dark on light bands, light on dark ones). */
const BAND_TEXT = ['#10140f', '#1c1606', '#1f1206', '#fff3ef', '#f1f2f2']

export function installUi(kit: Kit): void {
  const document = kit.document

  /** UI text: `config.texts.ui[key]` wins over the locale string `ui.<key>`. */
  function T(key: string): string {
    const override = kit.config.texts.ui || {}
    if (override[key] != null) return override[key]
    return kit.t('ui.' + key)
  }
  function el(tag: string, cls?: string | null, txt?: string | null): any {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (txt != null) e.textContent = txt
    return e
  }
  function sv(tag: string, attrs?: Record<string, any>, parent?: any): any {
    const e = document.createElementNS(SVGNS, tag)
    Object.keys(attrs || {}).forEach(function (k) {
      e.setAttribute(k, (attrs as any)[k])
    })
    if (parent) parent.appendChild(e)
    return e
  }
  /** "Front door · Dented 38%" */
  function zoneLabel(z: any): string {
    const B = kit.bands[kit.bandOf(z.health)]
    return z.name + ' · ' + B.name + ' ' + z.health + '%'
  }
  /** Health range of a band as text ("76–100"); empty for the last band. */
  function bandRange(i: number): string {
    const B = kit.bands
    if (i === B.length - 1) return ''
    return B[i].min + '–' + (i === 0 ? 100 : B[i - 1].min - 1)
  }

  /**
   * Top-down damage map (SVG). `host`: element; `c`: context from `kit.build`; `o`: `{ selected (zone id), onSelect(id) }`.
   * External zones are drawn on the vehicle outline, internal zones in a strip of blocks below.
   */
  function damageMap(host: any, c: any, o?: any): any {
    o = o || {}
    const sel = o.selected
    host.innerHTML = ''
    const Z = c.zones
    const ext = Z.filter(function (z: any) {
      return !z.internal
    })
    const inn = Z.filter(function (z: any) {
      return z.internal
    })
    if (!ext.length) {
      host.appendChild(el('p', 'muted', T('noZones')))
      return null
    }
    let x0 = 1e9
    let x1 = -1e9
    let z0 = 1e9
    let z1 = -1e9
    ext.forEach(function (z: any) {
      x0 = Math.min(x0, z.map[0])
      x1 = Math.max(x1, z.map[1])
      z0 = Math.min(z0, z.map[2])
      z1 = Math.max(z1, z.map[3])
    })
    const sx = x1 - x0 || 1
    const sz = z1 - z0 || 1
    const s = Math.min(230 / sz, 290 / sx)
    let kz = 1
    let kx = 1
    const w = sz * s
    const h = sx * s
    if (w < 0.45 * h) kz = (0.45 * h) / w
    if (h < 0.75 * w) kx = (0.75 * w) / h
    const pad = 10
    const top = 22
    const W = Math.max(w * kz + 2 * pad, 240)
    const offX = (W - w * kz) / 2
    const H = h * kx
    const cols = 2
    const tw = (W - 2 * pad - (cols - 1) * 6) / cols
    const rows = Math.ceil(inn.length / cols)
    const stripY = top + H + 18
    const VH = stripY + (inn.length ? 14 + rows * 32 : 0) + 4
    const svg = sv('svg', { viewBox: '0 0 ' + W.toFixed(1) + ' ' + VH.toFixed(1), role: 'group', 'aria-label': T('aria'), class: 'dmap' }, host)
    function X(zv: number) {
      return offX + (zv - z0) * s * kz
    }
    function Y(xv: number) {
      return top + (x1 - xv) * s * kx
    }
    const m = c.meta
    const F = m.front
    const R = m.rear
    const hw = (m.width || 1.7) / 2
    sv(
      'rect',
      { x: X(-hw).toFixed(1), y: Y(F).toFixed(1), width: (X(hw) - X(-hw)).toFixed(1), height: (Y(R) - Y(F)).toFixed(1), rx: 10, class: 'dm-body' },
      svg,
    )
    const tf = sv('text', { x: (W / 2).toFixed(1), y: 13, class: 'dm-front', 'text-anchor': 'middle' }, svg)
    tf.textContent = T('front')
    function node(z: any, x: number, y: number, wd: number, ht: number, parent: any) {
      const b = kit.bandOf(z.health)
      const g = sv(
        'g',
        {
          class: 'zn' + (z.id === sel ? ' sel' : '') + (b === 4 ? ' gone' : ''),
          tabindex: '0',
          role: 'button',
          'data-id': z.id,
          'aria-label': zoneLabel(z),
          'aria-pressed': z.id === sel ? 'true' : 'false',
        },
        parent,
      )
      sv('title', {}, g).textContent = zoneLabel(z)
      sv(
        'rect',
        {
          x: x.toFixed(1),
          y: y.toFixed(1),
          width: Math.max(3, wd).toFixed(1),
          height: Math.max(3, ht).toFixed(1),
          rx: 3,
          fill: b === 4 ? 'transparent' : kit.bands[b].color,
        },
        g,
      )
      return g
    }
    ext
      .slice()
      .sort(function (a: any, b: any) {
        return (b.map[1] - b.map[0]) * (b.map[3] - b.map[2]) - (a.map[1] - a.map[0]) * (a.map[3] - a.map[2])
      })
      .forEach(function (z: any) {
        node(z, X(z.map[2]), Y(z.map[1]), X(z.map[3]) - X(z.map[2]), Y(z.map[0]) - Y(z.map[1]), svg)
      })
    if (inn.length) {
      const tl = sv('text', { x: pad, y: stripY, class: 'dm-sub' }, svg)
      tl.textContent = T('inside')
      inn.forEach(function (z: any, i: number) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = pad + col * (tw + 6)
        const y = stripY + 8 + row * 32
        const b = kit.bandOf(z.health)
        const g = node(z, x, y, tw, 26, svg)
        const t = sv(
          'text',
          { x: (x + tw / 2).toFixed(1), y: (y + 17).toFixed(1), 'text-anchor': 'middle', class: 'dm-tile', fill: b === 4 ? '#c9cdd0' : BAND_TEXT[b] },
          g,
        )
        const mc = Math.floor(tw / 6.1)
        t.textContent = z.name.length > mc ? z.name.slice(0, mc - 1) + '…' : z.name
      })
    }
    svg.querySelectorAll('.zn').forEach(function (g: any) {
      function pick() {
        if (o.onSelect) o.onSelect(g.getAttribute('data-id'))
      }
      g.addEventListener('click', pick)
      g.addEventListener('keydown', function (e: any) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      })
    })
    return svg
  }

  /** One button per band; `onPick(targetHealth, bandIndex)`. Returns the buttons. */
  function bandButtons(host: any, onPick?: (health: number, band: number) => void): any[] {
    host.innerHTML = ''
    return kit.bands.map(function (B: any, i: number) {
      const b = el('button', null, B.name)
      b.type = 'button'
      b.dataset.b = i
      b.style.setProperty('--band', B.color)
      b.addEventListener('click', function () {
        if (onPick) onPick(B.health, i)
      })
      host.appendChild(b)
      return b
    })
  }

  /** Band legend with the health ranges. */
  function legend(host: any): void {
    host.innerHTML = ''
    kit.bands.forEach(function (B: any, i: number, A: any[]) {
      const gone = i === A.length - 1
      const sp = el('span', gone ? 'gone' : null)
      const sw = el('i')
      sw.style.background = gone ? 'transparent' : B.color
      sp.appendChild(sw)
      sp.appendChild(document.createTextNode(B.name + (gone ? '' : ' ' + bandRange(i))))
      host.appendChild(sp)
    })
  }

  /** Overall health bar. `els`: `{ text, bar }` (elements). Returns `{ health, band, name }`. */
  function healthBar(els: { text?: any; bar?: any }, c: any): any {
    const O = kit.zoneOverall(c)
    if (els.text) els.text.textContent = T('health') + ' ' + O.health + '% · ' + O.name
    if (els.bar) {
      els.bar.style.width = O.health + '%'
      els.bar.style.background = kit.bands[O.band].color
    }
    return O
  }

  /** One button per registered scenario; `onRun(id)`. */
  function scenarioButtons(host: any, onRun: (id: string) => void): any[] {
    host.innerHTML = ''
    return kit.scenarios.map(function (S: any) {
      const b = el('button', null, S.name)
      b.type = 'button'
      b.dataset.sc = S.id
      b.addEventListener('click', function () {
        onRun(S.id)
      })
      host.appendChild(b)
      return b
    })
  }

  /** Minimal CSS for pages without their own stylesheet (the variables have defaults). */
  function css(): string {
    return (
      'svg.dmap{width:100%;max-width:300px;height:auto;max-height:460px;display:block}svg.dmap .dm-body{fill:var(--panel-2,#1c2127);stroke:var(--line,#39414a)}' +
      'svg.dmap .dm-front,svg.dmap .dm-sub{font:9.5px monospace;fill:var(--muted,#9aa3ab);letter-spacing:.08em}svg.dmap .dm-tile{font:600 10.5px sans-serif;pointer-events:none}' +
      'svg.dmap .zn{cursor:pointer;outline:none}svg.dmap .zn rect{stroke:#0b0e11;stroke-width:1;fill-opacity:.9}svg.dmap .zn.gone rect{stroke:#8a9095;stroke-dasharray:3 2;fill:rgba(110,115,119,.18)}' +
      'svg.dmap .zn:hover rect{stroke:#fff;stroke-width:1.6}svg.dmap .zn.sel rect{stroke:#e0a548;stroke-width:2.6}'
    )
  }
  /** Adds the minimal CSS to the document head once. */
  function injectStyles(): void {
    if (document.getElementById('vehicles-ui-css')) return
    const s = el('style')
    s.id = 'vehicles-ui-css'
    s.textContent = css()
    document.head.appendChild(s)
  }

  kit.ui = { damageMap, bandButtons, legend, healthBar, scenarioButtons, zoneLabel, bandRange, css, injectStyles }
}
