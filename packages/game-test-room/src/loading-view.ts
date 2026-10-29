/**
 * The look of the loading indicator, with no dependency: a card with a title, a bar and a line of text over a dim backdrop. The room draws it (`createLoading`), and a page that must show it before any
 * script has run (the default test room's first frame) writes the same markup and styles from `loadingMarkup` and `LOADING_CSS`, so the screen the page starts with and the one the room shows later are one.
 */
export const LOADING_CLASS = 'tr-loading'

export const LOADING_CSS = [
  '.tr-loading{position:absolute;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(16,19,26,.72);color:#e8eaee;font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;transition:opacity .25s;pointer-events:auto}',
  '.tr-loading.tr-loading-fixed{position:fixed}',
  '.tr-loading.tr-loading-solid{background:#10131a}',
  '.tr-loading.tr-loading-hidden{opacity:0;pointer-events:none}',
  '.tr-loading-card{width:min(440px,86vw);text-align:center}',
  '.tr-loading-title{font-size:18px;font-weight:600;margin-bottom:18px}',
  '.tr-loading-spin{display:inline-block;width:16px;height:16px;margin-right:10px;vertical-align:-2px;border:2px solid #3a3f4a;border-top-color:#ffd23f;border-radius:50%;animation:tr-loading-turn .8s linear infinite}',
  '.tr-loading-bar{position:relative;height:8px;border-radius:4px;background:#2a2e36;overflow:hidden}',
  '.tr-loading-bar i{display:block;height:100%;width:0;background:#ffd23f;transition:width .15s}',
  '.tr-loading-bar.tr-loading-indeterminate i{position:absolute;width:35%;animation:tr-loading-sweep 1.1s ease-in-out infinite}',
  '.tr-loading-step{margin-top:12px;color:#9aa3b2;min-height:1.4em}',
  '@keyframes tr-loading-turn{to{transform:rotate(360deg)}}',
  '@keyframes tr-loading-sweep{0%{left:-35%}100%{left:100%}}',
  '@media (prefers-reduced-motion:reduce){.tr-loading-spin,.tr-loading-bar.tr-loading-indeterminate i{animation-duration:3s}}',
].join('')

const escape = (text: string): string => text.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))

/** The markup of the indicator as a string, for a page that writes it into its HTML. `solid` is the opaque backdrop of a first screen, `fixed` covers the window instead of the room. */
export function loadingMarkup(options: { title: string; step?: string; solid?: boolean; fixed?: boolean; id?: string }): string {
  const classes = [LOADING_CLASS, options.solid ? 'tr-loading-solid' : '', options.fixed ? 'tr-loading-fixed' : ''].filter(Boolean).join(' ')
  const id = options.id ? ` id="${escape(options.id)}"` : ''
  return `<div${id} class="${classes}" role="status" aria-live="polite"><div class="tr-loading-card"><div class="tr-loading-title"><span class="tr-loading-spin"></span><span class="tr-loading-label">${escape(options.title)}</span></div><div class="tr-loading-bar tr-loading-indeterminate"><i></i></div><div class="tr-loading-step">${escape(options.step ?? '')}</div></div></div>`
}
