// fonte: site/pages/sobreviventes/os-vivos-do-vale.html
// texto visível: Os Vivos do Vale ZombiAdA · documento de design · sobreviventes Os vivos do Vale Cinzento Quem ainda está vivo na cidade, onde mora, o que quer, o que esconde e de quem depende. E o que acontece com cada um com o passar dos dias: quem morre, quem se fere, quem é mordido e volta como zumbi com nome, quem foge do vale e quem entra no seu grupo. O mundo segue sem o jogador; o jogador só muda o rumo. 31 sobreviventes com nome 12 grupos e bases 40 genéricos por servidor 0 pontos de virada 9 estados de destino Mantém os 8 NPCs da página de personagens com os mesmos textos, rotinas e segredos, e adiciona 23 pessoas que já eram citadas nessas histórias (Seu Arnaldo, Bianca, Lívia, a mãe da Jéssica no portão, os seis homens do Brasa) ou que o mapa pedia (família da fazenda que atira, grupo hostil da serra, atirador da base, dono da loja de armas). Nesta versão entram mais 13: Tainá, que chega grávida, o caminhoneiro Lucas, e os fardados do Bloqueio Norte, da PRF, da penitenciária, da Equipe Falcão e o Major Azevedo no bunker. Todos os números são proposta para playtest. Modelos 3D de cada pessoa e de cada base: Retratos do Vale . Grupos Fardados Elenco Relações Destino Vale vivo Linha do tempo Simulador Genéricos Implementação Onde vivem Grupos e bases Cada sobrevivente pertence a uma base presa a um lugar do mapa. A base tem defesa (0 a 1, reduz o risco diário de quem fica dentro) e estoque de comida em dias. Esses dois números mudam com o que acontece e alimentam o destino de todos que moram ali. Quem ainda usa farda Fardados Exército, polícias e forças especiais não somem no primeiro dia. Cada força vira um grupo com base no mapa, hierarquia, equipamento e uma ordem que fazia sentido antes do surto e vai deixando de fazer. Elas protegem, cobram, atiram e se infectam como todo mundo, e o que carregam é o melhor saque do vale. Patentes e comando Força Escala No vale Comportamento em campo Patrulha: rota fixa em dupla, lanterna à noite, rádio a cada 30 min. Se a dupla não responde, a base manda outra e vira evento. Posto de controle: escada de tensão em 4 degraus. Chamada a 50 m, parar a 30 m, mãos à vista, revista de mordida. Arma na mão do jogador sobe um degrau; correr sobe dois; no quarto degrau, tiro. Resgate: grupos com reputação 20 ou mais saem para socorrer sobrevivente cercado a até 300 m da base, se tiverem munição. Hostil: emboscada em ponto alto, pedágio, confisco de arma longa e veículo. Contra a horda: fogo controlado e mira na cabeça, mas cada disparo de fuzil chama zumbis num raio de 300 m. Um tiroteio de soldados é proteção e perigo ao mesmo tempo: atrai a horda para cima de quem estiver perto. Reputação de facção Cada força tem uma reputação com o jogador de −100 a 100, separada da opinião de cada NPC, e as duas se puxam: matar um soldado derruba a reputação do Exército; ajudar a Lúcia sobe a da PRF. Reputação O que acontece ≤ −60 Atira à vista, caça o jogador fora da base −59 a −20 Hostil: expulsa, confisca, não troca −19 a 19 Desconfia

// ===== script 0 (112 KB)

const GROUPS={
 igreja:{n:"Igreja Matriz",reg:"Centro",c:"#e0a548",def:.45,food:9,d:"Nave e salão paroquial viraram enfermaria. Portas de madeira reforçadas com bancos. O sino é a última arma: chama toda horda num raio de 1,5 km."},
 deleg:{n:"Delegacia do 4º DP",reg:"Centro",c:"#c4483b",def:.75,food:30,d:"Muro alto, arsenal classe D e seis homens armados. Cobra pedágio na avenida. Mais segura do mapa e a mais perigosa para quem não obedece."},
 radio:{n:"Rádio Vale FM",reg:"Morro da antena, entre o Centro e o Jardim Aurora",c:"#6fa3c7",def:.3,food:12,d:"Torre com gerador barulhento. Transmissão diária às 20h. Uma horda se junta lentamente ao pé do morro."},
 oficina:{n:"Auto Center Tavares",reg:"Saída sul, perto do Posto BR-Sul",c:"#a3836a",def:.65,food:15,d:"Janelas soldadas, armadilhas no pátio, um ônibus blindado pela metade. Tem diesel escondido."},
 colegio:{n:"Colégio Estadual",reg:"Vila Esperança",c:"#c9c26f",def:.4,food:6,d:"Laboratório trancado no 2º andar. Pólvora, sabão e antisséptico em troca de comida. Quadra coberta virou horda."},
 hospital:{n:"Hospital Regional, ala isolada",reg:"Centro",c:"#8fc9c0",def:.55,food:14,d:"Ala com gerador próprio, zumbis presos em macas para pesquisa e um grupo de jovens que busca remédio em troca de proteção."},
 vila:{n:"Igreja da Vila",reg:"Vila Esperança",c:"#d27fa3",def:.35,food:8,d:"Igreja evangélica entre vielas e lajes. Mantém os 'doentes' acorrentados no salão à vista de todos, esperando um milagre."},
 aurora:{n:"Sobrado da rua das Acácias",reg:"Jardim Aurora",c:"#9aa0a6",def:.2,food:3,d:"Uma mãe e um filho presos num sobrado da área de início. Primeiro pedido de socorro que o jogador ouve."},
 fabril:{n:"Depósito de combustível",reg:"Distrito Fabril",c:"#e07b4f",def:.4,food:10,d:"Tanques de diesel e gasolina, galpão vizinho com uma linha de produção que nunca parou e uma horda dormente."},
 armas:{n:"Kessler Armas e Caça",reg:"Centro",c:"#b58ad6",def:.6,food:20,d:"Loja de armas com depósito blindado. O dono atira em quem força a porta."},
 oeste:{n:"Sítios do Oeste",reg:"Sítios do Oeste",c:"#7fae73",def:.5,food:60,d:"Sítio Boa Vista do Dito e a fazenda dos Moreira, a 2 km. Comida de verdade, visão longa da BR e das hordas que vêm por ela."},
 serra:{n:"Serra do Corvo",reg:"Serra do Corvo",c:"#5fb08a",def:.5,food:25,d:"Acampamento dos Corvos na mata e a cabana da Dona Cida perto da cachoeira."},
 base:{n:"Torre de vigia do 7º BIS",reg:"Base 7º BIS",c:"#7d8a6a",def:.7,food:5,d:"Uma soldada sozinha numa torre cercada por milhares de zumbis fardados."},
 bloqueio:{n:"Bloqueio Norte (Exército)",reg:"Estrada do Quartel, saída norte do vale",c:"#8f9a5c",def:.7,food:12,d:"Contêineres, arame e duas torres de andaime na estrada norte. Um pelotão do 7º BIS cumpre uma quarentena que ninguém mais comanda. Ninguém sai do vale por aqui."},
 prf:{n:"Posto da PRF",reg:"BR-Sul, na saída sul de Santa Aurora",c:"#e0c341",def:.45,food:10,d:"Posto da Polícia Rodoviária Federal com pátio cercado, uma Cruzi Rodoviária com o 191 na porta, uma moto GZ 1250 Rodoviária e um livro de ocorrências com o nome de todo mundo que entrou no vale pela BR."},
 penit:{n:"Penitenciária estadual, bloco C",reg:"Estrada da Penitenciária, ao norte",c:"#a3836a",def:.8,food:8,d:"Muralha, guaritas e um pátio cheio de zumbis do Choque. No bloco C, policiais penais e presos dividem a comida num acordo que dura enquanto ela durar."},
 falcao:{n:"Equipe Falcão",reg:"Edifício-garagem ao lado do hospital, Centro",c:"#5fb0a0",def:.5,food:6,d:"Três militares das forças especiais escondidos no último andar de um edifício-garagem, com antena no telhado e vista para a ala isolada."},
 nomade:{n:"Nômades",reg:"Cidade inteira",c:"#d9dcd3",def:0,food:0,d:"Sem base fixa. Dormem em telhados e lajes, trocam com todo mundo."}
};
const RISK=[["Jardim Aurora",.002],["Sítios do Oeste e Várzea",.002],["Serra do Corvo",.0015],["Vila Esperança",.004],["Distrito Fabril",.005],["Centro",.008],["Base 7º BIS",.02],["Bloqueio Norte e Penitenciária",.0055],["BR-Sul (posto da PRF)",.004]];

