# Plano — Spec 011

## Ordem com a spec 010

| Passo | O que | Depende de |
|---|---|---|
| 1 | Spec 010, Fase 0 (régua na sala) | — |
| 2 | Spec 011, Fases 1 e 2 (host do mundo e esqueleto da cena) | 010 T0.2 |
| 3 | Spec 010, Fases 1 a 3, medidas na sala **e** na cena | 011 Fase 2 |
| 4 | Spec 011, Fases 3 a 5 (peças que faltam, visual, fechamento) | 010 Fase 1 (o pós e as peças novas entram com o orçamento único) |

Duas frentes ao mesmo tempo, no máximo. Feature nova fora destas duas specs espera.

## Inventário (2026-11-18, leitura do código)

**Já existe e entra como está:** farmácia, mercado, delegacia, igreja (`game-floorplan-commercial`: `pharmacy`, `market`, `police_station`,
`church`); casa de laje 1 a 3 lajes com caixa-d'água e escada externa (`budget_slab_house`); sobrado (`townhouse`); barraco
(`game-floorplan-rural` `shack`); estados `fortified`/`abandoned` (`-post-apocalyptic`); ambulância e viatura (`ambulance`, `police_sedan`);
polícia (`military_police`, `civil_police`, equipamento `riot_police`); `barricade` e `sandbags` (`game-props3d`); postes, rua, calçada
(`game-urban`); zumbis `walker` e `runner` e mais 11 tipos; 12 profissões civis; infecção (`bindInfection`); chuva, neblina, dia e noite;
`glock_17`, `imbel_ia2`, `m67`, `molotov`, `c4`; áudio por material, distância e oclusão; direção arcade e semi; `dog`, `chicken`; salgueiro,
papiro, capim alto; varal; `garden_bed`.

**Falta (peça nova no pacote dono, Fase 3):**

| Peça | Dono provável (confirmar com `kit_owner`) | Observação |
|---|---|---|
| Host do mundo (`createKitWorld`) | `game-kit-defaults` | Fase 1; o que a sala faz à mão em `room.ts` 321–5583 |
| Oclusão de áudio no mundo | sai de `game-test-room/src/world-occlusion.ts` para o SDK | pré-requisito do host |
| Sobrado de uso misto (loja + moradia) | `game-floorplan-commercial` ou `-residential` | as zonas `zr3_zm`/`zc` já aceitam `mixed`, nenhum modelo usa |
| Prédio de 4 a 8 andares com planta e loja | `game-floorplan-residential` | as torres começam em 20 andares; o prédio do `game-urban` é só fachada |
| Ponte de concreto destrutível | `game-floorplan-structure` (estrutura) + `game-urban` (traçado) | §11: `engenheiro-estrutural` |
| Rio com correnteza | `game-terrain` (zona de água corrente, fluxo) + empuxo/arrasto | o `game-fluids` não é para rio |
| Mata de margem | `game-vegetation-species` (contexto `riverbank` na região `br`) | |
| Peixe e garça | `game-animals-species` | |
| Cone, cavalete, fita zebrada, semáforo, faixa, meio-fio | `game-urban` (rua) e `game-props3d` (soltos) | |
| Viela entre casas | `game-urban` (traçado além da grade) | |
| Bar/boteco | `game-floorplan-commercial` | tipologia e móveis |
| Galinheiro de quintal | `game-floorplan-residential` (catálogo) + builder no `game-floorplan-three` | hoje só dentro de `farm` |
| Vergalhão exposto na laje pronta | `game-floorplan-three` | o dado `slab.exposedRebar` existe, o 3D não desenha |
| História do `game-stories` num bilhete da casa | `game-stories` + `game-items-goods` (achados) | |
| Preset de visual `overcast` | `game-render-three` (luz, céu, tone mapping, gradação) + `game-graphics` (degrau sem pós) | Fase 4 |
| Pós-processamento (oclusão de ambiente, gradação) | `game-render-three` | Fase 4, com degraus no `tuner` |

## Decisões

- **D1. O host do mundo é do SDK, a sala vira cliente.** `createKitWorld(THREE, { renderer, canvas, ... })` devolve o mundo montado
  (destruição, terreno, fluidos, áudio, luzes, aquecimento, renderizador da destruição com física, efeitos, jogador, agendador com filas,
  workers, laço) e os pontos para o jogo pôr conteúdo. A cena usa só isso. A sala passa a usar na T1.5, que só tira linhas do `room.ts` (§15).
- **D2. O traçado é dado.** A cena é um JSON de recorte (ruas, quarteirões, lotes com tipologia e semente, rio, ponte, zonas de horda) mais um
  montador que chama os pacotes. Assim a carta 2 e a 3 são outros JSONs, e o teste de cobertura lê o JSON e a montagem sem GPU.
- **D3. Densidade realista.** Cada pacote aparece onde o lugar teria. Ninguém empilha conteúdo para "mostrar" um pacote.
- **D4. Prédio de longe é silhueta, de perto é planta.** Os quarteirões do `game-urban` desenham o horizonte; os lotes da faixa jogável são
  plantas do floorplan, enteráveis e destrutíveis. A troca é por distância, pelo LOD de casa que já existe (`planLod`).
- **D5. Teste como as outras áreas.** `examples/reference-district`, área `district` no `tools/check-area`, servida na 4280; cenário por `?cena=`,
  câmera por `?camera=third|first`; medição pelo `room-explosion`/`perf.mjs` apontado para a página da cena (variável nova `PERF_PAGE`).

## Riscos

- **O host vira um segundo `room.ts`.** Mitigação: limite de linhas por arquivo (200, padrão do repositório), cada ligação num arquivo, e a sala
  migrando para ele (T1.5) prova que serve.
- **Peças novas demais para uma spec.** São 14. Se a Fase 3 passar de 3 semanas, as peças da faixa não jogável (semáforo, garça, mata) saem
  para a carta 2 e a cena fecha com elas como silhueta.
- **O pós-processamento come a GPU integrada.** Mitigação: degrau "sem pós" no tuner antes de ligar, medido nos dois cenários.
