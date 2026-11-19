# Spec 011 — Cena de referência: o kit monta um mundo de jogo só pela API pública

Pedido do dono (2026-11-18): antes de ir para o ZombiAdA, o kit precisa estar pronto, e "pronto" se prova numa cena de jogo que usa **todos os
pacotes do SDK**, não na sala de testes. Esta é a primeira de três cenas; as outras duas estão como carta em [`cartas.md`](cartas.md).

## Decisões do dono (2026-11-18)

- **Gênero:** sobrevivência numa cidade pequena (saquear, barricar, horda enorme e variada), em 3D. Mecânicas do gênero sim; recriar um jogo
  existente (cidade, personagens, visual próprio) não. A identidade é a do ZombiAdA: cidade brasileira, laje, viela, rio.
- **Visual:** semirrealista nublado, pela imagem de referência do dono (`referencias/visual-alvo.png`): céu encoberto, luz difusa, corpos
  assentados no chão, cor fria e dessaturada, neblina na distância, horda em que ninguém se repete. Vira **preset** do kit (`look`), não regra.
- **Câmera:** terceira pessoa de ombro, como a imagem, e primeira pessoa. As duas já existem no `game-camera`.
- **Ordem:** intercalada com a spec 010 (ver `plan.md`).

## O recorte

Uns 400 × 250 m na divisa entre um centro e um bairro popular, cortada por um rio com uma ponte. O kit não conhece nomes de lugar (§2): aqui
são os tipos de bairro do `game-urban` (`downtown` e `working_class`); "Santa Aurora", "Centro" e "Vila Esperança" ficam no repositório do jogo.

| Faixa | O que tem |
|---|---|
| Borda do centro | Um quarteirão de sobrados com loja no térreo, um prédio de 6 a 8 andares, farmácia, mercado, delegacia, igreja; barricada policial abandonada com viatura e ambulância; rua com postes, semáforo, faixa e meio-fio; carros parados, um dirigível |
| Rio e ponte | Ponte de concreto destrutível, rio com correnteza, mata de margem, peixe e garça, uma margem de solo solto (cratera) |
| Bairro popular | Casas geminadas de laje (1 a 3 lajes, uma inacabada com vergalhão), um barraco, viela com escadaria externa, caixa-d'água, varal, bar; quintal com horta, galinheiro, galinha e cachorro |
| Mundo | 500 a 2.000 zumbis (corredor perto do centro, lento na vila), sobreviventes e policiais fardados, infecção por mordida, bilhetes com histórias nas casas, chuva e neblina, dia e noite, armas e explosivos, áudio por material e distância |

## Cenários (`?cena=`)

| Cenário | O que mede |
|---|---|
| `tipico` | 500 zumbis, de dia, nublado, sem explosão: o quadro em repouso que o jogo tem quase sempre |
| `pior` | 2.000 zumbis, chuva à noite, uma C4 na ponte e uma granada na delegacia no mesmo segundo, jogador correndo com a horda atrás: a meta de "nenhum travamento" |

## Critérios de aceite

| # | Critério | Como se prova |
|---|---|---|
| R1 | Um jogo monta um mundo inteiro por uma API pública do SDK, sem copiar a sala | `createKitWorld` (nome final na T1.1) no `game-kit-defaults`; a cena não importa `game-test-room`, `test-area` nem `bench` (regra de camada nova no `check:layers`) |
| R2 | A cena usa todo pacote do SDK, exceto `game-test-room` e `game-vehicles-proving`, na densidade que o lugar teria | teste sem GPU no CI: a lista de pacotes instanciados na montagem é igual à lista de `packages/` menos as duas exceções |
| R3 | Toda peça da tabela do recorte vem do pacote dono do SDK; nada desenhado à mão na cena (§1) | `kit_audit` na página da cena sem peça de origem `scene`/desconhecida |
| R4 | Os dois cenários abrem e rodam pelo `pnpm check:district`, com prints em 3ª e 1ª pessoa | `examples/reference-district/shots/` |
| R5 | A cena é a segunda régua da spec 010: tabela por módulo nos dois cenários, gravada | `evidence.md` |
| R6 | Visual perto da referência no mesmo enquadramento (rua, horda vindo de frente, câmera no ombro) | print `shots/visual-alvo.png` ao lado de `referencias/visual-alvo.png`; veredito visual registrado por fase |
| R7 | Sem travamento: no `pior`, 0 quadros acima de 33,4 ms na RTX e na Intel integrada (com o tuner ligado); uma rodada em AMD antes de fechar | `evidence.md` com o JSON |
| R8 | Peças novas passam pelas regras do pacote dono: 21 critérios de física (§6), z-fighting (§13), estrutura (§11) para ponte e prédio, objetos quebrados (§12), memória (§8) | testes do pacote dono e os agentes `engenheiro-estrutural` e `revisor-z-fighting` |

## Fora do escopo

- **Personagens com roupa texturizada** (atlas de roupa, sujeira e sangue). É arte, o item mais caro do visual; spec própria depois desta.
  Aqui os personagens são os que o kit tem.
- O jogo ZombiAdA e os nomes de lugar.
- As cenas 2 (centro inteiro) e 3 (bairro popular inteiro): só a carta.