const NPCS=[
 // ---------- Igreja Matriz
 {id:"zilda",n:"Dona Zilda Ramos",i:67,o:"Enfermeira aposentada",g:"igreja",orig:1,
  h:"Trabalhou 38 anos no hospital municipal. Quando o surto começou, abriu a igreja para feridos e ficou. Acredita que todo mundo merece ser cuidado, até o final. Cuida de quatro crianças órfãs que encontrou nas primeiras semanas.",
  p:[55,95,80,5,60],r:[["06:00","Reza e acende velas"],["07:00","Prepara mingau para as crianças"],["09:00","Atende feridos que chegam"],["14:00","Lava curativos e ferve água"],["18:00","Tranca a igreja"],["21:00","Desce ao porão sozinha"]],
  obj:"Achar insulina para uma das crianças, que é diabética.",
  seg:"O marido dela, Seu Arnaldo, foi mordido. Ela o mantém acorrentado no porão e leva comida todas as noites.",
  it:"Terço de contas de madeira no pulso",of:"Trata ferimentos, ensina Primeiros Socorros até nível 7."},
 {id:"arnaldo",n:"Seu Arnaldo Ramos",i:70,o:"Ferroviário aposentado (zumbi)",g:"igreja",
  h:"Foi mordido no terceiro dia, protegendo a esposa de um vizinho. Reanimou como Lento. Está acorrentado no porão da igreja com uma corrente de portão e um cadeado que só a Zilda abre. Ainda usa o relógio de bolso da ferrovia.",
  p:[0,0,0,0,0],r:[["24h","Acorrentado no porão, geme quando ouve passos"]],
  obj:"Nenhum. É um zumbi Lento Recente, que vai ficando Antigo com os dias.",
  seg:"Se ouvir o sino ou houver pânico na igreja, puxa a corrente com força dobrada. A argola na parede está solta: o cadeado não é o problema.",
  it:"Relógio de bolso da ferrovia",of:"Peso moral. É o ponto de virada mais perigoso da igreja."},
 {id:"val",n:"Seu Valdir “Val” Cardoso",i:58,o:"Sacristão e coveiro",g:"igreja",
  h:"Cuida da Matriz há 30 anos. Abre covas no terreno atrás da igreja e anota cada nome num caderno. Foi ele quem ajudou a Zilda a descer o Arnaldo para o porão, e se arrepende todo dia.",
  p:[50,70,85,10,55],r:[["05:30","Abre o portão lateral e olha a rua"],["08:00","Busca água no poço da praça"],["11:00","Abre covas e enterra quem morreu"],["16:00","Conserta portas e bancos"],["20:00","Escuta a rádio com as crianças"]],
  obj:"Convencer a Zilda a dar paz ao marido antes que aconteça uma tragédia.",
  seg:"Ele tem uma cópia da chave do cadeado. Se o jogador tiver opinião +40, Val pede que o jogador faça o que ele não tem coragem.",
  it:"Pá com o cabo enrolado em fita vermelha",of:"Ensina Carpintaria. Abre a missão de dar paz ao Arnaldo."},
 {id:"mariana",n:"Mariana",i:8,o:"Criança órfã, diabética",g:"igreja",
  h:"Encontrada pela Zilda dentro de um carro de escola na primeira semana. Diabética tipo 1. A última caneta de insulina acabou no dia 9. Desenha a família que perdeu nas paredes da sacristia.",
  p:[30,80,90,0,40],r:[["07:00","Mingau com as outras crianças"],["10:00","Desenha na sacristia"],["15:00","Ajuda a dobrar curativos"],["19:00","Dorme cedo, cansada"]],
  obj:"Ficar perto da Zilda.",
  seg:"Sabe que o 'tio' do porão é o marido da Zilda, porque viu ela descer com o prato. Não contou para ninguém.",
  it:"Mochila de unicórnio",of:"Missão de insulina. Se morrer, dispara o luto da Zilda."},
 {id:"criancas",n:"Theo, Duda e Pedrinho",i:"6–11",o:"Crianças órfãs",g:"igreja",
  h:"Três irmãos de criação que a Zilda achou escondidos numa padaria. Theo (11) quer aprender a atirar, Duda (9) não fala desde o surto, Pedrinho (6) acha que é tudo um acampamento.",
  p:[45,60,85,5,35],r:[["07:00","Mingau"],["09:00","Aula de leitura com o Val"],["14:00","Brincam no salão paroquial"],["20:00","Rádio da Jéssica"]],
  obj:"Theo quer encontrar o pai, que era vigia do shopping.",
  seg:"Theo pegou um revólver .38 sem munição de um policial morto e esconde debaixo do altar.",
  it:"Boné do Theo, do time da cidade",of:"Tratadas como um grupo no simulador. Mudam de base juntas se a igreja cair."},
 // ---------- Delegacia
 {id:"brasa",n:"Tenente Marcos “Brasa” Valença",i:41,o:"Ex-policial militar",g:"deleg",orig:1,
  h:"Comandava a evacuação do bairro. Quando a linha caiu, juntou seis homens e tomou a delegacia, que tem armário de armas e muro alto. Mantém ordem na base com regras rígidas e cobra pedágio de quem passa na avenida.",
  p:[90,25,65,55,45],r:[["05:30","Treino físico com o grupo"],["07:00","Distribui turnos de vigia"],["10:00","Patrulha armada na avenida"],["15:00","Inventário do armamento"],["19:00","Reunião, julga quem quebrou regras"],["23:00","Bebe sozinho no telhado"]],
  obj:"Transformar a delegacia na única autoridade da cidade.",
  seg:"Na evacuação, mandou fechar o portão com civis do lado de fora para salvar os ônibus. Uma das sobreviventes, Jéssica, perdeu a mãe nesse portão.",
  it:"Boina preta do batalhão",of:"Vende munição de .38 e 9 mm, ensina Pistolas. Pode virar inimigo."},
 {id:"bigode",n:"Sargento Cleber “Bigode” Nunes",i:48,o:"Policial militar",g:"deleg",
  h:"Braço direito do Brasa há 15 anos. Executa as punições da reunião das 19h sem perguntar. Engraçado no churrasco, assustador de serviço.",
  p:[75,20,90,60,60],r:[["05:30","Treino com o grupo"],["08:00","Cobra pedágio na avenida"],["13:00","Dorme"],["19:00","Executa as decisões da reunião"],["02:00","Some por duas horas com a viatura"]],
  obj:"Garantir que a família dele, escondida em outra cidade, receba o que ele manda pelo caminhoneiro.",
  seg:"As duas horas de madrugada são para vender munição do arsenal aos Corvos da serra. O Brasa não sabe.",
  it:"Óculos espelhados",of:"Inimigo duro. Se o segredo vazar para o Brasa, os dois se enfrentam."},
 {id:"italo",n:"Soldado Ítalo Prates",i:22,o:"Soldado PM recém-formado",g:"deleg",
  h:"Estava no portão da evacuação e foi quem fechou o cadeado por ordem do Brasa. Não dorme desde então. É o informante anônimo que liga para a rádio da Jéssica às 14h.",
  p:[40,75,35,10,30],r:[["05:30","Treino"],["07:00","Vigia no muro"],["14:00","Some 20 min 'para o banheiro' (rádio portátil)"],["19:00","Reunião, de cabeça baixa"],["22:00","Escreve cartas que não manda"]],
  obj:"Sair da delegacia vivo e contar a verdade.",
  seg:"Foi ele quem fechou o portão com a mãe da Jéssica do lado de fora. A Jéssica não sabe que o informante dela é o homem que ela procura.",
  it:"Apito de metal no pescoço",of:"Ensina Fuzis e carabinas. Pode desertar com a ajuda do jogador."},
 {id:"rafa",n:"Rafaela “Rafa” Duarte",i:36,o:"Escrivã de polícia",g:"deleg",
  h:"A única civil de dentro da delegacia, mantida porque organiza estoque, escala e o livro de ocorrências. Anota tudo, inclusive o que não deveria.",
  p:[45,55,50,20,75],r:[["07:00","Escala de vigia"],["09:00","Inventário de comida e munição"],["14:00","Registra pedágios"],["19:00","Ata da reunião"],["22:00","Lê romances de banca"]],
  obj:"Manter a cabeça baixa até ver para que lado o vento sopra.",
  seg:"Guarda no forro da sala do delegado a lista da evacuação com hora, ordem e nomes de quem ficou do lado de fora. É a prova que a Jéssica precisa.",
  it:"Caneta presa no coque",of:"Fonte de informação. Pode assumir a delegacia se o Brasa cair."},
 // ---------- Rádio
 {id:"jessica",n:"Jéssica Monteiro",i:27,o:"Locutora de rádio comunitária",g:"radio",orig:1,
  h:"Faz uma transmissão diária às 20h com notícias, avisos de hordas e músicas. Virou a voz da cidade. Perdeu a mãe no portão da evacuação e quer justiça.",
  p:[65,80,60,15,40],r:[["09:00","Escuta frequências e anota"],["11:00","Conserta equipamento com gerador"],["14:00","Recebe informantes"],["20:00","Transmissão ao vivo de 30 min"],["22:00","Escreve o roteiro de amanhã"]],
  obj:"Expor o que o Tenente Brasa fez e organizar uma assembleia dos grupos.",
  seg:"O gerador da rádio faz barulho e atrai zumbis. Ela sabe que uma horda grande está se juntando ao pé da torre e não contou a ninguém.",
  it:"Fones de ouvido vermelhos",of:"Avisos de horda no rádio, missões de comunicação. Ensina Elétrica."},
 {id:"nelson",n:"Seu Nelson Kubo",i:63,o:"Radioamador e técnico de TV",g:"radio",
  h:"Montou a antena da Vale FM nos anos 90 e nunca saiu do morro. Mantém o gerador vivo com peças de TV velha. Fala mais com estranhos no rádio do que com gente.",
  p:[35,60,75,15,70],r:[["06:00","Liga o radioamador e varre frequências"],["10:00","Manutenção do gerador"],["13:00","Cozinha arroz para os dois"],["17:00","Sobe na torre e ajusta a antena"],["23:00","Escuta a faixa militar"]],
  obj:"Manter a rádio no ar enquanto houver gente ouvindo.",
  seg:"Fala em segredo com uma soldada presa na base do 7º BIS. Ela pediu para ele não contar: tem medo de que o Brasa vá saquear o paiol.",
  it:"Rádio amador portátil com antena remendada",of:"Ensina Elétrica. Substitui a Jéssica no ar se ela morrer."},
 // ---------- Oficina
 {id:"rosa",n:"Rosa Tavares",i:34,o:"Mecânica de oficina",g:"oficina",orig:1,
  h:"Herdou a oficina do pai. Soldou chapas nas janelas na primeira semana e transformou o lugar em fortaleza. Faz trocas justas, mas não dá nada de graça. Quer consertar um ônibus para tirar todo mundo da cidade.",
  p:[75,50,70,45,80],r:[["07:00","Café preto e checa as armadilhas"],["08:00","Trabalha no ônibus"],["12:00","Abre a janela de troca"],["15:00","Vai buscar peças com quem estiver junto"],["20:00","Escuta rádio e anota informações"]],
  obj:"Terminar o ônibus blindado e achar diesel suficiente.",
  seg:"Ela já tem o diesel guardado, mas só vai revelar a quem tiver opinião +70, porque teme que o Tenente Brasa tome tudo.",
  it:"Macacão azul com nome bordado",of:"Conserta veículos, blinda carros, ensina Mecânica e Metalurgia."},
 {id:"gil",n:"Gilmar “Gil” Batista",i:44,o:"Caminhoneiro",g:"oficina",
  h:"Estava com uma carreta de soja no posto quando a BR fechou. Rosa o aceitou porque ele sabe dirigir pesado. É ele que vai guiar o ônibus. Conta piada ruim e chora escondido.",
  p:[60,65,70,25,50],r:[["07:00","Café com a Rosa"],["08:00","Desmonta a carreta para peças"],["14:00","Treina manobra no pátio"],["18:00","Vigia o portão"],["21:00","Escuta música no rádio da carreta"]],
  obj:"Voltar para Goiânia, onde ficaram a mulher e as filhas.",
  seg:"Leva as cartas do Bigode para fora da cidade numa rota de contrabando. Sabe dos encontros com os Corvos e tem medo de falar.",
  it:"Boné de transportadora e cordão com foto das filhas",of:"Motorista do ônibus. Ensina Direção. Sem ele o ônibus não sai."},
 // ---------- Colégio
 {id:"otavio",n:"Otávio Lins",i:52,o:"Professor de química",g:"colegio",orig:1,
  h:"Ficou trancado no laboratório com três alunos. Dois morreram. Hoje fabrica pólvora, sabão e antisséptico, e troca isso por comida. Bebe álcool de laboratório para dormir.",
  p:[20,70,55,20,25],r:[["08:00","Acorda tarde, com dor de cabeça"],["09:00","Prepara reagentes"],["13:00","Escreve no diário dos alunos mortos"],["16:00","Produz pólvora ou sabão"],["22:00","Bebe e fala sozinho"]],
  obj:"Proteger a aluna que sobrou, Bianca, e conseguir mais enxofre.",
  seg:"Ele sabe fazer explosivos fortes o bastante para derrubar a ponte e isolar a cidade de uma horda, mas tem medo do que o Tenente faria com isso.",
  it:"Óculos de proteção na testa",of:"Ensina Química e recarga de munição, vende pólvora. Pode surtar se a moral cair."},
 {id:"bianca",n:"Bianca Rocha",i:16,o:"Estudante do 2º ano",g:"colegio",
  h:"Única aluna que sobrou no laboratório. Faz a parte do trabalho que o Otávio não consegue mais com as mãos tremendo. Era da mesma turma da Lívia, irmã do Kauã.",
  p:[55,65,80,10,45],r:[["07:00","Busca água na caixa do colégio"],["09:00","Pesa reagentes"],["13:00","Dorme"],["16:00","Embala pólvora"],["21:00","Tira a garrafa do Otávio quando ele dorme"]],
  obj:"Que o professor pare de beber e que alguém leve os dois para longe da quadra.",
  seg:"Foi ela que abriu a porta do laboratório para o colega mordido, Rodrigo, no primeiro dia. Os dois alunos mortos vieram dali. O Otávio acha que a culpa é dele.",
  it:"Jaqueta do colégio com bottons",of:"Aprende rápido. Sabe onde a Lívia foi vista pela última vez."},
 // ---------- Hospital
 {id:"sato",n:"Dr. Henrique Sato",i:45,o:"Médico infectologista",g:"hospital",orig:1,
  h:"Estudava doenças tropicais quando o surto começou. Acha que pode entender a infecção. Mantém zumbis presos para pesquisa e um pequeno grupo de jovens que ele protege em troca de ajuda.",
  p:[60,35,30,40,65],r:[["06:00","Anota o estado dos zumbis presos"],["08:00","Autópsia"],["12:00","Almoça sozinho lendo artigos"],["15:00","Manda o grupo buscar remédios"],["21:00","Grava diário em fita"]],
  obj:"Observar uma pessoa mordida desde o início até a reanimação.",
  seg:"Ele não procura uma cura (a regra do jogo é que não existe). Quer entender como os corredores surgem, e para isso aceita infectar alguém de propósito. A irmã do Kauã está no grupo dele.",
  it:"Gravador de fita no bolso do jaleco",of:"Vende antibiótico e analgésico, revela informações sobre tipos de zumbi. Moralmente perigoso."},
 {id:"livia",n:"Lívia Ferreira",i:14,o:"Estudante, irmã do Kauã",g:"hospital",
  h:"Estava na escola no dia do surto e fugiu com um grupo de alunos até o hospital. O Dr. Sato os acolheu. Acha que o irmão morreu porque ninguém viu a moto dele desde então.",
  p:[50,75,70,5,50],r:[["07:00","Lava roupas da ala"],["10:00","Organiza a farmácia hospitalar"],["15:00","Fica no hospital quando o grupo sai"],["20:00","Escuta a rádio escondida"]],
  obj:"Saber se o irmão está vivo.",
  seg:"Escutou o Dr. Sato no gravador dizendo que 'a mais nova é a candidata mais limpa'. Não entendeu o que significa.",
  it:"Pulseira de miçangas que o Kauã deu",of:"Reencontro com o Kauã. Se ela entrar no grupo, o Kauã também entra."},
 {id:"diego",n:"Diego Paiva",i:24,o:"Técnico de enfermagem",g:"hospital",
  h:"Trabalhava no pronto-socorro na noite do surto. Ficou porque o Sato era o único médico vivo. Lidera as saídas atrás de remédio e é quem coloca as correntes nos zumbis da pesquisa.",
  p:[65,55,45,25,45],r:[["06:00","Ajuda nas anotações"],["09:00","Prende e alimenta os zumbis da ala B"],["15:00","Lidera a saída atrás de remédios"],["20:00","Fica com a Nicole no heliponto"]],
  obj:"Tirar a Nicole do hospital antes que o Sato perca o limite.",
  seg:"Sabe que o Sato quer um voluntário e já viu a lista. O nome da Nicole está primeiro, o da Lívia em segundo.",
  it:"Crachá do pronto-socorro",of:"Ensina Primeiros Socorros. Desertor provável se souber que tem apoio."},
 {id:"nicole",n:"Nicole Andrade",i:20,o:"Estudante de medicina",g:"hospital",
  h:"Estava no 3º ano da faculdade. Admira o Sato e anota as autópsias com ele. Namora o Diego desde o segundo mês.",
  p:[55,60,75,15,60],r:[["06:00","Anota com o Sato"],["08:00","Assiste à autópsia"],["13:00","Estuda os prontuários antigos"],["20:00","Heliponto com o Diego"]],
  obj:"Ajudar o Sato a entender os corredores. Acredita que é ciência.",
  seg:"Se ofereceria como voluntária se o Sato pedisse com as palavras certas. Ele sabe disso.",
  it:"Estetoscópio cor-de-rosa",of:"Ensina Medicina básica. Vítima do experimento se ninguém interferir."},
 // ---------- Nômades
 {id:"kauan",n:"Kauã Ferreira",i:19,o:"Motoboy de entregas",g:"nomade",orig:1,
  h:"Conhece cada beco porque fazia entrega em todos. Sobrevive correndo e não confia em grupo nenhum. Procura a irmã mais nova, que estava na escola no dia do surto.",
  p:[70,60,40,30,50],r:[["06:00","Sai antes do sol para explorar"],["08:00","Saqueia lojas pequenas"],["12:00","Troca itens na igreja ou na oficina"],["16:00","Vai até uma escola diferente procurar a irmã"],["19:00","Sobe em um telhado para dormir"]],
  obj:"Achar a irmã Lívia, que pode estar com o grupo do Dr. Sato.",
  seg:"Ele carrega um rádio que capta a rádio da Jéssica e sabe que tem alguém pedindo socorro do lado norte do rio.",
  it:"Capacete de moto com adesivo de entregas, preso na mochila verde",of:"Revela rotas e esconderijos no mapa, ensina Corrida e Escalada."},
 {id:"biel",n:"Gabriel “Biel” Souza",i:17,o:"Entregador de gás e moleque das lajes",g:"vila",
  h:"Cresceu nas vielas da Vila Esperança e atravessa o bairro inteiro sem pôr o pé no chão, de laje em laje. Disputava ponto de entrega com o Kauã antes do surto. Mora na igreja da Vila porque a Pastora Neide criou ele.",
  p:[80,55,75,35,55],r:[["05:00","Ronda pelas lajes"],["08:00","Troca gás de cozinha por comida"],["13:00","Dorme na laje da igreja"],["17:00","Guia quem precisa atravessar a Vila"],["21:00","Vigia com estilingue"]],
  obj:"Proteger a Vila, mesmo que isso signifique enfrentar a Pastora.",
  seg:"Ele já matou dois dos 'doentes' acorrentados da Pastora, de noite, e disse que eles fugiram.",
  it:"Estilingue de borracha de câmara",of:"Rotas pelas lajes da Vila. Ensina Escalada e Furtividade."},
 // ---------- Vila
 {id:"neide",n:"Pastora Neide Santos",i:50,o:"Pastora evangélica",g:"vila",
  h:"Lidera a igreja da Vila Esperança. Acorrenta os mordidos e os zumbis da comunidade no salão, à vista de todos, e ora por eles todas as noites. Acredita que vão voltar.",
  p:[70,85,80,10,30],r:[["06:00","Culto da manhã"],["09:00","Divide comida entre as famílias"],["14:00","Visita os doentes do salão"],["19:00","Culto com louvor alto"],["22:00","Conta os acorrentados"]],
  obj:"Manter a Vila unida e os doentes vivos até o milagre.",
  seg:"O filho dela, Josué, está entre os acorrentados. Ela sabe que ele não vai voltar, mas não consegue soltar a corrente.",
  it:"Bíblia com capa de couro gasta",of:"Comida dividida, abrigo. Rival da Zilda: as duas acorrentam, uma em segredo e outra às claras."},
 // ---------- Jardim Aurora
 {id:"helena",n:"Helena Vieira",i:31,o:"Arquiteta",g:"aurora",
  h:"Ficou presa num sobrado do Jardim Aurora com o filho Davi, de 6 anos, quando o marido saiu para buscar comida e não voltou. Chama no rádio do marido toda noite. É a voz que o Kauã ouve 'do lado norte do rio'.",
  p:[50,75,85,10,45],r:[["06:00","Olha a rua pela fresta da janela"],["09:00","Racha a comida que sobrou"],["14:00","Desenha plantas das casas vizinhas para saber onde saquear"],["20:00","Chama no rádio"]],
  obj:"Tirar o Davi do sobrado antes da comida acabar.",
  seg:"Desenhou a planta de cada casa da rua com o que viu pela janela: onde tem zumbi, onde tem carro com chave. É um mapa de saque do Jardim Aurora.",
  it:"Sinalizador laranja de carro no bolso",of:"Primeiro resgate do jogo, na área de início. Revela o loot do Jardim Aurora."},
 // ---------- Fabril
 {id:"chico",n:"Francisco “Chico Maranhão”",i:39,o:"Metalúrgico",g:"fabril",
  h:"Operador de prensa que se trancou no depósito de combustível com a chave dos tanques. Vende diesel e gasolina por munição e remédio. Não desliga a linha de produção do galpão vizinho porque o barulho mantém os zumbis longe da porta dele.",
  p:[55,40,40,70,60],r:[["07:00","Mede os tanques"],["10:00","Atende quem vem trocar"],["14:00","Solda reforço no portão"],["18:00","Abastece o gerador da linha"],["22:00","Dorme dentro da guarita"]],
  obj:"Juntar o suficiente para ir embora para o Maranhão.",
  seg:"Os tanques estão quase vazios. Ele vende a mesma reserva para três grupos diferentes.",
  it:"Capacete amarelo de EPI",of:"Combustível. Concorrente da Rosa. Ensina Metalurgia."},
 // ---------- Armas
 {id:"armando",n:"Armando Kessler",i:60,o:"Dono de loja de armas",g:"armas",
  h:"Atirador esportivo, dono da Kessler Armas e Caça há 25 anos. Segurou a porta da loja contra a multidão do segundo dia (os cartuchos no chão e os corpos na calçada são dele). Recusou entregar as armas ao Brasa.",
  p:[85,30,50,50,55],r:[["06:00","Limpa armas"],["09:00","Vigia a rua pela seteira"],["13:00","Recarrega munição na bancada"],["17:00","Negocia pela grade com quem chega"],["22:00","Dorme no depósito blindado"]],
  obj:"Que ninguém encoste no estoque dele, principalmente o Brasa.",
  seg:"Tem diabetes e está racionando a própria insulina. Trocaria uma caneta por munição .308, mas nunca vai admitir que tem.",
  it:"Colete de caça com cartucheira",of:"Vende armas e munição por calibre. Ensina Armeiro. Tem insulina."},
 // ---------- Oeste
 {id:"dito",n:"Seu Benedito “Dito” Alves",i:71,o:"Agricultor e caçador",g:"oeste",orig:1,
  h:"Vive no mesmo sítio há 50 anos. Para ele, o fim do mundo mudou pouco: planta, caça e não gosta de gente da cidade. Tem uma espingarda calibre 12 e um cachorro, Trovão.",
  p:[80,40,90,10,90],r:[["04:30","Ordenha a vaca"],["06:00","Cuida da roça"],["11:00","Almoço no fogão a lenha"],["14:00","Verifica armadilhas na mata"],["18:00","Fecha a porteira e solta o Trovão"],["20:00","Dorme cedo"]],
  obj:"Que deixem ele em paz e que alguém cuide do sítio quando ele morrer.",
  seg:"Enterrou a família inteira no pomar. Se o jogador cuidar do túmulo, ele passa a considerar o jogador como neto e deixa o sítio de herança.",
  it:"Chapéu de palha e o cachorro Trovão",of:"Ensina Agricultura e Caça, troca comida fresca. Base perfeita se ganhar a confiança."},
 {id:"ivone",n:"Ivone Moreira",i:49,o:"Fazendeira",g:"oeste",
  h:"Dona da fazenda vizinha ao Dito, com os filhos Tadeu e Joel. Pregou todas as janelas por dentro e atira em quem chega pela estrada. Já matou dois sobreviventes que achou que eram saqueadores.",
  p:[75,30,85,30,40],r:[["05:00","Galinheiro e curral"],["08:00","Vigia a estrada do alpendre"],["12:00","Almoço com os filhos"],["16:00","Troca com o Dito na cerca"],["20:00","Tranca tudo"]],
  obj:"Que nenhum filho dela morra.",
  seg:"Um dos dois sobreviventes que ela matou era um garoto de 15 anos procurando comida. Está enterrado atrás do silo.",
  it:"Espingarda de dois canos com cabo remendado",of:"Comida em quantidade. Hostil no começo, aliada se o Dito confiar no jogador."},
 {id:"tadeu",n:"Tadeu Moreira",i:22,o:"Filho mais velho dos Moreira",g:"oeste",
  h:"Quer sair da fazenda e conhecer a cidade, mesmo destruída. Faz escondido as trocas com a Rosa, levando ovos e queijo de moto pela estrada de terra.",
  p:[70,60,55,20,55],r:[["05:00","Ordenha com o Joel"],["09:00","Conserta cerca"],["13:00","Sai 'caçar' (vai trocar na oficina)"],["18:00","Volta pela estrada de terra"]],
  obj:"Convencer a mãe a ir no ônibus da Rosa.",
  seg:"Está apaixonado pela Rosa. Ela não sabe.",
  it:"Lenço vermelho no pescoço",of:"Ponte entre os Moreira e a oficina."},
 // ---------- Serra
 {id:"profeta",n:"Wesley “Profeta” Lacerda",i:36,o:"Ex-segurança, líder dos Corvos",g:"serra",
  h:"Fugiu da cadeia pública no dia do surto com outros doze presos e subiu a serra. Diz que o surto é castigo e que os Corvos são os escolhidos para recomeçar. Saqueia sítios e cobra 'dízimo' na BR.",
  p:[85,10,60,85,35],r:[["05:00","Pregação no acampamento"],["08:00","Manda grupos saquearem"],["14:00","Treino de tiro com munição comprada"],["19:00","Divide o saque"],["23:00","Fogueira e vigia"]],
  obj:"Tomar os Sítios do Oeste: comida, água e visão da BR.",
  seg:"Ele não acredita em nada do que prega. Os Corvos têm cada vez menos munição, e o fornecedor dele é um policial da delegacia.",
  it:"Pena preta presa no boné",of:"Antagonista do oeste. Pode ser negociado, enganado ou derrubado."},
 {id:"cida",n:"Dona Aparecida “Cida” Moura",i:74,o:"Raizeira e benzedeira",g:"serra",
  h:"Mora numa cabana perto da cachoeira desde que ficou viúva. Os Corvos a deixam em paz porque ela trata as feridas deles com ervas. Velha amiga do Dito: os dois namoraram aos 17.",
  p:[60,80,70,5,85],r:[["05:00","Colhe ervas na neblina"],["09:00","Seca e moe raízes"],["13:00","Atende quem sobe a trilha"],["17:00","Reza na cachoeira"],["19:00","Dorme"]],
  obj:"Ver o Dito mais uma vez.",
  seg:"Sabe onde os Corvos guardam a munição e o caminho da trilha que chega ao acampamento por trás.",
  it:"Patuá de couro no pescoço",of:"Ervas (antisséptico, analgésico fraco). Informação sobre os Corvos."},
 // ---------- Chegadas
 {id:"taina",n:"Tainá Costa",i:23,o:"Cozinheira, grávida de sete meses",g:"igreja",
  h:"Trabalhava na cozinha de um restaurante da rodoviária. O companheiro, Wellington, sumiu no segundo dia indo buscar a mãe. Ela chega à Matriz no sexto dia com um saco de arroz de 5 kg nas costas e uma barriga de sete meses. Cozinha para todo mundo e conversa com o bebê quando acha que ninguém está ouvindo.",
  p:[45,75,70,15,50],r:[["06:30","Acende o fogão a lenha"],["08:00","Faz o mingau com a Zilda"],["11:00","Cozinha o almoço"],["15:00","Descansa com os pés para cima"],["19:00","Serve a sopa e conta histórias às crianças"]],
  obj:"Ter o bebê debaixo de um teto, com alguém que saiba fazer o parto.",
  seg:"Acha que o Wellington está vivo e anota no caderno do Val cada boato sobre ele. Wellington é um dos zumbis da plataforma 3 da rodoviária, de jaqueta de motoboy.",
  it:"Lenço amarelo na cabeça e barriga de grávida",of:"A comida da base rende 25% mais. Ensina Culinária."},
 {id:"lucas",n:"Lucas “Gaúcho” Kraemer",i:33,o:"Caminhoneiro",g:"oficina",
  h:"Veio do Rio Grande do Sul com uma carreta de remédios que nunca chegou. Largou a carga num bloqueio, pegou uma picape e entrou no vale pela BR-Sul no 20º dia, escoltado pela PRF até a oficina. Conhece o Gil de posto de estrada, fala alto, ri alto e joga truco com quem aceitar.",
  p:[60,40,25,70,45],r:[["07:00","Chimarrão no pátio"],["09:00","Solda as chapas do ônibus"],["13:00","Sai 'atrás de peça' pela avenida"],["17:00","Truco com o Gil"],["22:00","Fuma escondido atrás do muro"]],
  obj:"Juntar munição e cigarro para sair do vale pelo norte.",
  seg:"Deve dinheiro ao Bigode desde antes do surto, de uma carga de contrabando. O Bigode não esqueceu, e cobra no dia 36.",
  it:"Cuia de chimarrão no cinto e boné de transportadora",of:"Dirige qualquer coisa pesada, Mecânica 5, liga caminhão sem chave."},
 // ---------- Bloqueio Norte (Exército)
 {id:"caio",n:"Tenente Caio Albuquerque",i:27,o:"2º Tenente do Exército, 7º BIS",g:"bloqueio",
  h:"Comanda o pelotão que fechou a estrada norte no primeiro dia, com ordem de não deixar ninguém sair do vale até a triagem. A triagem nunca veio. Segura os homens com rotina: barba feita, chamada às 6h e relatório toda noite.",
  p:[70,60,85,10,60],r:[["06:00","Chamada e revista do pelotão"],["08:00","Inspeção da barreira e dos contêineres"],["12:00","Tenta o rádio da base"],["16:00","Treino de tiro com os recrutas"],["21:00","Escreve o relatório que ninguém lê"]],
  obj:"Cumprir a quarentena sem virar assassino de civil.",
  seg:"No dia 3 recebeu pelo rádio a ordem de atirar em qualquer um que tentasse passar. Não repassou aos homens. O Sargento Ferraz ouviu.",
  it:"Boina verde-oliva e mapa topográfico no bolso da gandola",of:"Abre a estrada norte, patrulha de escolta, munição 5,56 e ração operacional."},
 {id:"ferraz",n:"Sargento Edvaldo Ferraz",i:44,o:"1º Sargento do Exército",g:"bloqueio",
  h:"Vinte e dois anos de quartel e duas missões de paz. Os recrutas obedecem a ele antes do tenente. Acha que a quarentena é o que impede o resto do país de acabar igual ao vale, e que um civil morto aqui vale um milhão de vivos lá fora.",
  p:[85,25,60,30,55],r:[["05:00","Ronda nos contêineres"],["07:00","Comanda a barreira"],["12:00","Limpa o fuzil e conta munição"],["18:00","Ronda de viatura na Estrada do Quartel"],["23:00","Vigia a Ponte do Quartel de binóculo"]],
  obj:"Manter a estrada norte fechada, custe o que custar.",
  seg:"Ouviu a ordem de atirar que o tenente escondeu. Para ele, quem desobedece perde o direito de comandar.",
  it:"Capacete balístico com fita de identificação e binóculo no peito",of:"Aliado, treina Fuzis e carabinas. Inimigo, é o atirador mais perigoso do norte."},
 {id:"vinicius",n:"Soldado Vinícius Lopes",i:19,o:"Recruta do Exército",g:"bloqueio",
  h:"Entrou no quartel pelo salário, para ajudar a mãe em Três Pontes. Tinha três meses de farda quando o surto começou. Faz piada no rádio para os outros não ouvirem o medo e guarda uma foto da mãe dentro do capacete.",
  p:[35,70,75,10,35],r:[["06:00","Chamada"],["07:00","Sentinela na barreira"],["13:00","Patrulha a pé na margem do rio"],["19:00","Rancho e piada no rádio"],["22:00","Escreve carta para a mãe"]],
  obj:"Voltar a Três Pontes e achar a mãe.",
  seg:"No dia 8 é mordido na canela na patrulha do rio e esconde com fita e meia. Ninguém sabe.",
  it:"Foto da mãe presa por dentro do capacete",of:"Conta a rotina e as falhas da barreira."},
 // ---------- Posto da PRF
 {id:"lucia",n:"Lúcia Bento",i:38,o:"Policial rodoviária federal",g:"prf",
  h:"Chefe do posto da PRF na BR-Sul, dezesseis anos de rodovia. No dia do surto fechou a pista, abriu o pátio para os carros parados e virou, sem querer, a prefeitura de quem chega pela estrada. Anota cada placa e cada nome no livro de ocorrências.",
  p:[70,75,70,10,70],r:[["06:00","Ronda de viatura até a saída sul de Santa Aurora"],["09:00","Recebe quem chega pela BR"],["13:00","Escolta caravanas até a oficina"],["17:00","Conserta a cerca do pátio"],["21:00","Escuta a rádio e anota no livro"]],
  obj:"Manter a BR aberta e saber quem entra e quem sai do vale.",
  seg:"O livro de ocorrências tem a placa da carreta do Lucas e um alerta de carga de remédios desviada no nome dele.",
  it:"Colete refletivo da PRF por cima do colete balístico",of:"Escolta na BR, notícias de quem chega, viatura e escopeta 12."},
 {id:"douglas",n:"Douglas Prado",i:29,o:"Policial rodoviário federal, motociclista",g:"prf",
  h:"O motociclista mais rápido da BR-Sul. Faz a ronda até o pedágio e volta antes de escurecer. Conta para todo mundo que um dia sai do vale de moto, sozinho, pela serra.",
  p:[75,50,65,20,55],r:[["07:00","Ronda de moto até o pedágio"],["11:00","Tira gasolina de carros parados"],["15:00","Treina escopeta"],["19:00","Baralho com a Lúcia"]],
  obj:"Achar uma trilha pela serra para tirar gente do vale de moto.",
  seg:"Já achou a trilha. Não contou porque acha que só dá para levar uma pessoa por vez.",
  it:"Capacete de moto branco da PRF com faixa amarela",of:"Batedor: revela estradas livres e bloqueios de carros. Moto."},
 // ---------- Penitenciária
 {id:"josue",n:"Josué Freitas",i:46,o:"Policial penal, chefe de plantão",g:"penit",
  h:"Chefe de plantão na penitenciária estadual quando a rebelião e o surto vieram no mesmo dia. A tropa de choque da PM entrou para retomar o pátio e não saiu mais. Ele ficou trancado no bloco C com dois colegas e quarenta presos vivos, e fez um acordo com o Jacaré: os agentes guardam o portão, os presos guardam o muro.",
  p:[60,55,70,15,50],r:[["06:00","Conta presos e agentes"],["08:00","Divide a comida do refeitório"],["12:00","Inspeção das celas e grades"],["18:00","Reunião com o Jacaré no pátio"],["22:00","Dorme com a chave no pescoço"]],
  obj:"Manter o acordo até a comida acabar e depois tirar todo mundo vivo.",
  seg:"O chaveiro dele abre a sala de armas da unidade. O acordo só existe porque o Jacaré não sabe disso.",
  it:"Chaveiro grande das celas no pescoço",of:"Acesso à penitenciária, escopeta e gás lacrimogêneo; mão de obra se o acordo durar."},
 {id:"jacare",n:"Reinaldo “Jacaré” Lima",i:41,o:"Preso, liderança do bloco C",g:"penit",
  h:"Cumpria pena por assalto a carro-forte. Respeitado no pavilhão e sem pressa nenhuma. Foi quem segurou os presos quando os mortos levantaram no pátio, e quem decide quem come primeiro.",
  p:[75,35,55,60,70],r:[["07:00","Conversa com cada cela"],["10:00","Cuida da horta do pátio"],["14:00","Treina os rapazes com escudo do choque"],["18:00","Reunião com o Josué"],["23:00","Escuta o rádio contrabandeado"]],
  obj:"Sair pela porta da frente com os seus e nunca mais voltar.",
  seg:"Tem um celular contrabandeado com carregador solar e fala com o Brasa desde o dia 10. Os dois se conhecem do carro-forte.",
  it:"Bandana vermelha na cabeça e camiseta bege da unidade",of:"Mão de obra, contatos do crime, rota de fuga pela galeria de esgoto."},
 // ---------- Equipe Falcão (forças especiais)
 {id:"lince",n:"Capitão Rodrigo Sá “Lince”",i:36,o:"Forças especiais do Exército",g:"falcao",
  h:"Comandante da Equipe Falcão, mandada de helicóptero no segundo dia para tirar do vale um infectologista e as amostras dele. O helicóptero caiu na Serra do Corvo e o piloto morreu. Ele, uma sargento de saúde e um cabo de comunicações andaram três noites até a cidade e se esconderam no edifício-garagem ao lado do hospital.",
  p:[90,40,95,5,85],r:[["04:30","Reconhecimento antes do sol"],["09:00","Observa o hospital do edifício-garagem"],["14:00","Planeja com Paula e Kevin"],["20:00","Escuta a Vale FM"],["00:00","Tenta o Comando pelo rádio de satélite"]],
  obj:"Cumprir a missão: tirar o Dr. Sato e as amostras do vale.",
  seg:"Se a extração falhar, a ordem é destruir as amostras e o laboratório, com quem estiver dentro.",
  it:"Capacete com óculos de visão noturna e HK416 com supressor",of:"Treina Fuzis e Furtividade; óculos de visão noturna; acesso ao Comando por rádio."},
 {id:"paula",n:"Sargento Paula Neves",i:32,o:"Sargento de saúde, forças especiais",g:"falcao",
  h:"Médica de combate da equipe. Tirou o piloto das ferragens e ficou com ele até o fim. Desde então trata quem aparece, zumbi preso ou bandido, e discute com o capitão sobre o que é a missão.",
  p:[70,85,70,5,70],r:[["05:00","Confere o kit médico"],["08:00","Atende quem chega ao esconderijo"],["13:00","Busca remédio na farmácia da rua"],["19:00","Troca os curativos do Kevin"]],
  obj:"Voltar para a filha em Goiânia sem ter matado nenhum civil.",
  seg:"Sabe da ordem de destruir o laboratório e não vai cumprir se houver gente dentro.",
  it:"Bolsa médica com cruz vermelha e torniquete no ombro",of:"Primeiros Socorros até nível 9, kit médico avançado, amputação a tempo de salvar um mordido."},
 {id:"kevin",n:"Cabo Kevin Araújo",i:24,o:"Comunicações, forças especiais",g:"falcao",
  h:"O mais novo da equipe, de Manaus. Carrega o rádio de satélite nas costas e um fone só, para ouvir a rua com o outro ouvido. Foi ele quem achou a frequência da Vale FM e o rádio secreto da Cabo Renata.",
  p:[55,65,80,10,50],r:[["06:00","Monta a antena no telhado"],["10:00","Varre frequências"],["15:00","Conserta rádios em troca de comida"],["21:00","Fala com a Renata na faixa militar"]],
  obj:"Fazer o rádio de satélite falar com o Comando de novo.",
  seg:"O Comando respondeu uma vez, no dia 30. Ele foi o único que ouviu a mensagem inteira.",
  it:"Rádio de satélite nas costas com antena dobrável",of:"Rádios, frequências militares, conserto de eletrônicos."},
 // ---------- Base
 {id:"renata",n:"Cabo Renata Lobo",i:29,o:"Atiradora do Exército",g:"base",
  h:"Estava na torre de vigia quando a triagem da base virou massacre. Ficou lá em cima com um fuzil, 200 cartuchos e caixas de ração. Atira em zumbi e em quem tenta pular a cerca. Só fala com o Nelson, pelo rádio, à noite.",
  p:[80,45,90,15,50],r:[["05:00","Conta os zumbis na cerca"],["08:00","Racha água e ração"],["12:00","Dorme em turnos de 2 h"],["18:00","Atira em quem se aproxima do paiol"],["23:00","Rádio com o Nelson"]],
  obj:"Sair viva da torre sem entregar o paiol a quem vai usá-lo mal.",
  seg:"Tem a chave do paiol (classe D do mapa) e o código da torre de comunicação da base.",
  it:"Fuzil com fita camuflada e nome na coronha",of:"Acesso ao paiol e à torre de comunicação. Fim de jogo."},
 {id:"azevedo",n:"Major Hélio Azevedo",i:52,o:"Subcomandante do 7º BIS (zumbi)",g:"base",
  h:"Comandou a triagem na base no primeiro dia e foi mordido abrindo o portão para os civis. Reanimou dentro do bunker de comando e a porta blindada trancou atrás dele. Ainda leva no peito o cartão de acesso do paiol e da sala de rádio.",
  p:[0,0,0,0,0],r:[["24h","Anda em círculos no bunker de comando"]],
  obj:"Nenhum. É um Brutamonte fardado, de colete e capacete.",
  seg:"O cartão no peito abre o paiol pelo lado de dentro, sem a chave da Renata.",
  it:"Cartão de acesso vermelho no cordão e boina de oficial",of:"Quem o abate leva o cartão do bunker. Caminho alternativo para o fim de jogo."}
];
const EXTRA=[{id:"vitoria",n:"Vitória Costa",i:0,o:"Bebê, filha da Tainá",g:"igreja",born:1}];

