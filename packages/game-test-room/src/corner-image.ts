import type { CornerImage } from '@adatechnology/game-contracts'

export interface CornerImageOptions {
  /** The room's container: the thumbnail sits in its bottom-left corner and the large view covers it. */
  readonly container: HTMLElement
  readonly labels: { readonly open: string; readonly close: string; readonly source: string }
}

/** A small picture in a corner of the room that opens large over the scene on a click and closes on a click outside or Esc. */
export interface RoomCornerImage {
  show(image: CornerImage | null): void
  /** True while the large view is open. */
  readonly isOpen: boolean
  dispose(): void
}

const STYLE_ID = 'tr-corner-style'
const CSS = [
  // bottom-left corner of the free view: right of the left panel (its width), above the hotbar and the help line, far from the crosshair and the right panel
  '.tr-corner{position:absolute;left:calc(min(400px,36vw) + 16px);bottom:84px;width:72px;height:72px;padding:0;border:1px solid #3a404c;border-radius:6px;background:rgba(10,12,16,.6);opacity:.55;cursor:zoom-in;pointer-events:auto;overflow:hidden;transition:opacity .15s;z-index:4}',
  '.tr-corner:hover,.tr-corner:focus-visible{opacity:1;border-color:#ffd23f;outline:none}',
  '.tr-corner img{display:block;width:100%;height:100%;object-fit:cover}',
  '.tr-lightbox{position:absolute;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;background:rgba(8,10,14,.82);pointer-events:auto;cursor:zoom-out}',
  '.tr-lightbox figure{margin:0;max-width:min(900px,90vw);padding:8px;background:rgba(18,20,24,.96);border:1px solid #2a2e36;border-radius:8px;cursor:default;color:#e8eaee;font:12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
  '.tr-lightbox img{display:block;max-width:100%;max-height:78vh;margin:0 auto;object-fit:contain;background:#f4f4f2;border-radius:4px}',
  '.tr-lightbox figcaption{margin-top:6px;display:flex;gap:10px;align-items:center;justify-content:space-between}',
  '.tr-lightbox a{color:#8ab4f8}.tr-lightbox button{pointer-events:auto;background:#2a2e36;border:1px solid #4a505c;color:inherit;border-radius:4px;padding:2px 10px;cursor:pointer;font:inherit}',
].join('')

export function createCornerImage(options: CornerImageOptions): RoomCornerImage {
  const { container, labels } = options
  const doc = container.ownerDocument
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    doc.head.appendChild(style)
  }
  let thumbnail: HTMLButtonElement | null = null
  let lightbox: HTMLElement | null = null
  let current: CornerImage | null = null

  const closeLightbox = (): void => {
    lightbox?.remove()
    lightbox = null
    doc.removeEventListener('keydown', onKey, true)
    thumbnail?.focus()
  }
  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    closeLightbox()
  }
  const openLightbox = (): void => {
    if (!current || lightbox) return
    const overlay = doc.createElement('div')
    overlay.className = 'tr-lightbox'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', current.alt)
    const figure = doc.createElement('figure')
    const picture = doc.createElement('img')
    picture.src = current.url
    picture.alt = current.alt
    picture.referrerPolicy = 'no-referrer'
    const caption = doc.createElement('figcaption')
    const credit = doc.createElement('span')
    credit.textContent = current.credit ?? ''
    caption.appendChild(credit)
    if (current.page) {
      const link = doc.createElement('a')
      link.href = current.page
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = `${labels.source} ↗`
      caption.appendChild(link)
    }
    const close = doc.createElement('button')
    close.type = 'button'
    close.textContent = labels.close
    close.addEventListener('click', closeLightbox)
    caption.appendChild(close)
    figure.append(picture, caption)
    overlay.appendChild(figure)
    // a click on the backdrop closes it; a click inside the card does not
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeLightbox()
    })
    container.appendChild(overlay)
    lightbox = overlay
    doc.addEventListener('keydown', onKey, true)
    close.focus()
  }

  const takeDown = (): void => {
    if (lightbox) closeLightbox()
    thumbnail?.remove()
    thumbnail = null
    current = null
  }

  return {
    show(image) {
      if (!image) return takeDown()
      if (lightbox) closeLightbox()
      current = image
      if (!thumbnail) {
        thumbnail = doc.createElement('button')
        thumbnail.type = 'button'
        thumbnail.className = 'tr-corner'
        thumbnail.addEventListener('click', openLightbox)
        const pos = container.ownerDocument.defaultView?.getComputedStyle(container).position
        if (!pos || pos === 'static') container.style.position = 'relative'
        container.appendChild(thumbnail)
      }
      thumbnail.title = image.credit ? `${image.alt} — ${image.credit}` : image.alt
      thumbnail.setAttribute('aria-label', `${labels.open}: ${image.alt}`)
      thumbnail.replaceChildren()
      const picture = doc.createElement('img')
      picture.src = image.url
      picture.alt = image.alt
      picture.referrerPolicy = 'no-referrer'
      thumbnail.appendChild(picture)
    },
    get isOpen() {
      return lightbox !== null
    },
    dispose: takeDown,
  }
}
