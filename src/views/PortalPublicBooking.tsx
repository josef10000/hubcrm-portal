import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, addDoc, query, where, serverTimestamp 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  ArrowLeft, 
  AlertTriangle, 
  ShoppingBag, 
  Sparkles, 
  DollarSign 
} from 'lucide-react';
import { toast } from 'sonner';

export default function PortalPublicBooking() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dados do Firestore
  const [orgData, setOrgData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [expediente, setExpediente] = useState<any>(null);

  // Estados do Formulário de Agendamento
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  
  // Controle de slots e agendamentos existentes
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  // Estado de Sucesso Final
  const [successBooking, setSuccessBooking] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Carrega dados básicos (Organização, Serviços e Expediente)
  useEffect(() => {
    if (!orgId) {
      setError('Organização não informada.');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // Org
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (!orgSnap.exists()) {
          throw new Error('Empresa não encontrada.');
        }
        setOrgData(orgSnap.data());

        // Serviços ativos
        const servicesRef = collection(db, 'organizations', orgId, 'client_services');
        const servicesSnap = await getDocs(servicesRef);
        const activeServices = servicesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((s: any) => s.isActive !== false);
        setServices(activeServices);

        // Configuração de Expediente
        const schedulingRef = doc(db, 'organizations', orgId, 'settings', 'scheduling');
        const schedulingSnap = await getDoc(schedulingRef);
        if (schedulingSnap.exists()) {
          setExpediente(schedulingSnap.data());
        } else {
          // Padrão do sistema
          setExpediente({
            businessHours: {
              monday: { open: "08:00", close: "18:00", active: true },
              tuesday: { open: "08:00", close: "18:00", active: true },
              wednesday: { open: "08:00", close: "18:00", active: true },
              thursday: { open: "08:00", close: "18:00", active: true },
              friday: { open: "08:00", close: "18:00", active: true },
              saturday: { open: "09:00", close: "13:00", active: false },
              sunday: { open: "00:00", close: "00:00", active: false }
            },
            slotIntervalMinutes: 30
          });
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Erro ao carregar dados de agendamento.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orgId]);

  // 2. Sempre que a data escolhida mudar, busca os agendamentos desse dia para descobrir horários ocupados
  useEffect(() => {
    if (!selectedDate || !orgId) {
      setBookedTimes([]);
      return;
    }

    const fetchBookedTimes = async () => {
      setLoadingSlots(true);
      try {
        const apptsRef = collection(db, 'organizations', orgId, 'appointments');
        const q = query(
          apptsRef, 
          where('date', '==', selectedDate),
          where('status', '!=', 'cancelled')
        );
        const snap = await getDocs(q);
        const times = snap.docs.map(d => d.data().time);
        setBookedTimes(times);
      } catch (e) {
        console.error('Erro ao buscar slots ocupados:', e);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchBookedTimes();
  }, [selectedDate, orgId]);

  // 3. Calcula e gera slots disponíveis com base no expediente e agendamentos existentes
  useEffect(() => {
    if (!selectedDate || !expediente || !expediente.businessHours) {
      setAvailableSlots([]);
      return;
    }

    // Identifica o dia da semana
    const dateObj = new Date(selectedDate + 'T12:00:00');
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = weekdays[dateObj.getDay()];
    const dayConfig = expediente.businessHours[dayKey];

    if (!dayConfig || !dayConfig.active) {
      setAvailableSlots([]);
      return;
    }

    const { open, close } = dayConfig;
    const interval = expediente.slotIntervalMinutes || 30;

    const slots: string[] = [];
    const [startHour, startMin] = open.split(':').map(Number);
    const [endHour, endMin] = close.split(':').map(Number);

    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);

    const endLimit = new Date();
    endLimit.setHours(endHour, endMin, 0, 0);

    while (current < endLimit) {
      const timeStr = current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      // Filtra horários do dia de hoje para não permitir marcar no passado
      const todayStr = new Date().toISOString().split('T')[0];
      let isPast = false;
      if (selectedDate === todayStr) {
        const now = new Date();
        const slotTimeObj = new Date();
        const [h, m] = timeStr.split(':').map(Number);
        slotTimeObj.setHours(h, m, 0, 0);
        if (slotTimeObj <= now) {
          isPast = true;
        }
      }

      // Se não for horário passado e não estiver ocupado (bookedTimes)
      if (!isPast && !bookedTimes.includes(timeStr)) {
        slots.push(timeStr);
      }

      current.setMinutes(current.getMinutes() + interval);
    }

    setAvailableSlots(slots);
  }, [selectedDate, expediente, bookedTimes]);

  // Enviar pedido de agendamento
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService) {
      toast.error('Selecione um serviço.');
      return;
    }
    if (!selectedDate) {
      toast.error('Escolha uma data.');
      return;
    }
    if (!selectedTime) {
      toast.error('Escolha um horário.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Preencha seu nome e celular.');
      return;
    }
    if (!orgId) return;

    setIsSubmitting(true);
    try {
      const payload = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        origin: 'public_link',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'organizations', orgId, 'appointments'), payload);
      
      setSuccessBooking({
        id: docRef.id,
        ...payload
      });
      toast.success('Solicitação de agendamento criada!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar solicitação de agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!successBooking || !orgId) return;

    // Formata o telefone da organização
    let rawPhone = orgData?.phone || orgData?.whatsapp || '';
    let formattedPhone = rawPhone.replace(/\D/g, '');
    if (formattedPhone.length === 11 && !formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    } else if (formattedPhone.length === 10 && !formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    // Data formatada para leitura humana
    const dateObj = new Date(successBooking.date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Mensagem a enviar
    const message = `Olá! Acabei de solicitar o agendamento de *${successBooking.serviceName}* para o dia *${dateFormatted}* às *${successBooking.time}* pelo link da bio. Nome: *${successBooking.clientName}*. Pode confirmar para mim?`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4 animate-spin" />
        <p className="text-gray-400 font-medium animate-pulse">Carregando Agenda Online...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 text-center">
        <div className="p-8 bg-white/[0.02] border border-red-500/20 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
          <h2 className="text-lg font-bold text-white">Ops! Algo deu errado.</h2>
          <p className="text-gray-400 text-xs leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // 4. Renderização do Sucesso do Agendamento (Fluxo de Redirecionamento de WhatsApp)
  if (successBooking) {
    const dateObj = new Date(successBooking.date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Círculos decorativos de background */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 md:p-8 space-y-6 text-center shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 size={36} className="animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-white">Reserva Solicitada!</h1>
            <p className="text-xs text-gray-400">Seu horário foi reservado em nosso sistema no status pendente.</p>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-2xl p-4 text-left space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Serviço</span>
              <span className="text-white font-bold">{successBooking.serviceName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Data</span>
              <span className="text-white font-bold capitalize">{dateFormatted}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Horário</span>
              <span className="text-white font-bold">{successBooking.time}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2.5 border-t border-white/5">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Investimento</span>
              <span className="text-emerald-400 font-black">
                R$ {successBooking.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-2xl text-xs text-primary-400 leading-relaxed text-left flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              <strong>Atenção:</strong> Seu agendamento precisa ser validado. Clique no botão abaixo para nos enviar uma mensagem rápida no WhatsApp e finalizar a confirmação.
            </span>
          </div>

          <button
            onClick={handleOpenWhatsApp}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <Phone size={18} />
            <span>Confirmar via WhatsApp</span>
          </button>

          <button
            onClick={() => navigate(`/bio/${orgId}`)}
            className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer"
          >
            Voltar para o Mini-Site
          </button>
        </div>
      </div>
    );
  }

  // 5. Renderização do Formulário de Reserva
  return (
    <div className="min-h-screen bg-[#050505] text-white py-12 px-4 relative overflow-hidden flex flex-col items-center">
      {/* Círculos decorativos de background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10">
        
        {/* Topbar/Voltar */}
        <button
          onClick={() => navigate(`/bio/${orgId}`)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Voltar ao Mini-Site</span>
        </button>

        {/* Header */}
        <div className="space-y-1.5 text-center sm:text-left">
          <h1 className="text-xl md:text-3xl font-black text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
            <Sparkles className="text-primary-400 w-6 h-6 lg:w-7 lg:h-7" />
            Agendamento Online
          </h1>
          <p className="text-xs text-gray-400">Escolha o serviço, data e horário para realizar sua pré-reserva.</p>
        </div>

        <form onSubmit={handleSubmitBooking} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 space-y-6 shadow-2xl">
          
          {/* Passo 1: Escolha do Serviço */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Passo 1: Selecione o Serviço</span>
            <div className="grid grid-cols-1 gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {services.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-2">Nenhum serviço disponível no momento.</p>
              ) : (
                services.map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      setSelectedService(srv);
                      setSelectedTime(''); // reseta horário caso mude o serviço
                    }}
                    className={`p-4 border rounded-2xl flex items-center justify-between text-left gap-3 transition-all cursor-pointer ${
                      selectedService?.id === srv.id 
                        ? 'bg-primary-500/10 border-primary-500' 
                        : 'bg-black/20 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${selectedService?.id === srv.id ? 'bg-primary-500/20 text-primary-400' : 'bg-white/5 text-gray-400'}`}>
                        <ShoppingBag size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{srv.name}</span>
                        <span className="text-[10px] text-gray-500">{srv.durationMinutes} minutos de duração</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-400">
                        R$ {srv.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Passo 2: Escolha de Data */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Passo 2: Escolha a Data</label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime(''); // Reseta o horário
                }}
                className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Passo 3: Escolha do Horário */}
          {selectedDate && (
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Passo 3: Escolha o Horário Comercial
              </span>
              
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                  <Clock className="animate-spin w-4 h-4 text-primary-500" />
                  <span>Buscando horários disponíveis...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-2">Não há horários disponíveis para a data selecionada.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {availableSlots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`py-2 px-3 border rounded-xl text-xs font-mono font-bold transition-all text-center cursor-pointer ${
                        selectedTime === time 
                          ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/20' 
                          : 'bg-black/20 border-white/5 hover:border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Passo 4: Dados do Cliente */}
          {selectedTime && (
            <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in duration-300">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Passo 4: Seus Dados</span>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: José da Silva"
                      className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">WhatsApp para Contato</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Ex: 11999999999"
                      className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botão de Enviar */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedTime || !clientName.trim() || !clientPhone.trim()}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-white/5 disabled:text-gray-500 disabled:border-transparent text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {isSubmitting ? (
              <>
                <Clock className="animate-spin w-4 h-4" />
                <span>Solicitando agendamento...</span>
              </>
            ) : (
              <span>Solicitar Agendamento</span>
            )}
          </button>

        </form>

        {/* Rodapé */}
        <div className="text-center flex flex-col items-center">
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Tecnologia por</span>
          <span className="text-xs font-black bg-gradient-to-r from-primary-400 to-indigo-400 bg-clip-text text-transparent mt-1 select-none">
            Portal Hub
          </span>
        </div>

      </div>
    </div>
  );
}