// ligações: tipo fam (família/amor), ali (confiança), odio (ódio/rivalidade), seg (segredo/dívida), medo
const RELS=[
 ["zilda","arnaldo","fam","casada há 44 anos"],["zilda","mariana","fam","cuida como neta"],["zilda","criancas","fam","cuida dos três"],["zilda","val","ali","braço direito"],
 ["val","arnaldo","seg","tem a cópia da chave"],["mariana","arnaldo","seg","viu o prato descer"],["zilda","neide","odio","duas igrejas, duas correntes"],["zilda","sato","odio","não perdoa o que ele faz com os presos"],
 ["brasa","bigode","ali","15 anos juntos"],["brasa","italo","medo","Ítalo obedece por medo"],["brasa","rafa","seg","ela guarda a lista"],["brasa","jessica","odio","o portão"],
 ["italo","jessica","seg","é o informante dela e fechou o portão"],["bigode","profeta","seg","vende munição aos Corvos"],["gil","bigode","seg","leva as cartas dele"],
 ["brasa","rosa","odio","quer o diesel"],["brasa","armando","odio","quer as armas dele"],["brasa","otavio","medo","Otávio teme o que ele faria com explosivo"],
 ["jessica","nelson","ali","dividem a torre"],["nelson","renata","seg","rádio secreto com a base"],["kauan","jessica","ali","ouve todas as transmissões"],["helena","jessica","ali","pedido de socorro no ar"],
 ["rosa","gil","ali","ele vai dirigir o ônibus"],["rosa","nelson","ali","anota o que a rádio diz"],["rosa","chico","odio","disputa por combustível"],["tadeu","rosa","fam","apaixonado por ela"],
 ["otavio","bianca","fam","protege como filha"],["bianca","livia","ali","mesma turma"],["kauan","livia","fam","irmãos"],["livia","sato","medo","ouviu o gravador"],
 ["diego","sato","seg","viu a lista"],["nicole","sato","ali","admira o médico"],["diego","nicole","fam","namorados"],["kauan","biel","odio","rivais de entrega"],
 ["neide","biel","fam","criou o menino"],["dito","ivone","ali","vizinhos de cerca"],["ivone","tadeu","fam","mãe e filho"],["dito","profeta","odio","quer o sítio"],
 ["dito","cida","fam","namoro antigo"],["cida","profeta","seg","trata os Corvos e sabe onde está a munição"],
 ["taina","zilda","ali","a Zilda vai fazer o parto"],["taina","val","ali","anota os boatos no caderno dele"],["lucas","gil","ali","amigos de posto de estrada"],["lucas","bigode","seg","dívida de contrabando"],
 ["lucia","lucas","seg","a placa no livro de ocorrências"],["lucia","rosa","ali","escolta as caravanas"],["douglas","lucia","ali","parceiros de posto"],["caio","ferraz","odio","a ordem escondida"],
 ["caio","vinicius","ali","protege o recruta"],["ferraz","vinicius","medo","o recruta teme o sargento"],["caio","renata","ali","mesma unidade, rádio mudo"],["josue","jacare","seg","o acordo do bloco C"],
 ["jacare","brasa","seg","celular e o carro-forte"],["lince","sato","seg","a missão é ele"],["paula","lince","odio","o que é a missão"],["kevin","renata","ali","faixa militar à noite"],
 ["kevin","nelson","ali","trocam peças de rádio"],["lince","profeta","odio","os Corvos saquearam o helicóptero"],["azevedo","renata","seg","o cartão e a chave do paiol"]
];
const RELTYPES={fam:["Família ou amor","#e0a548"],ali:["Confiança","#7fae73"],odio:["Ódio ou rivalidade","#c4483b"],seg:["Segredo ou dívida","#b58ad6"],medo:["Medo","#6fa3c7"]};

