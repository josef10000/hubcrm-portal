export interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string;
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
