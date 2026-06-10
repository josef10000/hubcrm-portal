# 🌐 PORTAL HUB — CANAL DO CLIENTE INDEPENDENTE

Aplicação web do **Portal Hub** (antigo canal do cliente), desacoplada do CRM principal e estruturada para rodar de forma isolada no domínio **`portalhub.hubsymples.com.br`** com deploy simplificado na Vercel.

O Portal Hub compartilha o mesmo banco de dados do Firebase Firestore do CRM administrativo, garantindo reatividade e sincronização em tempo real de chamados, faturas e agendamentos sem duplicidade de dados.

---

## 🚀 Principais Recursos e Módulos

### 1. 📊 Módulo "Meu Negócio"
*   **Controle de Estoque (`PortalInventory.tsx`):** Gestão de materiais e quantidade mínima crítica com alertas visuais.
*   **Calculadora de Orçamentos (`PortalCalculator.tsx`):** Simulador de precificação baseado em custos de materiais e horas de serviço.
*   **Performance Financeira (`PortalCRMFinance.tsx`):** Análise de lucro líquido real e margem por projeto com base em insumos e despesas extras.

### 2. 📅 Agenda e Atendimentos
*   Exibição reativa de compromissos futuros.
*   Alertas preventivos integrados ao estoque se o consumo de insumos dos agendamentos futuros confirmados exceder o estoque físico atual.

### 3. 💳 Faturamento (Faturas Hub)
*   Visualização e acompanhamento de faturas geradas no Asaas via API integrada segura.
*   Status de pagamento e datas de vencimento em dia.

### 4. 💬 Atendimento & Chamados
*   Central de suporte para abertura e acompanhamento de chamados.

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
# URL da API do CRM administrativo (CORS configurado para portalhub.hubsymples.com.br)
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
5. Defina o domínio personalizado como `portalhub.hubsymples.com.br`.
6. Clique em **Deploy**!