const JOIN=[
 ["Helena Vieira","Resgatada no sobrado até o dia 10","Planta do Jardim Aurora com loot marcado; Davi (criança, não luta)","Se Davi morrer, ela sai do grupo ou se entrega à horda"],
 ["Kauã e Lívia","Jogador leva o Kauã ao hospital e tira a Lívia","Rotas, mapa revelado, Corrida e Escalada","Kauã sai se o grupo deixar alguém para trás (memória “deixou para trás”)"],
 ["Soldado Ítalo","Jogador cobre a deserção no dia 33","Fuzil, Fuzis e carabinas, cópias da lista da Rafa","Se a Jéssica descobrir quem fechou o portão, um dos dois sai"],
 ["Otávio e Bianca","Jogador traz enxofre e tira o álcool do laboratório","Pólvora, recarga de munição, explosivo para a ponte","Moral do grupo abaixo de 30: Otávio volta a beber"],
 ["Diego e Nicole","Jogador expõe o plano do Sato antes do dia 45","Antibiótico, Primeiros Socorros, Medicina","Nicole pode querer voltar para o Sato se ele pedir"],
 ["Dito (não sai do sítio)","Túmulo cuidado + opinião 80","O sítio inteiro como base, comida, Caça","Se o jogador trouxer o Brasa ou os Corvos ao sítio"],
 ["Tenente Caio (com o pelotão)","Vinícius tratado a tempo (dia 8) e Bloqueio aberto (dia 52)","Escolta armada, ração, munição 5,56, passagem pelo norte","Se o jogador atirar em soldado do Bloqueio"],
 ["Sargento Paula","Equipe Falcão desfeita e opinião 60","Primeiros Socorros 9, kit médico avançado","Se o jogador matar civil desarmado na frente dela"],
 ["Josué","Acordo do bloco C mantido (dia 26)","Escopeta, gás, chaves da penitenciária","Se o jogador trouxer o Brasa ou soltar o Jacaré"]
];

const STATES=[["ok","vivo","Segue a rotina"],["ferido","ferido","Rotina reduzida, risco ×2"],["mordido","mordido","48 h até reanimar"],["zumbi","zumbi nomeado","Vaga pela rotina antiga"],["morto","morto","Corpo e item ficam no lugar"],["sumido","sumido","Capturado ou perdido; pode voltar"],["grupo","com o jogador","Mora na base do jogador"],["hostil","hostil","Ataca ou rouba o jogador"],["mudou","mudou de base","Vive em outro grupo"],["partiu","saiu do vale","Sobreviveu fora do mapa"]];
const STLBL=Object.fromEntries(STATES.map(s=>[s[0],s[1]]));

const ACTS=[
 {id:"helena",n:"Resgatar Helena e Davi no Jardim Aurora",w:"até o dia 10"},
 {id:"vinicius",n:"Notar a mordida do Vinícius e avisar o Tenente Caio",w:"até o dia 8 (Primeiros Socorros 3 percebe a febre e o mancar)"},
 {id:"insulina",n:"Levar insulina para a Mariana",w:"até o dia 14 (farmácia hospitalar ou a caneta do Armando)"},
 {id:"otavio",n:"Trazer enxofre e tirar o álcool do Otávio",w:"até o dia 18"},
 {id:"arnaldo",n:"Dar paz ao Seu Arnaldo, com a chave do Val",w:"até o dia 22"},
 {id:"radio",n:"Avisar a Jéssica da horda ao pé da torre",w:"até o dia 25"},
 {id:"penit",n:"Levar comida e remédio ao bloco C da penitenciária",w:"até o dia 25"},
 {id:"kauan",n:"Levar o Kauã ao hospital atrás da Lívia",w:"até o dia 28"},
 {id:"italo",n:"Cobrir a deserção do Ítalo",w:"até o dia 33"},
 {id:"diesel",n:"Contar ao Brasa onde está o diesel da Rosa",w:"até o dia 40 (escolha ruim)"},
 {id:"sato",n:"Expor o plano do Dr. Sato ao grupo do hospital",w:"até o dia 45"},
 {id:"dito",n:"Cuidar do túmulo da família do Dito",w:"até o dia 55"},
 {id:"ponte",n:"Derrubar a Ponte Velha com os explosivos do Otávio",w:"até o dia 60 (Otávio vivo)"}
];

/* ---------- pontos de virada ---------- */
const LIVE=["ok","ferido","grupo","hostil","mudou"];
const L=(S,id)=>LIVE.includes(S[id].st);
const START_Z={arnaldo:"acorrentado no porão",azevedo:"trancado no bunker de comando"};
function mk(){const S={};NPCS.concat(EXTRA).forEach(n=>{S[n.id]=START_Z[n.id]?{st:"zumbi",nt:START_Z[n.id],b:n.g}:n.born?{st:"nao",nt:"",b:n.g}:{st:"ok",nt:"",b:n.g}});return S}
const EV=[
 {d:1,t:"Quarentena no norte",who:["caio","ferraz","vinicius"],run:()=>({txt:"O pelotão do Tenente Caio fecha a estrada norte com contêineres e arame. Ordem: ninguém sai do vale até a triagem. Quem chega perto ouve tiro de advertência."})},
 {d:2,t:"O helicóptero cai na serra",who:["lince","paula","kevin","profeta"],run:()=>({txt:"O helicóptero da Equipe Falcão cai na Serra do Corvo. O piloto morre. Os Corvos chegam aos destroços antes da equipe voltar e levam um fuzil e duas caixas de munição.",fl:{corvosArmados:1}})},
 {d:3,t:"Pedido de socorro no Jardim Aurora",who:["helena","jessica","kauan"],run:(S,A,F)=>({txt:"Helena chama no rádio do marido, presa num sobrado com o filho. Jéssica repete o pedido na transmissão das 20h; Kauã também ouve."})},
 {d:6,t:"Tainá chega à Matriz",who:["taina","zilda"],run:()=>({txt:"Tainá chega à igreja grávida de sete meses, com um saco de arroz nas costas. A Zilda conta nos dedos: o bebê nasce no fim do mês que vem."})},
 {d:8,t:"A canela do recruta",who:["vinicius","caio","ferraz"],run:(S,A)=>A.vinicius?{alt:1,txt:"Avisado, o Tenente Caio isola o recruta num contêiner. Vinícius dita uma carta para a mãe e pede para não virar um deles. Caio cumpre o pedido sozinho, ao amanhecer, e os homens passam a confiar nele.",ch:[["vinicius","morto","enterrado na barreira, com a foto"]],fl:{caioFirme:1}}
   :{txt:"Vinícius é mordido na canela na patrulha do rio e esconde a ferida com fita e meia.",ch:[["vinicius","mordido","esconde a mordida"]]}},
 {d:10,t:"Helena tenta sair sozinha",who:["helena"],run:(S,A,F)=>A.helena?{alt:1,txt:"O jogador chegou antes. Helena e Davi entram no grupo, com a planta da rua desenhada.",ch:[["helena","grupo","com Davi"]]}
   :{txt:"Sem comida, Helena sai com Davi no colo. É mordida no portão; Davi corre e chega à igreja.",ch:[["helena","mordido","mordida no portão"]],fl:{davi:1}}},
 {d:10,t:"A noite no contêiner",who:["vinicius","caio","ferraz"],run:(S)=>S.vinicius.st!=="mordido"?null:{txt:"Vinícius reanima de madrugada no contêiner dos recrutas e morde o Tenente Caio no braço antes de o Ferraz atirar.",ch:[["vinicius","morto","abatido pelo Ferraz"],["caio","mordido","mordida no braço"]]}},
 {d:11,t:"O sargento assume",who:["caio","ferraz"],run:(S)=>S.caio.st!=="mordido"?null:{txt:"Ferraz lê em voz alta a ordem que o tenente escondeu e dá paz a ele antes que reanime. A partir de hoje, quem tentar passar pelo norte leva tiro.",ch:[["caio","morto","enterrado ao lado da barreira"],["ferraz","ok","comanda o Bloqueio"]],fl:{ferrazManda:1}}},
 {d:12,t:"Helena reanima",who:["helena"],run:(S)=>S.helena.st!=="mordido"?null:{txt:"Zumbi nomeado na rua das Acácias, com o sinalizador laranja no bolso.",ch:[["helena","zumbi","rua das Acácias, sinalizador no bolso"]]}},
 {d:14,t:"Mariana sem insulina",who:["mariana","zilda","armando"],run:(S,A)=>A.insulina?{alt:1,txt:"O jogador trouxe insulina. Mariana estabiliza e a Zilda passa a confiar no jogador (+30).",ch:[]}
   :{txt:"Mariana entra em crise. A Zilda passa a noite em claro e esquece de descer ao porão.",ch:[["mariana","ferido","crise de glicose"]]}},
 {d:14,t:"A Falcão chega ao hospital",who:["lince","paula","kevin","nelson"],run:(S)=>({txt:"A Equipe Falcão se esconde no edifício-garagem ao lado do hospital. Kevin acha a frequência da Vale FM"+(L(S,"renata")?" e, por ela, o rádio secreto da Cabo Renata.":".")})},
 {d:16,t:"Mariana morre",who:["mariana","zilda"],run:(S,A)=>A.insulina?null:{txt:"Mariana morre na sacristia. Val abre a cova; Zilda não sai do lado do caixão improvisado.",ch:[["mariana","morto","enterrada atrás da igreja"],["zilda","ok","de luto"]],fl:{lutoZilda:1}}},
 {d:18,t:"Otávio perde o controle",who:["otavio","bianca"],run:(S,A)=>A.otavio?{alt:1,txt:"Com enxofre e sem o álcool, Otávio retoma a produção de pólvora e para de falar sozinho.",ch:[]}
   :{txt:"Bêbado, Otávio derruba um frasco e o laboratório pega fogo. Bianca apaga com o extintor; ele fica com queimaduras nas mãos.",ch:[["otavio","ferido","queimaduras nas mãos"]]}},
 {d:20,t:"Um gaúcho na BR-Sul",who:["lucas","lucia","gil"],run:(S)=>!L(S,"lucia")?null:{txt:"Lúcia para uma picape no posto da PRF: Lucas, caminhoneiro gaúcho, sem carga e sem nota. Ela anota a placa no livro e escolta a picape até a oficina. Gil abraça o homem como irmão de estrada."}},
 {d:22,t:"O porão da igreja",who:["arnaldo","zilda","val","criancas"],run:(S,A,F)=>{
   if(A.arnaldo&&S.arnaldo.st==="zumbi")return {alt:1,txt:"Com a chave do Val e a permissão da Zilda, o jogador dá paz ao Arnaldo. Ela enterra o marido com o relógio.",ch:[["arnaldo","morto","enterrado com o relógio"]]};
   if(F.lutoZilda&&L(S,"zilda"))return {txt:"De luto, Zilda esquece o cadeado aberto. Arnaldo arranca a argola da parede e morde a esposa na escada. Val o mata com a pá, tarde demais, e se corta na briga.",ch:[["zilda","mordido","mordida no braço"],["arnaldo","morto","morto pelo Val"],["val","ferido","corte na mão"]]};
   return null}},
 {d:24,t:"A igreja sem a Zilda",who:["zilda","criancas","val","taina"],run:(S,A,F)=>S.zilda.st!=="mordido"?null:{txt:"Zilda reanima de manhã. Val tranca o portão e leva as crianças e a Tainá para a igreja da Vila, com a Pastora Neide.",ch:[["zilda","zumbi","volta à igreja às 6h, com o terço"],["criancas","mudou","na igreja da Vila","vila"],["val","mudou","na igreja da Vila","vila"]].concat(L(S,"taina")?[["taina","mudou","na igreja da Vila","vila"]]:[]),fl:{igrejaCaiu:1}}},
 {d:25,t:"Horda ao pé da torre",who:["jessica","nelson"],run:(S,A)=>A.radio?{alt:1,txt:"Avisada, Jéssica desliga o gerador a tempo e leva a rádio para a caixa d'água do Colégio. A transmissão continua.",ch:[["jessica","ok","rádio no Colégio"],["nelson","ok","rádio no Colégio"]]}
   :{txt:"A horda derruba o portão da torre durante a transmissão das 20h. Jéssica morre no ar. Nelson foge ferido para a oficina da Rosa.",ch:[["jessica","zumbi","ao pé da torre, de fones vermelhos"],["nelson","ferido","escondido na oficina","oficina"]],fl:{radioMuda:1}}},
 {d:26,t:"O acordo do bloco C",who:["josue","jacare"],run:(S,A)=>A.penit?{alt:1,txt:"Com a comida e os remédios do jogador, o acordo da penitenciária se mantém. Josué e Jacaré dividem o comando e abrem o portão para troca uma vez por semana.",ch:[],fl:{penitFeira:1}}
   :{txt:"A comida acaba no bloco C. Jacaré descobre que o chaveiro do Josué abre a sala de armas, toma as escopetas e solta os rapazes. Josué foge ferido pela estrada e chega ao posto da PRF.",ch:[["josue","ferido","no posto da PRF","prf"],["jacare","hostil","comanda a penitenciária armada"]],fl:{penitArmada:1}}},
 {d:28,t:"Kauã entra no hospital",who:["kauan","livia","sato"],run:(S,A)=>A.kauan?{alt:1,txt:"Com o jogador, Kauã acha a Lívia na ala isolada. Os dois saem pela lavanderia e entram no grupo.",ch:[["kauan","grupo",""],["livia","grupo",""]]}
   :{txt:"Sozinho, Kauã é pego pelos rapazes do Sato e trancado na ala B. Lívia não fica sabendo.",ch:[["kauan","sumido","preso na ala B do hospital"]]}},
 {d:30,t:"O laboratório",who:["otavio","bianca"],run:(S,A)=>A.otavio?{alt:1,txt:"Otávio pede para se juntar ao grupo do jogador e leva Bianca e o estoque de pólvora.",ch:[["otavio","grupo",""],["bianca","grupo",""]]}
   :{txt:"Otávio bebe álcool metílico do estoque e não acorda. Bianca leva o diário dos alunos para o hospital.",ch:[["otavio","morto","no laboratório"],["bianca","mudou","no hospital, com o Sato","hospital"]]}},
 {d:30,t:"A mensagem do Comando",who:["kevin","lince","paula"],run:(S)=>!L(S,"kevin")?null:{txt:"O rádio de satélite fala pela primeira vez. Só o Kevin ouve tudo: a extração foi cancelada e a ordem é queimar o laboratório do hospital com as amostras.",fl:{ordemQueima:1}}},
 {d:33,t:"Ítalo quer desertar",who:["italo","brasa","rafa"],run:(S,A)=>A.italo?{alt:1,txt:"O jogador cobre a fuga. Ítalo sai de madrugada com as cópias da Rafa: a lista de quem ficou do lado de fora do portão.",ch:[["italo","grupo","com as cópias da lista"]],fl:{provas:1}}
   :{txt:"Brasa descobre o plano na reunião das 19h. Ítalo é posto para fora do muro sem arma. A Rafa assiste da janela.",ch:[["italo","morto","na avenida, em frente à delegacia"]]}},
 {d:36,t:"A dívida do Lucas",who:["lucas","bigode","brasa"],run:(S)=>L(S,"lucas")&&L(S,"bigode")&&L(S,"brasa")&&S.lucas.b==="oficina"?{txt:"Bigode cobra a dívida antiga do Lucas: perdoa tudo em troca de saber onde a Rosa esconde o diesel. Lucas conta.",fl:{lucasContou:1}}:null},
 {d:38,t:"O parto",who:["taina","zilda","cida","biel","neide"],run:(S)=>{
   if(!L(S,"taina"))return null;const b=S.taina.b;
   if(b==="igreja"&&["ok","ferido"].includes(S.zilda.st))return {alt:1,txt:"Zilda faz o parto na sacristia, com água fervida e o terço no pulso. Nasce Vitória, quase 3 kg, chorando alto. As crianças escolhem o nome.",ch:[["vitoria","ok","nasceu na Matriz","igreja"]]};
   if(b==="vila"&&L(S,"cida"))return {txt:"Sem a Zilda, a Pastora Neide manda o Biel correr até a serra buscar a Dona Cida. A raizeira desce a trilha de noite e faz o parto no salão da Vila, na frente dos acorrentados. Nasce Vitória. Neide e Cida, que nunca tinham se falado, passam a madrugada rezando cada uma do seu jeito.",ch:[["vitoria","ok","nasceu na igreja da Vila","vila"]],fl:{cidaVila:1}};
   return {txt:"Sem parteira, o parto dura a noite inteira. Tainá não resiste. A menina vive e "+(b==="vila"?"a Pastora Neide":"o Val")+" fica com ela.",ch:[["taina","morto","no parto"],["vitoria","ok","órfã, chamada de Vitória",b]]}}},
 {d:40,t:"O diesel da oficina",who:["brasa","rosa","gil","bigode","nelson","lucas"],run:(S,A,F)=>{
   if(!L(S,"brasa")||!L(S,"rosa"))return null;const luc=L(S,"lucas")&&S.lucas.b==="oficina"&&F.lucasContou;
   if(A.diesel)return {txt:"O jogador contou ao Brasa onde está o diesel. Ele leva tudo sem disparar um tiro. Rosa descobre quem contou.",ch:[["rosa","hostil","odeia o jogador"]],fl:{dieselPerdido:1}};
   if(F.provas)return {alt:1,txt:"Rafa avisa a oficina pelo rádio do Ítalo. O ataque cai numa emboscada: Bigode morre no pátio, Brasa recua ferido."+(luc?" Lucas foge para a delegacia antes do primeiro tiro.":""),ch:[["bigode","morto","no pátio da oficina"],["brasa","ferido","tiro no ombro"]].concat(luc?[["lucas","mudou","na delegacia, com o Brasa","deleg"]]:[])};
   return {txt:(luc?"Brasa entra pelo portão que o Lucas deixou destrancado. ":"Brasa toma a oficina à noite. ")+"Gil morre defendendo o portão, Rosa leva um tiro na perna e o diesel vai para a delegacia.",ch:[["gil","morto","no portão da oficina"],["rosa","ferido","tiro na perna"]].concat(luc?[["lucas","mudou","na delegacia, com o Brasa","deleg"]]:[]),fl:{dieselPerdido:1}}}},
 {d:45,t:"O experimento",who:["sato","nicole","diego","kauan","bianca"],run:(S,A)=>{
   if(A.sato){const ch=[["diego","mudou","na igreja da Vila","vila"],["nicole","mudou","na igreja da Vila","vila"],["sato","hostil","sozinho com os presos"]];
     if(S.kauan.st==="sumido")ch.push(["kauan","ok","solto da ala B"]);if(S.bianca.st==="mudou")ch.push(["bianca","mudou","na igreja da Vila","vila"]);
     return {alt:1,txt:"O jogador mostra a lista ao grupo. Diego e Nicole fogem com antibióticos e soltam quem estava preso. Sato fica sozinho.",ch}}
   return {txt:"Sato pede um voluntário com as palavras certas. Nicole aceita. Ele a infecta e anota cada hora. Diego foge na mesma noite.",ch:[["nicole","mordido","inoculada pelo Sato"],["diego","sumido","fugiu sem rumo"]]}}},
 {d:46,t:"Fogo na ala isolada",who:["lince","paula","kevin","sato","nicole","kauan"],run:(S,A,F)=>{
   if(!F.ordemQueima||!L(S,"lince"))return null;
   if(S.sato.st==="hostil")return {alt:1,txt:"A Falcão entra na ala isolada para cumprir a ordem. Sozinho, Sato avança com uma seringa contra o capitão e leva um tiro. Paula não deixa queimar a ala com os presos dentro.",ch:[["sato","morto","na ala isolada, com o gravador"]]};
   const ch=[],t=["Lince invade a ala isolada com a ordem de queimar tudo."];
   if(S.nicole.st==="mordido"){ch.push(["nicole","morto","Paula fechou os olhos dela"]);t.push("Paula dá paz à Nicole antes que ela reanime.")}
   if(L(S,"kevin")){ch.push(["kevin","morto","de guarda na porta da ala"]);t.push("Uma maca se solta no corredor: Kevin é mordido no pescoço e pede para ficar de guarda na porta enquanto o fogo sobe.")}
   if(L(S,"sato")){ch.push(["sato","sumido","fugiu pelos túneis da lavanderia"]);t.push("Sato foge pelos túneis da lavanderia com o gravador.")}
   if(S.kauan.st==="sumido"){ch.push(["kauan","ok","solto pela Falcão","nomade"]);t.push("Na ala B, a equipe acha o Kauã e o solta.")}
   if(S.bianca.st==="mudou"&&S.bianca.b==="hospital")ch.push(["bianca","mudou","fugiu do fogo para a Vila","vila"]);
   return {txt:t.join(" "),ch,fl:{hospitalQueimado:1}}}},
 {d:47,t:"Nicole reanima",who:["nicole","sato"],run:(S)=>S.nicole.st!=="mordido"?null:{txt:"Reanima como Corredor em 3 minutos. Sato grava: 'é o primeiro dado limpo'.",ch:[["nicole","zumbi","Corredor de jaleco, solto no hospital"]]}},
 {d:48,t:"Velas de ignição",who:["tadeu","rosa"],run:(S)=>L(S,"tadeu")&&["ok","ferido"].includes(S.rosa.st)?{txt:"Tadeu aparece na oficina com uma caixa de velas de ignição embrulhada em jornal. Rosa ri pela primeira vez desde o ataque e aceita ver o pôr do sol do telhado com ele.",fl:{casalRT:1}}:null},
 {d:50,t:"Assembleia dos grupos",who:["jessica","brasa","rafa","italo","jacare"],run:(S,A,F)=>{
   if(L(S,"jessica")&&F.provas&&L(S,"brasa")){const ch=[["brasa","hostil","expulso, foi para a serra","serra"],["rafa","ok","lidera a delegacia"]];if(L(S,"lucas")&&S.lucas.b==="deleg")ch.push(["lucas","hostil","subiu a serra com o Brasa","serra"]);
     return {alt:1,txt:"Jéssica transmite a lista. Os grupos votam e a Rafa abre o portão por dentro: Brasa perde a delegacia e sobe a serra.",ch,fl:{brasaSerra:1}}}
   if(L(S,"brasa"))return {txt:"Sem voz ou sem provas, ninguém enfrenta o Brasa. A delegacia passa a cobrar comida de todos os grupos do Centro."+(F.penitArmada&&L(S,"jacare")?" Pelo celular, o Jacaré fecha com ele: a penitenciária manda homens, a delegacia manda diesel.":""),ch:[["brasa","ok","domina o Centro"]],fl:{brasaDomina:1}};
   return null}},
 {d:52,t:"Dois comandos no Bloqueio",who:["lince","paula","ferraz","caio"],run:(S,A,F)=>{
   if(!L(S,"lince"))return null;
   if(F.ferrazManda&&L(S,"ferraz"))return {txt:"Sem missão, Lince e Paula sobem a Estrada do Quartel para se juntar ao Bloqueio. O capitão exige o comando. Ferraz atira primeiro: Lince morre na barreira e Paula foge ferida para o posto da PRF.",ch:[["lince","morto","na barreira do norte"],["paula","ferido","no posto da PRF","prf"]],fl:{bloqueioHostil:1}};
   if(L(S,"caio"))return {alt:1,txt:"Lince e Paula chegam ao Bloqueio. Caio e o capitão juntam os homens e mudam a ordem: o norte vira ponto de triagem, não muro. Quem passar sem mordida segue escoltado.",ch:[["lince","mudou","no Bloqueio Norte","bloqueio"],["paula","mudou","enfermaria do Bloqueio","bloqueio"]],fl:{bloqueioAberto:1}};
   return null}},
 {d:55,t:"Os Corvos descem da serra",who:["profeta","ivone","tadeu","brasa"],run:(S,A,F)=>({txt:"Os Corvos atacam a fazenda dos Moreira pela estrada"+(F.corvosArmados?", com o fuzil tirado do helicóptero":"")+". Tadeu morre na porteira; Ivone se fecha no celeiro com o Joel."+(F.brasaSerra?" Brasa está com eles.":"")+(F.casalRT?" Na oficina, Rosa sobe no ônibus inacabado e não desce por dois dias.":""),
   ch:[["tadeu","morto","na porteira dos Moreira"],["ivone","ferido","fechada no celeiro"]].concat(F.brasaSerra?[["brasa","hostil","com os Corvos"]]:[])})},
 {d:57,t:"A viatura na fazenda",who:["lucia","douglas","ivone"],run:(S)=>L(S,"lucia")&&S.ivone.st==="ferido"?{txt:"Lúcia e Douglas chegam de viatura depois do ataque e levam Ivone e o Joel para o posto da PRF.",ch:[["ivone","mudou","no posto da PRF, com o Joel","prf"]]}:null},
 {d:58,t:"Sítio Boa Vista",who:["dito","profeta","ivone"],run:(S,A)=>A.dito?{alt:1,txt:"Dito trata o jogador como neto e chama ajuda pelo rádio. Os Corvos recuam do sítio com dois mortos. Ivone e Joel se mudam para o Boa Vista.",ch:[["dito","ok","sítio será herança do jogador"],["ivone","ok","mora no Boa Vista","oeste"]]}
   :{txt:"Os Corvos tomam o sítio. Dito atira até o último cartucho; Trovão foge para a mata e passa a vigiar o pomar.",ch:[["dito","morto","no alpendre do sítio"]],fl:{corvosOeste:1}}},
 {d:60,t:"Horda migratória na Ponte Velha",who:["armando","neide","biel","zilda","criancas"],run:(S,A)=>{
   if(A.ponte&&L(S,"otavio"))return {alt:1,txt:"Os explosivos do Otávio derrubam a Ponte Velha. Uns 1.800 zumbis se acumulam na outra margem. O ônibus da Rosa vai precisar da Ponte Férrea.",ch:[]};
   const ch=[["armando","zumbi","na porta da loja, de colete de caça"],["neide","mordido","mordida soltando o filho"],["biel","ok","lidera a Vila Esperança"]];
   return {txt:(A.ponte?"Sem o Otávio, ninguém sabe montar a carga. ":"")+"Cerca de 1.800 zumbis atravessam a ponte para o Centro. A loja do Armando cai. Na Vila, os acorrentados da Pastora se soltam no tumulto."+(S.vitoria.st==="ok"&&S.vitoria.b==="vila"?" Biel leva a bebê Vitória para a laje mais alta.":""),ch}}},
 {d:62,t:"Depois da horda",who:["neide","cida","profeta"],run:(S,A,F)=>{const ch=[];let t=[];
   if(S.neide.st==="mordido"){ch.push(["neide","zumbi","no salão, com a Bíblia"]);t.push("Neide reanima entre os acorrentados.")}
   if(F.corvosOeste){ch.push(["cida","morto","na cabana da cachoeira"]);t.push("Os Corvos sobem a trilha atrás de ervas e matam Dona Cida.")}
   return ch.length?{txt:t.join(" "),ch}:null}},
 {d:63,t:"Ataque ao posto da PRF",who:["lucia","douglas","profeta","jacare"],run:(S,A,F)=>{
   if(!F.corvosOeste||!L(S,"lucia")||S.lucia.b!=="prf")return null;
   const ch=[["douglas","morto","no pátio do posto"]];NPCS.forEach(n=>{if(n.id!=="douglas"&&L(S,n.id)&&S[n.id].b==="prf")ch.push([n.id,"mudou","na oficina, depois do ataque ao posto","oficina"])});
   return {txt:"Os Corvos descem a BR atrás da viatura e das armas do posto"+(F.penitArmada&&L(S,"jacare")?", com presos do Jacaré na carroceria":"")+". Douglas segura o pátio de moto até o último cartucho de escopeta. Lúcia sai pelos fundos com todo mundo que estava no posto e leva para a oficina.",ch,fl:{prfCaiu:1}}}},
 {d:66,t:"Chico vende o resto",who:["chico","rosa"],run:(S)=>["ok","ferido"].includes(S.rosa.st)?{txt:"Rosa compra o que sobrou do diesel do Chico com chapas do ônibus e leva ele para a oficina.",ch:[["chico","mudou","na oficina","oficina"]]}:null},
 {d:68,t:"O bloco C",who:["josue","jacare","brasa"],run:(S,A,F)=>{
   if(F.penitFeira)return {alt:1,txt:"A penitenciária vira feira: sabão de cadeia e verdura da horta em troca de remédio. Josué e Jacaré mandam três rapazes reforçar o muro da oficina.",ch:[]};
   if(F.penitArmada&&L(S,"jacare"))return {txt:"Jacaré desce para o Centro com os presos armados e cobra a parte dele dos saques."+(F.brasaDomina?" Agora o Centro tem dois pedágios.":""),ch:[]};
   return null}},
 {d:70,t:"O ônibus blindado",who:["rosa","gil","lucas","nelson","chico","tadeu"],run:(S,A,F)=>{
   const mot=L(S,"gil")?"Gil":(L(S,"lucas")&&S.lucas.b==="oficina")?"Lucas":null;
   const ok=["ok","ferido"].includes(S.rosa.st)&&mot&&!F.dieselPerdido;
   if(!ok)return {txt:"O ônibus nunca sai. "+(F.dieselPerdido?"Sem diesel":"Sem motorista")+", vira mais uma barricada no pátio.",ch:[]};
   const pool=["rosa","gil","lucas","nelson","chico","criancas","val","mariana","zilda","tadeu","diego","nicole","bianca","livia","kauan","taina","vitoria","lucia","josue","paula"].concat(F.casalRT?["ivone"]:[]);
   const go=pool.filter(id=>["ok","ferido","mudou"].includes(S[id].st)&&(id!=="lucas"||S.lucas.b==="oficina"));
   return {alt:1,txt:"O ônibus sai pela "+(A.ponte?"Ponte Férrea":"Ponte Velha")+" com "+go.length+" pessoas a bordo e "+mot+" no volante. Quem estava com o jogador fica."+(F.casalRT&&go.includes("ivone")?" Rosa guardou um lugar para a mãe do Tadeu.":"")+(F.bloqueioAberto?" Uma viatura do Bloqueio Norte escolta até a serra.":""),ch:go.map(id=>[id,"partiu","no ônibus da Rosa"])}}},
 {d:72,t:"A ala B",who:["sato","kauan"],run:(S,A,F)=>{
   if(S.sato.st==="hostil")return {txt:"Sozinho, Sato é mordido ao trocar a corrente de um preso.",ch:[["sato","mordido","mordido por um preso"]]};
   if(S.sato.st==="ok"&&S.kauan.st==="sumido")return {txt:"Sato começa o segundo experimento com o preso da ala B.",ch:[["kauan","mordido","inoculado pelo Sato"]]};
   if(S.sato.st==="sumido"&&F.penitArmada&&L(S,"jacare"))return {txt:"Sato aparece no portão da penitenciária e oferece ao Jacaré “uma arma que não precisa de bala”.",ch:[["sato","mudou","no bloco C, com o Jacaré","penit"]],fl:{satoPenit:1}};
   return null}},
 {d:74,t:"Reanimações no hospital",who:["sato","kauan"],run:(S)=>{const ch=[];
   if(S.sato.st==="mordido")ch.push(["sato","zumbi","de jaleco, com o gravador no bolso"]);
   if(S.kauan.st==="mordido")ch.push(["kauan","zumbi","Corredor de capacete, na ala B"]);
   return ch.length?{txt:"O hospital ganha mais um zumbi com nome.",ch}:null}},
 {d:75,t:"O galpão desperta",who:["chico"],run:(S)=>L(S,"chico")&&S.chico.st!=="mudou"?{txt:"A linha de produção acorda a horda dormente do galpão. Chico é mordido tentando desligar o gerador.",ch:[["chico","mordido","no galpão"]]}:null},
 {d:77,t:"Chico reanima",who:["chico"],run:(S)=>S.chico.st!=="mordido"?null:{txt:"Zumbi nomeado de capacete amarelo no pátio do depósito.",ch:[["chico","zumbi","de capacete amarelo, no depósito"]]}},
 {d:80,t:"Sinal da base",who:["renata","nelson","jessica","kevin"],run:(S,A,F)=>{
   const ouve=L(S,"jessica")||L(S,"nelson")||L(S,"kevin");
   if(ouve&&F.bloqueioAberto)return {alt:1,txt:"Cabo Renata pede ajuda da torre do 7º BIS. O Bloqueio Norte ouve e manda uma viatura pela Estrada do Quartel: Renata desce da torre escoltada, com a chave do paiol.",ch:[["renata","mudou","no Bloqueio Norte, com a chave do paiol","bloqueio"]]};
   return ouve?{alt:1,txt:"Cabo Renata pede ajuda da torre do 7º BIS. A rádio retransmite: abre a missão da base e do paiol.",ch:[["renata","ok","espera resgate na torre"]]}
     :{txt:"Cabo Renata chama a noite toda. Ninguém responde.",ch:[]}}},
 {d:85,t:"Os Corvos",who:["profeta","dito"],run:(S,A,F)=>{
   if(A.dito&&L(S,"dito"))return {alt:1,txt:"Os Corvos voltam ao sítio para vingança e caem nas armadilhas do Dito. Profeta morre no pomar.",ch:[["profeta","morto","no pomar do Boa Vista"]]};
   if(F.corvosOeste)return {txt:"Os Corvos controlam o oeste e cobram dízimo na BR.",ch:[["profeta","ok","domina o oeste"]]};
   return null}},
 {d:88,t:"A torre do 7º BIS",who:["renata"],run:(S)=>S.renata.st==="ok"&&!L(S,"jessica")&&!L(S,"nelson")&&!L(S,"kevin")?{txt:"Sem água, Cabo Renata desce da torre à noite e não volta.",ch:[["renata","morto","ao pé da torre"]]}:null}
];
EV.sort((a,b)=>a.d-b.d);

