# Spec 016 — Veículos: movimento visual, aberturas, ocupantes e custo

Origem: `docs/animacoes-e-modelos-melhorias.md` (seção 7), itens V1 e V3 a V16, V19. A cabine e a regra de caber (V2) são da spec 012.

## Por quê

A frota tem 69 modelos procedurais com dano por zona, luzes e painel. O movimento visual é o ponto fraco:

- **Carro vazio.** Nenhum pacote de veículos depende de `game-characters`: não há corpo, entrar, sair, mãos no volante nem pose
  sentada. O motorista é uma câmera (`game-vehicles-three/src/build.ts:131-143`); a ejeção põe um objeto a 1,2 m à frente (`proving/crash.ts:44-45`).
- **Sem suspensão visual.** A semi-simulação calcula altura, `pitch` e `roll` (`game-vehicles-driving/src/semi/types.ts:102-108`), mas
  a pose gira o grupo inteiro e fixa y = 0 (`proving/module.ts:356-357`): as rodas inclinam com a carroceria.
- **Na pista de batida a roda não gira** (`test-area/module.ts:377-380`); o giro casado com a velocidade só é usado no banco de
  provas. O arcade não tem `pitch` nem `roll` (`game-vehicles-driving/src/types.ts:15-25`).
- **38 de 69 modelos sem abertura animada:** todas as motos, 4 caminhões, 2 ônibus, 7 barcos, 7 aviões, 6 de 7 helicópteros. Só 14 carros têm limpador.
- **Aberturas sem suavização:** 2 chaves, 1,2 s, ângulo fixo de 1,15 rad para toda porta e tampa (`destructible/clips.ts:8-32`).
- **Peças paradas:** volante e manche não giram; não há pedais; esteira com `v: 0` (`wheels.ts:105`); rotor e hélice em velocidade
  constante (`helicopters-extra.ts:118, 146`); moto só esterça a roda da frente, sem inclinar (`wheel-roll.ts:46-47`).
- **Faltam por categoria:** trem de pouso, basculante, portas de ônibus, guincho, retrovisor.
- **Dano entra de uma vez** (`destructible/visual.ts:1305-1308`); sem marca de pneu, poeira ou respingo; escapamento de um ponto genérico.
- **Custo:** carro `high` com mediana de 198.892 triângulos e 362 chamadas; `lite` com 18.600; nada no meio; troca seca aos 14 m (`vehicle-lod.ts:12`).
- **Pintura sem verniz nem sujeira;** cabine escura; luzes sem peça de dano continuam acesas.

## Decisões do dono (2026-11-19)

- **D1** Quem não cabe não entra (regra binária com motivo, spec 012).
- **D2** Feito para **melhorar depois**: cada parte móvel é declarada em dado (eixo, curso, duração, curva) e tocada por um
  contrato de parte móvel; acrescentar uma parte ou refinar um movimento é editar o dado do modelo.

## Requisitos

- **R1 — Parte móvel como dado.** Porta, capô, tampa, vidro, teto solar, limpador, volante, pedal, alavanca, retrovisor, basculante,
  trem de pouso, rampa, guincho, rotor, hélice, esteira, guidão e descanso são "partes móveis" com eixo, curso, duração e curva
  declarados. Um tocador único as anima; nada de ângulo fixo no código.
- **R2 — Rodas e suspensão.** Em toda área e em todo modo, a roda gira pela distância e esterça; cada roda tem curso próprio sob a
  carroceria; a carroceria inclina em freada, arrancada e curva sobre as rodas, que ficam no chão. O arcade ganha `pitch` e `roll` visuais.
- **R3 — Moto.** Guidão e garfo esterçam juntos, a moto inclina na curva e tem descanso parada.
- **R4 — Rotor, hélice e esteira** seguem o motor e a velocidade: aceleram, param, e o rotor rápido vira disco borrado.
- **R5 — Aberturas na frota inteira.** Todo modelo com porta, tampa ou rampa tem a parte declarada e animada, com ângulo próprio e
  curva suave; limpador em todo veículo com para-brisa. Teste lista quem não tem e por quê.
- **R6 — Comandos visíveis.** Volante e manche giram com o esterço; pedais e alavanca existem e se movem; ponteiros já existem.
- **R7 — Ocupantes.** Corpo do `game-characters-three` sentado em cada assento ocupado, com pose pelo espaço do assento (joelho pelo
  espaço de pernas, tronco e cabeça pela altura livre), mãos no volante ou guidão por IK, cabeça virando. Só entra quem `fits` (spec 012).
- **R8 — Entrar e sair.** Sequência por lado e por tipo (carro, picape alta, caminhão com degrau, moto, ônibus): abrir a porta,
  entrar, sentar, fechar; o inverso ao sair; sair pela outra porta quando a do lado está bloqueada. Ejeção em batida passa o corpo
  ao ragdoll (spec 013).
- **R9 — Dano com transição.** Amassado, pneu murchando e trinca progridem no tempo; peça que solta sai com a velocidade do impacto.
  Luz sem peça apaga.
- **R10 — Rastro.** Marca de pneu em freada e derrapagem, poeira e respingo pelo tipo de chão (`game-terrain`), escapamento no
  ponto real do modelo, pelo `game-vfx` e dentro do orçamento de efeitos do host.
- **R11 — Custo.** Nível intermediário (cerca de 40 mil triângulos, até 40 chamadas) e troca com transição; `high` fundido por
  material fora das partes móveis: carro até 120 chamadas.
- **R12 — Pintura.** Verniz, sujeira e desgaste por parâmetro; reflexo de ambiente em toda pintura; cabine legível de dia.

## Fora do escopo

- Tipagem dos `[key: string]: any` do `game-vehicles` (§10): PR próprio, cerca de 2.600 erros a declarar.
- Dívida antiga de z-fighting da frota (4.190 pares): só diminui; peça nova desta spec entra com zero.
- Física de direção e novos modelos de veículo.

## Critérios de aceite

1. Teste de frota: todo modelo declara suas partes móveis; nenhum ângulo ou duração fixo no código (R1, R5).
2. Teste de roda: giro e esterço batem com distância e ângulo em todas as áreas e modos; roda no chão com a carroceria inclinada.
3. Teste de ocupante: 3 corpos (1,55, 1,80 e 2,05 m) × frota; quem `fits` senta sem atravessar teto, volante ou banco; quem não cabe é recusado com motivo.
4. Teste de aceitação da frota inteira (§7) verde; `revisor-z-fighting` sem achado nas peças novas.
5. Prints e vídeo curto por categoria (carro, picape, caminhão, ônibus, moto, trator, barco, avião, helicóptero, tanque): aberturas,
  curva, freada, entrar e sair, nas câmeras de perseguição e de cabine.
6. `perf-gate`: 20 carros na cena dentro do orçamento, com e sem ocupantes.
