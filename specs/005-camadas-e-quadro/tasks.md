# Tasks — Spec 005

Leia `spec.md` e `plan.md` antes de começar. Cada task é aditiva e segue a regra de compatibilidade D2: nada quebra para o jogo. Toda
task fecha com os gates do fim deste arquivo e com um commit isolado.

## Fase 0 — Decisões
> 🤖 Modelo: `opus`

- T0.1 🧠 Plano de arquitetura (`plan.md`, D1 a D9). Feito em 2026-10-31.

## Fase 1 — Cercas em modo aviso (pode começar já, a partir de `main`)
> 🤖 Modelo: `sonnet` (T1.2, T1.3 e T1.4 → `haiku`)

- T1.1 `.dependency-cruiser.cjs` com as camadas D1. As regras são `core-no-three`, `core-not-content`, `content-not-adapter`,
  `adapter-not-content`, `no-domain-adapter-to-adapter`, `nothing-imports-test-room`, `no-deep-import`, `no-circular` e
  `testing-only-from-testing`.
  - Script `pnpm check:layers`; a baseline das violações de hoje fica em `.dependency-cruiser-known-violations.json`.
  - O CI roda no modo "nenhuma violação **nova**".
  - Aceite: o comando sai com 0 e um import proibido de teste o faz falhar.
- T1.2 Política de versões D9:
  - three como peer `^0.160.0` em todo pacote;
  - deps internas em `workspace:^`;
  - flag `onlyUpdatePeerDependentsWhenOutOfRange` no `.changeset/config.json`;
  - script `pnpm check:packages` (`tools/check-packages.mjs`) que cobra as três coisas.
  - Aceite: `grep -rn '">=0.160' packages/*/package.json` vazio, `pnpm check:packages` sai com 0, `pnpm build && pnpm test` passam.
- T1.3 Deps declaradas e não usadas (item 19 da análise): remover, ou mover para dev.
  - Aceite: o `check:packages` ganha a verificação "declarada = importada" e passa.
- T1.4 ESLint: `no-restricted-syntax` contra `new *.PointLight`/`SpotLight` fora de `game-render-three` e `game-vfx-three`, em modo
  `warn` até a Fase 4; `max-lines` 1500 como `warn` em `packages/*/src`.
  - Aceite: `pnpm lint` sai com 0 e mostra os avisos esperados.
- T1.5 CI: um job `architecture` que roda `check:layers` e `check:packages`.

## Fase 2 — `./testing` (depois da Fase 1)
> 🤖 Modelo: `haiku`, um pacote por commit (T2.2 → `sonnet`)

- T2.1 Para cada pacote com `test-area/`, `bench/` ou `scenarios` no `.`: subpath `./testing` no `exports` e no tsup, e o `.` deixa
  de reexportar. O símbolo antigo no `.` fica `@deprecated`, reexportado do `./testing`, até a próxima major. Os exemplos passam a
  importar de `./testing`.
  - Aceite: `grep -E "test-area|bench" packages/<pkg>/src/index.ts` só acha os reexports deprecados; exemplos compilam.
- T2.2 Com a área de teste fora do `.`, cortar as dependências `-three` → `-three` que só ela usava:
  - `furnitureSpec` vira dependência do `./testing`;
  - `createCord` vai para `game-shapes-three`;
  - item ↔ arma (`buildItem`) passa a ser injetado.
  - Aceite: `no-domain-adapter-to-adapter` sem violação nova e baseline menor.

## Fase 3 — Conteúdo por opção e preset padrão
> 🤖 Modelo: `sonnet`

- T3.1 Criar `game-kit-defaults` (L5), com o README e a tabela de presets.
- T3.2 `game-urban`: providers recebem frota e espécies por opção; `defaultUrbanProviders()` vai para o preset. Os imports antigos
  ficam `@deprecated`.
- T3.3 `game-vehicles-three` (paletas e medidas), `game-floorplan-three` (móveis) e `game-characters-three` (clipes) recebem o
  conteúdo por opção, com o padrão no preset.
- Aceite da fase: `core-not-content` e `adapter-not-content` sem violação; goldens iguais.

## Fase 4 — Dono do quadro e da GPU (depois do merge de `perf/explosion-frame-budget`)
> 🤖 Modelo: `sonnet` (T4.1 e T4.3 são 🧠 → `opus` desenha a API, `architect` valida antes de implementar)