/* ---------- fardados: facções armadas, patentes, equipamento ---------- */
const FACT=[
 {k:"eb",n:"Exército Brasileiro · 7º BIS",c:"#7d8a6a",onde:"Base 7º BIS (caída), Bunker de comando, Bloqueio Norte, Ponte do Quartel, Estrada do Quartel",
  quem:["caio","ferraz","vinicius","renata","azevedo"],gen:"6 soldados vivos no Bloqueio; cerca de 2.000 zumbis fardados na base",
  faz:"Quarentena. Contêineres e arame na estrada norte, sentinela 24 h, patrulha a pé em dupla na margem do rio e de jipe Maruá AM2 na Estrada do Quartel. Troca munição e ração por comida e notícia na barreira.",
  jog:"Tiro de advertência a 150 m, ordem de parar a 30 m, revista de mordida. Atira para matar quem cruza a faixa sem ordem.",
  fases:"Ordem (dias 1–10) → desgaste: rádio mudo, fome, recruta mordido (10–50) → ponto de triagem que escolta civis, ou pedágio armado do Ferraz (50+)"},
 {k:"pm",n:"Polícia Militar · Delegacia do 4º DP e Choque",c:"#c4483b",onde:"Delegacia do 4º DP, viaturas paradas nas avenidas, pátio da penitenciária (Choque)",
  quem:["brasa","bigode","italo"],gen:"4 PMs genéricos na delegacia; 30 zumbis da tropa de choque no pátio da penitenciária",
  faz:"Pedágio na avenida, ronda de viatura com sirene desligada, arsenal classe D. Disciplina por medo do Brasa.",
  jog:"Cobra pedágio, revista e confisca arma longa. Abaixo de −20 de reputação, atira em quem para na avenida.",
  fases:"Polícia que ainda manda (1–40) → toma o diesel (40) → domina o Centro ou perde a delegacia para a Rafa na assembleia (50)"},
 {k:"pc",n:"Polícia Civil",c:"#b58ad6",onde:"Cartório e depósito de armas apreendidas do 4º DP",quem:["rafa"],gen:"1 delegado zumbi trancado no cartório",
  faz:"Guarda papel: a lista do portão, inquéritos, o livro de armas apreendidas. Não patrulha.",jog:"Rafa só fala com quem chega sem arma na mão.",
  fases:"Escrivã escondida (1–33) → cópias da lista saem com o Ítalo (33) → Rafa assume a delegacia (50, se a lista for ao ar)"},
 {k:"prf",n:"Polícia Rodoviária Federal",c:"#e0c341",onde:"Posto da PRF na BR-Sul, na saída sul de Santa Aurora, pedágio",quem:["lucia","douglas"],gen:"2 policiais rodoviários genéricos",
  faz:"Mantém a BR aberta: retira carros da pista, registra quem chega no livro de ocorrências, escolta caravanas até a oficina, batedor de moto.",
  jog:"Amigável até prova em contrário. Registra o jogador e oferece escolta pela BR por comida ou combustível.",
  fases:"Posto aberto (1–55) → recebe refugiados do oeste (57) → os Corvos atacam o posto se tomarem o sítio do Dito (63)"},
 {k:"pp",n:"Polícia Penal · Penitenciária estadual",c:"#a3836a",onde:"Penitenciária, bloco C, Estrada da Penitenciária",quem:["josue","jacare"],gen:"2 policiais penais e 40 presos (6 como agentes, o resto como número da base)",
  faz:"Acordo frágil: agentes no portão, presos no muro. Horta no pátio, sabão de cadeia, escudos do Choque reaproveitados.",
  jog:"Com acordo, feira semanal no portão. Sem acordo, presos armados que descem ao Centro e cobram parte dos saques.",
  fases:"Acordo (1–25) → feira, se o jogador levar comida, ou rebelião armada (26) → aliança com o Brasa (50) ou com a oficina (68)"},
 {k:"fe",n:"Forças especiais · Equipe Falcão",c:"#5fb0a0",onde:"Destroços do Falcão Negro HM-2 na Serra do Corvo, edifício-garagem ao lado do hospital",quem:["lince","paula","kevin"],gen:"Piloto morto nos destroços, com equipamento",
  faz:"Reconhecimento noturno, tiro suprimido, rádio de satélite. Missão: tirar o Dr. Sato e as amostras do vale; plano B: queimar o laboratório.",
  jog:"Não aparecem para ninguém até o dia 14. Contratam o jogador para entrar no hospital; Paula trata quem o jogador trouxer.",
  fases:"Queda (2) → esconderijo (14) → ordem de queimar o laboratório (30) → fogo na ala isolada (46) → se juntam ao Bloqueio ou morrem nele (52)"},
 {k:"tat",n:"Unidades táticas de fora · BOPE, COT, GATE",c:"#9aa0a6",onde:"Atego Forte de escolta capotado na Estrada da Penitenciária, pátio da penitenciária",quem:[],gen:"Nenhuma equipe viva na temporada: 4 zumbis de escolta tática no carro-forte, 30 do Choque no pátio",
  faz:"No dia do surto, uma escolta tática transferia presos e a tropa de choque entrou para conter a rebelião. Nenhuma das duas saiu.",
  jog:"São saque de alto risco: zumbis de colete III-A e capacete, que pedem tiro no rosto, por baixo da viseira, ou na nuca.",
  fases:"Fora da temporada de 90 dias: se o rádio de satélite falar com o Comando e o Bloqueio estiver aberto, um comboio de fora vira evento de fim de jogo"}
];
const RANKS=[
 ["Exército","Soldado → Cabo → 3º, 2º e 1º Sargento → Subtenente → Aspirante → 2º e 1º Tenente → Capitão → Major → Tenente-Coronel → Coronel","Vinícius (Soldado), Renata (Cabo), Ferraz (1º Sargento), Caio (2º Tenente), Lince (Capitão), Azevedo (Major)"],
 ["Polícia Militar","Soldado → Cabo → 3º, 2º e 1º Sargento → Subtenente → Aspirante → 2º e 1º Tenente → Capitão → Major → Tenente-Coronel → Coronel","Ítalo (Soldado), Bigode (Sargento), Brasa (Tenente, expulso)"],
 ["Polícia Civil","Agente → Escrivão → Investigador → Delegado","Rafa (Escrivã)"],
 ["PRF","Policial rodoviário federal, por classe e tempo de casa; chefe de posto por função","Lúcia (chefe do posto), Douglas"],
 ["Polícia Penal","Policial penal → chefe de plantão → diretor","Josué (chefe de plantão)"]
];
const RANKRULE="No jogo, patente decide quem manda quando o líder cai (maior patente viva com coragem + lealdade ≥ 100) e o que um soldado obedece. Ordem de patente maior vence opinião, a menos que a opinião do soldado pelo superior esteja abaixo de −20: aí ele desobedece, deserta ou se amotina.";
// cat: arma | protecao | equip | consumo | chave | documento | troca
const LOOT=[
 ["farda_eb","Farda camuflada do Exército","eb","protecao","Bloqueio, soldados e zumbis fardados","Na mata e no campo, −15% na distância em que zumbis e humanos te veem. Soldados do Bloqueio não atiram de longe em quem está fardado.","comum"],
 ["capacete_bal","Capacete balístico","eb","protecao","Bloqueio, zumbis fardados (30%)","Cabeça: reduz 1 nível de dano de bala e bloqueia mordida no topo da cabeça.","incomum"],
 ["colete_iii","Colete com placa nível III","eb","protecao","Bloqueio, paiol da base","Tronco −50% de dano de bala, 60% de chance de bloquear mordida no tronco. 9 kg: estamina cai 20% mais rápido.","raro"],
 ["ia2","Fuzil IMBEL IA2 5,56","eb","arma","Bloqueio, paiol, zumbis fardados (10%, desgastado)","Ficha no Arsenal.","incomum"],
 ["fal","FN FAL / ParaFAL 7,62","eb","arma","Bloqueio (Ferraz), paiol","Ficha no Arsenal.","incomum"],
 ["minimi","FN Minimi","eb","arma","Torre de vigia da Renata, paiol","Ficha no Arsenal. Defesa de base.","lendário"],
 ["m67","Granada M67","eb","arma","Paiol, Bloqueio (2 por dupla)","Ficha no Arsenal e efeito no Laboratório de Explosões.","raro"],
 ["fumaca","Granada de fumaça","eb","equip","Bloqueio, viaturas do Exército","Cortina de 12 m por 40 s. Zumbis e atiradores perdem a linha de visão.","incomum"],
 ["racao_militar","Ração operacional","eb","consumo","Bloqueio, base, mochilas de soldado","Um dia inteiro de fome, com esquentador químico. Validade de 12 meses. Moeda forte no norte.","comum"],
 ["aph","Kit individual de primeiros socorros (APH)","eb","consumo","Soldados, Falcão, viaturas","Torniquete e gaze hemostática: para sangramento grave em 5 s.","incomum"],
 ["ht","Rádio portátil (HT)","eb","equip","Bloqueio, delegacia, PRF, Falcão","Fala com quem estiver na mesma faixa, até 5 km. Bateria de 12 h.","incomum"],
 ["plaqueta","Plaqueta de identificação","eb","documento","Todo soldado vivo ou zumbi","Sem valor de troca. Entregar a quem conhecia o soldado dá +10 de opinião e uma entrada no diário.","comum"],
 ["mapa_topo","Mapa topográfico marcado","eb","documento","Caio, bunker de comando","Revela trilhas, o túnel da serra e as posições de horda conhecidas.","raro"],
 ["binoculo_mil","Binóculo militar 7×50","eb","equip","Ferraz, torre da base","Zoom 7× sem fazer barulho. Vê o item marcado de um zumbi nomeado a 200 m.","incomum"],
 ["cartao_bunker","Cartão de acesso do bunker","eb","chave","Peito do Major Azevedo (zumbi)","Abre a porta externa do bunker, a sala de rádio e o paiol por dentro, sem a chave da Renata. O cofre interno pede o código do bunker (6 dígitos em 3 papéis, catálogo de Itens).","único"],
 ["chave_paiol","Chave do paiol","eb","chave","Cabo Renata","Abre o paiol classe D da base.","único"],
 ["colete_iia","Colete policial nível II-A","pm","protecao","Delegacia, viaturas, PMs zumbis","Tronco −30% de dano de bala, 60% de chance de bloquear mordida no tronco. 3 kg.","incomum"],
 ["pt100","Taurus PT100 .40","pm","arma","Delegacia, PMs zumbis","Ficha no Arsenal.","incomum"],
 ["smt9","Taurus SMT9 9×19","pm","arma","Porta-malas de viatura (trava com chave)","Ficha no Arsenal.","incomum"],
 ["pump","CBC Pump Military 3.0","pm","arma","Viaturas, penitenciária, PRF","Ficha no Arsenal.","comum"],
 ["t4","Taurus T4 5,56","pm","arma","Arsenal da delegacia","Ficha no Arsenal.","incomum"],
 ["algemas","Algemas","pm","equip","Viaturas, delegacia, penitenciária","Prende humano rendido. Prende um zumbi Lento num poste ou grade: não mata, segura.","comum"],
 ["tonfa","Tonfa","pm","arma","Viaturas, Choque","Arma branca de bloqueio: empurra zumbi sem gastar estamina de golpe.","comum"],
 ["lanterna_tat","Lanterna tática","pm","equip","Viaturas, Falcão, PRF","Acopla no trilho da arma. Zumbis veem a luz a 40 m.","incomum"],
 ["escudo","Escudo balístico do Choque","pm","protecao","Pátio da penitenciária (zumbis do Choque)","Bloqueia agarrão frontal e empurra zumbis. Movimento −40%, só arma de uma mão.","raro"],
 ["capacete_choque","Capacete do Choque com viseira","pm","protecao","Pátio da penitenciária","Bloqueia mordida no rosto. Visão periférica −20%.","incomum"],
 ["gas","Granada de gás lacrimogêneo","pm","arma","Penitenciária, delegacia","Humanos tossem e saem da área por 20 s. Zumbis não reagem.","incomum"],
 ["chave_viatura","Chave de viatura","pm","chave","Quadro de chaves da delegacia, bolso de PM zumbi","Liga a Cruzi Patrulha da Frota. Sirene ligada chama horda num raio de 250 m: serve de isca.","incomum"],
 ["distintivo","Distintivo da Polícia Civil","pc","documento","Rafa, cartório","Sem valor de troca. Abre conversa com a Rafa.","raro"],
 ["lista_portao","Pasta com a lista do portão","pc","documento","Rafa, depois Ítalo","Prova contra o Brasa. Levada à rádio, muda a assembleia do dia 50.","único"],
 ["chave_deposito","Chave do depósito de armas apreendidas","pc","chave","Cartório do 4º DP (delegado zumbi)","Abre um depósito com armas variadas e munição desencontrada.","único"],
 ["colete_refl","Colete refletivo da PRF","prf","protecao","Posto da PRF","Visível a 200 m: humanos amigáveis reconhecem de longe; zumbis também, à noite.","comum"],
 ["pente_pregos","Pente de pregos e cones","prf","equip","Posto da PRF, viatura","Barreira de estrada: fura pneu de qualquer veículo e faz zumbi tropeçar.","incomum"],
 ["livro_ocorr","Livro de ocorrências da PRF","prf","documento","Mesa da Lúcia","Lista quem entrou no vale: revela bases e genéricos com vínculo.","único"],
 ["mapa_rod","Mapa rodoviário com bloqueios marcados","prf","documento","Posto, viatura","Mostra carros parados e rotas livres na BR e nas estradas.","incomum"],
 ["kit_desenc","Kit de desencarceramento","prf","equip","Viatura da PRF","Corta-cinto e quebra-vidro: tira alguém preso num carro em 3 s.","incomum"],
 ["chave_moto","Chave da moto da PRF","prf","chave","Douglas","GZ 1250 Rodoviária da PRF: rápida e barulhenta.","único"],
 ["chaveiro_c","Chaveiro do bloco C","pp","chave","Josué","Abre celas, portões e a sala de armas da penitenciária.","único"],
 ["estoque","Estoque (faca artesanal)","pp","arma","Presos, celas","Arma branca fraca e rápida. Quebra em 15 golpes.","comum"],
 ["celular_contrabando","Celular contrabandeado com carregador solar","pp","equip","Jacaré, celas","Fala com quem tiver outro celular (o Brasa tem). Ouve conversas dos dois.","raro"],
 ["cigarro","Maço de cigarro","pp","troca","Celas, viaturas, mochilas","Moeda preferida na penitenciária e no Bloqueio.","comum"],
 ["sabao","Sabão de cadeia","pp","troca","Penitenciária com feira","Limpa sangue seco de roupa e para-brisa; troca por comida.","comum"],
 ["hk416","HK416 com supressor","fe","arma","Lince, destroços do helicóptero","Ficha no Arsenal.","muito raro"],
 ["nvg","Óculos de visão noturna","fe","equip","Lince, piloto morto nos destroços","Enxerga 60 m no escuro sem lanterna. Bateria de 6 h.","muito raro"],
 ["radio_sat","Rádio de satélite","fe","equip","Kevin","Fala com o Comando de fora. Abre o evento de extração depois da temporada.","único"],
 ["gps","GPS militar","fe","equip","Falcão, piloto","Marca até 10 pontos no mapa e mostra a posição do grupo.","raro"],
 ["c4","Carga de demolição","fe","arma","Mochila do Lince, paiol","Derruba porta blindada ou ponte pequena. Efeito no Laboratório de Explosões.","muito raro"],
 ["kit_med","Kit médico avançado","fe","consumo","Paula","Sutura, soro e antibiótico. Com a Paula, a amputação de um mordido em até 60 s salva 30% em vez de 15%.","raro"],
 ["maleta","Maleta térmica das amostras","fe","documento","Laboratório do Sato","Item de missão. Quem a entrega ao Lince decide o fim do arco do hospital.","único"],
 ["colete_iiia","Colete tático III-A com porta-carregadores","tat","protecao","Zumbis da escolta tática","Tronco −40% de dano de bala, 60% de chance de bloquear mordida no tronco, 6 carregadores à mão (recarga 20% mais rápida).","raro"],
 ["mp5","HK MP5A3","tat","arma","Carro-forte de escolta","Ficha no Arsenal.","incomum"]
];
const LCAT={arma:"Arma",protecao:"Proteção",equip:"Equipamento",consumo:"Consumo",chave:"Chave",documento:"Documento",troca:"Troca"};
const GENT=[
 ["Soldado do Exército","eb","IA2 ou FAL, 3 carregadores, capacete, colete II-A, ração, plaqueta, HT a cada dupla","Sentinela e patrulha em dupla. Fogo controlado, mira na cabeça até 50 m, recua quando a munição cai abaixo de 20%."],
 ["Zumbi fardado","eb","Farda, capacete (30%), colete (50%, danificado), carregador parcial (20%), plaqueta","Variante pesada do Arsenal: 160 a 250 de vida, tronco blindado. Arma pendurada no ombro, nunca dispara."],
 ["PM de patrulha","pm","PT100 .40, SMT9 ou Pump, colete II-A, algemas, HT, chave de viatura","Pedágio e ronda. Abre fogo em grupo e chama reforço pelo rádio."],
 ["PM do Choque (zumbi)","pm","Escudo, capacete com viseira, colete, Pump, tonfa, gás","Bloqueia tiro de frente com o escudo. Tiro na nuca ou por baixo da viseira."],
 ["Escolta tática BOPE, COT ou GATE (zumbi)","tat","MP5A3 ou T4, colete III-A, capacete, lanterna tática, algemas","Os mais blindados do vale. Ficam no carro-forte capotado e acordam com barulho de motor."],
 ["Policial rodoviário","prf","Pump ou T4, colete balístico e refletivo, HT, kit de desencarceramento","Escolta e ronda de estrada. Ajuda civil cercado se a reputação for 20 ou mais."],
 ["Policial penal","pp","Pump, gás, algemas, chaves de ala","Guarda de portão. Só sai da unidade em grupo de três."],
 ["Preso","pp","Estoque, cigarro, às vezes escudo do Choque","Defende o muro. Obedece ao Jacaré; reputação própria, separada da dos agentes."],
 ["Operador das forças especiais","fe","HK416 suprimido, NVG, GPS, APH, C4","Só a Falcão. Movimento furtivo, tiro suprimido a 25 m de ruído, prioridade a cumprir a missão."]
];

