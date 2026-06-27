import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, limit 
} from 'firebase/firestore';
import { 
  Plus, Trash2, Edit2, Search, AlertTriangle, CheckCircle2, Package, Coins, Minus, X, ArrowUpRight, ArrowDownRight, History, ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';
import CustomSelect from './CustomSelect';

interface PortalInventoryProps {
  orgId: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  costPerUnit: number;
  brand?: string;
  showInPos?: boolean;
  price?: number;
  sales?: number;
}

// Função utilitária para codificar/decodificar metadados no campo name
export const parseNameAndMetadata = (rawName: string) => {
  let name = rawName || '';
  let brand = '';
  let price = 0;
  let showInPos = false;
  let sales = 0;

  const metaRegex = /\[(.*?)\]/;
  const match = name.match(metaRegex);
  if (match) {
    const metaString = match[1];
    name = name.replace(metaRegex, '').trim();
    
    const parts = metaString.split('|');
    parts.forEach(part => {
      const [key, value] = part.split(':').map(s => s.trim());
      if (key && value) {
        if (key === 'brand') brand = value;
        if (key === 'price') price = Number(value) || 0;
        if (key === 'pdv') showInPos = value === 'true';
        if (key === 'sales') sales = Number(value) || 0;
      }
    });
  }

  return { name, brand, price, showInPos, sales };
};

export default function PortalInventory({ orgId }: PortalInventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados da Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('un');
  const [minQuantity, setMinQuantity] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  
  // Novos Estados
  const [brand, setBrand] = useState('');
  const [showInPos, setShowInPos] = useState(false);
  const [price, setPrice] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para Confirmação Customizada
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    itemId: string;
  }>({
    isOpen: false,
    itemId: ''
  });

  // Escuta os itens no Firestore
  useEffect(() => {
    if (!orgId) return;
    const inventoryRef = collection(db, 'organizations', orgId, 'inventory');
    const q = query(inventoryRef, orderBy('name', 'asc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
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
          sales: meta.sales,
          costPerUnit: data.costPerUnit !== undefined && data.costPerUnit !== null ? Number(data.costPerUnit) : 0
        } as InventoryItem;
      });
      setItems(list);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar inventário:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  // Escuta os logs de movimentação
  useEffect(() => {
    if (!orgId) return;
    const logsRef = collection(db, 'organizations', orgId, 'inventory_logs');
    const q = query(logsRef, orderBy('date', 'desc'), limit(30));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data() as any;
        // Limpa o nome do item no log se ele contiver metadados codificados
        const meta = parseNameAndMetadata(data.itemName);
        return { 
          id: d.id, 
          ...data, 
          itemName: meta.name 
        };
      });
      setLogs(list);
    }, (error) => {
      console.error("Erro ao escutar logs de inventário:", error);
    });

    return () => unsub();
  }, [orgId]);

  const openAddModal = () => {
    setEditingItemId(null);
    setName('');
    setQuantity('');
    setUnit('un');
    setMinQuantity('');
    setCostPerUnit('');
    setBrand('');
    setShowInPos(false);
    setPrice('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setName(item.name);
    setQuantity(item.quantity.toString());
    setUnit(item.unit);
    setMinQuantity(item.minQuantity.toString());
    setCostPerUnit(item.costPerUnit.toString().replace('.', ','));
    setBrand(item.brand || '');
    setShowInPos(item.showInPos || false);
    setPrice(item.price ? item.price.toString().replace('.', ',') : '');
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || quantity === '' || minQuantity === '' || !orgId) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Codifica marca, preço, pdv e sales no próprio campo name, preservando as vendas em caso de edição
      const currentSales = editingItemId ? (items.find(i => i.id === editingItemId)?.sales || 0) : 0;
      const encodedName = `${name.trim()} [brand: ${brand.trim()} | price: ${price ? price.replace(',', '.') : '0'} | pdv: ${showInPos} | sales: ${currentSales}]`;

      const payload = {
        name: encodedName,
        quantity: Number(quantity),
        unit,
        minQuantity: Number(minQuantity),
        costPerUnit: costPerUnit ? Number(costPerUnit.replace(',', '.')) : 0,
        updatedAt: serverTimestamp()
      };

      if (editingItemId) {
        const prevItem = items.find(i => i.id === editingItemId);
        const prevQty = prevItem ? prevItem.quantity : 0;
        const diff = payload.quantity - prevQty;

        await updateDoc(doc(db, 'organizations', orgId, 'inventory', editingItemId), payload);

        if (diff !== 0) {
          try {
            await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
              itemId: editingItemId,
              itemName: name.trim(), // Salva o nome limpo no log
              type: diff > 0 ? 'entrada' : 'saida',
              quantity: Math.abs(diff),
              date: serverTimestamp(),
              description: `Ajuste manual de estoque via edição: de ${prevQty}${payload.unit} para ${payload.quantity}${payload.unit}`
            });
          } catch (logErr) {
            console.info("[PortalInventory] Histórico de movimentações local indisponível para este perfil.");
          }
        }
        toast.success('Produto atualizado com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'organizations', orgId, 'inventory'), {
          ...payload,
          createdAt: serverTimestamp()
        });

        try {
          await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
            itemId: docRef.id,
            itemName: name.trim(), // Salva o nome limpo no log
            type: 'entrada',
            quantity: payload.quantity,
            date: serverTimestamp(),
            description: `Cadastro inicial no sistema com ${payload.quantity}${payload.unit}`
          });
        } catch (logErr) {
          console.info("[PortalInventory] Histórico de movimentações local indisponível para este perfil.");
        }

        toast.success('Produto cadastrado com sucesso!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar o produto: ' + (err.message || 'Permissão insuficiente'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      itemId: id
    });
  };

  const executeDeleteItem = async () => {
    const id = confirmModal.itemId;
    if (!id || !orgId) return;
    const item = items.find(i => i.id === id);

    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'inventory', id));
      if (item) {
        try {
          await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
            itemId: id,
            itemName: item.name,
            type: 'saida',
            quantity: item.quantity,
            date: serverTimestamp(),
            description: `Remoção definitiva do produto. Estoque zerado (era ${item.quantity}${item.unit}).`
          });
        } catch (logErr) {
          console.warn("[PortalInventory] Sem permissão para gravar log de inventário:", logErr);
        }
      }
      toast.success('Produto removido com sucesso!');
      setConfirmModal({ isOpen: false, itemId: '' });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover o produto.');
    }
  };

  // Ajuste rápido de quantidade
  const handleQuickAdjust = async (item: InventoryItem, amount: number) => {
    const newQty = Math.max(0, item.quantity + amount);
    const actualDiff = newQty - item.quantity;
    if (actualDiff === 0) return;

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'inventory', item.id), {
        quantity: newQty,
        updatedAt: serverTimestamp()
      });

      try {
        await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
          itemId: item.id,
          itemName: item.name,
          type: actualDiff > 0 ? 'entrada' : 'saida',
          quantity: Math.abs(actualDiff),
          date: serverTimestamp(),
          description: `Ajuste rápido de estoque: ${actualDiff > 0 ? '+' : ''}${actualDiff}${item.unit}`
        });
      } catch (logErr) {
        console.info("[PortalInventory] Histórico de movimentações local indisponível para este perfil.");
      }

      toast.success(`Estoque ajustado: ${newQty}${item.unit}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao ajustar estoque.');
    }
  };

  // Métricas Financeiras
  const totalCostValuation = items.reduce((acc, item) => acc + (item.quantity * item.costPerUnit), 0);
  const totalSellValuation = items.reduce((acc, item) => acc + (item.quantity * (item.price || 0)), 0);
  const totalProfitValuation = totalSellValuation - items.reduce((acc, item) => item.price ? acc + (item.quantity * item.costPerUnit) : acc, 0);

  const criticalItemsCount = items.filter(item => item.quantity <= item.minQuantity).length;

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    if (showCriticalOnly) {
      return matchesSearch && item.quantity <= item.minQuantity;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 text-left">
      
      {/* Grid de Métricas Financeiras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Patrimônio a Custo */}
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Patrimônio (Custo)</span>
            <span className="text-xl font-black text-white block">
              R$ {totalCostValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
            <Coins size={20} />
          </div>
        </div>

        {/* Card 2: Faturamento Potencial */}
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Valuation (Venda)</span>
            <span className="text-xl font-black text-emerald-400 block">
              R$ {totalSellValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
            <Coins size={20} />
          </div>
        </div>

        {/* Card 3: Lucro Estimado */}
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Lucro Estimado</span>
            <span className="text-xl font-black text-purple-400 block">
              R$ {totalProfitValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400">
            <Coins size={20} />
          </div>
        </div>

        {/* Card 4: Estoque Crítico */}
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Itens Críticos</span>
            <span className={`text-xl font-black block ${criticalItemsCount > 0 ? 'text-amber-500 animate-pulse' : 'text-gray-400'}`}>
              {criticalItemsCount}
            </span>
          </div>
          <div className={`p-3 rounded-2xl ${criticalItemsCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-gray-500'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>

      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl items-stretch sm:items-center">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar produtos por nome ou marca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-2xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-xs font-bold placeholder:text-gray-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={`px-5 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-0 ${
              showCriticalOnly 
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-400 font-black' 
                : 'bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-gray-500 hover:text-white'
            }`}
          >
            <AlertTriangle size={14} className={showCriticalOnly ? 'text-amber-500' : 'text-gray-500'} />
            <span>Críticos ({criticalItemsCount})</span>
          </button>
        </div>

        <button
          onClick={openAddModal}
          className="px-6 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-primary-500/10 text-xs uppercase tracking-wider border-0 cursor-pointer"
        >
          <Plus size={16} />
          Cadastrar Produto
        </button>
      </div>

      {/* Grid of Items */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-gray-500 text-xs">Carregando estoque...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-[2rem] p-12 text-center">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" strokeWidth={1} />
          <p className="text-gray-400 text-xs italic">Nenhum produto cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isLowStock = item.quantity <= item.minQuantity;
            return (
              <div 
                key={item.id}
                onClick={() => openEditModal(item)}
                className={`
                  relative bg-[var(--theme-glass)] border p-6 rounded-[2rem] flex flex-col justify-between shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--theme-glass-hover)] cursor-pointer hover:scale-[1.02] active:scale-[0.99] group/card
                  ${isLowStock 
                    ? 'border-amber-500/30' 
                    : 'border-[var(--theme-border-subtle)]'}
                `}
              >
                <div>
                  {/* Status Badges */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest block">{item.brand || 'Sem Marca'}</span>
                    <div className="flex items-center gap-1.5">
                      {item.showInPos && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/10 border border-primary-500/20 rounded-full text-[8px] font-black text-primary-400 uppercase tracking-tight">
                          <ShoppingCart className="w-2.5 h-2.5" />
                          PDV
                        </div>
                      )}
                      {isLowStock ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[8px] font-black text-amber-500 uppercase tracking-tight">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Baixo
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] font-black text-emerald-400 uppercase tracking-tight">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Saudável
                        </div>
                      )}
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-white mb-2 line-clamp-1 uppercase leading-snug">{item.name}</h4>
                  
                  {/* Stock Quantity */}
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-2xl font-black text-white">{item.quantity}</span>
                    <span className="text-gray-400 font-bold text-xs">{item.unit}</span>
                  </div>

                  {/* Valuation Details */}
                  <div className="mt-4 space-y-2 border-t border-[var(--theme-border-subtle)] pt-4 text-xs text-left">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mínimo Crítico:</span>
                      <span className="text-gray-300 font-mono font-bold">{item.minQuantity} {item.unit}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Custo Unitário:</span>
                      <span className="text-gray-300 font-mono font-bold">
                        R$ {(item.costPerUnit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {item.unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Custo do Lote:</span>
                      <span className="text-gray-400 font-mono text-[11px] font-bold">
                        R$ {((item.costPerUnit || 0) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Preço de Venda:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        R$ {item.price ? Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="mt-6 pt-4 border-t border-[var(--theme-border-subtle)] flex items-center justify-between gap-4">
                  {/* Quick +/- adjustments */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQuickAdjust(item, item.unit === 'g' ? -100 : -1); }}
                      className="p-2 hover:bg-white/5 text-gray-500 hover:text-white border border-white/5 rounded-xl transition-all active:scale-90 border-0 bg-transparent cursor-pointer"
                      title={item.unit === 'g' ? "Subtrair 100g" : "Subtrair 1 unidade"}
                    >
                      <Minus size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQuickAdjust(item, item.unit === 'g' ? 100 : 1); }}
                      className="p-2 hover:bg-white/5 text-gray-500 hover:text-white border border-white/5 rounded-xl transition-all active:scale-90 border-0 bg-transparent cursor-pointer"
                      title={item.unit === 'g' ? "Somar 100g" : "Somar 1 unidade"}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Edit/Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                      className="p-2 hover:bg-primary-500/10 text-gray-500 hover:text-primary-400 rounded-xl transition-all border-0 bg-transparent cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                      className="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-xl transition-all border-0 bg-transparent cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Seção de Histórico de Logs */}
      <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-[2rem] p-6 md:p-8 space-y-6 mt-8 shadow-2xl">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <History className="text-primary-500" size={16} />
            Histórico de Movimentações
          </h3>
          <p className="text-xs text-gray-500">Últimas movimentações de entrada, saída e consumo de produtos no estoque.</p>
        </div>

        <div className="w-full h-[1px] bg-[var(--theme-border-subtle)]" />

        {logs.length === 0 ? (
          <div className="py-12 text-center bg-black/10 rounded-2xl border border-[var(--theme-border-subtle)]">
            <History size={36} className="mx-auto mb-3 text-gray-600 animate-pulse" strokeWidth={1} />
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nenhuma Movimentação Registrada</p>
          </div>
        ) : (
          <div className="relative border-l border-[var(--theme-border-subtle)] ml-2.5 pl-6 space-y-6 py-1 max-h-[400px] overflow-y-auto custom-scrollbar">
            {logs.map((log) => {
              const formattedDate = log.date?.seconds 
                ? new Date(log.date.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '';
              
              const isEntry = log.type === 'entrada';

              return (
                <div key={log.id} className="relative group flex items-start gap-4">
                  <div className={`absolute -left-[32px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--theme-bg-secondary)] ${
                    isEntry ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                  
                  <div className="flex-1 bg-[var(--theme-glass)] hover:bg-[var(--theme-glass-hover)] border border-[var(--theme-border-subtle)] p-4 rounded-2xl flex items-center justify-between gap-4 transition-all text-left">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-gray-500 block">{formattedDate}</span>
                      <p className="text-xs text-white">
                        <span className="font-black uppercase tracking-tight text-gray-200">{log.itemName}</span> &bull; {log.description}
                      </p>
                    </div>

                    <span className={`text-xs font-mono font-black shrink-0 px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                      isEntry ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {isEntry ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {isEntry ? '+' : '-'}{log.quantity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div 
            className="border border-[var(--theme-border)] p-6 md:p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-1.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-gray-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
              <Package className="text-primary-500 w-5 h-5" />
              {editingItemId ? 'Editar Produto' : 'Cadastrar Produto'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              
              {/* Nome */}
              <div className="text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Nome do Produto/Insumo *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Coca-Cola Lata 350ml"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold"
                />
              </div>

              {/* Marca */}
              <div className="text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Marca (opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Coca-Cola, Heineken, Ambev"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold"
                />
              </div>

              {/* Quantidade e Unidade */}
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Qtd Atual *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Unidade *</label>
                  <CustomSelect 
                    value={unit}
                    onChange={(val) => setUnit(val)}
                    options={[
                      { value: 'un', label: 'un (unidades)' },
                      { value: 'g', label: 'g (gramas)' },
                      { value: 'kg', label: 'kg (quilos)' },
                      { value: 'ml', label: 'ml (mililitros)' },
                      { value: 'L', label: 'L (litros)' },
                      { value: 'm', label: 'm (metros)' }
                    ]}
                  />
                </div>
              </div>

              {/* Estoque Mínimo e Custo */}
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Estoque Mínimo *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    placeholder="Mínimo crítico"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Preço de Custo (por {unit})</label>
                  <input 
                    type="text" 
                    placeholder="0,00"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold font-mono"
                  />
                </div>
              </div>

              {/* Custo total do lote calculado em tempo real */}
              {Number(quantity) > 0 && Number(costPerUnit.replace(',', '.')) > 0 && (
                <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                  <span>Custo Total do Lote ({quantity} {unit}):</span>
                  <span className="font-mono text-white text-xs">
                    R$ {(Number(quantity) * Number(costPerUnit.replace(',', '.'))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Preço de Venda e Checkbox PDV */}
              <div className="grid grid-cols-2 gap-4 text-left items-end">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Preço de Venda (R$)</label>
                  <input 
                    type="text" 
                    placeholder="0,00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold font-mono"
                  />
                </div>
                
                {/* Switch Exibir no PDV */}
                <div className="flex items-center gap-2 h-[42px] cursor-pointer" onClick={() => setShowInPos(!showInPos)}>
                  <input 
                    type="checkbox" 
                    checked={showInPos}
                    onChange={() => {}} // Lida pelo onClick da div
                    className="w-4 h-4 accent-primary-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider select-none">Exibir no PDV</span>
                </div>
              </div>

              {/* Botões Ações */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-gray-400 hover:text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer bg-transparent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/10 border-0 cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir permanentemente este produto do estoque? Essa ação não poderá ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={executeDeleteItem}
        onCancel={() => setConfirmModal({ isOpen: false, itemId: '' })}
      />
    </div>
  );
}
