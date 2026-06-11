import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client, Offer } from '../types';


export function usePortalData(orgId: string | undefined, initialClientId: string | undefined) {
  const [activeClientId, setActiveClientId] = useState<string | undefined>(initialClientId);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
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

    const fetchPortalData = async () => {
      if (!client) {
        setLoading(true);
      } else {
        setSwitching(true);
      }

      try {
        let token: string = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';

        // Se o token não estiver localmente, busca de forma assíncrona do Firestore do cliente
        if (!token) {
          try {
            const clientDocRef = doc(db, 'organizations', orgId as string, 'clients', activeClientId as string);
            const clientDocSnap = await getDoc(clientDocRef);
            if (clientDocSnap.exists()) {
              const clientData = clientDocSnap.data();
              const publicToken = clientData?.publicToken;
              if (publicToken) {
                token = publicToken as string;
                localStorage.setItem('portalToken', publicToken as string);
              }
            }
          } catch (fireErr) {
            console.error("Erro ao obter token do Firestore:", fireErr);
          }
        }

        if (!token) {
          throw new Error("Token de segurança ausente. Use o link oficial enviado pelo seu consultor.");
        }

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

    // Atualiza automaticamente apenas quando o usuário volta a focar na aba/janela do portal
    const handleFocus = () => {
      fetchPortalData();
    };
    window.addEventListener('focus', handleFocus);

    // Polling preventivo de segurança a cada 5 minutos (300000 ms)
    const interval = setInterval(fetchPortalData, 300000);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
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
