import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc 
} from 'firebase/firestore';
import { 
  Plus, Edit2, Trash2, X, Check, AlertCircle, Home, Building2, Wrench, FileText, Wifi,
  ExternalLink, Printer, Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface PortalResourcesProps {
  orgId: string;
  clientId: string;
}

export default function PortalResources({ orgId }: PortalResourcesProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal / Formulário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingResource, setEditingResource] = useState<any | null>(null);

  // Campos do Formulário
  const [name, setName] = useState('');
  const [type, setType] = useState('property');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [price, setPrice] = useState('');
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [priceType, setPriceType] = useState('daily');

  // Estados para Modal do Guia / QR Code
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [selectedGuideResource, setSelectedGuideResource] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Modal de Confirmação para deletar
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({
    isOpen: false,
    id: ''
  });

  // Estados para Minuta do Contrato Customizada
  const [templateText, setTemplateText] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Carrega template da minuta do contrato da organização
  useEffect(() => {
    if (!orgId) return;
    async function loadOrgTemplate() {
      try {
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          setTemplateText(orgSnap.data().rentalContractTemplate || '');
        }
      } catch (err) {
        console.error("Erro ao carregar template do contrato:", err);
      }
    }
    loadOrgTemplate();
  }, [orgId]);

  // Escuta os recursos cadastrados no Firestore
  useEffect(() => {
    if (!orgId) return;

    const resourcesRef = collection(db, 'organizations', orgId, 'resources');
    const q = query(resourcesRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResources(list);
      setCurrentPage(1);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar recursos:", error);
      toast.error("Erro ao carregar os itens locáveis.");
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  const openModal = (resource: any = null) => {
    setEditingResource(resource);
    if (resource) {
      setName(resource.name || '');
      setType(resource.type || 'property');
      setDescription(resource.description || '');
      setRules(resource.rules || '');
      setPrice(resource.price ? resource.price.toString() : '');
      setWifiName(resource.wifiName || '');
      setWifiPassword(resource.wifiPassword || '');
      setAccessInstructions(resource.accessInstructions || '');
      setPriceType(resource.priceType || 'daily');
    } else {
      setName('');
      setType('property');
      setDescription('');
      setRules('');
      setPrice('');
      setWifiName('');
      setWifiPassword('');
      setAccessInstructions('');
      setPriceType('daily');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("O nome do item é obrigatório.");
      return;
    }

    setIsSaving(true);
    const parsedPrice = parseFloat(price.replace(',', '.')) || 0;

    const resourceData = {
      name: name.trim(),
      type,
      description: description.trim(),
      rules: rules.trim(),
      price: parsedPrice,
      priceType,
      wifiName: wifiName.trim(),
      wifiPassword: wifiPassword.trim(),
      accessInstructions: accessInstructions.trim(),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingResource) {
        // Atualiza item existente
        const docRef = doc(db, 'organizations', orgId, 'resources', editingResource.id);
        await updateDoc(docRef, resourceData);
        toast.success("Item locável atualizado com sucesso!");
      } else {
        // Cria novo item
        const colRef = collection(db, 'organizations', orgId, 'resources');
        await addDoc(colRef, {
          ...resourceData,
          createdAt: serverTimestamp()
        });
        toast.success("Item locável cadastrado com sucesso!");
      }
      setIsModalOpen(false);
      setEditingResource(null);
    } catch (error) {
      console.error("Erro ao salvar recurso:", error);
      toast.error("Erro ao salvar as informações do item.");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      const docRef = doc(db, 'organizations', orgId, 'resources', id);
      await deleteDoc(docRef);
      toast.success("Item removido com sucesso!");
    } catch (error) {
      console.error("Erro ao deletar recurso:", error);
      toast.error("Erro ao remover o item.");
    } finally {
      setDeleteConfirm({ isOpen: false, id: '' });
    }
  };

  const handlePrintQR = (resourceName: string, url: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("O bloqueador de pop-ups impediu a impressão. Por favor, permita pop-ups para este site.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - ${resourceName}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              text-align: center;
              background: white;
              color: black;
              padding: 50px;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
              border: 2px solid #eaeaea;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            }
            h1 {
              font-size: 24px;
              margin-bottom: 5px;
              font-weight: 800;
            }
            p {
              font-size: 14px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.5;
            }
            img {
              width: 250px;
              height: 250px;
              margin-bottom: 30px;
            }
            .footer {
              font-size: 11px;
              color: #999;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Conecte-se ao Wi-Fi & Manual</h1>
            <p>Escaneie o QR Code abaixo para acessar o manual do hóspede, instruções e rede Wi-Fi do <strong>${resourceName}</strong>.</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}" alt="QR Code" />
            <div class="footer">Powered by Portal Hub CRM</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyGuideUrl = (resourceId: string) => {
    const guideUrl = `${window.location.origin}/guia/${orgId}/${resourceId}`;
    navigator.clipboard.writeText(guideUrl);
    setCopiedLink(true);
    toast.success("Link do Guia copiado para a área de transferência!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveTemplate = async () => {
    if (!orgId) return;
    setIsSavingTemplate(true);
    try {
      const orgRef = doc(db, 'organizations', orgId);
      await updateDoc(orgRef, { rentalContractTemplate: templateText });
      toast.success("Minuta do contrato salva com sucesso!");
      setIsTemplateModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar a minuta do contrato.");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const getIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'property':
        return <Home size={18} className="text-purple-400" />;
      case 'space':
        return <Building2 size={18} className="text-blue-400" />;
      case 'equipment':
        return <Wrench size={18} className="text-emerald-400" />;
      default:
        return <FileText size={18} className="text-amber-400" />;
    }
  };

  const getLabelType = (resourceType: string) => {
    switch (resourceType) {
      case 'property': return 'Imóvel / Temporada';
      case 'space': return 'Salão / Espaço';
      case 'equipment': return 'Equipamento / Brinquedo';
      default: return 'Outros';
    }
  };

  // Paginação lógica
  const totalPages = Math.ceil(resources.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = resources.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6">
      {/* Topo informativo */}
      <div className="flex justify-between items-center">
        <div className="text-left">
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            Itens e Recursos Cadastrados ({resources.length})
          </h4>
          <p className="text-gray-500 text-xs mt-1">
            Cadastre os itens locados aos clientes para associar regras, valores e instruções de acesso.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border-0"
          >
            <FileText size={14} /> Minuta do Contrato
          </button>
          <button
            onClick={() => openModal()}
            className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 border-0 cursor-pointer shadow-lg shadow-primary-500/10"
          >
            <Plus size={14} /> Adicionar Item
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-xs">Carregando itens...</div>
      ) : resources.length === 0 ? (
        <div className="p-16 border border-dashed border-white/5 rounded-[2rem] text-center space-y-4 bg-white/[0.01]">
          <Home size={36} className="mx-auto text-gray-700 font-light" />
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-bold">Nenhum item cadastrado ainda.</p>
            <p className="text-[11px] text-gray-600">Cadastre casas, salões ou brinquedos de festa para gerenciar reservas.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 justify-center">
          {currentItems.map((resource) => (
            <div 
              key={resource.id} 
              className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-4 text-left transition-all max-w-[350px] w-full mx-auto"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center">
                      {getIcon(resource.type)}
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-white uppercase tracking-wide truncate max-w-[140px]">{resource.name}</h5>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">
                        {getLabelType(resource.type)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedGuideResource(resource);
                        setIsGuideModalOpen(true);
                      }}
                      className="p-1.5 bg-primary-500/10 hover:bg-primary-500/25 border border-primary-500/20 text-primary-400 rounded-lg transition-all border-0 cursor-pointer"
                      title="Guia do Hóspede / QR Code"
                    >
                      <FileText size={12} />
                    </button>
                    <button
                      onClick={() => openModal(resource)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border-0 cursor-pointer"
                      title="Editar Item"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, id: resource.id })}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border-0 cursor-pointer"
                      title="Excluir Item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {resource.description && (
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                    {resource.description}
                  </p>
                )}

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Preço Base</span>
                  <span className="text-xs font-black text-white">
                    R$ {Number(resource.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {resource.priceType === 'daily' && ' / dia'}
                    {resource.priceType === 'hourly' && ' / hora'}
                    {resource.priceType === 'event' && ' / evento'}
                    {resource.priceType === 'fixed' && ' / fixo'}
                  </span>
                </div>

                {(resource.wifiName || resource.accessInstructions) && (
                  <div className="pt-2 border-t border-white/5 space-y-1">
                    <span className="text-[8px] font-black text-primary-400 uppercase tracking-widest block">Manual & Instruções</span>
                    {resource.wifiName && (
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <Wifi size={10} className="text-gray-500" />
                        <span>Wi-Fi: <strong>{resource.wifiName}</strong></span>
                      </div>
                    )}
                    {resource.accessInstructions && (
                      <p className="text-[9px] text-gray-500 truncate italic">
                        Instr: {resource.accessInstructions}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 pt-6 animate-in fade-in duration-200">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-gray-300 hover:text-white disabled:hover:bg-white/5 disabled:hover:text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed border-0"
            >
              Anterior
            </button>
            <span className="text-xs text-gray-500 font-bold tracking-wider">
              Página <span className="text-gray-300">{currentPage}</span> de <span className="text-gray-300">{totalPages}</span>
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-gray-300 hover:text-white disabled:hover:bg-white/5 disabled:hover:text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed border-0"
            >
              Próxima
            </button>
          </div>
        )}
        </>
      )}

      {/* Modal de Cadastro / Edição de Recurso */}
      {isModalOpen && (
        <div 
          onClick={() => {
            setIsModalOpen(false);
            setEditingResource(null);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl md:max-w-3xl w-full bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-5 text-left max-h-[82vh] overflow-y-auto pb-6 custom-scrollbar"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Home className="text-primary-400" size={18} />
                  {editingResource ? 'Editar Item Locável' : 'Cadastrar Item Locável'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Adicione ou edite detalhes do imóvel ou recurso para aluguel.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingResource(null);
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Coluna da Esquerda: Informações Gerais */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest block border-b border-white/5 pb-1">
                    📋 Informações Gerais
                  </span>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Nome do Item / Recurso</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Apartamento 101, Chácara Recanto, Cama Elástica..."
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tipo</label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-2 py-2.5 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all focus:ring-1 focus:ring-primary-500 cursor-pointer"
                      >
                        <option value="property">🏠 Imóvel</option>
                        <option value="space">🏢 Salão</option>
                        <option value="equipment">⚙️ Equipamento</option>
                        <option value="other">📦 Outro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Preço Base (R$)</label>
                      <input
                        type="text"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Ex: 250,00"
                        className="w-full px-3 py-2.5 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cobrança</label>
                      <select
                        value={priceType}
                        onChange={(e) => setPriceType(e.target.value)}
                        className="w-full px-2 py-2.5 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all focus:ring-1 focus:ring-primary-500 cursor-pointer"
                      >
                        <option value="daily">📅 Diária</option>
                        <option value="hourly">⏱️ Hora</option>
                        <option value="event">🎉 Evento</option>
                        <option value="fixed">📦 Fixo</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Descrição Curta</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descrição geral ou resumo da propriedade..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Regras de Uso e Convivência</label>
                    <textarea
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      placeholder="Ex: Não fazer barulho após às 22h, proibido fumar, recolher lixo ao sair..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 resize-none"
                    />
                  </div>
                </div>

                {/* Coluna da Direita: Manual & Instruções do Hóspede */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest block border-b border-white/5 pb-1">
                      🔑 Guia de Acesso do Hóspede
                    </span>

                    <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-3 text-left">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Nome da Rede Wi-Fi</label>
                          <input
                            type="text"
                            value={wifiName}
                            onChange={(e) => setWifiName(e.target.value)}
                            placeholder="Ex: WiFi_Casa_Praia"
                            className="w-full px-3 py-2.0 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-lg text-xs outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Senha do Wi-Fi</label>
                          <input
                            type="text"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            placeholder="Ex: 12345678"
                            className="w-full px-3 py-2.0 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-lg text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Instruções de Acesso / Chaves</label>
                        <textarea
                          value={accessInstructions}
                          onChange={(e) => setAccessInstructions(e.target.value)}
                          placeholder="Senha do cofre de chaves, fechadura eletrônica, check-in passo a passo..."
                          rows={4}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-lg text-xs outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingResource(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {editingResource ? 'Salvar Alterações' : 'Adicionar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Excluir Item</h3>
              <p className="text-xs text-gray-400">
                Tem certeza que deseja excluir as informações deste recurso?
                Esta ação é definitiva e removerá o item da lista de locações.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, id: '' })}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDelete(deleteConfirm.id)}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Guia do Hóspede / QR Code */}
      {isGuideModalOpen && selectedGuideResource && (
        <div 
          onClick={() => {
            setIsGuideModalOpen(false);
            setSelectedGuideResource(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-6 text-center text-left"
          >
            <div className="flex justify-between items-start text-left">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="text-primary-400" size={18} />
                  Guia do Hóspede & Manual
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Compartilhe as instruções de acesso e rede Wi-Fi com seus hóspedes.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsGuideModalOpen(false);
                  setSelectedGuideResource(null);
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-3xl w-fit mx-auto shadow-inner border border-white/10">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/guia/${orgId}/${selectedGuideResource.id}`)}`} 
                alt="QR Code Guia do Hóspede"
                className="w-[180px] h-[180px] block"
              />
            </div>

            {/* URL e Cópia */}
            <div className="space-y-2 text-left">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Link Público do Guia</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/guia/${orgId}/${selectedGuideResource.id}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-gray-400 rounded-xl text-xs outline-none truncate"
                />
                <button
                  onClick={() => handleCopyGuideUrl(selectedGuideResource.id)}
                  className="px-3.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all cursor-pointer border-0 text-xs font-bold flex items-center gap-1.5"
                >
                  {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handlePrintQR(selectedGuideResource.name, `${window.location.origin}/guia/${orgId}/${selectedGuideResource.id}`)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
              >
                <Printer size={14} />
                Imprimir Placa QR
              </button>
              <a
                href={`${window.location.origin}/guia/${orgId}/${selectedGuideResource.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer no-underline text-center border-0 text-black"
              >
                <ExternalLink size={14} />
                Visualizar Guia
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal Minuta do Contrato */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-3xl w-full max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-300 text-left flex flex-col">
            <button
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <FileText size={20} className="text-primary-400" />
                Minuta do Contrato de Locação
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Escreva o modelo geral de contrato de locação por temporada. O hóspede assinará digitalmente este termo.
              </p>
            </div>

            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col space-y-1 min-h-[300px]">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Texto do Contrato (Suporta tags dinâmicas)</label>
                <textarea
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  className="flex-1 w-full p-4 bg-black/40 border border-white/10 text-gray-300 rounded-2xl text-xs outline-none focus:border-primary-500 font-mono resize-none leading-relaxed"
                  placeholder="Escreva os termos do contrato aqui..."
                />
              </div>

              {/* Legenda de Tags */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                <span className="text-[9px] font-black text-primary-400 uppercase tracking-widest block border-b border-white/5 pb-1">
                  💡 Marcadores Dinâmicos (Tags)
                </span>
                <p className="text-[10px] text-gray-500 leading-normal">
                  Insira estes termos no contrato para que o sistema substitua automaticamente com os dados reais da reserva:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px] font-mono text-gray-400">
                  <div><span className="text-primary-400">{`{cliente}`}</span>: Nome do hóspede</div>
                  <div><span className="text-primary-400">{`{documento}`}</span>: CPF do hóspede</div>
                  <div><span className="text-primary-400">{`{recurso}`}</span>: Nome do imóvel</div>
                  <div><span className="text-primary-400">{`{checkin}`}</span>: Entrada (data)</div>
                  <div><span className="text-primary-400">{`{checkout}`}</span>: Saída (data)</div>
                  <div><span className="text-primary-400">{`{valor}`}</span>: Valor da estadia</div>
                  <div><span className="text-primary-400">{`{anfitriao}`}</span>: Nome da empresa</div>
                  <div><span className="text-primary-400">{`{regras}`}</span>: Regras do imóvel</div>
                  <div><span className="text-primary-400">{`{wifi}`}</span>: Nome da rede Wi-Fi</div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate}
                  className="flex-1 py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-600/50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-primary-500/10 flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  {isSavingTemplate ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Salvar Minuta</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
