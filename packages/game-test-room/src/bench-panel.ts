import type { ControlValue } from '@adatechnology/game-contracts'
import type { BenchControl, BenchLayer } from './types'

/** What the bench panel shows: the active module's bench, or only the room counters. */
export interface BenchView {
  readonly title: string
  readonly controls: readonly BenchControl[]
  readonly layers: readonly BenchLayer[]
}

export interface MetricRow {
  readonly id: string
  readonly name: string
  readonly text: string
  /** Value over the budget, when the metric has one. */
  readonly ratio?: number
}

export interface BenchPanelOptions {
  t: (key: string, vars?: Record<string, string | number>) => string
  num: (n: number, digits?: number) => string
  onControl: (id: string, value: ControlValue) => void
  onLayer: (id: string, on: boolean) => void
  onAction: (id: string) => void
}

export interface BenchPanel {
  readonly element: HTMLElement
  show(view: BenchView | null): void
  metrics(rows: { room: readonly MetricRow[]; module: readonly MetricRow[] }): void
  readonly visible: boolean
}

const SEGMENTED_MAX = 4

const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

// the shape of the panel without the values: when it is unchanged the values are updated in place (a range being dragged keeps its focus)
const shapeOf = (view: BenchView): string =>
  JSON.stringify([view.title, view.controls.map((c) => ({ ...c, value: undefined })), view.layers.map((l) => [l.id, l.name])])

