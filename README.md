# 🌐 PORTAL HUB — CANAL DO CLIENTE INDEPENDENTE

Aplicação web do **Portal Hub** (antigo canal do cliente), desacoplada do CRM principal e estruturada para rodar de forma isolada no domínio **`portahub.hubsymples.com.br`** com deploy simplificado na Vercel.

O Portal Hub compartilha o mesmo banco de dados do Firebase Firestore do CRM administrativo, garantindo reatividade e sincronização em tempo real de chamados, faturas e agendamentos sem duplicidade de dados.

---

## 🚀 Principais Recursos

### 1. 📊 Módulo "Meu Negócio" (`PortalManagement.tsx`)
*   **Controle de Estoque (`PortalInventory.tsx`):** Gestão de materiais e produtos com suporte opcional a **Marca**, **Preço de Venda** e **Exibir no PDV**. Inclui inteligência financeira no topo com os indicadores de **Patrimônio Ativo (Custo)**, **Valuation de Estoque (Faturamento de Venda Potencial)** e **Lucro Estimado**, além de filtro para itens com estoque crítico e **Linha do Tempo de Movimentações**.
*   **Caixa Rápido (PDV - `PortalPOS.tsx`):** Terminal de ponto de venda moderno integrado ao estoque. Exibe botões grandes para os produtos favoritos/mais vendidos (com indicação visual da quantidade em estoque em tempo real) e barra de pesquisa rápida para outros produtos. Permite vendas rápidas que deduzem automaticamente a quantidade vendida do inventário e geram logs históricos de saída.
*   **Calculadora de Orçamentos (`PortalCalculator.tsx`):** Simulador de precificação dinâmico baseado em custos de materiais e horas de trabalho estimadas.
*   **Gestão de Itens Locáveis & Recursos (`PortalResources.tsx`):** Cadastro e controle operacional de imóveis (locação por temporada/Airbnb), salões de eventos e equipamentos/brinquedos de festa. Suporta o registro de tarifas base, descrição de regras de uso, manuais de acesso e configurações de Wi-Fi para facilidade do locatário. O recurso pode ser desativado nas configurações do portal.
*   **Performance Financeira & Analytics (`PortalCRMFinance.tsx`):** Análise de lucro líquido real, receitas e despesas extras. Inclui **gráficos analíticos dinâmicos puros em SVG** (Evolução do fluxo de caixa de receitas vs despesas e distribuição de gastos por categorias em gráfico Donut).
*   **Controle de Despesas Fixas:** Aba dedicada para cadastrar, editar, excluir e visualizar despesas recorrentes mensais/fixas de forma centralizada e sem a limitação dos filtros temporais mensais da dashboard.
*   **Projeção de Caixa e Simulador de Break-Even:** Previsão de faturamento baseada nos próximos 15 e 30 dias de agendamentos confirmados e calculadora simuladora reativa de ponto de equilíbrio contra metas de custos fixos reais.
*   **Fechamento do Mês (PDF Executivo A4):** Relatório de fechamento estético executivo otimizado para salvamento em PDF ou impressão física no formato padrão A4, ocultando os elementos do portal na impressão (`print:hidden`).

