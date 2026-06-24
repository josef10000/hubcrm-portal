export interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string;
  imageUrl?: string;
  cpfCnpj?: string;
  billingCycle?: string;
  nextDueDate?: string;
  invoiceUrl?: string;
  whatsapp?: string;
  siteLink?: string;
  niche?: string;
  createdAt?: any;
  assignedTo?: string;
  planPrice?: number;
  setupPrice?: number;
  customMonthlyPrice?: number;
  customSetupPrice?: number;
  isCourtesy?: boolean;
  taxId?: string;
  currentDiscount?: number;
  currentDueDate?: string;
  stages?: any[];
  paymentStatus?: string;
  contracts?: ClientContract[];
  logs?: ClientLog[];
  brandAssets?: {
    logoUrl?: string;
    logos?: { name: string; url: string }[];
    colors?: string[];
    typography?: string;
    customCanvaLinks?: { title: string; url: string }[];
  };
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  isMostHired?: boolean;
  price?: number;
  setupPrice?: number;
  details?: string;
}

export interface ClientContract {
  id: string;
  title: string;
  type: 'pdf' | 'text';
  content: string;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
  signedIp?: string;
  signedUserAgent?: string;
}

export interface ClientLog {
  id: string;
  text: string;
  date: number;
}

export interface Payment {
  id: string;
  status: string;
  dueDate: string;
  value: number;
  description?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
  pixQrCodeUrl?: string;
  netValue?: number;
  paymentLink?: string;
  invoiceHtmlUrl?: string;
}

export interface SupportTicket {
  id: string;
  clientId: string;
  category: string;
  message: string;
  priority: string;
  clientName: string;
  imageUrl?: string;
  status: string;
  origin?: string;
  createdAt?: any;
  updatedAt?: any;
  reply?: string;
  repliedAt?: any;
}

export interface GrowthAsset {
  id: string;
  title: string;
  type: 'video' | 'pdf' | 'script' | 'template';
  url?: string;
  content?: string;
  category?: string;
}

export interface ArticleBlock {
  type: 'paragraph' | 'heading' | 'quote' | 'cta';
  text?: string;
  ctaText?: string;
  ctaAction?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  category: 'Gestão' | 'Vendas' | 'Finanças' | 'Marketing' | 'Geral';
  imageUrl: string;
  publishedAt: string;
  readTime: string;
  likes: number;
  views: number;
  author: {
    name: string;
    role: string;
    avatarUrl: string;
  };
  blocks: ArticleBlock[];
  createdAt: any;
  status?: 'draft' | 'published';
  featured?: boolean;
}


