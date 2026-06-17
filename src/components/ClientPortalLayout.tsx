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
  Settings
} from 'lucide-react';
import { usePortalData } from '../hooks/usePortalData';
import { usePortalSupport } from '../hooks/usePortalSupport';
import PortalGrowthHub from '../views/PortalGrowthHub';
import { toast, Toaster } from 'sonner';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

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
  const [growthSubTab, setGrowthSubTab] = useState<'brand' | 'templates' | 'sales' | 'trainings'>('brand');

  useEffect(() => {
    if (activeTab === 'growth') {
      setIsGrowthExpanded(true);
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
    { id: 'management', label: 'Meu Negócio', icon: Briefcase },
    { id: 'growth', label: 'Hub de Crescimento', icon: Rocket },
    ...(client && !client.isCourtesy ? [
      { id: 'finance', label: 'Faturas Hub', icon: CreditCard },
      { id: 'services', label: 'Marketplace', icon: ShoppingBag }
    ] : []),
    { id: 'docs', label: 'Documentos', icon: Files },
    { id: 'support', label: 'Atendimento', icon: MessageCircle },
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
    <div className="min-h-screen bg-[#050505] text-white flex overflow-hidden font-sans">
      <Toaster position="top-right" theme="dark" />
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-black/50 backdrop-blur-xl border-b border-white/10 z-50 flex items-center justify-between px-6">
        <div className="flex flex-col">
          <span className="text-[10px] text-primary-500 font-bold uppercase tracking-widest">Portal Hub</span>
          <h1 className="text-sm font-bold text-white">
            {navItems.find(i => i.id === activeTab)?.label}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 hover:bg-white/5 rounded-xl transition-colors">
            <Bell size={20} className="text-gray-400" />
            {(announcement || hasUnreadSupport) && <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-black animate-pulse" />}
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-72 bg-[#05070a]/60 backdrop-blur-[35px] border-r border-white/10 transform transition-transform duration-300 lg:relative lg:translate-x-0 overflow-hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6 relative z-10">
          <div className="flex items-center justify-between mb-10 lg:mb-12">
            <div className="flex items-center gap-3">
              <img 
                src="https://i.imgur.com/zCvL7xy.png" 
                alt="Hub Symples Logo" 
                className="w-10 h-10 object-contain drop-shadow-lg" 
              />
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-none">Portal <span className="text-primary-500">Hub</span></span>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400">
              <X size={20} />
            </button>
          </div>

          {/* Subscription Selector */}
          {allClients.length > 1 && (
            <div className="mb-8 relative z-10">
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-3 px-2">Suas Assinaturas</p>
              <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                {allClients.map((sub) => {
                  const isActive = activeClientId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveClientId(sub.id)}
                      className={`
                        w-full flex flex-col items-start p-3.5 rounded-2xl transition-all duration-300 border text-left relative overflow-hidden group/sub
                        ${isActive 
                          ? 'bg-[#0a0c10]/60 border-primary-500/30 text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)]' 
                          : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:border-white/10'}
                      `}
                    >
                      {isActive && (
                        <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-primary-500/10 to-transparent pointer-events-none" />
                      )}
                      <span className={`text-xs font-bold truncate w-full transition-colors ${isActive ? 'text-white' : 'group-hover/sub:text-white'}`}>{sub.plan}</span>
                      <span className="text-[9px] opacity-50 font-mono mt-0.5 truncate w-full">{sub.id.toUpperCase()}</span>
                      {isActive && (
                        <div className="mt-2 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">Ativa</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-2 relative z-10">
            {navItems.map((item) => {
              const isGrowth = item.id === 'growth';
              const isSelected = activeTab === item.id;

              if (isGrowth) {
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab('growth');
                        setIsGrowthExpanded(!isGrowthExpanded);
                      }}
                      className={`
                        w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                        ${isSelected 
                          ? 'bg-white/5 text-white border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.02)] font-semibold' 
                          : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}
                      `}
                    >
                      {isSelected && (
                        <motion.div 
                          layoutId="activePortalTabBg"
                          className="absolute inset-0 bg-primary-500/10 border border-primary-500/20 rounded-2xl -z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      {isSelected && (
                        <motion.div 
                          layoutId="activePortalTabIndicator"
                          className="absolute left-0 top-[15%] bottom-[15%] w-[3px] bg-primary-400 rounded-r-full shadow-[0_0_8px_currentColor] text-primary-400 z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <item.icon size={20} className={`transition-all duration-300 group-hover:scale-110 ${isSelected ? 'text-primary-400' : 'group-hover:text-primary-400'}`} />
                      <span className="font-medium">{item.label}</span>
                      <ChevronDown 
                        size={16} 
                        className={`ml-auto text-gray-500 transition-transform duration-300 ${isGrowthExpanded ? 'rotate-180 text-primary-400' : 'group-hover:text-gray-300'}`} 
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isGrowthExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden pl-4 pr-1 py-1 space-y-1 flex flex-col border-l border-white/5 ml-6"
                        >
                          {[
                            { subId: 'brand', label: 'Cofre da Marca', icon: Palette },
                            { subId: 'templates', label: 'Templates Rápidos', icon: Layout },
                            { subId: 'sales', label: 'Arsenal de Vendas', icon: FileText },
                            { subId: 'trainings', label: 'Treinamentos', icon: Video },
                          ].map((subItem) => {
                            const isSubActive = isSelected && growthSubTab === subItem.subId;
                            const SubIcon = subItem.icon;
                            return (
                              <button
                                key={subItem.subId}
                                onClick={() => {
                                  setActiveTab('growth');
                                  setGrowthSubTab(subItem.subId as any);
                                  setIsSidebarOpen(false);
                                }}
                                className={`
                                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-300 text-left relative group/subitem cursor-pointer
                                  ${isSubActive 
                                    ? 'text-white font-semibold' 
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}
                                `}
                              >
                                {isSubActive && (
                                  <motion.div 
                                    layoutId="activePortalSubTabBg"
                                    className="absolute inset-0 bg-primary-500/10 border border-primary-500/20 rounded-xl -z-10"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                  />
                                )}
                                <SubIcon size={14} className={`transition-colors ${isSubActive ? 'text-primary-400' : 'text-gray-600 group-hover/subitem:text-primary-400'}`} />
                                <span>{subItem.label}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                    ${isSelected 
                      ? 'bg-white/5 text-white border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.02)] font-semibold' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}
                  `}
                >
                  {isSelected && (
                    <motion.div 
                      layoutId="activePortalTabBg"
                      className="absolute inset-0 bg-primary-500/10 border border-primary-500/20 rounded-2xl -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {isSelected && (
                    <motion.div 
                      layoutId="activePortalTabIndicator"
                      className="absolute left-0 top-[15%] bottom-[15%] w-[3px] bg-primary-400 rounded-r-full shadow-[0_0_8px_currentColor] text-primary-400 z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon size={20} className={`transition-all duration-300 group-hover:scale-110 ${isSelected ? 'text-primary-400' : 'group-hover:text-primary-400'}`} />
                  <span className="font-medium">{item.label}</span>
                  {item.id === 'support' && hasUnreadSupport && (
                    <span className="ml-auto w-2 h-2 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10 space-y-3 relative z-10">
            <div 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 p-4 bg-[#0a0c10]/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-inner cursor-pointer hover:bg-white/5 transition-all group"
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${
                client.status === 'Ativo'
                  ? 'border-2 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'border-2 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              }`}>
                {(userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl) ? (
                  <img src={userProfile?.photoURL || userProfile?.imageUrl || client.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (userProfile?.displayName || userProfile?.name || client.name).charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="font-semibold truncate text-sm text-white group-hover:text-primary-400 transition-colors">{userProfile?.displayName || userProfile?.name || client.name}</span>
                <span className="text-[10px] text-gray-500 truncate lowercase mb-0.5">{userProfile?.email || client.email}</span>
                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border w-fit ${
                  client.status === 'Ativo'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  Plano {client.status}
                </span>
              </div>
            </div>
            {currentUser && (
              <button
                onClick={async () => {
                  try {
                    await auth.signOut();
                    localStorage.removeItem('portalToken');
                    toast.success('Você saiu da área restrita.');
                    setActiveTab('home');
                  } catch (e) {
                    toast.error('Erro ao sair.');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
              >
                <LogOut size={14} />
                Sair
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden pt-16 lg:pt-0 relative">
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

        {/* Top Header */}
        <header className="hidden lg:flex items-center justify-between px-10 h-24 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mt-1">
              Seja bem-vindo, {client.name.split(' ')[0]}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group">
              <Bell size={20} className="text-gray-400 group-hover:text-white" />
              {(announcement || hasUnreadSupport) && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary-500 rounded-full border-2 border-[#050505] animate-pulse" />}
            </button>
            <div className="h-8 w-px bg-white/10 mx-2" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Status do Plano</span>
              <span className={`text-xs font-bold ${client.status === 'Ativo' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {client.status}
              </span>
            </div>
          </div>
        </header>

        {/* View Container */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-10 pb-32 lg:pb-10 custom-scrollbar relative">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeTab + activeClientId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
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

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-2xl border-t border-white/10 z-50 flex items-center justify-around px-2 print:hidden">
        {navItems.filter(item => ['home', 'agenda', 'crm_finance', 'management', 'support'].includes(item.id)).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              flex flex-col items-center gap-1 p-2 transition-all duration-300 relative
              ${activeTab === item.id ? 'text-primary-500' : 'text-gray-500'}
            `}
          >
            <div className="relative">
              <item.icon size={20} />
              {item.id === 'support' && hasUnreadSupport && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-black animate-pulse" />
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            {activeTab === item.id && (
              <motion.div 
                layoutId="activeIndicatorMobile"
                className="absolute -top-2 w-10 h-1 bg-primary-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