### 2. 📅 Agenda e Atendimentos (`PortalAgenda.tsx`)
*   **Organização por Sub-Abas de Configurações:** Interface de configurações estruturada com navegação horizontal contendo abas estéticas e isoladas: 🕒 Horários de Atendimento, ⚙️ Regras e Rótulos, 🔗 Mini-Site/Bio, 📦 Pacotes de Clientes e 🏆 Clube de Fidelidade.
*   **Gestão de Pacotes de Clientes (`PortalPackages.tsx`):** Lançamento, listagem e controle de saldo de créditos de sessões ativas dos clientes (ex: 10 sessões) com chave geral de ativação do recurso no portal, integrado como sub-aba da Agenda.
*   **Clube de Fidelidade Digital (`PortalFidelity.tsx`):** Ativação, parametrização de metas, cores do cartão e descrição de prêmios do cartão fidelidade, e painel de acompanhamento em tempo real do progresso de carimbos acumulados, integrado como sub-aba da Agenda.
*   **Dedução de Créditos Automatizada:** O sistema debita de forma autônoma 1 sessão do pacote do cliente e registra a movimentação no histórico de visitas quando o atendimento correspondente é finalizado como concluído (`completed`).
*   **Timeline Interativa & Visão Mensal:** Exibição reativa de compromissos com alternância dinâmica entre a Visão Diária (Timeline) e a Visão Mensal (calendário completo com contagem de agendamentos e indicadores coloridos de status: pendente, confirmado ou agendado).
*   **Slots de Horários Inteligentes (Serviços Coletivos):** Geração de slots de atendimento dinâmicos baseados no expediente e no tipo de serviço. O sistema suporta **Serviços Coletivos (Vagas em Grupo)** com capacidade máxima configurável (`capacity`). No link de agendamento público, é exibida a quantidade de vagas restantes (Ex: *"Restam 3 vagas"*). A lógica de conflitos previne a sobreposição com serviços individuais.
*   **Agrupamento Premium de Serviços Coletivos na Timeline:** Na timeline diária do administrador, múltiplos agendamentos do mesmo serviço coletivo no mesmo horário são agrupados automaticamente em um card unificado e elegante de grupo, listando todos os clientes agendados e suas ações individuais para evitar cards encavalados.
*   **Bloqueio Rápido de Horários:** Atalho para bloquear slots na timeline ("Horário Bloqueado"), impedindo novas reservas no respectivo intervalo.
*   **Indicador de Fidelidade na Timeline:** Badge que exibe estrelas acumuladas de clientes fiéis baseadas nos atendimentos com status `completed` no Firestore.
*   **Baixa Automática no Estoque:** Débito automático de materiais do estoque físico e registro de log ao marcar atendimentos como concluídos.
*   **Personalização de Rótulos Dinâmicos:** Nomenclaturas singular/plural customizáveis (ex: "Agendamento" -> "Proposta", "Sessão") aplicadas dinamicamente em toda a interface do portal.
*   **Confirmação via WhatsApp:** Templates customizáveis e dinâmicos de mensagens do WhatsApp nas configurações da agenda (com tags como `{nome}`, `{servico}`, `{data}`, `{hora}`, `{valor}` e `{link}`).
*   **Página Pública de Confirmação (`ConfirmarPresenca.tsx`):** Rota pública sem autenticação (`/confirmar-presenca`) onde o cliente final pode confirmar ou cancelar compromissos, exibindo a logo personalizada da empresa ou o fallback padrão. Inclui geolocalização por botão "Como Chegar" e botão de **Reagendamento Autônomo Online** em caso de ausência para evitar perda de clientes.
*   **Geração Automática de Pix Estático & Sinal Pix:** Motor de cálculo autônomo baseado no padrão EMV BR Code (Pix Estático) integrado às páginas públicas. Inclui o recurso de **Sinal Pix Obrigatório** configurável pelo administrador no painel para garantia de reserva em novos agendamentos públicos, com badge indicador de sinal (pendente/confirmado) na agenda.
*   **Reservas de Itens & Overbooking por Período:** Integração dos recursos locáveis na timeline diária e mensal da Agenda. Permite agendar recursos por períodos de dias (Check-in e Check-out), validando se o item está livre no intervalo pretendido. Caso haja sobreposição com outra reserva confirmada do mesmo item, a gravação é bloqueada automaticamente (prevenção de overbooking). Inclui filtro reativo de visualização por recurso no topo da agenda.
*   **Fluxo de Pagamento Pix Flexível e Suporte Integrado:** O cliente pode optar de forma voluntária por pagar o valor total via Pix diretamente na tela de sucesso de agendamento (com geração automática de QR Code e Copia e Cola) ou pagar no local do estabelecimento. Também disponibiliza botões dinâmicos e pré-formatados de suporte direto no WhatsApp para esclarecimento de dúvidas sobre a reserva.
*   **Checkout Pix por Link Público (`/pagar-pix`):** Rota pública sem autenticação que recebe os parâmetros Pix na URL e renderiza uma tela escura de pagamento esteticamente premium, com QR Code gigante centralizado e botão reativo para copiar a chave copia-e-cola com um clique.
*   **Módulo de Cobrança Rápida do Profissional:** Botão "Cobrar Pix" na Timeline Diária do profissional que gera o Pix do agendamento com valor editável e formata a mensagem com link para envio rápido pelo WhatsApp do cliente.
*   **Gerador de Pix Avulso:** Painel estético sempre visível na aba de configurações do Pix que permite gerar cobranças Pix personalizadas de qualquer valor com geração de QR Code e código Copia e Cola em tempo real, além de envio formatado direto para o WhatsApp de qualquer contato.
*   **Clube de Fidelidade Digital:** Cartão de carimbos gamificado de fidelização na tela pública de confirmação de presença.
*   **Faturamento Automático:** Integração onde a conclusão de um atendimento na timeline gera e consolida automaticamente a receita no painel do CRM Financeiro.
*   **Melhorias Técnicas de Segurança:** O agendamento público e o mini-site utilizam a API backend segura (`/api/portal_handler`) para isolamento de dados de leitura direta do Firestore de clientes não autenticados.

