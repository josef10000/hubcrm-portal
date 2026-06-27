import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { 
  Users, Search, Plus, Phone, Mail, Calendar, FileText, Settings, Trash2, Save, X, Edit2, AlertCircle, Printer, Eye 
} from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import ConfirmModal from '../components/ConfirmModal';

interface PortalClientsProps {
  orgId: string;
  clientId: string;
  client?: any;
}

export default function PortalClients({ orgId, clientId, client }: PortalClientsProps) {
  // Sub-aba ativa na visualização de prontuários do card de detalhes do cliente
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'records' | 'appointments'>('info');

  // Listas de Dados do Firestore
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clientRecords, setClientRecords] = useState<any[]>([]);
  const [customFieldsDef, setCustomFieldsDef] = useState<any[]>([]);
  const [deletedClientsPhones, setDeletedClientsPhones] = useState<string[]>([]);
  const [schedulingSettingsObj, setSchedulingSettingsObj] = useState<any>({});
  
  // Lista Consolidada Reativa
  const [consolidatedClients, setConsolidatedClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Modais
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isFieldsModalOpen, setIsFieldsModalOpen] = useState(false);

  // Form de Cadastro Rápido de Cliente
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);

  // Form de Novo Campo Personalizado
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');
  const [isSavingField, setIsSavingField] = useState(false);

  // Estado dos Valores dos Campos Extras no Card Selecionado
  const [tempCustomValues, setTempCustomValues] = useState<Record<string, string>>({});
  const [isSavingCustomValues, setIsSavingCustomValues] = useState(false);

  // Registro selecionado para visualização/impressão de prontuário
  const [printingRecord, setPrintingRecord] = useState<any | null>(null);

  // Confirmações de Exclusão com Modais Próprios
  const [deleteClientConfirm, setDeleteClientConfirm] = useState<{
    isOpen: boolean;
    client: any | null;
  }>({ isOpen: false, client: null });

  const [deleteFieldConfirm, setDeleteFieldConfirm] = useState<{
    isOpen: boolean;
    fieldId: string | null;
  }>({ isOpen: false, fieldId: null });

  // 1. Escuta antiga de clientes comuns desativada (unificado em client_records)

  // 2. Escutar agendamentos da organização (appointments)
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'appointments');
    const q = query(ref, orderBy('time', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    }, (error) => {
      console.error("Erro ao escutar agendamentos:", error);
    });
    return () => unsub();
  }, [orgId]);

  // 3. Escutar registros preenchidos (client_records)
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'client_records');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientRecords(list);
    }, (error) => {
      console.error("Erro ao escutar prontuários:", error);
    });
    return () => unsub();
  }, [orgId]);

  // 4. Escutar definições de campos customizados e lista de deletados do perfil do profissional logado
  useEffect(() => {
    if (!orgId || !clientId) return;
    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const sched = data.schedulingSettings || {};
        setSchedulingSettingsObj(sched);
        const list = sched.customClientFieldsDef || [];
        // Ordena por data de criação para manter a ordem consistente
        const sortedList = [...list].sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        setCustomFieldsDef(sortedList);
        setDeletedClientsPhones(sched.deletedClientsPhones || []);
      }
    }, (error) => {
      console.error("Erro ao escutar dados do perfil:", error);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // 5. Consolidar Lista de Clientes (Reativa e Sem Duplicações)
  useEffect(() => {
    const clientsMap = new Map<string, any>();

    const manualClientsList = clientRecords.filter(r => r.type === 'manual_client');

    // A. Adicionar todos os clientes cadastrados fisicamente no banco manual de client_records
    manualClientsList.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanPhone) {
        clientsMap.set(cleanPhone, {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          email: c.email || '',
          customFields: c.customFields || {},
          source: 'db', // Identifica se já tem documento físico
          rawDoc: c
        });
      }
    });

    // B. Mesclar / Adicionar clientes que aparecem nos agendamentos
    appointments.forEach(app => {
      if (app.clientPhone && app.clientName && app.serviceId !== 'bloqueio') {
        const cleanPhone = (app.clientPhone || '').replace(/\D/g, '');
        if (cleanPhone) {
          const existing = clientsMap.get(cleanPhone);
          if (!existing) {
            // Cliente inédito vindo de agendamento automático
            clientsMap.set(cleanPhone, {
              id: `appt-${cleanPhone}`,
              name: app.clientName,
              phone: app.clientPhone,
              email: app.clientEmail || '',
              customFields: {},
              source: 'appointment',
              rawDoc: app
            });
          }
        }
      }
    });

    const sorted = Array.from(clientsMap.values())
      .filter(c => {
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        return !deletedClientsPhones.includes(cleanPhone);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setConsolidatedClients(sorted);

    // Se houver um cliente selecionado, atualiza seu estado para refletir mudanças do snap
    if (selectedClientId) {
      const updatedSelect = sorted.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientId);
      if (updatedSelect) {
        setTempCustomValues(updatedSelect.customFields || {});
      }
    }
  }, [clientRecords, appointments, selectedClientId, deletedClientsPhones]);

  // Filtrar Lista de Clientes com base na Pesquisa
  const filteredClients = consolidatedClients.filter(c => {
    const queryStr = searchQuery.toLowerCase();
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    return c.name.toLowerCase().includes(queryStr) || cleanPhone.includes(queryStr);
  });

  // Cliente selecionado atualmente
  const currentClient = consolidatedClients.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientId);

  // Prontuários e Agendamentos vinculados ao cliente selecionado (filtrando metadados de cadastro)
  const currentClientRecords = selectedClientId 
    ? clientRecords.filter(r => r.clientId === selectedClientId && r.type !== 'manual_client') 
    : [];
  const currentClientAppointments = selectedClientId 
    ? appointments.filter(app => app.clientPhone && (app.clientPhone || '').replace(/\D/g, '') === selectedClientId) 
    : [];

  // Salvar Novo Cliente ou Editar
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Nome e Telefone são obrigatórios.');
      return;
    }

    setIsSavingClient(true);
    try {
      const cleanPhone = clientPhone.replace(/\D/g, '');
      const docId = `client_metadata_${cleanPhone}`;

      const payload = {
        id: docId,
        type: 'manual_client',
        name: clientName.trim(),
        phone: clientPhone.trim(),
        email: clientEmail.trim(),
        updatedAt: serverTimestamp()
      };

      if (editingClient) {
        // Editando cliente do banco manual via Firestore em client_records
        await setDoc(doc(db, 'organizations', orgId, 'client_records', editingClient.id), payload, { merge: true });
        toast.success('Cadastro do cliente atualizado com sucesso!');
      } else {
        // Criando novo cliente do zero via Firestore em client_records
        // Verifica se já existe esse telefone no banco manual para evitar duplicar
        const manualClientsList = clientRecords.filter(r => r.type === 'manual_client');
        const alreadyExists = manualClientsList.some(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (alreadyExists) {
          toast.error('Já existe um cliente cadastrado com esse telefone.');
          setIsSavingClient(false);
          return;
        }

        await setDoc(doc(db, 'organizations', orgId, 'client_records', docId), {
          ...payload,
          customFields: {},
          createdAt: serverTimestamp()
        });

        setSelectedClientId(cleanPhone);
        toast.success('Cliente cadastrado com sucesso!');
      }

      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setEditingClient(null);
      setIsClientModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cadastro do cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  // Excluir cliente físico do banco de dados (se possível) e ocultá-lo da listagem
  const executeDeleteClient = async (client: any) => {
    try {
      const cleanPhone = (client.phone || '').replace(/\D/g, '');

      if (client.source === 'db') {
        // Exclui o documento da coleção client_records
        await deleteDoc(doc(db, 'organizations', orgId, 'client_records', client.id));
      }

      // Adiciona o telefone na lista de excluídos para ocultar da listagem
      if (cleanPhone) {
        const updatedDeletedPhones = [...deletedClientsPhones, cleanPhone];
        await syncDeletedClientsPhones(updatedDeletedPhones);
      }

      toast.success('Cliente removido com sucesso!');

      if (selectedClientId === cleanPhone) {
        setSelectedClientId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir cliente.');
    }
  };

  // Sincronizar definições de campos personalizados com o backend (dentro de schedulingSettings)
  const syncCustomClientFieldsDef = async (fields: any[]) => {
    if (!orgId || !clientId) return;
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
          ...schedulingSettingsObj,
          customClientFieldsDef: fields
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao sincronizar campos personalizados.');
    }
  };

  // Sincronizar telefones de clientes deletados com o backend (dentro de schedulingSettings)
  const syncDeletedClientsPhones = async (phones: string[]) => {
    if (!orgId || !clientId) return;
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
          ...schedulingSettingsObj,
          deletedClientsPhones: phones
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao sincronizar lista de exclusão.');
    }
  };

  // Salvar valores dos campos customizados (CRM)
  const handleSaveCustomValues = async () => {
    if (!currentClient) return;

    setIsSavingCustomValues(true);
    try {
      const cleanPhone = (currentClient.phone || '').replace(/\D/g, '');
      const docId = `client_metadata_${cleanPhone}`;
      const payload = {
        id: docId,
        type: 'manual_client',
        name: currentClient.name,
        phone: currentClient.phone,
        email: currentClient.email || '',
        customFields: tempCustomValues,
        updatedAt: serverTimestamp()
      };

      // Grava diretamente na coleção client_records
      await setDoc(doc(db, 'organizations', orgId, 'client_records', docId), payload, { merge: true });

      toast.success('Informações do cliente salvas com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar campos personalizados.');
    } finally {
      setIsSavingCustomValues(false);
    }
  };

  // Adicionar Definição de Campo Customizado
  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim() || !clientId) {
      toast.error('Dê um nome/rótulo para o campo.');
      return;
    }

    setIsSavingField(true);
    try {
      const newField = {
        id: 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        label: newFieldLabel.trim(),
        type: newFieldType,
        createdAt: new Date().toISOString()
      };

      const updatedFields = [...customFieldsDef, newField];

      await syncCustomClientFieldsDef(updatedFields);

      toast.success(`Campo personalizado "${newFieldLabel}" criado!`);
      setNewFieldLabel('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar campo personalizado.');
    } finally {
      setIsSavingField(false);
    }
  };

  // Inicia exclusão do campo customizado (abre modal próprio)
  const handleDeleteCustomField = (fieldId: string) => {
    setDeleteFieldConfirm({ isOpen: true, fieldId });
  };

  // Efetua a exclusão real
  const executeDeleteCustomField = async (fieldId: string) => {
    if (!clientId) return;
    try {
      const updatedFields = customFieldsDef.filter(f => f.id !== fieldId);
      await syncCustomClientFieldsDef(updatedFields);
      toast.success('Campo personalizado excluído!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir campo personalizado.');
    }
  };

  // Formatar Data para Exibição Amigável
  const formatDateTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toMillis ? new Date(ts.toMillis()) : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Disparar WhatsApp
  const handleWhatsAppClick = (phone: string) => {
    const clean = (phone || '').replace(/\D/g, '');
    if (!clean) return;
    // Garante código de país 55 se o profissional não inseriu
    const fullPhone = clean.length <= 11 ? `55${clean}` : clean;
    window.open(`https://wa.me/${fullPhone}`, '_blank');
  };

  // Impressão A4 de prontuário
  const handlePrint = (record: any) => {
    setPrintingRecord(record);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6 pb-20 select-none text-left relative">
      {/* Contêiner de Impressão A4 Limpo */}
      {printingRecord && (
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black z-[9999] p-10 font-sans" id="print-sheet-clients">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #print-sheet-clients, #print-sheet-clients * {
                visibility: visible;
              }
              #print-sheet-clients {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              @page {
                size: A4;
                margin: 15mm;
              }
            }
          `}</style>
          
          <div className="border-b-2 border-gray-300 pb-5 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Ficha / Prontuário Clínico</h1>
              <p className="text-xs text-gray-500 font-bold mt-1">Preenchido em: {formatDateTime(printingRecord.createdAt)}</p>
            </div>
            <img src="https://i.imgur.com/zCvL7xy.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <p className="text-gray-500 font-bold">CLIENTE / PACIENTE</p>
              <p className="font-black text-sm text-gray-800 uppercase mt-0.5">{printingRecord.clientName}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-gray-500 font-bold">TELEFONE</p>
                <p className="font-mono font-bold text-gray-700 mt-0.5">{printingRecord.clientPhone}</p>
              </div>
              <div>
                <p className="text-gray-500 font-bold">TIPO DE FICHA</p>
                <p className="font-bold text-gray-700 mt-0.5">{printingRecord.templateName}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {printingRecord.responses && Object.entries(printingRecord.responses).map(([fieldId, val]: [string, any]) => {
              // Encontra rótulo
              const templateList = clientRecords.filter(r => r.templateId === printingRecord.templateId);
              let label = fieldId;
              if (templateList.length > 0 && templateList[0].responses) {
                // Tentativa de obter rótulo descritivo do prontuário
                label = printingRecord.templateFields?.find((f: any) => f.id === fieldId)?.label || fieldId;
              }
              return (
                <div key={fieldId} className="border-b border-gray-100 pb-4">
                  <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</h3>
                  <p className="text-sm font-semibold text-gray-800 mt-1 whitespace-pre-wrap">
                    {typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val || '—')}
                  </p>
                </div>
              );
            })}
          </div>
          
          <button 
            onClick={() => setPrintingRecord(null)}
            className="mt-12 px-6 py-2.5 bg-gray-800 text-white font-bold text-xs rounded-xl hover:bg-gray-700 transition-all print:hidden"
          >
            Voltar para o Portal
          </button>
        </div>
      )}

      {/* Título e Ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Módulo de Relacionamento</span>
          <h3 className="text-xl lg:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
            <Users className="text-primary-500" />
            CRM de Clientes
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFieldsModalOpen(true)}
            className="px-4 py-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-[var(--theme-text-secondary)] font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings size={14} />
            Campos Personalizados
          </button>

          <button
            onClick={() => { setEditingClient(null); setClientName(''); setClientPhone(''); setClientEmail(''); setIsClientModalOpen(true); }}
            className="px-5 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-primary-500/10 border-0 cursor-pointer"
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[500px]">
        
        {/* Coluna Esquerda: Pesquisa e Lista */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-2xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-xs font-bold placeholder:text-gray-500"
            />
          </div>

          <div 
            className="flex-1 overflow-y-auto max-h-[600px] rounded-2xl border border-[var(--theme-border)] p-2 space-y-1.5 custom-scrollbar"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            {filteredClients.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs italic">
                Nenhum cliente cadastrado ou agendado.
              </div>
            ) : (
              filteredClients.map((c) => {
                const cleanPhone = (c.phone || '').replace(/\D/g, '');
                const isSelected = selectedClientId === cleanPhone;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedClientId(cleanPhone);
                      setTempCustomValues(c.customFields || {});
                      // Rolagem suave até os detalhes no mobile
                      setTimeout(() => {
                        const detailsElement = document.getElementById('client-details-panel');
                        if (detailsElement) {
                          detailsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    }}
                    className={`p-5 rounded-[2rem] cursor-pointer transition-all duration-300 border text-left relative flex items-center justify-between group shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] select-none ${
                      isSelected 
                        ? 'bg-primary-500/20 border-primary-500/50 translate-x-1 shadow-lg shadow-primary-500/10' 
                        : 'bg-[var(--theme-glass)] border-[var(--theme-border-subtle)] hover:border-[var(--theme-border)] hover:bg-[var(--theme-glass-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500/20 to-blue-500/20 border-2 border-primary-500/30 flex items-center justify-center font-black text-base text-primary-500 shrink-0 uppercase shadow-inner duration-200 group-hover:scale-105">
                        {c.name.substring(0, 2)}
                      </div>
                      <div className="overflow-hidden space-y-1">
                        <p className="text-base md:text-lg font-black tracking-tight truncate leading-tight" style={{ color: 'var(--theme-text-primary)' }}>{c.name}</p>
                        <p className="text-xs md:text-sm text-gray-400 font-bold font-mono tracking-wider truncate flex items-center gap-1.5">
                          <Phone size={11} className="text-gray-500 shrink-0" />
                          {c.phone || 'Sem Telefone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(c.phone); }}
                        className="p-2 hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-500 rounded-xl transition-colors bg-transparent border-0 cursor-pointer"
                        title="Enviar WhatsApp"
                      >
                        <Phone size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteClientConfirm({ isOpen: true, client: c }); }}
                        className="p-2 hover:bg-rose-500/10 text-gray-500 hover:text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all bg-transparent border-0 cursor-pointer"
                        title="Remover Cadastro"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna Direita: Painel de Detalhes */}
        <div className="lg:col-span-7" id="client-details-panel">
          {!currentClient ? (
            <div 
              className="h-full flex flex-col items-center justify-center border border-[var(--theme-border)] rounded-[2rem] p-12 text-center"
              style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
            >
              <Users className="w-12 h-12 text-gray-600 mb-3" strokeWidth={1} />
              <p className="text-xs text-gray-500 font-bold">Selecione um cliente da lista para ver os detalhes, preencher campos de nicho, agendamentos e prontuários.</p>
            </div>
          ) : (
            <div 
              className="border border-[var(--theme-border)] rounded-[2rem] p-6 flex flex-col justify-between h-full space-y-6"
              style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
            >
              
              {/* Header do Detalhe (Nome, Avatar, Contatos Básicos) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--theme-border-subtle)] pb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-lg shadow-primary-500/15">
                    {currentClient.name.substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>{currentClient.name}</h4>
                    <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 rounded-md mt-1 border ${
                      currentClient.source === 'db' 
                        ? 'bg-primary-500/10 border-primary-500/20 text-primary-400' 
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {currentClient.source === 'db' ? 'Cadastrado no CRM' : 'Vindo da Agenda'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingClient(currentClient.rawDoc || currentClient);
                      setClientName(currentClient.name);
                      setClientPhone(currentClient.phone);
                      setClientEmail(currentClient.email || '');
                      setIsClientModalOpen(true);
                    }}
                    className="p-2 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-gray-500 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-transparent cursor-pointer"
                  >
                    <Edit2 size={12} />
                    Editar Cadastro
                  </button>

                  <button
                    onClick={() => handleWhatsAppClick(currentClient.phone)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 border-0 cursor-pointer shadow-md shadow-emerald-700/10"
                  >
                    <Phone size={12} />
                    Chamar WhatsApp
                  </button>
                </div>
              </div>

              {/* Informações de Cadastro Rápido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[var(--theme-glass)] p-3.5 rounded-xl border border-[var(--theme-border-subtle)] space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Telefone</span>
                  <p className="font-mono font-bold" style={{ color: 'var(--theme-text-primary)' }}>{currentClient.phone || 'Não informado'}</p>
                </div>
                <div className="bg-[var(--theme-glass)] p-3.5 rounded-xl border border-[var(--theme-border-subtle)] space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">E-mail</span>
                  <p className="font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>{currentClient.email || 'Não informado'}</p>
                </div>
              </div>

              {/* Abas Internas de Detalhes */}
              <div className="border-b border-[var(--theme-border-subtle)] flex items-center gap-4">
                <button
                  onClick={() => setActiveDetailTab('info')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all bg-transparent border-0 cursor-pointer ${
                    activeDetailTab === 'info' 
                      ? 'border-primary-500 text-primary-500' 
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Campos Customizados
                </button>
                <button
                  onClick={() => setActiveDetailTab('records')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all bg-transparent border-0 cursor-pointer ${
                    activeDetailTab === 'records' 
                      ? 'border-primary-500 text-primary-500' 
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Fichas & Prontuários ({currentClientRecords.length})
                </button>
                <button
                  onClick={() => setActiveDetailTab('appointments')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all bg-transparent border-0 cursor-pointer ${
                    activeDetailTab === 'appointments' 
                      ? 'border-primary-500 text-primary-500' 
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Agendamentos ({currentClientAppointments.length})
                </button>
              </div>

              {/* Conteúdo da Aba Selecionada */}
              <div className="flex-1 min-h-[220px]">
                
                {/* 1. Campos Customizados */}
                {activeDetailTab === 'info' && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ficha de Personalização (Nicho)</span>
                      <button
                        onClick={handleSaveCustomValues}
                        disabled={isSavingCustomValues}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 border-0 cursor-pointer shadow-md shadow-primary-500/10"
                      >
                        <Save size={12} />
                        {isSavingCustomValues ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </div>

                    {customFieldsDef.length === 0 ? (
                      <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-6 rounded-2xl text-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" strokeWidth={1.5} />
                        <p className="text-xs text-gray-500 font-bold">Nenhum campo personalizado cadastrado no seu sistema.</p>
                        <p className="text-[10px] text-gray-500">Crie campos extras de cadastro de acordo com as necessidades do seu nicho (ex: Peso, Bebida Favorita, Altura, Faturamento, Restrições) clicando no botão "Campos Personalizados" no topo.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {customFieldsDef.map((field) => (
                          <div key={field.id} className="space-y-1 text-xs">
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">{field.label}</label>
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                              value={tempCustomValues[field.id] || ''}
                              onChange={(e) => setTempCustomValues({
                                ...tempCustomValues,
                                [field.id]: e.target.value
                              })}
                              placeholder={`Preencha o/a ${field.label}...`}
                              className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Prontuários & Fichas */}
                {activeDetailTab === 'records' && (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {currentClientRecords.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 text-xs italic">
                        Nenhum prontuário ou ficha cadastrada para este cliente.
                      </div>
                    ) : (
                      currentClientRecords.map((rec) => (
                        <div 
                          key={rec.id} 
                          className="p-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-xl flex items-center justify-between hover:bg-[var(--theme-glass-hover)] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="text-left overflow-hidden">
                              <p className="text-xs font-bold text-gray-200 truncate">{rec.templateName}</p>
                              <span className="text-[9px] text-gray-500 font-bold tracking-wider block mt-0.5">
                                {formatDateTime(rec.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePrint(rec)}
                              className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors bg-transparent border-0 cursor-pointer"
                              title="Visualizar / Imprimir"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Agendamentos */}
                {activeDetailTab === 'appointments' && (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {currentClientAppointments.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 text-xs italic">
                        Nenhum agendamento encontrado para este cliente.
                      </div>
                    ) : (
                      currentClientAppointments.map((app) => (
                        <div 
                          key={app.id} 
                          className="p-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-xl flex items-center justify-between hover:bg-[var(--theme-glass-hover)] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                              <Calendar size={16} />
                            </div>
                            <div className="text-left overflow-hidden">
                              <p className="text-xs font-bold text-gray-200 truncate">{app.serviceName || 'Serviço'}</p>
                              <span className="text-[9px] text-gray-500 font-bold block mt-0.5">
                                Data: {formatDateShort(app.date)} às {app.time}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                            app.status === 'Confirmado' 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : app.status === 'Pendente' 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : 'bg-white/5 border-white/10 text-gray-500'
                          }`}>
                            {app.status || 'Agendado'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Cadastro / Edição de Cliente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md rounded-[2.5rem] border border-[var(--theme-border)] p-6 md:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            <button 
              onClick={() => setIsClientModalOpen(false)}
              className="absolute right-6 top-6 p-1.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-gray-400 hover:text-white transition-all bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="space-y-1">
              <span className="text-[9px] text-primary-500 font-bold uppercase tracking-widest block">Portal CRM</span>
              <h4 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>
                {editingClient ? 'Editar Cadastro' : 'Cadastrar Cliente'}
              </h4>
              <p className="text-gray-500 text-xs">Insira os contatos básicos para cadastro no CRM e link com WhatsApp.</p>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Maria Oliveira"
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">WhatsApp (com DDD)</label>
                <input
                  type="text"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">E-mail (opcional)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Ex: cliente@email.com"
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingClient}
                className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-primary-500/10 border-0 cursor-pointer mt-2"
              >
                <Save size={16} />
                {isSavingClient ? 'Salvando...' : 'Salvar Cadastro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Gestão de Campos Personalizados */}
      {isFieldsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-lg rounded-[2.5rem] border border-[var(--theme-border)] p-6 md:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            <button 
              onClick={() => setIsFieldsModalOpen(false)}
              className="absolute right-6 top-6 p-1.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-gray-400 hover:text-white transition-all bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="space-y-1">
              <span className="text-[9px] text-primary-500 font-bold uppercase tracking-widest block">Configuração de Nicho</span>
              <h4 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>Campos Customizados</h4>
              <p className="text-gray-500 text-xs">Crie os campos extras do seu card de cliente para adaptá-lo ao seu nicho de negócio.</p>
            </div>

            {/* Criar Novo Campo */}
            <form onSubmit={handleAddCustomField} className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-end">
              <div className="space-y-1 text-left flex-1 w-full">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Nome do Campo</label>
                <input
                  type="text"
                  required
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="Ex: Peso, Bebida Favorita, Altura"
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>

              <div className="space-y-1 text-left w-full md:w-32">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Tipo</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as any)}
                  className="w-full bg-[var(--theme-select-bg)] border border-[var(--theme-border)] rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-primary-500/50 outline-none cursor-pointer"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSavingField}
                className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 border-0 cursor-pointer shrink-0 w-full md:w-auto"
              >
                <Plus size={14} />
                Criar
              </button>
            </form>

            {/* Lista de Campos Criados */}
            <div className="space-y-2 text-left">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-3">Campos Ativos na Organização</span>
              
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {customFieldsDef.length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-6">Nenhum campo personalizado ativo.</p>
                ) : (
                  customFieldsDef.map((field) => (
                    <div 
                      key={field.id}
                      className="p-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--theme-text-primary)' }}>{field.label}</p>
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">Tipo: {field.type === 'number' ? 'Número' : field.type === 'date' ? 'Data' : 'Texto'}</span>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteCustomField(field.id)}
                        className="p-1.5 hover:bg-rose-500/10 text-gray-500 hover:text-rose-500 rounded-lg transition-colors bg-transparent border-0 cursor-pointer animate-in fade-in"
                        title="Deletar Campo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Cliente */}
      <ConfirmModal
        isOpen={deleteClientConfirm.isOpen}
        title="Confirmar Remoção de Cliente"
        message={`Deseja realmente remover o cliente "${deleteClientConfirm.client?.name}" do cadastro? Isso ocultará o cliente e todo o seu histórico da listagem.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={async () => {
          if (deleteClientConfirm.client) {
            await executeDeleteClient(deleteClientConfirm.client);
          }
          setDeleteClientConfirm({ isOpen: false, client: null });
        }}
        onCancel={() => setDeleteClientConfirm({ isOpen: false, client: null })}
      />

      {/* Modal de Confirmação de Exclusão de Campo Personalizado */}
      <ConfirmModal
        isOpen={deleteFieldConfirm.isOpen}
        title="Confirmar Exclusão de Campo"
        message="Deseja realmente excluir este campo? Os valores já salvos nos clientes continuarão no banco, mas não serão exibidos."
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={async () => {
          if (deleteFieldConfirm.fieldId) {
            await executeDeleteCustomField(deleteFieldConfirm.fieldId);
          }
          setDeleteFieldConfirm({ isOpen: false, fieldId: null });
        }}
        onCancel={() => setDeleteFieldConfirm({ isOpen: false, fieldId: null })}
      />
    </div>
  );
}
