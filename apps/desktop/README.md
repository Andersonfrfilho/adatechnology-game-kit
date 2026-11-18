# @adatechnology/desktop-app

As salas de teste do kit como app de desktop (Electron). É **um alvo a mais**: o site e a 4280 continuam iguais.

## Por que um app

O Jolt multithread usa `SharedArrayBuffer`, que o navegador só libera numa página isolada por origem
(`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`). No app quem manda os cabeçalhos somos nós: o processo
principal serve a pasta da sala (a mesma da 4280) em `127.0.0.1`, com esses cabeçalhos, usando o servidor do kit (`tools/serve-room`). A página
abre com `crossOriginIsolated === true`.

**Electron, não Tauri:** o Electron traz o mesmo Chromium do site e dos testes Playwright, então WebGL/WebGPU, wasm e threads se comportam igual.
O Tauri usa WebKitGTK no Linux e WebKit no Mac, onde `SharedArrayBuffer`, threads de wasm e WebGPU são instáveis: voltaria o problema do Safari.

## Jolt no app

Por padrão a sala abre com `?solver=jolt&joltBuild=multithread`: a build multithread do Jolt (SIMD ligado), **com zero worker threads**. Os callbacks
de contato do kit são JavaScript e o Jolt os chama da thread que acha o contato; com workers isso cai numa thread sem o objeto JS e o passo quebra
(prova e números em [`docs/medicoes/jolt-multithread.md`](../../docs/medicoes/jolt-multithread.md)). Workers só existem no modo de medição
(`--jolt-threads=N --jolt-contacts=off`, ou menu **Física**), que desliga as regras de contato do kit. O canto inferior esquerdo mostra
`crossOriginIsolated`, a build, as threads e os contatos.

## Comandos (da raiz do repositório)

| Comando | O que faz |
|---|---|
| `pnpm desktop` | build do app, copia a sala (`examples/test-room/dist`, links seguidos) para `apps/desktop/build/room`, baixa o binário do Electron se faltar e abre o app |
| `pnpm desktop --area=floorplan_area` | abre direto numa área (também `KIT_DESKTOP_AREA=floorplan_area`) |
| `pnpm desktop:package` | gera o AppImage em `apps/desktop/release/` (`electron-builder` via `pnpm dlx`, Linux) |
| `pnpm check:desktop` | Playwright no app (`_electron.launch`): print do menu, da sala com o selo e da cratera, em `apps/desktop/shots/` |
| `pnpm check:desktop --area=<id>` | só aquela área |
| `pnpm check:<área> --target=desktop` | o `check:<área>` de sempre (build e testes), abrindo a área no app em vez do Chromium |

`check:desktop` abre uma janela com GPU: **nunca no CI nem no pre-push** (CLAUDE.md §9). O CI roda só o build, o typecheck e os testes unitários
deste pacote (`tests/`, sem Electron).

## Salas e áreas

- **Tela inicial** (`--area` vazio, `menu`): as áreas da sala (`?area=`) e as páginas de área construídas. Nada é listado à mão: as áreas vêm da própria
  sala (`room.modules()`, as que têm área; na primeira abertura o app monta a sala uma vez escondida para lê-las e guarda em `room-areas.json` na pasta
  de dados do app) e as páginas vêm de `tools/check-area/plan.mjs` (a lista do `pnpm check:<área>`), gravadas pelo `stage` em `desktop-areas.json`.
- **Menu da janela:** *Salas* (início, sala inteira, páginas de área), *Áreas da sala* (cada `?area=`), *Física* (Jolt multithread, Jolt single, só
  medição com workers, solver próprio) e *Ver*.
- **`--area=<id>`:** `menu` abre a tela inicial; `room` a sala inteira; o id de uma página de área construída (`vehicles`, `floorplan`...) abre a página;
  qualquer outro id vira `test-room.html?area=<id>` (`floorplan_area`, `weather_area`...).

Outras opções: `--solver=jolt|own`, `--jolt-build=multithread|single`, `--jolt-threads=N|auto`, `--jolt-contacts=js|off`, `--lang=pt|en` (cada uma também
como `KIT_DESKTOP_<NOME>`).

## Segurança

Janela com `sandbox`, `contextIsolation` e sem `nodeIntegration`; o servidor escuta só em `127.0.0.1`, em porta aleatória; qualquer link para fora
abre no navegador do sistema.
