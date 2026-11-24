# Tasks — Spec 011, cena de referência

Leia `spec.md`, `plan.md`, `cartas.md` e as regras §1, §2, §5, §11, §13, §14 e §15 antes de começar. Uma task por vez, na ordem; worktree
próprio. Antes de criar qualquer peça, `kit_owner` e `kit_origin` (MCP `game-kit`) dizem o pacote dono.

Cada task responde **Mecânica?** e **Aceite por comando?**; duas vezes "sim" → `haiku`. 🧠 = decisão herdada por outras tasks.

## Gates de toda task

1. Typecheck e testes sem GPU dos pacotes tocados; goldens sem diff; lint; `pnpm check:layers`; `node tools/kit-audit/audit.mjs --check`;
   `node tools/shapes-bench/dist/cli.js --cost-check` (custo de desenho por peça, PR #451).
2. Peça nova: os testes do pacote dono (21 critérios §6, `coincidentFacesOf` §13, catálogo de objetos quebrados §12, `leak.mjs` §8) e print na
   sala da área dela. Estrutura (ponte, prédio, laje): agente `engenheiro-estrutural` (§11). Geometria nova: agente `revisor-z-fighting`.
3. Tempo de quadro: régua da spec 010 antes e depois (§15). Pose, arma ou câmera: 3ª e 1ª pessoa (§5).
4. Commit isolado por task e uma linha no `evidence.md`. `room.ts` não cresce.
5. Fase 1 e 1b: depois de cada task, goldens sem diff e o mesmo hash do `tools/gpu/room-determinism.mjs` gravado no passo 0 (M67, com e
   sem marca-passo). Hash diferente: para e pergunta ao dono.
6. Falha nova na sala ou na rodada diária é comparada com a `origin/main` do dia, nunca dada como "já estava assim" (N7).

## Fase 0 — Passo 0 (2026-11-24)
> 🤖 Modelo: `sonnet`

- **T0.1** Documentos da spec trazidos para cima da `main` de hoje e corrigidos (quadro da M67 depois da spec 018, defaults do host, 012 a
  016 na `main`, portão de custo por peça, régua da explosão só com C4), cenário `caos` na spec, linhas do `room.ts` conferidas; estado da
  sala gravado antes de mexer (`pnpm check:room`, hash do `room-determinism.mjs` com e sem marca-passo, o que a rodada diária reprova). PR só
  de documentação.
- **T0.2** N8: rebasear os três commits de 2026-11-18 e abrir um PR por commit, nesta ordem: `check:layers` (subpastas de `exports`),
  oclusão (T1.2), registro de objetos (T1.6a).
- **T0.3** `tools/kit-audit/rules.json`: poste, semáforo e fiação entram como palavras do `game-urban` (hoje dono no domínio `structure` só por
  rua e calçada), ou num domínio `urban` próprio (L13).

## Fase 1 — Host do mundo no SDK
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 — `opus`, validar com `architect`)

- **T1.1 🧠** Desenho do `createKitWorld` em `design-host.md`: a lista das ligações que a sala faz à mão (`room.ts` de 2026-11-24, 5.615 linhas: 323,
  374–377, 386, 431, 466–469, 494–518, 616, 635–643, 929, 4079–4081, 4784–4823, 5555–5577), o que vira opção, o que o jogo pluga, um arquivo por ligação,
  e onde mora a oclusão de áudio. Inclui como ele registra as filas da spec 010.
- **T1.2** Oclusão de áudio do mundo (`game-test-room/src/world-occlusion.ts`) vai para o `game-audio` (`createRaycastOcclusion`); a sala
  importa de lá. Feita em 2026-11-18 numa branch que não chegou à `main` (N8): rebasear sobre os testes que o PR #414 deu ao arquivo.
- **T1.3** `createKitWorld` no `game-kit-defaults` (entrada `./world`), conforme o `design-host.md`. Pré-requisitos da spec 010 (T1.1, T3.3
  `stepFixed` e T3.4 fases da sala) **feitos**: a ordem do passo é a do `design-host.md` §4.1, revisada pelo architect em 2026-11-24. **Liga por padrão** o marca-passo da
  explosão (`blastPacing`), o Jolt, a política D4 dos destroços e o chão no worker, que hoje só a página da sala liga (L18), para a cena nascer com o ganho da spec 018. Inclui: mapear `/world` no tsconfig do dependency-cruiser e no `dts` do tsup;
  teste de ordem dos pontos de registro; teste sem GPU (mundo montado com THREE de teste, um passo, `reset`, `dispose` sem sobra pelo
  `leak.mjs`).
- **T1.4** Regra de camada `scene-not-testing` no `.dependency-cruiser.cjs`: `examples/reference-district` não importa `game-test-room`,
  `test-area` nem `bench`.
- **T1.5** A sala monta o mundo pelo `createKitWorld`. Só tira código do `room.ts`; testes e checagens da sala iguais (`pnpm check:room`).