- T4.1 🧠 `game-runtime`: agendador com as fases D3, passo fixo, `scheduler.budget` e `ModuleHost.onFrame(fn, { phase, order })`.
  - Testes: ordem das fases, subpassos com teto, orçamento repartido e com sobra carregada.
- T4.2 Migrar as filas adiadas para o `scheduler.budget`: vozes do `game-audio`, `eventBudgetMs` do `game-destruction-three` e
  `creaseTask` do `game-vehicles`.
- T4.3 🧠 `game-render-three`: `LightBudget`, `ProgramWarmup`, pools de geometria e de material e o tipo `ThreeLib`.
- T4.4 Migrar as luzes para o `LightBudget`, um pacote por commit:
  - pool do `game-vfx-three`;
  - luzes de cômodo do `game-floorplan-three`;
  - foguete de `game-weapons-three/src/fx/heavy.ts`;
  - lâmpadas de `game-interactables-three/src/mesh.ts`;
  - sinalizador de `game-characters-three/.../hand-items.ts`;
  - faróis de `game-weather-three`;
  - orçamento do `game-urban-three`.
  - Fim da task: o lint de luz vira `error`.
- T4.5 Partículas de `game-vehicles` e de `game-weapons-three/src/fx` passam pelo `host.effects` e pelo pool de material. Sai o
  `pinPrograms` da sala.
- T4.6 Os pré-aquecimentos (`warmUpProbes`) dos adaptadores se registram no `ProgramWarmup`, que também envia à GPU os buffers dos
  efeitos de cada explosivo no carregamento. O alvo são os 2 quadros de 36 ms que sobraram na primeira granada e no primeiro molotov
  (lado da GPU, ver `docs/desempenho-explosoes.md`).
- Aceite da fase: `perf.mjs` (GPU e CI) com 0 programas em todas as fases e nenhum orçamento a mais estourado do que antes.

## Fase 4b — Reação em cadeia: explosões e corpos (depois da T4.1)
> 🤖 Modelo: `sonnet` (T4b.1 é 🧠 → `opus` desenha e `architect` valida antes)

Reação em cadeia é o critério 17 de `docs/criterios-fisica-objetos.md`. Aqui ela vale para explosões e para os corpos da horda,
ligadas entre si: carro explode → botijão → zumbis arremessados → caem sobre outros → onda de quedas. Nada roda com motor de física
rígida na horda. A cadeia surge de regras locais pela grade espacial que o `game-crowd` já tem.

- T4b.1 🧠 Desenho (D10 no `plan.md`), com estes pontos:
  - **impulso por agente:** velocidade de empurrão que decai com o atrito; o contato troca impulso pela grade de 1 m (física de
    posição em 2D, O(n));
  - **estados de equilíbrio:** em pé → cambaleando → caído → levantando. Os limiares vêm do tipo (peso, força) por opção;
  - **corpo caído:** é obstáculo e causa tropeço;
  - **a cadeia avança um salto por passo fixo:** é uma onda, não um cálculo grande num quadro;
  - **faixas:** cadeia completa só na faixa perto do jogador, versão resumida nas de longe;
  - **teto de quedas simultâneas;**
  - **corpos arremessados:** pool de N (padrão 32) perto do jogador; os demais vão direto para a pose de morte instanciada;
  - **elos das explosões:** cada elo tem atraso (pressão subindo, pavio) e passa pelo `scheduler.budget`, para que duas
    detonações da mesma cadeia nunca caiam no mesmo quadro sem orçamento.
- T4b.2 `game-crowd`: impulso, estados de equilíbrio, tropeço no caído e a API `crowd.blast({ point, energy, radius })`, que é uma
  consulta na grade, dano e impulso pela distância e mais nada.
  - Testes determinísticos:
    - a granada na frente de uma fila derruba uma onda que avança com o tempo;
    - há queda além do raio da explosão (prova da cadeia);
    - um brutamonte no caminho segura a onda;
    - a mesma semente dá o mesmo resultado a 30, 60 e 144 fps (prova do passo fixo).
- T4b.3 `game-crowd-three`/`game-characters-three`: o pool de corpos arremessados (arco, queda e pose final), a pose de cambalear e
  de caído instanciada, e o membro arrancado e o sangue pela fila com orçamento.
- T4b.4 Ligação na composição: a explosão do `game-destruction`/`game-weapons` chama `crowd.blast`; o veículo e os objetos
  pressurizados armam a cadeia de explosões pelo `chain` existente, com o atraso por elo.
