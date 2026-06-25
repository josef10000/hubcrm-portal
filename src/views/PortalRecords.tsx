import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';
import { 
  FileText, Plus, Trash2, Printer, Clock, PlusCircle, Check, List, User, PlusSquare, 
  ChevronRight, Calendar, X, AlertCircle, FileSpreadsheet, Eye, ChevronDown, CheckSquare, Settings, Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';

interface PortalRecordsProps {
  orgId: string;
}

export default function PortalRecords({ orgId }: PortalRecordsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'records' | 'templates' | 'new_client'>('records');
  
  // Listas de Dados
  const [templates, setTemplates] = useState<any[]>([]);
  const [clientRecords, setClientRecords] = useState<any[]>([]);
  const [manualClients, setManualClients] = useState<any[]>([]);
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

  // 3. Escutar clientes manuais
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'clients_database');
    const q = query(ref, orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setManualClients(list);
    });
    return () => unsub();
  }, [orgId]);

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

  // 5. Consolidar lista de clientes finais únicos
  useEffect(() => {
    const clientsMap = new Map<string, { id: string; name: string; phone: string; email?: string }>();
    
    // Primeiro populamos com clientes manuais do banco de dados
    manualClients.forEach(c => {
      const cleanPhone = c.phone.replace(/\D/g, '');
      if (cleanPhone) {
        clientsMap.set(cleanPhone, {
          id: c.id,
          name: c.name,
          phone: c.phone,
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

    // Ordenar por nome
    const sorted = Array.from(clientsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    setConsolidatedClients(sorted);
  }, [manualClients, appointments]);

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

  // Cadastro de Cliente Rápido
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientPhone.trim()) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    setIsSavingClient(true);
    try {
      await addDoc(collection(db, 'organizations', orgId, 'clients_database'), {
        name: newClientName.trim(),
        phone: newClientPhone.trim(),
        email: newClientEmail.trim(),
        createdAt: serverTimestamp()
      });
      toast.success('Cliente cadastrado com sucesso!');
      
      const cleanPhone = newClientPhone.replace(/\D/g, '');
      setSelectedClientId(cleanPhone);
      
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setActiveSubTab('records');
    } catch (err) {
      toast.error('Erro ao cadastrar cliente.');
    } finally {
      setIsSavingClient(false);
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
  const filteredRecords = clientRecords.filter(r => r.clientId === selectedClientId);

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
              Prontuários & Fichas
            </h2>
            <p className="text-xs text-gray-400 mt-1">Gerencie a anamnese, avaliações físicas e prontuários dos seus clientes.</p>
          </div>

          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 shadow-lg shrink-0">
            <button
              onClick={() => { setActiveSubTab('records'); setFillingRecord(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'records' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              Prontuários
            </button>
            <button
              onClick={() => { setActiveSubTab('templates'); setFillingRecord(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'templates' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              Modelos de Ficha
            </button>
            <button
              onClick={() => { setActiveSubTab('new_client'); setFillingRecord(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeSubTab === 'new_client' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              Cadastrar Cliente
            </button>
          </div>
        </div>

        {/* 1. ABA DE PRONTUÁRIOS (CLIENTES E HISTÓRICO) */}
        {activeSubTab === 'records' && !fillingRecord && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Seletor de Cliente */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="text-purple-400" size={18} />
                  Selecionar Cliente
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Selecione o paciente/cliente para abrir o histórico.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente Cadastrado</label>
                  <CustomSelect
                    value={selectedClientId}
                    onChange={(val: string) => { setSelectedClientId(val); setExpandedRecordId(null); }}
                    placeholder="Escolha o cliente..."
                    options={consolidatedClients.map(c => ({
                      value: c.phone.replace(/\D/g, ''),
                      label: `${c.name} (${c.phone})`
                    }))}
                  />
                </div>

                {selectedClientId && templates.length > 0 && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <h4 className="text-[11px] font-black text-purple-400 uppercase tracking-wider">Preencher Nova Anamnese</h4>
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
                  </div>
                )}

                {selectedClientId && templates.length === 0 && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-[11px] text-amber-400 font-medium">
                    Crie um "Modelo de Ficha" antes de preencher o prontuário.
                  </div>
                )}
              </div>
            </div>

            {/* Linha do tempo (Histórico de Prontuários) */}
            <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="text-purple-400" size={18} />
                  Histórico de Prontuários
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Timeline de anamneses e fichas respondidas.</p>
              </div>

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
                  <p className="text-[11px] text-gray-600">Este cliente ainda não possui prontuários preenchidos.</p>
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
                            <div>
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
                                onClick={async () => {
                                  if (!confirm('Excluir este prontuário preenchido permanentemente?')) return;
                                  try {
                                    await deleteDoc(doc(db, 'organizations', orgId, 'client_records', rec.id));
                                    toast.success('Prontuário excluído!');
                                  } catch (err) {
                                    toast.error('Erro ao excluir prontuário.');
                                  }
                                }}
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
                      <div className="flex gap-3">
                        {['Sim', 'Não'].map(opt => {
                          const isSelected = value === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setNewResponses({ ...newResponses, [field.id]: opt })}
                              className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all text-center cursor-pointer border-0 ${
                                isSelected 
                                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/10' 
                                  : 'bg-black/25 border-white/5 text-gray-400 hover:text-white hover:bg-black/40'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {field.type === 'multiple_choice' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {field.options.map((opt: string) => {
                          const currentArr = Array.isArray(value) ? value : [];
                          const isChecked = currentArr.includes(opt);
                          return (
                            <label
                              key={opt}
                              className={`p-3 border rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all border-0 ${
                                isChecked 
                                  ? 'bg-purple-500/10 border-purple-500/30 text-white' 
                                  : 'bg-black/25 border-white/5 text-gray-400 hover:text-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewResponses({ ...newResponses, [field.id]: [...currentArr, opt] });
                                  } else {
                                    setNewResponses({ ...newResponses, [field.id]: currentArr.filter(x => x !== opt) });
                                  }
                                }}
                                className="w-4 h-4 rounded border-white/10 text-purple-500 bg-black/40 focus:ring-purple-500 cursor-pointer"
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
                  className="flex-1 py-3.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/15 cursor-pointer border-0"
                >
                  <Check size={14} />
                  Salvar Respostas
                </button>
                <button
                  type="button"
                  onClick={() => setFillingRecord(null)}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. ABA DE MODELOS DE FICHAS (CADASTRO E LISTA) */}
        {activeSubTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Construtor Visual */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="text-purple-400" size={18} />
                  {editingTemplateId ? 'Editar Modelo' : 'Novo Modelo'}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Monte um formulário personalizado de anamnese.</p>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome da Ficha</label>
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
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição (Opcional)</label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Ex: Para avaliações físicas corporais..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-purple-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600"
                  />
                </div>

                {/* Adicionar Campo */}
                <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-2.5">
                  <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider block">Adicionar Pergunta</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddField('text_short')}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={10} /> Texto Curto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('text_paragraph')}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={10} /> Parágrafo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('yes_no')}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={10} /> Sim / Não
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('multiple_choice')}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={10} /> Múltipla Escolha
                    </button>
                  </div>
                </div>

                {/* Formulário de Campos criados */}
                {templateFields.length > 0 && (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {templateFields.map((field, idx) => (
                      <div key={field.id} className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-2 relative animate-in fade-in duration-150 text-left">
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="absolute top-2 right-2 text-gray-500 hover:text-red-400 p-0.5 border-0 bg-transparent cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                        
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-purple-400 tracking-wider">
                          <span>Pergunta {idx + 1}</span> &bull; 
                          <span className="text-gray-500">{field.type === 'text_short' ? 'Texto Curto' : field.type === 'text_paragraph' ? 'Parágrafo' : field.type === 'yes_no' ? 'Sim/Não' : 'Escolha'}</span>
                        </div>

                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleUpdateFieldLabel(field.id, e.target.value)}
                            placeholder="Pergunta/Rótulo..."
                            className="w-full px-3 py-2 bg-black/50 border border-white/10 focus:border-purple-500 text-white rounded-lg text-xs outline-none transition-all placeholder-gray-700"
                            required
                          />

                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Obrigatório</span>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => handleUpdateFieldRequired(field.id, e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-white/10 text-purple-500 bg-black/40 focus:ring-purple-500 cursor-pointer"
                            />
                          </div>
                        </div>

                        {field.type === 'multiple_choice' && (
                          <div className="space-y-1.5 border-t border-white/5 pt-2 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Opções de Escolha</span>
                              <button
                                type="button"
                                onClick={() => handleAddFieldOption(field.id)}
                                className="p-1 text-[8px] font-bold bg-white/5 hover:bg-white/10 text-white rounded cursor-pointer border-0"
                              >
                                + Add Opção
                              </button>
                            </div>
                            
                            <div className="space-y-1">
                              {field.options.map((option: string, oIdx: number) => (
                                <div key={oIdx} className="flex gap-1.5 items-center">
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => handleUpdateFieldOption(field.id, oIdx, e.target.value)}
                                    placeholder={`Opção ${oIdx + 1}`}
                                    className="flex-1 px-2.5 py-1.5 bg-black/50 border border-white/10 focus:border-purple-500 text-white rounded-md text-[10px] outline-none transition-all"
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFieldOption(field.id, oIdx)}
                                    className="p-1.5 text-gray-500 hover:text-red-400 border-0 bg-transparent cursor-pointer"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

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
                        <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider pt-1">
                          {tmpl.fields?.length || 0} Perguntas / Campos
                        </p>
                      </div>
                      
                      <div className="flex gap-2 pt-3 border-t border-white/5">
                        <button
                          onClick={() => handleEditTemplate(tmpl)}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1"
                        >
                          <Edit2 size={11} /> Editar
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer border-0"
                          title="Excluir Modelo"
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

        {/* 3. ABA DE CADASTRO RÁPIDO DE CLIENTE FINAL */}
        {activeSubTab === 'new_client' && (
          <div className="max-w-md mx-auto bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="text-purple-400" size={18} />
                Cadastrar Cliente Final
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Cadastre clientes de forma manual para preenchimento de prontuários clínicos.</p>
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

              <button
                type="submit"
                disabled={isSavingClient}
                className="w-full py-3.5 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
              >
                <Check size={14} />
                Cadastrar Cliente
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
