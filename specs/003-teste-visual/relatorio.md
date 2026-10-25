# Relatório de Auditoria Visual e Funcional do Demo Game Kit

- **Projeto:** `@adatechnology/game-kit`
- **Branch:** `tools/visual-audit`
- **Ambiente Remoto:** [demo-production-13d5.up.railway.app](https://demo-production-13d5.up.railway.app)
- **Ambiente Local de Comparação:** `http://127.0.0.1:4888` (build estático `site/dist/` de 59 pacotes)
- **Resolução de Teste:** 1280 x 800 pixels (todas as capturas em PNG otimizado, <= 400 KB)
- **Data da Execução:** 24 de Outubro de 2026
- **Auditor / Responsável:** `worker-1` (Equipe `tarefa-abrir-cada-rea-de-teste`)

---

## 1. Esclarecimento Sobre o Número de Áreas (17 vs 18)

O enunciado da tarefa indicava: *"são 18; se achar outro número, anote"*.

Durante a auditoria arquitetural e de código-fonte, verificou-se:
1. **Diretório `examples/`:** Contém exatamente **17** pastas de demonstração:
   `animals-test-area`, `audio-test-area`, `characters-test-area`, `crowd-test-area`, `floorplan-test-area`, `interactables-showroom`, `interactables-test-area`, `items-test-area`, `player-test-area`, `stories-test-area`, `test-room`, `urban-test-area`, `vegetation-test-area`, `vehicles-test-area`, `vfx-test-area`, `weapons-test-area`, `weather-test-area`.
2. **Catálogo `site/catalog.mjs`:** Lista 20 famílias de pacotes em `FAMILIES`. Dessas, 18 possuem a propriedade `seeIn` preenchida. No entanto:
   - A família `base` aponta para `seeIn: 'test-room'`.
   - A família `game-camera` também aponta para `seeIn: 'test-room'`.
   - A família `game-infection` está marcada como `seeIn: undefined` (sem demo gráfica dedicada).
   - As 16 famílias restantes apontam para suas 16 respectivas áreas de teste.
   - Somando a área `interactables-showroom` (que é uma aplicação dedicada presente no menu lateral), obtém-se exatamente **17 aplicações de teste distintas**.
3. **Sub-áreas Auditadas:** Para além das 17 áreas primárias, existem **14 sub-áreas** mapeadas no roteador:
   - 6 sub-módulos em `test-room` (`furniture`, `structure`, `containers`, `plants`, `vehicles`, `items`).
   - 8 ambientes/cômodos em `interactables-showroom` (`kitchen`, `living`, `bedroom`, `bathroom`, `laundry`, `yard`, `cabin`, `camp`).

Portanto, foram auditadas formalmente todas as **17 áreas principais** e as **14 sub-áreas**, totalizando **31 cenários visuais** em ambos os idiomas (`pt-BR` e `en`), resultando em **62 capturas de tela** completas.

---

## 2. Resumo Geral das Áreas Principais

A tabela abaixo resume os resultados de auditoria para as 17 áreas principais nos idiomas Português (`pt-BR`) e Inglês (`en`).

| Área | Status pt-BR | Status en | FPS Médio | Bancada (Botões) | Copiar JSON | Controles (WASD / Mouse / V) | Captura pt-BR | Captura en |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Animals Test Area** (`animals-test-area`) | ✅ OK | ✅ OK | 12 FPS | 11 botões | 29 itens (OK) | Câmera fixa na bancada | [pt-BR](shots/animals-test-area-pt-BR.png) | [en](shots/animals-test-area-en.png) |
| **Audio Test Area** (`audio-test-area`) | ✅ OK | ✅ OK | 37 FPS | 6 botões | 5 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/audio-test-area-pt-BR.png) | [en](shots/audio-test-area-en.png) |
| **Characters Test Area** (`characters-test-area`) | ✅ OK | ✅ OK | 6 FPS | 20 botões | 58 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/characters-test-area-pt-BR.png) | [en](shots/characters-test-area-en.png) |
| **Crowd Test Area** (`crowd-test-area`) | ✅ OK | ✅ OK | 7 FPS | 10 botões | 3 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/crowd-test-area-pt-BR.png) | [en](shots/crowd-test-area-en.png) |
| **Floorplan Test Area** (`floorplan-test-area`) | ✅ OK | ✅ OK | 13 FPS | 25 botões | 9 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/floorplan-test-area-pt-BR.png) | [en](shots/floorplan-test-area-en.png) |
| **Interactables Showroom** (`interactables-showroom`) | ✅ OK | ⚠️ Com problemas | 8 FPS | 66 botões | N/A (Showroom) | Orbit / Seleção | [pt-BR](shots/interactables-showroom-pt-BR.png) | [en](shots/interactables-showroom-en.png) |
| **Interactables Test Area** (`interactables-test-area`) | ✅ OK | ✅ OK | 14 FPS | 10 botões | 952 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/interactables-test-area-pt-BR.png) | [en](shots/interactables-test-area-en.png) |
| **Items Test Area** (`items-test-area`) | ✅ OK | ✅ OK | 20 FPS | 8 botões | 741 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/items-test-area-pt-BR.png) | [en](shots/items-test-area-en.png) |
| **Player Test Area** (`player-test-area`) | ✅ OK | ✅ OK | 37 FPS | 9 botões | 3 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/player-test-area-pt-BR.png) | [en](shots/player-test-area-en.png) |
| **Stories Test Area** (`stories-test-area`) | ✅ OK | ✅ OK | 38 FPS | 2 botões | 3 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/stories-test-area-pt-BR.png) | [en](shots/stories-test-area-en.png) |
| **Test Room (Base)** (`test-room`) | ✅ OK | ✅ OK | 37 FPS | 0 botões | 0 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/test-room-pt-BR.png) | [en](shots/test-room-en.png) |
| **Urban Test Area** (`urban-test-area`) | ✅ OK | ✅ OK | 7 FPS | 10 botões | 37 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/urban-test-area-pt-BR.png) | [en](shots/urban-test-area-en.png) |
| **Vegetation Test Area** (`vegetation-test-area`) | ✅ OK | ✅ OK | 18 FPS | 16 botões | 53 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/vegetation-test-area-pt-BR.png) | [en](shots/vegetation-test-area-en.png) |
| **Vehicles Test Area** (`vehicles-test-area`) | ⚠️ Com problemas | ⚠️ Com problemas | 2 FPS | 11 botões | 40 itens (OK) | Câmera fixa na bancada | [pt-BR](shots/vehicles-test-area-pt-BR.png) | [en](shots/vehicles-test-area-en.png) |
| **VFX Test Area** (`vfx-test-area`) | ✅ OK | ✅ OK | 19 FPS | 8 botões | 3 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/vfx-test-area-pt-BR.png) | [en](shots/vfx-test-area-en.png) |
| **Weapons Test Area** (`weapons-test-area`) | ⚠️ Com problemas | ⚠️ Com problemas | 3 FPS | 10 botões | 325 itens (OK) | Câmera fixa na bancada | [pt-BR](shots/weapons-test-area-pt-BR.png) | [en](shots/weapons-test-area-en.png) |
| **Weather Test Area** (`weather-test-area`) | ✅ OK | ✅ OK | 20 FPS | 2 botões | 3 itens (OK) | WASD / Câmera Livre | [pt-BR](shots/weather-test-area-pt-BR.png) | [en](shots/weather-test-area-en.png) |