- T4b.5 `examples/test-room/perf.mjs`, fase `chain_horde`:
  - 2.000 zumbis vindo;
  - uma fileira de botijões e um carro no caminho;
  - granadas, RPG, molotov e tiro no meio da horda.
  - Orçamentos: os de sempre (0 quadros acima de 33,4 ms, p99 ≤ 20 ms e 0 shaders na GPU; no CI, contadores) e mais **quedas
    em cadeia > 0**, para que o teste também prove que a reação acontece.
- T4b.6 Horda densa sem explosão, que é o estado normal: os corpos se esbarram o tempo todo, derrubam alguns e sobem em cima deles.
  - Contato pela grade (vizinhos da célula e das 8 em volta) com amortecimento e 1 a 2 iterações por passo.
  - **Queda por pressão:** a chance de cair cresce com a pressão acumulada em volta e depende do tipo (peso, força) e do
    equilíbrio. Empurrão leve quase não derruba; a horda espremida derruba alguns.
  - **Monte em qualquer lugar:** a pilha deixa de ser só do muro. Os corpos caídos viram uma altura por célula; os de trás andam
    e sobem por cima, e quem está embaixo leva dano de pisoteio.
  - **O monte se desfaz:** os caídos levantam quando a pressão alivia, o monte desaba se a base cai, e a explosão espalha o
    monte (o `pileBlast` passa a valer em qualquer lugar). A altura do monte tem teto, configurável.
  - A pressão acumulada empurra a porta e alimenta o monte no muro.
  - Testes de estabilidade e comportamento:
    - sobreposição entre corpos abaixo da tolerância;
    - a energia da multidão parada não cresce em 60 s;
    - sem pressão, zero quedas;
    - com a horda espremida contra o muro, uma fração cai e outros ficam acima do chão (subiram no monte);
    - a altura do monte respeita o teto;
    - a porta cede pela pressão;
    - a mesma semente dá o mesmo resultado.
  - Fase `dense_horde` no `perf.mjs`: 2.000 zumbis espremidos contra um muro e uma porta por 30 s, sem explosão, dentro dos
    orçamentos, com quedas por pressão > 0 e agentes no monte > 0.
  - Se não couber, a próxima etapa é a horda num Web Worker (os vetores tipados do `game-crowd` já permitem); a medição decide.
- T4b.7 Escada de desenho com variedade (D11 e D12, degraus 1 a 3):
  - Sombra real só perto, mancha simples no resto.
  - Impostor de longe, por tipo de corpo e silhueta, com tinta por instância e quadro defasado.
  - Poses em textura (VAT) com fase, velocidade e mistura por instância.
  - Atributos por instância no lote assado: pele, paleta, escala, máscara de ferimentos e membros, acessórios.
  - Reaproveita as variantes de `game-characters-undead` e do `game-crowd-three`; nada de corpo novo desenhado à mão.
- T4b.8 Personalidade por semente no `game-crowd`:
  - velocidade, reação, limiar de equilíbrio, tropeço, agressividade, jeito de andar e o que faz parado;
  - os limiares de queda e de subida no monte vêm dela.
- T4b.9 Teste de variedade (A16):
  - Numa horda de 2.000:
    - no máximo 1% dos pares a menos de 3 m com a mesma assinatura de aparência (tipo, variante, paleta, escala, ferimentos,
      acessórios);
    - nenhum grupo de vizinhos andando em fase: a fase da animação dos 8 vizinhos mais próximos espalhada (desvio mínimo
      configurável);
    - a assinatura é igual em todos os níveis de detalhe, inclusive o impostor;
    - a mesma semente dá a mesma horda.
  - Prova visual: um print da horda perto e um de longe.
- T4b.10 Máquinas-alvo (D12):
  - O `perf.mjs` ganha `PERF_GPU=intel|nvidia` e a contagem da horda por máquina.
  - As fases `dense_horde` e `chain_horde` passam nas duas máquinas, com os números registrados em `docs/desempenho-explosoes.md`.
  - Se não couber, sobe-se a escada da D12 e o degrau usado fica registrado.
- Aceite da fase: os testes da T4b.2, T4b.6 e T4b.9 passam, e as fases `dense_horde` e `chain_horde` passam no `perf.mjs` nas duas
  máquinas da D12 e no CI.

## Fase 5 — Contratos
> 🤖 Modelo: `sonnet` (um pacote por commit)

