import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Megaphone,
  Calendar,
  MessageSquare,
  DollarSign,
  User,
  Plus,
  CalendarPlus,
  ExternalLink,
  ChevronRight,
  Phone,
  Check,
  X,
  Trash2,
  AlertCircle,
  BookOpen,
  Copy,
  Edit,
  Award
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

interface PortalHomeProps {
  client: any;
  announcement: any;
  setActiveTab: (tab: string) => void;
  supportRequests: any[];
  clientId: string;
}

export default function PortalHome({ client, announcement, setActiveTab, supportRequests, clientId }: PortalHomeProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const linkAgendamento = `${window.location.origin}/agendar/${orgId}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(linkAgendamento);
    toast.success("Link de agendamento copiado para a área de transferência!");
  };

  const isClientVip = client.isCourtesy || (client.plan && client.plan.toUpperCase().includes('VIP'));
  const [appointmentsToday, setAppointmentsToday] = useState<any[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<any[]>([]);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<any[]>([
    {
      id: 'local',
      title: 'Atendimento no Local',
      text: 'Olá, {nome}! Confirmando seu agendamento de {servico} para o dia {data} às {hora}. Valor: R$ {valor}. Para confirmar ou reagendar seu horário, clique no link: {link}. Te aguardamos!'
    }
  ]);
  const [expediente, setExpediente] = useState<any>({});
  const [loadingApps, setLoadingApps] = useState(true);
  const [recentPost, setRecentPost] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [crmClientsList, setCrmClientsList] = useState<any[]>([]);

  // Rótulos Dinâmicos
  const labelSingular = expediente?.appointmentLabelSingular || 'Agendamento';
  const labelPlural = expediente?.appointmentLabelPlural || 'Agendamentos';

  // Calcula Progresso do Projeto
  const completedStages = client.stages?.filter((s: any) => s.completed).length || 0;
  const totalStages = client.stages?.length || 0;
  const progress = client.isCourtesy ? 100 : (totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0);
  const isSubscription = !!client.asaasSubscriptionId;

  // Calcula contagem de chamados ativos
  const activeTicketsCount = supportRequests.filter(ticket => ticket.status !== 'concluido').length;

  // Data atual formatada (ex: Quinta-feira, 11 de Junho)
  const formattedDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  // Escuta Configuração de Expediente e Clientes CRM
  useEffect(() => {
    if (!orgId) return;
    
    // Tenta escutar do documento do próprio cliente primeiro
    let docRef = doc(db, 'organizations', orgId, 'settings', 'scheduling');
    if (clientId) {
      docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    }

    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (clientId) {
          const sched = data.schedulingSettings || {};
          setExpediente(sched);
          if (sched.whatsappTemplates && Array.isArray(sched.whatsappTemplates)) {
            setWhatsappTemplates(sched.whatsappTemplates);
          }
          // Extrai o catálogo do CRM de forma dinâmica
          const fid = data.fidelitySettings || {};
          setCrmClientsList(fid.crmClients || []);
        } else {
          setExpediente(data);
          if (data.whatsappTemplates && Array.isArray(data.whatsappTemplates)) {
            setWhatsappTemplates(data.whatsappTemplates);
          }
        }
      }
    }, (err) => {
      console.warn("[PortalHome] Não foi possível ler as configurações de expediente diretamente do Firestore (caindo para fallbacks):", err.message || err);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // Escuta os compromissos reativamente e calcula LTV / Inativos
  useEffect(() => {
    if (!orgId) return;
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    const appointmentsRef = collection(db, 'organizations', orgId, 'appointments');

    const unsub = onSnapshot(appointmentsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filtra os agendamentos para o dia de hoje que estão confirmados
      const filteredToday = list.filter((app: any) => 
        app.date === todayStr && 
        app.status === 'confirmed'
      );
      filteredToday.sort((a: any, b: any) => a.time.localeCompare(b.time));
      setAppointmentsToday(filteredToday);

      // Filtra compromissos futuros com status 'created' ou 'pending' (para disparar confirmação)
      const filteredPending = list.filter((app: any) => 
        app.date >= todayStr && 
        app.status !== 'completed' &&
        app.status !== 'cancelled' &&
        app.status !== 'confirmed' &&
        app.serviceId !== 'bloqueio'
      );
      filteredPending.sort((a: any, b: any) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
      });
      setPendingAppointments(filteredPending);

      // CALCULA CLIENTES INATIVOS (LTV)
      const clientLastVisits: Record<string, { name: string, phone: string, lastDate: string, hasFuture: boolean }> = {};
      const today = new Date();
      const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

      list.forEach((app: any) => {
        if (!app.clientPhone) return;
        const phone = app.clientPhone.trim();
        const name = app.clientName || 'Cliente';
        const dateStr = app.date; // YYYY-MM-DD
        
        // Verifica se possui agendamento ativo ou pendente no futuro
        const isFuture = dateStr >= todayStr && (app.status === 'confirmed' || app.status === 'pending');

        if (!clientLastVisits[phone]) {
          clientLastVisits[phone] = {
            name,
            phone,
            lastDate: app.status === 'completed' ? dateStr : '',
            hasFuture: isFuture
          };
        } else {
          if (isFuture) {
            clientLastVisits[phone].hasFuture = true;
          }
          if (app.status === 'completed') {
            if (!clientLastVisits[phone].lastDate || dateStr > clientLastVisits[phone].lastDate) {
              clientLastVisits[phone].lastDate = dateStr;
            }
          }
        }
      });

      // Filtra clientes sem visita futura e cuja última visita foi há mais de 30 dias
      const inactives: any[] = [];
      Object.values(clientLastVisits).forEach((client: any) => {
        if (client.hasFuture || !client.lastDate) return;
        
        const lastVisitDate = new Date(client.lastDate + 'T12:00:00');
        const diffTime = todayTime - new Date(lastVisitDate.getFullYear(), lastVisitDate.getMonth(), lastVisitDate.getDate()).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 30) {
          inactives.push({
            name: client.name,
            phone: client.phone,
            lastDateStr: client.lastDate,
            daysInactive: diffDays
          });
        }
      });

      inactives.sort((a, b) => b.daysInactive - a.daysInactive);
      setInactiveClients(inactives);
      
      setLoadingApps(false);
    }, (error) => {
      console.error("[DIAGNOSTICO FIRESTORE] Erro de permissão ao ler agendamentos na Home em:", appointmentsRef.path, error);
      setLoadingApps(false);
    });

    return () => unsub();
  }, [orgId]);

  // Escuta o artigo mais recente publicado no blog_posts
  useEffect(() => {
    const q = query(
      collection(db, 'blog_posts'),
      where('status', '==', 'published')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPosts: any[] = [];
      snapshot.forEach((doc) => {
        loadedPosts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Ordenar localmente por createdAt desc (para evitar erro de índice composto em queries compostas sem índice)
      loadedPosts.sort((a, b) => {
        const dateA = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      });

      if (loadedPosts.length > 0) {
        setRecentPost(loadedPosts[0]);
      } else {
        setRecentPost(null);
      }
      setLoadingInsights(false);
    }, (error) => {
      console.warn('Erro ao carregar artigos na Home:', error);
      setLoadingInsights(false);
    });

    return () => unsubscribe();
  }, []);

  const renderWhatsAppText = (templateText: string, app: any) => {
    if (!app) return '';
    const linkPublico = `https://portalhub.hubsymples.com.br/confirmar-presenca?id=${app.id}&orgId=${orgId}&clientId=${client.id}`;
    const dataFormatada = app.date ? new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    
    return templateText
      .replace(/{nome}/g, app.clientName || '')
      .replace(/{servico}/g, app.serviceName || '')
      .replace(/{data}/g, dataFormatada)
      .replace(/{hora}/g, app.time || '')
      .replace(/{valor}/g, app.price ? app.price.toFixed(2).replace('.', ',') : '0,00')
      .replace(/{link}/g, linkPublico);
  };

  const handleSendWhatsAppMessage = async (app: any) => {
    if (!app || !orgId) return;

    const template = whatsappTemplates[0]; // Usa o primeiro template cadastrado (padrão)
    const text = renderWhatsAppText(template.text, app);
    const phone = app.clientPhone.replace(/\D/g, '');

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'appointments', app.id), {
        status: 'pending'
      });
    } catch (err) {
      console.error('Erro ao atualizar status do agendamento para pendente:', err);
    }

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const getAppStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Concluído', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
      case 'confirmed':
        return { label: 'Confirmado', color: 'text-blue-400', bg: 'bg-blue-500/10' };
      default:
        return { label: 'Pendente', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    }
  };

  const handleConfirmApp = async (appId: string) => {
    if (!orgId) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'appointments', appId), {
        status: 'confirmed'
      });
      toast.success('Agendamento confirmado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao confirmar agendamento.');
    }
  };

  const handleCancelApp = async (appId: string) => {
    if (!orgId) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'appointments', appId), {
        status: 'cancelled'
      });
      toast.success('Agendamento cancelado/recusado.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao recusar agendamento.');
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Saudação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest block">{formattedDate}</span>
          <h2 className="text-xl lg:text-2xl font-bold text-white mt-1">Seja bem-vindo, {client.name.split(' ')[0]} 👋</h2>
        </div>
      </div>

      {/* Announcement Banner */}
      {announcement && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-1 rounded-[2rem] lg:rounded-3xl border ${
            announcement.type === 'warning' 
              ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30' 
              : announcement.type === 'success'
                ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500/30'
                : announcement.type === 'new_feature'
                  ? 'bg-gradient-to-r from-primary-500/20 to-purple-500/20 border-primary-500/30'
                  : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30'
          }`}
        >
          <div className="bg-[#0a0a0a]/60 backdrop-blur-xl p-4 lg:p-6 rounded-[calc(2rem-4px)] lg:rounded-[calc(1.5rem-1px)] flex items-start gap-4 lg:gap-5">
            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 border ${
              announcement.type === 'warning' 
                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' 
                : announcement.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : announcement.type === 'new_feature'
                    ? 'bg-primary-500/10 border-primary-500/20 text-primary-400'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <Megaphone className="w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base lg:text-lg mb-1">{announcement.title}</h3>
              <p className="text-gray-400 text-xs lg:text-sm leading-relaxed">{announcement.message}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: Compromissos Hoje */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex items-center justify-between group premium-card-hover cursor-pointer" onClick={() => setActiveTab('agenda')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Calendar size={22} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{labelSingular} de Hoje</p>
              <p className="text-2xl font-black text-white">{loadingApps ? '...' : `${appointmentsToday.length} ${appointmentsToday.length === 1 ? labelSingular.toLowerCase() : labelPlural.toLowerCase()}`}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>

        {/* KPI 2: Chamados Ativos */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex items-center justify-between group premium-card-hover cursor-pointer" onClick={() => setActiveTab('support')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
              <MessageSquare size={22} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Chamados Ativos</p>
              <p className="text-2xl font-black text-white">{activeTicketsCount} em aberto</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>

        {/* KPI 3: Status Financeiro */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex items-center justify-between group premium-card-hover cursor-pointer" onClick={() => setActiveTab('finance')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <DollarSign size={22} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Financeiro</p>
              <p className="text-2xl font-black text-white">
                {client.paymentStatus === 'RECEIVED' ? 'Faturas em dia' : 'Vencimento pendente'}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Brand & Marketing Hub Card */}
        <div className="lg:col-span-2 group bg-white/[0.02] backdrop-blur-3xl border border-white/10 p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] relative overflow-hidden transition-all duration-500 hover:border-white/20 flex flex-col justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          {/* Luzes de Fundo Decorativas */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] pointer-events-none -z-10 group-hover:bg-primary-500/15 transition-all duration-500" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none -z-10" />

          {/* Topo: Logo, Nome da Marca e Status Assinatura */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Logo do Cliente CRM */}
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 bg-black/40 shadow-2xl flex items-center justify-center shrink-0 group-hover:border-primary-500/30 transition-colors">
                {client.logoUrl || client.logo || client.imageUrl ? (
                  <img 
                    src={client.logoUrl || client.logo || client.imageUrl} 
                    alt="Logo da Empresa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center font-black text-2xl uppercase text-white">
                    {client.name ? client.name.charAt(0) : 'E'}
                  </div>
                )}
              </div>

              {/* Nome e Categoria da Marca */}
              <div className="text-left">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Minha Empresa</span>
                <h3 className="text-xl lg:text-2xl font-black text-white leading-tight tracking-tight mt-0.5 group-hover:text-primary-400 transition-colors">
                  {client.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full font-bold text-gray-400 uppercase tracking-wider">
                    {client.plan || 'Plano Ativo'}
                  </span>
                  
                  {/* Status do Site Clicável */}
                  {client.siteLink && (
                    <a 
                      href={client.siteLink.startsWith('http') ? client.siteLink : `https://${client.siteLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 rounded-full text-[9px] font-bold text-emerald-400 transition-all active:scale-95 group/site"
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Site Online & Ativo
                      <ExternalLink size={8} className="text-emerald-400/70 group-hover/site:translate-x-0.5 transition-transform" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Badges de Assinatura VIP vs Padrão */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              {isClientVip ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/30 rounded-2xl">
                  <Award size={14} className="text-yellow-400 animate-pulse" />
                  <span className="text-[10px] font-black text-yellow-400 uppercase tracking-wider">★ Membro VIP Partner</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">★ Plano Hub Padrão</span>
                  </div>
                  <button 
                    onClick={() => setActiveTab('support')}
                    className="text-[9px] font-bold text-primary-400 hover:text-primary-300 transition-colors uppercase tracking-wider flex items-center gap-1 underline underline-offset-2"
                  >
                    Upgrade para VIP ↗
                  </button>
                </div>
              )}
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest sm:text-right">Faturas em Dia</span>
            </div>
          </div>

          {/* Seção de Métricas Rápidas do Negócio */}
          <div className="grid grid-cols-2 gap-4 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
            <div>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">Clientes no CRM</span>
              <span className="text-lg font-black text-white">{crmClientsList.length} contatos</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">Operação</span>
              <span className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Ativa & Aberta</span>
            </div>
          </div>

          <div className="h-px bg-white/5 w-full my-1" />

          {/* Baixo: Links de Divulgação e Ações Rápidas */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Divulgue Seu Negócio (Link de Agendamentos)</span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-gray-400 font-mono truncate transition-all">
                  <span className="truncate select-all">{linkAgendamento}</span>
                  <button 
                    onClick={handleCopyLink}
                    className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-all shrink-0 ml-2"
                    title="Copiar Link"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={linkAgendamento} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Globe size={14} />
                    Ver Página
                  </a>
                  <button 
                    onClick={() => setActiveTab('agenda_settings')}
                    className="flex-1 sm:flex-none px-4 py-3 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 hover:border-primary-500/30 text-primary-400 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Edit size={14} />
                    Editar Links
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-400" />
              Ações Rápidas
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setActiveTab('support')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group transition-all"
              >
                <Plus size={20} className="text-primary-400 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Novo Chamado</span>
              </button>

              <button 
                onClick={() => setActiveTab('agenda')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group transition-all"
              >
                <CalendarPlus size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Novo(a) {labelSingular}</span>
              </button>

              <button 
                onClick={() => setActiveTab('crm_finance')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group transition-all"
              >
                <DollarSign size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">CRM Financeiro</span>
              </button>

              <button 
                onClick={() => setActiveTab('profile')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-center group transition-all"
              >
                <User size={20} className="text-violet-400 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Minha Conta</span>
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-full mt-6 py-4 bg-[#0a0c10]/40 border border-white/10 hover:border-white/20 rounded-2xl font-bold flex items-center justify-center gap-2 group hover:bg-[#0a0c10]/60 transition-all text-xs uppercase tracking-wider"
          >
            Editar Cadastro
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Seções de Agenda de Hoje & Pendentes de Confirmação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Seção Agenda de Hoje */}
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                <Calendar size={16} className="text-primary-400" />
                {labelPlural} de Hoje
              </h4>
              <button 
                onClick={() => setActiveTab('agenda')}
                className="text-xs text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1 group whitespace-nowrap transition-colors"
              >
                Ver {labelPlural}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            
            <div className="divide-y divide-white/5 p-2">
              {loadingApps ? (
                <div className="p-12 text-center text-gray-500 italic text-sm">Buscando {labelPlural.toLowerCase()} de hoje...</div>
              ) : appointmentsToday.length === 0 ? (
                <div className="p-12 text-center py-16">
                  <Calendar size={32} className="mx-auto text-gray-600 mb-4 opacity-50" />
                  <p className="text-gray-500 text-sm">Nenhum(a) {labelSingular.toLowerCase()} agendado(a) para hoje.</p>
                  <button 
                    onClick={() => setActiveTab('agenda')}
                    className="mt-4 px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white rounded-xl transition-all"
                  >
                    Novo(a) {labelSingular}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 p-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                  {appointmentsToday.map((app) => {
                    const badge = getAppStatusBadge(app.status);
                    return (
                      <div 
                        key={app.id}
                        className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 shrink-0">
                            <Clock size={18} />
                          </div>
                          <div className="min-w-0 font-medium">
                            <h5 className="font-bold text-white text-sm truncate">{app.serviceName}</h5>
                            <p className="text-[10px] text-gray-500 mt-0.5 truncate">Cliente: {app.clientName}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xs font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">{app.time}</span>
                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seção Pendentes de Confirmação */}
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                <Phone size={16} className="text-amber-400" />
                Confirmar {labelPlural}
              </h4>
            </div>
            
            <div className="divide-y divide-white/5 p-2">
              {loadingApps ? (
                <div className="p-12 text-center text-gray-500 italic text-sm">Buscando pendências...</div>
              ) : pendingAppointments.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center py-16">
                  <CheckCircle size={32} className="mx-auto text-emerald-500 mb-4 opacity-50" />
                  <p className="text-gray-500 text-sm">Tudo em dia! Nenhuma pendência de confirmação.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 p-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                  {pendingAppointments.map((app) => {
                    const badge = getAppStatusBadge(app.status);
                    const appDateFormatted = app.date ? new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
                    return (
                      <div 
                        key={app.id}
                        className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button 
                            onClick={() => handleSendWhatsAppMessage(app)}
                            title="Enviar lembrete de confirmação via WhatsApp"
                            className="w-10 h-10 shrink-0 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition-all hover:scale-105"
                          >
                            <Phone size={18} />
                          </button>
                          <div className="min-w-0 font-medium">
                            <h5 className="font-bold text-white text-sm truncate">{app.serviceName}</h5>
                            <p className="text-[10px] text-gray-500 mt-0.5 truncate">Cliente: {app.clientName}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right flex flex-col items-end gap-1.5">
                            <span className="text-[11px] font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 whitespace-nowrap">
                              {appDateFormatted} às {app.time}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmApp(app.id)}
                              title="Confirmar Agendamento"
                              className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelApp(app.id)}
                              title="Recusar/Cancelar Agendamento"
                              className="w-9 h-9 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Seção LTV - Reativação de Clientes Inativos */}
      <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl space-y-6">
        <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
              <AlertCircle size={16} className="text-primary-400" />
              💡 Reativar Clientes (LTV)
            </h4>
            <p className="text-xs text-gray-400">Clientes que realizaram serviços no passado e não agendaram mais nada nos últimos 30 dias.</p>
          </div>
          <span className="px-3 py-1 bg-primary-500/10 border border-primary-500/20 rounded-lg text-[10px] text-primary-400 font-bold uppercase tracking-wider self-start sm:self-auto">
            Inativos há 30 dias+
          </span>
        </div>

        <div className="p-6">
          {inactiveClients.length === 0 ? (
            <p className="text-gray-500 text-xs italic text-center py-8">Nenhum cliente inativo há mais de 30 dias detectado no momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveClients.slice(0, 6).map((clientItem, idx) => {
                const handleSendLTVMessage = () => {
                  const bioUrl = `${window.location.origin}/bio/${orgId}`;
                  const text = `Olá, ${clientItem.name}! Tudo bem? Faz um tempinho que você não nos visita (sua última visita foi em ${new Date(clientItem.lastDateStr + 'T12:00:00').toLocaleDateString('pt-BR')}). Que tal reservar um novo horário? Você pode agendar direto pelo nosso link: ${bioUrl}`;
                  const phone = clientItem.phone.replace(/\D/g, '');
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                };

                return (
                  <div key={idx} className="p-4 bg-black/20 border border-white/5 rounded-2xl flex flex-col justify-between gap-4 group hover:border-white/10 transition-all">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-white block truncate">{clientItem.name}</span>
                      <span className="text-[10px] text-rose-400 font-bold block bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded w-max">
                        Inativo há {clientItem.daysInactive} dias
                      </span>
                      <span className="text-[10px] text-gray-500 block">
                        Última visita: {new Date(clientItem.lastDateStr + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <button
                      onClick={handleSendLTVMessage}
                      className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <Phone size={12} />
                      <span>Chamar no WhatsApp</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Central de Insights do Empreendedor */}
      {recentPost && (
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl space-y-6">
          <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                <BookOpen size={16} className="text-primary-400" />
                💡 Central de Insights & Dicas
              </h4>
              <p className="text-xs text-gray-400">Aprenda estratégias valiosas criadas para impulsionar suas conversões e elevar o nível comercial do seu negócio.</p>
            </div>
            <button 
              onClick={() => {
                localStorage.setItem('redirect_growth_subtab', 'insights');
                setActiveTab('growth');
              }}
              className="text-xs text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1 group whitespace-nowrap transition-colors cursor-pointer"
            >
              Ver Todos os Artigos
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="p-6">
            {/* Card do Artigo em Destaque na Home */}
            <div 
              onClick={() => {
                localStorage.setItem('redirect_growth_subtab', 'insights');
                localStorage.setItem('selected_insight_post_id', recentPost.id);
                setActiveTab('growth');
              }}
              className="relative bg-black/20 border border-white/5 hover:border-white/10 rounded-[2rem] overflow-hidden group cursor-pointer flex flex-col md:flex-row hover:bg-white/[0.04] transition-all shadow-xl gap-6"
            >
              {/* Imagem de Capa do Artigo */}
              <div className="w-full md:w-[35%] aspect-video md:aspect-auto min-h-[160px] relative overflow-hidden bg-black/30">
                <img 
                  src={recentPost.imageUrl || "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=400&auto=format&fit=crop"} 
                  alt={recentPost.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/90 via-black/30 to-transparent" />
              </div>

              {/* Conteúdo do Artigo */}
              <div className="flex-1 p-6 flex flex-col justify-between text-left">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[8px] font-black uppercase text-amber-400 tracking-wider">
                      {recentPost.category || 'Geral'}
                    </span>
                    <span className="text-[9px] text-gray-500 flex items-center gap-1">
                      <Clock size={10} /> {recentPost.readTime || '5 min'} de leitura
                    </span>
                  </div>
                  <h5 className="font-extrabold text-white text-sm md:text-base group-hover:text-primary-400 transition-colors leading-snug">
                    {recentPost.title}
                  </h5>
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                    {recentPost.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-primary-400 text-xs font-bold uppercase tracking-wider group-hover:gap-2 transition-all mt-4">
                  Ler Artigo Completo
                  <ChevronRight size={14} className="mt-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
