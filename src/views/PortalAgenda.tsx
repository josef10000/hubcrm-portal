import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, Clock, Plus, Trash2, Edit2, Check, X, Phone, DollarSign, Settings, Scissors, AlertTriangle, ChevronDown,
  Globe, Link, Instagram, Youtube, Facebook, Gift, Copy, ExternalLink, Eye, Award, Sparkles, ChevronLeft, ChevronRight, Upload, Loader2
} from 'lucide-react';
import { Offer, Client } from '../types';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import CustomSelect from '../components/CustomSelect';
import PortalPackages from '../components/PortalPackages';
import PortalFidelity from '../components/PortalFidelity';
import { generateStaticPix } from '../lib/pix';
import { uploadToCloudinary } from '../lib/cloudinary';
import { parseNameAndMetadata } from '../components/PortalInventory';

interface PortalAgendaProps {
  orgId: string;
  clientId: string;
  initialSubTab?: 'timeline' | 'services' | 'settings';
  hideMainTabs?: boolean;
}

export default function PortalAgenda({ orgId, clientId, initialSubTab = 'timeline', hideMainTabs = false }: PortalAgendaProps) {
  const [subTab, setSubTab] = useState<'timeline' | 'services' | 'settings'>(initialSubTab);
  const [settingsSubTab, setSettingsSubTab] = useState<'hours' | 'rules' | 'biosite' | 'packages' | 'fidelity' | 'pix'>('hours');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [timelineView, setTimelineView] = useState<'daily' | 'monthly'>('daily');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

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
  
  // Estados para CRUD de templates in settings
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);

  // Estados para edição independente de seções no expediente
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [hoursBackup, setHoursBackup] = useState<any>(null);
  const [isEditingNomenclature, setIsEditingNomenclature] = useState(false);
  const [nomenclatureBackup, setNomenclatureBackup] = useState<any>(null);

  // Estados para o Mini-Site (Bio)
  const [bioTitle, setBioTitle] = useState('');
  const [bioDescription, setBioDescription] = useState('');
  const [bioAvatarUrl, setBioAvatarUrl] = useState('');
  const [bioLinks, setBioLinks] = useState<any[]>([]);
  const [bioShowBooking, setBioShowBooking] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Estados para Configurações do Pix
  const [pixKey, setPixKey] = useState('');
  const [pixName, setPixName] = useState('');
  const [pixCity, setPixCity] = useState('');
  const [pixEnabled, setPixEnabled] = useState(false);
  const [isEditingPix, setIsEditingPix] = useState(false);
  const [pixBackup, setPixBackup] = useState<any>(null);

  // Novos Estados: Termos de Cancelamento e Pix de Sinal para agendamento
  const [cancelTermsEnabled, setCancelTermsEnabled] = useState(false);
  const [cancelTermsText, setCancelTermsText] = useState('');
  const [pixRequiredForBooking, setPixRequiredForBooking] = useState(false);
  const [pixBookingAmount, setPixBookingAmount] = useState<number>(0);

  // Estados para o Modal de Cobrança Pix do Profissional
  const [isPixBillingModalOpen, setIsPixBillingModalOpen] = useState(false);
  const [activeAppointmentForPix, setActiveAppointmentForPix] = useState<any>(null);
  const [pixBillingAmount, setPixBillingAmount] = useState('');
  const [generatedPixCode, setGeneratedPixCode] = useState('');

  // Estados para o Gerador de Pix Avulso (sem agendamento)
  const [customPixAmount, setCustomPixAmount] = useState('');
  const [customPixPhone, setCustomPixPhone] = useState('');
  const [customPixClientName, setCustomPixClientName] = useState('');
  const [customPixCode, setCustomPixCode] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioBackup, setBioBackup] = useState<any>(null);
  
  // Estados auxiliares para inserção de novo link na Bio
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState('instagram');



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

  // Estados para Pacotes de Clientes
  const [clientPackages, setClientPackages] = useState<any[]>([]);

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);
  const [servicePrice, setServicePrice] = useState('');
  const [serviceCapacity, setServiceCapacity] = useState(1);
  const [servicePixRequired, setServicePixRequired] = useState(false);
  const [servicePixAmount, setServicePixAmount] = useState('');
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
  const [newPaymentMethod, setNewPaymentMethod] = useState<'dinheiro_pix_cartao' | 'pacote'>('dinheiro_pix_cartao');
  const [selectedPackageId, setSelectedPackageId] = useState('');

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
    setNewPaymentMethod('dinheiro_pix_cartao');
    setSelectedPackageId('');
  };

  const handleOpenBlockModal = () => {
    setNewClientName('Horário Bloqueado');
    setNewClientPhone('000000000');
    setNewClientEmail('');
    setNewServiceId('bloqueio');
    setNewPrice('0');
    setNewPaymentStatus('paid');
    setNewPaymentMethod('dinheiro_pix_cartao');
    setSelectedPackageId('');
    setNewTime('');
    setIsModalOpen(true);
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
    setNewPaymentMethod(app.paymentMethod || 'dinheiro_pix_cartao');
    setSelectedPackageId(app.packageId || '');
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
    const isBlocking = newClientName === "Horário Bloqueado" && newClientPhone === "000000000";

    if (!newClientName.trim() || !newClientPhone.trim() || !newTime || (!isBlocking && !newServiceId) || !orgId) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    let selectedSrv: any = null;
    if (!isBlocking) {
      selectedSrv = services.find(s => s.id === newServiceId);
      if (!selectedSrv) {
        toast.error('Selecione um serviço válido.');
        return;
      }
    }

    setIsSubmittingAppointment(true);
    try {
      const payload: any = {
        clientName: newClientName.trim(),
        clientPhone: newClientPhone.trim(),
        clientEmail: newClientEmail.trim(),
        serviceId: isBlocking ? "bloqueio" : newServiceId,
        serviceName: isBlocking ? "Bloqueio de Horário" : selectedSrv.name,
        date: newDate,
        time: newTime,
        price: isBlocking ? 0 : (newPaymentMethod === 'pacote' ? 0 : Number(newPrice.replace(',', '.'))),
        paymentStatus: isBlocking ? "paid" : (newPaymentMethod === 'pacote' ? 'paid' : newPaymentStatus),
        paymentMethod: isBlocking ? 'dinheiro_pix_cartao' : newPaymentMethod,
        packageId: isBlocking ? '' : (newPaymentMethod === 'pacote' ? selectedPackageId : ''),
        updatedAt: serverTimestamp()
      };

      if (editingAppointmentId) {
        await updateDoc(doc(db, 'organizations', orgId, 'appointments', editingAppointmentId), payload);
        toast.success(isBlocking ? 'Bloqueio atualizado com sucesso!' : 'Agendamento atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'appointments'), {
          ...payload,
          status: isBlocking ? 'confirmed' : 'created',
          createdAt: serverTimestamp()
        });
        toast.success(isBlocking ? 'Horário bloqueado com sucesso!' : 'Agendamento realizado com sucesso!');
      }

      closeAppointmentModal();
    } catch (err) {
      console.error(err);
      toast.error(editingAppointmentId ? 'Erro ao atualizar.' : 'Erro ao realizar a operação.');
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
    }, (error) => {
      console.error("[DIAGNOSTICO FIRESTORE] Erro de permissão ao ler appointments na Agenda em:", appointmentsRef.path, error);
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
    }, (error) => {
      console.error("[DIAGNOSTICO FIRESTORE] Erro de permissão ao ler client_services na Agenda em:", servicesRef.path, error);
    });
    return () => unsub();
  }, [orgId]);

  // Escuta as configurações da Agenda no próprio documento do cliente
  // Sempre busca via API no mount para garantir dados persistidos
  useEffect(() => {
    if (!orgId || !clientId) return;

    const applyClientData = (clientData: any) => {
      const sched = clientData.schedulingSettings || {};
      setExpediente((prev: any) => ({
        ...prev,
        ...sched,
        businessHours: sched.businessHours && Object.keys(sched.businessHours).length > 0
          ? { ...prev.businessHours, ...sched.businessHours }
          : prev.businessHours
      }));
      if (sched.whatsappTemplates && Array.isArray(sched.whatsappTemplates)) {
        setWhatsappTemplates(sched.whatsappTemplates);
      }
      if (sched.pixKey !== undefined) setPixKey(sched.pixKey || '');
      if (sched.pixName !== undefined) setPixName(sched.pixName || '');
      if (sched.pixCity !== undefined) setPixCity(sched.pixCity || '');
      if (sched.pixEnabled !== undefined) setPixEnabled(sched.pixEnabled || false);
      if (sched.cancelTermsEnabled !== undefined) setCancelTermsEnabled(sched.cancelTermsEnabled || false);
      if (sched.cancelTermsText !== undefined) setCancelTermsText(sched.cancelTermsText || '');
      if (sched.pixRequiredForBooking !== undefined) setPixRequiredForBooking(sched.pixRequiredForBooking || false);
      if (sched.pixBookingAmount !== undefined) setPixBookingAmount(sched.pixBookingAmount || 0);

      const bio = clientData.bioSettings || {};
      setBioTitle(bio.title || '');
      setBioDescription(bio.description || '');
      setBioAvatarUrl(bio.avatarUrl || '');
      setBioLinks(bio.links || []);
      setBioShowBooking(bio.showBooking !== undefined ? bio.showBooking : true);
    };

    const fetchFromApi = async () => {
      try {
        const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
        const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
        const res = await fetch(`${crmApiUrl}/api/portal_handler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_client', orgId, clientId, token })
        });
        if (res.ok) {
          const data = await res.json();
          applyClientData(data.client || data);
        }
      } catch (e) {
        console.error('[PortalAgenda] Falha ao buscar dados via API:', e);
      }
    };

    // Busca via API imediatamente no mount para garantir dados persistidos
    fetchFromApi();

    // Também escuta Firestore em tempo real (funciona quando há permissão)
    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        applyClientData(docSnap.data());
      }
    }, (err) => {
      console.warn('[PortalAgenda] Firestore sem permissão de leitura:', err.message);
    });
    return () => unsub();
  }, [orgId, clientId]);



  // Escuta Inventário
  useEffect(() => {
    if (!orgId) return;
    const inventoryRef = collection(db, 'organizations', orgId, 'inventory');
    const unsub = onSnapshot(inventoryRef, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data() as any;
        const meta = parseNameAndMetadata(data.name);
        return {
          id: d.id,
          ...data,
          name: meta.name,
          brand: meta.brand,
          price: meta.price,
          showInPos: meta.showInPos,
          sales: meta.sales
        };
      });
      setInventory(list);
    }, (error) => {
      console.error("[DIAGNOSTICO FIRESTORE] Erro de permissão ao ler inventory na Agenda em:", inventoryRef.path, error);
    });
    return () => unsub();
  }, [orgId]);

  // Escuta Pacotes de Clientes
  useEffect(() => {
    if (!orgId) return;
    const packagesRef = collection(db, 'organizations', orgId, 'client_packages');
    const q = query(packagesRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientPackages(list);
    }, (err) => {
      // Fallback sem ordenação caso o índice não esteja criado
      console.warn("[PortalAgenda] Índice ausente ao ordenar pacotes, tentando ler sem ordenação:", err);
      onSnapshot(packagesRef, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientPackages(list);
      }, (error) => {
        console.error("[DIAGNOSTICO FIRESTORE] Erro de permissão ao ler client_packages na Agenda em:", packagesRef.path, error);
      });
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

  // Funções Auxiliares para a Visão Mensal da Agenda
  const weekDaysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
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

  const getAppointmentsForDay = (dateStr: string) => {
    return appointments.filter(app => app.date === dateStr && app.status !== 'cancelled');
  };

  const getDayStats = (dateStr: string) => {
    const dayAppts = getAppointmentsForDay(dateStr);
    return {
      total: dayAppts.length,
      confirmed: dayAppts.filter(app => app.status === 'confirmed').length,
      pending: dayAppts.filter(app => app.status === 'pending').length,
      scheduled: dayAppts.filter(app => app.status === 'scheduled' || !app.status || app.status === 'confirmed_by_client').length
    };
  };

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
        capacity: Number(serviceCapacity) || 1,
        materials: selectedServiceMaterials,
        isActive: true,
        updatedAt: serverTimestamp(),
        pixRequired: servicePixRequired,
        pixAmount: servicePixRequired ? Number(servicePixAmount.replace(',', '.')) || 0 : 0
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
      setServiceCapacity(1);
      setServicePixRequired(false);
      setServicePixAmount('');
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
    setServiceCapacity(srv.capacity || 1);
    setServicePixRequired(srv.pixRequired || false);
    setServicePixAmount(srv.pixAmount?.toString() || '');
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

  // Salvar apenas os Horários de Atendimento (Expediente Comercial)
  const handleSaveHours = async () => {
    if (!orgId || !clientId) return;
    try {
      const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
      const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
      const currentUser = auth.currentUser;

      const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_client',
          orgId,
          clientId,
          token,
          uid: currentUser?.uid || '',
          email: currentUser?.email || '',
          schedulingSettings: {
            ...expediente,
            pixKey,
            pixName,
            pixCity,
            pixEnabled,
            whatsappTemplates,
            businessHours: expediente.businessHours || {}
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar expediente.');
      }

      toast.success('Horários de expediente salvos com sucesso!');
      setIsEditingHours(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar horários de expediente.');
    }
  };

  // Salvar apenas as Regras e Nomenclaturas
  const handleSaveNomenclature = async () => {
    if (!orgId || !clientId) return;
    try {
      const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
      const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
      const currentUser = auth.currentUser;

      const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_client',
          orgId,
          clientId,
          token,
          uid: currentUser?.uid || '',
          email: currentUser?.email || '',
          schedulingSettings: {
            ...expediente,
            pixKey,
            pixName,
            pixCity,
            pixEnabled,
            whatsappTemplates,
            slotIntervalMinutes: expediente.slotIntervalMinutes || 30,
            appointmentLabelSingular: expediente.appointmentLabelSingular || 'Agendamento',
            appointmentLabelPlural: expediente.appointmentLabelPlural || 'Agendamentos',
            packagesActive: expediente.packagesActive || false,
            cancelTermsEnabled,
            cancelTermsText,
            pixRequiredForBooking,
            pixBookingAmount: Number(pixBookingAmount) || 0
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar configurações.');
      }

      toast.success('Configurações de regras e nomenclaturas salvas!');
      setIsEditingNomenclature(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar configurações.');
    }
  };

  // Salvar apenas as configurações do Pix
  const handleSavePixSettings = async () => {
    if (!orgId || !clientId) return;
    try {
      const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
      const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
      const currentUser = auth.currentUser;

      const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_client',
          orgId,
          clientId,
          token,
          uid: currentUser?.uid || '',
          email: currentUser?.email || '',
          schedulingSettings: {
            ...expediente,
            whatsappTemplates,
            pixKey: pixKey.trim(),
            pixName: pixName.trim(),
            pixCity: pixCity.trim(),
            pixEnabled: pixEnabled,
            cancelTermsEnabled,
            cancelTermsText,
            pixRequiredForBooking,
            pixBookingAmount: Number(pixBookingAmount) || 0
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar configurações de Pix.');
      }

      toast.success('Configurações de Pix salvas com sucesso!');
      setIsEditingPix(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar configurações de Pix.');
    }
  };

  // Abre modal de cobrança Pix
  const handleOpenPixBillingModal = (app: any) => {
    setActiveAppointmentForPix(app);
    setPixBillingAmount((app.price || 0).toFixed(2).replace('.', ','));
    
    if (pixKey) {
      const code = generateStaticPix({
        key: pixKey,
        name: pixName || 'Empresa',
        city: pixCity || 'Sao Paulo',
        amount: app.price || 0,
        txid: app.id ? app.id.substring(0, 25) : '***'
      });
      setGeneratedPixCode(code);
    } else {
      setGeneratedPixCode('');
    }
    
    setIsPixBillingModalOpen(true);
  };

  // Recalcula código Pix ao digitar outro valor
  const handleRecalculatePixCode = (amountStr: string) => {
    setPixBillingAmount(amountStr);
    const parsedAmount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    
    if (pixKey && activeAppointmentForPix) {
      const code = generateStaticPix({
        key: pixKey,
        name: pixName || 'Empresa',
        city: pixCity || 'Sao Paulo',
        amount: parsedAmount,
        txid: activeAppointmentForPix.id ? activeAppointmentForPix.id.substring(0, 25) : '***'
      });
      setGeneratedPixCode(code);
    }
  };

  // Envia Pix via WhatsApp (Texto tradicional copia e cola)
  const handleSendPixWhatsAppMessage = () => {
    if (!activeAppointmentForPix || !generatedPixCode) return;
    
    const cleanPhone = activeAppointmentForPix.clientPhone.replace(/\D/g, '');
    const dateObj = new Date(activeAppointmentForPix.date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const text = `Olá, *${activeAppointmentForPix.clientName}*! Segue abaixo os dados para o pagamento via Pix referente ao seu agendamento de *${activeAppointmentForPix.serviceName}* no dia *${dateFormatted}* às *${activeAppointmentForPix.time}*:\n\n💰 *Valor*: R$ ${pixBillingAmount}\n\n🔑 *Pix Copia e Cola*:\n\`${generatedPixCode}\`\n\n_Por favor, nos envie o comprovante por aqui assim que realizar o pagamento. Obrigado!_`;
    
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, '_blank');
    setIsPixBillingModalOpen(false);
  };

  // Envia Pix via WhatsApp usando link público de pagamento
  const handleSendPixLinkWhatsAppMessage = () => {
    if (!activeAppointmentForPix || !pixKey) return;
    
    const cleanPhone = activeAppointmentForPix.clientPhone.replace(/\D/g, '');
    const parsedAmount = parseFloat(pixBillingAmount.replace(/\./g, '').replace(',', '.'));
    const amountVal = isNaN(parsedAmount) || parsedAmount <= 0 ? 0 : parsedAmount;
    
    const baseUrl = window.location.origin;
    const paymentLink = `${baseUrl}/pagar-pix?key=${encodeURIComponent(pixKey)}&name=${encodeURIComponent(pixName || 'Empresa')}&city=${encodeURIComponent(pixCity || 'Sao Paulo')}&amount=${amountVal}&txid=${activeAppointmentForPix.id ? activeAppointmentForPix.id.substring(0, 25) : '***'}`;
    
    const dateObj = new Date(activeAppointmentForPix.date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const text = `Olá, *${activeAppointmentForPix.clientName}*! Segue o link para o pagamento via Pix referente ao seu agendamento de *${activeAppointmentForPix.serviceName}* no dia *${dateFormatted}* às *${activeAppointmentForPix.time}*:\n\n🔗 *Link de Pagamento*:\n${paymentLink}\n\n_Acesse o link para visualizar o QR Code ou copiar o código de pagamento. Obrigado!_`;
    
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, '_blank');
    setIsPixBillingModalOpen(false);
  };

  // Recalcula código Pix avulso ao digitar valor
  const handleRecalculateCustomPix = (amountStr: string) => {
    setCustomPixAmount(amountStr);
    const parsedAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setCustomPixCode('');
      return;
    }
    
    if (pixKey) {
      const code = generateStaticPix({
        key: pixKey,
        name: pixName || 'Empresa',
        city: pixCity || 'Sao Paulo',
        amount: parsedAmount,
        txid: 'PIXAVULSO' + Math.floor(Math.random() * 1000000)
      });
      setCustomPixCode(code);
    } else {
      setCustomPixCode('');
    }
  };

  // Retorna o link de pagamento do Pix avulso
  const handleGetCustomPixLink = () => {
    if (!pixKey) return '';
    const parsedAmount = parseFloat(customPixAmount.replace(/\./g, '').replace(',', '.'));
    const amountVal = isNaN(parsedAmount) || parsedAmount <= 0 ? 0 : parsedAmount;
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/pagar-pix?key=${encodeURIComponent(pixKey)}&name=${encodeURIComponent(pixName || 'Empresa')}&city=${encodeURIComponent(pixCity || 'Sao Paulo')}&amount=${amountVal}`;
  };

  // Copia o link de pagamento do Pix avulso
  const handleCopyCustomPixLink = () => {
    const link = handleGetCustomPixLink();
    if (!link) {
      toast.error('Gere o código Pix primeiro.');
      return;
    }
    navigator.clipboard.writeText(link);
    toast.success('Link de pagamento copiado com sucesso!');
  };

  // Envia Pix avulso via WhatsApp (Texto copia e cola)
  const handleSendCustomPixWhatsApp = () => {
    if (!customPixCode) {
      toast.error('Gere o código Pix antes de enviar.');
      return;
    }
    if (!customPixPhone.trim()) {
      toast.error('Informe o telefone do cliente.');
      return;
    }
    
    let cleanPhone = customPixPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = '55' + cleanPhone;
    }
    
    const clientGreeting = customPixClientName.trim() ? `Olá, *${customPixClientName.trim()}*!` : 'Olá!';
    
    const text = `${clientGreeting} Segue abaixo os dados para o pagamento via Pix:\n\n💰 *Valor*: R$ ${customPixAmount}\n\n🔑 *Pix Copia e Cola*:\n\`${customPixCode}\`\n\n_Por favor, nos envie o comprovante por aqui assim que realizar o pagamento. Obrigado!_`;
    
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, '_blank');
  };

  // Envia Pix avulso via WhatsApp (Link de pagamento)
  const handleSendCustomPixLinkWhatsApp = () => {
    const link = handleGetCustomPixLink();
    if (!link) {
      toast.error('Gere o código Pix primeiro.');
      return;
    }
    if (!customPixPhone.trim()) {
      toast.error('Informe o telefone do cliente.');
      return;
    }
    
    let cleanPhone = customPixPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = '55' + cleanPhone;
    }
    
    const clientGreeting = customPixClientName.trim() ? `Olá, *${customPixClientName.trim()}*!` : 'Olá!';
    
    const text = `${clientGreeting} Segue o link para realizar o pagamento via Pix no valor de R$ ${customPixAmount}:\n\n🔗 *Link de Pagamento*:\n${link}\n\n_Basta acessar o link para visualizar o QR Code ou copiar o código para pagar no seu banco. Obrigado!_`;
    
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, '_blank');
  };

  // Salvar apenas Mini-Site (Bio)
  const handleSaveBioSite = async () => {
    if (!orgId || !clientId) return;
    try {
      const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
      const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
      const currentUser = auth.currentUser;

      const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_client',
          orgId,
          clientId,
          token,
          uid: currentUser?.uid || '',
          email: currentUser?.email || '',
          bioSettings: {
            title: bioTitle.trim(),
            description: bioDescription.trim(),
            avatarUrl: bioAvatarUrl.trim(),
            links: bioLinks,
            showBooking: bioShowBooking
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar configurações do Mini-Site.');
      }

      toast.success('Configurações do Mini-Site salvas com sucesso!');
      setIsEditingBio(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar configurações do Mini-Site.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      setBioAvatarUrl(secureUrl);
      toast.success('Imagem da logo carregada com sucesso! Não esqueça de salvar as alterações da Bio.');
    } catch (err) {
      console.error('[Mini-site] Upload da logo falhou:', err);
      toast.error('Erro ao fazer upload da logo da empresa.');
    } finally {
      setIsUploadingLogo(false);
    }
  };



  // Adicionar Link na Lista Temporária da Bio
  const handleAddBioLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) {
      toast.error('Informe o rótulo e a URL do link.');
      return;
    }
    // Formatar URL com http:// ou https:// se não tiver
    let formattedUrl = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    const newLink = {
      id: String(Date.now()),
      label: newLinkLabel.trim(),
      url: formattedUrl,
      icon: newLinkIcon
    };
    setBioLinks([...bioLinks, newLink]);
    setNewLinkLabel('');
    setNewLinkUrl('');
    setNewLinkIcon('instagram');
    toast.success('Link adicionado à lista! Lembre-se de salvar.');
  };

  // Remover Link da Lista Temporária da Bio
  const handleRemoveBioLink = (linkId: string) => {
    setBioLinks(bioLinks.filter(link => link.id !== linkId));
    toast.success('Link removido da lista! Lembre-se de salvar.');
  };

  // Gera os slots disponíveis para uma data
  const getAvailableTimeSlots = (dateStr: string, targetServiceId?: string) => {
    if (!dateStr || !expediente || !expediente.businessHours) return [];

    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayKey = weekdays[dateObj.getDay()];
    
    const dayConfig = expediente.businessHours[dayKey];
    if (!dayConfig || !dayConfig.active || !dayConfig.open || !dayConfig.close) {
      return [];
    }

    const parseTimeToMinutes = (timeStr: string) => {
      const [hh, mm] = timeStr.split(':').map(Number);
      return hh * 60 + mm;
    };

    const openMinutes = parseTimeToMinutes(dayConfig.open);
    const closeMinutes = parseTimeToMinutes(dayConfig.close);
    const interval = expediente.slotIntervalMinutes || 30;

    const allSlots: string[] = [];
    let current = openMinutes;
    while (current < closeMinutes) {
      const hh = Math.floor(current / 60).toString().padStart(2, '0');
      const mm = (current % 60).toString().padStart(2, '0');
      allSlots.push(`${hh}:${mm}`);
      current += interval;
    }

    // Achar o serviço atual sendo agendado
    const currentService = services.find(s => s.id === targetServiceId);
    const targetCapacity = currentService?.capacity || 1;

    return allSlots.filter(slot => {
      // Agendamentos ativos no mesmo dia e horário
      const apptsAtSlot = appointments.filter(app => {
        if (app.status === 'cancelled') return false;
        if (editingAppointmentId && app.id === editingAppointmentId) return false;
        return app.date === dateStr && app.time === slot;
      });

      // Se houver algum bloqueio no horário, está indisponível
      const hasBlock = apptsAtSlot.some(app => app.serviceId === 'bloqueio');
      if (hasBlock) return false;

      // Se não houver nenhum agendamento, está totalmente disponível
      if (apptsAtSlot.length === 0) return true;

      // Se o serviço que está sendo agendado for individual (vagas = 1):
      // Qualquer agendamento nesse horário impede o agendamento
      if (targetCapacity === 1) {
        return false;
      }

      // Se o serviço que está sendo agendado for coletivo (vagas > 1):
      // 1. Não pode haver nenhum agendamento de serviço individual (capacity = 1 ou não definido)
      // 2. Não pode haver nenhum agendamento de um serviço coletivo diferente
      // 3. O número de agendamentos para o mesmo serviço deve ser menor que a capacidade dele
      const hasIndividualOrDifferentService = apptsAtSlot.some(app => {
        const srv = services.find(s => s.id === app.serviceId);
        const srvCapacity = srv?.capacity || 1;
        return srvCapacity === 1 || app.serviceId !== targetServiceId;
      });

      if (hasIndividualOrDifferentService) {
        return false;
      }

      const sameServiceApptsCount = apptsAtSlot.filter(app => app.serviceId === targetServiceId).length;
      return sameServiceApptsCount < targetCapacity;
    });
  };

  // Ações de Agendamento (Mudar Status)
  const handleUpdateAppointmentStatus = async (appId: string, status: 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const updatePayload: any = { status };
      if (status === 'completed') {
        updatePayload.paymentStatus = 'paid';
      }

      await updateDoc(doc(db, 'organizations', orgId, 'appointments', appId), updatePayload);

      // Baixa Automática no Estoque e Débito de Pacotes se o agendamento foi concluído
      if (status === 'completed') {
        const app = appointments.find(a => a.id === appId);
        if (app) {
          // Débito automático do crédito do pacote
          if (app.paymentMethod === 'pacote' && app.packageId) {
            const pkgRef = doc(db, 'organizations', orgId, 'client_packages', app.packageId);
            const pkg = clientPackages.find(p => p.id === app.packageId);
            if (pkg) {
              const newUsed = Math.min(pkg.totalSessions, pkg.usedSessions + 1);
              const newStatus = newUsed >= pkg.totalSessions ? 'completed' : 'active';
              const updatedHistory = [...(pkg.sessionsHistory || []), {
                date: app.date,
                time: app.time,
                professional: 'Estabelecimento',
                appointmentId: appId
              }];

              await updateDoc(pkgRef, {
                usedSessions: newUsed,
                status: newStatus,
                sessionsHistory: updatedHistory,
                updatedAt: serverTimestamp()
              });
              toast.info(`1 crédito debitado do pacote de ${pkg.clientName}!`);
            }
          }

          if (app.serviceId) {
            const srv = services.find(s => s.id === app.serviceId);
            if (srv && srv.materials && Array.isArray(srv.materials) && srv.materials.length > 0) {
              const promises = srv.materials.map(async (m: any) => {
              const invItem = inventory.find(i => i.id === m.itemId);
              if (invItem) {
                const newQty = Math.max(0, invItem.quantity - m.quantity);
                // Atualiza o estoque físico
                await updateDoc(doc(db, 'organizations', orgId, 'inventory', m.itemId), {
                  quantity: newQty,
                  updatedAt: serverTimestamp()
                });
                // Registra o log de movimentação de saída
                try {
                  await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
                    itemId: m.itemId,
                    itemName: invItem.name,
                    type: 'saida',
                    quantity: m.quantity,
                    date: serverTimestamp(),
                    description: `Consumo automático no atendimento de ${app.clientName} (${srv.name})`
                  });
                } catch (logErr) {
                  console.warn("[PortalAgenda] Sem permissão para gravar log de inventário:", logErr);
                }
              }
            });
            await Promise.all(promises);
            toast.info("Insumos baixados no estoque automaticamente!");
          }
        }
      }
    }

    toast.success(
      status === 'confirmed' ? 'Status atualizado para: Confirmado' :
        status === 'cancelled' ? 'Status atualizado para: Cancelado' :
        'Agendamento concluído e enviado ao Financeiro!'
      );
    } catch (e) {
      console.error(e);
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

  const getClientFidelityCount = (phone: string) => {
    if (!phone || phone === "000000000") return 0;
    const cleanPhone = phone.replace(/\D/g, '');
    return appointments.filter(app => 
      app.status === 'completed' && 
      app.clientPhone && 
      app.clientPhone.replace(/\D/g, '') === cleanPhone
    ).length;
  };

  const appointmentsToday = appointments.filter(app => app.date === selectedDate);
  const timelineItems = useMemo(() => {
    const sortedToday = [...appointmentsToday].sort((a, b) => a.time.localeCompare(b.time));
    const processedIds = new Set<string>();
    const result: any[] = [];

    sortedToday.forEach(app => {
      if (processedIds.has(app.id)) return;

      const srv = services.find(s => s.id === app.serviceId);
      const isColetivo = srv && srv.capacity > 1;

      if (isColetivo && app.serviceId !== 'bloqueio') {
        const siblings = sortedToday.filter(other => 
          other.time === app.time && 
          other.serviceId === app.serviceId && 
          other.id !== app.id
        );

        if (siblings.length > 0) {
          const groupList = [app, ...siblings];
          groupList.forEach(item => processedIds.add(item.id));
          result.push({
            id: `group-${app.time}-${app.serviceId}`,
            type: 'group',
            time: app.time,
            serviceId: app.serviceId,
            serviceName: app.serviceName || srv.name,
            service: srv,
            appointments: groupList
          });
          return;
        }
      }

      processedIds.add(app.id);
      result.push({
        id: app.id,
        type: 'single',
        time: app.time,
        appointment: app
      });
    });

    return result;
  }, [appointmentsToday, services]);
  const todayStrPending = new Date().toISOString().split('T')[0];
  const pendingPublicAppointments = appointments.filter((app: any) => 
    app.origin === 'public_link' && 
    app.status === 'pending' && 
    app.date >= todayStrPending
  ).sort((a: any, b: any) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a.time.localeCompare(b.time);
  });
  const isBlocking = newClientName === 'Horário Bloqueado' && newClientPhone === '000000000';
  const labelSingular = expediente?.appointmentLabelSingular || 'Agendamento';
  const labelPlural = expediente?.appointmentLabelPlural || 'Agendamentos';

  return (
    <div className="space-y-6">
      {/* Alerta de Insumos Insuficientes */}
      {stockAlerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/35 p-5 rounded-2xl text-amber-200 flex flex-col gap-2 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Alerta de Insumos Insuficientes para {labelPlural} Futuros
          </div>
          <p className="text-[11px] text-gray-400">
            Com base nos {labelPlural.toLowerCase()} futuros confirmados, os seguintes materiais no seu estoque ficarão negativos:
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

      {/* Seletor Mobile & Desktop de Abas (oculto se hideMainTabs for true) */}
      {!hideMainTabs && (
        <>
          {/* Seletor Mobile (Dropdown Customizado) */}
          <div className="relative block md:hidden w-full mb-6 z-20">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full pl-12 pr-10 py-4 bg-[#0d0e12]/80 backdrop-blur-xl border border-white/10 hover:border-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-wider outline-none transition-all cursor-pointer flex items-center justify-between text-left relative"
            >
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
                {(() => {
                  if (subTab === 'timeline') return <Clock size={18} />;
                  if (subTab === 'services') return <Scissors size={18} />;
                  return <Settings size={18} />;
                })()}
              </div>
              <span>
                {(() => {
                  if (subTab === 'timeline') return 'Linha do Tempo';
                  if (subTab === 'services') return 'Gerenciar Serviços';
                  return 'Configurações';
                })()}
              </span>
              <ChevronDown 
                size={16} 
                className={`text-gray-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-primary-400' : ''}`} 
              />
            </button>

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-[#0a0c10]/95 border border-white/10 backdrop-blur-2xl rounded-2xl p-2 shadow-2xl flex flex-col space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('timeline');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-colors cursor-pointer border-0 ${
                      subTab === 'timeline' 
                        ? 'bg-primary-500/15 text-primary-400 font-black' 
                        : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                    }`}
                  >
                    <Clock size={16} className={subTab === 'timeline' ? 'text-primary-400' : 'text-gray-500'} />
                    Linha do Tempo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('services');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-colors cursor-pointer border-0 ${
                      subTab === 'services' 
                        ? 'bg-primary-500/15 text-primary-400 font-black' 
                        : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                    }`}
                  >
                    <Scissors size={16} className={subTab === 'services' ? 'text-primary-400' : 'text-gray-500'} />
                    Gerenciar Serviços
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('settings');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-colors cursor-pointer border-0 ${
                      subTab === 'settings' 
                        ? 'bg-primary-500/15 text-primary-400 font-black' 
                        : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                    }`}
                  >
                    <Settings size={16} className={subTab === 'settings' ? 'text-primary-400' : 'text-gray-500'} />
                    Configurações
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Abas Superiores (Desktop) */}
          <div className="hidden md:flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-full overflow-x-auto scrollbar-none snap-x flex-nowrap md:w-fit mb-6">
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
              Configurações
            </button>
          </div>
        </>
      )}

      {/* ABA 1: LINHA DO TEMPO */}
      {subTab === 'timeline' && (
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="text-primary-400" size={20} />
                {timelineView === 'monthly' ? 'Agenda Mensal' : (labelSingular === 'Proposta' ? 'Painel de Propostas' : 'Agenda Diária')}
              </h2>
              <p className="text-xs text-gray-400">
                {timelineView === 'monthly' ? 'Visualize e navegue por todos os agendamentos do mês.' : `Gerencie os horários marcados para os(as) ${labelPlural.toLowerCase()}.`}
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap sm:flex-nowrap">
              {/* Toggle Diária/Mensal */}
              <div className="flex bg-black/40 border border-white/10 rounded-xl p-0.5 shrink-0">
                <button
                  onClick={() => setTimelineView('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timelineView === 'daily' 
                      ? 'bg-primary-500 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Diária
                </button>
                <button
                  onClick={() => setTimelineView('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timelineView === 'monthly' 
                      ? 'bg-primary-500 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Mensal
                </button>
              </div>

              {timelineView === 'daily' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/40 border border-white/15 hover:border-white/30 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all font-bold w-full sm:w-auto"
                />
              ) : (
                <div className="flex items-center justify-between gap-2 bg-black/40 border border-white/15 rounded-xl px-2 py-1 flex-1 sm:flex-initial h-[46px] min-w-[170px]">
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-white min-w-[90px] text-center select-none uppercase tracking-wider">
                    {calendarMonth.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-lg shadow-primary-500/20 active:scale-95 cursor-pointer border-0 h-[46px]"
              >
                <Plus size={16} />
                <span>{labelSingular === 'Proposta' ? 'Criar Proposta' : 'Agendar'}</span>
              </button>
              
              <button
                onClick={handleOpenBlockModal}
                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer h-[46px]"
              >
                <AlertTriangle size={16} />
                <span>Bloquear</span>
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] bg-white/15" />

          {/* Solicitações Pendentes do Link Público */}
          {pendingPublicAppointments.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">
                  Solicitações Online Pendentes ({pendingPublicAppointments.length})
                </h3>
                <Globe size={14} className="text-amber-500/60 ml-auto" />
              </div>
              <p className="text-[11px] text-gray-400">
                Estas solicitações foram feitas pelo link público de agendamento e aguardam sua confirmação.
              </p>
              <div className="space-y-3">
                {pendingPublicAppointments.map((app: any) => {
                  const dateFormatted = new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  return (
                    <div key={app.id} className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">{app.clientName}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            PENDENTE
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <CalendarIcon size={11} className="text-gray-500" />
                            {dateFormatted}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-gray-500" />
                            {app.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Scissors size={11} className="text-gray-500" />
                            {app.serviceName}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} className="text-gray-500" />
                            R$ {app.price?.toFixed(2).replace('.', ',')}
                          </span>
                          {app.clientPhone && (
                            <span className="flex items-center gap-1">
                              <Phone size={11} className="text-gray-500" />
                              {app.clientPhone}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            handleUpdateAppointmentStatus(app.id, 'confirmed');
                            toast.success(`${labelSingular} de ${app.clientName} confirmado!`);
                          }}
                          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer border-0"
                        >
                          <Check size={14} />
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            handleUpdateAppointmentStatus(app.id, 'cancelled');
                            toast.info(`Solicitação de ${app.clientName} recusada.`);
                          }}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <X size={14} />
                          Recusar
                        </button>
                        <button
                          onClick={() => setSelectedDate(app.date)}
                          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Ver na timeline"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {timelineView === 'daily' ? (
            appointmentsToday.length === 0 ? (
            <div className="py-20 text-center bg-black/20 rounded-2xl border border-white/5">
              <CalendarIcon size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Nenhum(a) {labelSingular} Hoje</p>
              <p className="text-xs text-gray-500 mt-1">Seu painel de {labelPlural.toLowerCase()} de {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} está livre.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-primary-500/20 ml-2 pl-4 sm:ml-4 sm:pl-8 space-y-8 py-2">
              {timelineItems.map((item) => {
                if (item.type === 'single') {
                  const app = item.appointment;
                  return (
                    <div key={app.id} className="relative group">
                      <div className={`absolute -left-[25px] sm:-left-[39px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-[#050505] shadow-md transition-colors ${
                        app.serviceId === 'bloqueio' ? 'bg-rose-500/50 shadow-none' :
                        app.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                        app.status === 'cancelled' ? 'bg-rose-500' : 
                        app.status === 'pending' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                        'bg-primary-500 animate-pulse'
                      }`} />

                      <div className={`bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        app.serviceId === 'bloqueio' ? 'opacity-80 border-rose-500/10 hover:border-rose-500/20 bg-rose-500/[0.02]' : ''
                      }`}>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-black text-primary-400 font-mono flex items-center gap-1.5 bg-primary-500/10 px-2.5 py-1 rounded-lg">
                              <Clock size={12} />
                              {app.time}
                            </span>
                            {app.serviceId === 'bloqueio' ? (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-rose-500/20 text-rose-400 border-rose-500/30">
                                BLOQUEADO
                              </span>
                            ) : (
                              <>
                                {app.paymentStatus === 'signal_pending' && (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                                    SINAL PENDENTE (R$ {app.pixSignalAmount?.toFixed(2).replace('.', ',')})
                                  </span>
                                )}
                                {app.paymentStatus === 'signal_paid' && (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-sky-500/20 text-sky-400 border-sky-500/30">
                                    SINAL PAGO
                                  </span>
                                )}
                                {app.paymentStatus !== 'signal_pending' && app.paymentStatus !== 'signal_paid' && (
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                    app.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  }`}>
                                    {app.paymentStatus === 'paid' ? 'PAGO' : 'NÃO PAGO'}
                                  </span>
                                )}
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                  app.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                  app.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                  app.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' :
                                  app.status === 'created' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                  'bg-sky-500/20 text-sky-400 border-sky-500/30'
                                }`}>
                                  {app.status === 'completed' ? 'CONCLUÍDO' :
                                   app.status === 'cancelled' ? 'CANCELADO' :
                                   app.status === 'pending' ? 'PENDENTE CONFIRMAÇÃO' :
                                   app.status === 'created' ? 'AGENDADO' : 'CONFIRMADO'}
                                </span>
                                {(() => {
                                  const fidelityCount = getClientFidelityCount(app.clientPhone);
                                  if (fidelityCount > 0) {
                                    return (
                                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
                                        ★ Cliente Fiel ({fidelityCount} {fidelityCount === 1 ? 'atendimento' : 'atendimentos'})
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-white">{app.clientName}</h3>
                          {app.serviceId !== 'bloqueio' && (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Scissors size={12} className="text-gray-600" />
                              Serviço: <span className="text-white font-medium">{app.serviceName}</span> &bull; 
                              <DollarSign size={12} className="text-gray-600 ml-1" /> Valor: <span className="text-white font-medium">R$ {app.price?.toFixed(2).replace('.', ',')}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto md:justify-end">
                          {app.serviceId !== 'bloqueio' && (
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              {app.clientPhone && (app.status === 'created' || app.status === 'pending') && (
                                <button
                                  onClick={() => handleOpenWhatsAppModal(app)}
                                  className="flex-1 sm:flex-initial justify-center p-2.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-0"
                                >
                                  <Phone size={14} />
                                  Enviar Confirmação
                                </button>
                              )}

                              {pixKey && app.paymentStatus !== 'paid' && app.paymentMethod !== 'pacote' && app.status !== 'completed' && app.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleOpenPixBillingModal(app)}
                                  className="flex-1 sm:flex-initial justify-center p-2.5 bg-primary-500/10 hover:bg-primary-500/25 border border-primary-500/20 text-primary-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-0"
                                >
                                  <DollarSign size={14} />
                                  Cobrar Pix
                                </button>
                              )}

                              {app.paymentStatus === 'signal_pending' && app.status !== 'completed' && app.status !== 'cancelled' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const docRef = doc(db, 'organizations', orgId, 'appointments', app.id);
                                      await updateDoc(docRef, { paymentStatus: 'signal_paid' });
                                      toast.success('Sinal Pix confirmado com sucesso!');
                                    } catch (err) {
                                      toast.error('Erro ao confirmar sinal.');
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial justify-center p-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/20 text-sky-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                  <Check size={14} />
                                  Confirmar Sinal
                                </button>
                              )}
                              
                              {app.status !== 'completed' && app.status !== 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateAppointmentStatus(app.id, 'completed')}
                                    className="flex-1 sm:flex-initial justify-center p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer border-0"
                                  >
                                    <Check size={14} />
                                    Finalizar
                                  </button>
                                  <button
                                    onClick={() => handleUpdateAppointmentStatus(app.id, 'cancelled')}
                                    className="flex-1 sm:flex-initial justify-center p-2.5 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-0"
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
                          )}

                          <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2 sm:pt-0 sm:border-0 w-full sm:w-auto shrink-0">
                            <button
                              onClick={() => handleEditAppointment(app)}
                              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-90 flex-1 sm:flex-initial flex items-center justify-center border-0"
                              title="Editar agendamento"
                            >
                              <Edit2 size={13} className="mr-1 sm:mr-0" />
                              <span className="sm:hidden text-xs">Editar</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAppointment(app.id)}
                              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer active:scale-90 flex-1 sm:flex-initial flex items-center justify-center border-0"
                              title="Excluir agendamento"
                            >
                              <Trash2 size={13} className="mr-1 sm:mr-0" />
                              <span className="sm:hidden text-xs">Excluir</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={item.id} className="relative group">
                      <div className="absolute -left-[25px] sm:-left-[39px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-[#050505] shadow-md bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />

                      <div className="bg-purple-500/[0.02] border border-purple-500/10 hover:border-purple-500/20 rounded-2xl p-5 transition-all space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/10 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-purple-400 font-mono flex items-center gap-1.5 bg-purple-500/10 px-2.5 py-1 rounded-lg">
                              <Clock size={12} />
                              {item.time}
                            </span>
                            <h3 className="text-xs font-black text-purple-300 tracking-wide uppercase">Serviço Coletivo</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-300">{item.serviceName}</span>
                            <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 text-[10px] text-purple-400 rounded-md font-black uppercase tracking-wider">
                              {item.appointments.length} de {item.service?.capacity || 1} vagas
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {item.appointments.map((app: any) => (
                            <div key={app.id} className="p-4 bg-black/40 border border-white/5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-white text-sm">{app.clientName}</h4>
                                  {app.paymentStatus === 'signal_pending' && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                                      SINAL PENDENTE (R$ {app.pixSignalAmount?.toFixed(2).replace('.', ',')})
                                    </span>
                                  )}
                                  {app.paymentStatus === 'signal_paid' && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-sky-500/20 text-sky-400 border-sky-500/30">
                                      SINAL PAGO
                                    </span>
                                  )}
                                  {app.paymentStatus !== 'signal_pending' && app.paymentStatus !== 'signal_paid' && (
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                      app.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    }`}>
                                      {app.paymentStatus === 'paid' ? 'PAGO' : 'NÃO PAGO'}
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                    app.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                    app.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                    app.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' :
                                    app.status === 'created' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                    'bg-sky-500/20 text-sky-400 border-sky-500/30'
                                  }`}>
                                    {app.status === 'completed' ? 'CONCLUÍDO' :
                                     app.status === 'cancelled' ? 'CANCELADO' :
                                     app.status === 'pending' ? 'PENDENTE CONFIRMAÇÃO' :
                                     app.status === 'created' ? 'AGENDADO' : 'CONFIRMADO'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  Telefone: <span className="text-gray-300 font-medium font-mono">{app.clientPhone}</span> &bull; 
                                  Valor: <span className="text-gray-300 font-medium">R$ {app.price?.toFixed(2).replace('.', ',')}</span>
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                                {app.clientPhone && (app.status === 'created' || app.status === 'pending') && (
                                  <button
                                    onClick={() => handleOpenWhatsAppModal(app)}
                                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer border-0"
                                    title="Enviar Confirmação"
                                  >
                                    <Phone size={12} />
                                  </button>
                                )}
                                
                                {pixKey && app.paymentStatus !== 'paid' && app.paymentMethod !== 'pacote' && app.status !== 'completed' && app.status !== 'cancelled' && (
                                  <button
                                    onClick={() => handleOpenPixBillingModal(app)}
                                    className="p-2 bg-primary-500/10 hover:bg-primary-500/25 border border-primary-500/20 text-primary-400 rounded-lg text-xs font-bold transition-all cursor-pointer border-0"
                                    title="Cobrar Pix"
                                  >
                                    <DollarSign size={12} />
                                  </button>
                                )}

                                {app.paymentStatus === 'signal_pending' && app.status !== 'completed' && app.status !== 'cancelled' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const docRef = doc(db, 'organizations', orgId, 'appointments', app.id);
                                        await updateDoc(docRef, { paymentStatus: 'signal_paid' });
                                        toast.success('Sinal Pix confirmado com sucesso!');
                                      } catch (err) {
                                        toast.error('Erro ao confirmar sinal.');
                                      }
                                    }}
                                    className="p-2 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 text-sky-400 rounded-lg text-xs font-bold transition-all cursor-pointer border-0"
                                    title="Confirmar Sinal"
                                  >
                                    <Check size={12} />
                                  </button>
                                )}

                                {app.status !== 'completed' && app.status !== 'cancelled' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(app.id, 'completed')}
                                      className="px-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border-0 shadow-md shadow-emerald-500/10"
                                      title="Finalizar"
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(app.id, 'cancelled')}
                                      className="p-2 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer border-0"
                                      title="Cancelar"
                                    >
                                      <X size={12} />
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => handleEditAppointment(app)}
                                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg transition-all cursor-pointer border-0"
                                  title="Editar"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteAppointment(app.id)}
                                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all cursor-pointer border-0"
                                  title="Excluir"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-400 uppercase tracking-widest pb-2 border-b border-white/5">
                {weekDaysShort.map((day) => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {generateCalendarDays().map((cell, index) => {
                  if (cell.isPadding) {
                    return (
                      <div 
                        key={`pad-${index}`} 
                        className="aspect-[4/3] md:aspect-video bg-white/[0.01] border border-white/[0.02] rounded-xl opacity-30" 
                      />
                    );
                  }

                  const stats = getDayStats(cell.dateStr);
                  const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
                  const isSelected = cell.dateStr === selectedDate;
                  
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateStr);
                        setTimelineView('daily');
                      }}
                      className={`aspect-[4/3] md:aspect-video p-2 rounded-xl border flex flex-col justify-between transition-all text-left relative overflow-hidden group cursor-pointer ${
                        isSelected 
                          ? 'bg-primary-500/10 border-primary-500/40 shadow-[0_0_15px_rgba(249,115,22,0.1)]' 
                          : isToday
                            ? 'bg-white/5 border-primary-400/30'
                            : 'bg-black/20 hover:bg-white/[0.04] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs md:text-sm font-black ${
                          isSelected 
                            ? 'text-primary-400 font-black' 
                            : isToday
                              ? 'text-primary-300 font-bold'
                              : 'text-gray-300 group-hover:text-white'
                        }`}>
                          {cell.dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-primary-400 px-1.5 py-0.5 rounded bg-primary-500/10 border border-primary-500/20">
                            Hoje
                          </span>
                        )}
                      </div>

                      {stats.total > 0 ? (
                        <div className="space-y-1 mt-auto">
                          <div className="hidden md:flex flex-wrap gap-1">
                            {stats.confirmed > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {stats.confirmed} C
                              </span>
                            )}
                            {stats.pending > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                {stats.pending} P
                              </span>
                            )}
                            {stats.scheduled > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {stats.scheduled} A
                              </span>
                            )}
                          </div>
                          
                          <div className="flex md:hidden items-center gap-1 mt-1 justify-center">
                            {Array.from({ length: Math.min(stats.total, 4) }).map((_, i) => {
                              let colorClass = 'bg-primary-500';
                              if (i < stats.pending) colorClass = 'bg-amber-500 animate-pulse';
                              else if (i < stats.pending + stats.confirmed) colorClass = 'bg-emerald-500';
                              else colorClass = 'bg-blue-500';
                              return (
                                <span key={i} className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
                              );
                            })}
                            {stats.total > 4 && (
                              <span className="text-[8px] font-bold text-gray-500">+{stats.total - 4}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-600 font-semibold italic mt-auto hidden md:inline">
                          Livre
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-white/5 text-[11px] text-gray-400 justify-end">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Confirmado (C)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pendente (P)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Agendado (A)
                </span>
              </div>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duração</label>
                  <CustomSelect
                    value={serviceDuration}
                    onChange={(val) => setServiceDuration(Number(val))}
                    options={[
                      { value: 15, label: '15 min' },
                      { value: 30, label: '30 min' },
                      { value: 45, label: '45 min' },
                      { value: 60, label: '60 min' },
                      { value: 90, label: '90 min' },
                      { value: 120, label: '120 min' }
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preço (R$)</label>
                  <input
                    type="text"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    placeholder="Ex: 85,00"
                    className="w-full px-3 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider" title="Vagas por horário. Use 1 para serviços individuais.">Vagas</label>
                  <input
                    type="number"
                    min="1"
                    value={serviceCapacity}
                    onChange={(e) => setServiceCapacity(Math.max(1, Number(e.target.value)))}
                    placeholder="Ex: 1"
                    className="w-full px-3 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Configuração de Sinal Pix Específico do Serviço */}
              <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Exigir Sinal Pix</span>
                  <input
                    type="checkbox"
                    checked={servicePixRequired}
                    onChange={(e) => setServicePixRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 text-primary-500 bg-black/40 focus:ring-primary-500 focus:ring-offset-black cursor-pointer"
                  />
                </div>
                {servicePixRequired && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Valor do Sinal (R$)</label>
                    <input
                      type="text"
                      value={servicePixAmount}
                      onChange={(e) => setServicePixAmount(e.target.value)}
                      placeholder="Ex: 20,00"
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-lg text-xs outline-none transition-all placeholder-gray-700 font-bold"
                      required={servicePixRequired}
                    />
                    <span className="text-[8px] text-gray-500 block leading-tight">Este valor será cobrado no momento do agendamento público online deste serviço.</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Insumos Utilizados (Opcional)</label>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <CustomSelect
                      value={currentSelectedMaterialId}
                      onChange={(val) => setCurrentSelectedMaterialId(val)}
                      placeholder="Selecionar material..."
                      options={inventory.map(item => ({
                        value: item.id,
                        label: `${item.name} (${item.unit})`
                      }))}
                    />
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
                      setServiceCapacity(1);
                      setServicePixRequired(false);
                      setServicePixAmount('');
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
                      <h4 className="font-bold text-white truncate text-sm flex items-center gap-1.5">
                        {srv.name}
                        {srv.capacity > 1 && (
                          <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-400 rounded-md font-bold shrink-0">
                            Grupo ({srv.capacity} vagas)
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
                        <span>{srv.durationMinutes} min</span> &bull; 
                        <span className="text-primary-400 font-bold">R$ {srv.price?.toFixed(2).replace('.', ',')}</span>
                        {srv.pixRequired && srv.pixAmount > 0 && (
                          <>
                            &bull; 
                            <span className="px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/25 rounded text-[9px] text-orange-400 font-bold font-sans">
                              Sinal Pix: R$ {srv.pixAmount?.toFixed(2).replace('.', ',')}
                            </span>
                          </>
                        )}
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
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-8 animate-in fade-in duration-300">
          
          {/* Menu Horizontal de Sub-Abas de Configuração */}
          <div className="flex border-b border-white/10 gap-2 md:gap-4 overflow-x-auto pb-px scrollbar-none">
            <button
              type="button"
              onClick={() => setSettingsSubTab('hours')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs md:text-sm font-bold transition-all whitespace-nowrap relative border-0 bg-transparent cursor-pointer ${
                settingsSubTab === 'hours' ? 'border-primary-500 text-primary-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Clock size={16} />
              <span>Horários de Atendimento</span>
              {settingsSubTab === 'hours' && (
                <motion.div layoutId="activeSettingsSubTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsSubTab('rules')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs md:text-sm font-bold transition-all whitespace-nowrap relative border-0 bg-transparent cursor-pointer ${
                settingsSubTab === 'rules' ? 'border-primary-500 text-primary-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Settings size={16} />
              <span>Regras e Rótulos</span>
              {settingsSubTab === 'rules' && (
                <motion.div layoutId="activeSettingsSubTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsSubTab('biosite')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs md:text-sm font-bold transition-all whitespace-nowrap relative border-0 bg-transparent cursor-pointer ${
                settingsSubTab === 'biosite' ? 'border-primary-500 text-primary-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Globe size={16} />
              <span>Mini-Site / Bio</span>
              {settingsSubTab === 'biosite' && (
                <motion.div layoutId="activeSettingsSubTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsSubTab('packages')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs md:text-sm font-bold transition-all whitespace-nowrap relative border-0 bg-transparent cursor-pointer ${
                settingsSubTab === 'packages' ? 'border-primary-500 text-primary-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Scissors size={16} />
              <span>Pacotes de Clientes</span>
              {settingsSubTab === 'packages' && (
                <motion.div layoutId="activeSettingsSubTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsSubTab('fidelity')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs md:text-sm font-bold transition-all whitespace-nowrap relative border-0 bg-transparent cursor-pointer ${
                settingsSubTab === 'fidelity' ? 'border-primary-500 text-primary-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Award size={16} />
              <span>Clube de Fidelidade</span>
              {settingsSubTab === 'fidelity' && (
                <motion.div layoutId="activeSettingsSubTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsSubTab('pix')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs md:text-sm font-bold transition-all whitespace-nowrap relative border-0 bg-transparent cursor-pointer ${
                settingsSubTab === 'pix' ? 'border-primary-500 text-primary-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <DollarSign size={16} />
              <span>Pagamentos / Pix</span>
              {settingsSubTab === 'pix' && (
                <motion.div layoutId="activeSettingsSubTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={settingsSubTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="relative w-full"
            >
              {settingsSubTab === 'hours' && (
                <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="text-primary-400" size={20} />
                  Expediente Comercial
                </h2>
                <p className="text-xs text-gray-400">Configure os horários em que seu estabelecimento está aberto e aceita novos agendamentos.</p>
              </div>
              {!isEditingHours ? (
                <button
                  type="button"
                  onClick={() => {
                    setHoursBackup(JSON.parse(JSON.stringify(expediente.businessHours || {})));
                    setIsEditingHours(true);
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-primary-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Edit2 size={12} />
                  <span>Editar Horários</span>
                </button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveHours}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check size={12} />
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpediente({ ...expediente, businessHours: hoursBackup });
                      setIsEditingHours(false);
                    }}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
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
                  <div key={day} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl gap-3 transition-colors ${dayConfig.active ? 'bg-black/20 border-white/5' : 'bg-black/10 border-white/5 opacity-50'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={dayConfig.active}
                        disabled={!isEditingHours}
                        onChange={(e) => {
                          const newConfig = { ...expediente };
                          newConfig.businessHours[day].active = e.target.checked;
                          setExpediente(newConfig);
                        }}
                        className="w-4 h-4 rounded border-white/10 text-primary-500 bg-black/40 focus:ring-primary-500 focus:ring-offset-black disabled:opacity-50"
                      />
                      <span className="text-xs font-bold text-white w-28">{translate[day] || day}</span>
                    </div>

                    {dayConfig.active ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayConfig.open}
                          disabled={!isEditingHours}
                          onChange={(e) => {
                            const newConfig = { ...expediente };
                            newConfig.businessHours[day].open = e.target.value;
                            setExpediente(newConfig);
                          }}
                          className="px-3 py-1.5 bg-black/40 border border-white/10 text-white rounded-lg text-xs outline-none font-mono disabled:opacity-50"
                        />
                        <span className="text-xs text-gray-500">às</span>
                        <input
                          type="time"
                          value={dayConfig.close}
                          disabled={!isEditingHours}
                          onChange={(e) => {
                            const newConfig = { ...expediente };
                            newConfig.businessHours[day].close = e.target.value;
                            setExpediente(newConfig);
                          }}
                          className="px-3 py-1.5 bg-black/40 border border-white/10 text-white rounded-lg text-xs outline-none font-mono disabled:opacity-50"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Fechado / Sem expediente</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Seção 2: Regras e Nomenclatura */}
        {settingsSubTab === 'rules' && (
          <>
            <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Scissors className="text-primary-400" size={16} />
                  Regras e Nomenclatura
                </h3>
                <p className="text-xs text-gray-400">Defina o intervalo entre slots de horários e as nomenclaturas singular/plural usadas no portal.</p>
              </div>
              {!isEditingNomenclature ? (
                <button
                  type="button"
                  onClick={() => {
                    setNomenclatureBackup({
                      slotIntervalMinutes: expediente.slotIntervalMinutes || 30,
                      appointmentLabelSingular: expediente.appointmentLabelSingular || 'Agendamento',
                      appointmentLabelPlural: expediente.appointmentLabelPlural || 'Agendamentos',
                      cancelTermsEnabled,
                      cancelTermsText
                    });
                    setIsEditingNomenclature(true);
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-primary-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Edit2 size={12} />
                  <span>Editar Configurações</span>
                </button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveNomenclature}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check size={12} />
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpediente({
                        ...expediente,
                        slotIntervalMinutes: nomenclatureBackup.slotIntervalMinutes,
                        appointmentLabelSingular: nomenclatureBackup.appointmentLabelSingular,
                        appointmentLabelPlural: nomenclatureBackup.appointmentLabelPlural
                      });
                      setCancelTermsEnabled(nomenclatureBackup.cancelTermsEnabled);
                      setCancelTermsText(nomenclatureBackup.cancelTermsText);
                      setIsEditingNomenclature(false);
                    }}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Intervalo entre {labelPlural}</label>
                <CustomSelect
                  value={expediente.slotIntervalMinutes || 30}
                  disabled={!isEditingNomenclature}
                  onChange={(val) => setExpediente({ ...expediente, slotIntervalMinutes: Number(val) })}
                  options={[
                    { value: 15, label: '15 minutos' },
                    { value: 30, label: '30 minutos' },
                    { value: 45, label: '45 minutos' },
                    { value: 60, label: '60 minutos' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Rótulo Singular (ex: Proposta)</label>
                <input
                  type="text"
                  placeholder="Ex: Agendamento, Proposta..."
                  value={expediente.appointmentLabelSingular || ''}
                  disabled={!isEditingNomenclature}
                  onChange={(e) => setExpediente({ ...expediente, appointmentLabelSingular: e.target.value })}
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Rótulo Plural (ex: Propostas)</label>
                <input
                  type="text"
                  placeholder="Ex: Agendamentos, Propostas..."
                  value={expediente.appointmentLabelPlural || ''}
                  disabled={!isEditingNomenclature}
                  onChange={(e) => setExpediente({ ...expediente, appointmentLabelPlural: e.target.value })}
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 max-w-2xl">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={expediente.packagesActive || false}
                  disabled={!isEditingNomenclature}
                  onChange={(e) => setExpediente({ ...expediente, packagesActive: e.target.checked })}
                  className="rounded border-white/15 bg-black/40 text-primary-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs font-semibold text-gray-300">Habilitar Módulo de Pacotes de Clientes</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={cancelTermsEnabled}
                  disabled={!isEditingNomenclature}
                  onChange={(e) => setCancelTermsEnabled(e.target.checked)}
                  className="rounded border-white/15 bg-black/40 text-primary-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs font-semibold text-gray-300">Exigir aceite de Termos de Cancelamento no agendamento público</span>
              </label>

              {cancelTermsEnabled && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200 mt-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Texto da Política de Cancelamento</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Cancelamentos realizados com menos de 24h de antecedência estarão sujeitos a multa de 50% do valor do serviço."
                    value={cancelTermsText}
                    disabled={!isEditingNomenclature}
                    onChange={(e) => setCancelTermsText(e.target.value)}
                    className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 disabled:opacity-50 resize-none font-sans"
                  />
                </div>
              )}
            </div>
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
                    onClick={async () => {
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

                      if (orgId && clientId) {
                        const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
                        const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
                        const currentUser = auth.currentUser;
                        
                        await fetch(`${crmApiUrl}/api/portal_handler`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'update_client',
                            orgId,
                            clientId,
                            token,
                            uid: currentUser?.uid || '',
                            email: currentUser?.email || '',
                            schedulingSettings: {
                              ...expediente,
                              pixKey,
                              pixName,
                              pixCity,
                              pixEnabled,
                              whatsappTemplates: currentTemplates
                            }
                          })
                        });
                      }

                      setWhatsappTemplates(currentTemplates);
                      setTemplateTitle('');
                      setTemplateText('');
                      setEditingTemplateId(null);
                      setIsAddingTemplate(false);
                      toast.success(editingTemplateId ? 'Template atualizado e salvo com sucesso!' : 'Template criado e salvo com sucesso!');
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
                          onClick={async () => {
                            const updatedTemplates = whatsappTemplates.filter(t => t.id !== tpl.id);
                            if (orgId && clientId) {
                              const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
                              const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
                              const currentUser = auth.currentUser;
                              
                              await fetch(`${crmApiUrl}/api/portal_handler`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'update_client',
                                  orgId,
                                  clientId,
                                  token,
                                  uid: currentUser?.uid || '',
                                  email: currentUser?.email || '',
                                  schedulingSettings: {
                                    ...expediente,
                                    pixKey,
                                    pixName,
                                    pixCity,
                                    pixEnabled,
                                    whatsappTemplates: updatedTemplates
                                  }
                                })
                              });
                            }
                            setWhatsappTemplates(updatedTemplates);
                            toast.success('Template excluído e removido com sucesso!');
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
        </>
      )}
        {/* Seção 4: Configuração do Mini-Site (Link da Bio) */}
        {settingsSubTab === 'biosite' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Globe size={14} className="text-primary-400" />
                  Mini-Site / Link da Bio
                </h3>
                <p className="text-xs text-gray-400">Configure sua página de links públicos e de agendamento online externo.</p>
              </div>
              
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const bioUrl = `${window.location.origin}/bio/${orgId}`;
                    navigator.clipboard.writeText(bioUrl);
                    toast.success('Link do Mini-Site copiado para a área de transferência!');
                  }}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy size={12} />
                  <span>Copiar Link</span>
                </button>
                <a
                  href={`/bio/${orgId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Eye size={12} />
                  <span>Visualizar</span>
                </a>
                
                {!isEditingBio ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBioBackup({
                        title: bioTitle,
                        description: bioDescription,
                        avatarUrl: bioAvatarUrl,
                        links: JSON.parse(JSON.stringify(bioLinks)),
                        showBooking: bioShowBooking
                      });
                      setIsEditingBio(true);
                    }}
                    className="px-4 py-2 bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-primary-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Edit2 size={12} />
                    <span>Editar Bio</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBioSite}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check size={12} />
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBioTitle(bioBackup.title);
                        setBioDescription(bioBackup.description);
                        setBioAvatarUrl(bioBackup.avatarUrl);
                        setBioLinks(bioBackup.links);
                        setBioShowBooking(bioBackup.showBooking);
                        setIsEditingBio(false);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isEditingBio ? (
              <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Título da Bio / Nome da Empresa</label>
                      <input
                        type="text"
                        value={bioTitle}
                        onChange={(e) => setBioTitle(e.target.value)}
                        placeholder="Ex: Barbearia do Zé"
                        className="w-full px-3 py-2.5 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição Curta</label>
                      <textarea
                        value={bioDescription}
                        onChange={(e) => setBioDescription(e.target.value)}
                        placeholder="Escreva uma breve apresentação..."
                        rows={3}
                        className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Logotipo / Avatar da Empresa</label>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-black/30 border border-white/10 rounded-2xl">
                        {/* Preview */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black/50 flex items-center justify-center shrink-0">
                          {isUploadingLogo ? (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-15">
                              <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
                            </div>
                          ) : null}
                          
                          {bioAvatarUrl ? (
                            <img src={bioAvatarUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Globe className="w-6 h-6 text-gray-600" />
                          )}
                        </div>

                        {/* Botão de Upload e URL Input */}
                        <div className="flex-1 space-y-2 w-full">
                          <div className="flex gap-2">
                            <label className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none">
                              <Upload size={14} className="text-primary-400" />
                              <span>{isUploadingLogo ? 'Carregando...' : 'Enviar Imagem (Logo)'}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleLogoUpload} 
                                className="hidden" 
                                disabled={isUploadingLogo || !isEditingBio}
                              />
                            </label>
                            
                            {bioAvatarUrl && (
                              <button
                                type="button"
                                onClick={() => setBioAvatarUrl('')}
                                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                disabled={isUploadingLogo || !isEditingBio}
                              >
                                Remover
                              </button>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Ou digite a URL da Imagem</span>
                            <input
                              type="text"
                              value={bioAvatarUrl}
                              onChange={(e) => setBioAvatarUrl(e.target.value)}
                              placeholder="https://exemplo.com/sua-logo.png"
                              disabled={isUploadingLogo || !isEditingBio}
                              className="w-full px-3 py-2 bg-black/50 border border-white/10 focus:border-primary-500 text-white rounded-xl text-[10px] outline-none transition-all placeholder-gray-700 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="bioShowBooking"
                        checked={bioShowBooking}
                        onChange={(e) => setBioShowBooking(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 text-primary-500 bg-black/40 focus:ring-primary-500 focus:ring-offset-black"
                      />
                      <label htmlFor="bioShowBooking" className="text-xs font-bold text-white cursor-pointer select-none">
                        Exibir Botão de Agendamento Online Público
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Link size={12} className="text-primary-400" />
                    Gerenciar Links da Bio
                  </h4>

                  {/* Form para adicionar novo link */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Ícone do Link</label>
                      <CustomSelect
                        value={newLinkIcon}
                        onChange={(val) => setNewLinkIcon(val as string)}
                        options={[
                          { value: 'instagram', label: 'Instagram' },
                          { value: 'whatsapp', label: 'WhatsApp' },
                          { value: 'facebook', label: 'Facebook' },
                          { value: 'youtube', label: 'YouTube' },
                          { value: 'website', label: 'Site / Outro' }
                        ]}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Rótulo / Texto do Botão</label>
                      <input
                        type="text"
                        value={newLinkLabel}
                        onChange={(e) => setNewLinkLabel(e.target.value)}
                        placeholder="Ex: Nosso Portfólio"
                        className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1.5">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">URL de Destino</label>
                      <input
                        type="text"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder="Ex: instagram.com/sua-barbearia"
                        className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddBioLink}
                      className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-[38px]"
                    >
                      <Plus size={12} />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {/* Listagem de Links atuais */}
                  <div className="space-y-2 max-w-xl">
                    {bioLinks.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Nenhum link adicionado ainda.</p>
                    ) : (
                      bioLinks.map((link, idx) => {
                        const iconMap: Record<string, React.ReactNode> = {
                          instagram: <Instagram size={14} className="text-pink-400" />,
                          whatsapp: <Phone size={14} className="text-emerald-400" />,
                          facebook: <Facebook size={14} className="text-blue-400" />,
                          youtube: <Youtube size={14} className="text-red-400" />,
                          website: <Globe size={14} className="text-gray-400" />
                        };

                        return (
                          <div key={link.id || idx} className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-xl gap-3">
                            <div className="flex items-center gap-2">
                              {iconMap[link.icon] || <Globe size={14} />}
                              <span className="text-xs font-bold text-white">{link.label}</span>
                              <span className="text-[10px] text-gray-500 truncate max-w-xs">({link.url})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveBioLink(link.id)}
                              className="p-1 hover:bg-white/5 rounded-lg text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-black/20 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
                  <div className="w-16 h-16 bg-white/5 rounded-full overflow-hidden border border-white/10 flex items-center justify-center">
                    {bioAvatarUrl ? (
                      <img src={bioAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Globe size={28} className="text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{bioTitle || 'Sem Título da Bio'}</h4>
                    <p className="text-xs text-gray-500 mt-1">{bioDescription || 'Configure uma breve descrição nas configurações do Mini-Site.'}</p>
                  </div>
                </div>

                <div className="md:col-span-2 bg-black/20 border border-white/5 p-5 rounded-2xl space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Links Ativos ({bioLinks.length})</span>
                  <div className="space-y-2">
                    {bioLinks.map((link, idx) => (
                      <div key={link.id || idx} className="flex items-center gap-2 text-xs text-gray-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                        <span className="font-bold">{link.label}:</span>
                        <span className="text-gray-500 truncate">{link.url}</span>
                      </div>
                    ))}
                    {bioShowBooking && (
                      <div className="flex items-center gap-2 text-xs text-primary-400 font-bold">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                        <span>Agendamento Online Público Ativado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {settingsSubTab === 'packages' && (
          <PortalPackages orgId={orgId} clientId={clientId} />
        )}

        {settingsSubTab === 'fidelity' && (
          <PortalFidelity orgId={orgId} clientId={clientId} />
        )}

        {settingsSubTab === 'pix' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="text-primary-400" size={16} />
                  Configuração de Pagamento via Pix
                </h3>
                <p className="text-xs text-gray-400">Configure sua chave Pix e habilite a exibição do QR Code para pagamentos automáticos dos clientes.</p>
              </div>

              {!isEditingPix ? (
                <button
                  type="button"
                  onClick={() => {
                    setPixBackup({
                      pixKey,
                      pixName,
                      pixCity,
                      pixEnabled,
                      pixRequiredForBooking,
                      pixBookingAmount
                    });
                    setIsEditingPix(true);
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-primary-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 animate-in fade-in"
                >
                  <Edit2 size={12} />
                  <span>Editar Configurações</span>
                </button>
              ) : (
                <div className="flex gap-2 shrink-0 animate-in fade-in">
                  <button
                    type="button"
                    onClick={handleSavePixSettings}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check size={12} />
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPixKey(pixBackup.pixKey);
                      setPixName(pixBackup.pixName);
                      setPixCity(pixBackup.pixCity);
                      setPixEnabled(pixBackup.pixEnabled);
                      setPixRequiredForBooking(pixBackup.pixRequiredForBooking);
                      setPixBookingAmount(pixBackup.pixBookingAmount);
                      setIsEditingPix(false);
                    }}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Chave Pix</label>
                <input
                  type="text"
                  placeholder="E-mail, CPF/CNPJ, Telefone ou Aleatória"
                  value={pixKey}
                  disabled={!isEditingPix}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome do Beneficiário</label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva / Nome da Empresa"
                  value={pixName}
                  disabled={!isEditingPix}
                  onChange={(e) => setPixName(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cidade do Recebedor</label>
                <input
                  type="text"
                  placeholder="Ex: Sao Paulo"
                  value={pixCity}
                  disabled={!isEditingPix}
                  onChange={(e) => setPixCity(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 max-w-2xl">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pixEnabled}
                  disabled={!isEditingPix}
                  onChange={(e) => setPixEnabled(e.target.checked)}
                  className="rounded border-white/15 bg-black/40 text-primary-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs font-semibold text-gray-300">Exibir cobrança Pix nos links públicos (agendamento e confirmação)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={pixRequiredForBooking}
                  disabled={!isEditingPix}
                  onChange={(e) => setPixRequiredForBooking(e.target.checked)}
                  className="rounded border-white/15 bg-black/40 text-primary-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs font-semibold text-gray-300">Exigir pagamento de sinal Pix para novos agendamentos</span>
              </label>

              {pixRequiredForBooking && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200 mt-1 max-w-xs">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Valor do Sinal (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pixBookingAmount || ''}
                      disabled={!isEditingPix}
                      onChange={(e) => setPixBookingAmount(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50 font-semibold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Gerador de Pix Avulso */}
            <div className="border-t border-white/10 my-6 pt-6 animate-in fade-in duration-500">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <Sparkles className="text-primary-400 animate-pulse" size={16} />
                Gerador de Pix Avulso
              </h4>
              <p className="text-xs text-gray-400 mb-6">Gere um QR Code e código Copia e Cola instantaneamente para enviar aos seus clientes pelo WhatsApp a qualquer momento.</p>

              {!pixKey ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5 max-w-2xl">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Chave Pix não configurada:</span> Para utilizar o gerador de Pix, configure e salve sua chave Pix acima primeiro.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
                  {/* Formulário do Pix Avulso */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Valor do Pix (R$)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={customPixAmount}
                          onChange={(e) => handleRecalculateCustomPix(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome do Cliente (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: Maria Souza"
                          value={customPixClientName}
                          onChange={(e) => setCustomPixClientName(e.target.value)}
                          className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">WhatsApp do Cliente</label>
                        <input
                          type="text"
                          placeholder="Ex: (11) 99999-9999"
                          value={customPixPhone}
                          onChange={(e) => setCustomPixPhone(e.target.value)}
                          className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700"
                        />
                      </div>
                    </div>

                    {customPixCode && (
                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleSendCustomPixLinkWhatsApp}
                          disabled={!customPixPhone.trim()}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/20 disabled:text-emerald-500/40 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed border-0"
                        >
                          <Link size={16} />
                          <span>Enviar Link por WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSendCustomPixWhatsApp}
                          disabled={!customPixPhone.trim()}
                          className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-gray-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed border-0"
                        >
                          <Phone size={14} />
                          <span>Enviar Texto (Copia e Cola) no WhatsApp</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* QR Code e Copia e Cola */}
                  <div className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-2xl relative min-h-[250px]">
                    {customPixCode ? (
                      <div className="w-full flex flex-col items-center gap-5">
                        {/* Renderização do QR Code */}
                        <div className="p-3 bg-white rounded-xl shadow-lg">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(customPixCode)}`}
                            alt="QR Code Pix"
                            className="w-[150px] h-[150px] object-contain"
                          />
                        </div>

                        {/* Código Copia e Cola */}
                        <div className="w-full space-y-1.5 font-sans">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block text-center">Pix Copia e Cola</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={customPixCode}
                              className="flex-1 px-3 py-2 bg-black/50 border border-white/10 text-white rounded-lg text-xs outline-none font-mono truncate"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(customPixCode);
                                toast.success('Código Pix copiado!');
                              }}
                              className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer border-0"
                              title="Copiar Código"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          
                          {/* Botão de Copiar Link de Pagamento */}
                          <button
                            type="button"
                            onClick={handleCopyCustomPixLink}
                            className="w-full mt-2 py-2 bg-primary-500/10 hover:bg-primary-500/25 border border-primary-500/20 text-primary-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
                          >
                            <Link size={12} />
                            <span>Copiar Link de Pagamento</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 space-y-2 py-8">
                        <DollarSign className="mx-auto opacity-20 animate-bounce" size={40} />
                        <p className="text-xs">Digite um valor válido para gerar o QR Code Pix.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

            </motion.div>
          </AnimatePresence>

        </div>
      )}

      {/* Modal Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <button
              onClick={closeAppointmentModal}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">
                {editingAppointmentId 
                  ? (isBlocking ? 'Editar Bloqueio' : `Editar ${labelSingular}`) 
                  : (isBlocking ? 'Bloquear Horário' : `Novo(a) ${labelSingular}`)}
              </h3>
              <p className="text-xs text-gray-400">
                {isBlocking 
                  ? 'Indisponibilize um slot específico do seu expediente para outros agendamentos.'
                  : (editingAppointmentId ? `Ajuste os dados salvos do(a) ${labelSingular.toLowerCase()}.` : `Preencha os dados do cliente e selecione o serviço para registrar o(a) ${labelSingular.toLowerCase()}.`)}
              </p>
            </div>

            <form onSubmit={handleSaveAppointment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome do Cliente / Identificador</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                  required
                  disabled={isBlocking}
                />
              </div>

              {!isBlocking && (
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
              )}

              {isBlocking ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo de Bloqueio</label>
                  <input
                    type="text"
                    value="Bloqueio de Horário"
                    disabled
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 text-gray-500 rounded-xl text-sm outline-none font-bold"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Serviço Ofertado</label>
                  <CustomSelect
                    value={newServiceId}
                    onChange={(val) => handleServiceChange(val)}
                    placeholder="Selecione um serviço..."
                    options={services.map(s => ({
                      value: s.id,
                      label: `${s.name} (R$ ${s.price})`
                    }))}
                  />
                </div>
              )}

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
                  <CustomSelect
                    value={newTime}
                    onChange={(val) => setNewTime(val)}
                    placeholder="Selecione o horário..."
                    options={[
                      ...(newDate ? getAvailableTimeSlots(newDate, isBlocking ? 'bloqueio' : newServiceId).map(slot => ({ value: slot, label: slot })) : []),
                      ...(editingAppointmentId && newTime && newDate && !getAvailableTimeSlots(newDate, isBlocking ? 'bloqueio' : newServiceId).includes(newTime) 
                        ? [{ value: newTime, label: `${newTime} (Atual)` }] 
                        : [])
                    ]}
                  />
                </div>
              </div>

              {!isBlocking && expediente.packagesActive && (
                <div className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Forma de Pagamento</label>
                    <CustomSelect
                      value={newPaymentMethod}
                      onChange={(val) => {
                        setNewPaymentMethod(val as any);
                        if (val === 'pacote') {
                          setNewPrice('0,00');
                        } else {
                          if (newServiceId) {
                            const srv = services.find(s => s.id === newServiceId);
                            if (srv) setNewPrice(srv.price?.toString().replace('.', ',') || '');
                          }
                        }
                      }}
                      options={[
                        { value: 'dinheiro_pix_cartao', label: 'DINHEIRO / PIX / CARTÃO' },
                        { value: 'pacote', label: 'USAR SALDO DE PACOTE' }
                      ]}
                    />
                  </div>

                  {newPaymentMethod === 'pacote' && (
                    <div className="space-y-1 animate-in fade-in duration-200">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Selecionar Pacote do Cliente</label>
                      {(() => {
                        const cleanedPhone = newClientPhone.replace(/\D/g, '');
                        const activePkgs = clientPackages.filter(p => 
                          (p.clientPhone === cleanedPhone || p.clientName.toLowerCase() === newClientName.toLowerCase().trim()) && 
                          p.usedSessions < p.totalSessions &&
                          p.serviceId === newServiceId
                        );

                        if (activePkgs.length === 0) {
                          return (
                            <p className="text-[11px] text-amber-400 font-semibold italic bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 mt-1">
                              Nenhum pacote ativo com créditos disponível para este cliente e serviço. Lance um pacote nas configurações primeiro.
                            </p>
                          );
                        }

                        return (
                          <CustomSelect
                            value={selectedPackageId}
                            onChange={(val) => setSelectedPackageId(val)}
                            placeholder="Selecione o pacote..."
                            options={activePkgs.map(p => ({
                              value: p.id,
                              label: `${p.clientName} - Saldo: ${p.totalSessions - p.usedSessions} sessões`
                            }))}
                          />
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {!isBlocking && newPaymentMethod !== 'pacote' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor Cobrado (R$)</label>
                    <input
                      type="text"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="Ex: 150,00"
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 font-bold font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status do Pagamento</label>
                    <CustomSelect
                      value={newPaymentStatus}
                      onChange={(val) => setNewPaymentStatus(val as 'unpaid' | 'paid')}
                      options={[
                        { value: 'unpaid', label: 'PENDENTE' },
                        { value: 'paid', label: 'PAGO' }
                      ]}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmittingAppointment}
                  className="flex-1 py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-600/50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-primary-500/10 flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  {isSubmittingAppointment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{editingAppointmentId ? 'Salvar Alterações' : (isBlocking ? 'Confirmar Bloqueio' : (labelSingular === 'Proposta' ? 'Criar Proposta' : 'Agendar Cliente'))}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeAppointmentModal}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
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
                <CustomSelect
                  value={selectedTemplateId}
                  onChange={(val) => setSelectedTemplateId(val)}
                  options={whatsappTemplates.map(t => ({
                    value: t.id,
                    label: t.title || t.id
                  }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visualização do Envio</label>
                <div className="p-4 bg-[#0b141a] border border-[#202c33] rounded-2xl text-sm text-[#e9edef] whitespace-pre-wrap font-sans relative shadow-inner">
                  {/* Balão estilo WhatsApp */}
                  <div className="bg-[#005c4b] p-3 rounded-2xl rounded-tr-none text-white max-w-[90%] ml-auto relative">
                    <p className="text-sm leading-relaxed break-all">
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

      {/* Modal de Cobrança Pix do Profissional */}
      {isPixBillingModalOpen && activeAppointmentForPix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-300 text-left">
            <button
              onClick={() => setIsPixBillingModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">
                Cobrança via Pix
              </h3>
              <p className="text-xs text-gray-400">
                Gere o Pix para o cliente *{activeAppointmentForPix.clientName}*.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Valor do Pagamento (R$)</label>
                <input
                  type="text"
                  value={pixBillingAmount}
                  onChange={(e) => handleRecalculatePixCode(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all font-mono font-black"
                />
              </div>

              {generatedPixCode ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* QR Code Container */}
                  <div className="bg-white p-3 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center border border-white/10 shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedPixCode)}`}
                      alt="Pix QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Pix Copia e Cola */}
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pix Copia e Cola</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedPixCode}
                        className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-white text-[10px] font-mono rounded-xl outline-none select-all truncate"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPixCode);
                          toast.success('Código Pix copiado!');
                        }}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-0 shrink-0"
                      >
                        Copiar
                      </button>
                    </div>
                    
                    {/* Botão de Copiar Link de Pagamento no Modal */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!pixKey) return;
                        const parsedAmount = parseFloat(pixBillingAmount.replace(/\./g, '').replace(',', '.'));
                        const amountVal = isNaN(parsedAmount) || parsedAmount <= 0 ? 0 : parsedAmount;
                        
                        const baseUrl = window.location.origin;
                        const link = `${baseUrl}/pagar-pix?key=${encodeURIComponent(pixKey)}&name=${encodeURIComponent(pixName || 'Empresa')}&city=${encodeURIComponent(pixCity || 'Sao Paulo')}&amount=${amountVal}&txid=${activeAppointmentForPix.id ? activeAppointmentForPix.id.substring(0, 25) : '***'}`;
                        
                        navigator.clipboard.writeText(link);
                        toast.success('Link de pagamento copiado!');
                      }}
                      className="w-full mt-2 py-2 bg-primary-500/10 hover:bg-primary-500/25 border border-primary-500/20 text-primary-400 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
                    >
                      <Link size={10} />
                      <span>Copiar Link de Pagamento</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400 italic bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                  Cadastre sua chave Pix nas configurações da agenda para poder gerar cobranças.
                </p>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={!generatedPixCode}
                  onClick={handleSendPixLinkWhatsAppMessage}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
                >
                  <Link size={14} />
                  <span>Enviar Link por WhatsApp</span>
                </button>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!generatedPixCode}
                    onClick={handleSendPixWhatsAppMessage}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
                  >
                    <Phone size={12} />
                    <span>Texto Copia/Cola</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPixBillingModalOpen(false)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer border-0"
                  >
                    Fechar
                  </button>
                </div>
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
