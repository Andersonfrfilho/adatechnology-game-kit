# Tasks — Spec 007

Base: `feat/structural-masonry-review` @ `6b622409`. WIP do validador em `wip/structural-integrity-checks` (`3f64861c`, vermelho).
Cada task: typecheck, testes do pacote, commit isolado, evidência em `evidence.md`. Toda mudança passa pelo agente
`engenheiro-estrutural` antes do PR (`CLAUDE.md` §11). Varredura: `node specs/007-integridade-estrutural/tools/sweep.mjs` (após `pnpm build`).

## Fase 0 — Base e rede de segurança
> 🤖 Modelo: `haiku` (T0.2 → `sonnet`)

- T0.1 Criar a branch de trabalho a partir de `feat/structural-masonry-review`, trazer o WIP (`git checkout wip/structural-integrity-checks --
  packages/game-floorplan-structure/src`), `pnpm build` e rodar a varredura: o resultado tem de bater com 3.406 violações. Gravar a linha de base
  em `evidence.md`. Aceite: contagem por código igual à tabela do `spec.md`.
- T0.2 Um teste de validador por código novo (`PILLARS_OVERLAPPING`, `PILLAR_OUTSIDE_FOOTPRINT`, `PILLAR_PROTRUDING`, `WALL_PILLAR`,
  `SLAB_ON_SINGLE_PILLAR`, `SLABS_OVERLAPPING`, `SLAB_CANTILEVER`, `SUPPORT_WITHOUT_CONTACT` com folga de 5 cm): um caso que falha e um que
  passa, montados à mão. Aceite: `pnpm --filter @adatechnology/game-floorplan-structure test` verde só com esses testes novos.

## Fase 1 — Regressões dos apoios
> 🤖 Modelo: `sonnet`

- T1.1 `high_end_contemporary {floors:1}`: caibros e beirais com apoio próprio (viga de beiral); 0 de `SUPPORT_WITHOUT_CONTACT` e de `OVERLAPPING_PARTS`
  (24 hoje). Aceite: varredura desse modelo em zero nesses códigos.
- T1.2 `a_frame_chalet`: vergas apoiadas onde há parede (muretas mais baixas que a verga). Aceite: 0 vergas flutuando.
- T1.3 `single_storey_structural`: caibros declarados sobre a laje de forro 0,20 m abaixo passam a apoiar na viga ou no topo da parede;
  trata também `MASONRY_OVERSTRESSED` (3). Aceite: 0 caibros flutuando e 0 `MASONRY_OVERSTRESSED`.
- T1.4 `wood_frame_house` semente 1: `slab_ceiling` não pode apoiar em `porch_footing` 2,4 m abaixo; apoiar na estrutura da casa.
  Aceite: sem `SUPPORT_WITHOUT_CONTACT` nesse caso, e `foundation_raft` × `porch_floor` (rural) sem `SLABS_OVERLAPPING`.

## Fase 2 — Pilares
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 → `opus`)

- T2.1 🧠 Desenho: campo de classe de concreto (C30 a C40) na peça estrutural, lido por `pillarDesign`, e a regra de crescimento
  (só em volume livre dentro do contorno, sem sobrepor, h ≤ 5b, ≤ 10 cm para fora; senão classe maior; senão pilar extra). Escrever a decisão em
  `design/T2.1-pilares.md` e validar com `architect` antes de T2.2.
- T2.2 Implementar em `pillar-design.ts` conforme T2.1. Aceite: 0 de `PILLARS_OVERLAPPING`, `PILLAR_PROTRUDING` e `WALL_PILLAR` em
  `residential_tower` e `office_tower`; pilares de canto dentro do contorno (`PILLAR_OUTSIDE_FOOTPRINT` das torres, 2144 → 0).
- T2.3 Corrigir o que restar de `PILLAR_OUTSIDE_FOOTPRINT`, `PILLAR_PROTRUDING`, `PILLARS_OVERLAPPING` e `WALL_PILLAR` nas demais tipologias.
  Aceite: esses quatro códigos em zero em toda a varredura.
