/**
 * @adatechnology/game-graphics/screen: the settings screen and the frame counter, plain DOM over a `GraphicsController`. The logic lives in the controller;
 * this only shows it and hands the player's changes back.
 */
import { graphicsStrings } from './locale'
import { FPS_CAPS, GRAPHICS_PRESETS, SHADOW_LEVELS, VIEW_DISTANCES, applyPreset, setOption } from './settings'
import type { GraphicsOption, GraphicsSettings } from './settings'
import type { GraphicsController } from './controller'

export { graphicsStrings } from './locale'

export interface GraphicsScreenOptions {
  readonly container: HTMLElement
  readonly controller: GraphicsController
  readonly locale?: string
  /** Replaces any text of the screen by key. */
  readonly strings?: Partial<Record<string, string>>
  /** Called when the screen closes (the host gives the pointer back to the game). */
  readonly onClose?: () => void
}

export interface GraphicsScreen {
  open(): void
  close(): void
  toggle(): void
  readonly isOpen: boolean
  /** The screen's root element (for a host's tests). */
  readonly element: HTMLElement
  dispose(): void
}

const STYLE_ID = 'ada-graphics-style'
const CSS = `
.agfx-back{position:absolute;inset:0;background:rgba(8,12,18,.55);display:none;align-items:center;justify-content:center;z-index:60;font:14px/1.35 system-ui,sans-serif}
.agfx-back.open{display:flex}
.agfx{background:#151b23;color:#e8edf3;border:1px solid #2c3746;border-radius:12px;width:min(460px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.agfx h2{margin:0 0 12px;font-size:18px}
.agfx-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.agfx button{font:inherit;color:inherit;background:#222c39;border:1px solid #34445a;border-radius:8px;padding:6px 10px;cursor:pointer}
.agfx button:hover{background:#2a3647}
.agfx button.on{background:#2f6fde;border-color:#2f6fde;color:#fff}
.agfx-custom{font-size:12px;color:#9fb0c4;min-height:16px;margin-bottom:10px}
.agfx-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;padding:7px 0;border-top:1px solid #243041}
.agfx-row label{font-weight:600}
.agfx-row select{font:inherit;color:inherit;background:#222c39;border:1px solid #34445a;border-radius:6px;padding:4px 6px}
.agfx-now{grid-column:1/-1;font-size:12px;color:#8fd19e;min-height:0}
.agfx-status{margin-top:12px;font-size:12px;color:#9fb0c4}
.agfx-bar{height:4px;background:#243041;border-radius:2px;margin-top:6px;overflow:hidden}
.agfx-bar>i{display:block;height:100%;background:#2f6fde;width:0}
.agfx-foot{display:flex;justify-content:space-between;gap:8px;margin-top:14px}
.agfx-fps{position:absolute;top:8px;right:8px;z-index:55;background:rgba(0,0,0,.55);color:#9ff0a8;font:600 13px/1 ui-monospace,monospace;padding:5px 7px;border-radius:6px;pointer-events:none;display:none}
.agfx-fps.on{display:block}
`

const injectStyle = (doc: Document): void => {
  if (doc.getElementById(STYLE_ID)) return
  const s = doc.createElement('style')
  s.id = STYLE_ID
  s.textContent = CSS
  doc.head.appendChild(s)
}

const pct = (v: number): string => `${Math.round(v * 100)}%`
const RES_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1]
const HORDE_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
const REFRESH_MS = 250

