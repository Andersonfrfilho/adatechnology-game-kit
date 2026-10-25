// "Plantas" mode: the layout of a city plan of game-urban as a flat 2D map on a canvas overlay (coloured districts, lines, landmarks), a select with the
// plans, and a button that fills the blocks of the downtown / commercial districts with buildings through `urban.cities.fillBlock`.
import { createUrban } from '@adatechnology/game-urban'

const LINE_COLORS = { avenue: '#f2f2f2', street: '#cfcfcf', highway: '#ffd27a', rail: '#444444', river: '#4aa3ff' }
const FILL_KINDS = ['downtown', 'commercial_center']
const T = {
  'pt-BR': { title: 'Plantas', fill: 'Preencher quadras do centro', clear: 'Limpar', close: 'Fechar', blocks: 'quadras', buildings: 'prédios', max: 'andares (máx.)' },
  en: { title: 'City plans', fill: 'Fill downtown blocks', clear: 'Clear', close: 'Close', blocks: 'blocks', buildings: 'buildings', max: 'floors (max)' },
}

/** Draws a layout on a 2D canvas context. Returns the transform ({ scale, x, z }) so the caller can add to the drawing. */
export function drawLayout(ctx, layout, width, height) {
  const [w, d] = layout.size
  const scale = Math.min(width / w, height / d)
  const px = (x) => width / 2 + x * scale
  const pz = (z) => height / 2 + z * scale
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#10141a'
  ctx.fillRect(0, 0, width, height)
  for (const dist of layout.districts) {
    const [x0, z0, x1, z1] = dist.rect
    ctx.fillStyle = dist.color
    ctx.fillRect(px(x0), pz(z0), (x1 - x0) * scale, (z1 - z0) * scale)
  }
  for (const line of layout.lines) {
    ctx.strokeStyle = LINE_COLORS[line.kind] ?? '#ffffff'
    ctx.lineWidth = Math.max(1, line.width * scale)
    ctx.beginPath()
    line.points.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))))
    ctx.stroke()
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = '11px sans-serif'
  for (const l of layout.landmarks) {
    ctx.beginPath()
    ctx.arc(px(l.at[0]), pz(l.at[1]), 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillText(l.name ?? l.kind, px(l.at[0]) + 5, pz(l.at[1]) - 4)
  }
  return { scale, px, pz }
}

/** Fills the blocks of the downtown and commercial districts of a layout. Returns the buildings placed and the number of blocks. */
export function fillDowntown(urban, layout, seed = 7) {
  const b = urban.builder({ seed })
  const placed = []
  let blocks = 0
  for (const d of layout.districts.filter((x) => FILL_KINDS.includes(x.kind))) {
    for (const block of layout.blocks(d.id)) {
      blocks++
      placed.push(...urban.cities.fillBlock(b, block, { k: 2 }))
    }
  }
  return { placed, blocks }
}

/** Opens the overlay in `parent` (default document.body). Returns { element, select(id), fill(), close() }. */
export function openCityPlans({ parent = globalThis.document?.body, locale = 'pt-BR', urban = createUrban(), maxFloors, size = 640 } = {}) {
  const doc = parent.ownerDocument
  const t = T[locale] ?? T.en
  const box = doc.createElement('div')
  box.style.cssText = 'position:fixed;right:12px;top:12px;z-index:50;background:#161b22;color:#e6edf3;font:13px sans-serif;padding:10px;border-radius:8px;box-shadow:0 4px 24px #0008'
  const bar = doc.createElement('div')
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap'
  const title = doc.createElement('b')
  title.textContent = t.title
  const select = doc.createElement('select')
  for (const id of urban.cities.plans.ids()) {
    const o = doc.createElement('option')
    o.value = id
    o.textContent = urban.cities.layout(id, { locale }).name
    select.appendChild(o)
  }
  const mkButton = (label, on) => {
    const btn = doc.createElement('button')
    btn.textContent = label
    btn.onclick = on
    return btn
  }
  const info = doc.createElement('div')
  info.style.cssText = 'margin-top:6px;max-width:' + size + 'px'
  const canvas = doc.createElement('canvas')
  canvas.width = size
  canvas.height = size
  let layout = null
  let buildings = null
  const redraw = () => {
    layout = urban.cities.layout(select.value, { locale, maxFloors })
    const ctx = canvas.getContext('2d')
    const view = drawLayout(ctx, layout, size, size)
    if (buildings) {
      ctx.fillStyle = '#ffffffcc'
      for (const p of buildings.placed) ctx.fillRect(view.px(p.x - p.width / 2), view.pz(p.z - p.depth / 2), Math.max(1, p.width * view.scale), Math.max(1, p.depth * view.scale))
    }
    const stats = urban.cities.stats(layout).map((s) => `${s.kind} ${(s.share * 100).toFixed(1)}%`).join(' · ')
    info.textContent = `${layout.name} (${layout.scale}, ${layout.size.join(' x ')} m) — ${layout.description} | ${stats}` + (buildings ? ` | ${buildings.blocks} ${t.blocks}, ${buildings.placed.length} ${t.buildings}` : '')
  }
  const select_ = (id) => {
    select.value = id
    buildings = null
    redraw()
  }
  const fill = () => {
    buildings = fillDowntown(urban, layout)
    redraw()
    return buildings
  }
  select.onchange = () => select_(select.value)
  bar.append(title, select, mkButton(t.fill, fill), mkButton(t.clear, () => select_(select.value)), mkButton(t.close, () => box.remove()))
  box.append(bar, canvas, info)
  parent.appendChild(box)
  redraw()
  return { element: box, select: select_, fill, close: () => box.remove(), get layout() { return layout } }
}