### 3. 💳 Faturamento e Faturas (`PortalFinance.tsx`)
*   **Integração Asaas:** Acompanhamento e visualização de faturas e cobranças geradas pelo estabelecimento integrado via API.
*   **Controle Financeiro:** Detalhamento do status de pagamento, datas de vencimento, links diretos de faturamento e extrato de transações pendentes ou concluídas.

### 4. 🛍️ Marketplace de Serviços (`PortalServices.tsx`)
*   **Vitrine de Ofertas:** Espaço para divulgação de planos, pacotes e serviços de valor agregado adicionais para contratação.
*   **Destaques de Serviços:** Exibição detalhada com descrição, preço de investimento e selos de segurança.
*   **Contratação Direta:** Botões para contratação rápida integrados via WhatsApp com mensagem de solicitação pré-formatada.

### 5. 📂 Documentos e Assinatura Digital (`PortalDocuments.tsx`)
*   **Central de Arquivos:** Visualização e download de contratos, laudos e arquivos anexados ao cadastro do cliente pelo painel administrativo.
*   **Assinatura Digital de Contratos:** Assinatura digital eletrônica integrada com coleta automática de IP do signatário, User Agent do navegador e registro de logs de auditoria no Firestore.

### 6. 💬 Atendimento, Central de FAQ & Guia Interativo (`PortalSupport.tsx`)
*   **Central de FAQ Interativa:** Base de conhecimento com busca por texto livre e filtros em chips por categorias (Geral, Agenda, Estoque, Pix & QR Code) para respostas instantâneas, usando acordeões interativos de expansão suave.
*   **Guia de Onboarding Interativo (`OnboardingTour.tsx`):** Tour virtual de boas-vindas com 4 etapas (Logo, Barra de Ferramentas, Alertas de Chamados e Menu do Perfil) utilizando máscara escura de spotlight dinâmico em SVG. Pode ser reinicializado pelo usuário a qualquer momento na Central de FAQ.
*   **Chamados de Suporte:** Abertura e acompanhamento de chamados categorizados por assunto e urgência com suporte para anexar imagens.
*   **Histórico de Interações:** Chat dinâmico de conversação e tréplica direta com o consultor.

### 7. 👤 Perfil, Autenticação e Ativação
*   **Perfil do Usuário (`PortalProfile.tsx`):** Edição de avatar integrado com Cloudinary, nome social e WhatsApp com controle de edição (backup local e modo leitura estática).
*   **Ativação de Conta (`PortalActivation.tsx`):** Fluxo para ativação de novos portais integrando códigos gerados pelo CRM administrativo com credenciais do Firebase Auth.
*   **Segurança de Acesso:** Login robusto (`PortalLogin.tsx`) integrado ao Firebase Auth com proteção de rotas e recuperação de senha.

