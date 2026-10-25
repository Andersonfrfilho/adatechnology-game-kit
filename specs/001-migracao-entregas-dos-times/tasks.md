# Tasks — Spec 001

Decisões em `consolidado.md` (todas fechadas em 2026-10-23). Fontes em `fontes.md` e `artefatos/`. Cada fase porta o que os times fizeram,
**igual ao original** (G3: semente fixa, sequência de eventos e hash da cena), e termina com o seu `examples/<lib>-test-area` e a área na
página do kit. Pacotes se compõem (`CLAUDE.md` §3): antes de escrever algo, use o pacote que já faz.

Todo pacote nasce com o **mundo normal como padrão** e o surto como camada gradual conduzida pelo `game-infection` (G7), e é
configurável por jogo (`CLAUDE.md` §2).

Ordem: armas → casas → itens → personagens → efeitos → som e clima → veículos e cidade → multidão, histórias e jogador.

## Fase 0 — Base comum
> 🤖 Modelo: `sonnet` (T0.2 é 🧠 → `opus`)

- T0.1 Ferramenta de golden "igual ao original": carrega a página do time (de `artefatos/` ou do site), troca `Math.random` por semente,
  grava sequência de eventos e hash da cena; o teste do pacote compara. Fica em `tools/golden/` e serve a todas as fases.
- T0.2 🧠 Ampliar o contrato genérico de módulo de teste (E5): parâmetros, camadas ligáveis e contadores (fps, desenhos, partículas),
  mais os eventos de arma que faltam (pane, destravar, rajada). Sem nada de domínio.
- T0.3 Corrigir as melhorias 1 e 2 (partículas de explosão do SDK que não aparecem; lixo por quadro em `particles.ts`) e regenerar os
  goldens de `game-vehicles-fleet` (V1).

## Fase 1 — Armas (Galeria 3D do Arsenal, Arsenal, Laboratório, jogo)
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 → `opus`)

- T1.1 🧠 Dados: união de todas as fontes (A1) em `game-weapons`, com marcas reais (G5), os 10 calibres que faltam (A7), dimensões reais,
  ruído do Arsenal (A3), joules (A2) e as fases da arma com o tempo do Arsenal (A5).
- T1.2 Contratos de animação da arma (A5) e eventos novos (T0.2) em `game-contracts`.
- T1.3 `game-weapons-three`: trocar as caixas pelos construtores da Galeria (pistola, revólver, fuzil, bullpup, P90, basculante, M2,
  lança-foguetes, lança-chamas), cartucho e estojo por calibre, tiro, ferrolho, rajada, pane e as 7 recargas, cumprindo o contrato.
- T1.4 Som do tiro (S2): classe e abafamento por distância do jogo + energia do calibre.
- T1.5 Explosivos e lançadores: regra em `game-weapons`; reação em cadeia em `game-destruction` (A11).
- T1.6 Goldens por arma; `weapons-test-area` com os controles novos.
- T1.7 🧠 Armas que faltam (MP5SD/K, UMP9, Mini Uzi, MP7 + 4,6×30, G36/K/C, M249, Minimi Para, FN MAG, RPK, MPX, MG3, Bizon, vz.61 + .32 ACP,
  ParaFAL, AR-15 civil, .380, Mossberg Cruiser, M134 em três modos) e sistema de acessórios com encaixes (miras, laser, lanterna,
  supressor, lança-granada sob o cano só onde há encaixe, carregadores, bandoleira, empunhadura, bipé, mochila de munição, coronha
  retrátil/dobrável). Desenho em `design/T1.7-armas-e-acessorios.md`. PR próprio (dono, 2026-10-24).

## Fase 2 — Casas (Visor de casas 3D, Galeria do Vale, área de casas)
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 → `opus`)

- T2.1 🧠 Estrutura dos pacotes (C2): estender `game-floorplan` (regras R01–R72), criar `game-floorplan-structure`, `-rural`, `-three`.
- T2.2 Portar o PlantasSDK do VC3 (C1): estrutura, instalações, 5 modelos rurais, laje de 1 a 3 andares (C7), barraco e gato de luz (C8).
- T2.3 **Concreto armado e tijolo** da destruição (item 8 do consolidado) aplicados na estrutura das casas e nos cenários de teste.
- T2.4 `game-floorplan-three`: desenho 3D (Casa3DSDK), andares andáveis (C6), ponte para os móveis.
- T2.5 Interiores com interior completo (C5): delegacia, escola, igreja, posto, pronto-socorro, metalúrgica, loja de armas, fazenda,
  triagem, mercado completo; silhuetas da Galeria como versão de longe (C4).