- T5.1 Contrato de custo D8 no `checkDestructible`, mais a medição em todos os `DestructibleImpl` do kit.
- T5.2 Catálogo por instância (D5): `game-floorplan`, `game-destruction` (assemblies), `game-items-three`, `game-shapes` e
  `game-weapons-three`. O global fica `@deprecated`.
  - Aceite: em cada um, um teste com dois mundos e packs diferentes na mesma página, sem vazamento.
- T5.3 Fallbacks silenciosos (item 12 da análise): quem cria um mundo de efeitos ou um motor de áudio próprio passa a avisar. Na
  sala, os fallbacks ficam desligados.

## Fase 6 — A sala vira host (depois da Fase 4)
> 🤖 Modelo: `sonnet` (T6.1 🧠 → revisão de `architect` em `opus` antes)

- T6.1 🧠 Desenho do corte do `room.ts`: `host-services`, `scheduler` (o `game-runtime`), `player-rig`, `areas` e `scenarios`.
- T6.2 Arsenal e explosivos saem da sala para o módulo `game-weapons-three/testing`, carregado com `room.loadModule`.
- T6.3 Fluidos e terreno viram módulos.
- T6.4 Partir o `room.ts` conforme a T6.1.
- Aceite da fase: `wc -l room.ts` < 1.200; deps da sala só `game-contracts`, `game-runtime`, `game-render-three` e `game-audio`;
  `examples/test-room/test.mjs` e `perf.mjs` passam.

## Fase 7 — `game-vehicles` só regra
> 🤖 Modelo: `sonnet`, um subsistema por PR

- T7.1 a T7.n: a geometria sai para `game-vehicles-three`, um subsistema por vez: partículas → luzes → carroceria → vidro → peças
  soltas. O `api.ts` perde os `any`.
- Aceite: `grep -l "THREE\." packages/game-vehicles/src` cai a cada PR até chegar a 0; goldens da frota iguais.

## Fase 8 — Publicação e fechamento
> 🤖 Modelo: `sonnet` (T8.3 → `haiku`; T8.4 🧠 → `opus`)

- T8.1 IIFE com externos via `globalThis` (D9).
- T8.2 `publint` e `@arethetypeswrong/cli` no `check:packages`.
- T8.3 As regras do depcruise passam a `error`, sem baseline.
- T8.4 🧠 Rodar de novo a análise de arquitetura e atualizar a nota em `docs/arquitetura-plug-sdks.md`. A meta é A1–A14 todos ✅.

## Gates de cada task

- `pnpm -r typecheck` e os testes dos pacotes tocados.
- `pnpm check:layers` sem violação nova (a partir da T1.1).
- Goldens dos pacotes tocados iguais.
- Nas Fases 4 e 6: `examples/test-room/perf.mjs`.
- Toda mudança de corpo, animação ou arma na mão é validada em todas as câmeras (`CLAUDE.md` §5).
- Commit isolado por task, com o registro em `evidence.md`.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/005-camadas-e-quadro/ (leia spec.md, plan.md e tasks.md antes de começar).
Uma task por vez, na ordem do tasks.md, num worktree próprio (a pasta principal é compartilhada por outras sessões; nunca troque
de branch nela). Fase 1 pode começar já; Fases 4 e 6 só depois do merge de perf/explosion-frame-budget.
Modelos: Fase 1 → executor model=sonnet (T1.2–T1.4 haiku) · Fase 2 → executor model=haiku (T2.2 sonnet) ·
Fase 3 → executor model=sonnet · Fase 4 → executor model=sonnet, T4.1 e T4.3 🧠 → opus desenha e architect valida antes ·
Fase 4b (reação em cadeia) → executor model=sonnet, T4b.1 🧠 → opus desenha e architect valida antes ·
Fase 5 → executor model=sonnet · Fase 6 → sonnet, T6.1 🧠 → architect (opus) antes · Fase 7 → sonnet, um subsistema por PR ·
Fase 8 → sonnet (T8.3 haiku, T8.4 🧠 opus) · revisão final de cada fase → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm -r typecheck + testes dos pacotes tocados + pnpm check:layers sem violação nova + goldens iguais +
commit isolado, evidência em evidence.md. Regra D2: nenhuma API pública some; a antiga fica @deprecated.
Pare e pergunte antes de: publicar pacote no npm, remover API (major), deploy, qualquer [NEEDS CLARIFICATION].
```