/* ---------- camada 3: vida sorteada (nascimentos, chegadas, laços, brigas, traições, caravanas, ataques) ---------- */
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const FEM=new Set(["zilda","mariana","rafa","jessica","rosa","bianca","livia","nicole","neide","helena","ivone","cida","renata","taina","lucia","paula","vitoria"]);
const REG={igreja:.008,deleg:.008,radio:.006,oficina:.005,colegio:.004,hospital:.008,vila:.004,aurora:.002,fabril:.005,armas:.008,oeste:.002,serra:.0015,base:.02,nomade:.006,bloqueio:.005,prf:.004,penit:.006,falcao:.007};
const EXPO={kauan:.8,biel:.6,gil:.5,lucas:.5,lince:.6,paula:.5,kevin:.5,douglas:.6,lucia:.5,profeta:.5,dito:.4,tadeu:.4,ferraz:.4,caio:.3,bigode:.4,brasa:.3,italo:.4,chico:.4,armando:.2,zilda:.1,nelson:.2,jessica:.2,renata:.1,criancas:.05,mariana:.05,livia:.2,taina:.1};
const NM={m:["João","Paulo","Marcos","André","Rafael","Thiago","Bruno","Luiz","Sérgio","Wagner","Cícero","Edson","Igor","Mateus","Renan","Hugo"],f:["Ana","Patrícia","Juliana","Camila","Sandra","Luana","Márcia","Fernanda","Aline","Rita","Jaqueline","Simone","Larissa","Bruna","Tereza","Vanessa"],s:["Silva","Santos","Oliveira","Souza","Pereira","Lima","Carvalho","Gomes","Ribeiro","Martins","Rocha","Almeida","Barbosa","Teixeira","Moraes","Cunha"],
 bm:["Davi","Miguel","Gael","Bento","Noah","Theo"],bf:["Esperança","Aurora","Cecília","Luna","Maria Luz","Alice"]};
const RELW={m:["irmão","primo","ex-aluno","vizinho","colega de trabalho","afilhado","filho"],f:["irmã","prima","ex-aluna","vizinha","colega de trabalho","afilhada","filha"]};
const HOSTB=F=>({deleg:!!F.brasaDomina,serra:true,penit:!!F.penitArmada,bloqueio:!!F.bloqueioHostil});
const CAP=104,ROOM=8;
const COUPLES=[["diego","nicole"],["zilda","arnaldo"]];
let GEN={};
const NICK={ferraz:"Ferraz",lince:"Lince",azevedo:"Major Azevedo",sato:"Dr. Sato",criancas:"as crianças da Zilda",armando:"Armando",jacare:"Jacaré",profeta:"Profeta"};
const short=n=>{const q=n.match(/“(.*?)”/);if(q)return q[1];return n.replace(/^(Dona|Seu|Dr\.|Tenente|Sargento|Soldado|Pastora|Cabo|Capitão|Major) /,"").split(" ")[0]};
function world(){const W={raid:{},food:{},def:{},aff:{},part:{},rival:{},adot:{},T:{},gen:{},n:0,last:{},st:{nasc:0,cheg:0,mort:0,casais:0,brigas:0,trai:0,carav:0,ataques:0,gravidez:0}};
 Object.entries(GROUPS).forEach(([k,g])=>{W.food[k]=g.food;W.def[k]=g.def});W.def.jogador=1;
 RELS.forEach(r=>{if(r[2]==="odio")W.rival[r[0]<r[1]?r[0]+"|"+r[1]:r[1]+"|"+r[0]]=1});
 COUPLES.forEach(([a,b])=>{W.part[a]=b;W.part[b]=a});W.used=new Set();return W}