## Fase 1b — Ação do jogador no SDK
> 🤖 Modelo: `sonnet` (T1.6 é 🧠 — `opus`, validar com `architect`)

Achado da T1.1 (`design-host.md` §6): tiro, golpe, explosivos, pegar, segurar, arremessar, item na mão, uso de item e recipientes moram no
`room.ts` e em arquivos irmãos da sala: **3.000 a 4.000 linhas**, presas à lista de objetos da sala. Sem esta fase a cena só anda e olha. Se
passar de 2 semanas, a Fase 2 começa com explosivos roteirizados pelo cenário e o tiro do jogador vem depois.

- **T1.6a** Registro de objetos do mundo (`world.objects`: entrar, sair, segurar, soltar, achar por id e por ponto) e porto de relato
  (`onEvent` tipado no lugar de `action`/`log`). A sala passa a registrar os objetos dela ali; nada mais muda. Goldens e hash iguais.
- **T1.6 🧠** Desenho do `createPlayerActions(world, { player, arsenal, hands })`: regra no núcleo dono (`kit_owner`), desenho em L5
  (`game-kit-defaults/player`, porque compõe fluids, terrain e destruction-three), o que é escolha de jogo (teclas, inventário) e a ordem de
  extração para não quebrar a sala.
- **T1.7** Extrair explosivos, o marca-passo (`blast-pacing.ts`) e o tiro (`createExplosives` 2933, `fireShots` 2532) para o pacote dono; a sala passa a usar. Goldens e hash iguais.
- **T1.8** Extrair golpe, item na mão e uso de item (`stepStrikes` 2796, `followHeld` 3417, `updateItemUse` 3585).
- **T1.9** Extrair andar, empurrar e recipientes (`stepWalkPlan` 4155, de `walk-plan.ts`, chamado no `simulateFixed` 4153; `footing` 862; `syncContainers` 4106). A sala só tira linhas (§15).

## Fase 2 — Esqueleto da cena só com o que já existe
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 — `opus`)

- **T2.1 🧠** Formato do JSON do recorte (D2) e o recorte 1 **inteiro** desenhado nele (N1): ruas, lotes com tipologia e semente, rio, ponte,
  zonas de horda, o cruzamento do `caos` com a barricada, os pontos e horários dos eventos dos roteiros. Onde falta peça (tabela do `plan.md`), um marcador `missing` com o dono, desenhado como caixa de aviso.
- **T2.2** `examples/reference-district`: página, `build.mjs`, montador que lê o JSON e chama `createKitWorld` e os pacotes; câmera de 3ª e
  1ª pessoa (`?camera=`); cenários `tipico`, `pior` e `caos` (`?cena=`). Área `district` no `tools/check-area`.
  Estrutura do D7: `src/game/` (montagem, o exemplo que o jogo copia) e `src/test/` (cenários roteirizados, sondas, prints); regra de camada
  `src/game/` não importa `src/test/`.
- **T2.3** Teste de cobertura sem GPU no CI (R2): lista de pacotes instanciados contra `packages/`, menos as duas exceções; os `missing`
  aparecem como pendência com o dono, e o teste falha quando a lista fica com pacote sem uso.
- **T2.4** Roteiros determinísticos (semente, horários, caminho do jogador): o da rua para `tipico`/`pior` e o do cruzamento para o `caos`
  (§4.2), com as fases nomeadas para a régua. As ligações que o `caos` pede e não existem (L15 fogo fere a horda, L16 NPC que atira, L17 horda
  contra a barricada) viram tasks próprias no pacote dono, cada uma com desenho curto e revisão; até lá o roteiro marca a fase como pendente.
  Câmera de ombro e primeira pessoa, nunca de cima; revisão independente do roteiro contra a referência de clima (R15).
- **T2.5** Sonda da cena (`examples/reference-district/perf.mjs`) no formato do `perf.mjs` e alvo `district` no `tools/gpu/perf-gate.mjs`
  (§6). Não é mecânica: as ferramentas de hoje leem `__testRoom`.
- **T2.6** Primeira régua da cena (R5) nos três cenários, a 1x e a 4x, com a trava; prints em 3ª e 1ª pessoa (R4). Entrega à spec 010.

## Fase 3 — Peças que faltam, cada uma no pacote dono
> 🤖 Modelo: `sonnet` (T3.1 e T3.3 são 🧠 — `opus`, validar com `engenheiro-estrutural`; T3.9 e T3.10 → `haiku` se o padrão do catálogo bastar)

Ordem: o que é jogável primeiro, o que é cenário depois. **A sala valida, a cena compõe (D6):** cada peça é feita no pacote dono, validada
na sala da área dela (gates 1 e 2, com print) e só então troca o seu `missing` no JSON da cena. Peça que não passou na sala não entra na cena.

