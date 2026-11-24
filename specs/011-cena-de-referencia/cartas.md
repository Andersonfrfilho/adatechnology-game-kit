# Cartas das cenas 2 e 3

Escopo e critérios decididos; **sem tasks de propósito**. A cena 1 vai mudar o kit (host do mundo, peças novas, números), e uma task escrita
hoje para estas apontaria para código que não existe mais. Cada carta vira spec completa numa sessão, quando a anterior fechar (T5.3 da 011).

## Cena 2 — Centro inteiro (prova de carga)

- **Recorte:** uns 600 × 600 m de `downtown` (e um trecho de `financial_district`), na mesma escala do jogo.
- **Prova:** o pior caso de desenho e de horda. Prédios de 4 a 12 andares com loja e uma ou duas torres altas, ruas estreitas e uma avenida
  com canteiro, praça, comércio de rua; horda corredora de 2.000 com barricadas policiais abandonadas e ambulâncias tombadas; rota pelos
  telhados (tábuas entre prédios, escada de incêndio).
- **Muda em relação à cena 1:** prédio alto destrutível perto do jogador, telhado como caminho, vista de rua comprida de ombro (o horizonte
  inteiro até a neblina), mais luz de rua à noite.
- **Critérios:** os da cena 1 (R1–R8) com o recorte novo; pior quadro no `pior` igual ou melhor que o da cena 1 na mesma máquina; as torres de
  20+ andares enteráveis até onde a T3.1 da 011 levar.
- **Lacunas já conhecidas:** escada de incêndio e tábua entre telhados, avenida com canteiro, torre do `game-urban` destrutível (hoje é só
  fachada).

## Cena 3 — Bairro popular inteiro (prova do caso típico, na escala do jogo)

- **Recorte:** uns 500 × 400 m de `working_class` em morro: casas de laje em vários níveis, vielas e escadarias, campinho, escola, igreja,
  bares, mercadinho; borda com mato e um córrego.
- **Prova:** o que o jogador vive a maior parte do tempo. Densidade alta de casas enteráveis (70%), labirinto vertical, horda média
  espalhada, sobreviventes, saque.
- **Muda em relação à cena 1:** terreno em encosta (casas em níveis, laje de uma no nível da rua de cima), quantidade de interiores e de
  itens de saque carregados ao mesmo tempo, 1ª pessoa dentro de casa apertada.
- **Critérios:** os da cena 1 com o recorte novo; tempo de carga da cena e memória sem crescer ao entrar e sair de 50 casas (`leak.mjs`).
- **Lacunas já conhecidas:** casa em encosta (lote com desnível), escadaria pública, escola e campinho no padrão do bairro.

## Depois das três

Personagens com roupa texturizada (spec própria, ver `spec.md` "Fora do escopo"); só então o ZombiAdA monta o Vale Cinzento sobre o
`createKitWorld`.
