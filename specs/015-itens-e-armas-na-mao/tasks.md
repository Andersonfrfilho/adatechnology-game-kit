# Tasks — Spec 015

Leia `spec.md` e `plan.md`. Arma na mão e animação só fecham com print nas duas câmeras, uma arma por família (§5).

## Fase 0 — Referência
> 🤖 Modelo: `sonnet`

- T0.1 Prints de referência: uma arma por família em primeira e terceira pessoa (parado, andando, mira alta, reta, baixa); 10 itens
  de formas diferentes na mão; golpe de cada arma branca hoje.
- T0.2 Medir no estado atual a distância da palma ao item e a travessia de dedos; números em `evidence.md`.

## Fase 1 — Pega
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 → `opus`; T1.4 → `haiku`)

- T1.1 🧠 Tipo `Grip` no `game-contracts` e em `ItemDef`; regra por forma; contrato de animação de item ampliado. Validar com `architect`.
- T1.2 `game-items`: `grip-rules.ts` com testes; `game-items-three`: âncora da pega no modelo.
- T1.3 Sala: item na mão pela pega, nas duas câmeras; sai o deslocamento fixo e o ramo de centro de caixa. Teste de pega (critério 2).
- T1.4 `game-items-goods`: pega declarada nos itens de mão mais usados e nas 31 armas de item (dados), seguindo o padrão da T1.2.

## Fase 2 — Golpes
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 → `opus`; T2.4 → `haiku`)

- T2.1 🧠 Famílias de golpe, formato do quadro de impacto e como o clipe move corpo e ferramenta juntos.
- T2.2 `game-characters-people`: clipes das 8 famílias, com antecipação e acompanhamento.
- T2.3 `game-weapons-three`: `tool-motion` por família; dano e som no quadro de impacto. Testes (critério 3).
- T2.4 `melee-families.json`: cada arma branca do arsenal apontada para uma família (dados).

> Parcial em 2026-11-27 (pedido do dono na sala 4280): 3 famílias ligadas na sala (`short_blade` corte + estocada, `one_hand_swing`, `two_hand_swing` com o giro da pá), clipes `knife_slash`/`knife_stab` e movimentos em `FAMILY_MOTIONS`. Faltam as outras famílias de R3 (golpe de cima de duas mãos, lança, motosserra) e a T2.1 com `opus`.

## Fase 3 — Mão ↔ mundo
> 🤖 Modelo: `sonnet`

- T3.1 Pegar: alcançar por IK do chão, de mesa e de prateleira; o objeto muda de pai, sem reconstruir.
- T3.2 Guardar e sacar por local (cintura, costas, mochila); largar e arremessar com o braço, com a velocidade da mão.
- T3.3 Uso por categoria (R5), com o contrato de animação de item.

> Parcial em 2026-11-27: comer com a mão, beber sem líquido, remédio, curativo e higiene (`HAND_USES` de game-items, `ModuleItemUse` no contrato, `goodsItemUse`), na tecla F da sala. Faltam lanterna, isqueiro/fósforo, rádio e chave.

## Fase 4 — Armas de fogo
> 🤖 Modelo: `sonnet`

- T4.1 Clipes por família para as 48 armas fora da Galeria; mão no ferrolho e no carregador. Teste (critério 4).
- T4.2 Arco e besta: corda, flecha na corda, armar.
- T4.3 `fx/hold.ts`: um posicionamento para as duas câmeras; mira nas duas. Fecha a R6 da spec 004. Prints por família.

## Fase 5 — Leitura e soltos
> 🤖 Modelo: `sonnet`

- T5.1 Materiais por classe compartilhados (R9 e R11); medição de chamadas contra `budgets.ts`.
- T5.2 Rótulos em canvas nos itens com marca ou texto; liberação de textura (§8).
- T5.3 Cápsula e carregador como corpos do `game-physics`, com orçamento e tempo de vida.

## Fase 6 — Fechamento
> 🤖 Modelo: `haiku` (T6.2 → `sonnet`)

- T6.1 READMEs e skills `kit-objetos-itens` e `kit-armas` com os números atuais (248 de 330; como `place()` funciona de fato);
  lista das armas e itens ainda sem modelo em `docs/pecas-fora-do-sdk.md`.
- T6.2 Revisão (`code-reviewer`) e prints finais lado a lado com a T0.1.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/015-itens-e-armas-na-mao/ (leia spec.md, plan.md e tasks.md
antes de começar). Uma task por vez, na ordem do tasks.md.
Modelos: Fases 0, 3, 4 e 5 → executor model=sonnet · Fase 1 → executor model=sonnet, T1.1 🧠 → opus (validar com architect),
T1.4 → haiku · Fase 2 → executor model=sonnet, T2.1 🧠 → opus, T2.4 → haiku · Fase 6 → executor model=haiku,
revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit + commit isolado, evidência em evidence.md.
Print em primeira e terceira pessoa, uma arma por família (§5); testes de navegador só à mão, nunca no CI.
Pare e pergunte antes de: modelar qualquer arma ou item que hoje é caixa ou forma simples (decisão do dono, §1),
a Fase 2 se as camadas da spec 013 não estiverem na main, mudar o momento do dano fora do previsto na T2.3.
```
