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
  DollarSign,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { generateStaticPix } from '../lib/pix';

export default function PortalPublicBooking() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dados do Firestore
  const [orgData, setOrgData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [expediente, setExpediente] = useState<any>(null);

  // Estados de verificação de pacotes do cliente final
  const [activePackages, setActivePackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [usePackageCredit, setUsePackageCredit] = useState(false);
  const [checkingPackages, setCheckingPackages] = useState(false);

  // Estados do Formulário de Agendamento
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [slotsCache, setSlotsCache] = useState<Record<string, string[]>>({});
  
  // Controle de slots e agendamentos existentes
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  // Estado de Sucesso Final
  const [successBooking, setSuccessBooking] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Calendário Mensal
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthAppointments, setMonthAppointments] = useState<any[]>([]);
  const [detectedClientId, setDetectedClientId] = useState<string | null>(null);

  // Estados do Pix
  const [pixConfig, setPixConfig] = useState<any>(null);
  const [pixCode, setPixCode] = useState<string>('');
  const [showVoluntaryPix, setShowVoluntaryPix] = useState(false);

  // 1. Carrega dados básicos (Organização, Serviços e Expediente)
  useEffect(() => {
    if (!orgId) {
      setError('Organização não informada.');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
        const res = await fetch(`${crmApiUrl}/api/portal_handler?action=public_get_bio&orgId=${orgId}`);
        
        if (!res.ok) {
          throw new Error('Erro ao buscar dados de agendamento na API.');
        }

        const data = await res.json();
        
        if (data.org) {
          setOrgData(data.org);
        }
        
        if (data.services) {
          const activeServices = data.services.filter((s: any) => s.isActive !== false);
          setServices(activeServices);
        }
        
        if (data.clientId) {
          setDetectedClientId(data.clientId);
        }
        
        const schedulingData = data.schedulingSettings;
        if (schedulingData) {
          setExpediente(schedulingData);
          if (schedulingData.pixKey && schedulingData.pixEnabled) {
            setPixConfig(schedulingData);
          }
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
        console.error('Erro ao carregar dados do agendamento:', err);
        setError(err.message || 'Erro ao carregar dados de agendamento.');
      } finally {
        setLoading(false);
      }
    };

    // Recupera dados salvos para agendamento em 1-clique
    const savedName = localStorage.getItem('hubcrm_client_name');
    const savedPhone = localStorage.getItem('hubcrm_client_phone');
    if (savedName) setClientName(savedName);
    if (savedPhone) setClientPhone(savedPhone);

    loadData();
  }, [orgId]);

  // Gera o código Pix Copia e Cola se o sinal Pix for obrigatório OU se for pagamento voluntário
  useEffect(() => {
    if (!pixConfig || !successBooking || successBooking.paymentMethod === 'pacote') return;
    
    const isSignal = successBooking.pixSignalRequired && successBooking.pixSignalAmount > 0;
    const isVoluntary = showVoluntaryPix && successBooking.price > 0;
    
    if (!isSignal && !isVoluntary) {
      setPixCode('');
      return;
    }
    
    const amount = isSignal ? successBooking.pixSignalAmount : successBooking.price;
    
    try {
      const code = generateStaticPix({
        key: pixConfig.pixKey,
        name: pixConfig.pixName || 'Empresa',
        city: pixConfig.pixCity || 'Sao Paulo',
        amount: amount,
        txid: successBooking.id ? successBooking.id.substring(0, 25) : '***'
      });
      setPixCode(code);
    } catch (e) {
      console.error('Erro ao gerar código Pix:', e);
      setPixCode('');
    }
  }, [pixConfig, successBooking, showVoluntaryPix]);

  // Carrega todos os agendamentos do mês atual para calcular a disponibilidade de cada dia de forma eficiente
  useEffect(() => {
    if (!orgId) return;
    
    const fetchMonthAppointments = async () => {
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth(); // 0-indexed
        
        // Formata limites: YYYY-MM-DD
        const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        
        const apptsRef = collection(db, 'organizations', orgId, 'appointments');
        const q = query(
          apptsRef,
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth),
          where('status', '!=', 'cancelled')
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMonthAppointments(list);
      } catch (e) {
        console.error('Erro ao buscar agendamentos do mês:', e);
      }
    };

    fetchMonthAppointments();
  }, [currentMonth, orgId]);

  // 2. Sempre que a data escolhida mudar, busca os agendamentos desse dia para descobrir horários ocupados
  useEffect(() => {
    if (!selectedDate || !orgId) {
      setBookedTimes([]);
      return;
    }

    const fetchBookedTimes = async () => {
      if (slotsCache[selectedDate]) {
        setBookedTimes(slotsCache[selectedDate]);
        return;
      }

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
        
        setSlotsCache(prev => ({
          ...prev,
          [selectedDate]: times
        }));
        
        setBookedTimes(times);
      } catch (e) {
        console.error('Erro ao buscar slots ocupados:', e);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchBookedTimes();
  }, [selectedDate, orgId, slotsCache]);

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

  // Busca pacotes ativos do cliente para o serviço selecionado ao digitar o telefone
  useEffect(() => {
    if (!clientPhone || !selectedService || !orgId || !expediente?.packagesActive) {
      setActivePackages([]);
      setSelectedPackageId(null);
      setUsePackageCredit(false);
      return;
    }

    const cleanedPhone = clientPhone.replace(/\D/g, '');
    if (cleanedPhone.length < 10) {
      setActivePackages([]);
      setSelectedPackageId(null);
      setUsePackageCredit(false);
      return;
    }

    const checkClientPackages = async () => {
      setCheckingPackages(true);
      try {
        const packagesRef = collection(db, 'organizations', orgId, 'client_packages');
        const q = query(
          packagesRef,
          where('clientPhone', '==', cleanedPhone),
          where('serviceId', '==', selectedService.id),
          where('status', '==', 'active')
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((p: any) => p.usedSessions < p.totalSessions);
        
        setActivePackages(list);
        if (list.length > 0) {
          setSelectedPackageId(list[0].id);
          setUsePackageCredit(true); // Seleciona por padrão
        } else {
          setSelectedPackageId(null);
          setUsePackageCredit(false);
        }
      } catch (e) {
        console.error('Erro ao verificar pacotes do cliente:', e);
      } finally {
        setCheckingPackages(false);
      }
    };

    // Debounce leve para evitar requisições a cada dígito
    const delayDebounce = setTimeout(() => {
      checkClientPackages();
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [clientPhone, selectedService, orgId, expediente?.packagesActive]);

  // Dias da semana e funções auxiliares para o calendário
  const weekDaysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const generateMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const daysArray: { dateStr: string; dayNum: number; isPadding: boolean }[] = [];
    
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push({ dateStr: '', dayNum: 0, isPadding: true });
    }
    
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      daysArray.push({ dateStr, dayNum: day, isPadding: false });
    }
    
    return daysArray;
  };

  const getDayAvailability = (dateStr: string) => {
    if (!dateStr || !expediente || !expediente.businessHours) return 'unavailable';
    
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (dateStr < todayStr) return 'unavailable';
    
    const dateObj = new Date(dateStr + 'T12:00:00');
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = weekdays[dateObj.getDay()];
    const dayConfig = expediente.businessHours[dayKey];
    
    if (!dayConfig || !dayConfig.active) return 'unavailable';
    
    const { open, close } = dayConfig;
    const interval = expediente.slotIntervalMinutes || 30;
    
    const [startHour, startMin] = open.split(':').map(Number);
    const [endHour, endMin] = close.split(':').map(Number);
    
    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);
    const endLimit = new Date();
    endLimit.setHours(endHour, endMin, 0, 0);
    
    let totalSlotsCount = 0;
    const slotsList: string[] = [];
    while (current < endLimit) {
      const timeStr = current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      let isPast = false;
      if (dateStr === todayStr) {
        const now = new Date();
        const slotTimeObj = new Date();
        const [h, m] = timeStr.split(':').map(Number);
        slotTimeObj.setHours(h, m, 0, 0);
        if (slotTimeObj <= now) {
          isPast = true;
        }
      }
      
      if (!isPast) {
        totalSlotsCount++;
        slotsList.push(timeStr);
      }
      current.setMinutes(current.getMinutes() + interval);
    }
    
    if (totalSlotsCount === 0) return 'unavailable';
    
    const bookedForDay = monthAppointments
      .filter((app: any) => app.date === dateStr)
      .map((app: any) => app.time);
      
    const freeSlots = slotsList.filter(t => !bookedForDay.includes(t)).length;
    
    if (freeSlots === 0) return 'unavailable';
    if (freeSlots <= 3) return 'low';
    return 'high';
  };

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
    if (expediente?.cancelTermsEnabled && !acceptedTerms) {
      toast.error('Você precisa aceitar os termos de cancelamento para prosseguir.');
      return;
    }
    if (!orgId) return;

    setIsSubmitting(true);
    try {
      // Salva no localStorage para agendamento em 1-clique futuro
      localStorage.setItem('hubcrm_client_name', clientName.trim());
      localStorage.setItem('hubcrm_client_phone', clientPhone.trim());

      const serviceRequiresSignal = selectedService?.pixRequired && selectedService?.pixAmount > 0;
      const globalRequiresSignal = expediente?.pixRequiredForBooking && expediente?.pixBookingAmount > 0;
      const requiresSignal = (serviceRequiresSignal || globalRequiresSignal) && !usePackageCredit;
      const signalAmount = serviceRequiresSignal 
        ? selectedService.pixAmount 
        : (globalRequiresSignal ? expediente.pixBookingAmount : 0);

      const payload: any = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: usePackageCredit ? 0 : selectedService.price,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        origin: 'public_link',
        createdAt: serverTimestamp(),
        clientId: detectedClientId || '',
        paymentStatus: requiresSignal ? 'signal_pending' : 'pending',
        pixSignalRequired: requiresSignal || false,
        pixSignalAmount: requiresSignal ? signalAmount : 0
      };

      if (usePackageCredit && selectedPackageId) {
        payload.paymentMethod = 'pacote';
        payload.packageId = selectedPackageId;
      }

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
    const message = `Olá! Acabei de solicitar o agendamento de *${successBooking.serviceName}* para o dia *${dateFormatted}* às *${successBooking.time}* pelo link da bio. Nome: *${successBooking.clientName}*. Gostaria de confirmar ou tirar uma dúvida.`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  };

  const handleOpenWhatsAppPix = () => {
    if (!successBooking || !orgId) return;

    let rawPhone = orgData?.phone || orgData?.whatsapp || '';
    let formattedPhone = rawPhone.replace(/\D/g, '');
    if (formattedPhone.length === 11 && !formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    } else if (formattedPhone.length === 10 && !formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const dateObj = new Date(successBooking.date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const isSignal = successBooking.pixSignalRequired && successBooking.pixSignalAmount > 0;
    const amount = isSignal ? successBooking.pixSignalAmount : successBooking.price;
    const typeLabel = isSignal ? 'sinal de garantia' : 'pagamento integral';
    
    const message = `Olá! Fiz a solicitação de agendamento de *${successBooking.serviceName}* para o dia *${dateFormatted}* às *${successBooking.time}*.\n\nRealizei o pagamento do Pix no valor de *R$ ${amount.toFixed(2).replace('.', ',')}* correspondente ao *${typeLabel}*. Segue o comprovante de pagamento.`;
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
                {successBooking.paymentMethod === 'pacote' 
                  ? 'Pago via Pacote (Saldo)' 
                  : `R$ ${successBooking.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </span>
            </div>
            {successBooking.pixSignalRequired && (
              <div className="flex justify-between items-center text-xs pt-2 border-t border-dashed border-white/10">
                <span className="text-orange-400 font-bold uppercase tracking-wider">Sinal para Reserva</span>
                <span className="text-orange-400 font-black">
                  R$ {successBooking.pixSignalAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            
            {/* Botão de Como Chegar */}
            {(orgData?.address || orgData?.endereco || orgData?.city) && (
              <div className="pt-2 border-t border-white/5 flex justify-center">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orgData.address || orgData.endereco || orgData.city)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                >
                  <MapPin size={11} className="text-primary-400" />
                  <span>Como Chegar ({orgData.address || orgData.endereco || orgData.city})</span>
                </a>
              </div>
            )}
          </div>

          {successBooking.pixSignalRequired && pixCode ? (
            <div className="bg-black/30 border border-white/5 rounded-3xl p-5 space-y-4 text-left animate-in fade-in duration-300">
              <div className="text-center space-y-1">
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-center gap-1.5 font-sans">
                  <DollarSign className="text-primary-400" size={14} />
                  Garanta sua Vaga com o Sinal Pix
                </h3>
                <p className="text-[10px] text-gray-500 text-center font-sans">
                  Realize o pagamento do sinal de R$ {successBooking.pixSignalAmount?.toFixed(2).replace('.', ',')} para validar o agendamento.
                </p>
              </div>
              
              {/* QR Code */}
              <div className="bg-white p-2.5 rounded-2xl w-40 h-40 mx-auto flex items-center justify-center border border-white/10">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`} 
                  alt="Pix QR Code" 
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Pix Copia e Cola</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={pixCode}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-white text-[10px] font-mono rounded-xl outline-none select-all truncate"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pixCode);
                      toast.success('Código Pix copiado!');
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-0 shrink-0"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Botão de Confirmação WhatsApp */}
              <button
                type="button"
                onClick={handleOpenWhatsAppPix}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 cursor-pointer border-0 mt-2 hover:scale-[1.02] justify-center"
              >
                <MessageSquare size={16} />
                <span>Confirmar Pagamento (Enviar Comprovante)</span>
              </button>
            </div>
          ) : showVoluntaryPix && pixCode ? (
            <div className="bg-black/30 border border-white/5 rounded-3xl p-5 space-y-4 text-left animate-in fade-in duration-300">
              <div className="text-center space-y-1">
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-center gap-1.5 font-sans">
                  <DollarSign className="text-primary-400" size={14} />
                  Pagar Valor Total com Pix
                </h3>
                <p className="text-[10px] text-gray-500 text-center font-sans">
                  Realize o pagamento voluntário do valor total de R$ {successBooking.price?.toFixed(2).replace('.', ',')}.
                </p>
              </div>
              
              {/* QR Code */}
              <div className="bg-white p-2.5 rounded-2xl w-40 h-40 mx-auto flex items-center justify-center border border-white/10">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`} 
                  alt="Pix QR Code" 
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Pix Copia e Cola</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={pixCode}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-white text-[10px] font-mono rounded-xl outline-none select-all truncate"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pixCode);
                      toast.success('Código Pix copiado!');
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-0 shrink-0"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Botão de Confirmação WhatsApp */}
              <button
                type="button"
                onClick={handleOpenWhatsAppPix}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 cursor-pointer border-0 mt-2 hover:scale-[1.02] justify-center"
              >
                <MessageSquare size={16} />
                <span>Confirmar Pagamento (Enviar Comprovante)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVoluntaryPix(false)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer border-0 mt-1"
              >
                Voltar para Opção de Pagar no Local
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-5 text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Agendamento Solicitado!</h3>
                  <p className="text-[10px] text-gray-400 leading-relaxed font-sans max-w-xs mx-auto">
                    Sua vaga está pré-reservada para o dia <span className="text-white font-bold">{successBooking.date ? new Date(successBooking.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span> às <span className="text-white font-bold">{successBooking.time}</span>.
                  </p>
                  {successBooking.price > 0 && (
                    <p className="text-[10px] text-emerald-500/80 font-bold font-sans mt-2">
                      O pagamento de R$ {successBooking.price?.toFixed(2).replace('.', ',')} será realizado diretamente no local.
                    </p>
                  )}
                </div>
              </div>

              {/* Botões de Suporte e Pagamento Opcional */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 cursor-pointer border-0 hover:scale-[1.02]"
                >
                  <MessageSquare size={16} />
                  <span>Dúvidas / Falar no WhatsApp</span>
                </button>

                {successBooking.price > 0 && pixConfig && (
                  <button
                    type="button"
                    onClick={() => setShowVoluntaryPix(true)}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
                  >
                    <DollarSign size={14} className="text-primary-400" />
                    <span>Prefiro pagar com Pix agora</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => navigate(`/bio/${orgId}`)}
            className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer block mx-auto mt-4"
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
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Passo 1: Selecione o Serviço</label>
            {services.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">Nenhum serviço disponível no momento.</p>
            ) : (
              <CustomSelect
                value={selectedService?.id || ''}
                onChange={(val) => {
                  const srv = services.find(s => s.id === val);
                  setSelectedService(srv || null);
                  setSelectedTime(''); // reseta horário caso mude o serviço
                }}
                options={services.map(srv => ({
                  value: srv.id,
                  label: `${srv.name} - R$ ${srv.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${srv.durationMinutes} min)`
                }))}
                placeholder="Escolha o serviço desejado"
              />
            )}
          </div>

          {/* Passo 2: Escolha de Data */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Passo 2: Escolha a Data no Calendário</span>
            
            <div className="p-4 bg-black/20 border border-white/5 rounded-2xl space-y-4">
              {/* Header do Calendário: Mês, Ano e Setas */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
                    setCurrentMonth(prev);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer border-0"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                    setCurrentMonth(next);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer border-0"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              
              {/* Grid dos Dias */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {/* Dias da Semana */}
                {weekDaysShort.map(day => (
                  <span key={day} className="text-[9px] font-black text-gray-500 uppercase tracking-wider py-1">{day}</span>
                ))}
                
                {/* Dias do Mês */}
                {generateMonthDays().map((day, idx) => {
                  if (day.isPadding) {
                    return <div key={`padding-${idx}`} className="p-2" />;
                  }
                  
                  const status = getDayAvailability(day.dateStr);
                  const isSelected = selectedDate === day.dateStr;
                  
                  let btnClass = '';
                  let disabled = false;
                  
                  if (status === 'unavailable') {
                    btnClass = 'text-gray-600 bg-white/[0.01] cursor-not-allowed opacity-30';
                    disabled = true;
                  } else if (isSelected) {
                    btnClass = 'bg-primary-500 text-white font-black shadow-lg shadow-primary-500/20 scale-105';
                  } else if (status === 'low') {
                    btnClass = 'border border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/15';
                  } else {
                    btnClass = 'border border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15';
                  }
                  
                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDate(day.dateStr);
                        setSelectedTime(''); // reseta horário
                      }}
                      className={`p-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer border-0 ${btnClass}`}
                    >
                      {day.dayNum}
                      {!isSelected && status !== 'unavailable' && (
                        <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${status === 'low' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Legenda */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/5 pt-3 text-[10px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Vagas livres</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Quase cheio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-600 opacity-30" />
                  <span>Sem vagas / Fechado</span>
                </div>
              </div>
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

                {/* Termos de Cancelamento Customizados */}
                {expediente?.cancelTermsEnabled && expediente?.cancelTermsText && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 animate-in fade-in duration-300 mt-2">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">Política de Cancelamento</span>
                    <p className="text-[10px] text-gray-400 whitespace-pre-wrap leading-relaxed">
                      {expediente.cancelTermsText}
                    </p>
                    <div className="flex items-center gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5 mt-2">
                      <input 
                        type="checkbox"
                        id="acceptCancelTerms"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="w-4.5 h-4.5 rounded bg-black/40 border-white/10 text-primary-500 focus:ring-primary-500 focus:ring-offset-black cursor-pointer"
                        required
                      />
                      <label htmlFor="acceptCancelTerms" className="text-[10px] text-gray-300 font-bold cursor-pointer select-none">
                        Estou ciente e aceito os Termos de Cancelamento
                      </label>
                    </div>
                  </div>
                )}

                {checkingPackages && (
                  <p className="text-[10px] text-gray-500 animate-pulse pt-1">Verificando créditos de pacotes...</p>
                )}

                {!checkingPackages && activePackages.length > 0 && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 animate-in fade-in duration-300 mt-2">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white">Crédito Disponível!</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          Você possui pacotes de crédito ativos para este serviço.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5 justify-between">
                      <div className="text-left">
                        <span className="text-[9px] text-gray-400 block font-medium">Usar saldo do pacote?</span>
                        <span className="text-xs font-bold text-white">
                          Saldo restante: {activePackages[0].totalSessions - activePackages[0].usedSessions} sessões
                        </span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={usePackageCredit}
                        onChange={(e) => setUsePackageCredit(e.target.checked)}
                        className="w-4.5 h-4.5 rounded bg-black/40 border-white/10 text-primary-500 focus:ring-primary-500 focus:ring-offset-black cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botão de Enviar */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedTime || !clientName.trim() || !clientPhone.trim() || (expediente?.cancelTermsEnabled && !acceptedTerms)}
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
