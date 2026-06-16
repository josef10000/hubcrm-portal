# Graph Report - hubcrm-portal  (2026-06-15)

## Corpus Check
- 35 files · ~45,401 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 176 nodes · 263 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a1d00ecf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 19 edges
2. `db` - 15 edges
3. `Client` - 9 edges
4. `🚀 Principais Recursos` - 9 edges
5. `PortalCalculator()` - 7 edges
6. `🌐 PORTAL HUB — CANAL DO CLIENTE INDEPENDENTE` - 7 edges
7. `scripts` - 5 edges
8. `usePortalSupport()` - 5 edges
9. `auth` - 5 edges
10. `Offer` - 5 edges

## Surprising Connections (you probably didn't know these)
- `PortalSupport()` --calls--> `usePortalSupport()`  [EXTRACTED]
  src/views/PortalSupport.tsx → src/hooks/usePortalSupport.ts
- `PortalDocumentsProps` --references--> `Client`  [EXTRACTED]
  src/views/PortalDocuments.tsx → src/types/index.ts
- `PortalSupportProps` --references--> `SupportTicket`  [EXTRACTED]
  src/views/PortalSupport.tsx → src/types/index.ts
- `ClientPortalLayout()` --calls--> `usePortalData()`  [EXTRACTED]
  src/components/ClientPortalLayout.tsx → src/hooks/usePortalData.ts
- `ClientPortalLayout()` --calls--> `usePortalSupport()`  [EXTRACTED]
  src/components/ClientPortalLayout.tsx → src/hooks/usePortalSupport.ts

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (16): ClientPortalLayout(), usePortalData(), usePortalSupport(), CloudinaryResponse, uploadToCloudinary(), app, auth, db (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (12): Client, ClientContract, ClientLog, GrowthAsset, Offer, Payment, PortalAgendaProps, PortalDocumentsProps (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (9): ConfirmModalProps, CustomSelectProps, Option, InventoryItem, PortalInventoryProps, Expense, PortalCRMFinanceProps, Revenue (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (19): dependencies, clsx, firebase, lucide-react, motion, react, react-dom, react-router-dom (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (17): 1. 📊 Módulo "Meu Negócio" (`PortalManagement.tsx`), 2. 📅 Agenda e Atendimentos (`PortalAgenda.tsx`), 3. 💳 Faturamento e Faturas (`PortalFinance.tsx`), 4. 🛍️ Marketplace de Serviços (`PortalServices.tsx`), 5. 📂 Documentos e Assinatura Digital (`PortalDocuments.tsx`), 6. 💬 Atendimento & Central de Suporte (`PortalSupport.tsx`), 7. 👤 Perfil, Autenticação e Ativação, 8. 🚀 Hub de Crescimento & Rotas Públicas (`PortalGrowthHub.tsx`) (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.35
Nodes (11): InventoryItem, PortalCalculator(), PortalCalculatorProps, SelectedMaterial, calculateLaborCost(), calculateMaterialsCost(), calculateNetProfit(), calculateSuggestedPrice() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (5): ClientPortalLayout, ConfirmarPresenca, PortalActivation, PortalBioSite, PortalPublicBooking

## Knowledge Gaps
- **88 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `Community 0` to `Community 2`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 7` to `Community 4`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11051693404634581 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._