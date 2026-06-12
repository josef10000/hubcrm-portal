# 🌐 PORTAL HUB — CANAL DO CLIENTE INDEPENDENTE

Aplicação web do **Portal Hub** (antigo canal do cliente), desacoplada do CRM principal e estruturada para rodar de forma isolada no domínio **`portahub.hubsymples.com.br`** com deploy simplificado na Vercel.

O Portal Hub compartilha o mesmo banco de dados do Firebase Firestore do CRM administrativo, garantindo reatividade e sincronização em tempo real de chamados, faturas e agendamentos sem duplicidade de dados.

---

## 🚀 Principais Recursos

### 1. 📊 Módulo "Meu Negócio" (`PortalManagement.tsx`)
*   **Controle de Estoque (`PortalInventory.tsx`):** Gestão de materiais e quantidade mínima crítica com alertas visuais, cálculo financeiro em tempo real do **Valor de Patrimônio Ativo** (Quantidade × Custo Unitário), filtro rápido para itens com estoque crítico, e **Linha do Tempo de Histórico de Movimentações** (entradas, saídas e consumo de insumos por agendamento concluído) sincronizada com Firestore.
*   **Calculadora de Orçamentos (`PortalCalculator.tsx`):** Simulador de precificação dinâmico baseado em custos de materiais e horas de trabalho estimadas.
*   **Performance Financeira (`PortalCRMFinance.tsx`):** Análise de lucro líquido real, receitas, despesas extras, conciliação direta de transações e margem operacional por projeto.
*   **Fechamento do Mês (PDF Executivo A4):** Relatório de fechamento estético executivo otimizado para salvamento em PDF ou impressão física no formato padrão A4, ocultando os elementos do portal na impressão (`print:hidden`).

### 2. 📅 Agenda e Atendimentos (`PortalAgenda.tsx`)
*   **Timeline Interativa & Visão Mensal:** Exibição reativa de compromissos com alternância dinâmica entre a Visão Diária (Timeline) e a Visão Mensal (calendário completo com contagem de agendamentos e indicadores coloridos de status: pendente, confirmado ou agendado).
*   **Slots de Horários Inteligentes:** Geração de slots de atendimento dinâmicos baseados no expediente e intervalo comercial definidos nas configurações, filtrando conflitos em tempo real.
*   **Bloqueio Rápido de Horários:** Atalho para bloquear slots na timeline ("Horário Bloqueado"), impedindo novas reservas no respectivo intervalo.
*   **Indicador de Fidelidade:** Badge que exibe estrelas acumuladas de clientes fiéis baseadas nos atendimentos com status `completed` no Firestore.
*   **Baixa Automática no Estoque:** Débito automático de materiais do estoque físico e registro de log ao marcar atendimentos como concluídos.
*   **Personalização de Rótulos Dinâmicos:** Nomenclaturas singular/plural customizáveis (ex: "Agendamento" -> "Proposta", "Sessão") aplicadas dinamicamente em toda a interface do portal.
*   **Confirmação via WhatsApp:** Templates customizáveis e dinâmicos de mensagens do WhatsApp nas configurações da agenda (com tags como `{nome}`, `{servico}`, `{data}`, `{hora}`, `{valor}` e `{link}`).
*   **Página Pública de Confirmação (`ConfirmarPresenca.tsx`):** Rota pública sem autenticação (`/confirmar-presenca`) onde o cliente final pode confirmar ou cancelar compromissos, exibindo a logo personalizada da empresa ou o fallback padrão.
*   **Clube de Fidelidade Digital:** Cartão de carimbos gamificado de fidelização na tela de confirmação de presença (editável nas configurações de fidelidade da organização).
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
*   **Agendamento Online Público (`/agendar/:orgId`):** Fluxo de reserva externa onde clientes selecionam serviços, data/hora e solicitam pré-reservas gerando mensagens diretas no WhatsApp para confirmação e validação do estabelecimento.
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