### 8. 🚀 Hub de Crescimento & Rotas Públicas (`PortalGrowthHub.tsx`)
*   **Mini-Site Público (Bio-Link - `/bio/:orgId`):** Página de links estilo *glassmorphism* contendo logotipos, paleta de cores institucional, links de redes sociais e atalho para o agendamento online público.
*   **Consulta Pública de Saldos & Fidelidade:** Botão e modal *glassmorphism* na Bio onde o cliente final, digitando apenas o seu WhatsApp (de forma segura, sem expor dados pessoais), consulta seus pacotes de crédito e os carimbos acumulados do cartão fidelidade em tempo real.
*   **Agendamento Online Público (`/agendar/:orgId`):** Fluxo de reserva externa onde clientes selecionam serviços, data/hora e solicitam pré-reservas. Possui **detecção automática de créditos ativos**, permitindo agendar debitando diretamente de pacotes de crédito do cliente.
*   **Reativação de Clientes Inativos (LTV):** Análise na Dashboard (`PortalHome.tsx`) que detecta clientes inativos há mais de 30 dias com gatilhos rápidos para reativação por WhatsApp.
*   **Arsenal de Vendas e Templates:** Cofre de ativos de marca, scripts de vendas com cópia instantânea e vídeos de treinamento em Lightbox com reprodução fluida e efeito desfocado (*backdrop-blur*).
*   **Central de Insights & Dicas (Blog do Empreendedor - `PortalInsights.tsx`):** Portal de conteúdo educativo integrado ao Hub de Crescimento com artigos focados em gestão, vendas, finanças e marketing para escalar o negócio de parceiros, com leitor imersivo, curtidas persistentes locais, compartilhamento fácil no WhatsApp e links inteligentes que integram diretamente com outras seções do Portal Hub (Dica de Crescimento).
*   **Manual e Guia Público do Hóspede (`/guia/:orgId/:resourceId`):** Rota pública sem autenticação com layout premium dark. Exibe o nome do item locado, descrição, manual com instruções de entrada passo a passo, regras de convivência, Wi-Fi com botão de cópia com um clique e botão direto de suporte via WhatsApp com o anfitrião.
*   **Modal de Impressão de Placa QR Code:** O proprietário pode visualizar o QR Code gerado automaticamente do imóvel em seu painel e imprimir uma placa formatada de instruções em tamanho A4 para emoldurar fisicamente na propriedade com apenas um clique.
*   **Contrato de Locação Digital (`/contrato/:orgId/:appointmentId`):** Minuta contratual gerada dinamicamente contendo dados do hóspede, do anfitrião, do imóvel, período e preço da locação. Permite assinatura digital simplificada pelo próprio hóspede, registrando nome completo, CPF, data/hora e endereço de IP do dispositivo. Após assinado, gera uma chave de segurança e disponibiliza um botão para salvar/imprimir em PDF perfeitamente formatado para papel A4.

### 9. 📱 Navegação Global e Layout "App-First" (Estilo Linear/Vercel)
*   **Remoção de Sidebar:** Substituição da antiga barra lateral por uma navegação limpa, focada em reter e guiar o usuário em tarefas diárias.
*   **Minimal Top Bar (Cabeçalho Superior Fixo):** Exibe a logo do Hub Symples, nome do cliente, seletor minimalista de planos/assinaturas, notificações dinâmicas e menu flutuante do perfil com acessos administrativos.
*   **Floating Dock Magnético (Desktop):** Dock flutuante premium inspirado no macOS com efeito magnético de zoom parabólico contínuo (os botões e ícones expandem dinamicamente no hover baseados na proximidade do cursor), tooltips de alta legibilidade, mais espaçamento e indicador ativo com transição elástica spring.
*   **Bottom Bar & Bottom Sheet Gaveta (Mobile):** Barra inferior compacta com 5 botões de navegação e menu deslizante de baixo para cima (drawer/gaveta) contendo acessos secundários e troca de planos.

### 10. 📝 Prontuários & Fichas de Anamnese Customizáveis (`PortalRecords.tsx`)
*   **Construtor Visual de Templates:** Permite criar e gerenciar modelos personalizados de fichas de anamnese, avaliações físicas e treinos. Suporta perguntas do tipo texto curto, parágrafo, escolha única (Sim/Não) e múltipla escolha com opções dinâmicas.
*   **Timeline do Histórico do Cliente:** Selecione qualquer cliente da base de dados e confira todo o seu histórico clínico ou estético em uma linha do tempo organizada e reativa.
*   **Preenchimento de Novas Fichas:** Preencha anamneses para o cliente de forma reativa a partir dos templates de modelos criados na organização.
*   **Cadastro Rápido de Clientes:** Interface simplificada para cadastrar clientes manualmente, associando-os aos prontuários mesmo antes de possuírem agendamentos.
*   **Impressão Limpa Otimizada (PDF A4):** Botão de impressão que utiliza folhas no formato A4 e regras CSS de impressão (`@media print`) para gerar prontuários limpos e sem elementos do painel administrativo, ideais para assinatura física do cliente.

