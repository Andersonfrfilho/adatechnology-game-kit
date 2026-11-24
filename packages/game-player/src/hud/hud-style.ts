// The same tokens as the test room's HUD (panel rgba(10,12,16,.72), accent #ffd23f, bars #2a2e36 / #66bb6a / #ffb300 / #ef5350 / #4fc3f7), so a game and its room read alike.
export const PLAYER_HUD_CSS = `
.gp-hud{position:absolute;inset:0;pointer-events:none;font:12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8eaee;overflow:hidden;z-index:10}
.gp-hud *{box-sizing:border-box}
.gp-hud-pill{background:rgba(10,12,16,.72);padding:4px 12px;border-radius:6px;font-size:14px;font-weight:600}
.gp-hud-pill small{font-weight:400;opacity:.8;margin-left:8px}
.gp-hud-title{position:absolute;top:8px;left:8px;display:none}
.gp-hud-message{position:absolute;top:8px;left:50%;transform:translateX(-50%);max-width:60vw;text-align:center;color:#ffd23f;text-shadow:0 1px 2px #000;font-size:14px;font-weight:600;display:none}
.gp-hud-vitals{position:absolute;left:8px;bottom:8px;width:210px;background:rgba(10,12,16,.72);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.gp-hud-row{display:grid;grid-template-columns:62px 1fr 30px;align-items:center;gap:6px}
.gp-hud-row span:first-child{color:#9aa3b2}
.gp-hud-row output{text-align:right;font-variant-numeric:tabular-nums}
.gp-hud-bar{height:7px;background:#2a2e36;border-radius:4px;overflow:hidden}
.gp-hud-bar i{display:block;height:100%;width:0;background:#4fc3f7}
.gp-hud-bar.hp i{background:#66bb6a}.gp-hud-bar.warn i{background:#ffb300}.gp-hud-bar.bad i{background:#ef5350}
.gp-hud-status{display:flex;flex-wrap:wrap;gap:4px}
.gp-hud-status:empty{display:none}
.gp-hud-tag{border-radius:4px;padding:0 6px;background:#2a2e36}
.gp-hud-tag.bad{background:rgba(183,28,28,.9);color:#fff}.gp-hud-tag.warn{background:rgba(120,90,10,.9);color:#fff}
.gp-hud-weapon{position:absolute;right:8px;bottom:8px;display:none}
.gp-hud-cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;display:none}
.gp-hud-cross:before,.gp-hud-cross:after{content:"";position:absolute;background:#fff;opacity:.85;box-shadow:0 0 2px #000}
.gp-hud-cross:before{left:8px;top:0;width:2px;height:18px}.gp-hud-cross:after{top:8px;left:0;height:2px;width:18px}
.gp-hud-cross i{position:absolute;left:6px;top:6px;width:6px;height:6px;background:#0b0c0e;border-radius:50%;z-index:1}
.gp-death{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8eaee;z-index:20}
.gp-death.open{display:flex}
.gp-death-panel{min-width:min(320px,90vw);max-width:90vw;background:rgba(12,14,19,.92);border:1px solid #2c313b;border-radius:8px;padding:18px 22px;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.5)}
.gp-death-panel h2{margin:0 0 6px;font-size:22px;color:#ef5350}
.gp-death-panel p{margin:2px 0;color:#9aa3b2}
.gp-death-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px}
.gp-death-actions button{background:#232831;border:1px solid #3a404c;color:#e8eaee;border-radius:5px;padding:6px 14px;cursor:pointer;font:inherit}
.gp-death-actions button:hover,.gp-death-actions button:focus-visible{background:#2d3440;border-color:#ffd23f}
.gp-death-actions button:disabled{opacity:.5;cursor:default}
.gp-death-actions kbd{background:#2a2e36;border:1px solid #4a505c;border-radius:3px;padding:0 4px;font:inherit;font-weight:700;margin-left:6px}
`

const STYLE_ID = 'gp-hud-style'

/** Puts the HUD's style in the document once (the HUD and the death screen share it). */
export function ensurePlayerHudStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = PLAYER_HUD_CSS
  document.head.appendChild(style)
}

/** Makes `container` the positioning box of an overlay laid over it. */
export function positionContainer(container: HTMLElement): void {
  const position = getComputedStyle(container).position
  if (!position || position === 'static') container.style.position = 'relative'
}