function life(d,S,F,R,W,log){
 const P=id=>byId[id]||W.gen[id];
 const age=id=>{const i=P(id).i;return typeof i==="number"?i:8};
 const fem=id=>FEM.has(id)||(W.gen[id]&&W.gen[id].f);
 const nm=id=>NICK[id]||short(P(id).n);
 const o=id=>fem(id)?"a":"o";
 const pers=id=>P(id).p&&P(id).p.some(v=>v)?P(id).p:[50,50,50,50,50];
 const anchor=id=>EV.some(e=>e.who.includes(id)&&e.d>d&&e.d<=d+7)||!!(W.T[id]&&W.T[id].due)||(id==="taina"&&d<38)||!!(W.gen[id]&&W.gen[id].baby);
 const alive=id=>["ok","ferido","mudou","hostil"].includes(S[id].st);
 const ids=Object.keys(S).filter(id=>alive(id)&&age(id)>0);
 const set=(id,st,nt,b)=>{const c=S[id].st;if(["morto","partiu"].includes(c)||(c==="zumbi"&&st!=="morto"))return;S[id]={st,nt,b:b||S[id].b}};
 const say=(t,txt,ch,b)=>{log.push({d,t,txt,ch:ch||[],emg:1});if(b)W.last[b]=d};
 const kill=(id,nt,why)=>{set(id,"morto",nt);W.st.mort++;const p=W.part[id];if(p&&alive(p))return ` ${nm(p)} perde ${nm(id)}.`;return ""};
 const cnt=b=>Object.keys(S).filter(id=>alive(id)&&S[id].b===b).length;
 const pop=()=>Object.keys(S).filter(id=>alive(id)||S[id].st==="grupo").length;
 const key=(a,b)=>a<b?a+"|"+b:b+"|"+a;
 const aff=(a,b)=>{const k=key(a,b);if(W.aff[k]===undefined){const r=RELS.find(r=>(r[0]===a&&r[1]===b)||(r[0]===b&&r[1]===a));W.aff[k]=r?{fam:80,ali:60,odio:-60,seg:10,medo:-20}[r[2]]:10+((pers(a)[1]+pers(b)[1])/2-50)/5}return W.aff[k]};
 const addAff=(a,b,v)=>{const k=key(a,b);W.aff[k]=Math.max(-100,Math.min(100,aff(a,b)+v))};
 const pick=a=>a[Math.floor(R()*a.length)];
 const bestBase=()=>{const H=HOSTB(F);const c=Object.keys(GROUPS).filter(b=>b!=="nomade"&&b!=="base"&&!H[b]&&cnt(b)>0&&cnt(b)<ROOM);c.sort((a,b)=>W.food[b]*(.5+W.def[b])-W.food[a]*(.5+W.def[a]));return c.length?c[Math.floor(R()*Math.min(3,c.length))]:"nomade"};
 const newP=(o)=>{const id="g"+(++W.n);W.gen[id]=o;S[id]={st:"ok",nt:o.nt||"",b:o.g};GEN[id]=o;return id};

 if(F.casalRT&&!W.part.rosa&&!W.part.tadeu){W.part.rosa="tadeu";W.part.tadeu="rosa"}
 // 1. relógios: cura, reanimação, volta de sumido, parto
 Object.entries(W.T).forEach(([id,t])=>{
  if(t.heal===d&&S[id].st==="ferido")S[id].nt="curado";
  if(t.heal===d&&S[id].st==="ferido")S[id].st="ok";
  if(t.turn===d&&S[id].st==="mordido"){set(id,"zumbi",S[id].b==="nomade"?"zumbi nomeado na rua":"zumbi nomeado perto de "+(GROUPS[S[id].b]||{n:"onde morreu"}).n);say("Reanima",`${nm(id)} reanima e passa a vagar pela rotina antiga.`,[[id,"zumbi",S[id].nt]],S[id].b)}
  if(t.back===d&&S[id].st==="sumido"){if(R()<.6){set(id,"ok","voltou depois de sumir");say("Volta",`${nm(id)} aparece no portão, magro e sem as botas, depois de dias sumido.`,[[id,"ok","voltou"]])}else{const x=kill(id,"nunca voltou");say("Sem volta",`Acham as coisas de ${nm(id)} numa vala da estrada.${x}`,[[id,"morto","nunca voltou"]])}}
  if(t.due===d){t.due=0;if(!alive(id))return;const b=S[id].b;
   const med=["zilda","diego","paula","cida","sato","nicole"].some(m=>S[m]&&alive(m)&&S[m].b===b);
   const pm=med?.03:.15,pb=med?.05:.2;const dad=t.dad,sx=R()<.5?"f":"m";
   const bn=sx==="f"?pick(NM.bf):pick(NM.bm);
   const momDies=R()<pm&&!anchor(id),babyDies=R()<pb;
   let txt=`${nm(id)} dá à luz em ${(GROUPS[b]||{n:"campo aberto"}).n}${med?" com ajuda de quem sabe":", sem ninguém que saiba fazer parto"}.`;const ch=[];
   if(babyDies)txt+=" O bebê não respira. Enterram ao lado da base.";
   else{const bid=newP({n:bn+" "+P(id).n.split(" ").filter(x=>!/[“”]/.test(x)).slice(-1)[0],i:0,g:b,f:sx==="f",baby:1,mom:id,dad});W.st.nasc++;txt+=` Nasce ${bn}.`;ch.push([bid,"ok","recém-nascido",b])}
   if(momDies){txt+=kill(id,"no parto")+` ${nm(id)} não resiste ao parto.`;ch.push([id,"morto","no parto"])}
   say("Nascimento",txt,ch,b)}
 });
 ids.forEach(id=>{if(S[id].st==="ferido"&&!(W.T[id]&&W.T[id].heal>d)){W.T[id]=W.T[id]||{};W.T[id].heal=d+3+Math.floor(R()*8)}});

 // 2. risco diário
 ids.forEach(id=>{if(!alive(id)||anchor(id)||W.gen[id]&&W.gen[id].baby)return;const b=S[id].b;if(b==="jogador")return;
  const ex=W.gen[id]?(age(id)<12?.05:.35):(EXPO[id]??.3);
  const r=(REG[b]??.006)*ex*(1-(W.def[b]??0))*(W.food[b]<2?1.5:1)*(S[id].st==="ferido"?2:1)*(F.radioMuda?1.3:1);
  if(R()>=r)return;const x=R(),onde=(GROUPS[b]||{n:"a estrada"}).n;
  if(x<.5){set(id,"ferido","ferido fora da base");W.T[id]={...W.T[id],heal:d+3+Math.floor(R()*8)};say("Risco",`${nm(id)} volta ferid${o(id)} de uma saída perto de ${onde}.`,[[id,"ferido","ferido fora da base"]])}
  else if(x<.8){set(id,"mordido","mordido fora da base");W.T[id]={...W.T[id],turn:d+2};say("Risco",`${nm(id)} volta com uma mordida no antebraço e não conta a ninguém.`,[[id,"mordido","esconde a mordida"]],b)}
  else if(x<.95){const t=kill(id,"morto fora da base");say("Risco",`${nm(id)} não volta de uma saída perto de ${onde}.${t}`,[[id,"morto","não voltou"]],b)}
  else{set(id,"sumido","sumiu numa saída");W.T[id]={...W.T[id],back:d+2+Math.floor(R()*5)};say("Risco",`${nm(id)} some numa saída perto de ${onde}.`,[[id,"sumido","sumiu"]])}
 });

 // 3. laços dentro de cada base
 const by={};Object.keys(S).forEach(id=>{if(!alive(id)||age(id)<16)return;const b=S[id].b;if(!b||b==="jogador"||b==="nomade")return;(by[b]=by[b]||[]).push(id)});
 Object.entries(by).forEach(([b,m])=>{
  const quiet=W.last[b]>=d-2;
  for(let i=0;i<m.length;i++)for(let j=i+1;j<m.length;j++){const a=m[i],c=m[j],pa=pers(a),pc=pers(c);
   addAff(a,c,((pa[1]+pc[1])/2-50)/120+(W.food[b]<5?-(pa[3]+pc[3])/250:.1)+(R()-.5)*3);
   const v=aff(a,c),k=key(a,c);if(quiet||W.last[b]>=d)continue;
   if(!W.part[a]&&!W.part[c]&&age(a)>=18&&age(c)>=18&&Math.abs(age(a)-age(c))<=15&&v>=65&&R()<.03){W.part[a]=c;W.part[c]=a;W.aff[k]=90;W.st.casais++;
     say("Laço",`${nm(a)} e ${nm(c)} ${pick(["começam a dividir o turno de vigia, e depois o colchão","se beijam no telhado durante a rádio das 20h","assumem o namoro na frente da base inteira"])}.`,[],b);continue}
   if(W.part[a]===c&&W.food[b]>=8){const f=fem(a)&&!fem(c)?a:fem(c)&&!fem(a)?c:null;
     if(f&&age(f)<=42&&!(W.T[f]&&W.T[f].due)&&!EV.some(e=>(e.who.includes(a)||e.who.includes(c))&&e.d>d&&e.d<=d+20)&&R()<.02){W.T[f]={...W.T[f],due:d+45,dad:f===a?c:a};W.st.gravidez++;say("Gravidez",`${nm(a)} e ${nm(c)} vão ter um bebê. Nasce em uns 45 dias de jogo.`,[],b);continue}
     if(!f&&!W.adot[k]&&R()<.01){const orf=Object.keys(S).find(o=>alive(o)&&S[o].b===b&&(o==="criancas"||(W.gen[o]&&W.gen[o].baby&&!alive(W.gen[o].mom))));
       if(orf){W.adot[k]=1;say("Adoção",`${nm(a)} e ${nm(c)} adotam ${orf==="criancas"?"um dos três órfãos":nm(orf)}.`,[],b);continue}}}
   if(!W.rival[k]&&v<=-50){W.rival[k]=1;say("Rixa",`${nm(a)} e ${nm(c)} ${pick(["brigam pela última lata de sardinha","discutem aos gritos sobre quem dorme perto da porta","se acusam de roubar ração"])}. Viraram rivais.`,[],b);continue}
   if(W.rival[k]&&v<=-70&&Math.max(pa[0],pc[0])>=60&&R()<.2){W.st.brigas++;W.aff[k]=-40;const x=R(),lo=pa[0]<pc[0]?a:c,hi=lo===a?c:a;
     if(x<.6&&!anchor(lo)){set(lo,"ferido","briga com "+nm(hi));W.T[lo]={...W.T[lo],heal:d+3+Math.floor(R()*5)};say("Briga",`A rixa explode: ${nm(hi)} quebra o nariz de ${nm(lo)} no pátio.`,[[lo,"ferido","briga"]],b)}
     else if(x<.7&&!anchor(lo)){const t=kill(lo,"morto numa briga com "+nm(hi));say("Briga",`A rixa termina com faca: ${nm(lo)} morre e ${nm(hi)} carrega a morte para o resto da vida.${t}`,[[lo,"morto","briga"]],b)}
     else{const out=pa[2]<pc[2]?a:c,dest=bestBase();if(dest!==b&&!anchor(out)){set(out,"mudou","foi embora depois da briga",dest);say("Briga",`${nm(out)} junta as coisas e vai para ${GROUPS[dest].n} depois da briga com ${nm(out===a?c:a)}.`,[[out,"mudou",GROUPS[dest].n,dest]],b)}}}
  }
  // traição
  m.forEach(id=>{const p=pers(id);if(quiet||W.last[b]>=d||!alive(id)||anchor(id))return;
   if(p[2]<35&&p[3]>60&&W.food[b]<5&&R()<.03){const dest=F.brasaDomina&&L(S,"brasa")&&b!=="deleg"?"deleg":L(S,"profeta")&&b!=="serra"?"serra":"nomade";W.food[b]=Math.max(0,W.food[b]-4);W.st.trai++;
    set(id,byId[id]?"hostil":"mudou",`roubou ${GROUPS[b].n} e foi para ${GROUPS[dest].n}`,dest);m.forEach(o=>o!==id&&addAff(id,o,-40));
    say("Traição",`${nm(id)} some de madrugada com a comida da despensa e o rádio de ${GROUPS[b].n}. Dias depois é visto em ${GROUPS[dest].n}.`,[[id,S[id].st,"traiu a base",dest]],b)}});
 });

 // 4. comida, caravanas e ataques entre bases
 Object.keys(W.food).forEach(b=>{W.food[b]=Math.max(0,Math.min(60,W.food[b]+(b==="oeste"?.15:b==="penit"&&F.penitFeira?.05:-.11)))});
 const H=HOSTB(F);
 Object.entries(by).forEach(([b,m])=>{if(W.food[b]>=5||W.last[b]>=d-2)return;
  for(const x of m)for(const [c,mc] of Object.entries(by)){if(c===b||H[c]||W.food[c]<=12)continue;const y=mc.find(y=>aff(x,y)>=55);if(!y||R()>=.12)continue;
   W.food[b]+=5;W.food[c]-=5;addAff(x,y,10);W.st.carav++;let t=`Caravana: ${nm(y)} atravessa a cidade com comida de ${GROUPS[c].n} para ${GROUPS[b].n}, onde mora ${nm(x)}.`;const ch=[];
   if(R()<.08&&!anchor(y)){set(y,"ferido","ferido na caravana");W.T[y]={...W.T[y],heal:d+4};t+=` Na volta, ${nm(y)} é atacad${o(y)} na avenida e chega ferid${o(y)}.`;ch.push([y,"ferido","caravana"])}
   say("Entre bases",t,ch,b);return}
 });
 [["deleg",F.brasaDomina&&L(S,"brasa"),"Os homens do Brasa"],["serra",F.corvosOeste&&L(S,"profeta"),"Os Corvos"],["penit",F.penitArmada&&L(S,"jacare"),"Os presos do Jacaré"]].forEach(([src,on,who])=>{
  if(!on||R()>=.03||(W.raid[src]||0)>d-10)return;const alvo=Object.keys(by).filter(b=>b!==src&&!H[b]&&b!=="bloqueio"&&W.food[b]>=3).sort((a,b)=>W.def[a]-W.def[b]+(R()-.5)*.3)[0];if(!alvo||W.last[alvo]>=d-2)return;W.raid[src]=d;
  const v=pick(by[alvo]);W.st.ataques++;const loot=Math.min(5,W.food[alvo]);W.food[alvo]-=loot;W.food[src]=(W.food[src]||0)+loot;
  const hero=Object.entries(by).filter(([b])=>b!==alvo&&!H[b]).flatMap(([,mm])=>mm).find(h=>pers(h)[0]>=70&&by[alvo].some(o=>aff(h,o)>=60));
  let t=`${who} atacam ${GROUPS[alvo].n} de madrugada e levam ${Math.round(loot)} dias de comida.`;const ch=[];
  if(hero&&R()<.5){t+=` ${nm(hero)}, de ${GROUPS[S[hero].b].n}, ouve os tiros e chega a tempo: ${nm(v)} sai só ferid${o(v)}.`;set(v,"ferido","ferido no ataque");W.T[v]={...W.T[v],heal:d+5};addAff(hero,v,20);ch.push([v,"ferido","ataque"])}
  else if(R()<.25&&!anchor(v)){t+=kill(v,"morto no ataque de "+GROUPS[src].n)+` ${nm(v)} morre na porta.`;ch.push([v,"morto","ataque"])}
  else if(!anchor(v)){set(v,"ferido","ferido no ataque");W.T[v]={...W.T[v],heal:d+5};t+=` ${nm(v)} leva um tiro de raspão.`;ch.push([v,"ferido","ataque"])}
  say("Ataque",t,ch,alvo)});

 // 5. chegadas pela estrada, trilho e serra
 if(d%5===0){let n=R()<(d>60?.25:.5)?1+(R()<.3?1:0):0;while(n-->0&&pop()<CAP){
  const f=R()<.5;let nome;do{nome=pick(f?NM.f:NM.m)+" "+pick(NM.s)}while(W.used.has(nome.split(" ")[0])&&W.used.size<30);W.used.add(nome.split(" ")[0]);const origem=pick(["pela BR-Sul","pelo pátio de trens","pela trilha da serra"]);
  const bond=pick(NPCS.filter(x=>typeof x.i==="number"&&x.i>=16)).id,rel=pick(RELW[f?"f":"m"]);
  const st=S[bond].st,live=alive(bond)||st==="grupo";let b=live&&S[bond].b!=="jogador"&&S[bond].b!=="nomade"&&!H[S[bond].b]&&cnt(S[bond].b)<ROOM?S[bond].b:bestBase();
  const id=newP({n:nome,i:18+Math.floor(R()*42),g:b,f,p:[20+R()*70,20+R()*70,20+R()*70,10+R()*70,20+R()*70].map(Math.round),bond,rel});W.st.cheg++;
  let t=`${nome.split(" ")[0]}, ${rel} de ${nm(bond)}, chega ${origem}`+(origem==="pela BR-Sul"&&L(S,"lucia")&&S.lucia.b==="prf"?" e a Lúcia anota o nome no livro da PRF":"")+".";
  if(!live)t+=` Vinha procurando ${nm(bond)} e descobre que ${nm(bond)} ${{morto:"morreu",zumbi:"virou um dos mortos",partiu:"saiu do vale no ônibus",sumido:"sumiu",mordido:"foi mordido"}[st]||"não está mais aqui"}. Fica em ${GROUPS[b].n}.`;
  else{t+=st==="grupo"?` Pergunta por ${nm(bond)} e descobre que está com o jogador. Fica em ${GROUPS[b].n} esperando.`:b===S[bond].b?` Encontra ${nm(bond)} em ${GROUPS[b].n} e fica.`:` Descobre que ${nm(bond)} está em ${(GROUPS[S[bond].b]||{n:"lugar nenhum"}).n} e prefere ficar em ${GROUPS[b].n}.`;W.aff[key(id,bond)]=75}
  if(L(S,"jessica")||L(S,"nelson"))t+=" A rádio anuncia a chegada às 20h.";
  const ch=[[id,"ok","chegou "+origem,b]];
  if(R()<.2&&pop()<CAP){const pf=!f;let n2;do{n2=pick(pf?NM.f:NM.m)}while(W.used.has(n2)&&W.used.size<30);W.used.add(n2);const sob=nome.split(" ").slice(-1)[0];
   const id2=newP({n:n2+" "+sob,i:Math.max(18,W.gen[id].i+Math.floor(R()*9)-4),g:b,f:pf,p:[1,2,3,4,5].map(()=>Math.round(20+R()*70)),bond,rel:"par de "+nome.split(" ")[0]});W.st.cheg++;
   W.part[id]=id2;W.part[id2]=id;ch.push([id2,"ok","chegou "+origem,b]);const mae=pf?id2:id;
   if(R()<.35&&W.gen[mae].i<=42){W.T[mae]={due:d+10+Math.floor(R()*30),dad:mae===id?id2:id};W.st.gravidez++;t+=` Vem com ${n2}, e ${nm(mae)} está grávida.`}else t+=` Vem com ${n2}.`}
  say("Chegada",t,ch,null)}}
}

// os pontos com d:88 só valem se ninguém ouviu (estado ok sem rádio)
function apply(S,ch){(ch||[]).forEach(([id,st,nt,b])=>{if(!S[id])return;
  // mortos e zumbis não voltam; partiu é final
  const cur=S[id].st; if(["morto","partiu"].includes(cur))return; if(cur==="zumbi"&&st!=="morto")return;
  S[id]={st,nt,b:b||(st==="grupo"?"jogador":S[id].b)}})}
