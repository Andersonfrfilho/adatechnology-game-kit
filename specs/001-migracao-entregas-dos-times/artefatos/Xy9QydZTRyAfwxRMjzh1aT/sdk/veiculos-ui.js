/* VehicleSDK · widgets de interface do mapa de danos (opcional, depende de veiculos-sdk.js).
   Nada de texto de jogo: os rótulos vêm de VehicleSDK.config.texts.ui (padrões em português) e das faixas de VehicleSDK.BANDS. */
(function () {
  "use strict";
  var SDK = window.VehicleSDK;
  if (!SDK) throw new Error("veiculos-ui.js: carregue veiculos-sdk.js antes");
  var SVGNS = "http://www.w3.org/2000/svg", BAND_TXT = ["#10140f", "#1c1606", "#1f1206", "#fff3ef", "#f1f2f2"];
  var UI_TXT = { front: "▲ FRENTE", inside: "Por dentro", aria: "Mapa de danos visto de cima, frente para cima", noZones: "Este veículo não tem zonas.", health: "Saúde geral" };
  function T(k) { var u = SDK.config.texts.ui || {}; return u[k] != null ? u[k] : UI_TXT[k]; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function sv(tag, at, parent) { var e = document.createElementNS(SVGNS, tag); Object.keys(at || {}).forEach(function (k) { e.setAttribute(k, at[k]); }); if (parent) parent.appendChild(e); return e; }
  function zoneLabel(z) { var B = SDK.BANDS[SDK.bandOf(z.h)]; return z.n + " · " + B.n + " " + z.h + "%"; }
  function bandRange(i) { var B = SDK.BANDS; if (i === B.length - 1) return ""; return B[i].min + "–" + (i === 0 ? 100 : B[i - 1].min - 1); }

  /* Mapa de danos visto de cima (SVG). host: elemento; c: contexto de SDK.build; o: { selected (id), onSelect(id) }.
     Zonas externas no desenho do veículo, zonas internas numa faixa de blocos embaixo. */
  function damageMap(host, c, o) {
    o = o || {}; var sel = o.selected; host.innerHTML = "";
    var Z = c.zones, ext = Z.filter(function (z) { return !z.internal; }), inn = Z.filter(function (z) { return z.internal; });
    if (!ext.length) { host.appendChild(el("p", "muted", T("noZones"))); return null; }
    var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    ext.forEach(function (z) { x0 = Math.min(x0, z.map[0]); x1 = Math.max(x1, z.map[1]); z0 = Math.min(z0, z.map[2]); z1 = Math.max(z1, z.map[3]); });
    var sx = x1 - x0 || 1, sz = z1 - z0 || 1, s = Math.min(230 / sz, 290 / sx), kz = 1, kx = 1, w = sz * s, h = sx * s;
    if (w < 0.45 * h) kz = 0.45 * h / w; if (h < 0.75 * w) kx = 0.75 * w / h;
    var pad = 10, top = 22, W = Math.max(w * kz + 2 * pad, 240), offX = (W - w * kz) / 2, H = h * kx;
    var cols = 2, tw = (W - 2 * pad - (cols - 1) * 6) / cols, rows = Math.ceil(inn.length / cols), stripY = top + H + 18, VH = stripY + (inn.length ? 14 + rows * 32 : 0) + 4;
    var svg = sv("svg", { viewBox: "0 0 " + W.toFixed(1) + " " + VH.toFixed(1), role: "group", "aria-label": T("aria"), class: "dmap" }, host);
    function X(zv) { return offX + (zv - z0) * s * kz; } function Y(xv) { return top + (x1 - xv) * s * kx; }
    var m = c.meta, F = m.front, R = m.rear, hw = (m.W || 1.7) / 2;
    sv("rect", { x: X(-hw).toFixed(1), y: Y(F).toFixed(1), width: (X(hw) - X(-hw)).toFixed(1), height: (Y(R) - Y(F)).toFixed(1), rx: 10, class: "dm-body" }, svg);
    var tf = sv("text", { x: (W / 2).toFixed(1), y: 13, class: "dm-front", "text-anchor": "middle" }, svg); tf.textContent = T("front");
    function node(z, x, y, wd, ht, parent) {
      var b = SDK.bandOf(z.h), g = sv("g", { class: "zn" + (z.id === sel ? " sel" : "") + (b === 4 ? " gone" : ""), tabindex: "0", role: "button", "data-id": z.id, "aria-label": zoneLabel(z), "aria-pressed": z.id === sel ? "true" : "false" }, parent);
      sv("title", {}, g).textContent = zoneLabel(z);
      sv("rect", { x: x.toFixed(1), y: y.toFixed(1), width: Math.max(3, wd).toFixed(1), height: Math.max(3, ht).toFixed(1), rx: 3, fill: b === 4 ? "transparent" : SDK.BANDS[b].col }, g);
      return g;
    }
    ext.slice().sort(function (a, b) { return (b.map[1] - b.map[0]) * (b.map[3] - b.map[2]) - (a.map[1] - a.map[0]) * (a.map[3] - a.map[2]); }).forEach(function (z) {
      node(z, X(z.map[2]), Y(z.map[1]), X(z.map[3]) - X(z.map[2]), Y(z.map[0]) - Y(z.map[1]), svg);
    });
    if (inn.length) {
      var tl = sv("text", { x: pad, y: stripY, class: "dm-sub" }, svg); tl.textContent = T("inside");
      inn.forEach(function (z, i) {
        var col = i % cols, row = Math.floor(i / cols), x = pad + col * (tw + 6), y = stripY + 8 + row * 32, b = SDK.bandOf(z.h);
        var g = node(z, x, y, tw, 26, svg), t = sv("text", { x: (x + tw / 2).toFixed(1), y: (y + 17).toFixed(1), "text-anchor": "middle", class: "dm-tile", fill: b === 4 ? "#c9cdd0" : BAND_TXT[b] }, g);
        var mc = Math.floor(tw / 6.1); t.textContent = z.n.length > mc ? z.n.slice(0, mc - 1) + "…" : z.n;
      });
    }
    svg.querySelectorAll(".zn").forEach(function (g) {
      function pick() { if (o.onSelect) o.onSelect(g.getAttribute("data-id")); }
      g.addEventListener("click", pick);
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    return svg;
  }
  /* Botões de faixa (um por faixa); onPick(saudeAlvo, indiceDaFaixa). Devolve os botões. */
  function bandButtons(host, onPick) {
    host.innerHTML = "";
    return SDK.BANDS.map(function (B, i) {
      var b = el("button", null, B.n); b.type = "button"; b.dataset.b = i; b.style.setProperty("--band", B.col);
      b.addEventListener("click", function () { if (onPick) onPick(B.h, i); }); host.appendChild(b); return b;
    });
  }
  /* Legenda das faixas com os intervalos de saúde. */
  function legend(host) {
    host.innerHTML = "";
    SDK.BANDS.forEach(function (B, i, A) {
      var gone = i === A.length - 1, sp = el("span", gone ? "gone" : null), sw = el("i");
      sw.style.background = gone ? "transparent" : B.col; sp.appendChild(sw);
      sp.appendChild(document.createTextNode(B.n + (gone ? "" : " " + bandRange(i)))); host.appendChild(sp);
    });
  }
  /* Barra de saúde geral. els: { text, bar } (elementos). */
  function healthBar(els, c) {
    var O = SDK.zoneOverall(c);
    if (els.text) els.text.textContent = T("health") + " " + O.h + "% · " + O.n;
    if (els.bar) { els.bar.style.width = O.h + "%"; els.bar.style.background = SDK.BANDS[O.b].col; }
    return O;
  }
  /* Botões de cenário (um por SDK.SCENARIOS); onRun(id). */
  function scenarioButtons(host, onRun) {
    host.innerHTML = "";
    return SDK.SCENARIOS.map(function (S) {
      var b = el("button", null, S.n); b.type = "button"; b.dataset.sc = S.id; b.addEventListener("click", function () { onRun(S.id); }); host.appendChild(b); return b;
    });
  }
  /* CSS mínimo para quem não tem folha de estilo própria (as variáveis têm valores padrão). */
  function css() {
    return "svg.dmap{width:100%;max-width:300px;height:auto;max-height:460px;display:block}svg.dmap .dm-body{fill:var(--panel-2,#1c2127);stroke:var(--line,#39414a)}" +
      "svg.dmap .dm-front,svg.dmap .dm-sub{font:9.5px monospace;fill:var(--muted,#9aa3ab);letter-spacing:.08em}svg.dmap .dm-tile{font:600 10.5px sans-serif;pointer-events:none}" +
      "svg.dmap .zn{cursor:pointer;outline:none}svg.dmap .zn rect{stroke:#0b0e11;stroke-width:1;fill-opacity:.9}svg.dmap .zn.gone rect{stroke:#8a9095;stroke-dasharray:3 2;fill:rgba(110,115,119,.18)}" +
      "svg.dmap .zn:hover rect{stroke:#fff;stroke-width:1.6}svg.dmap .zn.sel rect{stroke:#e0a548;stroke-width:2.6}";
  }
  function injectStyles() { if (document.getElementById("vsdk-ui-css")) return; var s = el("style"); s.id = "vsdk-ui-css"; s.textContent = css(); document.head.appendChild(s); }
  SDK.ui = { damageMap: damageMap, bandButtons: bandButtons, legend: legend, healthBar: healthBar, scenarioButtons: scenarioButtons, zoneLabel: zoneLabel, bandRange: bandRange, css: css, injectStyles: injectStyles };
})();