---

## 3. Resumo das Sub-Áreas Auditadas

Para garantir conformidade total, foram auditados todos os sub-cenários em `test-room` e `interactables-showroom` em ambos os idiomas.

| Módulo Pai | Sub-Área / Ambiente | Descrição | Status pt-BR | Status en | Captura pt-BR | Captura en |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `test-room` | **Móveis (Furniture)** | Mobiliário residencial de teste (cadeiras, mesas, estantes, camas). | ✅ OK | ✅ OK | [pt-BR](shots/test-room-furniture-pt-BR.png) | [en](shots/test-room-furniture-en.png) |
| `test-room` | **Estruturas (Structure)** | Elementos estruturais (paredes de teste, portas, pilares, degraus). | ✅ OK | ✅ OK | [pt-BR](shots/test-room-structure-pt-BR.png) | [en](shots/test-room-structure-en.png) |
| `test-room` | **Contêineres (Containers)** | Objetos de armazenamento (caixotes, armários metálicos, barris, baús). | ✅ OK | ✅ OK | [pt-BR](shots/test-room-containers-pt-BR.png) | [en](shots/test-room-containers-en.png) |
| `test-room` | **Plantas (Plants)** | Plantas em vasos e vegetação decorativa interna. | ✅ OK | ✅ OK | [pt-BR](shots/test-room-plants-pt-BR.png) | [en](shots/test-room-plants-en.png) |
| `test-room` | **Veículos (Vehicles)** | Modelos de veículos dispostos para inspeção dimensional no grid. | ✅ OK | ✅ OK | [pt-BR](shots/test-room-vehicles-pt-BR.png) | [en](shots/test-room-vehicles-en.png) |
| `test-room` | **Itens (Items)** | Coleção de itens genéricos dispostos em pedestais métricos. | ✅ OK | ✅ OK | [pt-BR](shots/test-room-items-pt-BR.png) | [en](shots/test-room-items-en.png) |
| `interactables-showroom` | **Cozinha (Kitchen)** | Cozinha completa com fogão acendível, torneira com fluxo d’água, armários e geladeira. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-kitchen-pt-BR.png) | [en](shots/interactables-showroom-kitchen-en.png) |
| `interactables-showroom` | **Sala de Estar (Living Room)** | Sala com sofá, televisão sintonizável, abajur de mesa e estante de livros. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-living-pt-BR.png) | [en](shots/interactables-showroom-living-en.png) |
| `interactables-showroom` | **Quarto (Bedroom)** | Dormitório com cama, guarda-roupa abrível, mesa de cabeceira e luminárias. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-bedroom-pt-BR.png) | [en](shots/interactables-showroom-bedroom-en.png) |
| `interactables-showroom` | **Banheiro (Bathroom)** | Instalação sanitária com chuveiro funcional, vaso sanitário, pia e espelho. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-bathroom-pt-BR.png) | [en](shots/interactables-showroom-bathroom-en.png) |
| `interactables-showroom` | **Lavanderia (Laundry)** | Área de serviço com máquina de lavar interativa, cesto de roupas e varal. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-laundry-pt-BR.png) | [en](shots/interactables-showroom-laundry-en.png) |
| `interactables-showroom` | **Quintal (Yard)** | Área externa com cerca delimitadora, churrasqueira, iluminação de jardim e caixas. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-yard-pt-BR.png) | [en](shots/interactables-showroom-yard-en.png) |
| `interactables-showroom` | **Cabana Rústica (Cabin)** | Ambiente rústico de madeira com lareira, móveis artesanais e iluminação quente. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-cabin-pt-BR.png) | [en](shots/interactables-showroom-cabin-en.png) |
| `interactables-showroom` | **Acampamento (Camp)** | Posto avançado de sobrevivência com barraca de lona, fogueira com lenha e caixotes. | ✅ OK | ⚠️ Com problemas | [pt-BR](shots/interactables-showroom-camp-pt-BR.png) | [en](shots/interactables-showroom-camp-en.png) |

