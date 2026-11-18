// Electron's main process: serves the room's folder on 127.0.0.1 with COOP/COEP (the page is cross-origin isolated, so SharedArrayBuffer and Jolt's
// multithreaded build), opens the start menu or the area of --area, and keeps the window menu's list of rooms and areas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, join } from 'node:path'

import { BrowserWindow, Menu, app, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

import { ISOLATION, createRoomHandler, isolationHeaders } from '@adatechnology/serve-room-tool'

import { MENU_PATH, ROOM_PAGE, parseLaunch, pathOf, resolveArea, roomAreasOf } from './areas'
import type { DesktopManifest, LaunchOptions, RoomArea, Target } from './areas'
import { BADGE_SCRIPT, MODULES_SCRIPT } from './page-scripts'
import { renderMenuPage } from './menu-page'

const ISOLATION_MODE = ISOLATION.REQUIRE_CORP
const roomRoot = process.env.KIT_DESKTOP_ROOM ?? (app.isPackaged ? join(process.resourcesPath, 'room') : join(app.getAppPath(), 'build/room'))
const areasCache = (): string => join(app.getPath('userData'), 'room-areas.json')

const readJson = <T>(path: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

const manifest: DesktopManifest = readJson(join(roomRoot, 'desktop-areas.json'), { examples: [] })
let roomAreas: RoomArea[] | undefined
let launch: LaunchOptions = parseLaunch(process.argv, process.env)
let origin = ''
let mainWindow: BrowserWindow | null = null

// the room is WebGL-heavy: the GPU even where Chromium's blocklist would fall back to software
app.commandLine.appendSwitch('ignore-gpu-blocklist')

const startServer = async (): Promise<string> => {
  const room = createRoomHandler({ root: roomRoot, isolation: ISOLATION_MODE })
  const server = createServer((request, response) => {
    if ((request.url ?? '').split('?')[0] !== MENU_PATH) return room(request, response)
    response.writeHead(200, { ...isolationHeaders(ISOLATION_MODE), 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(renderMenuPage({ manifest, roomAreas, options: launch, isIsolated: true }))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const open = (target: Target): void => {
  void mainWindow?.loadURL(`${origin}${pathOf(target, launch)}`)
}

const setRoomAreas = (areas: RoomArea[]): void => {
  roomAreas = areas
  mkdirSync(dirname(areasCache()), { recursive: true })
  writeFileSync(areasCache(), JSON.stringify(areas))
  buildMenu()
  if (mainWindow?.webContents.getURL().includes(MENU_PATH)) mainWindow.webContents.reload()
}

type ModuleRow = { id: string; name: string; group?: string; hasArea: boolean }

/** Reads `room.modules()` once the page's room exists (the room may take a minute to load every module). */
const readModules = async (contents: Electron.WebContents): Promise<ModuleRow[] | undefined> => {
  for (let attempt = 0; attempt < 600 && !contents.isDestroyed(); attempt++) {
    const rows = (await contents.executeJavaScript(MODULES_SCRIPT).catch(() => null)) as ModuleRow[] | null
    if (rows) return rows
    await new Promise((done) => setTimeout(done, 1000))
  }
  return undefined
}

/** First start with no cached areas: the room is loaded once in a hidden window (no UI) to read its areas, then closed. */
const discoverAreas = async (): Promise<void> => {
  const hidden = new BrowserWindow({ show: false, width: 640, height: 360, webPreferences: { sandbox: true, contextIsolation: true } })
  await hidden.loadURL(`${origin}/${ROOM_PAGE}?ui=0`)
  const rows = await readModules(hidden.webContents)
  hidden.destroy()
  if (rows) setRoomAreas(roomAreasOf(rows))
}

const physicsItem = (label: string, next: Partial<LaunchOptions>, checked: boolean): MenuItemConstructorOptions => ({
  label,
  type: 'radio',
  checked,
  click: () => {
    launch = { ...launch, ...next }
    const current = mainWindow?.webContents.getURL() ?? ''
    if (current.includes(ROOM_PAGE)) open({ kind: 'room', area: new URL(current).searchParams.get('area') ?? undefined })
    else mainWindow?.webContents.reload()
  },
})

function buildMenu(): void {
  const examples = manifest.examples.filter((entry) => entry.page !== null && entry.folder !== 'test-room')
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Salas',
      submenu: [
        { label: 'Início (todas as salas)', accelerator: 'CmdOrCtrl+Home', click: () => open({ kind: 'menu' }) },
        { label: 'Sala de teste (inteira)', click: () => open({ kind: 'room', area: undefined }) },
        { type: 'separator' },
        ...(examples.length ? examples.map((entry): MenuItemConstructorOptions => ({ label: `Página: ${entry.id}`, click: () => open({ kind: 'example', entry }) })) : [{ label: 'Nenhuma página de área construída', enabled: false }]),
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Áreas da sala',
      submenu: roomAreas?.length
        ? roomAreas.map((area): MenuItemConstructorOptions => ({ label: area.name, sublabel: area.id, click: () => open({ kind: 'room', area: area.id }) }))
        : [{ label: 'Lendo as áreas da sala…', enabled: false }],
    },
    {
      label: 'Física',
      submenu: [
        physicsItem('Jolt multithread (contatos JS, 0 workers)', { solver: 'jolt', joltBuild: 'multithread', joltThreads: undefined, joltContacts: 'js' }, launch.solver === 'jolt' && launch.joltBuild === 'multithread' && launch.joltContacts === 'js'),
        physicsItem('Jolt single-thread (como no site)', { solver: 'jolt', joltBuild: 'single', joltThreads: undefined, joltContacts: 'js' }, launch.solver === 'jolt' && launch.joltBuild === 'single'),
        physicsItem('Jolt com todos os workers, sem contatos (só medição)', { solver: 'jolt', joltBuild: 'multithread', joltThreads: 'auto', joltContacts: 'off' }, launch.joltContacts === 'off'),
        physicsItem('Solver próprio do kit', { solver: 'own' }, launch.solver === 'own'),
      ],
    },
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Recarregar' }, { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' }, { role: 'togglefullscreen', label: 'Tela cheia' }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({ width: 1600, height: 900, title: 'AdA Game Kit', backgroundColor: '#11151b', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  // the app only ever shows its own server's pages; anything else opens in the system browser
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(origin)) void shell.openExternal(url)
    return { action: url.startsWith(origin) ? 'allow' : 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(origin)) return
    event.preventDefault()
    void shell.openExternal(url)
  })
  window.webContents.on('did-finish-load', () => {
    const url = window.webContents.getURL()
    if (!url.includes(ROOM_PAGE)) return
    void window.webContents.executeJavaScript(BADGE_SCRIPT).catch(() => undefined)
    void readModules(window.webContents).then((rows) => {
      if (rows && !roomAreas?.length) setRoomAreas(roomAreasOf(rows))
    })
  })
  return window
}

const start = async (): Promise<void> => {
  origin = await startServer()
  const cached = readJson<RoomArea[] | null>(areasCache(), null)
  roomAreas = cached && cached.length ? cached : undefined
  buildMenu()
  mainWindow = createWindow()
  open(resolveArea(launch.area, manifest))
  if (!roomAreas && existsSync(join(roomRoot, ROOM_PAGE)) && resolveArea(launch.area, manifest).kind !== 'room') void discoverAreas()
}

app.whenReady().then(start).catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
app.on('window-all-closed', () => app.quit())
