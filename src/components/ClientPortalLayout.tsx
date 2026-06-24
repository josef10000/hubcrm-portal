import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Package
} from 'lucide-react';
import { usePortalData } from '../hooks/usePortalData';
import { usePortalSupport } from '../hooks/usePortalSupport';
import PortalGrowthHub from '../views/PortalGrowthHub';
import { toast, Toaster } from 'sonner';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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

const getTabTheme = (tabId: string) => {
  switch (tabId) {
    case 'home':
      return {
        color: 'text-indigo-400',
        activeGlow: 'shadow-[0_0_30px_rgba(99,102,241,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-indigo-500/40 from-indigo-500/25 to-indigo-500/5',
        mobileColor: 'text-indigo-400',
        mobileIndicator: 'bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]'
      };
    case 'agenda':
    case 'agenda_settings':
      return {
        color: 'text-emerald-400',
        activeGlow: 'shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-emerald-500/40 from-emerald-500/25 to-emerald-500/5',
        mobileColor: 'text-emerald-400',
        mobileIndicator: 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
      };
    case 'crm_finance':
      return {
        color: 'text-amber-400',
        activeGlow: 'shadow-[0_0_30px_rgba(245,158,11,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-amber-500/40 from-amber-500/25 to-amber-500/5',
        mobileColor: 'text-amber-400',
        mobileIndicator: 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
      };
    case 'management':
      return {
        color: 'text-cyan-400',
        activeGlow: 'shadow-[0_0_30px_rgba(6,182,212,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-cyan-500/40 from-cyan-500/25 to-cyan-500/5',
        mobileColor: 'text-cyan-400',
        mobileIndicator: 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
      };
    case 'growth':
      return {
        color: 'text-pink-400',
        activeGlow: 'shadow-[0_0_30px_rgba(236,72,153,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-pink-500/40 from-pink-500/25 to-pink-500/5',
        mobileColor: 'text-pink-400',
        mobileIndicator: 'bg-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.6)]'
      };
    case 'services':
      return {
        color: 'text-orange-400',
        activeGlow: 'shadow-[0_0_30px_rgba(249,115,22,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-orange-500/40 from-orange-500/25 to-orange-500/5',
        mobileColor: 'text-orange-400',
        mobileIndicator: 'bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]'
      };
    case 'support':
      return {
        color: 'text-sky-400',
        activeGlow: 'shadow-[0_0_30px_rgba(14,165,233,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-sky-500/40 from-sky-500/25 to-sky-500/5',
        mobileColor: 'text-sky-400',
        mobileIndicator: 'bg-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.6)]'
      };
    default:
      return {
        color: 'text-primary-400',
        activeGlow: 'shadow-[0_0_30px_rgba(249,115,22,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] border-primary-500/40 from-primary-500/25 to-primary-500/5',
        mobileColor: 'text-primary-400',
        mobileIndicator: 'bg-primary-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]'
      };
  }
};

