# Casa de referência: mansão (seed 1)

A planta mais completa do SDK: `mansion` do `game-floorplan-residential`, 3 andares, laje, telhado cerâmico, escada, 22 janelas com grade, portas,
caixa d'água, botijão, 250 objetos do kit interativo (móveis, eletrodomésticos, tomadas, interruptores, luminárias), 921 peças no mundo de destruição.

Abre direto na sala de teste (4280): `sala-casas.html?area=floorplan_area&arena=40&template=mansion&seed=1` (também `&state=abandoned` ou `fortified`).
O endereço é lido pelo SDK (`floorplanAreaParams` do `game-floorplan-three/testing`).

Prints em `~/Documents/personal/adatechnology-game-kit-shots/casa-referencia/` (números em `criterios*.json` na mesma pasta). Rodada de 2026-11-08,
sala real no navegador com GPU (Intel ARL, ANGLE/OpenGL), primeira e terceira pessoa.

## Os 21 critérios

| # | Critério | Situação | O que foi medido |
|---|---|---|---|
| 1 | Material e massa | ok | 921 peças, todas com material do SDK (concreto, tijolo, aço, madeira, cerâmica, plástico, alumínio, vidro, cobre, MDF), 1.201 t. Corrigido: o caixilho pesava 182 kg (caixa cheia); agora 18 kg (perfis e peitoril), e a grade é peça de aço própria (51 kg). |
| 2 | Tiro por calibre | ok | Parede de tijolo rebocado: .22 e 9 mm alojam, 5,56 / .308 / .50 atravessam (furo de 8,6 / 11,7 / 19 mm). Pilar de 20 cm: 9 mm e 7,62x39 alojam, .50 atravessa. Janela: o vidro quebra no primeiro tiro e o próximo passa pelo vão. Porta de madeira: calibre 12 amassa e fura. **Corrigido**: a parede no spec não tinha o vão da janela e o tiro batia no tijolo invisível (ou na caixa do caixilho). |
| 3 | Soco, chute, faca | ok, com pendência | Soco e chute amassam e trincam o reboco, a marreta fratura. Pendência: a faca trinca a alvenaria (deveria só riscar o duro). |
| 4 | Explosão e fogo | ok | Granada no canto: 75 fraturas, caibros e vergas caem. Molotov na porta de MDF: 92 ignições, canos de PVC derretem e pingam, a porta é destruída. Pendência: caixilho de alumínio "derretendo" em 30 s de incêndio (alumínio funde a 660 °C; conferir a temperatura do fogo de cômodo). |
| 5 | Destruição no padrão da latinha | parcial | Furo no ponto exato, lascas e reboco soltando, vergalhão exposto no concreto (62 eventos `expose`). A casa não tem conteúdo que vaza além da caixa d'água e dos canos. |
| 6 | Pegar | não se aplica | A casa não se pega. Os móveis da casa são do kit interativo; o pegar deles é critério de cada móvel. |
| 7 | Usar | ok | Porta abre com E (`doors_open` 0 → 1, fica aberta). Sobe e desce os 3 andares pela bancada (andar 0 → 1 → 2). Pendência: subir a escada andando (só testado pela ação "subir"). |
| 8 | Entre outros objetos | pendente | Não medido nesta rodada (destroços entre si e com os móveis). |
| 9 | Personagem esbarrando | ok | Andando 3 s contra a parede, o jogador para a 0,3 m dela e não atravessa. Primeira e terceira pessoa (`09-dentro-camera-*.png`). |
| 10 | Ser empurrado | pendente | Empurrar os móveis da casa não foi medido nesta rodada. |
| 11 | Persistência | parcial | 149 peças caídas continuam no mapa 30 s depois do colapso; a poeira ainda está no ar aos 30 s e aparece como blocos cinza grandes (visual a revisar). |
| 12 | Animações com o item | não se aplica | A casa não é segurada. |
| 13 | Som | pendente | Não medido nesta rodada. |
| 14 | Peso e massa | ok | Caixilho corrigido. Na casa de madeira e na cabana (não na mansão) o telhado da varanda pesa 11 t: pendência em `plantas-validacao.md`. |
| 15 | Queda e gravidade | **falha** | O colapso de canto (4 granadas) derruba 149 peças e nada fica flutuando (0 falhas do invariante `broken_floating`). Mas **a mansão de 3 andares trinca a laje parada**, sem nenhum golpe (`slab_1_p21`, 61 t num painel de 10 cm; a sala mostra "rachando sob o peso"). Causa: pilares e paredes do andar de cima apoiados no meio do painel de laje. Contada em `game-floorplan-three/tests/helpers/at-rest-failing.ts`. |
| 16 | Água e líquidos | pendente | Não medido (a caixa d'água vaza pelo furo nos testes do pacote, não na sala). |
| 17 | Reação em cadeia | ok | O botijão explode no colapso (evento `explode`), o fogo passa para os canos e portas. |
| 18 | Desgaste visual | ok | Furos, amassados e trincas continuam na peça (11 furos contados depois da rodada). |
| 19 | Desempenho | **falha** | Parada: ~31 ms por passo. Depois de 4 granadas: 6-7 FPS, simulação de 76 a 137 ms por quadro (fragmentos 160, partículas 700-1.000). Nos prédios comerciais, 6 s de simulação depois de uma granada levam 20-36 s. |
| 20 | NPCs e zumbis | pendente | A área de casas não carrega horda nem civis. |
| 21 | Inventário | não se aplica | A casa não vai para o inventário. |

## Pendências abertas

1. **Andar de cima apoiado no meio da laje** (critério 15): `high_end_contemporary` de 3 andares desaba parada (303 t num painel), `mansion` de 3 andares
   trinca a laje. Tentado: apoiar pilar no pilar de baixo e parede na viga (`slab-panels/apply.ts`); os pilares do térreo passam a esfarelar porque o mundo
   põe a carga só no apoio mais próximo do chão. É a mesma área do trabalho de "dividir a carga da cinta com a alvenaria". Revertido.
2. **Desempenho depois de explosões** (critério 19).
3. Faca na alvenaria, alumínio derretendo cedo, poeira em blocos, subir a escada andando, som, empurrar móveis, NPCs.