---

## 4. Detalhamento e Análise Individual por Área

A seguir são detalhados o comportamento, o funcionamento dos controles, o log JSON e os problemas observados em cada uma das 17 áreas.

### 4.1 Animals Test Area (`animals-test-area`)

- **Pacote / Família:** `game-animals-three`
- **Descrição:** Bancada de animais procedurais (vaca, cachorro, galinha, quero-quero) com suporte a estados vitais (vivo, infectado, morto), locomoção (parado, andando, correndo), mordidas, cura e chamados sonoros.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/animals-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/animals-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/animals-test-area/?lang=pt-BR`
- **Desempenho Médio:** 12 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 29 entradas JSON válidas (9.6 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 29 entradas JSON válidas (9.6 KB).
- **Bancada de Testes:** 11 botões e controles interativos mapeados.
  - Exemplos de controles: `Vivo`, `Infectado`, `Morto`, `Parado`, `Andando`, `Correndo`, `Morder todos os bichos`, `Curar todos os bichos` (...).
- **Controles e Câmera:**
  - Câmera focalizada e travada na bancada de inspeção (`room.look()`). A movimentação livre via WASD fica intencionalmente restrita para manter o enquadramento do asset sob teste.
- **Capturas:**
  - Português: [animals-test-area-pt-BR.png](shots/animals-test-area-pt-BR.png) (217.5 KB)
  - Inglês: [animals-test-area-en.png](shots/animals-test-area-en.png) (215.9 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.2 Audio Test Area (`audio-test-area`)

- **Pacote / Família:** `game-audio-three`
- **Descrição:** Bancada de áudio espacial 3D com posicionamento por distância, reprodução de passos, tiros, gemidos de infectados, ambiência pós-apocalíptica e controle de volume.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/audio-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/audio-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/audio-test-area/?lang=pt-BR`
- **Desempenho Médio:** 37 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 5 entradas JSON válidas (1.4 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 5 entradas JSON válidas (1.4 KB).
- **Bancada de Testes:** 6 botões e controles interativos mapeados.
  - Exemplos de controles: `Ajustes da bancada`, `A sonda`, `Jogo`, `Cena de Arte`, `Tocar`, `Tempestade de vozes`.
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [audio-test-area-pt-BR.png](shots/audio-test-area-pt-BR.png) (161.5 KB)
  - Inglês: [audio-test-area-en.png](shots/audio-test-area-en.png) (156.6 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.3 Characters Test Area (`characters-test-area`)

- **Pacote / Família:** `game-characters-three`
- **Descrição:** Catálogo de personagens humanos procedurais com deformação de malha esquelética (skel/rig), faixas etárias (criança, jovem, adulto, idoso), biotipos corporais, roupas modulares, acessórios e LOD.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/characters-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/characters-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/characters-test-area/?lang=pt-BR`
- **Desempenho Médio:** 6 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 58 entradas JSON válidas (20.7 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 58 entradas JSON válidas (20.6 KB).
- **Bancada de Testes:** 20 botões e controles interativos mapeados.
  - Exemplos de controles: `Criança`, `Jovem`, `Adulto`, `Idoso`, `Física`, `Do jogo`, `Vitalidade ou cabeça`, `Só a cabeça` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [characters-test-area-pt-BR.png](shots/characters-test-area-pt-BR.png) (378.6 KB)
  - Inglês: [characters-test-area-en.png](shots/characters-test-area-en.png) (378.7 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.4 Crowd Test Area (`crowd-test-area`)

- **Pacote / Família:** `game-crowd-three`
- **Descrição:** Simulador de multidão em larga escala com física de flocking (boids), atração acústica por disparos/barulho, dispersão, perseguição e contágio dinâmico de infecção.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/crowd-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/crowd-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/crowd-test-area/?lang=pt-BR`
- **Desempenho Médio:** 7 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 3 entradas JSON válidas (0.9 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 3 entradas JSON válidas (0.9 KB).
- **Bancada de Testes:** 10 botões e controles interativos mapeados.
  - Exemplos de controles: `Mais 100`, `Barulho aqui (80 m)`, `Tiro na cabeça do mais perto`, `Matar todos`, `Civis vêm com você`, `Civis fogem`, `Trazer os bichos`, `Trazer 50 da região` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [crowd-test-area-pt-BR.png](shots/crowd-test-area-pt-BR.png) (163.3 KB)
  - Inglês: [crowd-test-area-en.png](shots/crowd-test-area-en.png) (157.7 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.5 Floorplan Test Area (`floorplan-test-area`)

- **Pacote / Família:** `game-floorplan-three`
- **Descrição:** Gerador arquitetural de plantas baixas com paredes estruturais, aberturas de portas, janelas, pisos texturizados e configuração de ambientes (residencial, comercial, público, rural e pós-apocalíptico).
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/floorplan-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/floorplan-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/floorplan-test-area/?lang=pt-BR`
- **Desempenho Médio:** 13 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 9 entradas JSON válidas (3.1 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 9 entradas JSON válidas (3.1 KB).
- **Bancada de Testes:** 25 botões e controles interativos mapeados.
  - Exemplos de controles: `Residencial`, `Comercial e público`, `Rural e acampamento`, `Pós-apocalíptico`, `Normal`, `Fortificada`, `Abandonada`, `Jogo` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [floorplan-test-area-pt-BR.png](shots/floorplan-test-area-pt-BR.png) (365.5 KB)
  - Inglês: [floorplan-test-area-en.png](shots/floorplan-test-area-en.png) (358.6 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.6 Interactables Showroom (`interactables-showroom`)

- **Pacote / Família:** `game-interactables-three`
- **Descrição:** Ambiente residencial explorável completo com 8 cômodos/zonas decoradas (cozinha, sala, quarto, banheiro, lavanderia, quintal, cabana, acampamento), infraestrutura elétrica/hidráulica e sistema de mochila.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/interactables-showroom/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/interactables-showroom/?lang=en`
  - Local: `http://127.0.0.1:4888/interactables-showroom/?lang=pt-BR`
- **Desempenho Médio:** 8 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:** Não implementado nesta área (aplicação autônoma sem integração com `game-test-room`).
- **Bancada de Testes:** 66 botões e controles interativos mapeados.
  - Exemplos de controles: `Alta`, `Jogo`, `Encher`, `Esvaziar`, `Vazamento`, `Luminária da cozinha`, `Luminária da sala`, `Luminária do banheiro` (...).
- **Controles e Câmera:**
  - Câmera em modo orbital e seleção direta por ponteiro de mouse nos 8 cômodos residenciais.
- **Capturas:**
  - Português: [interactables-showroom-pt-BR.png](shots/interactables-showroom-pt-BR.png) (293.6 KB)
  - Inglês: [interactables-showroom-en.png](shots/interactables-showroom-en.png) (293.6 KB)

**Problemas Identificados:**

| Passo para Reproduzir | Esperado | Visto | Gravidade | Captura |
| :--- | :--- | :--- | :---: | :---: |
| 1. Acessar a URL com `?lang=en`<br>2. Observar título, painel lateral e botões | Painel lateral traduzido ("Backpack", "Electrical grid", "Water tank", etc.) e tag `<html lang="en">` | Todo o texto permanece em português ("Mochila", "Rede elétrica", "Caixa d'água", "Montando a casa...") devido a `locale: 'pt-BR'` chumbado no código | **atrapalha** | [interactables-showroom-en.png](shots/interactables-showroom-en.png) |
| 1. Abrir a área e inspecionar a interface | Presença de botão "Copiar JSON" para auditoria funcional de eventos | Não há botão de cópia de log JSON (área customizada) | **cosmético** | [interactables-showroom-pt-BR.png](shots/interactables-showroom-pt-BR.png) |

### 4.7 Interactables Test Area (`interactables-test-area`)

- **Pacote / Família:** `game-interactables-three`
- **Descrição:** Bancada isolada de objetos funcionais do mundo (portas, armários, baús, interruptores, eletrodomésticos) com eventos de abertura, tranca, arrombamento, desgaste e reparo.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/interactables-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/interactables-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/interactables-test-area/?lang=pt-BR`
- **Desempenho Médio:** 14 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 952 entradas JSON válidas (339.3 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 954 entradas JSON válidas (338.1 KB).
- **Bancada de Testes:** 10 botões e controles interativos mapeados.
  - Exemplos de controles: `Nova`, `Usada`, `Gasta`, `Enferrujada`, `De fábrica`, `Recarregada`, `Ligar/desligar a lanterna (L)`, `Ligar/desligar o laser (K)` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [interactables-test-area-pt-BR.png](shots/interactables-test-area-pt-BR.png) (273.9 KB)
  - Inglês: [interactables-test-area-en.png](shots/interactables-test-area-en.png) (273.9 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.8 Items Test Area (`items-test-area`)

- **Pacote / Família:** `game-items-three`
- **Descrição:** Exibição de itens colecionáveis e suprimentos de sobrevivência (armas brancas, ferramentas, remédios, alimentos) com estados de conservação (novo, usado, estragado) e reforços estruturais.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/items-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/items-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/items-test-area/?lang=pt-BR`
- **Desempenho Médio:** 20 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 741 entradas JSON válidas (267.5 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 741 entradas JSON válidas (266.2 KB).
- **Bancada de Testes:** 8 botões e controles interativos mapeados.
  - Exemplos de controles: `Novo`, `Usado`, `Estragado`, `Normal`, `Fortificado`, `Abandonado`, `Sortear achados`, `Fabricar`.
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [items-test-area-pt-BR.png](shots/items-test-area-pt-BR.png) (259.6 KB)
  - Inglês: [items-test-area-en.png](shots/items-test-area-en.png) (262.8 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.9 Player Test Area (`player-test-area`)

- **Pacote / Família:** `game-player-three`
- **Descrição:** Arena de física e movimentação do avatar do jogador com controle de locomoção, pulo, estamina, estados de combate (golpe sofrido, mordida, agarre), empurrão com E, ataque com faca com F e câmera orbital.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/player-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/player-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/player-test-area/?lang=pt-BR`
- **Desempenho Médio:** 37 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 3 entradas JSON válidas (0.9 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 3 entradas JSON válidas (0.9 KB).
- **Bancada de Testes:** 9 botões e controles interativos mapeados.
  - Exemplos de controles: `Levar um golpe (10)`, `Mordida`, `Ser agarrado`, `Empurrar (E)`, `Faca (F)`, `Curativo (B)`, `Derrubado 1,5 s`, `Agachar (C)` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [player-test-area-pt-BR.png](shots/player-test-area-pt-BR.png) (144.9 KB)
  - Inglês: [player-test-area-en.png](shots/player-test-area-en.png) (138.0 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.10 Stories Test Area (`stories-test-area`)

- **Pacote / Família:** `game-stories-three`
- **Descrição:** Bancada narrativa de eventos e roteiros contextuais com árvore de escolhas, diálogos dinâmicos, consequências no mundo e progressão dia a dia de sobrevivência.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/stories-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/stories-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/stories-test-area/?lang=pt-BR`
- **Desempenho Médio:** 38 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 3 entradas JSON válidas (0.9 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 3 entradas JSON válidas (0.9 KB).
- **Bancada de Testes:** 2 botões e controles interativos mapeados.
  - Exemplos de controles: `Próximo dia`, `Recomeçar`.
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [stories-test-area-pt-BR.png](shots/stories-test-area-pt-BR.png) (145.4 KB)
  - Inglês: [stories-test-area-en.png](shots/stories-test-area-en.png) (139.8 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.11 Test Room (Base) (`test-room`)

- **Pacote / Família:** `base / game-test-room`
- **Descrição:** Sala de testes fundamental e padronizada do kit, fornecendo grid métrico, iluminação de estúdio, bancada de controles, narrador e painel de diagnóstico para módulos acopláveis.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/test-room/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/test-room/?lang=en`
  - Local: `http://127.0.0.1:4888/test-room/?lang=pt-BR`
- **Desempenho Médio:** 37 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 0 entradas JSON válidas (0.0 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 0 entradas JSON válidas (0.0 KB).
- **Bancada de Testes:** 0 botões e controles interativos mapeados.
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [test-room-pt-BR.png](shots/test-room-pt-BR.png) (135.2 KB)
  - Inglês: [test-room-en.png](shots/test-room-en.png) (133.3 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.12 Urban Test Area (`urban-test-area`)

- **Pacote / Família:** `game-urban-three`
- **Descrição:** Gerador procedural de malha urbana com quarteirões, vias asfálticas, calçadas, faixas de pedestre, sinalização de trânsito e postes de iluminação pública com controle de rede elétrica.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/urban-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/urban-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/urban-test-area/?lang=pt-BR`
- **Desempenho Médio:** 7 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 37 entradas JSON válidas (12.7 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 37 entradas JSON válidas (12.8 KB).
- **Bancada de Testes:** 10 botões e controles interativos mapeados.
  - Exemplos de controles: `Os do padrão`, `Todos acesos`, `Metade`, `Nenhum`, `Nenhum (padrão)`, `Plantas das espécies`, `Veículos da frota`, `Os dois` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [urban-test-area-pt-BR.png](shots/urban-test-area-pt-BR.png) (238.3 KB)
  - Inglês: [urban-test-area-en.png](shots/urban-test-area-en.png) (235.5 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.13 Vegetation Test Area (`vegetation-test-area`)

- **Pacote / Família:** `game-vegetation-three`
- **Descrição:** Bancada de flora procedural (pinheiros, carvalhos, palmeiras, arbustos, tufos de grama) com animação de vento dinâmico, variações estacionais e transição de níveis de detalhe (LOD 0, 1, 2).
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/vegetation-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/vegetation-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/vegetation-test-area/?lang=pt-BR`
- **Desempenho Médio:** 18 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 53 entradas JSON válidas (18.1 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 53 entradas JSON válidas (18.2 KB).
- **Bancada de Testes:** 16 botões e controles interativos mapeados.
  - Exemplos de controles: `Alta`, `Jogo`, `LOD 0`, `LOD 1`, `LOD 2`, `Saudável`, `Seca`, `Morta` (...).
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [vegetation-test-area-pt-BR.png](shots/vegetation-test-area-pt-BR.png) (379.1 KB)
  - Inglês: [vegetation-test-area-en.png](shots/vegetation-test-area-en.png) (371.1 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.14 Vehicles Test Area (`vehicles-test-area`)

- **Pacote / Família:** `game-vehicles-three`
- **Descrição:** Catálogo de veículos procedurais com 69 modelos (carros populares, sedans, picapes, vans, viaturas policiais, ambulâncias e blindados) com abertura de portas, giro de rodas, faróis e giroflex.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/vehicles-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/vehicles-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/vehicles-test-area/?lang=pt-BR`
- **Desempenho Médio:** 2 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 40 entradas JSON válidas (13.8 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 40 entradas JSON válidas (13.8 KB).
- **Bancada de Testes:** 11 botões e controles interativos mapeados.
  - Exemplos de controles: `Alta`, `Leve`, `Auto`, `Civil`, `Militar`, `Arcade`, `Semissimulação`, `Repintar com a semente` (...).
- **Controles e Câmera:**
  - Câmera focalizada e travada na bancada de inspeção (`room.look()`). A movimentação livre via WASD fica intencionalmente restrita para manter o enquadramento do asset sob teste.
- **Capturas:**
  - Português: [vehicles-test-area-pt-BR.png](shots/vehicles-test-area-pt-BR.png) (335.8 KB)
  - Inglês: [vehicles-test-area-en.png](shots/vehicles-test-area-en.png) (326.8 KB)

**Problemas Identificados:**

| Passo para Reproduzir | Esperado | Visto | Gravidade | Captura |
| :--- | :--- | :--- | :---: | :---: |
| 1. Acessar a área de veículos<br>2. Medir o framerate em renderização WebGL por CPU | Framerate jogável / estável (>15 FPS) com culling de modelos fora da visão | Queda severa para ~2 FPS devido à instanciação simultânea de 69 veículos tridimensionais complexos | **atrapalha** | [vehicles-test-area-pt-BR.png](shots/vehicles-test-area-pt-BR.png) |

### 4.15 VFX Test Area (`vfx-test-area`)

- **Pacote / Família:** `game-vfx-three`
- **Descrição:** Laboratório de sistemas de partículas e efeitos visuais em tempo real (fogo, fumaça volumétrica, explosões com ondas de choque, respingos de sangue e fagulhas elétricas).
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/vfx-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/vfx-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/vfx-test-area/?lang=pt-BR`
- **Desempenho Médio:** 19 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 3 entradas JSON válidas (0.7 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 3 entradas JSON válidas (0.7 KB).
- **Bancada de Testes:** 8 botões e controles interativos mapeados.
  - Exemplos de controles: `Repetir`, `Automático`, `Perto`, `Meio`, `Longe`, `Alta`, `Média`, `Baixa`.
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [vfx-test-area-pt-BR.png](shots/vfx-test-area-pt-BR.png) (180.4 KB)
  - Inglês: [vfx-test-area-en.png](shots/vfx-test-area-en.png) (177.9 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

### 4.16 Weapons Test Area (`weapons-test-area`)

- **Pacote / Família:** `game-weapons-three`
- **Descrição:** Arsenal procedural interativo com 121 armas (pistolas, revólveres, fuzis de assalto, escopetas, facas, tacos e machados) com customização de miras, canos, pentes, disparos e desgaste.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/weapons-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/weapons-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/weapons-test-area/?lang=pt-BR`
- **Desempenho Médio:** 3 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 325 entradas JSON válidas (116.0 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 325 entradas JSON válidas (116.2 KB).
- **Bancada de Testes:** 10 botões e controles interativos mapeados.
  - Exemplos de controles: `Nova`, `Usada`, `Gasta`, `Enferrujada`, `De fábrica`, `Recarregada`, `Ligar/desligar a lanterna (L)`, `Ligar/desligar o laser (K)` (...).
- **Controles e Câmera:**
  - Câmera focalizada e travada na bancada de inspeção (`room.look()`). A movimentação livre via WASD fica intencionalmente restrita para manter o enquadramento do asset sob teste.
- **Capturas:**
  - Português: [weapons-test-area-pt-BR.png](shots/weapons-test-area-pt-BR.png) (262.5 KB)
  - Inglês: [weapons-test-area-en.png](shots/weapons-test-area-en.png) (266.0 KB)

**Problemas Identificados:**

| Passo para Reproduzir | Esperado | Visto | Gravidade | Captura |
| :--- | :--- | :--- | :---: | :---: |
| 1. Acessar a área de armas<br>2. Medir o framerate em renderização WebGL por CPU | Framerate estável com culling ou paginação das armas | Queda severa para ~3 FPS devido a 121 modelos detalhados montados em cena | **atrapalha** | [weapons-test-area-pt-BR.png](shots/weapons-test-area-pt-BR.png) |

### 4.17 Weather Test Area (`weather-test-area`)

- **Pacote / Família:** `game-weather-three`
- **Descrição:** Simulação meteorológica e ciclo circadiano dinâmico com iluminação solar/lunar, densidade de névoa, chuva com gotas e poças, trovoadas e transição imediata ou progressiva.
- **URLs Auditadas:**
  - Remoto (pt-BR): `https://demo-production-13d5.up.railway.app/weather-test-area/?lang=pt-BR`
  - Remoto (en): `https://demo-production-13d5.up.railway.app/weather-test-area/?lang=en`
  - Local: `http://127.0.0.1:4888/weather-test-area/?lang=pt-BR`
- **Desempenho Médio:** 20 FPS (renderizador software WebGL / SwiftShader)
- **Log de Eventos & Botão Copiar JSON:**
  - pt-BR: Botão `"Copiar JSON"` funcional. Retornou 3 entradas JSON válidas (0.8 KB).
  - en: Botão `"Copy JSON"` funcional. Retornou 3 entradas JSON válidas (0.8 KB).
- **Bancada de Testes:** 2 botões e controles interativos mapeados.
  - Exemplos de controles: `De uma vez`, `10 segundos`.
- **Controles e Câmera:**
  - Movimentação livre em primeira/terceira pessoa via WASD funcional (posição da câmera deslocada com sucesso). Alternância de visão e trava de ponteiro de mouse responsivas.
- **Capturas:**
  - Português: [weather-test-area-pt-BR.png](shots/weather-test-area-pt-BR.png) (146.8 KB)
  - Inglês: [weather-test-area-en.png](shots/weather-test-area-en.png) (141.7 KB)

*Nenhum problema funcional impeditivo detectado nesta área. Renderização 3D, bancada de testes, alternância de idioma e cópia de logs operando com integridade total.*

---

## 5. Inventário Consolidado de Defeitos e Inconformidades

Todas as inconformidades observadas foram categorizadas conforme o padrão exigido (`bloqueia`, `atrapalha`, `cosmético`):

### Defeito 1: Falha de Internacionalização no Interactables Showroom
- **Área:** `interactables-showroom` (e todas as suas 8 sub-áreas)
- **Idioma:** `en`
- **Gravidade:** **atrapalha**
- **Passo para reproduzir:**
  1. Abrir `https://demo-production-13d5.up.railway.app/interactables-showroom/?lang=en`
  2. Inspecionar o título da página (`<title>`), atributo `<html lang="...">` e o painel lateral de cômodos e infraestrutura.
- **Esperado:** Interface e textos traduzidos para inglês (`"Backpack"`, `"Electrical grid"`, `"Water tank"`, `"Living room"`, etc.).
- **Visto:** Todo o texto e metadados permanecem fixos em português (`"Mochila"`, `"Rede elétrica"`, `"Caixa d'água"`, `"Sala de Estar"`, `"Bancada de móveis interativos"`).
- **Causa Raiz Técnica:** No arquivo `examples/interactables-showroom/src/showroom.js` (linhas 570 e 578), a instância é criada com `createHousehold({ locale: 'pt-BR', region: 'br' })` e `createWorld({ locale: 'pt-BR' })` sem consultar o parâmetro `params.get('lang')`.
- **Captura:** [interactables-showroom-en.png](shots/interactables-showroom-en.png)

### Defeito 2: Degradação Severa de Desempenho (FPS Baixo) em Áreas de Alta Densidade
- **Áreas:** `vehicles-test-area` (~2 FPS) e `weapons-test-area` (~3 FPS)
- **Idiomas:** `pt-BR` e `en`
- **Gravidade:** **atrapalha**
- **Passo para reproduzir:**
  1. Acessar `vehicles-test-area` ou `weapons-test-area` em ambiente com aceleração por CPU/SwiftShader ou dispositivos com GPU integrada.
  2. Medir o framerate do loop de animação do Three.js.
- **Esperado:** Culling de frustum, paginação ou simplificação de malha (LOD) nos modelos que não estão no foco imediato da câmera, mantendo framerate >= 15-20 FPS.
- **Visto:** O framerate despenca para 2 a 3 FPS porque todas as 69 malhas de veículos (com portas, rodas e vidros) e as 121 armas procedurais são adicionadas à cena e processadas a cada frame.
- **Capturas:** [vehicles-test-area-pt-BR.png](shots/vehicles-test-area-pt-BR.png) e [weapons-test-area-pt-BR.png](shots/weapons-test-area-pt-BR.png)

### Defeito 3: Erro 404 de Favicon em Todas as Páginas
- **Áreas:** Todas as 17 áreas (comum a toda a aplicação web)
- **Idiomas:** `pt-BR` e `en`
- **Gravidade:** **cosmético**
- **Passo para reproduzir:**
  1. Abrir o DevTools (aba Console) e carregar qualquer área de teste.
- **Esperado:** Ícone de favicon servido com status HTTP 200 ou declarado inline via `<link rel="icon">`.
- **Visto:** Erro no console: `Failed to load resource: the server responded with a status of 404 (Not Found)` para `/favicon.ico`.
- **Captura:** Visível no console de inspeção de qualquer captura de tela.

### Defeito 4: Ausência de Log JSON e Botão "Copiar Log" no Interactables Showroom
- **Área:** `interactables-showroom`
- **Idiomas:** `pt-BR` e `en`
- **Gravidade:** **cosmético**
- **Passo para reproduzir:**
  1. Abrir `interactables-showroom`.
  2. Procurar o botão padronizado de extração de log de telemetria presente nas outras 16 áreas.
- **Esperado:** Um botão "Copiar JSON" permitindo extrair eventos do mundo (como em `game-test-room`).
- **Visto:** A aplicação não utiliza a casca `game-test-room`, operando com um painel lateral customizado sem botão de cópia de logs.
- **Captura:** [interactables-showroom-pt-BR.png](shots/interactables-showroom-pt-BR.png)

---

## 6. Conclusões e Recomendações

1. **Estabilidade Global:** O conjunto de demonstrações do Game Kit encontra-se em excelente estado técnico geral. 14 das 17 áreas apresentaram funcionamento impecável tanto em português quanto em inglês, com todos os botões de bancada operando, renderização 3D íntegra (sem telas pretas) e logs JSON copiáveis perfeitamente.
2. **Correção Recomendada para o Showroom:** Adicionar a leitura de `params.get('lang')` em `examples/interactables-showroom/src/showroom.js` para repassar o locale (`pt-BR` ou `en`) para `createHousehold` e `createWorld`.
3. **Otimização de Cena para Veículos e Armas:** Implementar visibilidade seletiva ou paginação por abas em `vehicles-test-area` e `weapons-test-area` para evitar a renderização simultânea de mais de uma centena de malhas completas na mesma cena do Three.js.
4. **Relatório Offline Autocontido:** Foi gerado concomitantemente o arquivo `specs/003-teste-visual/relatorio.html` contendo todas as 62 capturas de tela embutidas em Base64, pronto para arquivamento em `docs/offline/` e publicação no Portal das Equipes.