### 11. 👥 CRM de Clientes Customizável & Integrado (`PortalClients.tsx`)
*   **Consolidação de Contatos em Tempo Real:** A lista consolidada une contatos criados manualmente e clientes vindos de agendamentos automáticos (tanto links de agendamentos externos quanto registros manuais na agenda) de forma transparente.
*   **Campos Personalizados do Nicho:** Painel onde o profissional pode criar, excluir e organizar campos customizados específicos (ex: Peso, Altura, Faturamento, Restrições Alimentares, Vinho Preferido, etc.) para os cards de seus clientes, com preenchimento reativo.
*   **Edição Irrestrita de Cards:** Capacidade de editar qualquer informação básica ou campos extras de qualquer cliente a qualquer momento. Edições manuais feitas no CRM têm prioridade de exibição, permitindo corrigir erros de digitação de clientes.
*   **Atalho Rápido WhatsApp:** Botão com disparo automático para abrir conversa no WhatsApp (`https://wa.me/...`) do cliente selecionado.
*   **Cadastro e Histórico de Veículos:** Subaba dedicada para cadastrar e gerenciar veículos vinculados a cada cliente (Marca/Modelo, Placa, Ano, Cor, KM e histórico de manutenções/observações) visando o nicho automotivo e estética veicular. A subaba pode ser ocultada/desativada de forma independente através do painel de módulos.
*   **Histórico Completo Unificado:** Visualize no card de cada cliente todos os agendamentos correspondentes (passados e futuros) e os prontuários/fichas de anamnese preenchidos para ele (com botão de visualização/impressão direta).

### 12. ☀️ Modo Claro Elegante (Light Mode)
*   **Design Premium e Suave:** Um modo claro que não inverte as cores por alto contraste, mas que mantém o DNA estético do portal, apresentando um fundo em gradiente off-white/warm-cream (`#f0ece6`), elementos em vidro branco translúcido (*glassmorphism* com `backdrop-blur`) e tipografia escura de alto requinte.
*   **Sincronização com Páginas Públicas:** Ao alterar o tema no painel autenticado, todas as páginas públicas acessadas pelo cliente final (como Agendamento Público, Confirmar Presença, BioSite, Pagamento Pix e tela de Ativação) se ajustam e acompanham a preferência do tema automaticamente e em tempo real via localStorage broadcast.

---

## 🛠️ Stack Tecnológica

*   **Interface:** React 19, Vite 6, Tailwind CSS v4, Lucide React, Motion (animações).
*   **Integração e Autenticação:** Firebase Auth e Firestore SDK.
*   **Mensagens de Feedback:** Sonner.
*   **Roteamento:** React Router DOM v7.

---

## 🔑 Configuração de Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz da pasta seguindo o modelo do `.env.example`:

```bash
# URL da API do CRM administrativo (CORS configurado para portahub.hubsymples.com.br)
VITE_CRM_API_URL=https://hubcrm.hubsymples.com.br

# Credenciais compartilhadas do Firebase
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=hubcrm-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hubcrm-prod
VITE_FIREBASE_STORAGE_BUCKET=hubcrm-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 📦 Como Rodar Localmente (Se houver Node instalado na máquina)

```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento
npm run dev

# Gerar build de produção
npm run build
```

---

## 🧪 Testes Automatizados & Integração Contínua (CI)

A aplicação conta com uma esteira de testes automatizados configurada com **Vitest** para garantir a consistência das regras de negócio e fórmulas de precificação e cálculo de orçamento.

### Como Executar os Testes (Se houver Node instalado na máquina)
```bash
# Executar todos os testes unitários uma vez
npm run test
```

### GitHub Actions (CI)
Toda vez que novas alterações são enviadas (`git push`) ou um Pull Request é aberto para a branch `main`, a esteira do GitHub Actions (.github/workflows/test.yml) é executada automaticamente na nuvem para:
1. Instalar as dependências do projeto.
2. Rodar todos os testes unitários (`vitest run`).
3. Validar a build de produção do Vite/TypeScript (`npm run build`).

Isso garante que códigos que não passem nos testes ou com erros de tipagem/compilação TypeScript não subam para a produção.

---

## ☁️ Deploy na Vercel

O projeto conta com o arquivo `vercel.json` configurado para lidar com rotas SPA do React Router.
Para implantar na Vercel:
1. Crie um novo repositório Git local e publique no seu GitHub.
2. Acesse o painel da Vercel e clique em **Add New > Project**.
3. Importe o repositório `hubcrm-portal`.
4. Configure as variáveis de ambiente (as mesmas definidas no `.env.example`) nas configurações do projeto da Vercel.
5. Defina o domínio personalizado como `portahub.hubsymples.com.br`.
6. Clique em **Deploy**!
