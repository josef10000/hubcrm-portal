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
  ChevronRight
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

interface PortalHomeProps {
  client: any;
  announcement: any;
  setActiveTab: (tab: string) => void;
  supportRequests: any[];
}

export default function PortalHome({ client, announcement, setActiveTab, supportRequests }: PortalHomeProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const [appointmentsToday, setAppointmentsToday] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

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

  // Escuta os compromissos de hoje reativamente
  useEffect(() => {
    if (!orgId) return;
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    const appointmentsRef = collection(db, 'organizations', orgId, 'appointments');

    const unsub = onSnapshot(appointmentsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filtra os agendamentos para o dia de hoje que estão confirmados
      const filtered = list.filter((app: any) => 
        app.date === todayStr && 
        app.status === 'confirmed'
      );
      
      // Ordena por horário
      filtered.sort((a: any, b: any) => a.time.localeCompare(b.time));
      setAppointmentsToday(filtered);
      setLoadingApps(false);
    });

    return () => unsub();
  }, [orgId]);

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
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Agenda de Hoje</p>
              <p className="text-2xl font-black text-white">{loadingApps ? '...' : `${appointmentsToday.length} compromissos`}</p>
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
        {/* Project Progress Card */}
        <div className="lg:col-span-2 group bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] relative overflow-hidden transition-all duration-500 hover:border-white/20">
          <div className="flex flex-col md:flex-row items-center gap-6 lg:gap-10">
            {progress < 100 ? (
              <div className="flex-1 w-full text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Status do Projeto</span>
                </div>
                <h2 className="text-xl lg:text-3xl font-bold text-white mb-2 lg:mb-4 tracking-tight">Seu site está ganhando vida!</h2>
                
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Progresso Total</span>
                     <span className="text-xl font-black text-primary-500">{progress}%</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${progress}%` }}
                       transition={{ duration: 1.5, ease: "easeOut" }}
                       className="h-full bg-gradient-to-r from-primary-500 to-primary-600 shadow-[0_0_15px_rgba(242,125,38,0.3)]"
                     />
                  </div>
                </div>

                <p className="text-gray-400 text-xs lg:text-sm leading-relaxed mb-6">
                  Estamos na etapa de <strong className="text-white">"{client.stages?.find((s: any) => !s.completed)?.name || 'Desenvolvimento'}"</strong>. 
                </p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Plano Selecionado</span>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Globe size={16} className="text-blue-500" />
                      {client.plan}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Concluded State */
              <div className="flex-1 w-full text-center md:text-left py-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Projeto Finalizado</span>
                </div>
                <h2 className="text-2xl lg:text-4xl font-black text-white mb-4 tracking-tight">
                  Tudo pronto! Seu projeto foi <span className="text-primary-500">concluído.</span>
                </h2>
                <p className="text-gray-400 text-sm lg:text-base leading-relaxed mb-8 max-w-2xl">
                  Parabéns! Sua jornada de desenvolvimento terminou. Você já pode acessar seu novo ambiente digital através do link oficial abaixo.
                </p>
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                  <a 
                    href={client.siteLink ? (client.siteLink.startsWith('http') ? client.siteLink : `https://${client.siteLink}`) : '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 md:flex-none px-8 py-4 bg-white/5 border border-white/10 hover:border-primary-500/50 text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-primary-500 transition-all duration-300 shadow-xl group"
                  >
                    <Globe size={20} />
                    Acessar Meu Site
                    <ExternalLink size={18} className="group-hover:scale-110 transition-transform" />
                  </a>
                  
                  <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-center">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Plano Ativo</span>
                    <span className="text-sm font-bold text-white">{client.plan}</span>
                  </div>
                </div>
              </div>
            )}
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
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Novo Agendamento</span>
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

      {/* Seção Agenda de Hoje */}
      <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
            <Calendar size={16} className="text-primary-400" />
            Atendimentos Marcados para Hoje
          </h4>
          <button 
            onClick={() => setActiveTab('agenda')}
            className="text-xs text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1 group transition-colors"
          >
            Ver Agenda Completa
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        
        <div className="divide-y divide-white/5 p-2">
          {loadingApps ? (
            <div className="p-12 text-center text-gray-500 italic text-sm">Buscando compromissos de hoje...</div>
          ) : appointmentsToday.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar size={32} className="mx-auto text-gray-600 mb-4 opacity-50" />
              <p className="text-gray-500 text-sm">Nenhum atendimento agendado para o dia de hoje.</p>
              <button 
                onClick={() => setActiveTab('agenda')}
                className="mt-4 px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white rounded-xl transition-all"
              >
                Agendar Novo Compromisso
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {appointmentsToday.map((app) => {
                const badge = getAppStatusBadge(app.status);
                return (
                  <div 
                    key={app.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                        <Clock size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-sm">{app.serviceName}</h5>
                        <p className="text-[10px] text-gray-500 mt-0.5">Cliente: {app.clientName}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
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
  );
}