function simulate(day,A,O={}){
  const S=mk(),F={},log=[],R=O.vivo?rng(O.seed||1):null,W=R?world():null;GEN=W?W.gen:{};
  if(W&&O.fill){let i=0;const bs=Object.keys(GROUPS).filter(b=>!["nomade","base"].includes(b));
    while(Object.values(S).filter(s=>LIVE.includes(s.st)).length<O.fill){const b=bs[i++%bs.length];if(Object.values(S).filter(s=>LIVE.includes(s.st)&&s.b===b).length>=8)continue;
      const id="g"+(++W.n),f=R()<.5;W.gen[id]={n:(f?NM.f:NM.m)[W.n%16]+" "+NM.s[W.n%16],i:18+Math.floor(R()*40),g:b,f,p:[1,2,3,4,5].map(()=>Math.round(20+R()*70))};S[id]={st:"ok",nt:"",b}}}
  let k=0;const t0=performance.now();
  for(let d=1;d<=day;d++){
    while(k<EV.length&&EV[k].d===d){const e=EV[k++];const r=e.run(S,A,F);if(!r)continue;
      apply(S,r.ch);Object.assign(F,r.fl||{});log.push({d,t:e.t,txt:r.txt,alt:r.alt,ch:r.ch||[]})}
    if(R)life(d,S,F,R,W,log);
  }
  return {S,F,log,W,ms:performance.now()-t0};
}

/* ---------- render ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const byId=Object.fromEntries(NPCS.concat(EXTRA).map(n=>[n.id,n]));
const nameOf=id=>(byId[id]||GEN[id]||{n:id}).n;
$("#stN").textContent=NPCS.length;
$("#stG").textContent=Object.keys(GROUPS).length-1;
$("#stE").textContent=EV.length;

$("#grplist").innerHTML=Object.entries(GROUPS).map(([k,g])=>{
  const mem=NPCS.filter(n=>n.g===k).map(n=>n.n.split(" ")[0]==="Seu"||n.n.split(" ")[0]==="Dona"||n.n.split(" ")[0]==="Dr."||n.n.split(" ")[0]==="Tenente"||n.n.split(" ")[0]==="Sargento"||n.n.split(" ")[0]==="Soldado"||n.n.split(" ")[0]==="Pastora"||n.n.split(" ")[0]==="Cabo"?n.n.split(" ").slice(0,2).join(" "):n.n.split(" ")[0]);
  return `<div class="card grp"><div class="gh"><span class="dot" style="background:${g.c}"></span><h3>${esc(g.n)}</h3></div>
  <span class="meta">${esc(g.reg)}</span><p style="font-size:.92rem">${esc(g.d)}</p>
  ${k==="nomade"?"":`<div class="kv"><span>Defesa</span><div class="bar" role="img" aria-label="Defesa ${g.def}"><i style="width:${g.def*100}%"></i></div><span>Comida</span><span class="mono">${g.food} dias</span></div>`}
  <div class="rels">${mem.map(m=>`<span class="tag">${esc(m)}</span>`).join("")}</div></div>`}).join("");

const PN=["coragem","empatia","lealdade","ganância","estabilidade"];
function turnsFor(id){return EV.filter(e=>e.who.includes(id)).map(e=>`<div><b>dia ${e.d}</b><span>${esc(e.t)}</span></div>`).join("")}
function relsFor(id){return RELS.filter(r=>r[0]===id||r[1]===id).map(r=>{const o=byId[r[0]===id?r[1]:r[0]];return `<span class="tag" style="color:${RELTYPES[r[2]][1]}" title="${esc(r[3])}">${esc(o.n.replace(/ “.*?”/,"").split(" ").slice(0,2).join(" "))}: ${esc(r[3])}</span>`}).join("")}
function card(n){const g=GROUPS[n.g];const zumbi=n.id==="arnaldo";
 return `<article class="npc" data-g="${n.g}"><div class="side">
  <div class="who"><h3>${esc(n.n)}</h3>${n.orig?"":`<span class="new">NOVO</span>`}</div>
  <span class="meta">${esc(n.i)} anos · ${esc(n.o)}</span>
  <span class="meta" style="display:flex;align-items:center;gap:6px"><span class="dot" style="background:${g.c}"></span>${esc(g.n)} · ${esc(g.reg)}</span>
  <p>${esc(n.h)}</p>
  <div><span class="lbl">Objetivo</span><p>${esc(n.obj)}</p></div>
  <details class="sec"><summary>Segredo (spoiler)</summary><p>${esc(n.seg)}</p></details>
  <div><span class="lbl">Oferece ao jogador</span><p>${esc(n.of)}</p></div>
 </div><div class="side">
  ${zumbi?"":`<div class="pers">${n.p.map((v,i)=>`<span>${PN[i]}</span><div class="bar"><i style="width:${v}%"></i></div><span class="v mono">${v}</span>`).join("")}</div>`}
  <div><span class="lbl">Rotina</span><div class="rot">${n.r.map(([h,a])=>`<b>${h}</b><span>${esc(a)}</span>`).join("")}</div></div>
  <div><span class="lbl">Item marcado</span><p>${esc(n.it)}</p></div>
  <div><span class="lbl">Ligações</span><div class="rels">${relsFor(n.id)||'<span class="tag">nenhuma</span>'}</div></div>
  <div><span class="lbl">Pontos de virada</span><div class="turns">${turnsFor(n.id)||'<span class="meta">só a camada de risco</span>'}</div></div>
 </div></article>`}
$("#npclist").innerHTML=NPCS.map(card).join("");

let filt="todos";
const fl=[["todos","Todos",null]].concat(Object.entries(GROUPS).filter(([k])=>NPCS.some(n=>n.g===k)).map(([k,g])=>[k,g.n,g.c])).concat([["novos","Só os novos",null]]);
$("#filters").innerHTML=fl.map(([k,n,c])=>`<button type="button" class="chip" data-f="${k}" aria-pressed="${k==="todos"}">${c?`<span class="dot" style="background:${c}"></span>`:""}${esc(n)}</button>`).join("");
$("#filters").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;filt=b.dataset.f;
 document.querySelectorAll("#filters .chip").forEach(x=>x.setAttribute("aria-pressed",x===b));
 document.querySelectorAll("#npclist .npc").forEach((el,i)=>{const n=NPCS[i];el.hidden=!(filt==="todos"||(filt==="novos"?!n.orig:n.g===filt))});
 try{localStorage.setItem("vivos-filtro",filt)}catch(_){}
});
try{const f=localStorage.getItem("vivos-filtro");if(f){const b=document.querySelector(`#filters .chip[data-f="${f}"]`);b&&b.click()}}catch(_){}

/* teia */
(function(){
 const W=880,H=780,cx=W/2,cy=H/2+4,R=300;
 const order=NPCS.map(n=>n.id);
 const pos={};order.forEach((id,i)=>{const a=-Math.PI/2+i/order.length*Math.PI*2;pos[id]=[cx+R*Math.cos(a),cy+R*Math.sin(a),a]});
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Teia de relações entre os sobreviventes">`;
 RELS.forEach((r,i)=>{const a=pos[r[0]],b=pos[r[1]];const mx=(a[0]+b[0])/2*0.55+cx*0.45,my=(a[1]+b[1])/2*0.55+cy*0.45;
   s+=`<path d="M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}" fill="none" stroke="${RELTYPES[r[2]][1]}" class="ln" data-a="${r[0]}" data-b="${r[1]}" stroke-width="1.4" opacity=".7"${r[2]==="seg"?' stroke-dasharray="4 3"':""}/>`});
 order.forEach(id=>{const [x,y,a]=pos[id];const n=byId[id];const lx=x+Math.cos(a)*14,ly=y+Math.sin(a)*14;const anchor=Math.cos(a)>0.2?"start":Math.cos(a)<-0.2?"end":"middle";
   const short=n.n.replace(/ “.*?”/,"").replace("Tenente ","").replace("Sargento ","").replace("Soldado ","").replace("Pastora ","").replace("Cabo ","").replace("Dr. ","").split(" ").slice(0,2).join(" ");
   s+=`<g class="node" tabindex="0" role="button" aria-label="${esc(n.n)}" data-id="${id}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${GROUPS[n.g].c}" stroke="var(--bg)" stroke-width="2"/><text x="${lx.toFixed(1)}" y="${(ly+3.5).toFixed(1)}" text-anchor="${anchor}">${esc(short)}</text></g>`});
 s+="</svg>";$("#web").innerHTML=s;
 $("#legend").innerHTML=Object.values(RELTYPES).map(([n,c])=>`<span><i style="background:${c}"></i>${n}</span>`).join("");
 let sel=null;
 function pick(id){
   sel=sel===id?null:id;const web=$("#web");
   web.classList.toggle("focus",!!sel);
   web.querySelectorAll(".node").forEach(g=>g.classList.toggle("on",g.dataset.id===sel));
   web.querySelectorAll(".ln").forEach(l=>{const on=sel&&(l.dataset.a===sel||l.dataset.b===sel);l.setAttribute("opacity",sel?(on?1:.07):.7);l.setAttribute("stroke-width",on?2.4:1.4)});
   if(!sel){$("#webtext").textContent=`Nenhum nome selecionado. A teia mostra todas as ${RELS.length} ligações.`;return}
   const n=byId[sel];const rs=RELS.filter(r=>r[0]===sel||r[1]===sel);
   $("#webtext").innerHTML=`<b>${esc(n.n)}</b> · ${esc(GROUPS[n.g].n)}<br>`+rs.map(r=>{const o=byId[r[0]===sel?r[1]:r[0]];return `<span style="color:${RELTYPES[r[2]][1]}">●</span> ${esc(o.n)}: ${esc(r[3])}`}).join("<br>");
 }
 $("#web").addEventListener("click",e=>{const g=e.target.closest(".node");if(g)pick(g.dataset.id)});
 $("#web").addEventListener("keydown",e=>{const g=e.target.closest(".node");if(g&&(e.key==="Enter"||e.key===" ")){e.preventDefault();pick(g.dataset.id)}});
})();

/* destino */
$("#states").innerHTML=STATES.map(([k,l,d])=>`<div class="flowrow"><span class="st ${k}">${l}</span><span style="color:var(--muted);font-size:.88rem">${d}</span></div>`).join("");
$("#riskTbl").innerHTML=RISK.map(([r,v])=>`<tr><td>${r}</td><td class="num">${(v*100).toFixed(2).replace(".",",")}%</td></tr>`).join("");
$("#joinTbl").innerHTML=JOIN.map(r=>`<tr>${r.map((c,i)=>`<td>${i===0?`<b>${esc(c)}</b>`:esc(c)}</td>`).join("")}</tr>`).join("");

function chips(ch){return ch.map(([id,st,nt])=>`<span class="st ${st}" title="${esc(nt||"")}">${esc(nameOf(id).replace(/ “.*?”/,"").split(" ").slice(0,2).join(" "))}: ${STLBL[st]}</span>`).join("")}
function tlHTML(log){return log.map(l=>`<div class="ev${l.alt?" alt":""}${l.emg?" emg":""}"><b class="d">dia ${l.d}</b><div><h4>${esc(l.t)}</h4><p>${esc(l.txt)}</p>${l.ch.length?`<div class="ch">${chips(l.ch)}</div>`:""}</div></div>`).join("")}

// linha do tempo padrão: sem ações, com o desfecho alternativo logo abaixo quando existe
(function(){
 const base=simulate(90,{}).log;
 const all=simulate(90,Object.fromEntries(ACTS.filter(a=>a.id!=="diesel").map(a=>[a.id,1]))).log;
 let h="";
 base.forEach(l=>{h+=tlHTML([l]);const a=all.find(x=>x.d===l.d&&x.t===l.t&&x.alt&&x.txt!==l.txt);if(a)h+=tlHTML([{...a,t:"Se o jogador agiu: "+a.t}])});
 all.filter(a=>a.alt&&!base.some(b=>b.d===a.d&&b.t===a.t)).forEach(a=>{});
 $("#timeline").innerHTML=h;
})();
$("#factlist").innerHTML=FACT.map(f=>`<div class="card fact"><div class="gh" style="display:flex;align-items:center;gap:8px"><span class="dot" style="background:${f.c}"></span><h3>${esc(f.n)}</h3></div>
 <dl><dt>Onde</dt><dd>${esc(f.onde)}</dd>
 <dt>Com nome</dt><dd class="who2">${f.quem.length?f.quem.map(id=>`<span class="tag">${esc(byId[id].n.replace(/ “.*?”/,""))}</span>`).join(""):'<span class="meta">nenhum vivo</span>'}</dd>
 <dt>Sem nome</dt><dd>${esc(f.gen)}</dd><dt>O que faz</dt><dd>${esc(f.faz)}</dd><dt>Com o jogador</dt><dd>${esc(f.jog)}</dd><dt>Com o tempo</dt><dd>${esc(f.fases)}</dd></dl></div>`).join("");
$("#rankTbl").innerHTML=RANKS.map(r=>`<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
$("#rankRule").textContent=RANKRULE;
const FK=Object.fromEntries(FACT.map(f=>[f.k,f]));
let lf="todas";
function lootRender(){$("#lootTbl").innerHTML=LOOT.filter(l=>lf==="todas"||l[2]===lf).map(l=>`<tr><td><b>${esc(l[1])}</b></td><td><span class="dot" style="background:${FK[l[2]].c}"></span> ${esc(FK[l[2]].n.split(" · ")[0])}</td><td>${LCAT[l[3]]}</td><td>${esc(l[4])}</td><td>${esc(l[5])}</td><td>${esc(l[6])}</td></tr>`).join("")}
$("#lootf").innerHTML=[["todas","Todas",null]].concat(FACT.map(f=>[f.k,f.n.split(" · ")[0],f.c])).map(([k,n,c])=>`<button type="button" class="chip" data-f="${k}" aria-pressed="${k==="todas"}">${c?`<span class="dot" style="background:${c}"></span>`:""}${esc(n)}</button>`).join("");
$("#lootf").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;lf=b.dataset.f;document.querySelectorAll("#lootf .chip").forEach(x=>x.setAttribute("aria-pressed",x===b));lootRender()});
lootRender();
$("#gentTbl").innerHTML=GENT.map(g=>`<tr><td><b>${esc(g[0])}</b></td><td>${esc(FK[g[1]].n.split(" · ")[0])}</td><td>${esc(g[2])}</td><td>${esc(g[3])}</td></tr>`).join("");

/* simulador */
const A={};
$("#acts").innerHTML=ACTS.map(a=>`<label class="act" for="a-${a.id}"><input type="checkbox" id="a-${a.id}" data-a="${a.id}"><span>${esc(a.n)}<small>${esc(a.w)}</small></span></label>`).join("");
function opts(){return {vivo:$("#mvivo").checked,seed:Math.max(1,+$("#seed").value||1)}}
function run(){
 const day=+$("#day").value;$("#dayOut").textContent=day;
 document.querySelectorAll("#acts input").forEach(i=>{A[i.dataset.a]=i.checked?1:0;i.closest(".act").classList.toggle("sel",i.checked)});
 $("#mvivo").closest(".act").classList.toggle("sel",$("#mvivo").checked);
 const O=opts(),{S,log,W}=simulate(day,A,O);
 const vis=NPCS.concat(EXTRA).filter(n=>S[n.id].st!=="nao");
 const cnt={};vis.forEach(n=>{cnt[S[n.id].st]=(cnt[S[n.id].st]||0)+1});
 $("#summary").innerHTML=STATES.filter(([k])=>cnt[k]).map(([k,l])=>`<span class="st ${k}">${cnt[k]} ${l}</span>`).join("");
 const s2=$("#summary2");s2.hidden=!W;
 if(W){const t=W.st,g=Object.keys(W.gen).filter(id=>LIVE.includes(S[id].st)).length;
   s2.innerHTML=[[t.nasc,"nascimentos"],[t.cheg,"chegadas"],[t.casais,"casais novos"],[t.brigas,"brigas"],[t.trai,"traições"],[t.carav,"caravanas"],[t.ataques,"ataques"],[t.mort,"mortes sorteadas"],[g,"novos vivos"]].map(([v,l])=>`<span class="st mudou">${v} ${l}</span>`).join("")}
 const row=(id,n,c)=>`<div class="r"><span class="nm"><span class="dot" style="background:${c}"></span>${esc(n)}</span><span class="st ${S[id].st}">${STLBL[S[id].st]}</span><span class="nt">${esc(S[id].nt||"")}</span></div>`;
 let h=vis.map(n=>row(n.id,n.n,GROUPS[n.g].c)).join("");
 if(W){const gs=Object.keys(W.gen);if(gs.length)h+=`<div class="gh">Nascidos e chegados no vale</div>`+gs.map(id=>{const g=W.gen[id];return row(id,g.n+(g.baby?" (bebê)":g.bond?` · ${g.rel} de ${short(byId[g.bond].n)}`:""),(GROUPS[S[id].b]||{c:"#888"}).c)}).join("")}
 $("#roster").innerHTML=h;
 $("#simlog").innerHTML=tlHTML(log)||'<p class="note">Nada aconteceu ainda.</p>';
}
$("#day").addEventListener("input",run);
$("#acts").addEventListener("change",run);
$("#mvivo").addEventListener("change",run);
$("#seed").addEventListener("change",run);
$("#reseed").onclick=()=>{$("#seed").value=1+Math.floor(Math.random()*99999);$("#mvivo").checked=true;run()};
$("#allOn").onclick=()=>{document.querySelectorAll("#acts input").forEach(i=>i.checked=i.dataset.a!=="diesel");run()};
$("#allOff").onclick=()=>{document.querySelectorAll("#acts input").forEach(i=>i.checked=false);run()};
$("#bench").onclick=()=>{const out=$("#benchOut");out.textContent="Medindo…";setTimeout(()=>{
 const named=NPCS.filter(n=>!START_Z[n.id]).map(n=>n.id),res=[];
 for(const fill of [0,104]){let ms=0,viv=0,nas=0,che=0,mor=0,pop=0,worst=0;
  for(let s=1;s<=1000;s++){const r=simulate(90,A,{vivo:1,seed:s,fill});ms+=r.ms;worst=Math.max(worst,r.ms/90);viv+=named.filter(id=>LIVE.includes(r.S[id].st)).length;nas+=r.W.st.nasc;che+=r.W.st.cheg;mor+=r.W.st.mort;pop+=Object.values(r.S).filter(x=>LIVE.includes(x.st)).length}
  res.push({fill,ms:ms/90000,worst,viv:viv/1000,nas:nas/1000,che:che/1000,mor:mor/1000,pop:pop/1000})}
 const f=v=>v.toFixed(2).replace(".",",");
 out.innerHTML=res.map(r=>`<b>${r.fill?"Vale cheio (104 no dia 1)":"Elenco normal"}</b>: ${f(r.viv)} nomeados vivos no dia 90 (de ${named.length}), ${f(r.nas)} nascimentos, ${f(r.che)} chegadas, ${f(r.mor)} mortes sorteadas, ${f(r.pop)} vivos no total. Tempo por dia simulado: ${f(r.ms)} ms em média, ${f(r.worst)} ms no pior mundo (com as ações marcadas agora).`).join("<br>")},30)};

run();
