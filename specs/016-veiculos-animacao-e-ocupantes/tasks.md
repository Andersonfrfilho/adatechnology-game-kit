# Tasks — Spec 016

Leia `spec.md` e `plan.md`. Regra §7: teste de aceitação na frota inteira a cada categoria. Geometria nova passa pelo `revisor-z-fighting`.

## Fase 0 — Referência
> 🤖 Modelo: `sonnet`

- T0.1 Prints e vídeo curto por categoria no estado atual (aberturas, curva, freada, cabine), em `examples/vehicles-test-area/shots`.
- T0.2 Tabela por modelo: partes que existem, partes animadas, partes que faltam (script sobre o `dist`); em `evidence.md`.

## Fase 1 — Parte móvel como dado
> 🤖 Modelo: `opus` (T1.1 é 🧠)

- T1.1 🧠 Tipo `MovingPart` e contrato do tocador no `game-contracts`; de onde vêm as curvas; como o construtor grava as partes.
  Validar com `architect`.
- T1.2 `game-vehicles`: construtores gravam `MovingPart`; `clips.ts` gerado delas, com os mesmos valores de hoje (golden igual).
- T1.3 `game-vehicles-three`: tocador único com curva; portas, capô, tampa, vidro, teto e limpador passam por ele. Testes.

## Fase 2 — Rodas e suspensão
> 🤖 Modelo: `sonnet` (T2.2 é 🧠 → `opus`)

- T2.1 `wheel-roll` em toda área e modo (pista de batida incluída). Teste de roda (critério 2).
- T2.2 🧠 `suspension.ts`: carroceria sobre as rodas, curso por roda; `pitch` e `roll` visuais no arcade.
- T2.3 Moto: garfo e guidão, inclinação, descanso. Prints.

## Fase 3 — Aberturas e comandos na frota
> 🤖 Modelo: `sonnet` (T3.1 e T3.2 → `haiku` depois do primeiro modelo de cada categoria)

- T3.1 Carros e picapes: ângulo e duração por porta e tampa; limpador em todos. Teste de frota parcial.
- T3.2 Caminhões, ônibus, vans e militares: portas, basculante, rampa, guincho.
- T3.3 Barcos, aviões e helicópteros: portas, trem de pouso, rotor e hélice pelo motor (disco borrado), esteira pela velocidade.
- T3.4 Volante, manche, pedais e alavanca como partes móveis ligadas aos comandos.
- T3.5 Teste de frota completo (critério 1) e aceitação (§7).

## Fase 4 — Ocupantes
> 🤖 Modelo: `sonnet` (T4.1 é 🧠 → `opus`; depende da spec 012)

- T4.1 🧠 Injeção do corpo no `game-vehicles-three` sem quebrar `check:layers`; pose sentada paramétrica (pedido ao `game-characters-three`).
- T4.2 `occupants.ts`: corpo por assento, pose pelo `SeatSpace`, mãos no volante ou guidão por IK, cabeça virando.
- T4.3 Teste de ocupante (critério 3): 3 corpos × frota.

## Fase 5 — Entrar e sair
> 🤖 Modelo: `sonnet` (depende da spec 013)

- T5.1 Clipes de entrar e sair por tipo de veículo no `game-characters-people`; sequência em `enter-exit.ts`.
- T5.2 Porta bloqueada, lado do passageiro, recusa por `fits` com o motivo mostrado.
- T5.3 Ejeção em batida pelo ragdoll. Prints e vídeo.

## Fase 6 — Dano e rastro
> 🤖 Modelo: `sonnet`

- T6.1 Dano com progresso no tempo; peça solta com velocidade; luz ligada à peça.
- T6.2 `trail.ts`: marca de pneu, poeira e respingo por tipo de chão; escapamento no ponto do modelo. Orçamento de efeitos do host.

## Fase 7 — Custo e pintura
> 🤖 Modelo: `sonnet` (T7.1 é 🧠 → `opus`)

- T7.1 🧠 Estratégia de fusão por material preservando partes móveis e zonas de dano; nível intermediário gerado.
- T7.2 Implementação, transição de LOD, `perf-gate` (critério 6), aceitação da frota.
- T7.3 Pintura com verniz, sujeira e desgaste; reflexo de ambiente; cabine legível.

## Fase 8 — Fechamento
> 🤖 Modelo: `haiku` (T8.2 → `sonnet`)

- T8.1 READMEs, skill `kit-veiculos` (a área de teste já existe), `docs/veiculos-verificacao.md`.
- T8.2 Revisão (`code-reviewer`) e prints finais lado a lado com a T0.1.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/016-veiculos-animacao-e-ocupantes/ (leia spec.md, plan.md e tasks.md
antes de começar). Uma task por vez, na ordem do tasks.md.
Modelos: Fase 0 → executor model=sonnet · Fase 1 → opus (T1.1 🧠, validar com architect) · Fases 2, 4, 5, 6 e 7 →
executor model=sonnet (T2.2, T4.1 e T7.1 🧠 → opus) · Fase 3 → executor model=sonnet, T3.1 e T3.2 → haiku depois do
primeiro modelo de cada categoria · Fase 8 → executor model=haiku, revisão final → code-reviewer model=sonnet.
A cada categoria: teste de aceitação da frota inteira (§7) e agente revisor-z-fighting nas peças novas.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit + commit isolado, evidência em evidence.md.
Testes de navegador e perf-gate só à mão (pnpm check:vehicles), nunca no CI.
Pare e pergunte antes de: a Fase 4 se a spec 012 não estiver na main, a Fase 5 se o grafo e o ragdoll da spec 013 não
estiverem na main, fundir qualquer malha que seja zona de dano, mudar medida externa de um modelo.
```