- **T3.1 🧠** Prédio de 4 a 8 andares com planta e loja no térreo (`game-floorplan-residential`), enterável e destrutível, com estrutura NBR 6118.
- **T3.2** Sobrado de uso misto (loja + moradia), usando as zonas `mixed` que já existem.
- **T3.3 🧠** Ponte de concreto destrutível sobre o rio: estrutura e caminho de carga (`game-floorplan-structure`), traçado (`game-urban`).
- **T3.4** Rio com correnteza no `game-terrain`: zona de água corrente com direção e velocidade, arrasto e empuxo nos corpos.
- **T3.5** Viela entre casas no traçado do `game-urban`.
- **T3.6** Bar/boteco (`game-floorplan-commercial`), com móveis do catálogo.
- **T3.7** Vergalhão exposto na laje pronta (`game-floorplan-three`, a partir de `slab.exposedRebar`).
- **T3.8** Galinheiro de quintal (catálogo residencial e builder 3D).
- **T3.9** Cone, cavalete, fita zebrada (`game-props3d`); semáforo, faixa de pedestre e meio-fio (`game-urban`).
- **T3.10** Contexto `riverbank` na região `br` (`game-vegetation-species`); peixe e garça (`game-animals-species`).
- **T3.11** História do `game-stories` num bilhete posto numa casa (`game-items-goods`, achados do floorplan).
- **T3.12** Régua da cena de novo (gate 3) com as peças novas.

## Fase 4 — Visual nublado
> 🤖 Modelo: `sonnet` (T4.1 é 🧠 — `opus`)

- **T4.1 🧠** Desenho do preset `overcast` e da corrente de pós em `design-visual.md`: luz de céu, sol suave, céu com nuvens, tone mapping,
  gradação de cor, oclusão de ambiente em meia resolução; custo esperado por faixa; degraus do `tuner` (pós desligado antes de baixar
  resolução na integrada). Sem mudar o visual de quem não pede o preset (goldens).
- **T4.2** Preset `overcast` no `game-render-three` (luz, céu, tone mapping, gradação), sem pós. A cena liga por `?look=overcast`.
- **T4.3** Pós-processamento no `game-render-three` com degraus no `game-graphics`; o aquecimento compila os programas do pós (0 programas no
  meio do jogo).
- **T4.4** Print `shots/visual-alvo.png` no enquadramento da referência e veredito visual registrado (R6). Régua com e sem pós (gate 3).

## Fase 5 — Fechamento
> 🤖 Modelo: `sonnet` (revisão final → `code-reviewer` `sonnet`)

- **T5.1** Régua final nos três cenários, RTX e Intel integrada, com o tuner ligado (R7). AMD: pedir a alguém com Radeon uma rodada de
  `pnpm check:district` e anexar o JSON.
- **T5.2** README de `examples/reference-district` como guia "como montar o seu jogo com o kit" (R9), conferido por um agente sem
  contexto que o segue do zero até a página abrir; README do `game-kit-defaults` (como um jogo monta um mundo), referência na skill `game-kit`, e a §15 conferida.
- **T5.3** Transformar a carta da cena 2 em spec completa com o que esta cena ensinou (em sessão própria).

## Prompt de execução

```text
Execute a spec specs/011-cena-de-referencia/ (leia spec.md, plan.md, tasks.md, cartas.md, design-host.md e as regras §1, §2, §3, §5, §8,
§9, §11, §13, §14 e §15 antes). Decisões N1 a N11 tomadas pelo dono em 2026-11-24 (spec.md §9): recorte inteiro com `missing`, começar já.
Uma task por vez, na ordem do tasks.md, num worktree próprio; kit_owner e kit_origin antes de criar qualquer peça.
Modelos: Fase 1 → executor model=sonnet · T1.1 🧠 → opus (validar com architect) · Fase 1b → executor model=sonnet ·
T1.6 🧠 → opus (validar com architect) · Fase 2 → executor model=sonnet · T2.1 🧠 → opus · Fase 3 → executor model=sonnet ·
T3.1 e T3.3 🧠 → opus (validar com engenheiro-estrutural) · T3.9 e T3.10 → executor model=haiku · Fase 4 → executor model=sonnet ·
T4.1 🧠 → opus · revisão de cada PR → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit --check + shapes-bench --cost-check + commit isolado, PR com CI verde,
revisão independente aprovada e evidência em evidence.md. Fase 1 e 1b: goldens sem diff e o hash do room-determinism do passo 0.
Medição só com flock ~/.cache/adatechnology-game-kit/perf-measure.lock e carga abaixo de 4; nunca no CI; um comando pesado por vez.
Pare e pergunte antes de: regravar golden, mudar o que uma régua mede, apagar qualquer coisa, mudar o porte literal de uma entrega de time,
a Fase 3 passar de 3 semanas ou a 1b de 2, hash do room-determinism diferente, fato novo que contradiga uma decisão da §9.
```
