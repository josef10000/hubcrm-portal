import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { 
  LayoutDashboard, 
  CreditCard, 
  ShoppingBag, 
  Files, 
  MessageCircle, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Calendar,
  DollarSign,
  Briefcase,
  User,
  Rocket,
  ChevronDown,
  Palette,
  Layout,
  FileText,
  Video,
  Settings,
  BookOpen,
  Package,
  Sun,
  Moon,
  Users,
  Sliders
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { usePortalData } from '../hooks/usePortalData';
import { usePortalSupport } from '../hooks/usePortalSupport';
import PortalGrowthHub from '../views/PortalGrowthHub';
import { toast, Toaster } from 'sonner';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import OnboardingTour from './OnboardingTour';

// Importando as views
import PortalHome from '../views/PortalHome';
import PortalFinance from '../views/PortalFinance';
import PortalServices from '../views/PortalServices';
import PortalDocuments from '../views/PortalDocuments';
import PortalSupport from '../views/PortalSupport';
import PortalAgenda from '../views/PortalAgenda';
import PortalCRMFinance from '../views/PortalCRMFinance';
import PortalManagement from '../views/PortalManagement';
import PortalProfile from '../views/PortalProfile';
import PortalClients from '../views/PortalClients';
import PortalModulesConfig from '../views/PortalModulesConfig';
import PortalOrders from '../views/PortalOrders';

const getTabTheme = (tabId: string, isLight: boolean = false) => {
  if (isLight) {
    switch (tabId) {
      case 'home':
        return {
          color: 'text-indigo-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(99,102,241,0.06)] border-indigo-200 bg-indigo-50/30',
          mobileColor: 'text-indigo-700',
          mobileIndicator: 'bg-indigo-700 shadow-sm',
          glowColor: '67, 56, 202',
          hexStart: '#4338ca',
          hexEnd: '#312e81'
        };
      case 'agenda':
      case 'agenda_settings':
        return {
          color: 'text-emerald-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(16,185,129,0.06)] border-emerald-200 bg-emerald-50/30',
          mobileColor: 'text-emerald-700',
          mobileIndicator: 'bg-emerald-700 shadow-sm',
          glowColor: '4, 120, 87',
          hexStart: '#047857',
          hexEnd: '#064e3b'
        };
      case 'crm_finance':
        return {
          color: 'text-amber-800',
          activeGlow: 'shadow-[0_4px_12px_rgba(180,83,9,0.06)] border-amber-200 bg-amber-50/30',
          mobileColor: 'text-amber-800',
          mobileIndicator: 'bg-amber-800 shadow-sm',
          glowColor: '180, 83, 9',
          hexStart: '#b45309',
          hexEnd: '#78350f'
        };
      case 'management':
        return {
          color: 'text-cyan-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(6,182,212,0.06)] border-cyan-200 bg-cyan-50/30',
          mobileColor: 'text-cyan-700',
          mobileIndicator: 'bg-cyan-700 shadow-sm',
          glowColor: '9, 150, 180',
          hexStart: '#0e7490',
          hexEnd: '#164e63'
        };
      case 'growth':
        return {
          color: 'text-pink-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(236,72,153,0.06)] border-pink-200 bg-pink-50/30',
          mobileColor: 'text-pink-700',
          mobileIndicator: 'bg-pink-700 shadow-sm',
          glowColor: '190, 24, 74',
          hexStart: '#be1848',
          hexEnd: '#831843'
        };
      case 'services':
        return {
          color: 'text-orange-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(249,115,22,0.06)] border-orange-200 bg-orange-50/30',
          mobileColor: 'text-orange-700',
          mobileIndicator: 'bg-orange-700 shadow-sm',
          glowColor: '194, 65, 12',
          hexStart: '#c2410c',
          hexEnd: '#7c2d12'
        };
      case 'support':
        return {
          color: 'text-sky-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(14,165,233,0.06)] border-sky-200 bg-sky-50/30',
          mobileColor: 'text-sky-700',
          mobileIndicator: 'bg-sky-700 shadow-sm',
          glowColor: '3, 105, 161',
          hexStart: '#0369a1',
          hexEnd: '#0c4a6e'
        };
      case 'records':
        return {
          color: 'text-purple-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(168,85,247,0.06)] border-purple-200 bg-indigo-50/30',
          mobileColor: 'text-purple-700',
          mobileIndicator: 'bg-purple-700 shadow-sm',
          glowColor: '109, 40, 217',
          hexStart: '#6d28d9',
          hexEnd: '#4c1d95'
        };
      case 'clients':
        return {
          color: 'text-blue-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(37,99,235,0.06)] border-blue-200 bg-blue-50/30',
          mobileColor: 'text-blue-700',
          mobileIndicator: 'bg-blue-700 shadow-sm',
          glowColor: '29, 78, 216',
          hexStart: '#1d4ed8',
          hexEnd: '#1e3a8a'
        };
      case 'orders':
        return {
          color: 'text-rose-700',
          activeGlow: 'shadow-[0_4px_12px_rgba(244,63,94,0.06)] border-rose-200 bg-rose-50/30',
          mobileColor: 'text-rose-700',
          mobileIndicator: 'bg-rose-700 shadow-sm',
          glowColor: '190, 24, 74',
          hexStart: '#be1848',
          hexEnd: '#831843'
        };
      default:
        return {
          color: 'text-gray-900',
          activeGlow: 'shadow-[0_4px_12px_rgba(0,0,0,0.04)] border-gray-200 bg-gray-50/30',
          mobileColor: 'text-gray-900',
          mobileIndicator: 'bg-gray-900 shadow-sm',
          glowColor: '17, 24, 39',
          hexStart: '#111827',
          hexEnd: '#030712'
        };
    }
  }

  // Dark Mode (Padrão)
  switch (tabId) {
    case 'home':
      return {
        color: 'text-indigo-400',
        activeGlow: 'shadow-[0_0_30px_rgba(99,102,241,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-indigo-500/40 from-indigo-500/25 to-indigo-500/5',
        mobileColor: 'text-indigo-400',
        mobileIndicator: 'bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]',
        glowColor: '99, 102, 241',
        hexStart: '#818cf8',
        hexEnd: '#4f46e5'
      };
    case 'agenda':
    case 'agenda_settings':
      return {
        color: 'text-emerald-400',
        activeGlow: 'shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-emerald-500/40 from-emerald-500/25 to-emerald-500/5',
        mobileColor: 'text-emerald-400',
        mobileIndicator: 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]',
        glowColor: '16, 185, 129',
        hexStart: '#34d399',
        hexEnd: '#059669'
      };
    case 'crm_finance':
      return {
        color: 'text-amber-400',
        activeGlow: 'shadow-[0_0_30px_rgba(245,158,11,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-amber-500/40 from-amber-500/25 to-amber-500/5',
        mobileColor: 'text-amber-400',
        mobileIndicator: 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]',
        glowColor: '245, 158, 11',
        hexStart: '#fbbf24',
        hexEnd: '#d97706'
      };
    case 'management':
      return {
        color: 'text-cyan-400',
        activeGlow: 'shadow-[0_0_30px_rgba(6,182,212,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-cyan-500/40 from-cyan-500/25 to-cyan-500/5',
        mobileColor: 'text-cyan-400',
        mobileIndicator: 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]',
        glowColor: '6, 182, 212',
        hexStart: '#22d3ee',
        hexEnd: '#0891b2'
      };
    case 'growth':
      return {
        color: 'text-pink-400',
        activeGlow: 'shadow-[0_0_30px_rgba(236,72,153,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-pink-500/40 from-pink-500/25 to-pink-500/5',
        mobileColor: 'text-pink-400',
        mobileIndicator: 'bg-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.6)]',
        glowColor: '236, 72, 153',
        hexStart: '#f472b6',
        hexEnd: '#db2777'
      };
    case 'services':
      return {
        color: 'text-orange-400',
        activeGlow: 'shadow-[0_0_30px_rgba(249,115,22,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-orange-500/40 from-orange-500/25 to-orange-500/5',
        mobileColor: 'text-orange-400',
        mobileIndicator: 'bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]',
        glowColor: '249, 115, 22',
        hexStart: '#fb923c',
        hexEnd: '#ea580c'
      };
    case 'support':
      return {
        color: 'text-sky-400',
        activeGlow: 'shadow-[0_0_30px_rgba(14,165,233,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-sky-500/40 from-sky-500/25 to-sky-500/5',
        mobileColor: 'text-sky-400',
        mobileIndicator: 'bg-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.6)]',
        glowColor: '14, 165, 233',
        hexStart: '#38bdf8',
        hexEnd: '#0284c7'
      };
    case 'records':
      return {
        color: 'text-purple-400',
        activeGlow: 'shadow-[0_0_30px_rgba(168,85,247,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-purple-500/40 from-purple-500/25 to-purple-500/5',
        mobileColor: 'text-purple-400',
        mobileIndicator: 'bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.6)]',
        glowColor: '168, 85, 247',
        hexStart: '#c084fc',
        hexEnd: '#a855f7'
      };
    case 'clients':
      return {
        color: 'text-blue-400',
        activeGlow: 'shadow-[0_0_30px_rgba(59,130,246,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-blue-500/40 from-blue-500/25 to-blue-500/5',
        mobileColor: 'text-blue-400',
        mobileIndicator: 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]',
        glowColor: '59, 130, 246',
        hexStart: '#60a5fa',
        hexEnd: '#2563eb'
      };
    case 'orders':
      return {
        color: 'text-rose-400',
        activeGlow: 'shadow-[0_0_30px_rgba(244,63,94,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-rose-500/40 from-rose-500/25 to-rose-500/5',
        mobileColor: 'text-rose-400',
        mobileIndicator: 'bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
        glowColor: '244, 63, 94',
        hexStart: '#fb7185',
        hexEnd: '#e11d48'
      };
    default:
      return {
        color: 'text-primary-400',
        activeGlow: 'shadow-[0_0_30px_rgba(249,115,22,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-primary-500/40 from-primary-500/25 to-primary-500/5',
        mobileColor: 'text-primary-400',
        mobileIndicator: 'bg-primary-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]',
        glowColor: '249, 115, 22',
        hexStart: '#fb923c',
        hexEnd: '#ea580c'
      };
  }
};

