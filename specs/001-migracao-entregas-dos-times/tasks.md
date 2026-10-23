# Tasks — Spec 001

Ordem pedida pelo dono: armas (já em andamento), casas, itens e assim por diante.

## Fase 0 — Fontes e arquitetura
> 🤖 Modelo: `opus` (🧠 decisões que todas as fases herdam)

- T0.1 Localizar os fontes originais dos times (ver pontos em aberto da spec). Sem eles, extrair o script de cada página para
  `specs/001-migracao-entregas-dos-times/sources/<página>.js` como referência de porte.
- T0.2 🧠 Decidir os pacotes novos e seus nomes: construção (Casa3DSDK + tipologias da Galeria do Vale), `game-items`,
  `game-characters`, `game-animals`, `game-vfx`, horda. Registrar no `plan.md`.
- T0.3 Definir o golden padrão: o que "igual ao original" mede por tipo de entrega (hash da cena montada, medidas, sequência de
  animação, eventos de dano), reaproveitando o formato de `game-vehicles-fleet`.

## Fase 1 — Armas (Galeria 3D do Arsenal + Arsenal)
> 🤖 Modelo: `sonnet`

- T1.1 Reconciliar a lista de armas da galeria (`WEAP`) e as munições (`AMMO`) com `game-weapons` (ids, calibres, capacidade,
  comprimento, cano, peso). O que falta entra nos dados.
- T1.2 Trocar os modelos de caixas de `game-weapons-three` pelos construtores da galeria (pistola, revólver, fuzil, bullpup, P90,
  espingarda basculante, M2, lança-foguetes, lança-chamas), com `fitLength` pelas medidas reais.
- T1.3 Munição: cartucho e estojo por calibre (`cartridge`, `casingMesh`, `caseType`), usados nas cápsulas ejetadas.
- T1.4 Comportamentos da galeria: tiro, clarão, coice, ferrolho, carga, rajada, **pane** (engasgo, estojo preso, destravar) e
  **recarga por tipo** (carregador, tubo, de cima, revólver, basculante, fita).
- T1.5 Explosivos da galeria no pacote certo (granadas, lança-foguetes, efeitos de fogo).
- T1.6 Goldens: cada arma monta e anima igual à galeria.
- T1.7 Ambiente `weapons-test-area` com os comportamentos novos (botões de pane e destravar) e a página do Arsenal do site montando
  a partir do SDK.

## Fase 2 — Casas (Casa3DSDK + Galeria do Vale Cinzento)
> 🤖 Modelo: `sonnet` (pacote decidido na T0.2)

- T2.1 Portar o Casa3DSDK (peças estruturais, plantas, dano estrutural) com goldens contra `visor-casas-3d` e `area-casas`.
- T2.2 Portar as tipologias da Galeria do Vale (sobrado, laje, colonial, chalé, vila operária, palafita, casa sede, prédios) e os
  interiores (casa, mercado, farmácia, delegacia, escola…) como conteúdo.
- T2.3 Mobília de cena, postes e padrão de ruas para `game-props3d` ou conteúdo.
- T2.4 `buildings-test-area` e áreas na página do kit.

## Fase 3 — Itens (Itens do Vale Cinzento)
> 🤖 Modelo: `sonnet`

- T3.1 Motor `game-items` (item, categoria, peso, uso, loot) + `-three` com os modelos da página.
- T3.2 Catálogo do ZombiAdA como pacote de conteúdo. Goldens.
- T3.3 `items-test-area`.

## Fase 4 — Zumbis e personagens (Bestiário, Elenco, Personagens, dano da Galeria do Arsenal)
> 🤖 Modelo: `sonnet` (T4.1 é 🧠: modelo de corpo herdado por sobreviventes e animais)

- T4.1 🧠 `game-characters`: corpo, juntas, andar por tipo, cortes, desmembramento, sangramento e dano por região.
- T4.2 Conteúdo dos zumbis do Bestiário e do Elenco. Goldens de andar e de corte.
- T4.3 `characters-test-area`.

## Fase 5 — Sobreviventes (Retratos e Os Vivos do Vale)
> 🤖 Modelo: `sonnet`

- T5.1 Conteúdo de sobreviventes e fardados sobre `game-characters`; rotinas de NPC.

## Fase 6 — Efeitos (Oficina de VFX, Laboratório de Explosões, Padrão de Fluidos)
> 🤖 Modelo: `sonnet`

- T6.1 `game-vfx` (+ `-three`): fogo, fumaça, sangue, faíscas, explosão em camadas, cratera. Goldens.
- T6.2 Conferir Padrão de Fluidos contra `game-fluids` e portar o que faltar.

## Fase 7 — Animais (Bichos do Vale)
> 🤖 Modelo: `sonnet`

- T7.1 `game-animals` (+ `-three`) com os bichos e habitats.

## Fase 8 — Mapa e horda
> 🤖 Modelo: `sonnet` (T8.2 🧠)

- T8.1 Dados de terreno e padrão urbano como conteúdo; Checklist do Mapa e Visor de plantas conferidos com o SDK.
- T8.2 🧠 Simulação de horda (Bancada de Hordas): pacote próprio ou parte de `game-infection`.

## Gates de cada task

`pnpm build`, `pnpm -r typecheck`, testes do pacote (goldens incluídos), `pnpm lint`, commit isolado por task, evidência em
`evidence.md`. Os goldens de `game-vehicles-fleet` já falham na `main` em 2026-10-23 (10 testes): não bloqueiam esta spec, mas
ficam registrados.

## Prompt de execução

Não gerado: a spec tem `[NEEDS CLARIFICATION]` aberto (fontes originais dos times e destino do Casa3DSDK). Responder os dois
pontos libera o prompt de autopilot.