export function createBenchPanel(o: BenchPanelOptions): BenchPanel {
  const { t } = o
  const element = mk('div', 'tr-panel tr-bench')
  element.style.display = 'none'
  element.addEventListener('keydown', (e) => e.stopPropagation())
  const roomLine = mk('div', 'sub tr-bench-room')
  const body = mk('div')
  const metricTitle = mk('div', 'sub', t('ui.metrics'))
  metricTitle.style.display = 'none'
  const metricList = mk('dl', 'tr-metrics')
  element.append(mk('h3', undefined, t('ui.bench')), roomLine, body, metricTitle, metricList)

  let shape = ''
  let hasRoom = false
  let hasBench = false
  const refreshers: Array<(view: BenchView) => void> = []
  const metricNodes = new Map<string, { text: HTMLElement; bar: HTMLElement | null }>()
  let metricKey = ''

  const syncDisplay = (): void => {
    element.style.display = hasRoom || hasBench ? '' : 'none'
  }

  const numberControl = (control: Extract<BenchControl, { kind: 'number' }>): HTMLElement => {
    const wrap = mk('label', 'tr-ctl')
    const input = mk('input')
    input.type = 'range'
    input.min = String(control.min)
    input.max = String(control.max)
    input.step = control.step ? String(control.step) : 'any'
    input.disabled = control.disabled
    const reading = mk('output')
    input.oninput = () => o.onControl(control.id, Number(input.value))
    wrap.append(mk('span', undefined, control.name), input, reading)
    refreshers.push((view) => {
      const value = view.controls.find((c) => c.id === control.id)?.value
      if (typeof value !== 'number') return
      if (Number(input.value) !== value) input.value = String(value)
      reading.textContent = `${o.num(value, control.step && control.step >= 1 ? 0 : 2)}${control.unit ? ` ${control.unit}` : ''}`
    })
    return wrap
  }

  const booleanControl = (control: BenchControl): HTMLElement => {
    const wrap = mk('label', 'tr-ctl')
    const box = mk('input')
    box.type = 'checkbox'
    box.disabled = control.disabled
    box.onchange = () => o.onControl(control.id, box.checked)
    wrap.append(box, document.createTextNode(` ${control.name}`))
    refreshers.push((view) => {
      box.checked = view.controls.find((c) => c.id === control.id)?.value === true
    })
    return wrap
  }

  const choiceControl = (control: Extract<BenchControl, { kind: 'choice' }>): HTMLElement => {
    const wrap = mk('div', 'tr-ctl')
    wrap.appendChild(mk('span', undefined, control.name))
    if (control.options.length <= SEGMENTED_MAX) {
      const group = mk('div', 'tr-seg')
      group.setAttribute('role', 'group')
      const buttons = control.options.map((option) => {
        const b = mk('button', 'tr-btn', option.name)
        b.type = 'button'
        b.disabled = control.disabled
        b.onclick = () => o.onControl(control.id, option.id)
        group.appendChild(b)
        return { b, id: option.id }
      })
      wrap.appendChild(group)
      refreshers.push((view) => {
        const value = view.controls.find((c) => c.id === control.id)?.value
        for (const { b, id } of buttons) {
          b.setAttribute('aria-pressed', String(id === value))
          b.classList.toggle('on', id === value)
        }
      })
      return wrap
    }
    const select = mk('select')
    select.disabled = control.disabled
    for (const option of control.options) {
      const op = mk('option', undefined, option.name)
      op.value = option.id
      select.appendChild(op)
    }
    select.onchange = () => o.onControl(control.id, select.value)
    wrap.appendChild(select)
    refreshers.push((view) => {
      const value = view.controls.find((c) => c.id === control.id)?.value
      if (typeof value === 'string') select.value = value
    })
    return wrap
  }

  const actionControl = (control: BenchControl): HTMLElement => {
    const b = mk('button', 'tr-btn', control.name)
    b.type = 'button'
    b.disabled = control.disabled
    b.onclick = () => o.onAction(control.id)
    return b
  }

  const controlElement = (control: BenchControl): HTMLElement => {
    const el = control.kind === 'number' ? numberControl(control) : control.kind === 'boolean' ? booleanControl(control) : control.kind === 'choice' ? choiceControl(control) : actionControl(control)
    if (control.hint) el.title = control.hint
    return el
  }

  const layerList = (layers: readonly BenchLayer[]): HTMLElement => {
    const wrap = mk('div', 'tr-layers')
    wrap.appendChild(mk('div', 'sub', t('ui.layers')))
    for (const layer of layers) {
      const label = mk('label', 'tr-ctl')
      const box = mk('input')
      box.type = 'checkbox'
      box.onchange = () => o.onLayer(layer.id, box.checked)
      label.append(box, document.createTextNode(` ${layer.name}`))
      wrap.appendChild(label)
      refreshers.push((view) => {
        box.checked = view.layers.find((l) => l.id === layer.id)?.on === true
      })
    }
    return wrap
  }

  const rebuild = (view: BenchView): void => {
    body.textContent = ''
    refreshers.length = 0
    body.appendChild(mk('div', 'sub', view.title))
    const list = mk('div', 'tr-ctls')
    for (const control of view.controls) if (!control.hidden) list.appendChild(controlElement(control))
    body.appendChild(list)
    if (view.layers.length) body.appendChild(layerList(view.layers))
  }

  const renderMetrics = (rows: readonly MetricRow[]): void => {
    metricList.textContent = ''
    metricNodes.clear()
    metricTitle.style.display = rows.length ? '' : 'none'
    for (const row of rows) {
      const dd = mk('dd')
      const text = mk('span', undefined, row.text)
      dd.appendChild(text)
      let bar: HTMLElement | null = null
      if (row.ratio !== undefined) {
        bar = mk('div', 'tr-bar')
        bar.appendChild(mk('i'))
        dd.appendChild(bar)
      }
      metricList.append(mk('dt', undefined, row.name), dd)
      metricNodes.set(row.id, { text, bar })
    }
  }

  const fillBar = (bar: HTMLElement, ratio: number): void => {
    bar.className = `tr-bar${ratio > 1 ? ' bad' : ratio >= 0.8 ? ' warn' : ''}`
    const fill = bar.firstElementChild as HTMLElement
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`
  }

  return {
    element,
    show(view) {
      hasBench = view !== null
      syncDisplay()
      if (!view) {
        shape = ''
        body.textContent = ''
        refreshers.length = 0
        renderMetrics([])
        metricKey = ''
        return
      }
      const next = shapeOf(view)
      if (next !== shape) {
        shape = next
        rebuild(view)
      }
      for (const refresh of refreshers) refresh(view)
    },
    metrics(rows) {
      hasRoom = rows.room.length > 0
      syncDisplay()
      roomLine.textContent = rows.room.map((row) => `${row.name} ${row.text}`).join(' · ')
      const key = rows.module.map((row) => `${row.id}:${row.ratio !== undefined}`).join('|')
      if (key !== metricKey) {
        metricKey = key
        renderMetrics(rows.module)
      }
      for (const row of rows.module) {
        const node = metricNodes.get(row.id)
        if (!node) continue
        node.text.textContent = row.text
        if (node.bar && row.ratio !== undefined) fillBar(node.bar, row.ratio)
      }
    },
    get visible() {
      return element.style.display !== 'none'
    },
  }
}
