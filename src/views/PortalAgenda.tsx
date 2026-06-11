import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, Clock, Plus, Trash2, Edit2, Check, X, Phone, DollarSign, Settings, Scissors, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

interface PortalAgendaProps {
  orgId: string;
  clientId: string;
}

export default function PortalAgenda({ orgId, clientId }: PortalAgendaProps) {
  const [subTab, setSubTab] = useState<'timeline' | 'services' | 'settings'>('timeline');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [expediente, setExpediente] = useState<any>({
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

  const [inventory, setInventory] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [selectedServiceMaterials, setSelectedServiceMaterials] = useState<any[]>([]);
  const [currentSelectedMaterialId, setCurrentSelectedMaterialId] = useState('');
  const [currentSelectedMaterialQty, setCurrentSelectedMaterialQty] = useState('');

  // Estados para Templates de WhatsApp
  const [whatsappTemplates, setWhatsappTemplates] = useState<any[]>([
    {
      id: 'local',
      title: 'Atendimento no Local',
      text: 'Olá, {nome}! Confirmando seu agendamento de {servico} para o dia {data} às {hora}. Valor: R$ {valor}. Para confirmar ou reagendar seu horário, clique no link: {link}. Te aguardamos!'
    },
    {
      id: 'domicilio',
      title: 'Atendimento a Domicílio',
      text: 'Olá, {nome}! Confirmando nossa visita para o serviço de {servico} no dia {data} às {hora}. Valor: R$ {valor}. Por favor, confirme seu agendamento clicando no link: {link}.'
    }
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('local');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [activeAppointmentForWhatsApp, setActiveAppointmentForWhatsApp] = useState<any>(null);
  
  // Estados para CRUD de templates em settings
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);

  // Estado para Confirmação Customizada
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'appointment' | 'service' | '';
    itemId: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: '',
    itemId: '',
    title: '',
    message: ''
  });

  const executeConfirmAction = async () => {
    const { type, itemId } = confirmModal;
    if (!itemId || !orgId) return;

    try {
      if (type === 'appointment') {
        await deleteDoc(doc(db, 'organizations', orgId, 'appointments', itemId));
        toast.success('Agendamento excluído com sucesso!');
      } else if (type === 'service') {
        await deleteDoc(doc(db, 'organizations', orgId, 'client_services', itemId));
        toast.success('Serviço excluído!');
      }
      setConfirmModal({ isOpen: false, type: '', itemId: '', title: '', message: '' });
    } catch (e) {
      console.error(e);
      toast.error(`Erro ao excluir ${type === 'appointment' ? 'agendamento' : 'serviço'}.`);
    }
  };

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);
  const [servicePrice, setServicePrice] = useState('');
  const [isSubmittingService, setIsSubmittingService] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newServiceId, setNewServiceId] = useState('');
  const [newDate, setNewDate] = useState(selectedDate);
  const [newTime, setNewTime] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);

  useEffect(() => {
    if (!editingAppointmentId) {
      setNewDate(selectedDate);
    }
  }, [selectedDate, isModalOpen, editingAppointmentId]);

  const handleServiceChange = (srvId: string) => {
    setNewServiceId(srvId);
    const selectedSrv = services.find(s => s.id === srvId);
    if (selectedSrv) {
      setNewPrice(selectedSrv.price.toString());
    } else {
      setNewPrice('');
    }
  };

  const closeAppointmentModal = () => {
    setIsModalOpen(false);
    setEditingAppointmentId(null);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientEmail('');
    setNewServiceId('');
    setNewTime('');
    setNewPrice('');
    setNewPaymentStatus('unpaid');
  };

  const handleEditAppointment = (app: any) => {
    setEditingAppointmentId(app.id);
    setNewClientName(app.clientName);
    setNewClientPhone(app.clientPhone);
    setNewClientEmail(app.clientEmail || '');
    setNewServiceId(app.serviceId);
    setNewDate(app.date);
    setNewTime(app.time);
    setNewPrice((app.price || 0).toString().replace('.', ','));
    setNewPaymentStatus(app.paymentStatus || 'unpaid');
    setIsModalOpen(true);
  };

  const handleDeleteAppointment = (appId: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'appointment',
      itemId: appId,
      title: 'Excluir Agendamento',
      message: 'Tem certeza que deseja excluir permanentemente este agendamento? Essa ação não poderá ser desfeita.'
    });
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientPhone.trim() || !newTime || !newServiceId || !orgId) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    const selectedSrv = services.find(s => s.id === newServiceId);
    if (!selectedSrv) {
      toast.error('Selecione um serviço válido.');
      return;
    }

    setIsSubmittingAppointment(true);
    try {
      const payload = {
        clientName: newClientName.trim(),
        clientPhone: newClientPhone.trim(),
        clientEmail: newClientEmail.trim(),
        serviceId: newServiceId,
        serviceName: selectedSrv.name,
        date: newDate,
        time: newTime,
        price: Number(newPrice.replace(',', '.')),
        paymentStatus: newPaymentStatus,
        updatedAt: serverTimestamp()
      };

      if (editingAppointmentId) {
        await updateDoc(doc(db, 'organizations', orgId, 'appointments', editingAppointmentId), payload);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'appointments'), {
          ...payload,
          status: 'confirmed',
          createdAt: serverTimestamp()
        });
        toast.success('Agendamento realizado com sucesso!');
      }

      closeAppointmentModal();
    } catch (err) {
      console.error(err);
      toast.error(editingAppointmentId ? 'Erro ao atualizar o agendamento.' : 'Erro ao realizar o agendamento.');
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  // Escuta Agendamentos
  useEffect(() => {
    if (!orgId) return;
    const appointmentsRef = collection(db, 'organizations', orgId, 'appointments');
    const q = query(appointmentsRef, orderBy('time', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    });
    return () => unsub();
  }, [orgId]);

  // Escuta Serviços do Cliente
  useEffect(() => {
    if (!orgId) return;
    const servicesRef = collection(db, 'organizations', orgId, 'client_services');
    const q = query(servicesRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setServices(list);
    });
    return () => unsub();
  }, [orgId]);

  // Escuta Configuração de Expediente
  useEffect(() => {
    if (!orgId) return;
    const docRef = doc(db, 'organizations', orgId, 'settings', 'scheduling');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setExpediente(data);
        if (data.whatsappTemplates && Array.isArray(data.whatsappTemplates)) {
          setWhatsappTemplates(data.whatsappTemplates);
        }
      }
    });
    return () => unsub();
  }, [orgId]);

  // Escuta Inventário
  useEffect(() => {
    if (!orgId) return;
    const inventoryRef = collection(db, 'organizations', orgId, 'inventory');
    const unsub = onSnapshot(inventoryRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventory(list);
    });
    return () => unsub();
  }, [orgId]);

  // Calcula insuficiência de estoque para agendamentos futuros
  useEffect(() => {
    if (appointments.length === 0 || services.length === 0 || inventory.length === 0) {
      setStockAlerts([]);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const futureAppointments = appointments.filter(app => 
      app.date >= todayStr && app.status !== 'cancelled'
    );

    const plannedConsumptions: Record<string, number> = {};

    futureAppointments.forEach(app => {
      const srv = services.find(s => s.id === app.serviceId);
      if (srv && srv.materials && Array.isArray(srv.materials)) {
        srv.materials.forEach((m: any) => {
          plannedConsumptions[m.itemId] = (plannedConsumptions[m.itemId] || 0) + m.quantity;
        });
      }
    });

    const alerts: any[] = [];
    Object.keys(plannedConsumptions).forEach(itemId => {
      const invItem = inventory.find(i => i.id === itemId);
      if (invItem) {
        const needed = plannedConsumptions[itemId];
        if (needed > invItem.quantity) {
          alerts.push({
            itemId,
            name: invItem.name,
            unit: invItem.unit,
            stock: invItem.quantity,
            needed: needed,
            shortage: needed - invItem.quantity
          });
        }
      }
    });

    setStockAlerts(alerts);
  }, [appointments, services, inventory]);

  // Ações de CRUD de Serviços
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !servicePrice.trim() || !orgId) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setIsSubmittingService(true);
    try {
      const payload = {
        name: serviceName.trim(),
        durationMinutes: Number(serviceDuration),
        price: Number(servicePrice.replace(',', '.')),
        materials: selectedServiceMaterials,
        isActive: true,
        updatedAt: serverTimestamp()
      };

      if (editingServiceId) {
        await updateDoc(doc(db, 'organizations', orgId, 'client_services', editingServiceId), payload);
        toast.success('Serviço atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'client_services'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success('Serviço criado com sucesso!');
      }

      setServiceName('');
      setServicePrice('');
      setServiceDuration(30);
      setEditingServiceId(null);
      setSelectedServiceMaterials([]);
      setCurrentSelectedMaterialId('');
      setCurrentSelectedMaterialQty('');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar serviço.');
    } finally {
      setIsSubmittingService(false);
    }
  };

  const handleEditService = (srv: any) => {
    setEditingServiceId(srv.id);
    setServiceName(srv.name);
    setServiceDuration(srv.durationMinutes);
    setServicePrice(srv.price.toString());
    setSelectedServiceMaterials(srv.materials || []);
  };

  const handleDeleteService = (srvId: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'service',
      itemId: srvId,
      title: 'Excluir Serviço',
      message: 'Tem certeza que deseja excluir este serviço? Essa ação não poderá ser desfeita.'
    });
  };

  // Salvar Regras de Expediente
  const handleSaveExpediente = async () => {
    if (!orgId) return;
    try {
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'scheduling'), {
        ...expediente,
        whatsappTemplates: whatsappTemplates
      }, { merge: true });
      toast.success('Configurações de expediente e templates salvas!');
    } catch (e) {
      toast.error('Erro ao salvar configurações.');
    }
  };

  // Ações de Agendamento (Mudar Status)
  const handleUpdateAppointmentStatus = async (appId: string, status: 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const updatePayload: any = { status };
      if (status === 'completed') {
        updatePayload.paymentStatus = 'paid';
      }
      await updateDoc(doc(db, 'organizations', orgId, 'appointments', appId), updatePayload);
      toast.success(
        status === 'confirmed' ? 'Status atualizado para: Confirmado' :
        status === 'cancelled' ? 'Status atualizado para: Cancelado' :
        'Agendamento concluído e enviado ao Financeiro!'
      );
    } catch (e) {
      toast.error('Erro ao atualizar agendamento.');
    }
  };

  // Ação para abrir o modal de disparo de WhatsApp
  const handleOpenWhatsAppModal = (app: any) => {
    setActiveAppointmentForWhatsApp(app);
    setIsWhatsAppModalOpen(true);
  };

  // Função para processar o texto e substituir as tags dinâmicas
  const renderWhatsAppText = (templateText: string, app: any) => {
    if (!app) return '';
    const linkPublico = `https://portalhub.hubsymples.com.br/confirmar-presenca?id=${app.id}&orgId=${orgId}&clientId=${clientId}`;
    const dataFormatada = app.date ? new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    
    return templateText
      .replace(/{nome}/g, app.clientName || '')
      .replace(/{servico}/g, app.serviceName || '')
      .replace(/{data}/g, dataFormatada)
      .replace(/{hora}/g, app.time || '')
      .replace(/{valor}/g, app.price ? app.price.toFixed(2).replace('.', ',') : '0,00')
      .replace(/{link}/g, linkPublico);
  };

  // Função para de fato disparar a mensagem
  const handleSendWhatsAppMessage = async () => {
    if (!activeAppointmentForWhatsApp || !orgId) return;

    const template = whatsappTemplates.find(t => t.id === selectedTemplateId) || whatsappTemplates[0];
    const text = renderWhatsAppText(template.text, activeAppointmentForWhatsApp);
    const phone = activeAppointmentForWhatsApp.clientPhone.replace(/\D/g, '');

    // Atualiza o status do agendamento para 'pending' (Pendente de Confirmação) no Firestore
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'appointments', activeAppointmentForWhatsApp.id), {
        status: 'pending'
      });
    } catch (err) {
      console.error('Erro ao atualizar status do agendamento para pendente:', err);
    }

    setIsWhatsAppModalOpen(false);

    // Abre o WhatsApp Web
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const appointmentsToday = appointments.filter(app => app.date === selectedDate);

  return (
    <div className="space-y-6">
      {/* Alerta de Insumos Insuficientes */}
      {stockAlerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/35 p-5 rounded-2xl text-amber-200 flex flex-col gap-2 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Alerta de Insumos Insuficientes para Agendamentos Futuros
          </div>
          <p className="text-[11px] text-gray-400">
            Com base nos agendamentos futuros confirmados, os seguintes materiais no seu estoque ficarão negativos:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {stockAlerts.map(alert => (
              <div key={alert.itemId} className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-white block">{alert.name}</span>
                  <span className="text-gray-500">Disponível: {alert.stock}{alert.unit} &bull; Necessário: {alert.needed}{alert.unit}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full font-bold text-[10px] text-amber-400 font-mono">
                  Falta: {alert.shortage}{alert.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas Superiores */}
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-full overflow-x-auto scrollbar-none snap-x flex-nowrap md:w-fit">
        <button
          onClick={() => setSubTab('timeline')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors snap-align-start shrink-0 ${
            subTab === 'timeline' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock size={14} />
          Linha do Tempo
        </button>
        <button
          onClick={() => setSubTab('services')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors snap-align-start shrink-0 ${
            subTab === 'services' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Scissors size={14} />
          Gerenciar Serviços
        </button>
        <button
          onClick={() => setSubTab('settings')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors snap-align-start shrink-0 ${
            subTab === 'settings' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={14} />
          Expediente Comercial
        </button>
      </div>

      {/* ABA 1: LINHA DO TEMPO */}
      {subTab === 'timeline' && (
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="text-primary-400" size={20} />
                Agenda Diária
              </h2>
              <p className="text-xs text-gray-400">Gerencie os horários marcados pelos clientes do seu site e WhatsApp.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/40 border border-white/15 hover:border-white/30 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all font-bold w-full"
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-lg shadow-primary-500/20 active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>Agendar</span>
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] bg-white/15" />

          {appointmentsToday.length === 0 ? (
            <div className="py-20 text-center bg-black/20 rounded-2xl border border-white/5">
              <CalendarIcon size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Nenhum Agendamento Hoje</p>
              <p className="text-xs text-gray-500 mt-1">Sua agenda de {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} está livre.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-primary-500/20 ml-2 pl-4 sm:ml-4 sm:pl-8 space-y-8 py-2">
              {appointmentsToday.map((app) => (
                <div key={app.id} className="relative group">
                  <div className={`absolute -left-[25px] sm:-left-[39px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-[#050505] shadow-md transition-colors ${
                    app.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                    app.status === 'cancelled' ? 'bg-rose-500' : 
                    app.status === 'pending' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                    'bg-primary-500 animate-pulse'
                  }`} />

                  <div className="bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-black text-primary-400 font-mono flex items-center gap-1.5 bg-primary-500/10 px-2.5 py-1 rounded-lg">
                          <Clock size={12} />
                          {app.time}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          app.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {app.paymentStatus === 'paid' ? 'PAGO' : 'NÃO PAGO'}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          app.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          app.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                          app.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' :
                          'bg-sky-500/20 text-sky-400 border-sky-500/30'
                        }`}>
                          {app.status === 'completed' ? 'CONCLUÍDO' :
                           app.status === 'cancelled' ? 'CANCELADO' :
                           app.status === 'pending' ? 'PENDENTE CONFIRMAÇÃO' : 'CONFIRMADO'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{app.clientName}</h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Scissors size={12} className="text-gray-600" />
                        Serviço: <span className="text-white font-medium">{app.serviceName}</span> &bull; 
                        <DollarSign size={12} className="text-gray-600 ml-1" /> Valor: <span className="text-white font-medium">R$ {app.price?.toFixed(2).replace('.', ',')}</span>
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto md:justify-end">
                      {/* Botões de Ação Principais */}
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {app.clientPhone && (
                          <button
                            onClick={() => handleOpenWhatsAppModal(app)}
                            className="flex-1 sm:flex-initial justify-center p-2.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <Phone size={14} />
                            Enviar Confirmação
                          </button>
                        )}
                        
                        {app.status !== 'completed' && app.status !== 'cancelled' && (
                          <>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(app.id, 'completed')}
                              className="flex-1 sm:flex-initial justify-center p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check size={14} />
                              Finalizar
                            </button>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(app.id, 'cancelled')}
                              className="flex-1 sm:flex-initial justify-center p-2.5 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <X size={14} />
                              Cancelar
                            </button>
                          </>
                        )}
                        {app.status === 'completed' && (
                          <span className="flex-1 sm:flex-initial justify-center text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 rounded-xl">
                            <Check size={14} /> Concluído
                          </span>
                        )}
                        {app.status === 'cancelled' && (
                          <span className="flex-1 sm:flex-initial justify-center text-rose-400 text-xs font-bold flex items-center gap-1 bg-rose-500/5 border border-rose-500/20 px-3 py-2 rounded-xl">
                            <X size={14} /> Cancelado
                          </span>
                        )}
                      </div>

                      {/* Botões de Ação Utilitários */}
                      <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2 sm:pt-0 sm:border-0 w-full sm:w-auto shrink-0">
                        <button
                          onClick={() => handleEditAppointment(app)}
                          className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-90 flex-1 sm:flex-initial flex items-center justify-center"
                          title="Editar agendamento"
                        >
                          <Edit2 size={13} className="mr-1 sm:mr-0" />
                          <span className="sm:hidden text-xs">Editar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAppointment(app.id)}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer active:scale-90 flex-1 sm:flex-initial flex items-center justify-center"
                          title="Excluir agendamento"
                        >
                          <Trash2 size={13} className="mr-1 sm:mr-0" />
                          <span className="sm:hidden text-xs">Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: GERENCIAR SERVIÇOS */}
      {subTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl h-fit">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Scissors className="text-primary-400" size={18} />
              {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
            </h3>
            <form onSubmit={handleSaveService} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome do Serviço</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Ex: Corte Degradê, Consulta Médica..."
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duração (minutos)</label>
                  <select
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preço (R$)</label>
                  <input
                    type="text"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    placeholder="Ex: 85,00"
                    className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Insumos Utilizados (Opcional)</label>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select
                      value={currentSelectedMaterialId}
                      onChange={(e) => setCurrentSelectedMaterialId(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 hover:border-white/20 text-white rounded-lg text-xs outline-none transition-all focus:border-primary-500 font-bold"
                    >
                      <option value="" className="bg-[#050505] text-gray-500">Selecionar material...</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.id} className="bg-[#050505]">{item.name} ({item.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qtd"
                      value={currentSelectedMaterialQty}
                      onChange={(e) => setCurrentSelectedMaterialQty(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 hover:border-white/20 text-white rounded-lg text-xs outline-none transition-all placeholder-gray-700 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentSelectedMaterialId || !currentSelectedMaterialQty || Number(currentSelectedMaterialQty) <= 0) return;
                      const item = inventory.find(i => i.id === currentSelectedMaterialId);
                      if (item) {
                        const exists = selectedServiceMaterials.find(m => m.itemId === currentSelectedMaterialId);
                        if (exists) {
                          setSelectedServiceMaterials(selectedServiceMaterials.map(m =>
                            m.itemId === currentSelectedMaterialId
                              ? { ...m, quantity: Number(currentSelectedMaterialQty) }
                              : m
                          ));
                        } else {
                          setSelectedServiceMaterials([...selectedServiceMaterials, {
                            itemId: item.id,
                            name: item.name,
                            quantity: Number(currentSelectedMaterialQty),
                            unit: item.unit
                          }]);
                        }
                      }
                      setCurrentSelectedMaterialId('');
                      setCurrentSelectedMaterialQty('');
                    }}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Add
                  </button>
                </div>

                {selectedServiceMaterials.length > 0 && (
                  <div className="space-y-1.5 mt-2 max-h-28 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded-xl border border-white/5">
                    {selectedServiceMaterials.map(m => (
                      <div key={m.itemId} className="flex items-center justify-between text-[11px] bg-white/5 px-2.5 py-1.5 rounded-lg animate-in fade-in duration-150">
                        <span className="text-gray-300 truncate pr-2">{m.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-gray-400 font-bold">{m.quantity}{m.unit}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedServiceMaterials(selectedServiceMaterials.filter(x => x.itemId !== m.itemId))}
                            className="text-gray-500 hover:text-red-400 p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button
                  type="submit"
                  disabled={isSubmittingService}
                  className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-600/50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-primary-500/10 flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  Salvar
                </button>
                {editingServiceId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingServiceId(null);
                      setServiceName('');
                      setServicePrice('');
                      setServiceDuration(30);
                      setSelectedServiceMaterials([]);
                      setCurrentSelectedMaterialId('');
                      setCurrentSelectedMaterialQty('');
                    }}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Serviços Cadastrados</h3>
              <p className="text-xs text-gray-400">Estes itens estarão visíveis para os clientes escolherem no seu site e na IA do WhatsApp.</p>
            </div>

            {services.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
                <Scissors size={36} className="mx-auto mb-3 text-gray-600" />
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nenhum Serviço Encontrado</p>
                <p className="text-[11px] text-gray-600 mt-1">Adicione seu primeiro serviço ao lado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {services.map((srv) => (
                  <div key={srv.id} className="bg-black/20 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4 transition-all">
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-bold text-white truncate text-sm">{srv.name}</h4>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <span>{srv.durationMinutes} min</span> &bull; 
                        <span className="text-primary-400 font-bold">R$ {srv.price?.toFixed(2).replace('.', ',')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditService(srv)}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteService(srv.id)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 rounded-lg transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: EXPEDIENTE COMERCIAL */}
      {subTab === 'settings' && (
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="text-primary-400" size={20} />
              Expediente Comercial
            </h2>
            <p className="text-xs text-gray-400">Configure os horários em que seu estabelecimento está aberto e aceita novos agendamentos.</p>
          </div>

          <div className="w-full h-[1px] bg-white/15" />

          <div className="space-y-3 max-w-xl">
            {Object.keys(expediente.businessHours || {}).map((day) => {
              const dayConfig = expediente.businessHours[day];
              const translate: Record<string, string> = {
                monday: 'Segunda-feira',
                tuesday: 'Terça-feira',
                wednesday: 'Quarta-feira',
                thursday: 'Quinta-feira',
                friday: 'Sexta-feira',
                saturday: 'Sábado',
                sunday: 'Domingo'
              };

              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={dayConfig.active}
                      onChange={(e) => {
                        const newConfig = { ...expediente };
                        newConfig.businessHours[day].active = e.target.checked;
                        setExpediente(newConfig);
                      }}
                      className="w-4 h-4 rounded border-white/10 text-primary-500 bg-black/40 focus:ring-primary-500 focus:ring-offset-black"
                    />
                    <span className="text-xs font-bold text-white w-28">{translate[day] || day}</span>
                  </div>

                  {dayConfig.active ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={dayConfig.open}
                        onChange={(e) => {
                          const newConfig = { ...expediente };
                          newConfig.businessHours[day].open = e.target.value;
                          setExpediente(newConfig);
                        }}
                        className="px-3 py-1.5 bg-black/40 border border-white/10 text-white rounded-lg text-xs outline-none font-mono"
                      />
                      <span className="text-xs text-gray-500">às</span>
                      <input
                        type="time"
                        value={dayConfig.close}
                        onChange={(e) => {
                          const newConfig = { ...expediente };
                          newConfig.businessHours[day].close = e.target.value;
                          setExpediente(newConfig);
                        }}
                        className="px-3 py-1.5 bg-black/40 border border-white/10 text-white rounded-lg text-xs outline-none font-mono"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 italic">Fechado / Sem expediente</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="w-full h-[1px] bg-white/15" />

          <div className="space-y-2 max-w-xs">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Intervalo entre Agendamentos</label>
            <select
              value={expediente.slotIntervalMinutes}
              onChange={(e) => setExpediente({ ...expediente, slotIntervalMinutes: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all"
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos</option>
            </select>
          </div>

          <div className="w-full h-[1px] bg-white/15 my-6" />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Phone size={14} className="text-primary-400" />
                  Templates de Mensagens do WhatsApp
                </h3>
                <p className="text-xs text-gray-400">Cadastre e personalize os textos que serão enviados como confirmação no WhatsApp do cliente.</p>
              </div>
              {!isAddingTemplate && !editingTemplateId && (
                <button
                  type="button"
                  onClick={() => {
                    setTemplateTitle('');
                    setTemplateText('');
                    setEditingTemplateId(null);
                    setIsAddingTemplate(true);
                  }}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Novo Template</span>
                </button>
              )}
            </div>

            {/* Formulário de Template (Novo ou Edição) */}
            {(isAddingTemplate || editingTemplateId) && (
              <div className="p-5 bg-black/40 border border-white/10 rounded-2xl space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Título do Template</label>
                  <input
                    type="text"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    placeholder="Ex: Confirmação Salão, Visita Técnica..."
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mensagem</label>
                    <span className="text-[9px] text-gray-500">Clique nas tags abaixo para inserir no texto</span>
                  </div>
                  
                  {/* Botões Rápidos de Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { tag: '{nome}', label: 'Nome' },
                      { tag: '{servico}', label: 'Serviço' },
                      { tag: '{data}', label: 'Data' },
                      { tag: '{hora}', label: 'Hora' },
                      { tag: '{valor}', label: 'Valor' },
                      { tag: '{link}', label: 'Link' }
                    ].map(t => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => setTemplateText(prev => prev + t.tag)}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-lg text-[10px] font-mono transition-all cursor-pointer"
                      >
                        {t.label} ({t.tag})
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    rows={4}
                    placeholder="Olá, {nome}! Seu agendamento de {servico} foi marcado para dia {data}..."
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 resize-none font-sans"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!templateTitle.trim() || !templateText.trim()) {
                        toast.error('Preencha o título e o texto do template.');
                        return;
                      }

                      const currentTemplates = [...whatsappTemplates];
                      if (editingTemplateId) {
                        const index = currentTemplates.findIndex(t => t.id === editingTemplateId);
                        if (index !== -1) {
                          currentTemplates[index] = {
                            id: editingTemplateId,
                            title: templateTitle.trim(),
                            text: templateText.trim()
                          };
                        }
                      } else {
                        currentTemplates.push({
                          id: String(Date.now()),
                          title: templateTitle.trim(),
                          text: templateText.trim()
                        });
                      }

                      setWhatsappTemplates(currentTemplates);
                      setTemplateTitle('');
                      setTemplateText('');
                      setEditingTemplateId(null);
                      setIsAddingTemplate(false);
                      toast.success(editingTemplateId ? 'Template atualizado!' : 'Template criado! Salve as configurações para gravar.');
                    }}
                    className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check size={12} />
                    <span>{editingTemplateId ? 'Atualizar Template' : 'Adicionar Template'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateTitle('');
                      setTemplateText('');
                      setEditingTemplateId(null);
                      setIsAddingTemplate(false);
                    }}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Listagem de Templates */}
            {!isAddingTemplate && !editingTemplateId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {whatsappTemplates.map((tpl) => (
                  <div key={tpl.id} className="p-4 bg-black/20 border border-white/5 rounded-2xl flex flex-col justify-between gap-3 relative group">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-white block">{tpl.title}</span>
                        {tpl.id === 'local' || tpl.id === 'domicilio' ? (
                          <span className="text-[8px] font-black uppercase tracking-widest text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                            Nativo
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed mt-1 line-clamp-3">{tpl.text}</p>
                    </div>

                    <div className="flex items-center gap-1.5 border-t border-white/5 pt-2.5 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplateId(tpl.id);
                          setTemplateTitle(tpl.title);
                          setTemplateText(tpl.text);
                          setIsAddingTemplate(false);
                        }}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Edit2 size={10} />
                        <span>Editar</span>
                      </button>
                      {tpl.id !== 'local' && tpl.id !== 'domicilio' && (
                        <button
                          type="button"
                          onClick={() => {
                            setWhatsappTemplates(whatsappTemplates.filter(t => t.id !== tpl.id));
                            toast.info('Template removido da lista. Clique em Salvar Expediente para confirmar.');
                          }}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 size={10} />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full h-[1px] bg-white/15 my-4" />

          <button
            onClick={handleSaveExpediente}
            className="px-6 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-primary-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Check size={14} />
            Salvar Expediente
          </button>
        </div>
      )}

      {/* Modal Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <button
              onClick={closeAppointmentModal}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">
                {editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <p className="text-xs text-gray-400">
                {editingAppointmentId ? 'Ajuste os dados do agendamento do cliente.' : 'Preencha os dados do cliente e selecione o serviço para registrar na agenda.'}
              </p>
            </div>

            <form onSubmit={handleSaveAppointment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome do Cliente</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">WhatsApp / Tel</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">E-mail (Opcional)</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Serviço Ofertado</label>
                <select
                  value={newServiceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500"
                  required
                >
                  <option value="" className="bg-[#050505] text-gray-500">Selecione um serviço...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#050505]">{s.name} (R$ {s.price})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500 font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Horário</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor Cobrado (R$)</label>
                  <input
                    type="text"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="Ex: 150,00"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status do Pagamento</label>
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value as 'unpaid' | 'paid')}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500 font-bold"
                  >
                    <option value="unpaid" className="bg-[#050505] text-amber-400">PENDENTE</option>
                    <option value="paid" className="bg-[#050505] text-emerald-400">PAGO</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmittingAppointment}
                  className="flex-1 py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-600/50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-primary-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingAppointment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{editingAppointmentId ? 'Salvar Alterações' : 'Agendar Cliente'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeAppointmentModal}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Disparo WhatsApp */}
      {isWhatsAppModalOpen && activeAppointmentForWhatsApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-300 text-left">
            <button
              onClick={() => setIsWhatsAppModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">
                Enviar Confirmação
              </h3>
              <p className="text-xs text-gray-400">
                Selecione o template de WhatsApp que deseja utilizar e confira a mensagem antes de disparar.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Template da Mensagem</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500"
                >
                  {whatsappTemplates.map(t => (
                    <option key={t.id} value={t.id} className="bg-[#050505] text-white">
                      {t.title || t.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visualização do Envio</label>
                <div className="p-4 bg-[#0b141a] border border-[#202c33] rounded-2xl text-sm text-[#e9edef] whitespace-pre-wrap font-sans relative shadow-inner">
                  {/* Balão estilo WhatsApp */}
                  <div className="bg-[#005c4b] p-3 rounded-2xl rounded-tr-none text-white max-w-[90%] ml-auto relative">
                    <p className="text-sm leading-relaxed">
                      {renderWhatsAppText(
                        whatsappTemplates.find(t => t.id === selectedTemplateId)?.text || whatsappTemplates[0]?.text || '',
                        activeAppointmentForWhatsApp
                      )}
                    </p>
                    <span className="block text-[9px] text-emerald-200/80 text-right mt-1 font-mono">
                      {activeAppointmentForWhatsApp.time || ''} ✓✓
                    </span>
                    <div className="absolute top-0 right-[-6px] w-0 h-0 border-t-[8px] border-t-[#005c4b] border-r-[8px] border-r-transparent"></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendWhatsAppMessage}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  <Phone size={14} />
                  <span>Enviar via WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={executeConfirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: '', itemId: '', title: '', message: '' })}
      />
    </div>
  );
}
