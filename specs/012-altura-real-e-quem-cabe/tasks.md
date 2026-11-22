# Tasks — Spec 012

Leia `spec.md` e `plan.md`. Uma task por vez, na ordem. Toda mudança de geometria passa pelo agente `revisor-z-fighting` antes do PR.
Testes de navegador nunca no CI (§9): `pnpm check:<área>` à mão, prints em `evidence.md`.

## Fase 0 — Medir e desenhar
> 🤖 Modelo: `opus` (T0.2 é 🧠)

- T0.1 Script em `tools/` que mede, sobre o `dist`: topo do crânio de cada tipo e variante (rico, instanciado, assado) e, na frota
  inteira, altura livre (5 raios), espaço de pernas, largura do assento e vão de cada porta. Saída em `evidence.md`.
- T0.2 🧠 Fechar os tipos de `game-contracts` (`BodyMeasures`, `SeatSpace`, `DoorOpening`, `FitResult`), onde mora `fits` e a tabela
  de cabine por categoria (R6). Validar com `architect` antes da fase 1.

## Fase 1 — A base mede o declarado
> 🤖 Modelo: `sonnet` (T1.4 → `haiku`)

- T1.1 `game-characters`: `heightMetres` por tipo em `body.json`, `heightFactor` e `assertHeight` com erro tipado. Testes.
- T1.2 `game-characters-three`: normalização no `best-builder` e no `person-builder`; `rich/deviations.ts` com o desvio. Teste R1
  (topo do crânio ± 1 cm em todo tipo e variante).
- T1.3 Corpo instanciado e assado na mesma medida; impostores regerados. Teste R1 para os três caminhos.
- T1.4 Regerar goldens afetados em commit isolado, com o fator anotado na mensagem e em `evidence.md`.

## Fase 2 — Altura em metros por pessoa
> 🤖 Modelo: `sonnet` (T2.5 → `haiku`)

- T2.1 `game-characters`: `bodyMeasures` (R4) com as razões no dado e a fonte citada. Testes.
- T2.2 `game-characters-people`: faixas por idade em metros; sorteio por seed devolve `heightMetres`.
- T2.3 `game-characters-three`: `avatar.ts` sem `HIP_HEIGHT`, `DOOR_SHOULDER` e `DOOR_ARM` fixos; olho, alcance e IK pelo rig da
  pessoa. Teste R3 varrendo 1,40 a 2,10 m; `footfall.test.ts` continua verde em cada altura.
- T2.4 `instanced/accessory.ts`, `game-player` (colisor), `game-camera` e `game-weapons-three`: tirar o que ainda for constante de 1,80 m.
- T2.5 Varredura: `rg` por `1\.8\b|0\.95\b|1\.64\b` nos pacotes de personagens; cada ocorrência vira dado ou é justificada em `evidence.md`.

## Fase 3 — O veículo sabe o espaço que tem
> 🤖 Modelo: `sonnet` (T3.1 é 🧠 → `opus`)

- T3.1 🧠 `game-vehicles`: `kit.seat` grava `SeatSpace` e a porta grava `DoorOpening`; assento em moto, quadriciclo e veículo aberto.
- T3.2 `game-vehicles-fleet`: corrigir a cabine dos carros (almofada e forro) até a tabela da R6. `revisor-z-fighting` e teste de
  aceitação da frota (§7).
- T3.3 Caminhões, ônibus, vans, militares, barcos e aeronaves: dado por assento; cabine corrigida onde estiver abaixo da tabela.
- T3.4 Teste de frota (critério 3) e golden de espaço por modelo.

## Fase 4 — Quem cabe
> 🤖 Modelo: `sonnet`

- T4.1 `game-vehicles/src/fit.ts`: `fits` (R7). Testes unitários de cada motivo.
- T4.2 Matriz 3 corpos × frota em golden (critério 4).
- T4.3 `game-vehicles-three`: olho do motorista por `BodyMeasures`; cenário "quem cabe" na área de teste (R8).

## Fase 5 — Fechamento
> 🤖 Modelo: `haiku` (T5.2 → `sonnet`)

- T5.1 READMEs e referências das skills `kit-pessoas-bichos` e `kit-veiculos`; `CLAUDE.md` se mudar o mapa.
- T5.2 Revisão (`code-reviewer`) e prints do critério 5 (`pnpm check:vehicles`, `pnpm check:room`) em `evidence.md`.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/012-altura-real-e-quem-cabe/ (leia spec.md, plan.md e tasks.md
antes de começar). Uma task por vez, na ordem do tasks.md.
Modelos: Fase 0 → opus (T0.2 🧠, validar com architect) · Fases 1, 2 e 4 → executor model=sonnet (T1.4 e T2.5 → haiku) ·
Fase 3 → executor model=sonnet, T3.1 🧠 → opus · Fase 5 → executor model=haiku, revisão final → code-reviewer model=sonnet.
Geometria alterada passa pelo agente revisor-z-fighting antes do PR.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + commit isolado, evidência em evidence.md.
Testes de navegador só à mão (pnpm check:<área>), nunca no CI.
Pare e pergunte antes de: regerar golden fora do previsto na T1.4, mudar medida externa de veículo, qualquer dúvida de regra §1.
```