- T2.6 ✅ Goldens contra o VC3 e a área de casas; `floorplan-test-area`. (a: módulo e exemplo; b: também na `interactables-test-area`; c: site, Dockerfile, CI, miniatura; ver evidence.md `## T2.6`)

## Fase 3 — Itens
> 🤖 Modelo: `sonnet`

- ✅ T3.1 `game-items`: catálogo único (A9) estendendo o `ItemDef` do SDK, com categorias, atributos, validade pela idade, achados por
  lugar e receitas; os 257 itens, sem duplicar os 92 domésticos.
- ✅ T3.2 Modelos: os 24 da vitrine no tamanho real; os outros 233 com forma simples até o time entregar (`itens-modelos-3d.md`).
- ✅ T3.3 `items-test-area`. (T3.1a–k, T3.2a–c e T3.3a–c entregues no ramo `int/p3`; prova em `evidence.md`, Fase 3.)

## Fase 4 — Personagens e animais
> 🤖 Modelo: `sonnet` (T4.1 é 🧠 → `opus`)

- T4.1 🧠 `game-characters`: corpo do jogo com a proporção do guia (P1), juntas, andar, 11 segmentos com resistência por ponto contra a
  força da arma (P7, A4), desmembramento em 3 níveis (P8).
- T4.2 `game-characters-undead`: os 13 tipos do Bestiário v17 (P2, P11), velocidades com multiplicadores por momento (P3), olhos (P4),
  tipo de zumbi como propriedade na criação (P5), crianças podem virar (P6).
- T4.3 `game-animals`: 13 espécies com os três visuais e a regra de infecção de animal (P10).
- T4.4 `characters-test-area` e `animals-test-area`.

## Fase 5 — Efeitos
> 🤖 Modelo: `sonnet`

- T5.1 ✅ `game-vfx` + `-three`: explosão do Laboratório com o teto e o LOD do jogo (E1); destruição, fluidos e armas passam a usá-lo.
- T5.2 ✅ Oficina de VFX como módulo da bancada de efeitos (E5, T0.2), modelada no Laboratório.
- T5.3 ✅ `game-fluids`: filme que escorre, respingo por ângulo, bile e sangue antigo, com os valores do time como padrão configurável (E2). A ligação do `body` dos personagens ao filme (com a tinta da idade) entrou na T5.3e, depois da Fase 4.

## Fase 6 — Som e clima
> 🤖 Modelo: `sonnet`

- T6.1 `game-audio` (S1): síntese, mixagem, distância, limite de vozes, sons contínuos; os sons do jogo e da Cena de Arte.
  Feitas: T6.1c (motor WebAudio), T6.1e e T6.1e2 (armas), T6.1f (destruição), T6.1g (personagens e bichos), T6.1h (`audio-test-area`).
- T6.2 `game-weather` (E6): chuva leve e forte, neblina, relâmpago, vento, ciclone, tufão, calor intenso, ligados a fluidos e som.
  Feitas: T6.2a (núcleo), T6.2b (pontes e som), T6.2c (`game-weather-three`: cortina, chuva perto, neblina, céu, relâmpago, faróis e névoa de calor; os três efeitos da Oficina `chuva`, `neblina` e `farol` no `game-vfx`) e T6.2d (`weather-test-area`).
  Depois: o clarão, a fumaça, o sopro do lançador e o jato de chama da arma na mão passaram para receitas do `game-vfx` (`VIEWMODEL_EFFECTS`).
- T6.3 A sala empresta `host.audio` e `host.environment`; as áreas de som e clima entram no `interactables-test-area` (feita). T6.4 `site/` com os exemplos e miniaturas (feita nas partes de som e clima).

## Fase 7 — Veículos e cidade
> 🤖 Modelo: `sonnet`

- ✅ T7.1 Comparar a fundo a Garagem do artefato com a v4 e o SDK (V2); trazer as frotas novas e o modo leve (V3), a API `danificaveis`,
  cor por semente e `DIMS`; condução arcade e semi-simulação (V4); `vehicles-test-area` (V5).
- ✅ T7.2 Vegetação: juntar Viveiro (V8), `rulesFor`, `vegetation-test-area`.
- ✅ T7.3 `game-urban`: ruas, calçadas, os 5 postes, bairro, quarteirão, relevo (C3), com veículos e plantas como provedores e a `urban-test-area`.
- ✅ T7.4 Câmera de ombro do jogo no `game-camera` (V7). (T7.0 a T7.5 entregues no ramo `int/p7`; prova em `evidence.md`, Fase 7.)

## Fase 8 — Multidão, histórias e jogador
> 🤖 Modelo: `sonnet` (T8.2 é 🧠 → `opus`)

