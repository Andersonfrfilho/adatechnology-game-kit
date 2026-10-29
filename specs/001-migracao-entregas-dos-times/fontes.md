# Fontes das entregas dos times

Levantado em 2026-10-23. Cada entrega existe em até quatro lugares; **a cópia local de cada artefato publicado está em `artefatos/`**
(baixada do endereço público do artefato, sem login). Os artefatos foram tornados públicos pelo dono em 2026-10-23.

| Lugar | O que é |
|---|---|
| Artefato no claude.ai (link abaixo) | Versão publicada pelo time. Carrega three.js de CDN. Cópia local em `artefatos/<id>.html` (e `artefatos/<id>/` quando tem vários arquivos) |
| Site no GitHub `Andersonfrfilho/zombiada`, `site/pages/` | Cópia offline publicada em zombiada.adatechnology.com.br. Na maioria igual ao artefato |
| `~/Downloads/zombiada-offline` (git, 26 commits) | Histórico das cópias offline até 22/10 23:12, com `ferramentas/atualizar.sh` (troca de versão a partir do artefato) |
| `sources/` desta spec | Só o código próprio de cada página do site, extraído para leitura |

Comparação feita só no código próprio (sem three.js e sem o runtime do artefato).

| Time | Entrega | Artefato | Cópia local | Página no site | Artefato × site | Observação |
|---|---|---|---|---|---|---|
| Jogo | Antes do Dia 1 | https://claude.ai/artifact/Mu3Xy7Lm9DXc1fJGNMrM3p | `artefatos/Mu3Xy7Lm9DXc1fJGNMrM3p.html` | `site/pages/jogo/antes-do-dia-1.html` | igual |  |
| Jogo | Bancada de Hordas | https://claude.ai/artifact/2iCyhJbt7jkEG3q13RzfnZ | `artefatos/2iCyhJbt7jkEG3q13RzfnZ.html` | `site/pages/jogo/bancada-de-hordas.html` | difere: artefato tem 689 linhas que o outro não tem, outro tem 0 (34K×0K) | revisar: o código do site está noutro formato (falso positivo provável) |
| Jogo | Bancada de móveis interativos | https://claude.ai/artifact/PnECnpTUc9dKYZodhvg8km | `artefatos/PnECnpTUc9dKYZodhvg8km.html` | `site/pages/jogo/bancada-moveis-interativos.html` | igual |  |
| Jogo | Cenários de teste | https://claude.ai/artifact/Y7KVx52yC6Rohc7xFWJNxU | `artefatos/Y7KVx52yC6Rohc7xFWJNxU.html` | `site/pages/jogo/cenarios-de-teste.html` | difere: artefato tem 14 linhas que o outro não tem, outro tem 14 (6K×812K) | artefato sem as imagens embutidas que o site tem |
| Jogo | Revisão final e fatia jogável | https://claude.ai/artifact/VcdTu9bhVwaF25mWhSHctg | `artefatos/VcdTu9bhVwaF25mWhSHctg.html` | `site/pages/jogo/revisao-final-fatia-jogavel.html` | difere: artefato tem 792 linhas que o outro não tem, outro tem 0 (25K×0K) | documento do Claude Docs; revisar a comparação |
| Jogo | Sala de testes de destruição | https://claude.ai/artifact/Rzi7WsQ9ivTnwUEFRFTLzZ | `artefatos/Rzi7WsQ9ivTnwUEFRFTLzZ.html` | `site/pages/sala-de-testes/sala-de-testes.html` | difere: artefato tem 175 linhas que o outro não tem, outro tem 175 (982K×975K) | 175 linhas diferentes |
| Jogo | Sala de testes: móveis e objetos | https://claude.ai/artifact/U4ygb8zHgtuJ7mi4MgN5Po | `artefatos/U4ygb8zHgtuJ7mi4MgN5Po.html` | `site/pages/sala-de-testes/area-moveis.html` | igual |  |
| Jogo | ZombiAdA Jardim Aurora | https://claude.ai/artifact/RLRHckn97FjHNDHM23DRvb | `artefatos/RLRHckn97FjHNDHM23DRvb.html` | `site/pages/jogo/zombiada-jardim-aurora.html` | difere: artefato tem 10537 linhas que o outro não tem, outro tem 0 (2802K×0K) | revisar: o código do site está noutro formato (falso positivo provável) |
| Jogo | ZombiAdA versão atual (modo livre e cenários) | https://claude.ai/artifact/2UG1Mhe9LqJkQKKVsJkTWR | `artefatos/2UG1Mhe9LqJkQKKVsJkTWR.html + `artefatos/2UG1Mhe9LqJkQKKVsJkTWR/`` | `site/pages/jogo/zombiada-modo-livre.html` | — | **3 versões**: artefato 6,3 MB, site 8,0 MB, downloads 4,6 MB |
| Mapa | Galeria do Vale Cinzento | https://claude.ai/artifact/AeuwWYcdRpcv86yW3nz3yi | `artefatos/AeuwWYcdRpcv86yW3nz3yi.html` | `site/pages/mapa/galeria-vale-cinzento.html` | igual |  |
| Mapa | Mapa do Vale Cinzento | https://claude.ai/artifact/FchNV6FWcWreFFHLnNkuAP | `artefatos/FchNV6FWcWreFFHLnNkuAP.html` | `site/pages/mapa/mapa-vale-cinzento.html` | igual |  |
| Zumbis e personagens | Bestiário | https://claude.ai/artifact/X1Q11t2w24GtE2MsyYy7wr | `artefatos/X1Q11t2w24GtE2MsyYy7wr.html` | `site/pages/zumbis-personagens/bestiario.html` | igual |  |
| Zumbis e personagens | Elenco | https://claude.ai/artifact/1N5SEWsaguU6pwm6PPHiKC | `artefatos/1N5SEWsaguU6pwm6PPHiKC.html` | `site/pages/zumbis-personagens/elenco.html` | igual |  |
| Zumbis e personagens | Personagens | https://claude.ai/artifact/B3xvaw4FLSCCtvHEf5nHCx | `artefatos/B3xvaw4FLSCCtvHEf5nHCx.html` | `site/pages/zumbis-personagens/personagens.html` | igual |  |
| Sobreviventes e facções | Os Vivos do Vale | https://claude.ai/artifact/AkFLNVrwUbtJjUVwMfKBuZ | `artefatos/AkFLNVrwUbtJjUVwMfKBuZ.html` | `site/pages/sobreviventes/os-vivos-do-vale.html` | igual |  |
| Sobreviventes e facções | Retratos do Vale | https://claude.ai/artifact/9djtWyfGQ5LrfwTRrL5XBd | `artefatos/9djtWyfGQ5LrfwTRrL5XBd.html` | `site/pages/sobreviventes/retratos-do-vale.html` | igual |  |
| Armas e itens | Arsenal | https://claude.ai/artifact/NNmzTbMKsE6nuThHKuXzWd | `artefatos/NNmzTbMKsE6nuThHKuXzWd.html` | `site/pages/armas-itens/arsenal.html` | igual |  |
| Armas e itens | Galeria 3D do Arsenal | https://claude.ai/artifact/C96Cxhb4bTA9bbojV4ctKH | `artefatos/C96Cxhb4bTA9bbojV4ctKH.html` | `site/pages/armas-itens/galeria-3d-arsenal.html` | difere: artefato tem 1 linhas que o outro não tem, outro tem 1 (116K×116K) | 1 linha (endereço do three.js, provável) |
| Armas e itens | Itens do Vale Cinzento | https://claude.ai/artifact/NKmkGZ2Lvcd96mp6Nyksds | `artefatos/NKmkGZ2Lvcd96mp6Nyksds.html` | `site/pages/armas-itens/itens-vale-cinzento.html` | igual |  |
| Veículos | Frota | https://claude.ai/artifact/3FqnqNJrEc4jLgAAvjGmnp | `artefatos/3FqnqNJrEc4jLgAAvjGmnp.html` | `site/pages/veiculos/frota.html` | igual | artefato = site; downloads é a antiga |
| Veículos | Garagem | https://claude.ai/artifact/Xy9QydZTRyAfwxRMjzh1aT | `artefatos/Xy9QydZTRyAfwxRMjzh1aT.html + `artefatos/Xy9QydZTRyAfwxRMjzh1aT/`` | `site/pages/veiculos/garagem.html` | difere: artefato tem 7616 linhas que o outro não tem, outro tem 7608 (1220K×1809K) | **estruturas diferentes**: artefato tem SDK separado e frotas novas; site é a v4 de um arquivo |
| Efeitos | Laboratório de Explosões | https://claude.ai/artifact/XHSLUfNEdzAqGrqVQCWifG | `artefatos/XHSLUfNEdzAqGrqVQCWifG.html` | `site/pages/efeitos/laboratorio-explosoes.html` | igual |  |
| Efeitos | Oficina de VFX | https://claude.ai/artifact/LhJANM9RPMxWKS1ZXCzQ56 | `artefatos/LhJANM9RPMxWKS1ZXCzQ56.html` | `site/pages/efeitos/oficina-vfx.html` | difere: artefato tem 7 linhas que o outro não tem, outro tem 7 (142K×142K) | 7 linhas (endereços de CDN, provável) |
| Efeitos | Padrão de Fluidos | https://claude.ai/artifact/XnjUUwx8fq5oQdDGvEq4Nv | `artefatos/XnjUUwx8fq5oQdDGvEq4Nv.html` | `site/pages/efeitos/padrao-fluidos.html` | igual |  |
| Animais | Bichos do Vale | https://claude.ai/artifact/6wxuUFgg9EZxQCeAQwx4HN | `artefatos/6wxuUFgg9EZxQCeAQwx4HN.html` | `site/pages/animais/bichos-do-vale.html` | igual |  |
| Vegetação | Viveiro do Vale | https://claude.ai/artifact/Bs3p84TFhG1A9YfdXSGZaQ | `artefatos/Bs3p84TFhG1A9YfdXSGZaQ.html` | `site/pages/vegetacao/viveiro.html` | difere: artefato tem 106 linhas que o outro não tem, outro tem 19 (875K×870K) | artefato tem 106 linhas que o site não tem |
| Arte geral | Cena de Arte | https://claude.ai/artifact/7UjDQiGv4m5E49dCa2kRmE | `artefatos/7UjDQiGv4m5E49dCa2kRmE.html` | `site/pages/arte/cena-de-arte.html` | igual |  |

## Juntar o que é coerente

Várias entregas tratam do mesmo assunto com versões diferentes. A consolidação de cada assunto (qual base vale, o que se junta de cada
versão) fica nos relatórios de `inventario/` e vira decisão do dono antes do porte. Casos já vistos:

- **Corpo humano e zumbi:** 8 versões (Bestiário, Elenco, Retratos, Galeria do Arsenal, Galeria do Vale, Bancada de Hordas e duas no jogo).
- **Explosão:** Laboratório, Oficina de VFX, jogo e SDK.
- **Dano por região:** documento Arsenal, Galeria 3D do Arsenal e jogo, com números diferentes.
- **Casas:** PlantasSDK (versão nova, no Visor de casas 3D) e `game-floorplan` (porte de uma versão anterior).
- **Veículos:** Garagem publicada (SDK separado e frotas novas), Garagem v4 do site e `game-vehicles-fleet`.
- **Sangue e fluidos:** Padrão de Fluidos, Oficina de VFX e `game-fluids`, com tempos e cores de secagem diferentes.
