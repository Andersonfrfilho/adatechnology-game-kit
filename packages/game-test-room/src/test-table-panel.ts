import { TRIAL_KINDS } from './test-table'
import type { TestTable, TestTablePage } from './test-table'

/** The CSS of the test table panel (the room's panel look: `.tr-panel`, `.tr-btn`, `.tr-row`). */
export const TEST_TABLE_CSS = `
.tr-table{flex:0 0 auto;max-height:42%}
.tr-table .sub{color:#9aa3b2;margin:4px 0}
.tr-table .list{display:flex;flex-wrap:wrap;gap:3px}
.tr-table .list .tr-btn{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tr-table select{flex:1;min-width:0;max-width:55%}
.tr-table .tr-search{margin:6px 0 0}
.tr-root .tr-table button.tr-btn.on{background:#3b3a14;border-color:#ffd23f;color:#fff}
`

const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/**
 * The panel of the test table: a group, its pages (◀ ▶), the items on the table (a click picks the one the trials hit) and one button per trial, plus one that puts the table back.
 */
export function createTestTablePanel(table: TestTable, t: (key: string, vars?: Record<string, string | number>) => string): { element: HTMLElement; refresh(): void; dispose(): void } {
  const element = mk('div', 'tr-panel tr-table')
  element.appendChild(mk('h3', undefined, t('ui.test_table')))
  const head = mk('div', 'tr-row')
  const select = mk('select')
  select.setAttribute('aria-label', t('ui.test_table.group'))
  const lay = mk('button', 'tr-btn', t('ui.test_table.lay'))
  const prev = mk('button', 'tr-btn', '◀')
  const next = mk('button', 'tr-btn', '▶')
  prev.title = t('ui.test_table.prev')
  next.title = t('ui.test_table.next')
  for (const b of [lay, prev, next]) b.type = 'button'
  head.append(select, lay, prev, next)
  // a group has hundreds of items: the search lays the page that holds the one asked for
  const search = mk('input', 'tr-search')
  search.type = 'search'
  search.placeholder = t('ui.test_table.search')
  const found = mk('div', 'list')
  const sub = mk('div', 'sub', t('ui.test_table.hint'))
  const list = mk('div', 'list')
  const trials = mk('div', 'tr-row')
  const trialButtons = TRIAL_KINDS.map((kind) => {
    const b = mk('button', 'tr-btn', t(`ui.trial.${kind}`))
    b.type = 'button'
    b.dataset.trial = kind
    b.title = t(`ui.trial.${kind}.hint`)
    b.onclick = () => table.trial(kind)
    trials.appendChild(b)
    return b
  })
  const relay = mk('button', 'tr-btn', t('ui.test_table.relay'))
  relay.type = 'button'
  relay.onclick = () => table.relay()
  trials.appendChild(relay)
  element.append(head, search, found, sub, list, trials)

  const groups = (): void => {
    const keep = select.value
    select.textContent = ''
    for (const group of table.groups()) {
      const op = mk('option', undefined, group)
      op.value = group
      select.appendChild(op)
    }
    if ([...select.options].some((o) => o.value === keep)) select.value = keep
  }
  const render = (page: TestTablePage | null): void => {
    list.textContent = ''
    prev.disabled = !page?.hasPrev
    next.disabled = !page?.hasNext
    for (const b of [...trialButtons, relay]) b.disabled = !page?.selected
    if (!page) {
      sub.textContent = t('ui.test_table.hint')
      return
    }
    if (select.value !== page.group) select.value = page.group
    sub.textContent = t('ui.test_table.page', { from: page.first + 1, to: page.first + page.objects.length, total: page.total })
    for (const o of page.objects) {
      const b = mk('button', o.objectId === page.selected ? 'tr-btn on' : 'tr-btn', o.name)
      b.type = 'button'
      b.title = o.itemId
      b.onclick = () => table.select(o.objectId)
      list.appendChild(b)
    }
  }
  const fold = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  search.oninput = () => {
    found.textContent = ''
    const term = fold(search.value.trim())
    if (!term) return
    const hits = table.items().filter((item) => fold(`${item.name} ${item.id}`).includes(term)).slice(0, 8)
    for (const item of hits) {
      const b = mk('button', 'tr-btn', item.name)
      b.type = 'button'
      b.title = `${item.group} · ${item.id}`
      b.onclick = () => {
        search.value = ''
        found.textContent = ''
        table.find(item.id)
      }
      found.appendChild(b)
    }
    if (!hits.length) found.appendChild(mk('div', 'sub', t('ui.no_results')))
  }
  lay.onclick = () => table.open(select.value)
  prev.onclick = () => table.prev()
  next.onclick = () => table.next()
  select.onchange = () => table.open(select.value)
  // typing in the select must not move the player or switch tools
  for (const box of [select, search]) box.addEventListener('keydown', (e) => e.stopPropagation())
  const off = table.on(render)
  groups()
  render(table.state())
  return {
    element,
    refresh: () => {
      groups()
      render(table.state())
    },
    dispose: off,
  }
}
