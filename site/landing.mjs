// Landing page of the demo site: examples with their areas, then packages grouped by family, all with thumbnails.
import { EXAMPLES, FAMILIES, thumbFile } from './catalog.mjs'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const shortName = (name) => name.replace('@adatechnology/', '')
// accents are dropped on both sides, so "gas" finds "gás"
const fold = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const searchText = (...parts) => esc(fold(parts.flat().join(' ')))

function thumb(key, alt, hasThumb) {
  if (!key || !hasThumb(key)) return `<div class="thumb thumb-empty" aria-hidden="true"><span>sem prévia 3D</span></div>`
  return `<img class="thumb" src="${thumbFile(key)}" alt="${esc(alt)}" loading="lazy">`
}

function renderExample(example, hasThumb) {
  const meta = EXAMPLES.find((entry) => entry.name === example.name)
  const title = meta?.title ?? example.name
  const summary = meta?.summary ?? example.description
  const areas = meta?.areas ?? []
  const areaCards = areas
    .map((area) => `<li class="area" data-search="${searchText(area.title, area.what)}"><a href="${esc(example.name)}/?area=${esc(area.id)}" title="Abrir o ambiente de teste de ${esc(area.title)}">
          ${thumb(`${example.name}-${area.id}`, `${title}: ${area.title}`, hasThumb)}
          <strong>${esc(area.title)} <em>testar →</em></strong><span>${esc(area.what)}</span>
        </a></li>`)
    .join('')
  return `<article class="example" data-kind="exemplo" data-search="${searchText(title, example.name, summary, areas.map((a) => [a.title, a.what]))}">
      <a class="example-hero" href="${esc(example.name)}/">
        ${thumb(example.name, title, hasThumb)}
        <span class="open">Abrir no navegador →</span>
      </a>
      <div class="example-body">
        <h3><a href="${esc(example.name)}/">${esc(title)}</a> <code>${esc(example.name)}</code></h3>
        <p>${esc(summary)}</p>
        ${meta?.controls ? `<p class="controls">${esc(meta.controls)}</p>` : ''}
        ${areas.length ? `<p class="k">Ambientes de teste · ${areas.length} áreas · clique para abrir já montado</p><ul class="areas">${areaCards}</ul>` : ''}
      </div>
    </article>`
}

function renderPackage(pkg) {
  const install = `pnpm add ${pkg.name}`
  return `<li class="pkg" data-search="${searchText(pkg.name, pkg.description)}">
        <div class="pkg-head"><code>${esc(shortName(pkg.name))}</code><span class="v">${esc(pkg.version)}</span>${pkg.name.endsWith('-three') ? '<span class="tag">three.js</span>' : ''}</div>
        <p>${esc(pkg.description)}</p>
        <button type="button" class="copy" data-copy="${esc(install)}"><code>${esc(install)}</code><span>copiar</span></button>
      </li>`
}

function groupPackages(packages) {
  const byName = new Map(packages.map((pkg) => [shortName(pkg.name), pkg]))
  const used = new Set()
  const families = FAMILIES.map((family) => {
    const members = family.packages.map((name) => byName.get(name)).filter(Boolean)
    members.forEach((pkg) => used.add(shortName(pkg.name)))
    return { ...family, members }
  }).filter((family) => family.members.length)
  const rest = packages.filter((pkg) => !used.has(shortName(pkg.name)))
  if (rest.length) families.push({ id: 'outros', title: 'Outros', what: 'Pacotes ainda sem família no catálogo do site', members: rest, thumb: null, seeIn: null })
  return families
}

function renderFamily(family, examplesByName, hasThumb) {
  const seeIn = family.seeIn && examplesByName.get(family.seeIn)
  return `<article class="family" data-kind="pacote" data-family="${esc(family.id)}" data-search="${searchText(family.title, family.what, family.members.map((p) => [p.name, p.description]))}">
      ${thumb(family.thumb, family.title, hasThumb)}
      <div class="family-body">
        <h3>${esc(family.title)} <span class="count">${family.members.length} ${family.members.length === 1 ? 'pacote' : 'pacotes'}</span></h3>
        <p>${esc(family.what)}</p>
        ${seeIn ? `<p class="see">Ver funcionando: <a href="${esc(family.seeIn)}/">${esc(seeIn)}</a></p>` : ''}
        <ul class="pkgs">${family.members.map(renderPackage).join('')}</ul>
      </div>
    </article>`
}