- T2.4 `slab-panels/apply.ts` reaproveita a coluna existente em vez de criar pilar novo. Aceite: sem pilar duplicado no modelo de painéis; testes verdes.

## Fase 3 — Sacadas e lajes
> 🤖 Modelo: `sonnet` (T3.1 é 🧠 → `opus`)

- T3.1 🧠 Desenho: sacada com vigas de 2 ou mais apoios ou balanço curto e espesso (≤ 1,5 m e laje ≥ balanço/10), sem sobrepor a laje do andar, igual
  nos modelos de planta e de painéis. Decisão em `design/T3.1-sacadas.md`, validada com `architect`.
- T3.2 Implementar em `balconies.ts` conforme T3.1: `high_end_contemporary` (`slab_1_balcony_upper`, hoje 3,5 a 4,6 m de balanço e sobreposta a
  `slab_1`) e `apartment_modern` (`slab_0_veranda`, pilar único 20×20, λ 95). Aceite: `SLAB_CANTILEVER`, `SLABS_OVERLAPPING` e `SLAB_ON_SINGLE_PILLAR` em zero.
- T3.3 Confirmar que `SLAB_UNDERSIZED` sem a isenção de "laje sobre laje" dá zero em toda a varredura; o que aparecer se corrige na causa.

## Fase 4 — Fechamento
> 🤖 Modelo: `haiku` (T4.2 → `sonnet`)

- T4.1 Rebasear na `main` (depois do merge da `release/casa-a-pa-2026-11-13`), `pnpm build`, regenerar goldens afetados só com a geometria aprovada.
  Aceite: build e typecheck verdes; testes verdes exceto as falhas de base abaixo.
- T4.2 Varredura completa em zero (todos os códigos) + 8ª revisão do agente `engenheiro-estrutural` aprovando. Registrar em `evidence.md`.
- T4.3 Print na sala 4281 (`?area=floorplan_area&arena=40&template=single_storey_structural&seed=1`, níveis 0 a 8), um print por nível,
  guardado em `specs/007-integridade-estrutural/shots/`. Rodada de GPU/navegador roda na mão, não no CI.

Falhas de base conhecidas (não são desta spec): testes de explosão (blast) de `tower` e `skyscraper` em `game-floorplan-structure`.

## Gates de cada task

`pnpm build`, `pnpm -r typecheck`, testes do pacote `game-floorplan-structure` (e `construction.test.ts` das tipologias tocadas), `pnpm lint`,
skill `.claude/skills/game-floorplan-structure/SKILL.md` atualizada quando o contrato público mudar, commit isolado por task, evidência em
`evidence.md`. PR aberto só ao fim e mostrado no Chrome do dono; merge só com o ok dele.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/007-integridade-estrutural/ do repositório adatechnology-game-kit (leia CLAUDE.md §11, spec.md,
plan.md e tasks.md antes de começar). Base: branch feat/structural-masonry-review @ 6b622409; o validador em andamento está em
wip/structural-integrity-checks (3f64861c, vermelho): traga-o na T0.1. Crie um worktree próprio para a sessão. Uma task por vez, na ordem do tasks.md.
Modelos: Fase 0 T0.1 → executor model=haiku · T0.2, Fases 1, 2 e 3 → executor model=sonnet · T2.1 e T3.1 🧠 → opus (validar com architect antes de
implementar) · Fase 4 → executor model=haiku (T4.2 sonnet) · revisão final → code-reviewer model=sonnet, além do agente engenheiro-estrutural.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm build + typecheck + testes do game-floorplan-structure + lint + commit isolado, evidência em evidence.md, e a varredura
(specs/007-integridade-estrutural/tools/sweep.mjs) comparada com a tabela do spec.md. Nunca desligar regra, afrouxar limite nem tirar teste:
corrigir a causa no construtor da estrutura. Falhas de base (blast de tower e skyscraper) ficam fora.
Pare e pergunte antes de: push, PR, merge, deploy, mudar o contrato público de pacote sem a decisão 🧠 registrada, qualquer [NEEDS CLARIFICATION].
```
