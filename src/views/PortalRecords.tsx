import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, getDocs, setDoc
} from 'firebase/firestore';
import { 
  FileText, Plus, Trash2, Printer, Clock, PlusCircle, Check, List, User, PlusSquare, 
  ChevronRight, Calendar, X, AlertCircle, FileSpreadsheet, Eye, ChevronDown, CheckSquare, Settings, Edit2, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';

interface PortalRecordsProps {
  orgId: string;
  clientId: string;
}

export default function PortalRecords({ orgId, clientId }: PortalRecordsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'records' | 'templates' | 'new_client'>('records');
  
  // Listas de Dados
  const [templates, setTemplates] = useState<any[]>([]);
  const [clientRecords, setClientRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consolidatedClients, setConsolidatedClients] = useState<any[]>([]);
  
  // Seleção e preenchimento
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTemplateIdForNew, setSelectedTemplateIdForNew] = useState<string>('');
  const [fillingRecord, setFillingRecord] = useState<any | null>(null);
  const [newResponses, setNewResponses] = useState<Record<string, any>>({});
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  
  // Estados de Criação de Modelo (Template)
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateFields, setTemplateFields] = useState<any[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deletedClientsPhones, setDeletedClientsPhones] = useState<string[]>([]);
  const [manualClients, setManualClients] = useState<any[]>([]);
  const [customFieldsDef, setCustomFieldsDef] = useState<any[]>([]);
  const [fidelitySettingsObj, setFidelitySettingsObj] = useState<any>({});
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modais de confirmação
  const [deleteClientConfirm, setDeleteClientConfirm] = useState<{ isOpen: boolean; client: any | null }>({
    isOpen: false,
    client: null
  });
  const [deleteRecordConfirm, setDeleteRecordConfirm] = useState<{ isOpen: boolean; recordId: string | null }>({
    isOpen: false,
    recordId: null
  });

  // Estados de Cadastro Rápido de Cliente Final
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);

  // Registro selecionado para impressão A4
  const [printingRecord, setPrintingRecord] = useState<any | null>(null);

  // 1. Escutar templates
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'record_templates');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTemplates(list);
    });
    return () => unsub();
  }, [orgId]);

  // 2. Escutar registros preenchidos (prontuários)
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'client_records');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientRecords(list);
    });
    return () => unsub();
  }, [orgId]);

  // 3. Escuta antiga de clientes comuns desativada

  // 4. Escutar agendamentos da organização
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'appointments');
    const q = query(ref, orderBy('time', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    });
    return () => unsub();
  }, [orgId]);

  // Escutar telefones excluídos do perfil do profissional logado
  // 4. Escutar dados do perfil do profissional logado (clientes manuais, deletados e campos customizados de fidelitySettings)
  useEffect(() => {
    if (!orgId || !clientId) return;
    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
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
      console.error("Erro ao escutar dados do perfil no PortalRecords:", error);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // 5. Consolidar lista de clientes finais únicos
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

    // Ordenar por nome e FILTRAR os telefones deletados, além de ocultar a profissional Julia
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

  // Ações do Construtor de Modelos
  const handleAddField = (type: 'text_short' | 'text_paragraph' | 'yes_no' | 'multiple_choice') => {
    const newField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      label: '',
      required: false,
      options: type === 'multiple_choice' ? [''] : []
    };
    setTemplateFields([...templateFields, newField]);
  };

  const handleUpdateFieldLabel = (fieldId: string, label: string) => {
    setTemplateFields(templateFields.map(f => f.id === fieldId ? { ...f, label } : f));
  };

  const handleUpdateFieldRequired = (fieldId: string, required: boolean) => {
    setTemplateFields(templateFields.map(f => f.id === fieldId ? { ...f, required } : f));
  };

  const handleAddFieldOption = (fieldId: string) => {
    setTemplateFields(templateFields.map(f => {
      if (f.id === fieldId) {
        return { ...f, options: [...f.options, ''] };
      }
      return f;
    }));
  };

  const handleUpdateFieldOption = (fieldId: string, optionIndex: number, value: string) => {
    setTemplateFields(templateFields.map(f => {
      if (f.id === fieldId) {
        const updatedOptions = [...f.options];
        updatedOptions[optionIndex] = value;
        return { ...f, options: updatedOptions };
      }
      return f;
    }));
  };

  const handleRemoveFieldOption = (fieldId: string, optionIndex: number) => {
    setTemplateFields(templateFields.map(f => {
      if (f.id === fieldId) {
        return { ...f, options: f.options.filter((_: any, idx: number) => idx !== optionIndex) };
      }
      return f;
    }));
  };

  const handleRemoveField = (fieldId: string) => {
    setTemplateFields(templateFields.filter(f => f.id !== fieldId));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error('Preencha o nome do modelo.');
      return;
    }
    if (templateFields.length === 0) {
      toast.error('Adicione pelo menos um campo ao modelo.');
      return;
    }

    // Valida se todos os rótulos de campos estão preenchidos
    const hasEmptyLabels = templateFields.some(f => !f.label.trim());
    if (hasEmptyLabels) {
      toast.error('Dê um rótulo/pergunta para todos os campos.');
      return;
    }

    // Valida opções de escolha múltipla
    const hasEmptyOptions = templateFields.some(f => f.type === 'multiple_choice' && (f.options.length === 0 || f.options.some((o: string) => !o.trim())));
    if (hasEmptyOptions) {
      toast.error('Preencha todas as opções dos campos de múltipla escolha.');
      return;
    }

    setIsSavingTemplate(true);
    try {
      const payload = {
        name: templateName.trim(),
        description: templateDescription.trim(),
        fields: templateFields,
        updatedAt: serverTimestamp()
      };

      if (editingTemplateId) {
        await updateDoc(doc(db, 'organizations', orgId, 'record_templates', editingTemplateId), payload);
        toast.success('Modelo de ficha atualizado!');
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'record_templates'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success('Modelo de ficha criado!');
      }

      setTemplateName('');
      setTemplateDescription('');
      setTemplateFields([]);
      setEditingTemplateId(null);
      setActiveSubTab('templates');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar modelo.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleEditTemplate = (tmpl: any) => {
    setEditingTemplateId(tmpl.id);
    setTemplateName(tmpl.name);
    setTemplateDescription(tmpl.description || '');
    setTemplateFields(tmpl.fields || []);
    setActiveSubTab('templates'); // permanece na aba para editar
  };

  const handleDeleteTemplate = async (tmplId: string) => {
    if (!confirm('Deseja realmente excluir este modelo? Isso não apagará prontuários já preenchidos.')) return;
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'record_templates', tmplId));
      toast.success('Modelo de ficha excluído!');
      if (editingTemplateId === tmplId) {
        setEditingTemplateId(null);
        setTemplateName('');
        setTemplateDescription('');
        setTemplateFields([]);
      }
    } catch (err) {
      toast.error('Erro ao excluir modelo.');
    }
  };

  // Sincronizar dados do CRM diretamente no Firestore no documento do profissional logado (dentro de fidelitySettings)
  const syncCrmData = async (payload: { crmClients?: any[], crmCustomFieldsDef?: any[], crmDeletedPhones?: string[] }) => {
    if (!orgId || !clientId) return;
    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    await setDoc(docRef, {
      fidelitySettings: {
        ...fidelitySettingsObj,
        ...payload
      }
    }, { merge: true });
  };

  // Preenche dados do formulário de cliente para edição
  const handleStartEditClient = (client: any) => {
    setEditingClient(client);
    setNewClientName(client.name);
    setNewClientPhone(client.phone);
    setNewClientEmail(client.email || '');
    setActiveSubTab('new_client');
  };

  // Abre modal de confirmação para exclusão de cliente
  const handleDeleteClient = (client: any) => {
    setDeleteClientConfirm({ isOpen: true, client });
  };

  // Executa exclusão de cliente
  const executeDeleteClient = async (client: any) => {
    try {
      const cleanPhone = (client.phone || '').replace(/\D/g, '');

      // Remove da lista de clientes manuais
      const updatedManualClientsList = manualClients.filter(c => c.id !== client.id);

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

  // Cadastro de Cliente Rápido ou Edição
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientPhone.trim()) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    setIsSavingClient(true);
    try {
      const cleanPhone = newClientPhone.replace(/\D/g, '');

      if (editingClient) {
        // Editando cliente manual existente
        const updatedList = manualClients.map(c => {
          if (c.id === editingClient.id) {
            return {
              ...c,
              name: newClientName.trim(),
              phone: newClientPhone.trim(),
              email: newClientEmail.trim(),
              updatedAt: new Date().toISOString()
            };
          }
          return c;
        });
        await syncCrmData({ crmClients: updatedList });
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // Criando novo cliente
        const alreadyExists = manualClients.some(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (alreadyExists) {
          toast.error('Já existe um cliente cadastrado com esse telefone.');
          setIsSavingClient(false);
          return;
        }

        const newClient = {
          id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          customFields: {},
          createdAt: new Date().toISOString()
        };

        const updatedList = [...manualClients, newClient];
        await syncCrmData({ crmClients: updatedList });

        toast.success('Cliente cadastrado com sucesso!');
        setSelectedClientId(cleanPhone);
      }
      
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setEditingClient(null);
      setActiveSubTab('records');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  // Abre modal de confirmação para exclusão de ficha preenchida
  const handleDeleteRecord = (recordId: string) => {
    setDeleteRecordConfirm({ isOpen: true, recordId });
  };

  // Executa exclusão de ficha preenchida
  const executeDeleteRecord = async (recordId: string) => {
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'client_records', recordId));
      toast.success('Ficha excluída com sucesso!');
      setDeleteRecordConfirm({ isOpen: false, recordId: null });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir ficha.');
    }
  };

  // Preenchimento de Ficha
  const handleOpenFillForm = () => {
    if (!selectedClientId) {
      toast.error('Selecione um cliente primeiro.');
      return;
    }
    if (!selectedTemplateIdForNew) {
      toast.error('Selecione um modelo de ficha.');
      return;
    }
    const template = templates.find(t => t.id === selectedTemplateIdForNew);
    if (!template) return;

    setFillingRecord({
      template,
      client: consolidatedClients.find(c => c.phone.replace(/\D/g, '') === selectedClientId)
    });
    setNewResponses({});
  };

  const handleSaveFilledRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fillingRecord) return;

    const { template, client } = fillingRecord;
    
    // Valida campos requeridos
    for (const field of template.fields) {
      if (field.required) {
        const val = newResponses[field.id];
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          toast.error(`O campo "${field.label}" é obrigatório.`);
          return;
        }
      }
    }

    try {
      const payload = {
        clientId: client.phone.replace(/\D/g, ''),
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email || '',
        templateId: template.id,
        templateName: template.name,
        responses: newResponses,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'organizations', orgId, 'client_records'), payload);
      toast.success('Ficha/Prontuário preenchido com sucesso!');
      
      setFillingRecord(null);
      setNewResponses({});
      setSelectedTemplateIdForNew('');
    } catch (err) {
      toast.error('Erro ao salvar prontuário.');
    }
  };

  // Filtragem dos prontuários do cliente selecionado
  const filteredRecords = clientRecords.filter(r => r.clientId === selectedClientId && r.type !== 'manual_client');

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
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black z-[9999] p-10 font-sans" id="print-sheet">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #print-sheet, #print-sheet * {
                visibility: visible;
              }
              #print-sheet {
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
              <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Ficha de Anamnese / Prontuário</h1>
              <p className="text-sm font-semibold text-purple-700 mt-1">{printingRecord.templateName}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Data: <span className="font-bold">{printingRecord.createdAt?.toDate ? printingRecord.createdAt.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</span></p>
              <p>Hora: <span className="font-bold">{printingRecord.createdAt?.toDate ? printingRecord.createdAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-gray-800 text-base">{printingRecord.clientName}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Contato / Telefone</p>
              <p className="font-bold text-gray-800 font-mono text-base">{printingRecord.clientPhone}</p>
            </div>
            {printingRecord.clientEmail && (
              <div className="col-span-2 border-t border-gray-200 pt-2 mt-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">E-mail</p>
                <p className="font-medium text-gray-700">{printingRecord.clientEmail}</p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {(() => {
              const matchedTemplate = templates.find(t => t.id === printingRecord.templateId);
              const fields = matchedTemplate?.fields || [];
              
              if (fields.length === 0) {
                // Caso não ache o template, itera sobre as respostas guardadas
                return Object.entries(printingRecord.responses).map(([key, val]: any) => (
                  <div key={key} className="border-b border-gray-100 pb-4">
                    <p className="font-bold text-gray-800 text-sm mb-1">{key}</p>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{Array.isArray(val) ? val.join(', ') : val}</p>
                  </div>
                ));
              }

              return fields.map((f: any) => {
                const answer = printingRecord.responses[f.id];
                return (
                  <div key={f.id} className="border-b border-gray-200 pb-4">
                    <p className="font-bold text-gray-800 text-sm mb-1">{f.label}</p>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap font-medium">
                      {answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0) ? (
                        <span className="italic text-gray-400">Não respondido</span>
                      ) : Array.isArray(answer) ? (
                        answer.join(', ')
                      ) : answer === true || answer === 'true' || answer === 'Sim' ? (
                        'Sim'
                      ) : answer === false || answer === 'false' || answer === 'Não' ? (
                        'Não'
                      ) : (
                        answer
                      )}
                    </p>
                  </div>
                );
              });
            })()}
          </div>

          <div className="mt-16 pt-8 border-t border-dashed border-gray-300 text-center">
            <div className="w-64 border-t border-gray-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assinatura do Profissional / Responsável</p>
          </div>
        </div>
      )}
      
      {/* Conteúdo Normal do Portal */}
      <div className="print:hidden space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <FileText className="text-purple-400" size={26} />
              Fichas
            </h2>
            <p className="text-xs text-gray-400 mt-1">Gerencie a anamnese, avaliações físicas e fichas dos seus clientes.</p>
          </div>

          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 shadow-lg shrink-0">
            <button
              onClick={() => { setActiveSubTab('records'); setFillingRecord(null); setEditingClient(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'records' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              Fichas
            </button>
            <button
              onClick={() => { setActiveSubTab('templates'); setFillingRecord(null); setEditingClient(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'templates' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              Modelos de Ficha
            </button>
            <button
              onClick={() => { setActiveSubTab('new_client'); setFillingRecord(null); setEditingClient(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'new_client' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              Novo Cliente
            </button>
          </div>
        </div>

        {/* 1. ABA DE PRONTUÁRIOS (CLIENTES E HISTÓRICO) */}
        {activeSubTab === 'records' && !fillingRecord && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Lista e Busca de Clientes */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4 flex flex-col h-[650px]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="text-purple-400" size={18} />
                  Clientes
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Selecione, crie, edite ou exclua os clientes da clínica.</p>
              </div>

              {/* Campo de Busca */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar cliente..."
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Lista Vertical Rolável */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredClients.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-xs">
                    Nenhum cliente encontrado.
                  </div>
                ) : (
                  filteredClients.map((c) => {
                    const cleanPhone = c.phone.replace(/\D/g, '');
                    const isSelected = selectedClientId === cleanPhone;
                    return (
                      <div
                        key={c.id}
                        onClick={() => { setSelectedClientId(cleanPhone); setExpandedRecordId(null); }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left group ${
                          isSelected 
                            ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                            : 'bg-black/20 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-white text-sm truncate">{c.name}</h4>
                          <p className="text-[11px] text-gray-400 font-mono truncate">{c.phone}</p>
                          {c.email && (
                            <p className="text-[10px] text-gray-500 truncate">{c.email}</p>
                          )}
                        </div>

                        {/* Botões de Ação no Hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {c.source === 'db' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditClient(c);
                                }}
                                className="p-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-all border-0 cursor-pointer"
                                title="Editar Cliente"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClient(c);
                                }}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border-0 cursor-pointer"
                                title="Excluir Cliente"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Opções extras para o cliente selecionado */}
              {selectedClientId && (
                <div className="pt-4 border-t border-white/5 space-y-3 shrink-0">
                  {templates.length > 0 ? (
                    <div className="space-y-2">
                      <CustomSelect
                        value={selectedTemplateIdForNew}
                        onChange={(val: string) => setSelectedTemplateIdForNew(val)}
                        placeholder="Escolha o modelo de ficha..."
                        options={templates.map(t => ({
                          value: t.id,
                          label: t.name
                        }))}
                      />
                      <button
                        onClick={handleOpenFillForm}
                        disabled={!selectedTemplateIdForNew}
                        className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                      >
                        <PlusCircle size={14} />
                        Preencher Ficha
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[10px] text-amber-400 font-medium">
                      Crie um "Modelo de Ficha" antes de preencher o prontuário.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Linha do tempo (Histórico de Prontuários) */}
            <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-6 h-[650px] flex flex-col">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="text-purple-400" size={18} />
                  Histórico de Fichas
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Linha do tempo de anamneses e fichas respondidas.</p>
              </div>

              {selectedClientId && (() => {
                const currentClient = consolidatedClients.find(c => c.phone.replace(/\D/g, '') === selectedClientId);
                if (!currentClient) return null;
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl gap-3 animate-in fade-in duration-200 text-left shrink-0">
                    <div className="space-y-1">
                      <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block">Contato do Cliente Selecionado</span>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        {currentClient.name}
                        <span className="text-xs text-gray-500 font-mono font-normal">({currentClient.phone})</span>
                      </h4>
                    </div>
                    <a
                      href={`https://api.whatsapp.com/send?phone=55${currentClient.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline border-0 hover:scale-[1.02] active:scale-95 text-center shrink-0"
                    >
                      <Phone size={12} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                );
              })()}

              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {!selectedClientId ? (
                  <div className="py-20 text-center border border-dashed border-white/10 rounded-[2rem] space-y-2">
                    <User size={40} className="mx-auto text-gray-600" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nenhum Cliente Selecionado</p>
                    <p className="text-[11px] text-gray-600">Selecione um cliente ao lado para ver o histórico clínico dele.</p>
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-white/10 rounded-[2rem] space-y-2">
                    <FileText size={40} className="mx-auto text-gray-600" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nenhum Registro Encontrado</p>
                    <p className="text-[11px] text-gray-600">Este cliente ainda não possui fichas preenchidas.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-purple-500/20 ml-3 pl-6 space-y-6 py-1">
                    {filteredRecords.map((rec) => {
                      const isExpanded = expandedRecordId === rec.id;
                      const dateStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
                      const timeStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      
                      return (
                        <div key={rec.id} className="relative">
                          {/* Dot lateral */}
                          <div className="absolute -left-[32px] top-1.5 w-4 h-4 rounded-full border-4 border-[#050505] bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />

                          <div className="bg-black/25 border border-white/5 hover:border-white/10 rounded-2xl transition-all p-4.5 space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="text-left">
                                <h4 className="font-bold text-white text-sm">{rec.templateName}</h4>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">{dateStr} às {timeStr}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border-0"
                                >
                                  <Eye size={12} />
                                  {isExpanded ? 'Ocultar' : 'Visualizar'}
                                </button>
                                <button
                                  onClick={() => handlePrint(rec)}
                                  className="p-1.5 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 text-purple-400 hover:text-purple-300 rounded-lg transition-all cursor-pointer border-0"
                                  title="Imprimir em A4 / Salvar PDF"
                                >
                                  <Printer size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(rec.id)}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-lg transition-all cursor-pointer border-0"
                                  title="Excluir prontuário"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Se expandido, mostra cada pergunta e resposta */}
                            {isExpanded && (
                              <div className="pt-3 border-t border-white/5 space-y-4 animate-in fade-in duration-200">
                                {(() => {
                                  const matchedTemplate = templates.find(t => t.id === rec.templateId);
                                  const fields = matchedTemplate?.fields || [];
                                  
                                  if (fields.length === 0) {
                                    return Object.entries(rec.responses).map(([key, val]: any) => (
                                      <div key={key} className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{key}</p>
                                        <p className="text-xs text-white bg-black/40 p-3 rounded-xl border border-white/5 whitespace-pre-wrap">{Array.isArray(val) ? val.join(', ') : val}</p>
                                      </div>
                                    ));
                                  }

                                  return fields.map((f: any) => {
                                    const answer = rec.responses[f.id];
                                    return (
                                      <div key={f.id} className="space-y-0.5 text-left">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</p>
                                        <p className="text-xs text-white bg-black/40 p-3 rounded-xl border border-white/5 whitespace-pre-wrap font-medium">
                                          {answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0) ? (
                                            <span className="italic text-gray-600">Não respondido</span>
                                          ) : Array.isArray(answer) ? (
                                            answer.join(', ')
                                          ) : answer === true || answer === 'true' || answer === 'Sim' ? (
                                            'Sim'
                                          ) : answer === false || answer === 'false' || answer === 'Não' ? (
                                            'Não'
                                          ) : (
                                            answer
                                          )}
                                        </p>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 1.1 FORMULÁRIO DE PREENCHIMENTO DE ANAMNESE */}
        {activeSubTab === 'records' && fillingRecord && (
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="text-purple-400" size={18} />
                  Preencher: {fillingRecord.template.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Cliente: <span className="text-purple-300 font-bold">{fillingRecord.client.name}</span> ({fillingRecord.client.phone})</p>
              </div>
              <button
                onClick={() => setFillingRecord(null)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFilledRecord} className="space-y-5 text-left">
              {fillingRecord.template.fields.map((field: any) => {
                const value = newResponses[field.id];
                return (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      {field.label}
                      {field.required && <span className="text-red-400" title="Obrigatório">*</span>}
                    </label>

                    {/* Textos, checkboxes, e outros inputs dinâmicos */}
                    {field.type === 'text_short' && (
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => setNewResponses({ ...newResponses, [field.id]: e.target.value })}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 focus:ring-1 focus:ring-purple-500"
                        placeholder="Digite a resposta..."
                        required={field.required}
                      />
                    )}

                    {field.type === 'text_paragraph' && (
                      <textarea
                        rows={3}
                        value={value || ''}
                        onChange={(e) => setNewResponses({ ...newResponses, [field.id]: e.target.value })}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-700 focus:ring-1 focus:ring-purple-500 resize-none"
                        placeholder="Descreva..."
                        required={field.required}
                      />
                    )}

                    {field.type === 'yes_no' && (
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            checked={value === 'Sim' || value === true}
                            onChange={() => setNewResponses({ ...newResponses, [field.id]: 'Sim' })}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                          />
                          Sim
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            checked={value === 'Não' || value === false}
                            onChange={() => setNewResponses({ ...newResponses, [field.id]: 'Não' })}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                          />
                          Não
                        </label>
                      </div>
                    )}

                    {field.type === 'multiple_choice' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {field.options.map((opt: string, idx: number) => {
                          const listValue = Array.isArray(value) ? value : [];
                          const checked = listValue.includes(opt);
                          return (
                            <label key={idx} className="flex items-center gap-2.5 p-3.5 bg-black/20 border border-white/5 hover:border-white/10 rounded-xl text-xs text-gray-300 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const newList = checked 
                                    ? listValue.filter((v: string) => v !== opt) 
                                    : [...listValue, opt];
                                  setNewResponses({ ...newResponses, [field.id]: newList });
                                }}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-white/20 bg-black/40"
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  Salvar Ficha Clinica
                </button>
                <button
                  type="button"
                  onClick={() => setFillingRecord(null)}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Voltar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. ABA DE MODELOS DE FICHA */}
        {activeSubTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Criador de Modelos */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-5 text-left">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusSquare className="text-purple-400" size={18} />
                  {editingTemplateId ? 'Editar Modelo' : 'Novo Modelo de Ficha'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Defina o nome e os campos que compõem sua ficha de avaliação.</p>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome do Modelo</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: Anamnese Corporal, Ficha Facial..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição / Objetivo</label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Ex: Utilizado para a primeira consulta..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Campos / Perguntas ({templateFields.length})</span>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddField('text_short')}
                      className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/25 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={10} /> Text Curto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('text_paragraph')}
                      className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/25 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={10} /> Parágrafo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('yes_no')}
                      className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/25 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={10} /> Sim/Não
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('multiple_choice')}
                      className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/25 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={10} /> Mult. Escolha
                    </button>
                  </div>

                  {templateFields.length === 0 ? (
                    <div className="p-4 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl text-[11px] text-gray-500 text-center font-medium">
                      Clique nos botões acima para adicionar perguntas ao modelo.
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                      {templateFields.map((field, index) => (
                        <div key={field.id} className="bg-black/45 border border-white/5 hover:border-white/10 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-1 duration-150 relative">
                          <button
                            type="button"
                            onClick={() => handleRemoveField(field.id)}
                            className="absolute right-3 top-3 text-red-400 hover:text-red-500 transition-all p-1 bg-red-500/5 rounded-lg border-0 cursor-pointer"
                            title="Remover campo"
                          >
                            <Trash2 size={12} />
                          </button>

                          <div className="space-y-1 pr-6">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Pergunta {index + 1}</label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleUpdateFieldLabel(field.id, e.target.value)}
                              placeholder="Digite a pergunta..."
                              className="w-full px-2 py-1.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-lg text-xs outline-none transition-all placeholder-gray-700"
                              required
                            />
                          </div>

                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold select-none cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => handleUpdateFieldRequired(field.id, e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 border-white/20 bg-black/40"
                              />
                              Campo Obrigatório
                            </label>
                            <span className="text-[9px] font-black uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                              {field.type === 'text_short' ? 'Text Curto' : field.type === 'text_paragraph' ? 'Parágrafo' : field.type === 'yes_no' ? 'Sim/Não' : 'Múlt. Escolha'}
                            </span>
                          </div>

                          {field.type === 'multiple_choice' && (
                            <div className="pt-2 border-t border-white/5 space-y-2">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Opções do Menu</span>
                              
                              {field.options.map((opt: string, optIdx: number) => (
                                <div key={optIdx} className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleUpdateFieldOption(field.id, optIdx, e.target.value)}
                                    placeholder={`Opção ${optIdx + 1}`}
                                    className="flex-1 px-2 py-1 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-lg text-[11px] outline-none transition-all placeholder-gray-700"
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFieldOption(field.id, optIdx)}
                                    className="p-1 text-red-400 hover:text-red-500 border-0 cursor-pointer bg-transparent"
                                    title="Remover opção"
                                    disabled={field.options.length <= 1}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              
                              <button
                                type="button"
                                onClick={() => handleAddFieldOption(field.id)}
                                className="text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-all flex items-center gap-1 border-0 cursor-pointer bg-transparent"
                              >
                                <Plus size={10} /> Adicionar Opção
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button
                    type="submit"
                    disabled={isSavingTemplate}
                    className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                  >
                    <Check size={14} />
                    Salvar Modelo
                  </button>
                  {editingTemplateId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateId(null);
                        setTemplateName('');
                        setTemplateDescription('');
                        setTemplateFields([]);
                      }}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Listagem de Modelos */}
            <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Modelos Salvos</h3>
                <p className="text-xs text-gray-400">Estes templates estarão disponíveis para preenchimento de prontuários dos clientes.</p>
              </div>

              {templates.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl space-y-2">
                  <List size={36} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nenhum Modelo Cadastrado</p>
                  <p className="text-[11px] text-gray-600">Crie seu primeiro modelo de anamnese ao lado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map((tmpl) => (
                    <div key={tmpl.id} className="bg-black/25 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all">
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-sm">{tmpl.name}</h4>
                        {tmpl.description && <p className="text-xs text-gray-400 line-clamp-2">{tmpl.description}</p>}
                        <span className="text-[9px] font-black uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20 inline-block mt-2">
                          {tmpl.fields?.length || 0} perguntas
                        </span>
                      </div>

                      <div className="flex items-center gap-2 border-t border-white/5 pt-3">
                        <button
                          onClick={() => {
                            setEditingTemplateId(tmpl.id);
                            setTemplateName(tmpl.name);
                            setTemplateDescription(tmpl.description || '');
                            setTemplateFields(tmpl.fields || []);
                          }}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-0"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer border-0"
                          title="Excluir Modelo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. ABA DE CADASTRO / EDIÇÃO DE CLIENTE FINAL */}
        {activeSubTab === 'new_client' && (
          <div className="max-w-md mx-auto bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="text-purple-400" size={18} />
                {editingClient ? 'Editar Cliente' : 'Cadastrar Cliente'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {editingClient 
                  ? 'Modifique os dados de contato do cliente manual.' 
                  : 'Cadastre clientes de forma manual para preenchimento de fichas clínicas.'
                }
              </p>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: João da Silva..."
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Telefone (DDD + Número)</label>
                <input
                  type="text"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">E-mail (Opcional)</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="Ex: joao@email.com"
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600"
                />
              </div>

              <div className="flex gap-2">
                {editingClient && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(null);
                      setNewClientName('');
                      setNewClientPhone('');
                      setNewClientEmail('');
                      setActiveSubTab('records');
                    }}
                    className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="flex-1 py-3.5 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

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
                Ele será ocultado da lista, mas os agendamentos existentes na agenda não serão apagados.
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

      {/* Modal de Confirmação de Exclusão de Ficha */}
      {deleteRecordConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Excluir Ficha</h3>
              <p className="text-xs text-gray-400">
                Tem certeza que deseja excluir esta ficha preenchida permanentemente? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteRecordConfirm({ isOpen: false, recordId: null })}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteRecord(deleteRecordConfirm.recordId!)}
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