export default function ClientPortalLayout() {
  const { orgId, clientId } = useParams<{ orgId: string; clientId: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme, isLight } = useTheme();

  // Salva o token da URL no localStorage para persistencia e limpa a URL para maior segurança
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('portalToken', token);
      
      // Remove o token sensível da barra de endereços do navegador sem recarregar a tela
      params.delete('token');
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);
  
  const { 
    client, 
    allClients,
    activeClientId,
    setActiveClientId,
    loading, 
    switching,
    error, 
    announcement, 
    paymentsHistory, 
    offers,
    growthAssets
  } = usePortalData(orgId, clientId);

  const { requests: supportRequests } = usePortalSupport(orgId, client?.id);
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  // Calcula chamados com respostas não lidas
  useEffect(() => {
    if (!supportRequests || supportRequests.length === 0) {
      setHasUnreadSupport(false);
      return;
    }

    const checkUnread = () => {
      const hasUnread = supportRequests.some((ticket) => {
        if (ticket.reply && ticket.repliedAt) {
          const repliedTime = ticket.repliedAt.toMillis 
            ? ticket.repliedAt.toMillis() 
            : (ticket.repliedAt.seconds ? ticket.repliedAt.seconds * 1000 : new Date(ticket.repliedAt).getTime());
          
          const lastViewed = localStorage.getItem(`viewed_ticket_${ticket.id}`);
          if (!lastViewed) return true;
          return Number(lastViewed) < repliedTime;
        }
        return false;
      });
      setHasUnreadSupport(hasUnread);
    };

    checkUnread();
  }, [supportRequests]);

  const handleViewTicket = (ticketId: string) => {
    localStorage.setItem(`viewed_ticket_${ticketId}`, String(Date.now()));
    
    // Força atualização imediata do indicador local
    if (supportRequests) {
      const hasUnread = supportRequests.some((ticket) => {
        if (ticket.reply && ticket.repliedAt) {
          const repliedTime = ticket.repliedAt.toMillis 
            ? ticket.repliedAt.toMillis() 
            : (ticket.repliedAt.seconds ? ticket.repliedAt.seconds * 1000 : new Date(ticket.repliedAt).getTime());
          
          if (ticket.id === ticketId) return false;

          const lastViewed = localStorage.getItem(`viewed_ticket_${ticket.id}`);
          if (!lastViewed) return true;
          return Number(lastViewed) < repliedTime;
        }
        return false;
      });
      setHasUnreadSupport(hasUnread);
    }
  };
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isClientAdmin, setIsClientAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Escuta o perfil do usuário logado do Firestore em tempo real
  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }
    const profileRef = doc(db, 'profiles', currentUser.uid);
    const unsub = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile({ id: docSnap.id, ...docSnap.data() });
      }
    }, (error) => {
      console.error("[DIAGNOSTICO FIRESTORE] Erro de permissão ao ler perfil em:", profileRef.path, error);
    });
    return () => unsub();
  }, [currentUser]);

  // Escuta autenticação para verificar se o usuário está logado como client_admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
          const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
          if (profileSnap.exists()) {
            const pData = profileSnap.data();
            
            // Administradores corporativos têm acesso irrestrito ao portal
            if (pData.role === 'admin' || pData.role === 'manager') {
               setIsClientAdmin(true);
               setAuthLoading(false);
               return;
            }

            if (pData.role === 'client_admin') {
              // Se o cliente tentar acessar o portal de outro ID de cliente, redireciona para o correto dele
              if (pData.orgId !== orgId || pData.clientId !== clientId) {
                console.warn(`[PortalGuard] Divergência de rota. Redirecionando para o portal correto do cliente: /${pData.orgId}/${pData.clientId}`);
                navigate(`/${pData.orgId}/${pData.clientId}`);
                setAuthLoading(false);
                return;
              }
              setIsClientAdmin(true);
            } else {
              setIsClientAdmin(false);
            }
          } else {
            setIsClientAdmin(false);
          }
        } catch (e) {
          console.error('[PortalGuard] Erro ao carregar perfil:', e);
          setIsClientAdmin(false);
        }
      } else {
        setCurrentUser(null);
        setIsClientAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [orgId, clientId, navigate]);

  const [deliveryActive, setDeliveryActive] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const orgDocRef = doc(db, 'organizations', orgId);
    const unsub = onSnapshot(orgDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const orgData = docSnap.data();
        const settings = orgData.deliverySettings || {};
        setDeliveryActive(settings.active !== false);
      }
    });
    return () => unsub();
  }, [orgId]);

  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem(`portal_active_tab_${orgId || ''}_${clientId || ''}`);
    return saved || 'home';
  });

  useEffect(() => {
    if (orgId && clientId) {
      sessionStorage.setItem(`portal_active_tab_${orgId}_${clientId}`, activeTab);
    }
  }, [activeTab, orgId, clientId]);

  const [isGrowthExpanded, setIsGrowthExpanded] = useState(false);
  const [growthSubTab, setGrowthSubTab] = useState<'brand' | 'insights' | 'templates' | 'sales' | 'trainings'>('brand');

  // Configuração de Módulos & Recursos e Assistente de Configuração
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<'agenda' | 'finance' | 'complete'>('complete');
  const [modulesSelection, setModulesSelection] = useState<any>({
    agenda: true,
    agenda_public: true,
    agenda_pix: true,
    crm_finance: true,
    management: true,
    management_pos: true,
    management_calc: true,
    growth: true,
    clients: true,
    clients_fidelity: true
  });

  const modulesConfig = userProfile?.modulesConfig || null;
  const modulesConfigLoading = authLoading || (currentUser && !userProfile);

  // Função auxiliar para verificar ativação dos módulos macros
  const isModuleActive = (tabId: string) => {
    if (!modulesConfig || !modulesConfig.activeModules) return true;
    const active = modulesConfig.activeModules;
    
    if (tabId === 'agenda') return active.agenda !== false;
    if (tabId === 'crm_finance') return active.crm_finance !== false;
    if (tabId === 'management') return active.management !== false;
    if (tabId === 'growth') return active.growth !== false;
    if (tabId === 'clients') return active.clients !== false;
    
    return true;
  };

  // Monitora se o módulo atual foi desativado e redireciona para Home
  useEffect(() => {
    if (activeTab === 'home' || activeTab === 'profile' || activeTab === 'support' || activeTab === 'services') return;
    if (!isModuleActive(activeTab)) {
      setActiveTab('home');
    }
  }, [modulesConfig, activeTab]);

  // Lógica heurística para onboarding: se usuário for antigo (tem agendamentos), ativa tudo silenciosamente no seu profiles.
  useEffect(() => {
    if (modulesConfigLoading || !orgId || !activeClientId || !currentUser) return;
    
    if (!modulesConfig) {
      const diagnoseNewUser = async () => {
        try {
          const apptsRef = collection(db, 'organizations', orgId, 'appointments');
          const apptsSnap = await getDocs(query(apptsRef, limit(1)));
          
          const profileRef = doc(db, 'profiles', currentUser.uid);
          if (!apptsSnap.empty) {
            await updateDoc(profileRef, {
              modulesConfig: {
                onboardingCompleted: true,
                activeModules: {
                  agenda: true,
                  agenda_public: true,
                  agenda_pix: true,
                  crm_finance: true,
                  management: true,
                  management_pos: true,
                  management_calc: true,
                  growth: true,
                  clients: true,
                  clients_fidelity: true
                }
              }
            });
          } else {
            setShowOnboarding(true);
          }
        } catch (err) {
          console.warn("[Onboarding Check] Acesso restrito. Definindo como antigo por padrão no profiles.");
          try {
            const profileRef = doc(db, 'profiles', currentUser.uid);
            await updateDoc(profileRef, {
              modulesConfig: {
                onboardingCompleted: true,
                activeModules: {
                  agenda: true,
                  agenda_public: true,
                  agenda_pix: true,
                  crm_finance: true,
                  management: true,
                  management_pos: true,
                  management_calc: true,
                  growth: true,
                  clients: true,
                  clients_fidelity: true
                }
              }
            });
          } catch (e) {}
        }
      };
      
      diagnoseNewUser();
    } else if (modulesConfig.onboardingCompleted === false) {
      setShowOnboarding(true);
    }
  }, [modulesConfig, modulesConfigLoading, orgId, activeClientId, currentUser]);

  const applyProfileSelection = (profile: 'agenda' | 'finance' | 'complete') => {
    setSelectedProfile(profile);
    if (profile === 'agenda') {
      setModulesSelection({
        agenda: true,
        agenda_public: true,
        agenda_pix: false,
        crm_finance: false,
        management: false,
        management_pos: false,
        management_calc: false,
        growth: false,
        clients: true,
        clients_fidelity: false
      });
    } else if (profile === 'finance') {
      setModulesSelection({
        agenda: true,
        agenda_public: true,
        agenda_pix: true,
        crm_finance: true,
        management: false,
        management_pos: false,
        management_calc: false,
        growth: true,
        clients: true,
        clients_fidelity: true
      });
    } else {
      setModulesSelection({
        agenda: true,
        agenda_public: true,
        agenda_pix: true,
        crm_finance: true,
        management: true,
        management_pos: true,
        management_calc: true,
        growth: true,
        clients: true,
        clients_fidelity: true
      });
    }
  };

  const toggleOnboardingModule = (key: string) => {
    const newSelection = { ...modulesSelection };
    const newValue = !newSelection[key];
    newSelection[key] = newValue;
    
    if (key === 'management' && !newValue) {
      newSelection.management_pos = false;
      newSelection.management_calc = false;
    }
    if (key === 'agenda' && !newValue) {
      newSelection.agenda_public = false;
      newSelection.agenda_pix = false;
    }
    if (key === 'clients' && !newValue) {
      newSelection.clients_fidelity = false;
    }
    if (key === 'management_pos' && newValue) newSelection.management = true;
    if (key === 'management_calc' && newValue) newSelection.management = true;
    if (key === 'agenda_public' && newValue) newSelection.agenda = true;
    if (key === 'agenda_pix' && newValue) newSelection.agenda = true;
    if (key === 'clients_fidelity' && newValue) newSelection.clients = true;
    
    setModulesSelection(newSelection);
  };

  const handleCompleteOnboarding = async () => {
    if (!currentUser) return;
    try {
      const profileRef = doc(db, 'profiles', currentUser.uid);
      await updateDoc(profileRef, {
        modulesConfig: {
          onboardingCompleted: true,
          activeModules: modulesSelection
        }
      });
      setShowOnboarding(false);
      toast.success("Portal configurado com sucesso! Bem-vindo!");
    } catch (err) {
      console.error("Erro ao salvar configuração de onboarding:", err);
      toast.error("Erro ao concluir a configuração.");
    }
  };

  // Novos estados para a navegação App-First
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mouseX = useMotionValue(Infinity);

  useEffect(() => {
    if (activeTab === 'growth') {
      setIsGrowthExpanded(true);
      
      const redirectedSubTab = localStorage.getItem('redirect_growth_subtab');
      if (redirectedSubTab) {
        setGrowthSubTab(redirectedSubTab as any);
        localStorage.removeItem('redirect_growth_subtab');
      }
    }
  }, [activeTab]);



  const navItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    ...(isModuleActive('agenda') ? [
      { id: 'agenda', label: 'Agenda', icon: Calendar },
      { id: 'agenda_settings', label: 'Configurações', icon: Settings }
    ] : []),
    ...(isModuleActive('crm_finance') ? [{ id: 'crm_finance', label: 'Finanças', icon: DollarSign }] : []),
    ...(isModuleActive('management') ? [
      { id: 'management', label: 'Estoque & Negócio', icon: Package },
      ...(deliveryActive ? [{ id: 'orders', label: 'Pedidos Delivery', icon: ShoppingBag }] : [])
    ] : []),
    ...(isModuleActive('growth') ? [{ id: 'growth', label: 'Crescer', icon: Rocket }] : []),
    ...(isModuleActive('clients') ? [{ id: 'clients', label: 'Clientes', icon: Users }] : []),
    ...(client && !client.isCourtesy ? [
      { id: 'finance', label: 'Faturas Hub', icon: CreditCard }
    ] : []),
    ...(client ? [
      { id: 'services', label: 'Marketplace', icon: ShoppingBag }
    ] : []),
    { id: 'docs', label: 'Documentos', icon: Files },
    { id: 'support', label: 'Ajuda & Suporte', icon: MessageCircle },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  // Redireciona automaticamente para o login se não estiver autenticado
  useEffect(() => {
    if (authLoading || (loading && !client)) return;
    if (!isClientAdmin) {
      if (orgId && clientId) {
        sessionStorage.setItem('portalRedirect', `/${orgId}/${clientId}`);
        sessionStorage.setItem('portalOrgId', orgId);
        sessionStorage.setItem('portalClientId', clientId);
      }
      navigate('/login');
    }
  }, [isClientAdmin, authLoading, loading, client, orgId, clientId, navigate]);

  if ((loading && !client) || authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-gray-400 font-medium animate-pulse">Preparando seu Portal Hub...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="bg-white/5 backdrop-blur-xl border border-red-500/20 p-8 rounded-3xl max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-gray-400 text-sm mb-6">{error || "Não foi possível carregar os dados do portal."}</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isClientAdmin) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-gray-400 font-medium animate-pulse">Redirecionando para o login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans relative" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text-primary)' }}>
      <Toaster position="top-right" theme="dark" />
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]"
          style={{ backgroundColor: isLight ? 'rgba(249,115,22,0.06)' : 'rgba(249,115,22,0.10)' }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]"
          style={{ backgroundColor: isLight ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.10)' }}
        />
      </div>

      {/* Minimal Top Bar (Desktop & Mobile) */}
      <header 
        className="fixed top-0 left-0 right-0 h-16 backdrop-blur-xl z-40 flex items-center justify-between px-6 md:px-10 select-none"
        style={{
          backgroundColor: isLight ? 'rgba(240,236,230,0.85)' : 'rgba(5,7,10,0.60)',
          borderBottom: `1px solid var(--theme-border)`
        }}
      >
        {/* Esquerda: Logo e Nome do Cliente */}
        <div id="tour-logo" className="flex items-center gap-3">
          <img 
            src="https://i.imgur.com/zCvL7xy.png" 
            alt="Hub Symples Logo" 
            className="w-10 h-10 lg:w-8 lg:h-8 object-contain drop-shadow-lg cursor-pointer transition-transform hover:scale-105" 
            onClick={() => setActiveTab('home')}
          />
          <div className="flex flex-col text-left">
            <span className="font-black text-base lg:text-sm leading-none tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>Portal <span className="text-primary-500">Hub</span></span>
            <span className="text-[11px] lg:text-[10px] mt-0.5 max-w-[150px] md:max-w-none truncate" style={{ color: 'var(--theme-text-tertiary)' }}>{client.name}</span>
          </div>
        </div>

        {/* Direita: Troca de Plano, Notificações, Perfil */}
        <div className="flex items-center gap-4 relative">
          {/* Seletor de Assinaturas (Dropdown Minimalista) */}
          {allClients.length > 1 && (
            <div className="relative">
              <button 
                onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl text-[10px] font-bold text-gray-300 transition-all cursor-pointer select-none"
              >
                <span>{allClients.find(c => c.id === activeClientId)?.plan || 'Minhas Assinaturas'}</span>
                <ChevronDown size={12} className={`text-gray-500 transition-transform ${isPlanDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown de Planos */}
              <AnimatePresence>
                {isPlanDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-45" onClick={() => setIsPlanDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#0a0c10]/95 border border-white/10 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl z-50 flex flex-col gap-1">
                      {allClients.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveClientId(sub.id);
                            setIsPlanDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-colors cursor-pointer ${
                            activeClientId === sub.id 
                              ? 'bg-primary-500/10 text-primary-400' 
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="block truncate">{sub.plan}</span>
                          <span className="block text-[8px] opacity-40 font-mono mt-0.5">{sub.id.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Toggle Tema Sol/Lua */}
          <motion.button
            onClick={toggleTheme}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className="relative p-2 rounded-xl transition-all group cursor-pointer overflow-hidden"
            style={{ 
              backgroundColor: isLight ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isLight ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.08)'}`
            }}
            title={isLight ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
            aria-label="Alternar tema"
          >
            <AnimatePresence mode="wait">
              {isLight ? (
                <motion.div
                  key="moon"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon size={16} className="text-primary-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="sun"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun size={16} className="text-amber-400" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Notificações (Sininho) */}
          <button 
            id="tour-notifications"
            onClick={() => setActiveTab(client && !client.isCourtesy ? 'support' : 'home')}
            className="relative p-2 rounded-xl transition-all group cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-glass)',
              border: `1px solid var(--theme-border-subtle)`
            }}
            title={announcement ? "Ver Comunicados" : "Atendimento"}
          >
            <Bell size={16} style={{ color: 'var(--theme-text-secondary)' }} className="group-hover:text-white transition-colors" />
            {(announcement || hasUnreadSupport) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Avatar & Dropdown de Perfil (Apenas Desktop) */}
          <div id="tour-profile" className="relative hidden lg:block">
            <button 
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center font-bold text-xs border border-white/10 shadow-lg cursor-pointer overflow-hidden"
            >
              {(userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl) ? (
                <img 
                  src={userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                (userProfile?.displayName || userProfile?.name || client.name).charAt(0).toUpperCase()
              )}
            </button>

            {/* Menu Dropdown de Perfil Desktop */}
            <AnimatePresence>
              {isProfileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-45" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div 
                    className="absolute right-0 top-full mt-2 w-56 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150"
                    style={{ backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(10,12,16,0.95)', border: `1px solid var(--theme-border)` }}
                  >
                    <div className="px-3 py-2 text-left mb-1 pb-2" style={{ borderBottom: `1px solid var(--theme-border-subtle)` }}>
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--theme-text-primary)' }}>{userProfile?.displayName || userProfile?.name || client.name}</p>
                      <p className="text-[9px] truncate lowercase" style={{ color: 'var(--theme-text-tertiary)' }}>{userProfile?.email || client.email}</p>
                    </div>

                    <button 
                      onClick={() => { setActiveTab('profile'); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <User size={14} className="text-gray-500" />
                      Editar Perfil
                    </button>

                    {isModuleActive('agenda') && (
                      <button 
                        onClick={() => { setActiveTab('agenda_settings'); setIsProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                      >
                        <Settings size={14} className="text-gray-500" />
                        Configurações da Agenda
                      </button>
                    )}

                    <button 
                      onClick={() => { setActiveTab('modules_config'); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <Sliders size={14} className="text-gray-500" />
                      Personalizar Módulos
                    </button>

                    <button 
                      onClick={() => { setActiveTab('docs'); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <Files size={14} className="text-gray-500" />
                      Documentos
                    </button>

                    {client && !client.isCourtesy && (
                      <button 
                        onClick={() => { setActiveTab('finance'); setIsProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                      >
                        <CreditCard size={14} className="text-gray-500" />
                        Faturas Hub
                      </button>
                    )}

                    {client && (
                      <button 
                        onClick={() => { setActiveTab('services'); setIsProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                      >
                        <ShoppingBag size={14} className="text-gray-500" />
                        Marketplace
                      </button>
                    )}

                    <button 
                      onClick={() => { setActiveTab('support'); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <MessageCircle size={14} className="text-gray-500" />
                      Ajuda & Suporte
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button 
                      onClick={async () => {
                        setIsProfileDropdownOpen(false);
                        try {
                          await auth.signOut();
                          localStorage.removeItem('portalToken');
                          toast.success('Você saiu da área restrita.');
                          setActiveTab('home');
                        } catch (e) {
                          toast.error('Erro ao sair.');
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <LogOut size={14} />
                      Sair da Conta
                    </button>
                  </div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-16 relative z-10 w-full min-h-screen">
        <AnimatePresence>
          {switching && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
            >
              <div className="flex flex-col items-center gap-3 bg-black/40 p-6 rounded-3xl border border-white/10 shadow-2xl">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full"
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sincronizando...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Title Header */}
        <header className="hidden lg:flex items-center justify-between px-10 pt-8 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white">
              {navItems.find(i => i.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              Operações do Negócio
            </p>
          </div>
        </header>

        {/* View Container */}
        <div className="flex-1 px-4 lg:px-10 pt-6 pb-28 lg:pb-32 custom-scrollbar relative">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeTab + activeClientId}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'home' && (
                <PortalHome 
                  client={client} 
                  announcement={announcement} 
                  setActiveTab={setActiveTab} 
                  supportRequests={supportRequests} 
                  clientId={activeClientId || ''}
                />
              )}
              {activeTab === 'agenda' && (
                <PortalAgenda orgId={orgId || ''} clientId={activeClientId || ''} initialSubTab="timeline" />
              )}
              {activeTab === 'agenda_settings' && (
                <PortalAgenda orgId={orgId || ''} clientId={activeClientId || ''} initialSubTab="settings" hideMainTabs={true} />
              )}
              {activeTab === 'crm_finance' && (
                <PortalCRMFinance orgId={orgId || ''} clientId={activeClientId || ''} />
              )}
              {activeTab === 'management' && (
                <PortalManagement orgId={orgId || ''} clientId={activeClientId || ''} />
              )}
              {activeTab === 'orders' && (
                <PortalOrders orgId={orgId || ''} />
              )}
              {activeTab === 'growth' && (
                <PortalGrowthHub 
                  client={client} 
                  growthAssets={growthAssets} 
                  activeSubTab={growthSubTab}
                  setActiveSubTab={setGrowthSubTab}
                  setActiveTab={setActiveTab}
                />
              )}
              {activeTab === 'finance' && (
                <PortalFinance 
                  client={client} 
                  paymentsHistory={paymentsHistory} 
                  allClients={allClients}
                  activeClientId={activeClientId}
                  setActiveClientId={setActiveClientId}
                />
              )}
              {activeTab === 'services' && <PortalServices offers={offers} client={client} />}
              {activeTab === 'docs' && <PortalDocuments client={client} orgId={orgId || ''} />}
              {activeTab === 'support' && (
                <PortalSupport 
                  client={client} 
                  requests={supportRequests} 
                  onViewTicket={handleViewTicket} 
                />
              )}
              {activeTab === 'clients' && (
                <PortalClients 
                  orgId={orgId || ''} 
                  clientId={clientId || ''}
                  userProfile={userProfile}
                />
              )}
              {activeTab === 'profile' && (
                <PortalProfile 
                  client={client} 
                  userProfile={userProfile} 
                  orgId={orgId} 
                  clientId={clientId} 
                />
              )}
              {activeTab === 'modules_config' && (
                <PortalModulesConfig 
                  userProfile={userProfile} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 1. Floating Dock (Desktop Only) */}
      <nav 
        id="tour-dock" 
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="hidden lg:flex fixed bottom-6 left-1/2 -translate-y-0 -translate-x-1/2 z-40 backdrop-blur-2xl rounded-[2rem] px-6 h-22 items-end pb-3.5 gap-3.5 select-none transition-all duration-300"
        style={{
          backgroundColor: isLight ? 'rgba(255,255,255,0.80)' : 'rgba(10,12,16,0.80)',
          border: `1px solid var(--theme-border)`,
          boxShadow: isLight ? '0 15px 50px rgba(0,0,0,0.08)' : '0 15px 50px rgba(0,0,0,0.6)'
        }}
      >
        {navItems.filter(item => ['home', 'agenda', 'crm_finance', 'management', 'growth', 'clients', 'services', 'support', 'orders'].includes(item.id)).map((item) => {
          const isSelected = activeTab === item.id || (item.id === 'agenda' && activeTab === 'agenda_settings');
          const theme = getTabTheme(item.id, isLight);
          return (
            <DockItem
              key={item.id}
              mouseX={mouseX}
              isSelected={isSelected}
              theme={theme}
              onClick={() => setActiveTab(item.id)}
              label={item.label}
              icon={item.icon}
            />
          );
        })}
      </nav>

      {/* 2. Mobile Bottom Navigation Bar (Mobile Only) */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 backdrop-blur-2xl z-40 flex items-center justify-around px-2 pb-safe select-none"
        style={{
          backgroundColor: isLight ? 'rgba(250,248,245,0.92)' : 'rgba(0,0,0,0.85)',
          borderTop: `1px solid var(--theme-border)`
        }}
      >
        {[
          { id: 'home', label: 'Home', icon: LayoutDashboard },
          ...(isModuleActive('agenda') ? [{ id: 'agenda', label: 'Agenda', icon: Calendar }] : []),
          ...(isModuleActive('crm_finance') ? [{ id: 'crm_finance', label: 'Finanças', icon: DollarSign }] : []),
          ...(isModuleActive('growth') ? [{ id: 'growth', label: 'Crescer', icon: Rocket }] : []),
        ].map((item) => {
          const isSelected = activeTab === item.id || (item.id === 'agenda' && activeTab === 'agenda_settings');
          const theme = getTabTheme(item.id, isLight);
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer relative
                ${isSelected ? theme.mobileColor : 'text-gray-500'}
              `}
            >
              <item.icon size={20} className="transition-transform" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">{item.label}</span>
              {isSelected && (
                <motion.div 
                  layoutId="activeIndicatorMobile"
                  className={`absolute -top-2 w-8 h-0.5 rounded-full ${theme.mobileIndicator}`}
                />
              )}
            </button>
          );
        })}
        {/* Botão Menu do Mobile (Foto de Perfil ou ☰) */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center p-2 rounded-xl active:scale-95 cursor-pointer text-gray-500 hover:text-white"
        >
          <div className="w-5 h-5 rounded-full bg-[#0a0c10] flex items-center justify-center border border-white/10 overflow-hidden shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.05)]">
            {(userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl) ? (
              <img 
                src={userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl} 
                alt="Avatar" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <Menu size={14} className="text-white" />
            )}
          </div>
          <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Menu</span>
        </button>
      </nav>

      {/* 3. Mobile Bottom Sheet Menu (Gaveta) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden"
            />
            
            {/* Drawer Gaveta */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-[2.5rem] z-50 p-6 flex flex-col gap-6 lg:hidden max-h-[85vh] overflow-y-auto select-none pb-8"
              style={{
                backgroundColor: isLight ? 'rgba(250,248,245,0.97)' : 'rgba(7,9,12,0.95)',
                borderTop: `1px solid var(--theme-border)`
              }}
            >
              {/* Drag Handle Indicator */}
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto shrink-0" />

              {/* Informações do Usuário */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center font-bold text-sm border border-white/10 overflow-hidden shrink-0">
                  {(userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl) ? (
                    <img src={userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (userProfile?.displayName || userProfile?.name || client.name).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="font-bold text-sm text-white truncate">{userProfile?.displayName || userProfile?.name || client.name}</span>
                  <span className="text-[10px] text-gray-500 truncate lowercase">{userProfile?.email || client.email}</span>
                </div>
                <span className={`ml-auto text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                  client.status === 'Ativo' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {client.status}
                </span>
              </div>

              {/* Seletor de Assinaturas Mobile */}
              {allClients.length > 1 && (
                <div className="space-y-2 text-left">
                  <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Suas Assinaturas</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
                    {allClients.map((sub) => {
                      const isActive = activeClientId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveClientId(sub.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`px-4 py-2.5 rounded-xl border text-left shrink-0 cursor-pointer active:scale-95 ${
                            isActive 
                              ? 'bg-primary-500/10 border-primary-500/30 text-white font-bold' 
                              : 'bg-white/5 border-transparent text-gray-400'
                          }`}
                        >
                          <span className="text-xs block">{sub.plan}</span>
                          <span className="text-[8px] opacity-40 font-mono mt-0.5 block">{sub.id.toUpperCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Links de Recursos Secundários */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                >
                  <User size={20} className="text-violet-400" />
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Perfil</span>
                </button>

                <button
                  onClick={() => { setActiveTab('modules_config'); setIsMobileMenuOpen(false); }}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                >
                  <Sliders size={20} className="text-pink-400" />
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Módulos</span>
                </button>

                <button
                  onClick={() => { setActiveTab('docs'); setIsMobileMenuOpen(false); }}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                >
                  <Files size={20} className="text-blue-400" />
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Documentos</span>
                </button>

                {client && !client.isCourtesy && (
                  <button
                    onClick={() => { setActiveTab('finance'); setIsMobileMenuOpen(false); }}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <CreditCard size={20} className="text-emerald-400" />
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Faturas</span>
                  </button>
                )}

                {client && (
                  <button
                    onClick={() => { setActiveTab('services'); setIsMobileMenuOpen(false); }}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <ShoppingBag size={20} className="text-amber-400" />
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Marketplace</span>
                  </button>
                )}

                <button
                  onClick={() => { setActiveTab('support'); setIsMobileMenuOpen(false); }}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                >
                  <MessageCircle size={20} className="text-sky-400" />
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Ajuda & Suporte</span>
                </button>

                {isModuleActive('management') && (
                  <button
                    onClick={() => { setActiveTab('management'); setIsMobileMenuOpen(false); }}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <Package size={20} className="text-cyan-400" />
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Estoque & Negócio</span>
                  </button>
                )}

                {isModuleActive('management') && deliveryActive && (
                  <button
                    onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <ShoppingBag size={20} className="text-rose-400" />
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Pedidos Delivery</span>
                  </button>
                )}

                {isModuleActive('clients') && (
                  <button
                    onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <Users size={20} className="text-blue-400" />
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Clientes</span>
                  </button>
                )}

                {/* Agenda Settings (Mobile) */}
                {isModuleActive('agenda') && (
                  <button
                    onClick={() => { setActiveTab('agenda_settings'); setIsMobileMenuOpen(false); }}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <Settings size={20} className="text-gray-400" />
                    <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Ajustes</span>
                  </button>
                )}
              </div>

              {/* Botão Sair */}
              <button
                onClick={async () => {
                  setIsMobileMenuOpen(false);
                  try {
                    await auth.signOut();
                    localStorage.removeItem('portalToken');
                    toast.success('Você saiu da área restrita.');
                    setActiveTab('home');
                  } catch (e) {
                    toast.error('Erro ao sair.');
                  }
                }}
                className="w-full py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <LogOut size={14} />
                Sair da Conta
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 4. Wizard de Onboarding Prateado Premium */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050608]/95 backdrop-blur-md select-none overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-gradient-to-b from-[#181a20] to-[#0f1013] border border-white/10 rounded-[2.5rem] w-full max-w-2xl shadow-[0_0_60px_rgba(255,255,255,0.03)] overflow-hidden relative"
            >
              {/* Efeito de Reflexo Prateado/Metálico no topo */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-400/30 to-transparent" />
              <div className="absolute -top-[30%] -right-[20%] w-[60%] h-[80%] bg-white/[0.02] rounded-full blur-[80px]" />
              <div className="absolute -bottom-[30%] -left-[20%] w-[60%] h-[80%] bg-white/[0.01] rounded-full blur-[80px]" />

              <div className="p-8 md:p-10 relative z-10 space-y-8">
                {/* Cabeçalho */}
                <div className="text-center space-y-3">
                  <div className="inline-flex p-3 bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/15 rounded-2xl shadow-inner mb-2 text-gray-300">
                    <Sliders size={24} className="text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-white to-gray-400 tracking-tight">
                    Personalize seu Espaço
                  </h2>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    Vamos ativar os recursos essenciais do seu portal. Você poderá ajustar ou alterar isso livremente a qualquer momento no seu Perfil.
                  </p>
                </div>

                {/* Linha de Progresso/Passos Prateada */}
                <div className="flex items-center justify-center gap-2">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${onboardingStep >= 1 ? 'w-10 bg-white' : 'w-2 bg-white/10'}`} />
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${onboardingStep >= 2 ? 'w-10 bg-white' : 'w-2 bg-white/10'}`} />
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${onboardingStep >= 3 ? 'w-10 bg-white' : 'w-2 bg-white/10'}`} />
                </div>

                {/* Conteúdo dos Passos */}
                <div className="min-h-[260px] flex flex-col justify-center">
                  {onboardingStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="text-center space-y-6"
                    >
                      <div className="space-y-2">
                        <h3 className="text-base font-bold text-white">Preparado para modernizar sua gestão?</h3>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                          O portal do profissional permite modularizar a navegação. Escolha os módulos corretos para uma interface sem distrações.
                        </p>
                      </div>
                      <button
                        onClick={() => setOnboardingStep(2)}
                        className="px-8 py-4 bg-gradient-to-r from-gray-200 via-white to-gray-300 hover:from-white hover:to-gray-200 text-black font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-xl transition-all duration-200 cursor-pointer active:scale-95 mx-auto"
                      >
                        Iniciar Configuração
                      </button>
                    </motion.div>
                  )}

                  {onboardingStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h3 className="text-sm font-bold text-center text-gray-300 uppercase tracking-widest mb-2">Selecione seu Perfil de Trabalho</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Perfil 1: Apenas Agenda */}
                        <button
                          type="button"
                          onClick={() => applyProfileSelection('agenda')}
                          className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-40 transition-all duration-300 cursor-pointer active:scale-98 ${
                            selectedProfile === 'agenda'
                              ? 'bg-white/5 border-white text-white shadow-lg'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          <Calendar size={20} className={selectedProfile === 'agenda' ? 'text-white' : 'text-gray-500'} />
                          <div>
                            <span className="text-xs font-bold block">Apenas Agendamentos</span>
                            <span className="text-[9px] mt-1 block leading-relaxed opacity-60">Agenda de horários e cadastro simples de clientes.</span>
                          </div>
                        </button>

                        {/* Perfil 2: Financeiro */}
                        <button
                          type="button"
                          onClick={() => applyProfileSelection('finance')}
                          className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-40 transition-all duration-300 cursor-pointer active:scale-98 ${
                            selectedProfile === 'finance'
                              ? 'bg-white/5 border-white text-white shadow-lg'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          <DollarSign size={20} className={selectedProfile === 'finance' ? 'text-white' : 'text-gray-500'} />
                          <div>
                            <span className="text-xs font-bold block">Finanças & Agenda</span>
                            <span className="text-[9px] mt-1 block leading-relaxed opacity-60">Controle contábil, agendamento online e clube fidelidade.</span>
                          </div>
                        </button>

                        {/* Perfil 3: Completo */}
                        <button
                          type="button"
                          onClick={() => applyProfileSelection('complete')}
                          className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-40 transition-all duration-300 cursor-pointer active:scale-98 ${
                            selectedProfile === 'complete'
                              ? 'bg-white/5 border-white text-white shadow-lg'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          <Rocket size={20} className={selectedProfile === 'complete' ? 'text-white' : 'text-gray-500'} />
                          <div>
                            <span className="text-xs font-bold block">Completo & Vendas</span>
                            <span className="text-[9px] mt-1 block leading-relaxed opacity-60">Agenda, fluxo de caixa, estoque físico, PDV e marketing.</span>
                          </div>
                        </button>
                      </div>

                      <div className="flex justify-end pt-4 gap-3">
                        <button
                          onClick={() => setOnboardingStep(1)}
                          className="px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          onClick={() => setOnboardingStep(3)}
                          className="px-6 py-3.5 bg-gradient-to-r from-gray-200 via-white to-gray-300 hover:from-white hover:to-gray-200 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Avançar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <h3 className="text-sm font-bold text-center text-gray-300 uppercase tracking-widest">Rever e Confirmar Módulos</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        <label className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04]">
                          <div>
                            <span className="text-xs font-bold text-white block">📅 Agenda</span>
                            <span className="text-[9px] text-gray-500 block">Agenda e bloqueios de horários.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={modulesSelection.agenda}
                            onChange={() => toggleOnboardingModule('agenda')}
                            className="w-4 h-4 accent-white rounded"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04]">
                          <div>
                            <span className="text-xs font-bold text-white block">👥 Clientes (CRM)</span>
                            <span className="text-[9px] text-gray-500 block">Cadastro e ficha de evolução clínica.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={modulesSelection.clients}
                            onChange={() => toggleOnboardingModule('clients')}
                            className="w-4 h-4 accent-white rounded"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04]">
                          <div>
                            <span className="text-xs font-bold text-white block">💰 Finanças</span>
                            <span className="text-[9px] text-gray-500 block">Fluxo de caixa contábil básico.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={modulesSelection.crm_finance}
                            onChange={() => toggleOnboardingModule('crm_finance')}
                            className="w-4 h-4 accent-white rounded"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04]">
                          <div>
                            <span className="text-xs font-bold text-white block">📦 Estoque & Insumos</span>
                            <span className="text-[9px] text-gray-500 block">Controle físico de produtos.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={modulesSelection.management}
                            onChange={() => toggleOnboardingModule('management')}
                            className="w-4 h-4 accent-white rounded"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04]">
                          <div>
                            <span className="text-xs font-bold text-white block">🚀 Crescer</span>
                            <span className="text-[9px] text-gray-500 block">Recursos de atração de marketing.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={modulesSelection.growth}
                            onChange={() => toggleOnboardingModule('growth')}
                            className="w-4 h-4 accent-white rounded"
                          />
                        </label>

                        {/* PDV (Opcional - Requer Estoque) */}
                        {modulesSelection.management && (
                          <label className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04] pl-6 border-l border-white/20">
                            <div>
                              <span className="text-xs font-bold text-white block">🛒 Caixa Rápido / PDV</span>
                              <span className="text-[9px] text-gray-500 block">Faturamento e baixa em estoque.</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={modulesSelection.management_pos}
                              onChange={() => toggleOnboardingModule('management_pos')}
                              className="w-4 h-4 accent-white rounded"
                            />
                          </label>
                        )}
                      </div>

                      <div className="flex justify-end pt-4 gap-3">
                        <button
                          onClick={() => setOnboardingStep(2)}
                          className="px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          onClick={handleCompleteOnboarding}
                          className="px-6 py-3.5 bg-gradient-to-r from-gray-200 via-white to-gray-300 hover:from-white hover:to-gray-200 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                        >
                          Salvar e Começar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Tour */}
      <OnboardingTour setActiveTab={setActiveTab} />
    </div>
  );
}

interface DockItemProps {
  mouseX: any;
  isSelected: boolean;
  theme: any;
  onClick: () => void;
  label: string;
  icon: any;
}

function DockItem({ mouseX, isSelected, theme, onClick, label, icon: Icon }: DockItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [48, 70, 48]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [48, 70, 48]);

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 250,
    damping: 18,
  });
  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 250,
    damping: 18,
  });

  const iconSize = useTransform(distance, [-150, 0, 150], [20, 30, 20]);
  const iconSizeSpring = useSpring(iconSize, {
    mass: 0.1,
    stiffness: 250,
    damping: 18,
  });

  const gradientId = `gradient-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const glowRGB = theme.glowColor || '249, 115, 22';
  const colorStart = theme.hexStart || '#f97316';
  const colorEnd = theme.hexEnd || '#ea580c';

  return (
    <div 
      ref={ref} 
      className="relative w-12 h-12 flex items-end justify-center shrink-0"
    >
      <motion.button
        style={{ width, height }}
        onClick={onClick}
        className={`
          absolute bottom-0 flex items-center justify-center cursor-pointer active:scale-95 outline-none rounded-full shrink-0 group
          ${isSelected ? theme.color : 'text-gray-500 hover:text-gray-300'}
        `}
      >
        {/* Aura de Brilho Neon Traseiro (Aceso) */}
        <div 
          className={`absolute inset-0 rounded-full filter blur-xl transition-all duration-500 opacity-0 group-hover:opacity-40
            ${isSelected ? 'opacity-90 scale-110' : 'scale-90'}`}
          style={{
            background: `radial-gradient(circle, rgba(${glowRGB}, 0.8) 0%, rgba(${glowRGB}, 0) 70%)`
          }}
        />

        {/* Círculo Flutuante de Vidro */}
        <div 
          className={`absolute inset-0 rounded-full border transition-all duration-300
            ${isSelected 
              ? 'bg-white/10 border-white/25 shadow-lg' 
              : 'bg-white/[0.03] border-white/5 group-hover:bg-white/[0.08] group-hover:border-white/15'}`}
          style={{
            boxShadow: isSelected 
              ? `0 8px 24px rgba(${glowRGB}, 0.35), inset 0 2px 4px rgba(255,255,255,0.15)` 
              : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))'
          }}
        />

        {/* Ícone centralizado e animado */}
        <motion.div 
          style={{ width: iconSizeSpring, height: iconSizeSpring }} 
          className="relative z-10 shrink-0 flex items-center justify-center transition-transform group-hover:scale-105"
        >
          <Icon className="w-full h-full" />
        </motion.div>
        
        {/* Tooltip Estilizado */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 px-2.5 py-1 bg-black/95 border border-white/10 text-[11px] font-black uppercase text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 tracking-wider whitespace-nowrap scale-90 group-hover:scale-100 z-50">
          {label}
        </span>
      </motion.button>
    </div>
  );
}
