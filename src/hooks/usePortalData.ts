import { useState, useEffect } from 'react';

export function usePortalData(orgId: string | undefined, initialClientId: string | undefined) {
  const [activeClientId, setActiveClientId] = useState<string | undefined>(initialClientId);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';

  // 1. Buscar dados consolidados do portal
  useEffect(() => {
    if (!orgId || !activeClientId) {
      if (!initialClientId) {
        setError("Parâmetros inválidos.");
        setLoading(false);
      }
      return;
    }

    const token = new URLSearchParams(window.location.search).get('token') || sessionStorage.getItem('portalToken');
    if (!token) {
      setError("Token de segurança ausente. Use o link oficial enviado pelo seu consultor.");
      setLoading(false);
      return;
    }

    const fetchPortalData = async () => {
      if (!client) {
        setLoading(true);
      } else {
        setSwitching(true);
      }

      try {
        const response = await fetch(`${crmApiUrl}/api/portal_handler?orgId=${orgId}&clientId=${activeClientId}&token=${token}`);
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Erro ao carregar dados do portal.");
        }

        const data = await response.json();
        
        setClient(data.client);
        setPaymentsHistory(data.payments || []);
        setRequests(data.requests || []);
        setOffers(data.offers || []);
        setAnnouncement(data.announcement);
        
        if (allClients.length === 0) {
          setAllClients([data.client]);
        }

        setLoading(false);
        setSwitching(false);
        setError(null);
      } catch (err: any) {
        console.error("Portal fetch error:", err);
        setError(err.message);
        setLoading(false);
        setSwitching(false);
      }
    };

    fetchPortalData();

    // Polling a cada 60 segundos para manter dados atualizados
    const interval = setInterval(fetchPortalData, 60000);
    return () => clearInterval(interval);
  }, [orgId, activeClientId]);

  // 2. Buscar todas as assinaturas vinculadas (CPF/CNPJ)
  useEffect(() => {
    if (!orgId || !initialClientId || !client?.cpfCnpj) return;

    if (allClients.length === 0) {
      setAllClients([client]);
    }
  }, [orgId, initialClientId, client]);

  return { 
    client, 
    allClients,
    activeClientId,
    setActiveClientId,
    paymentsHistory, 
    requests, 
    offers, 
    announcement, 
    loading, 
    switching,
    error 
  };
}
