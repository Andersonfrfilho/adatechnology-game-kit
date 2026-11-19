# Tasks — Spec 014

Leia `spec.md` e `plan.md`. Toda task de geometria: `revisor-z-fighting` antes do PR, print por câmera (§5), golden em commit próprio.

## Fase 0 — Catálogo e referência
> 🤖 Modelo: `sonnet`

- T0.1 Catálogo de poses (R2) e de casos (R11) em `tests/catalog-cases.ts`; os casos novos entram já no teste de z-fighting.
- T0.2 Prints de referência de cada tipo em cada pose, nas duas câmeras; medição de chamadas e triângulos por tipo e nível.

## Fase 1 — A costura de junta
> 🤖 Modelo: `opus` (T1.1 é 🧠)

- T1.1 🧠 Contrato de `jointPiece` (com segundo osso e peso reservados), estratégia de fusão por material e orçamento por nível.
  Validar com `architect`.
- T1.2 `rich/joint-piece.ts` (implementação `capsule`) e `rich/limb.ts`. Teste de junta (critério 1) sobre peças isoladas.

## Fase 2 — Juntas no corpo
> 🤖 Modelo: `sonnet`

- T2.1 Bestiário: ombro, cotovelo, quadril, joelho e pescoço por `jointPiece`. Desvio registrado, golden em commit próprio.
- T2.2 Retratos (sobrevivente) e avatar do jogador.
- T2.3 Corpo instanciado e assado: mesma junta, atributos de osso preservados.
- T2.4 Teste de junta em todo o catálogo (critério 1); prints.

## Fase 3 — Pé, pulso e mão
> 🤖 Modelo: `sonnet`

- T3.1 `rich/foot.ts` e tornozelo; pulso. Canais novos opcionais expostos ao `animator`.
- T3.2 `rich/hand.ts`: 5 dedos, 3 falanges; `hand-poses.json` com as 7 poses; função que aplica a pose.
- T3.3 Mão nova no Bestiário, no sobrevivente e no jogador; mão simples do nível médio para baixo.

## Fase 4 — Rosto
> 🤖 Modelo: `sonnet` (T4.1 é 🧠 → `opus`)

- T4.1 🧠 `rich/face.ts`: construtor único com parâmetros do sobrevivente e deformação por tipo de zumbi; canais de piscar, olhar e mandíbula.
- T4.2 Jogador e Bestiário usam o rosto único; desvio registrado; prints de perto.

## Fase 5 — Custo
> 🤖 Modelo: `sonnet`

- T5.1 Segmentos pela qualidade em todo construtor; três níveis com orçamento no dado.
- T5.2 Fusão por material (`rich/merge.ts`); teste de custo (critério 2); `leak.mjs`.
- T5.3 Assado dentro do orçamento; `perf-gate` na horda.

## Fase 6 — Multidão e leitura
> 🤖 Modelo: `sonnet`

- T6.1 Coto no instanciado; pontilhado na troca de LOD; impostor por variante.
- T6.2 Oclusão por vértice e sombra de contato no assado; materiais por classe; dobra de tecido procedural. Prints.

## Fase 7 — Itens de mão e fardas
> 🤖 Modelo: `sonnet` (T7.3 → `haiku`)

- T7.1 Itens de mão por injeção do `game-items-three`; `hand-items.ts` e `extras.ts` deixam de desenhar caixa. `kit-audit` e
  `docs/pecas-fora-do-sdk.md` atualizados.
- T7.2 Fardas e trajes em dado, um desenho por força e por traje.
- T7.3 Varredura do `kit-audit` e do `check:layers`; pendências removidas da allowlist.

## Fase 8 — Fechamento
> 🤖 Modelo: `haiku` (T8.2 → `sonnet`)

- T8.1 READMEs e skill `kit-pessoas-bichos`.
- T8.2 Revisão (`code-reviewer`) e prints finais lado a lado com a T0.2.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/014-corpo-do-personagem/ (leia spec.md, plan.md e tasks.md
antes de começar). Uma task por vez, na ordem do tasks.md.
Modelos: Fase 0 → executor model=sonnet · Fase 1 → opus (T1.1 🧠, validar com architect) · Fases 2, 3, 5, 6 e 7 →
executor model=sonnet (T7.3 → haiku) · Fase 4 → executor model=sonnet, T4.1 🧠 → opus · Fase 8 → executor model=haiku,
revisão final → code-reviewer model=sonnet.
Toda task de geometria passa pelo agente revisor-z-fighting antes do PR; golden sempre em commit próprio.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit + commit isolado, evidência em evidence.md.
Print nas duas câmeras em toda mudança visual (§5); testes de navegador só à mão, nunca no CI.
Pare e pergunte antes de: começar se a spec 012 fase 1 não estiver na main, trocar a implementação capsule por skinned,
qualquer mudança no porte que não esteja listada na spec.
```
