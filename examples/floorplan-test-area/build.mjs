// Bundles the houses area (@adatechnology/game-floorplan-three with the content packs: residential, commercial, rural, post-apocalyptic and the structure) into dist/floorplan-area.js (IIFE, global `FloorplanArea`)
// and, when the shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-casas.html: the room page with the area loaded and opened, one file, no network.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const pkg = (/** @type {string} */ name) => join(root, 'packages', name)

function findEsbuild() {
  const store = join(root, 'node_modules/.pnpm')
  const dirs = readdirSync(store).filter((d) => d.startsWith('esbuild@')).sort().reverse()
  for (const d of dirs) {
    const p = join(store, d, 'node_modules/esbuild')
    if (existsSync(join(p, 'lib/main.js'))) return p
  }
  throw new Error('esbuild not found in node_modules/.pnpm (run pnpm install)')
}
const esbuild = createRequire(import.meta.url)(findEsbuild())

const packages = [
  'game-contracts',
  'game-destruction',
  'game-floorplan',
  'game-floorplan-commercial',
  'game-floorplan-interactables',
  'game-floorplan-post-apocalyptic',
  'game-floorplan-residential',
  'game-floorplan-rural',
  'game-floorplan-structure',
  'game-floorplan-three',
  'game-interactables',
  'game-interactables-household',
  'game-interactables-three',
  'game-items',
  'game-items-goods',
  'game-items-three',
  'game-props3d',
  'game-vegetation',
  'game-vegetation-species',
  'game-weapons',
  'game-weapons-three',
]
for (const p of packages) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'FloorplanArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    ...Object.fromEntries(packages.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    '@adatechnology/game-vegetation/three': join(pkg('game-vegetation'), 'dist/three.js'),
    '@adatechnology/game-weapons-three/testing': join(pkg('game-weapons-three'), 'dist/testing.js'),
    '@adatechnology/game-floorplan-three/testing': join(pkg('game-floorplan-three'), 'dist/testing.js'),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/floorplan-area.js'), bundle)
console.log(`dist/floorplan-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/base/test-room.html')
if (existsSync(roomHtml)) {
  const safe = (/** @type {string} */ s) => s.replace(/<\/(script)/gi, '<\\/$1')
  let page = readFileSync(roomHtml, 'utf8')

  const overlay = `<div id="boot" class="tr-loading tr-loading-solid tr-loading-fixed" role="status" aria-live="polite">
  <div class="tr-loading-card">
    <div class="tr-loading-title" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 18px;">
      <span class="tr-loading-spin"></span>
      <span class="tr-loading-label">Carregando a sala de casas…</span>
    </div>
    <div class="tr-loading-bar" style="height: 10px; border-radius: 5px; background: #232730; box-shadow: inset 0 1px 2px rgba(0,0,0,0.4); overflow: hidden; position: relative;">
      <i style="width: 0%; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #ffb300, #ffd23f); box-shadow: 0 0 10px rgba(255,210,63,0.35); transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: block;"></i>
    </div>
    <div class="tr-loading-info" style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 14px; line-height: 1.4;">
      <span class="tr-loading-step" style="color: #a0a8b8; text-align: left; min-height: 1.4em;">Iniciando…</span>
      <span class="tr-loading-pct" style="color: #ffd23f; font-weight: 700; font-feature-settings: 'tnum'; min-width: 48px; text-align: right; font-size: 15px; letter-spacing: 0.5px;">0%</span>
    </div>
  </div>
</div>
<script>(function(){if(/[?&]lang=en(&|$)/.test(location.search)){var b=document.getElementById('boot');if(b){b.querySelector('.tr-loading-label').textContent='Loading the houses room…';b.querySelector('.tr-loading-step').textContent='Starting…';}}})()</script>`

  // Inject overlay into <body>
  const bodyIdx = page.indexOf('<body>')
  if (bodyIdx >= 0) {
    page = page.slice(0, bodyIdx + 6) + '\n' + overlay + '\n' + page.slice(bodyIdx + 6)
  }

  // Turn synchronous room bundle script into inert text script so the loading screen paints immediately
  page = page.replace('<script>(()=>{', '<script type="text/plain" id="room-bundle">(()=>{')

  const bootScript = `<script type="text/plain" id="floorplan-bundle">${safe(bundle)}</script>
<script>
(function () {
  var lang = /[?&]lang=en(&|$)/.test(location.search) ? 'en' : 'pt';
  var curPct = 0;
  var paint = function (delay) {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(function () { setTimeout(finish, delay || 0); });
      setTimeout(finish, (delay || 0) + 120);
    });
  };
  var setProgress = function (target, ptText, enText, holdMs) {
    var bar = document.querySelector('#boot .tr-loading-bar i');
    var pctNode = document.querySelector('#boot .tr-loading-pct');
    var stepNode = document.querySelector('#boot .tr-loading-step');
    if (stepNode) stepNode.textContent = lang === 'en' ? enText : ptText;
    return new Promise(function (resolve) {
      var step = function () {
        if (curPct < target) {
          curPct = Math.min(target, curPct + Math.max(1, Math.ceil((target - curPct) * 0.35)));
          if (bar) bar.style.width = curPct + '%';
          if (pctNode) pctNode.textContent = curPct + '%';
          if (curPct < target) {
            requestAnimationFrame(step);
            return;
          }
        } else {
          curPct = target;
          if (bar) bar.style.width = curPct + '%';
          if (pctNode) pctNode.textContent = curPct + '%';
        }
        setTimeout(resolve, holdMs || 30);
      };
      requestAnimationFrame(step);
    });
  };
  var run = function (id) {
    var script = document.createElement('script');
    script.textContent = document.getElementById(id).textContent;
    document.body.appendChild(script);
  };
  var shown = document.getElementById('boot');

  paint(30).then(function () {
    return setProgress(15, 'Carregando motor 3D e ambiente…', 'Loading 3D engine and arena…', 40);
  }).then(function () {
    run('room-bundle');
    return setProgress(45, 'Compilando catálogo e módulos de arquitetura…', 'Compiling floorplan modules…', 40);
  }).then(function () {
    run('floorplan-bundle');
    return setProgress(75, 'Construindo plantas e estruturas…', 'Building houses and structures…', 40);
  }).then(function () {
    window.__floorplanReport = FloorplanArea.loadInto(window.__testRoom);
    return setProgress(95, 'Finalizando iluminação e física…', 'Finalizing lighting and physics…', 40);
  }).then(function () {
    return setProgress(100, 'Pronto!', 'Ready!', 120);
  }).then(function () {
    if (shown) {
      shown.classList.add('tr-loading-hidden');
      setTimeout(function () { shown.remove(); }, 250);
    }
  }).catch(function (error) {
    var step = document.querySelector('.tr-loading-step');
    if (step) {
      step.textContent = (lang === 'en' ? 'Loading failed: ' : 'Falha ao carregar: ') + (error && error.message ? error.message : error);
      step.style.color = '#ff8a80';
    }
    console.error(error);
  });
})();
</script>`

  const at = page.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  const html = `${page.slice(0, at)}${bootScript}\n${page.slice(at)}`
  writeFileSync(join(here, 'dist/sala-casas.html'), html)
  console.log(`dist/sala-casas.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-casas.html`)
}
