/** One tool the menu offers: its id, name and, when the catalogue has one, its silhouette. */
export interface ToolMenuTool {
  readonly id: string
  readonly name: string
  /** More words a search finds it by (a weapon's maker). */
  readonly keywords?: string
  readonly thumbnail?: string
  readonly thumbnailCredit?: string
}

export interface ToolMenuSection {
  readonly id: string
  readonly name: string
  readonly tools: readonly ToolMenuTool[]
}

/** A tab of the menu (firearms, melee, explosives, tools...): its sections in order. */
export interface ToolMenuGroup {
  readonly id: string
  readonly name: string
  readonly sections: readonly ToolMenuSection[]
}

export interface ToolMenuOptions {
  readonly t: (key: string, vars?: Record<string, string | number>) => string
  /** The groups, read each time the menu opens (a module loaded later adds its thumbnails). */
  readonly groups: () => readonly ToolMenuGroup[]
  /** The tool in hand, marked in the list. */
  readonly current: () => string
  readonly onPick: (toolId: string) => void
  /** Called when the menu opens (the room frees the mouse) and closes. */
  readonly onOpen?: (open: boolean) => void
  readonly thumb: (thumbnail: string, credit?: string) => HTMLElement
}

export interface ToolMenu {
  readonly element: HTMLElement
  /** Opens or closes the menu (no argument: toggles); answers whether it is open now. */
  toggle(open?: boolean): boolean
  readonly open: boolean
}

export const TOOL_MENU_CSS = `
.tr-wmenu{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(880px,92vw);max-height:78vh;display:none;flex-direction:column;z-index:30;pointer-events:auto}
.tr-wmenu.open{display:flex}
.tr-wmenu header{display:flex;gap:6px;align-items:center;margin-bottom:6px}.tr-wmenu header h3{margin:0;flex:1}
.tr-wmenu .tr-search{margin:0;width:220px}
.tr-wmenu-body{overflow:auto;flex:1}
.tr-wmenu-sec h4{margin:8px 0 4px;font-size:11px;color:#9aa3b2;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.tr-wmenu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:4px}
.tr-wmenu-grid .tr-btn{display:flex;flex-direction:column;gap:3px;min-width:0;text-align:left}
.tr-wmenu-grid .tr-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tr-wmenu-grid .tr-thumb{height:22px}
.tr-menu-btn{margin-left:6px;max-width:none}
`

const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The tool picker of the room: every tool of the arsenal by tab and section, a search over all of them, a click puts one in hand. */
export function createToolMenu(o: ToolMenuOptions): ToolMenu {
  const element = mk('div', 'tr-panel tr-wmenu')
  element.dataset.toolMenu = ''
  const header = mk('header')
  const search = mk('input', 'tr-search')
  search.type = 'search'
  search.placeholder = o.t('ui.tool_menu.search')
  const close = mk('button', 'tr-btn', '×')
  close.type = 'button'
  close.title = o.t('ui.tool_menu.close')
  header.append(mk('h3', undefined, o.t('ui.tool_menu')), search, close)
  const tabs = mk('div', 'tr-tabs')
  const body = mk('div', 'tr-wmenu-body')
  element.append(header, tabs, body)
  let open = false
  let activeGroup = ''
  let groups: readonly ToolMenuGroup[] = []

  const toolButton = (tool: ToolMenuTool, group?: string): HTMLButtonElement => {
    const button = mk('button', tool.id === o.current() ? 'tr-btn on' : 'tr-btn')
    button.type = 'button'
    button.title = tool.name
    button.dataset.tool = tool.id
    if (tool.thumbnail) button.appendChild(o.thumb(tool.thumbnail, tool.thumbnailCredit))
    button.appendChild(mk('span', undefined, tool.name))
    if (group) button.appendChild(mk('small', undefined, group))
    button.onclick = () => {
      o.onPick(tool.id)
      toggle(false)
    }
    return button
  }
  const section = (name: string, buttons: HTMLButtonElement[]): HTMLElement => {
    const wrap = mk('div', 'tr-wmenu-sec')
    const grid = mk('div', 'tr-wmenu-grid')
    grid.append(...buttons)
    wrap.append(mk('h4', undefined, name), grid)
    return wrap
  }
  const renderBody = (): void => {
    body.textContent = ''
    const term = fold(search.value.trim())
    if (term) {
      const found = groups.flatMap((group) => group.sections.flatMap((s) => s.tools.filter((tool) => fold(`${tool.name} ${tool.id} ${tool.keywords ?? ''} ${s.name}`).includes(term)).map((tool) => toolButton(tool, s.name))))
      body.appendChild(found.length ? section(o.t('ui.tool_menu.results', { n: found.length }), found) : mk('div', 'tr-empty', o.t('ui.no_results')))
      return
    }
    const group = groups.find((g) => g.id === activeGroup)
    for (const s of group?.sections ?? []) body.appendChild(section(`${s.name} (${s.tools.length})`, s.tools.map((tool) => toolButton(tool))))
  }
  const renderTabs = (): void => {
    tabs.textContent = ''
    if (!groups.some((g) => g.id === activeGroup)) activeGroup = groups.find((g) => g.sections.some((s) => s.tools.some((tool) => tool.id === o.current())))?.id ?? groups[0]?.id ?? ''
    for (const group of groups) {
      const count = group.sections.reduce((sum, s) => sum + s.tools.length, 0)
      const button = mk('button', group.id === activeGroup ? 'tr-btn on' : 'tr-btn', `${group.name} (${count})`)
      button.type = 'button'
      button.dataset.group = group.id
      button.onclick = () => {
        activeGroup = group.id
        search.value = ''
        renderTabs()
      }
      tabs.appendChild(button)
    }
    renderBody()
  }
  search.oninput = renderBody
  close.onclick = () => toggle(false)
  element.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') toggle(false)
  })

  function toggle(next?: boolean): boolean {
    const want = next ?? !open
    if (want === open) return open
    open = want
    element.classList.toggle('open', open)
    if (open) {
      groups = o.groups()
      activeGroup = ''
      search.value = ''
      renderTabs()
    }
    o.onOpen?.(open)
    return open
  }

  return {
    element,
    toggle,
    get open() {
      return open
    },
  }
}