export default function ClientPortalLayout() {
  const { orgId, clientId } = useParams<{ orgId: string; clientId: string }>();
  const navigate = useNavigate();

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
  
  const [activeTab, setActiveTab] = useState('home');
  const [isGrowthExpanded, setIsGrowthExpanded] = useState(false);
  const [growthSubTab, setGrowthSubTab] = useState<'brand' | 'insights' | 'templates' | 'sales' | 'trainings'>('brand');

  // Novos estados para a navegação App-First
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'agenda_settings', label: 'Configurações', icon: Settings },
    { id: 'crm_finance', label: 'CRM Financeiro', icon: DollarSign },
    { id: 'management', label: 'Estoque & Negócio', icon: Package },
    { id: 'growth', label: 'Hub de Crescimento', icon: Rocket },
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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans relative">
      <Toaster position="top-right" theme="dark" />
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Minimal Top Bar (Desktop & Mobile) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#05070a]/60 backdrop-blur-xl border-b border-white/10 z-40 flex items-center justify-between px-6 md:px-10 select-none">
        {/* Esquerda: Logo e Nome do Cliente */}
        <div id="tour-logo" className="flex items-center gap-3">
          <img 
            src="https://i.imgur.com/zCvL7xy.png" 
            alt="Hub Symples Logo" 
            className="w-10 h-10 lg:w-8 lg:h-8 object-contain drop-shadow-lg cursor-pointer transition-transform hover:scale-105" 
            onClick={() => setActiveTab('home')}
          />
          <div className="flex flex-col text-left">
            <span className="font-black text-base lg:text-sm leading-none tracking-tight">Portal <span className="text-primary-500">Hub</span></span>
            <span className="text-[11px] lg:text-[10px] text-gray-500 mt-0.5 max-w-[150px] md:max-w-none truncate">{client.name}</span>
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

          {/* Notificações (Sininho) */}
          <button 
            id="tour-notifications"
            onClick={() => setActiveTab(client && !client.isCourtesy ? 'support' : 'home')}
            className="relative p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group cursor-pointer"
            title={announcement ? "Ver Comunicados" : "Atendimento"}
          >
            <Bell size={16} className="text-gray-400 group-hover:text-white" />
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
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#0a0c10]/95 border border-white/10 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 text-left border-b border-white/5 mb-1 pb-2">
                      <p className="text-xs font-bold text-white truncate">{userProfile?.displayName || userProfile?.name || client.name}</p>
                      <p className="text-[9px] text-gray-500 truncate lowercase">{userProfile?.email || client.email}</p>
                    </div>

                    <button 
                      onClick={() => { setActiveTab('profile'); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <User size={14} className="text-gray-500" />
                      Editar Perfil
                    </button>

                    <button 
                      onClick={() => { setActiveTab('agenda_settings'); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <Settings size={14} className="text-gray-500" />
                      Configurações da Agenda
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
              {activeTab === 'profile' && (
                <PortalProfile 
                  client={client} 
                  userProfile={userProfile} 
                  orgId={orgId} 
                  clientId={clientId} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 1. Floating Dock (Desktop Only) */}
      <nav id="tour-dock" className="hidden lg:flex fixed bottom-6 left-1/2 -translate-y-0 -translate-x-1/2 z-40 bg-[#0a0c10]/80 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-2.5 items-center gap-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] select-none">
        {navItems.filter(item => ['home', 'agenda', 'crm_finance', 'management', 'growth', 'services', 'support'].includes(item.id)).map((item) => {
          const isSelected = activeTab === item.id || (item.id === 'agenda' && activeTab === 'agenda_settings');
          const theme = getTabTheme(item.id);
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                relative w-12 h-12 flex items-center justify-center transition-all duration-500 group cursor-pointer active:scale-95 outline-none rounded-2xl
                hover:rounded-[35%_65%_50%_50%_/_50%_50%_35%_65%] hover:bg-white/[0.05] hover:border-white/10
                ${isSelected ? theme.color : 'text-gray-500 hover:text-gray-300'}
              `}
              title={item.label}
            >
              {isSelected && (
                <motion.div 
                  layoutId="activeDockTabIndicator"
                  className={`absolute inset-0 rounded-[35%_65%_50%_50%_/_50%_50%_35%_65%] bg-gradient-to-br backdrop-blur-md -z-10 ${theme.activeGlow}`}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon size={20} className="transition-transform group-hover:scale-110" />
              
              {/* Tooltip Estilizado */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-2.5 py-1 bg-black/95 border border-white/10 text-[11px] font-black uppercase text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 tracking-wider whitespace-nowrap scale-90 group-hover:scale-100">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 2. Mobile Bottom Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/85 backdrop-blur-2xl border-t border-white/10 z-40 flex items-center justify-around px-2 pb-safe select-none">
        {[
          { id: 'home', label: 'Home', icon: LayoutDashboard },
          { id: 'agenda', label: 'Agenda', icon: Calendar },
          { id: 'crm_finance', label: 'Finanças', icon: DollarSign },
          { id: 'growth', label: 'Crescer', icon: Rocket },
        ].map((item) => {
          const isSelected = activeTab === item.id || (item.id === 'agenda' && activeTab === 'agenda_settings');
          const theme = getTabTheme(item.id);
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
              className="fixed bottom-0 left-0 right-0 bg-[#07090c]/95 border-t border-white/10 rounded-t-[2.5rem] z-50 p-6 flex flex-col gap-6 lg:hidden max-h-[85vh] overflow-y-auto select-none pb-8"
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

                <button
                  onClick={() => { setActiveTab('management'); setIsMobileMenuOpen(false); }}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                >
                  <Package size={20} className="text-cyan-400" />
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Estoque & Negócio</span>
                </button>

                {/* Agenda Settings (Mobile) */}
                <button
                  onClick={() => { setActiveTab('agenda_settings'); setIsMobileMenuOpen(false); }}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                >
                  <Settings size={20} className="text-gray-400" />
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Ajustes</span>
                </button>
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
      {/* Onboarding Tour */}
      <OnboardingTour setActiveTab={setActiveTab} />
    </div>
  );
}
