// Bundle entry (IIFE global `StoriesArea`): the stories bench module of @adatechnology/game-stories, ready for any room page:
// `StoriesArea.loadInto(room)` loads it with `room.loadModule` and opens its area. The module is written against the generic contracts only and has no 3D:
// the seed and the day slider run a world of stories; the chronicle and one person's character sheet go to the room's sheet panel.
// It runs the kit's two example stories. A game's content (a JSON with people, stories, life and actions, such as the zombiada slice put together) loads
// through `StoriesArea.loadContent(json)` or the file button this page adds.
import { defaultStoryContent } from '@adatechnology/game-kit-defaults'
import { createStoryWorld } from '@adatechnology/game-stories'
import { STORIES_EXAMPLE, createStoriesTestModule } from '@adatechnology/game-stories/testing'

export { STORIES_EXAMPLE, createStoriesTestModule, createStoryWorld, defaultStoryContent }

let current = null

/** The module for the room's locale (`?lang=en` or pt-BR); other pages (the furniture area) load it next to their own. */
export function createModule(options = {}) {
  const locale = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  current = createStoriesTestModule({ ...defaultStoryContent(locale), ...options, locale })
  return current
}

/** Swaps the stories the module runs: `{ people?, stories, life?, actions?, playerBase?, days? }`. */
export function loadContent(content) {
  if (!current) throw new Error('StoriesArea: load the module first')
  current.load(typeof content === 'string' ? JSON.parse(content) : content)
}

/** A small file button on the page: a game's content JSON goes to `loadContent`. */
function addFileButton() {
  if (typeof document === 'undefined' || document.getElementById('stories-content-file')) return
  const label = document.createElement('label')
  label.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:30;font:12px system-ui;background:#1d2128;color:#e8e6e1;padding:6px 10px;border-radius:6px;cursor:pointer'
  label.textContent = current?.name ?? 'Stories'
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.id = 'stories-content-file'
  input.style.display = 'none'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (file) loadContent(await file.text())
  })
  label.append(' ⤒ JSON', input)
  document.body.append(label)
}

/** Creates the module, loads it and opens the stories area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const report = room.loadModule(createModule(options))
  room.openArea('stories_area')
  addFileButton()
  return report
}
