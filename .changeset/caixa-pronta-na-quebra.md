---
'@adatechnology/game-destruction-three': patch
---

As caixas de uma parte desenhada por um trecho de malha mesclada (telhado, chapas da casa) são ajustadas no espaço dos próprios vértices e levadas até a peça pela pose (giro e translação), em vez de ajustadas nos pontos já no quadro da peça. A quebra da casa e o objeto movido reaproveitam as caixas ajustadas antes: na casa de teste de 4 partes, os ajustes no quadro da quebra caem de 3 para 0. Pose com escala, cisalhamento ou espelho continua no caminho exato; parte amassada ou lascada é ajustada de novo. As caixas podem diferir das de antes em até alguns por cento de volume, porque o ajuste depende do quadro nas bordas da amostragem (`ceil` do comprimento da aresta).