export function renderLanding({ examples, packages, hasThumb }) {
  const families = groupPackages(packages)
  const examplesByName = new Map(EXAMPLES.map((entry) => [entry.name, entry.title]))
  const areaCount = examples.reduce((sum, example) => sum + (EXAMPLES.find((entry) => entry.name === example.name)?.areas.length ?? 0), 0)
  const chips = [['tudo', 'Tudo'], ['exemplo', 'Exemplos'], ...families.map((family) => [`f:${family.id}`, family.title])]
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AdA Technology Game Kit</title>
<style>
  :root { color-scheme: light; --bg: #f3f2ee; --card: #fbfaf7; --fg: #1d1f1c; --muted: #61655c; --line: #dcdad2; --chip: #e8e6de; --accent: #2f6d5a; --accent-ink: #f3f8f5; --code: #ecebe4; }
  @media (prefers-color-scheme: dark) { :root { color-scheme: dark; --bg: #131513; --card: #1b1e1b; --fg: #e6e7e1; --muted: #9da297; --line: #2e322d; --chip: #252925; --accent: #72c2a4; --accent-ink: #0f1a15; --code: #232723; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  a { color: var(--accent); }
  code { font: 0.88em ui-monospace, SFMono-Regular, Menlo, monospace; }
  .wrap { max-width: 1180px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left)); padding-right: max(16px, env(safe-area-inset-right)); }
  header { padding-block: 40px 20px; display: grid; gap: 10px; }
  h1 { margin: 0; font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.01em; text-wrap: balance; }
  .lead { margin: 0; max-width: 70ch; color: var(--muted); font-size: 16px; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 4px 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 14px; }
  .stats b { color: var(--fg); font-variant-numeric: tabular-nums; }
  .bar { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); padding-block: 10px; }
  .bar .wrap { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  #q { flex: 1 1 240px; max-width: 340px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--fg); font: inherit; }
  .chip { border: 1px solid var(--line); background: var(--card); color: var(--fg); border-radius: 99px; padding: 5px 12px; font: inherit; font-size: 13px; cursor: pointer; }
  .chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  section { padding-block: 28px 8px; }
  h2 { margin: 0 0 14px; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .example { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 22px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 16px; }
  .example-hero { position: relative; display: block; border-radius: 10px; overflow: hidden; align-self: start; }
  .example-hero .thumb { aspect-ratio: 16 / 10; }
  .open { position: absolute; left: 10px; bottom: 10px; background: var(--accent); color: var(--accent-ink); padding: 5px 11px; border-radius: 7px; font-weight: 600; font-size: 13px; }
  .example h3 { margin: 0 0 6px; font-size: 21px; }
  .example h3 a { color: inherit; text-decoration: none; }
  .example h3 code { color: var(--muted); font-size: 13px; font-weight: 400; margin-left: 6px; }
  .example p { margin: 0 0 8px; color: var(--muted); }
  .controls { font: 12.5px ui-monospace, Menlo, monospace; background: var(--code); border-radius: 6px; padding: 5px 9px; display: inline-block; }
  .k { margin: 12px 0 8px !important; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
  .areas { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .area a { display: grid; gap: 3px; align-content: start; font-size: 13px; color: inherit; text-decoration: none; border-radius: 9px; }
  .area a:hover .thumb, .area a:focus-visible .thumb { outline: 2px solid var(--accent); outline-offset: 2px; }
  .area em { font-style: normal; font-weight: 600; font-size: 12px; color: var(--accent); margin-left: 4px; }
  .area .thumb { aspect-ratio: 4 / 3; border-radius: 8px; }
  .area span { color: var(--muted); font-size: 12.5px; line-height: 1.35; }
  .thumb { display: block; width: 100%; object-fit: cover; background: var(--chip); }
  .thumb-empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; aspect-ratio: 16 / 10; }
  .families { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .family { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
  .family > .thumb { aspect-ratio: 16 / 7; }
  .family-body { padding: 14px 16px 16px; display: grid; gap: 6px; }
  .family h3 { margin: 0; font-size: 18px; display: flex; align-items: baseline; gap: 8px; }
  .count { font-size: 12.5px; font-weight: 400; color: var(--muted); }
  .family-body > p { margin: 0; color: var(--muted); font-size: 14px; }
  .see { font-size: 13px !important; }
  .pkgs { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 8px; }
  .pkg { border-top: 1px solid var(--line); padding-top: 8px; display: grid; gap: 4px; }
  .pkg-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .pkg-head code { font-size: 14px; font-weight: 600; }
  .v { color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
  .tag { font-size: 11px; background: var(--chip); border-radius: 4px; padding: 1px 6px; color: var(--muted); }
  .pkg p { margin: 0; color: var(--muted); font-size: 13px; }
  .copy { justify-self: start; display: inline-flex; gap: 10px; align-items: center; border: 1px solid var(--line); background: var(--code); color: var(--fg); border-radius: 6px; padding: 3px 8px; cursor: pointer; font: inherit; max-width: 100%; }
  .copy code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .copy span { font-size: 12px; color: var(--accent); }
  .hide { display: none !important; }
  .empty { color: var(--muted); padding: 20px 0; }
  footer { color: var(--muted); font-size: 13px; padding-block: 32px 48px; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (max-width: 760px) { .example { grid-template-columns: 1fr; } .families { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header class="wrap">
  <h1>AdA Technology Game Kit</h1>
  <p class="lead">Blocos de jogo independentes de engine, publicados como <code>@adatechnology/</code>. Abra os exemplos no navegador e veja cada pacote funcionando antes de instalar.</p>
  <ul class="stats"><li><b>${examples.length}</b> exemplos jogáveis</li><li><b>${areaCount}</b> áreas</li><li><b>${packages.length}</b> pacotes</li><li><b>${families.length}</b> famílias</li><li><a href="https://github.com/Andersonfrfilho/adatechnology-game-kit">Código no GitHub</a></li></ul>
</header>
<div class="bar"><div class="wrap">
  <input id="q" type="search" placeholder="Buscar: sofá, vidro, gás, veículo…" aria-label="Buscar exemplos, áreas e pacotes">
  ${chips.map(([value, label], index) => `<button type="button" class="chip" data-filter="${esc(value)}" aria-pressed="${index === 0}">${esc(label)}</button>`).join('')}
</div></div>
<main class="wrap">
  <section id="exemplos" aria-label="Exemplos">
    <h2>Exemplos para abrir no navegador</h2>
    ${examples.map((example) => renderExample(example, hasThumb)).join('\n')}
  </section>
  <section id="pacotes" aria-label="Pacotes">
    <h2>Pacotes por família</h2>
    <div class="families">${families.map((family) => renderFamily(family, examplesByName, hasThumb)).join('\n')}</div>
  </section>
  <p class="empty hide" id="empty">Nada encontrado com esse filtro.</p>
</main>
<footer class="wrap">Licença MIT · Miniaturas capturadas dos próprios exemplos (<code>node site/capture-thumbs.mjs</code>) · <a href="weapon-svg/credits.html">Miniaturas das armas: créditos e licenças</a>.</footer>
<script>
  const q = document.getElementById('q')
  const chips = [...document.querySelectorAll('.chip')]
  let filter = 'tudo'
  function apply() {
    const term = q.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    let shown = 0
    document.querySelectorAll('.example, .family').forEach((card) => {
      const byFilter = filter === 'tudo' || (filter === 'exemplo' && card.dataset.kind === 'exemplo') || filter === 'f:' + card.dataset.family
      const byTerm = !term || card.dataset.search.includes(term)
      card.classList.toggle('hide', !(byFilter && byTerm))
      if (byFilter && byTerm) shown++
      // a search that names the card itself keeps all of its areas and packages visible
      const titleHit = Boolean(term) && card.querySelector('h3').textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term)
      card.querySelectorAll('.area, .pkg').forEach((item) => item.classList.toggle('hide', Boolean(term) && !titleHit && !item.dataset.search.includes(term)))
    })
    document.getElementById('exemplos').classList.toggle('hide', !document.querySelector('.example:not(.hide)'))
    document.getElementById('pacotes').classList.toggle('hide', !document.querySelector('.family:not(.hide)'))
    document.getElementById('empty').classList.toggle('hide', shown > 0)
  }
  chips.forEach((chip) => chip.addEventListener('click', () => { filter = chip.dataset.filter; chips.forEach((c) => c.setAttribute('aria-pressed', c === chip)); apply() }))
  q.addEventListener('input', apply)
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.copy')
    if (!button) return
    const label = button.querySelector('span')
    try { await navigator.clipboard.writeText(button.dataset.copy); label.textContent = 'copiado' } catch { label.textContent = 'selecione e copie' }
    setTimeout(() => { label.textContent = 'copiar' }, 1600)
  })
</script>
</body>
</html>
`
}
