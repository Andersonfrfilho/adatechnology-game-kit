# 9. Testes de GPU e navegador: só na rodada diária, nunca no CI nem no push — **OBRIGATÓRIO**

Texto completo da seção 9 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

Decidido pelo dono em 2026-11-03. Testes que dependem de GPU/renderização (orçamentos de quadro, `perf.mjs`, e os testes que abrem a sala de teste
no navegador) **não rodam na pipeline de CI**. Eles rodam na rodada diária da main, na máquina local com GPU, comparando com a main medida na mesma máquina. O CI
fica só com build, typecheck, lint e testes que não precisam de GPU.

- **O pre-push não roda nenhuma suíte de GPU ou de navegador** (dono, 2026-11-08: os pushes ficavam 20 min ou mais na fila da GPU). Elas rodam só
  na rodada diária da madrugada, na main (abaixo). Para rodar as de uma branch na mão: `node tools/gpu/browser-checks.mjs` (o que está abaixo
  sobre a seleção de suítes vale para esse comando).
- **O pre-push tem fila** (dono, 2026-11-08: quatro pushes ao mesmo tempo levavam 20 a 40 min cada). A metade de CPU (`tools/pre-push/checks.mjs`:
  build com cache por conteúdo compartilhado entre os worktrees, lint dos arquivos alterados, typecheck e testes só dos pacotes alterados, em
  paralelo) roda sob `cpu.lock`, em `~/.cache/adatechnology-game-kit`.
  Os dependentes dos pacotes alterados ficam para o CI, que roda tudo no PR. Detalhes e variáveis no `CONTRIBUTING.md` (Git hooks).
- **Rodada diária na main** (dono, 2026-11-06: com várias sessões na mesma trava de GPU, a bateria inteira em cada push deixava os pushes horas na fila).
  As suítes que abrem a sala inteira (`test-room`, `scene.mjs` e `cost.mjs` do `tools/kit-audit`, `examples/test-room/leak.mjs`) e o
  `tools/gpu/perf-gate.mjs` (`examples/test-room/perf.mjs`) saíram do push e rodam uma vez por dia, às 04:30, por `tools/gpu/nightly-gpu.mjs`: num worktree
  próprio da `origin/main` mais nova, espera a máquina ficar ociosa e no carregador, faz build e roda tudo sob a mesma trava (`GPU_SCOPE=nightly`), com o
  desempenho comparado com a última main aprovada nesta mesma máquina (`~/.cache/adatechnology-game-kit/nightly-state.json`). O relatório fica em
  `~/Documents/personal/adatechnology-game-kit-shots/nightly/AAAA-MM-DD/` (`summary.md`, um `.log` por etapa e `STATUS`), e a falha abre um aviso na
  área de trabalho. **Main com a rodada diária vermelha é a primeira coisa a corrigir no dia.** Ligar, desligar e rodar na mão:
  `sh tools/gpu/systemd/install-nightly.sh` (liga o timer do systemd do usuário), `... off` e `... now` (ou `node tools/gpu/nightly-gpu.mjs`), sempre a
  partir do checkout principal. Uma branch que precisa da bateria inteira antes do merge roda `GPU_SCOPE=nightly PRE_PUSH_BROWSER=all node
  tools/gpu/browser-checks.mjs` e `node tools/gpu/perf-gate.mjs` na mão.
  A `git push` só segura a rodada se for recente (`NIGHTLY_STALE_PUSH_MIN`, 90 min), não estiver só esperando uma trava e `gpu.lock` estiver ocupada (`tools/gpu/push-guard.mjs`); o motivo de cada push ignorado vai no `summary.md`. O `browser-checks.mjs` segue depois de uma falha e lista todas no fim (`BROWSER_CHECKS_FAIL_FAST=1` para parar na primeira).
- **Só no carregador** (dono, 2026-11-06: nenhum push fica bloqueado). `tools/gpu/power.mjs` lê `/sys/class/power_supply`: no carregador (Mains ou
  USB-C online, ou desktop sem bateria) os dois rodam; na bateria são pulados com aviso (`pre-push: ... skipped: on battery ...`) e o push segue.
  Bateria de dispositivo (mouse, fone) não conta; sem a pasta (fora do Linux) roda. `PRE_PUSH_ON_BATTERY=1` roda mesmo na bateria.
- **O `browser-checks.mjs` roda só as suítes de navegador do que a branch muda** (dono, 2026-11-04: a bateria inteira levava 60-90 min e, com várias sessões na
  mesma trava de GPU, bloqueava a noite). `tools/gpu/select-suites.mjs` lê o diff contra a `origin/main` e imprime que suítes vão rodar e por quê:
  - cada `examples/<área>` roda quando muda a própria pasta ou um pacote que a página carrega (o `package.json` e os `@adatechnology/*` importados em
    `src/` e nos `.mjs`), direto ou pelas dependências desses pacotes; a sala (`test-room`), `scene.mjs`, `cost.mjs` e `leak.mjs` abrem a sala com
    todos os módulos (o build dela embute a entrada do `interactables-test-area`), então rodam para qualquer pacote de conteúdo; `tools/kit-audit`
    roda `scene` e `cost`;
  - **base, roda tudo:** `game-contracts`, `game-shapes`, `game-shapes-three` e `game-render-three` (pelo grafo: carregados por 3/4 ou mais das
    páginas de área; o teste unitário falha se outro pacote passar desse limite sem entrar em `BASE_PACKAGES`), `game-test-room` e
    `examples/test-room` (toda área é montada sobre a página da sala), `game-destruction` e `game-destruction-three` (a sala quebra os objetos de
    toda área por eles), `tools/gpu`, `.githooks`, `package.json` da raiz, `pnpm-lock.yaml`, `pnpm-workspace.yaml` e `tsconfig.base.json`. Caminho
    que o mapa não conhece também roda tudo;
  - **não roda nenhuma:** `.md`, `docs/`, `specs/`, `site/`, `.changeset/`, `.github/`, `test-support/`, `packages/*/tests/` e a configuração de lint.
  - `PRE_PUSH_BROWSER=all` (ou `PRE_PUSH_ALL=1`) força todas as áreas; as suítes da sala inteira só entram com `GPU_SCOPE=nightly`.
  - Área nova entra em `AREAS` do `select-suites.mjs`; pacote novo é achado sozinho pelo `package.json` e pelos imports das páginas.
- Teste novo que abre página, usa Playwright, WebGL ou mede quadro entra no `browser-checks.mjs` ou no `perf.mjs`, **nunca** num job do
  `.github/workflows/ci.yml`. Revisão que vê Playwright/Chromium no CI barra.
- Falha de teste de navegador (na rodada diária ou na mão) não se resolve tirando o teste: corrige a causa, como qualquer teste.