/** The graphics screen: a preset row and one line per option; under Automático each line says what the automatic mode draws now. */
export function createGraphicsScreen(options: GraphicsScreenOptions): GraphicsScreen {
  const { container, controller } = options
  const doc = container.ownerDocument
  const t = graphicsStrings(options.locale, options.strings)
  injectStyle(doc)
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag)
    if (cls) el.className = cls
    if (text !== undefined) el.textContent = text
    return el
  }

  const back = mk('div', 'agfx-back')
  back.dataset.testid = 'graphics-screen'
  const panel = mk('div', 'agfx')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', t('title'))
  back.appendChild(panel)
  panel.appendChild(mk('h2', undefined, t('title')))
  const presets = mk('div', 'agfx-presets')
  panel.appendChild(presets)
  const presetButtons = GRAPHICS_PRESETS.map((name) => {
    const b = mk('button', undefined, t(`preset.${name}`))
    b.type = 'button'
    b.dataset.preset = name
    b.onclick = () => controller.set(applyPreset(controller.settings, name))
    presets.appendChild(b)
    return b
  })
  const customLine = mk('div', 'agfx-custom')
  panel.appendChild(customLine)

  type Row = { key: GraphicsOption; select: HTMLSelectElement; now: HTMLElement | null; values: () => Array<{ value: string; label: string }> }
  const rows: Row[] = []
  const encode = (v: unknown): string => String(v)
  const decode = (key: GraphicsOption, raw: string): GraphicsSettings[GraphicsOption] => {
    if (raw === 'auto') return 'auto'
    if (key === 'showFps') return raw === 'true'
    if (key === 'resolutionScale' || key === 'hordeDetail' || key === 'fpsCap') return Number(raw) as GraphicsSettings[GraphicsOption]
    return raw as GraphicsSettings[GraphicsOption]
  }
  const addRow = (key: GraphicsOption, values: () => Array<{ value: string; label: string }>, withNow: boolean): void => {
    const row = mk('div', 'agfx-row')
    const id = `agfx-${key}`
    const label = mk('label', undefined, t(key))
    label.htmlFor = id
    const select = mk('select')
    select.id = id
    select.dataset.option = key
    select.onchange = () => controller.set(setOption(controller.settings, key, decode(key, select.value) as never))
    row.append(label, select)
    const now = withNow ? mk('div', 'agfx-now') : null
    if (now) row.appendChild(now)
    panel.appendChild(row)
    rows.push({ key, select, now, values })
  }
  const auto = { value: 'auto', label: t('auto') }
  addRow('resolutionScale', () => [auto, ...RES_STEPS.map((v) => ({ value: encode(v), label: pct(v) }))], true)
  addRow('hordeDetail', () => [auto, ...HORDE_STEPS.map((v) => ({ value: encode(v), label: pct(v) }))], true)
  addRow('shadows', () => [auto, ...SHADOW_LEVELS.map((v) => ({ value: v, label: t(`shadows.${v}`) }))], true)
  addRow('viewDistance', () => [auto, ...VIEW_DISTANCES.map((v) => ({ value: v, label: t(`viewDistance.${v}`) }))], true)
  addRow('fpsCap', () => FPS_CAPS.map((v) => ({ value: encode(v), label: v === 0 ? t('fpsCap.0') : String(v) })), false)
  addRow('showFps', () => [{ value: 'true', label: t('on') }, { value: 'false', label: t('off') }], false)

  const status = mk('div', 'agfx-status')
  const statusText = mk('div')
  const bar = mk('div', 'agfx-bar')
  const barFill = mk('i')
  bar.appendChild(barFill)
  status.append(statusText, bar, mk('div', undefined, t('autoHint')))
  panel.appendChild(status)
  const foot = mk('div', 'agfx-foot')
  const recal = mk('button', undefined, t('recalibrate'))
  recal.type = 'button'
  recal.dataset.action = 'recalibrate'
  recal.onclick = () => controller.recalibrate()
  const closeBtn = mk('button', undefined, t('close'))
  closeBtn.type = 'button'
  closeBtn.dataset.action = 'close'
  closeBtn.onclick = () => screen.close()
  foot.append(recal, closeBtn)
  panel.appendChild(foot)
  container.appendChild(back)
  back.addEventListener('click', (e) => {
    if (e.target === back) screen.close()
  })
  // keys pressed on the screen are the screen's (Esc closes it), not the game's
  back.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') screen.close()
  })

  const nowText = (key: GraphicsOption): string => {
    const e = controller.effective
    if (key === 'resolutionScale') return pct(e.resolutionScale)
    if (key === 'shadows') return t(`shadows.${e.shadows}`)
    if (key === 'viewDistance') return t(`viewDistance.${e.viewDistance}`)
    if (key === 'hordeDetail') return controller.reported.hordeDetail !== undefined ? pct(controller.reported.hordeDetail) : '…'
    return ''
  }
  const render = (): void => {
    const s = controller.settings
    for (const b of presetButtons) b.classList.toggle('on', b.dataset.preset === s.preset)
    customLine.textContent = s.preset === 'custom' ? t('preset.custom') : ''
    for (const row of rows) {
      const current = encode(s[row.key])
      const values = row.values()
      if (!values.some((v) => v.value === current)) values.push({ value: current, label: typeof s[row.key] === 'number' ? pct(s[row.key] as number) : current })
      if (row.select.options.length !== values.length || [...row.select.options].some((o, i) => o.value !== values[i]!.value)) {
        row.select.textContent = ''
        for (const v of values) {
          const o = mk('option', undefined, v.label)
          o.value = v.value
          row.select.appendChild(o)
        }
      }
      row.select.value = current
      if (row.now) row.now.textContent = s[row.key] === 'auto' ? t('now', { value: nowText(row.key) }) : ''
    }
    const c = controller.calibration
    const calibrating = controller.phase === 'calibrating'
    statusText.textContent = calibrating
      ? t('calibrating', { percent: Math.round(controller.calibrationProgress * 100) })
      : c
        ? t('calibrated', { tier: t(`preset.${c.tier}`), ms: c.p50Ms.toFixed(1) })
        : t('uncalibrated')
    bar.style.display = calibrating ? 'block' : 'none'
    barFill.style.width = `${Math.round(controller.calibrationProgress * 100)}%`
    recal.disabled = calibrating
  }

  let timer: ReturnType<typeof setInterval> | null = null
  const unsubscribe = controller.subscribe(() => {
    if (screen.isOpen) render()
  })
  const screen: GraphicsScreen = {
    open() {
      if (screen.isOpen) return
      back.classList.add('open')
      render()
      timer = setInterval(render, REFRESH_MS)
      ;(presetButtons.find((b) => b.classList.contains('on')) ?? presetButtons[0])?.focus()
    },
    close() {
      if (!screen.isOpen) return
      back.classList.remove('open')
      if (timer) clearInterval(timer)
      timer = null
      options.onClose?.()
    },
    toggle() {
      if (screen.isOpen) screen.close()
      else screen.open()
    },
    get isOpen() {
      return back.classList.contains('open')
    },
    element: back,
    dispose() {
      if (timer) clearInterval(timer)
      unsubscribe()
      back.remove()
    },
  }
  return screen
}

export interface FpsOverlay {
  readonly element: HTMLElement
  dispose(): void
}

/** The frame counter in a corner, shown while the player's `showFps` is on. */
export function createFpsOverlay(options: { readonly container: HTMLElement; readonly controller: GraphicsController; readonly locale?: string }): FpsOverlay {
  const doc = options.container.ownerDocument
  injectStyle(doc)
  const t = graphicsStrings(options.locale)
  const el = doc.createElement('div')
  el.className = 'agfx-fps'
  el.dataset.testid = 'fps-counter'
  options.container.appendChild(el)
  const render = (): void => {
    const on = options.controller.settings.showFps
    el.classList.toggle('on', on)
    // a slow machine reads 0.5, not 0
    const fps = options.controller.fps
    if (on) el.textContent = t('fps', { fps: fps < 10 ? fps.toFixed(1) : Math.round(fps) })
  }
  render()
  const timer = setInterval(render, REFRESH_MS)
  const unsubscribe = options.controller.subscribe(render)
  return {
    element: el,
    dispose() {
      clearInterval(timer)
      unsubscribe()
      el.remove()
    },
  }
}
