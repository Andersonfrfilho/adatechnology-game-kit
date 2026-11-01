# Spec 005 — Camadas cobradas, um dono do quadro e orçamentos únicos

Origem: a análise de arquitetura de 2026-10-31 ([`docs/arquitetura-plug-sdks.md`](../../docs/arquitetura-plug-sdks.md)) deu nota 6,5/10. O dono
pediu para levar a 10/10. Esta spec transforma os 20 problemas da análise em regras que a máquina cobra e em três peças que
faltam: um laço com fases, um dono para luzes, programas e pools, e um preset que liga o conteúdo padrão.

## Problema

As regras do `CLAUDE.md` (motor genérico, conteúdo em pacote à parte, three só em `-three`, SDKs que se compõem) não são cobradas
por nenhum teste, e por isso já se furaram em pelo menos 15 dependências. Três problemas aparecem nos travamentos das explosões
([`docs/desempenho-explosoes.md`](../../docs/desempenho-explosoes.md)): nenhum sistema é dono da ordem do quadro, do número de luzes nem dos pools da GPU.

## O que é 10/10 (critérios de aceite da spec inteira)

| # | Critério | Como se prova |
|---|---|---|
| A1 | Toda dependência entre pacotes respeita as camadas L0–L5 | `pnpm check:layers` (dependency-cruiser) em modo erro, zero violações fora da allowlist declarada |
| A2 | Nenhum núcleo usa three; nenhum núcleo ou adaptador importa pacote de conteúdo | regras `core-no-three`, `core-not-content` e `adapter-not-content` do A1 |
| A3 | Um `-three` de domínio só importa `game-shapes-three` e `game-render-three`, salvo composição declarada | regra `no-domain-adapter-to-adapter` do A1 |
| A4 | Código de área de teste e bancada fica fora do `.` de produção | regra `testing-only-from-testing` do A1; `grep -E "test-area\|bench" packages/*/src/index.ts` vazio |
| A5 | Catálogo sempre por instância (`createX({ packs, patch, remove })`): nenhum registro global mutável é a fonte; os globais são delegados `@deprecated` de `defaultX()`, e todo consumidor aceita a instância | teste "dois mundos na mesma página" em cada pacote que tinha registro global |
| A6 | Luz só pelo `LightBudget`; programas pré-aquecidos por registro; o número de luzes da cena nunca muda depois do boot | lint `no-runtime-light`; `perf.mjs` com 0 programas em todas as fases |
| A7 | Um agendador com fases é dono da ordem do quadro e do orçamento de tempo das filas adiadas | teste da ordem das fases no `game-runtime`; a sala roda por ele |
| A8 | `DestructibleImpl.part()` e `state()` têm custo cobrado | `checkDestructible` com teto por chamada; todos os `DestructibleImpl` do kit passam |
| A9 | Partícula só pelo `host.effects`; nenhum sistema de partículas paralelo | busca por limites próprios de partícula fora de `game-vfx` vazia |
| A10 | A sala de testes é um host: só contrato, runtime, render e áudio como dependências | `package.json` da sala; `wc -l packages/game-test-room/src/room.ts` < 1.200 |
| A11 | `game-vehicles` é só regra e dano | `grep -l "THREE\\." packages/game-vehicles/src` vazio; goldens da frota iguais |
| A12 | Versões e publicação corretas | `pnpm check:packages` (three peer `^0.160.0`, deps internas `workspace:^`, `publint`, `attw`) |
| A13 | Nada quebra para o jogo | toda API trocada fica como `@deprecated` até a próxima major; `examples/*/test.mjs` e o ZombiAdA compilam |
| A14 | Sem travamento nas explosões | `examples/test-room/perf.mjs` passa em `PERF_MODE=gpu` e no CI |
| A15 | Horda densa com contato constante e reação em cadeia de explosões e de corpos, estável e sem travar | testes de estabilidade e determinísticos da T4b.2 e da T4b.6; fases `dense_horde` e `chain_horde` do `perf.mjs` dentro dos orçamentos, com quedas em cadeia > 0 |
| A16 | A horda não é repetitiva, nem perto nem longe, e a economia não cria clones | teste de variedade da T4b.9 (assinaturas, fase da animação, identidade igual em todo LOD) e prints perto e longe |
| A17 | Roda nas máquinas-alvo | `dense_horde` e `chain_horde` dentro do orçamento com 1.000 zumbis na Intel integrada e 2.000 na RTX (D12) |

## Fora do escopo

- Trocar three.js de versão. Só se fecha a faixa em `^0.160.0`.
- Reescrever conteúdo dos times. Só muda por onde ele entra.
- Mudar o comportamento de qualquer simulação que já existe. Toda mudança fora da Fase 4b é estrutural, e os goldens ficam iguais.
  A Fase 4b é a exceção: ela acrescenta um comportamento novo (contato, quedas, monte e reação em cadeia) atrás de uma opção, e os
  goldens de hoje continuam valendo com ela desligada.