- T8.1 `game-crowd` (P12): horda, civis, manada, revoada, ligada ao `game-infection`.
- T8.2 🧠 Gerador de histórias e ficha de personagem (P9, P13): papéis, nomes sorteados, histórias que se cruzam, ficha que acumula
  decisões e histórias.
- T8.3 `game-player` (V6): fôlego, ferida, infecção individual, agarrão.

Desenho: `design/T8-multidao-historias-jogador.md`. Subtarefas, nesta ordem:

| # | Commit | Modelo |
|---|---|---|
| T8.0 | desenho, tasks e evidência | `opus` |
| T8.3 | `game-player` (núcleo, `defaults.json` com fontes, golden vm, módulo de teste, `examples/player-test-area`) | `sonnet` |
| T8.1a | `game-crowd` núcleo (horda SoA do jogo: grade, portas, flow, spawn, update, alertas, ataque, dano, corpos, população, habilidades) e golden | `sonnet` |
| T8.1b | civis, manada, revoada, `bindInfection`; `undeadCrowdTypes()` no `game-characters-undead`; goldens | `sonnet` |
| T8.1c | `game-crowd-three` (renderizador instanciado, módulo de teste), `examples/crowd-test-area` | `sonnet` |
| T8.2 🧠 | `game-stories` (elenco por sorteio, histórias como dados, crônica, ficha, simulação da vida); nomes e regras da ficha no `game-characters-people`; `game-slice/stories/`; golden; `examples/stories-test-area` | `opus` |

## Fase 9 — Gerador único de 3D (`game-shapes`) e desempenho
> 🤖 Modelo: `opus`

Desenho: `design/T9-game-shapes-e-desempenho.md` (inventário dos construtores, esquema, buffers, cache, workers, regra de migração e plano de
desempenho). Pedido do dono (2026-10-24): o 3D de tudo sai de um SDK que aceita JSON e vira a forma, e os outros SDKs o usam.

| # | Commit | Estado |
|---|---|---|
| T9.0 | desenho e inventário | feito |
| T9a | `game-shapes`: esquema JSON, geradores portados do three r160 (bit a bit), buffers por material, peças, pontos, LOD, instâncias | feito |
| T9b | `game-shapes-three`: geometria com a classe do three, `shapeGeometries(THREE)`, `toObject3D`, `mergeByMaterial` | feito |
| T9c | `tools/shapes-bench` e o job `shapes-bench` do CI (teto de regressão) | feito |
| T9d | pool de workers e cache por chave | feito |
| T9e | goldens exatos e as primeiras migrações: `game-props3d` (`createShapeRecorder`, `mergeByMaterial` vindo do `game-shapes-three`), `game-interactables-three` (`createMeshApi`), `game-items-three` (kit `T`, `mergeItem`) | feito |
| T9f | goldens exatos e migração de `game-weapons-three` (modelos, acessórios, cartuchos, props), `game-animals-three`, `game-characters-three`; `game-crowd-three` não tem geometria própria (herda a dos personagens) | feito |
| T9g | vegetation, urban, floorplan, vehicles (esperam a pergunta 3 do §11, r128) | a fazer |

Inventário da migração (o que entrou e onde): T9 §7.4.

## Gates de cada task

`pnpm build`, `pnpm -r typecheck`, testes do pacote (goldens incluídos), `pnpm lint`, skill do pacote atualizada em
`.claude/skills/<pacote>/SKILL.md`, commit isolado por task, evidência em `evidence.md`. PR por fase, aberto ao fim da fase e mostrado no
Chrome do dono; merge só com o ok dele.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/001-migracao-entregas-dos-times/ do repositório adatechnology-game-kit
(leia CLAUDE.md, spec.md, consolidado.md, fontes.md e tasks.md antes de começar; os inventários em inventario/ e as fontes em
artefatos/ e sources/ são a referência de cada porte). Uma fase por vez, na ordem do tasks.md, começando pela Fase 0 e Fase 1.
Regra principal: portar o que os times fizeram, igual ao original (semente fixa, sequência de eventos e hash), nunca reescrever parecido.
Modelos: tasks normais → executor model=sonnet · tasks 🧠 (T0.2, T1.1, T2.1, T4.1, T8.2) → opus, validadas por architect antes de
implementar · revisão de cada fase → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm build + typecheck + testes (goldens) + lint + skill do pacote atualizada + commit isolado, evidência em evidence.md.
Ao fim de cada fase: abrir o PR, mostrar no Chrome do dono (o do Arch) e parar até o ok.
Pare e pergunte antes de: merge, deploy, publicar pacote no npm, qualquer escolha de negócio que o consolidado não cubra.
```
