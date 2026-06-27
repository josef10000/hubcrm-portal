import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { 
  Users, Search, Plus, Phone, Mail, Calendar, FileText, Trash2, X, Edit2, AlertCircle, Check, DollarSign, Clock, Tag, User
} from 'lucide-react';
import { toast } from 'sonner';

interface PortalClientsProps {
  orgId: string;
  clientId: string;
  client?: any;
}

export default function PortalClients({ orgId, clientId, client }: PortalClientsProps) {
  // Listas de Dados do Firestore
  const [appointments, setAppointments] = useState<any[]>([]);
  const [deletedClientsPhones, setDeletedClientsPhones] = useState<string[]>([]);
  const [manualClients, setManualClients] = useState<any[]>([]);
  const [customFieldsDef, setCustomFieldsDef] = useState<any[]>([]);
  const [fidelitySettingsObj, setFidelitySettingsObj] = useState<any>({});
  
  // Lista Consolidada Reativa
  const [consolidatedClients, setConsolidatedClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Modais de Cadastro / Edição
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);

  // Estados locais dos formulários de cadastro
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [localCustomFieldsDef, setLocalCustomFieldsDef] = useState<string[]>([]);
  const [modalCustomFields, setModalCustomFields] = useState<Record<string, string>>({});
  
  // Estado para criação rápida de novos campos dinâmicos no modal
  const [newFieldName, setNewFieldName] = useState('');
  const [showAddNewFieldInput, setShowAddNewFieldInput] = useState(false);

  // Modais de confirmação
  const [deleteClientConfirm, setDeleteClientConfirm] = useState<{ isOpen: boolean; client: any | null }>({
    isOpen: false,
    client: null
  });

  // 1. Escutar agendamentos da organização (appointments)
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'appointments');
    const q = query(ref, orderBy('time', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    }, (error) => {
      console.warn("Erro ao escutar agendamentos no PortalClients:", error.message);
    });
    return () => unsub();
  }, [orgId]);

  // 2. Escutar dados do perfil do profissional logado (clientes manuais, deletados e campos customizados de fidelitySettings)
  useEffect(() => {
    if (!orgId || !clientId) return;

    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fid = data.fidelitySettings || {};
        setFidelitySettingsObj(fid);
        setManualClients(fid.crmClients || []);
        setDeletedClientsPhones(fid.crmDeletedPhones || []);

        const list = fid.crmCustomFieldsDef || [];
        const sortedList = [...list].sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        setCustomFieldsDef(sortedList);
      }
    }, (error) => {
      console.warn("Erro ao escutar dados do perfil no PortalClients:", error.message);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // 3. Consolidar lista de clientes finais únicos (manual + agendamentos)
  useEffect(() => {
    const clientsMap = new Map<string, { id: string; name: string; phone: string; email?: string }>();

    // Primeiro populamos com clientes manuais vindos do perfil
    manualClients.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanPhone) {
        clientsMap.set(cleanPhone, {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          email: c.email || ''
        });
      }
    });

    // Depois adicionamos / atualizamos com base nos agendamentos
    appointments.forEach(app => {
      if (app.clientPhone && app.clientName && app.serviceId !== 'bloqueio') {
        const cleanPhone = app.clientPhone.replace(/\D/g, '');
        if (cleanPhone && !clientsMap.has(cleanPhone)) {
          clientsMap.set(cleanPhone, {
            id: `appt-${cleanPhone}`,
            name: app.clientName,
            phone: app.clientPhone,
            email: app.clientEmail || ''
          });
        }
      }
    });

    // Ordenar por nome e FILTRAR os telefones deletados, além de ocultar a profissional Julia/clientId
    const sorted = Array.from(clientsMap.values())
      .filter(c => {
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        return !deletedClientsPhones.includes(cleanPhone) && cleanPhone !== '11914573272' && c.id !== clientId;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setConsolidatedClients(sorted);
  }, [manualClients, appointments, deletedClientsPhones, clientId]);

  // Filtrar Lista de Clientes com base na Pesquisa
  const filteredClients = consolidatedClients.filter(c => {
    const queryStr = searchQuery.toLowerCase();
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    return c.name.toLowerCase().includes(queryStr) || cleanPhone.includes(queryStr);
  });

  // Identificar cliente selecionado
  const selectedClient = consolidatedClients.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientId);

  // Obter prontuário/customFields do cliente selecionado
  const selectedManualClient = manualClients.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientId);
  const selectedCustomFields = selectedManualClient?.customFields || {};

  // Filtrar agendamentos do cliente selecionado
  const selectedClientAppointments = selectedClient ? appointments
    .filter(app => {
      const appPhone = (app.clientPhone || '').replace(/\D/g, '');
      const clientPhone = (selectedClient.phone || '').replace(/\D/g, '');
      return appPhone === clientPhone && app.serviceId !== 'bloqueio';
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(`${a.date}T${a.time || '00:00'}`).getTime() : 0;
      const dateB = b.date ? new Date(`${b.date}T${b.time || '00:00'}`).getTime() : 0;
      return dateB - dateA; // Decrescente (mais recente primeiro)
    }) : [];

  // Sincronizar dados do CRM via API de portal_handler
  const syncCrmData = async (payload: { crmClients?: any[], crmCustomFieldsDef?: any[], crmDeletedPhones?: string[] }) => {
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
        fidelitySettings: {
          ...fidelitySettingsObj,
          ...payload
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao sincronizar dados com o servidor.');
    }
  };

  // Abre modal de cadastro ou edição
  const openClientModal = (clientToEdit: any = null) => {
    setEditingClient(clientToEdit);
    setLocalCustomFieldsDef(customFieldsDef.map(f => typeof f === 'string' ? f : f.name));
    setShowAddNewFieldInput(false);
    setNewFieldName('');

    if (clientToEdit) {
      setNewClientName(clientToEdit.name);
      setNewClientPhone(clientToEdit.phone);
      setNewClientEmail(clientToEdit.email || '');
      const mClient = manualClients.find(c => (c.phone || '').replace(/\D/g, '') === (clientToEdit.phone || '').replace(/\D/g, ''));
      setModalCustomFields(mClient?.customFields || {});
    } else {
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setModalCustomFields({});
    }
    setIsClientModalOpen(true);
  };

  // Cria dinamicamente um novo campo extra na ficha no modal
  const handleAddLocalCustomField = () => {
    const nameTrim = newFieldName.trim();
    if (!nameTrim) return;
    if (localCustomFieldsDef.includes(nameTrim)) {
      toast.error('Este campo já existe no cadastro.');
      return;
    }
    setLocalCustomFieldsDef([...localCustomFieldsDef, nameTrim]);
    setNewFieldName('');
    setShowAddNewFieldInput(false);
    toast.success(`Campo "${nameTrim}" adicionado ao formulário!`);
  };

  // Remove um campo dinâmico do formulário
  const handleRemoveLocalCustomField = (fieldName: string) => {
    setLocalCustomFieldsDef(localCustomFieldsDef.filter(f => f !== fieldName));
    const updatedValues = { ...modalCustomFields };
    delete updatedValues[fieldName];
    setModalCustomFields(updatedValues);
  };

  // Abre modal de confirmação para exclusão de cliente
  const handleDeleteClient = (clientToDelete: any) => {
    setDeleteClientConfirm({ isOpen: true, client: clientToDelete });
  };

  // Executa exclusão de cliente
  const executeDeleteClient = async (clientToDelete: any) => {
    try {
      const cleanPhone = (clientToDelete.phone || '').replace(/\D/g, '');

      // Remove da lista de clientes manuais
      const updatedManualClientsList = manualClients.filter(c => (c.phone || '').replace(/\D/g, '') !== cleanPhone);

      // Adiciona o telefone na lista de excluídos
      let updatedDeletedPhones = deletedClientsPhones;
      if (cleanPhone && !deletedClientsPhones.includes(cleanPhone)) {
        updatedDeletedPhones = [...deletedClientsPhones, cleanPhone];
      }

      await syncCrmData({
        crmClients: updatedManualClientsList,
        crmDeletedPhones: updatedDeletedPhones
      });

      toast.success('Cliente excluído com sucesso!');
      if (selectedClientId === cleanPhone) {
        setSelectedClientId('');
      }
      setDeleteClientConfirm({ isOpen: false, client: null });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir cliente.');
    }
  };

  // Cadastro ou Edição de Cliente Final
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientPhone.trim()) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    setIsSavingClient(true);
    try {
      const cleanPhone = newClientPhone.replace(/\D/g, '');

      // Cria a nova definição de campos globais contendo os campos salvos
      const updatedGlobalFieldsDef = localCustomFieldsDef.map(fieldName => {
        const existing = customFieldsDef.find(f => (f.name || f) === fieldName);
        if (existing) return existing;
        return {
          id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: fieldName,
          createdAt: new Date().toISOString()
        };
      });

      let updatedList = [...manualClients];
      const existingManualIndex = manualClients.findIndex(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);

      if (existingManualIndex !== -1) {
        // Atualiza cliente existente no banco manual
        updatedList[existingManualIndex] = {
          ...updatedList[existingManualIndex],
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          customFields: modalCustomFields,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Verifica se já existe por telefone (para evitar duplicar registros no manual)
        const alreadyExists = manualClients.some(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (alreadyExists && !editingClient) {
          toast.error('Já existe um cliente cadastrado com esse telefone.');
          setIsSavingClient(false);
          return;
        }

        const newClientObj = {
          id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          customFields: modalCustomFields,
          createdAt: new Date().toISOString()
        };
        updatedList = [...updatedList, newClientObj];
      }

      await syncCrmData({
        crmClients: updatedList,
        crmCustomFieldsDef: updatedGlobalFieldsDef
      });

      toast.success(editingClient ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      setSelectedClientId(cleanPhone);
      
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setEditingClient(null);
      setIsClientModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="text-purple-400" size={26} />
            Clientes
          </h2>
          <p className="text-xs text-gray-400 mt-1">Gerencie a ficha cadastral, contatos e histórico dos seus clientes.</p>
        </div>

        <button
          onClick={() => openClientModal()}
          className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0 shrink-0"
        >
          <Plus size={14} /> Cadastrar Cliente
        </button>
      </div>

      {/* Grid Principal de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Painel Esquerdo: Lista de Clientes */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4 flex flex-col h-[650px]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="text-purple-400" size={18} />
              Meus Clientes
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Selecione para ver a ficha completa e o histórico.</p>
          </div>

          {/* Busca */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar cliente..."
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
            />
            <Search className="absolute right-3 top-2.5 text-gray-600" size={14} />
          </div>

          {/* Listagem */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            {filteredClients.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
                <Users size={32} className="mx-auto text-gray-700 mb-2" />
                <p className="text-[11px] text-gray-500 uppercase font-black tracking-widest">Nenhum Cliente</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Nenhum contato encontrado no filtro.</p>
              </div>
            ) : (
              filteredClients.map((c) => {
                const cleanPhone = (c.phone || '').replace(/\D/g, '');
                const isSelected = selectedClientId === cleanPhone;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClientId(cleanPhone)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative overflow-hidden group ${
                      isSelected 
                        ? 'bg-purple-500/10 border-purple-500/30' 
                        : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                      isSelected ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400'
                    }`}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{c.phone}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Ficha Detalhada & Histórico */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedClient ? (
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-12 text-center h-[650px] flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400">
                <Users size={32} />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Ficha do Cliente</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">Selecione um cliente na lista à esquerda para carregar suas informações cadastrais, histórico de atendimentos e ficha personalizada.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl min-h-[650px] flex flex-col justify-between">
              
              <div className="space-y-6">
                {/* Cabeçalho do Cliente Selecionado */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-full flex items-center justify-center font-black text-lg uppercase shadow-inner">
                      {selectedClient.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">{selectedClient.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={12} className="text-purple-400" />
                          {selectedClient.phone}
                        </span>
                        {selectedClient.email && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail size={12} className="text-purple-400" />
                            {selectedClient.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openClientModal(selectedClient)}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={12} /> Editar Dados
                    </button>
                    <button
                      onClick={() => handleDeleteClient(selectedClient)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
                      title="Excluir Cliente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Ficha Dinâmica (Campos Personalizados) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText size={13} className="text-purple-400" />
                    Ficha do Cliente
                  </h4>

                  {customFieldsDef.length === 0 ? (
                    <div className="p-5 border border-dashed border-white/5 rounded-2xl text-center space-y-2">
                      <p className="text-[11px] text-gray-500">Nenhum campo personalizado cadastrado na ficha.</p>
                      <button
                        onClick={() => openClientModal(selectedClient)}
                        className="text-[11px] text-purple-400 hover:underline font-bold bg-transparent border-0 cursor-pointer"
                      >
                        + Criar Primeiro Campo Personalizado
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {customFieldsDef.map((fieldObj) => {
                        const fieldName = typeof fieldObj === 'string' ? fieldObj : fieldObj.name;
                        const value = selectedCustomFields[fieldName];

                        return (
                          <div key={fieldName} className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-1">
                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider block">{fieldName}</span>
                            <span className="text-xs text-white font-semibold">
                              {value || <span className="text-gray-600 italic">Não informado</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Histórico de Agendamentos */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={13} className="text-purple-400" />
                    Histórico de Agendamentos ({selectedClientAppointments.length})
                  </h4>

                  {selectedClientAppointments.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic p-4 bg-black/10 rounded-xl">
                      Nenhum agendamento encontrado para este cliente na agenda.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {selectedClientAppointments.map((app) => {
                        const isCompleted = app.status === 'completed';
                        const isCancelled = app.status === 'cancelled';
                        const displayDate = app.date ? new Date(`${app.date}T00:00:00`).toLocaleDateString('pt-BR') : '';

                        return (
                          <div key={app.id} className="bg-black/10 border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-white">{app.serviceName}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
                                <span className="flex items-center gap-0.5"><Calendar size={10} /> {displayDate}</span>
                                <span className="flex items-center gap-0.5"><Clock size={10} /> {app.time}</span>
                                {app.price > 0 && <span className="flex items-center gap-0.5"><DollarSign size={10} /> R$ {Number(app.price).toFixed(2).replace('.', ',')}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {app.paymentMethod && (
                                <span className="text-[9px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-lg border border-white/5 flex items-center gap-0.5">
                                  <Tag size={9} /> {app.paymentMethod === 'pacote' ? 'Pacote' : 'Venda Rápida'}
                                </span>
                              )}
                              
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                isCompleted 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isCancelled
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {isCompleted ? 'Finalizado' : isCancelled ? 'Cancelado' : 'Agendado'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Rodapé informativo */}
              <div className="text-[9px] text-gray-600 text-center border-t border-white/5 pt-4 mt-6">
                Ficha cadastrada em: {selectedManualClient?.createdAt ? new Date(selectedManualClient.createdAt).toLocaleDateString('pt-BR') : 'Importado da Agenda'}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Modal de Cadastro / Edição de Cliente */}
      {isClientModalOpen && (
        <div 
          onClick={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
            setNewClientName('');
            setNewClientPhone('');
            setNewClientEmail('');
            setModalCustomFields({});
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="text-purple-400" size={18} />
                  {editingClient ? 'Editar Cliente' : 'Cadastrar Cliente'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Preencha os dados do cliente e configure a sua ficha personalizada diretamente.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsClientModalOpen(false);
                  setEditingClient(null);
                  setNewClientName('');
                  setNewClientPhone('');
                  setNewClientEmail('');
                  setModalCustomFields({});
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              
              {/* Informações Básicas */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">Informações Cadastrais</span>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Nome Completo</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: João da Silva..."
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Telefone (DDD + Número)</label>
                    <input
                      type="text"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="Ex: 11999999999"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 font-mono focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">E-mail (Opcional)</label>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="Ex: joao@email.com"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ficha Personalizada (Inputs Dinâmicos) */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Campos da Ficha</span>
                  
                  {!showAddNewFieldInput && (
                    <button
                      type="button"
                      onClick={() => setShowAddNewFieldInput(true)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-bold bg-transparent border-0 cursor-pointer hover:underline flex items-center gap-0.5"
                    >
                      + Novo Campo
                    </button>
                  )}
                </div>

                {/* Input rápido para criar um campo de forma dinâmica */}
                {showAddNewFieldInput && (
                  <div className="bg-black/30 p-3 rounded-2xl border border-purple-500/20 flex gap-2 items-center animate-in slide-in-from-top-2 duration-200">
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Nome do campo (ex: Idade, Peso...)"
                      className="flex-1 px-3 py-2 bg-black/50 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddLocalCustomField}
                      className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs cursor-pointer border-0"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddNewFieldInput(false); setNewFieldName(''); }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl cursor-pointer border-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Listagem dos Inputs Personalizados no Modal */}
                {localCustomFieldsDef.length === 0 ? (
                  <p className="text-[10px] text-gray-500 italic p-3 bg-black/10 rounded-xl text-center">
                    Nenhum campo personalizado cadastrado na ficha do cliente ainda. Crie um campo acima!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {localCustomFieldsDef.map((fieldName) => (
                      <div key={fieldName} className="space-y-1 relative group bg-black/10 border border-white/5 p-3 rounded-2xl">
                        <div className="flex justify-between items-center pr-6">
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{fieldName}</label>
                          <button
                            type="button"
                            onClick={() => handleRemoveLocalCustomField(fieldName)}
                            className="absolute right-2 top-2 text-gray-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 bg-transparent border-0 cursor-pointer"
                            title="Remover campo da ficha"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={modalCustomFields[fieldName] || ''}
                          onChange={(e) => {
                            setModalCustomFields({
                              ...modalCustomFields,
                              [fieldName]: e.target.value
                            });
                          }}
                          placeholder={`Preencher ${fieldName.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões do Formulário */}
              <div className="flex gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsClientModalOpen(false);
                    setEditingClient(null);
                    setNewClientName('');
                    setNewClientPhone('');
                    setNewClientEmail('');
                    setModalCustomFields({});
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Cliente */}
      {deleteClientConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Excluir Cliente</h3>
              <p className="text-xs text-gray-400">
                Tem certeza que deseja excluir o cliente <strong>{deleteClientConfirm.client?.name}</strong>?
                Ele será ocultado da lista do CRM, mas os agendamentos existentes na agenda continuarão salvos.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteClientConfirm({ isOpen: false, client: null })}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteClient(deleteClientConfirm.client)}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
