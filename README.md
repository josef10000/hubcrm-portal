# 🌐 PORTAL HUB — CANAL DO CLIENTE INDEPENDENTE

Aplicação web do **Portal Hub** (antigo canal do cliente), desacoplada do CRM principal e estruturada para rodar de forma isolada no domínio **`portahub.hubsymples.com.br`** com deploy simplificado na Vercel.

O Portal Hub compartilha o mesmo banco de dados do Firebase Firestore do CRM administrativo, garantindo reatividade e sincronização em tempo real de chamados, faturas e agendamentos sem duplicidade de dados.

---

## 🚀 Principais Recursos

### 1. 📊 Módulo "Meu Negócio" (`PortalManagement.tsx`)
*   **Controle de Estoque (`PortalInventory.tsx`):** Gestão de materiais e quantidade mínima crítica com alertas visuais, cálculo financeiro em tempo real do **Valor de Patrimônio Ativo** (Quantidade × Custo Unitário), filtro rápido para itens com estoque crítico, e **Linha do Tempo de Histórico de Movimentações** (entradas, saídas e consumo de insumos por agendamento concluído) sincronizada com Firestore.
*   **Calculadora de Orçamentos (`PortalCalculator.tsx`):** Simulador de precificação dinâmico baseado em custos de materiais e horas de trabalho estimadas.
*   **Performance Financeira & Analytics (`PortalCRMFinance.tsx`):** Análise de lucro líquido real, receitas e despesas extras. Inclui **gráficos analíticos dinâmicos puros em SVG** (Evolução do fluxo de caixa de receitas vs despesas e distribuição de gastos por categorias em gráfico Donut).
*   **Projeção de Caixa e Simulador de Break-Even:** Previsão de faturamento baseada nos próximos 15 e 30 dias de agendamentos confirmados e calculadora simuladora reativa de ponto de equilíbrio contra metas de custos fixos reais.
*   **Fechamento do Mês (PDF Executivo A4):** Relatório de fechamento estético executivo otimizado para salvamento em PDF ou impressão física no formato padrão A4, ocultando os elementos do portal na impressão (`print:hidden`).

### 2. 📅 Agenda e Atendimentos (`PortalAgenda.tsx`)
*   **Organização por Sub-Abas de Configurações:** Interface de configurações estruturada com navegação horizontal contendo abas estéticas e isoladas: 🕒 Horários de Atendimento, ⚙️ Regras e Rótulos, 🔗 Mini-Site/Bio, 📦 Pacotes de Clientes e 🏆 Clube de Fidelidade.
*   **Gestão de Pacotes de Clientes (`PortalPackages.tsx`):** Lançamento, listagem e controle de saldo de créditos de sessões ativas dos clientes (ex: 10 sessões) com chave geral de ativação do recurso no portal, integrado como sub-aba da Agenda.
*   **Clube de Fidelidade Digital (`PortalFidelity.tsx`):** Ativação, parametrização de metas e descrição de prêmios do cartão fidelidade, e painel de acompanhamento em tempo real do progresso de carimbos acumulados, integrado como sub-aba da Agenda.
*   **Dedução de Créditos Automatizada:** O sistema debita de forma autônoma 1 sessão do pacote do cliente e registra a movimentação no histórico de visitas quando o atendimento correspondente é finalizado como concluído (`completed`).
*   **Timeline Interativa & Visão Mensal:** Exibição reativa de compromissos com alternância dinâmica entre a Visão Diária (Timeline) e a Visão Mensal (calendário completo com contagem de agendamentos e indicadores coloridos de status: pendente, confirmado ou agendado).
*   **Slots de Horários Inteligentes:** Geração de slots de atendimento dinâmicos baseados no expediente e intervalo comercial definidos nas configurações, filtrando conflitos em tempo real.
*   **Bloqueio Rápido de Horários:** Atalho para bloquear slots na timeline ("Horário Bloqueado"), impedindo novas reservas no respectivo intervalo.
*   **Indicador de Fidelidade na Timeline:** Badge que exibe estrelas acumuladas de clientes fiéis baseadas nos atendimentos com status `completed` no Firestore.
*   **Baixa Automática no Estoque:** Débito automático de materiais do estoque físico e registro de log ao marcar atendimentos como concluídos.
*   **Personalização de Rótulos Dinâmicos:** Nomenclaturas singular/plural customizáveis (ex: "Agendamento" -> "Proposta", "Sessão") aplicadas dinamicamente em toda a interface do portal.
*   **Confirmação via WhatsApp:** Templates customizáveis e dinâmicos de mensagens do WhatsApp nas configurações da agenda (com tags como `{nome}`, `{servico}`, `{data}`, `{hora}`, `{valor}` e `{link}`).
*   **Página Pública de Confirmação (`ConfirmarPresenca.tsx`):** Rota pública sem autenticação (`/confirmar-presenca`) onde o cliente final pode confirmar ou cancelar compromissos, exibindo a logo personalizada da empresa ou o fallback padrão.
*   **Geração Automática de Pix Estático (QR Code & Copia e Cola):** Motor de cálculo autônomo baseado no padrão EMV BR Code (Pix Estático) integrado às páginas públicas de finalização de agendamento (`PortalPublicBooking.tsx`) e confirmação de presença (`ConfirmarPresenca.tsx`). Apresenta QR Code gerado em tempo real, Pix Copia e Cola com clique-copia e botão verde destacado para envio imediato de comprovante de pagamento via WhatsApp do estabelecimento.
*   **Checkout Pix por Link Público (`/pagar-pix`):** Rota pública sem autenticação que recebe os parâmetros Pix na URL e renderiza uma tela escura de pagamento esteticamente premium, com QR Code gigante centralizado e botão reativo para copiar a chave copia-e-cola com um clique.
*   **Módulo de Cobrança Rápida do Profissional:** Botão "Cobrar Pix" na Timeline Diária do profissional que gera o Pix do agendamento com valor editável e formata a mensagem com link para envio rápido pelo WhatsApp do cliente.
*   **Gerador de Pix Avulso:** Painel estético sempre visível na aba de configurações do Pix que permite gerar cobranças Pix personalizadas de qualquer valor com geração de QR Code e código Copia e Cola em tempo real, além de envio formatado direto para o WhatsApp de qualquer contato.
*   **Clube de Fidelidade Digital:** Cartão de carimbos gamificado de fidelização na tela pública de confirmação de presença.
*   **Faturamento Automático:** Integração onde a conclusão de um atendimento na timeline gera e consolida automaticamente a receita no painel do CRM Financeiro.

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

### 6. 💬 Atendimento & Central de Suporte (`PortalSupport.tsx`)
*   **Chamados de Suporte:** Abertura e acompanhamento de chamados categorizados por assunto e urgência.
*   **Histórico de Interações:** Chat dinâmico de conversação e indicação visual imediata na sidebar para novas respostas de administradores.

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
