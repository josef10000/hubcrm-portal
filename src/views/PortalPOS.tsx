import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { 
  Search, ShoppingCart, Plus, Minus, X, Check, Coins, AlertTriangle, Monitor, Package 
} from 'lucide-react';
import { toast } from 'sonner';

interface PortalPOSProps {
  orgId: string;
}

// Função utilitária para decodificar metadados no campo name
const parseNameAndMetadata = (rawName: string) => {
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

export default function PortalPOS({ orgId }: PortalPOSProps) {
  const [items, setItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Quantidade / Venda
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          sales: meta.sales
        };
      });
      setItems(list);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar estoque no PDV:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  // Filtra itens favoritos (exibir no PDV) + sugestões automáticas baseadas em popularidade (vendas)
  const manualFavorites = items.filter(item => item.showInPos === true);
  const autoFavorites = items
    .filter(item => !item.showInPos && item.sales && item.sales > 0)
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 8); // Top 8 mais vendidos não favoritos

  const posFavorites = [...manualFavorites, ...autoFavorites];

  const filteredSearchItems = searchQuery.trim() === '' 
    ? [] 
    : items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())));

  // Abrir modal de venda para o item
  const handleOpenSellModal = (item: any) => {
    if (item.quantity <= 0) {
      toast.error(`O produto "${item.name}" está sem estoque.`);
      return;
    }
    setSelectedItem(item);
    setSellQuantity(1);
  };

  // Registrar a venda e deduzir do estoque
  const handleConfirmSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !orgId) return;
    if (sellQuantity <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    if (sellQuantity > selectedItem.quantity) {
      toast.error(`Estoque insuficiente. Disponível: ${selectedItem.quantity} ${selectedItem.unit}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const newQty = selectedItem.quantity - sellQuantity;
      const docRef = doc(db, 'organizations', orgId, 'inventory', selectedItem.id);

      // 1. Re-codifica o nome com o contador de vendas (sales) incrementado
      const newSales = (selectedItem.sales || 0) + sellQuantity;
      const encodedName = `${selectedItem.name.trim()} [brand: ${(selectedItem.brand || '').trim()} | price: ${selectedItem.price || 0} | pdv: ${selectedItem.showInPos || false} | sales: ${newSales}]`;

      // 2. Atualizar estoque e nome codificado no Firestore
      await updateDoc(docRef, {
        name: encodedName,
        quantity: newQty,
        updatedAt: serverTimestamp()
      });

      // 2. Gravar log de movimentação
      const itemPrice = selectedItem.price || 0;
      const totalPrice = itemPrice * sellQuantity;
      const logDescription = `Venda via PDV: -${sellQuantity}${selectedItem.unit} de ${selectedItem.name}${selectedItem.brand ? ` (${selectedItem.brand})` : ''}.${itemPrice > 0 ? ` Preço unitário: R$ ${itemPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Total: R$ ${totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.` : ''}`;

      try {
        await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
          itemId: selectedItem.id,
          itemName: selectedItem.name, // Salva o nome limpo no log
          type: 'saida',
          quantity: sellQuantity,
          date: serverTimestamp(),
          description: logDescription
        });
      } catch (logErr) {
        console.warn("[PortalPOS] Sem permissão para gravar log de inventário:", logErr);
      }

      toast.success(`Venda registrada com sucesso! ${selectedItem.name}: ${newQty} ${selectedItem.unit} restantes.`);
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar a venda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Processa a venda rápida de 1 unidade diretamente
  const handleQuickSell = async (item: any) => {
    if (item.quantity <= 0 || !orgId) {
      toast.error(`O produto "${item.name}" está sem estoque.`);
      return;
    }

    try {
      const newQty = item.quantity - 1;
      const docRef = doc(db, 'organizations', orgId, 'inventory', item.id);

      // 1. Re-codifica o nome com o contador de vendas (sales) incrementado
      const newSales = (item.sales || 0) + 1;
      const encodedName = `${item.name.trim()} [brand: ${(item.brand || '').trim()} | price: ${item.price || 0} | pdv: ${item.showInPos || false} | sales: ${newSales}]`;

      // 2. Atualizar estoque no Firestore
      await updateDoc(docRef, {
        name: encodedName,
        quantity: newQty,
        updatedAt: serverTimestamp()
      });

      // 3. Gravar log de movimentação
      const itemPrice = item.price || 0;
      const logDescription = `Venda rápida via PDV: -1${item.unit} de ${item.name}${item.brand ? ` (${item.brand})` : ''}.${itemPrice > 0 ? ` Preço unitário: R$ ${itemPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.` : ''}`;

      try {
        await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
          itemId: item.id,
          itemName: item.name,
          type: 'saida',
          quantity: 1,
          date: serverTimestamp(),
          description: logDescription
        });
      } catch (logErr) {
        console.warn("[PortalPOS] Sem permissão para gravar log de inventário:", logErr);
      }

      toast.success(`Vendido: 1x ${item.name}! (${newQty} restam)`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar venda rápida.');
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Barra superior de Busca */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative group flex-1 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Buscar outro produto do estoque por nome ou marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-2xl pl-12 pr-6 py-3.5 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-xs font-bold placeholder:text-gray-500"
          />
        </div>
        
        {searchQuery.trim() !== '' && (
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-gray-400 hover:text-white rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <X size={14} />
            Limpar Busca
          </button>
        )}
      </div>

      {/* Resultados de Busca */}
      {searchQuery.trim() !== '' && (
        <div 
          className="border border-[var(--theme-border)] rounded-[2rem] p-5 space-y-4"
          style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
        >
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Resultados da Busca</span>
          
          {filteredSearchItems.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Nenhum produto correspondente encontrado no estoque.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSearchItems.map((item) => {
                const isOutOfStock = item.quantity <= 0;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden w-full group shadow-sm min-h-[110px] ${
                      isOutOfStock
                        ? 'opacity-40 border-white/5 bg-black/10'
                        : 'bg-[var(--theme-glass)] border-[var(--theme-border-subtle)] hover:border-primary-500/40 hover:bg-[var(--theme-glass-hover)] hover:-translate-y-0.5'
                    }`}
                  >
                    {!isOutOfStock && (
                      <button
                        onClick={() => handleQuickSell(item)}
                        className="absolute inset-0 bg-transparent border-0 cursor-pointer w-full h-full z-10"
                        title="Venda Rápida (1 un)"
                      />
                    )}

                    <div className="z-20 pointer-events-none">
                      <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">{item.brand || 'Sem Marca'}</span>
                      <h5 className="text-xs font-black text-white mt-1 group-hover:text-primary-400 transition-colors truncate">{item.name}</h5>
                    </div>

                    <div className="flex items-center justify-between mt-4 border-t border-[var(--theme-border-subtle)] pt-3 w-full z-20">
                      <span className="text-emerald-400 text-xs font-black pointer-events-none">
                        {item.price ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${item.quantity <= item.minQuantity ? 'text-amber-400' : 'text-gray-400'} pointer-events-none mr-1`}>
                          Estoque: {item.quantity} {item.unit}
                        </span>
                        {!isOutOfStock && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenSellModal(item); }}
                            className="px-2 py-0.5 bg-white/5 border border-white/10 hover:bg-primary-500 hover:text-white rounded-lg text-[8px] uppercase tracking-wider text-gray-300 font-black transition-all cursor-pointer pointer-events-auto"
                            title="Especificar quantidade..."
                          >
                            Qtd
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Favoritos / Produtos Mais Vendidos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="text-primary-500 w-5 h-5" />
          <h4 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>Favoritos do Caixa (Mais Vendidos)</h4>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
            <p className="text-gray-500 text-xs">Carregando painel de vendas...</p>
          </div>
        ) : posFavorites.length === 0 ? (
          <div 
            className="border border-[var(--theme-border)] rounded-[2rem] p-12 text-center space-y-4"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            <Package className="w-12 h-12 text-gray-600 mx-auto" strokeWidth={1} />
            <p className="text-xs text-gray-500 font-bold">Nenhum produto favorito configurado para o PDV.</p>
            <p className="text-[10px] text-gray-500 max-w-md mx-auto">
              Para cadastrar botões rápidos aqui, edite ou crie produtos no **Estoque & Produtos** e marque a opção **"Exibir no PDV"**!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {posFavorites.map((item) => {
              const isOutOfStock = item.quantity <= 0;
              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-[2rem] border text-left flex flex-col justify-between aspect-square transition-all relative overflow-hidden w-full group shadow-md hover:shadow-lg hover:-translate-y-1 ${
                    isOutOfStock
                      ? 'opacity-30 border-white/5 bg-black/10'
                      : 'bg-[var(--theme-glass)] border-[var(--theme-border-subtle)] hover:border-primary-500/40 hover:bg-[var(--theme-glass-hover)]'
                  }`}
                >
                  {!isOutOfStock && (
                    <button
                      onClick={() => handleQuickSell(item)}
                      className="absolute inset-0 bg-transparent border-0 cursor-pointer w-full h-full z-10"
                      title="Venda Rápida (1 un)"
                    />
                  )}

                  <div className="space-y-1 overflow-hidden w-full text-left z-20 relative pointer-events-none">
                    <div className="flex justify-between items-start gap-1 w-full">
                      <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block truncate">{item.brand || 'Sem Marca'}</span>
                      {!item.showInPos && (
                        <span className="text-[7px] bg-primary-500/10 border border-primary-500/20 text-primary-400 font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">
                          Mais Vendido
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs md:text-sm font-black text-white group-hover:text-primary-400 transition-colors line-clamp-2 uppercase leading-snug">{item.name}</h5>
                  </div>

                  <div className="flex flex-col gap-1.5 border-t border-[var(--theme-border-subtle)] pt-4 w-full text-left z-20 relative">
                    <span className="text-emerald-400 text-xs md:text-sm font-black pointer-events-none">
                      {item.price ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                    </span>
                    
                    <div className="flex items-center justify-between w-full text-[9px] font-bold">
                      <span className="text-gray-500 pointer-events-none">Estoque:</span>
                      <span className={`${item.quantity <= item.minQuantity ? 'text-amber-400 animate-pulse font-black' : 'text-gray-400'} pointer-events-none mr-1`}>
                        {item.quantity} {item.unit}
                      </span>
                      {!isOutOfStock && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenSellModal(item); }}
                          className="px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-primary-500 hover:text-white rounded-lg text-[8px] uppercase tracking-wider text-gray-300 font-black transition-all cursor-pointer pointer-events-auto"
                          title="Especificar quantidade..."
                        >
                          Qtd
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Quantidade e Confirmação da Venda */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md rounded-[2.5rem] border border-[var(--theme-border)] p-6 md:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            {/* Fechar */}
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute right-6 top-6 p-1.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-gray-400 hover:text-white transition-all bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <span className="text-[8px] text-primary-500 font-black uppercase tracking-widest block">Operação PDV</span>
              <h4 className="text-lg font-black uppercase tracking-tight truncate" style={{ color: 'var(--theme-text-primary)' }}>
                {selectedItem.name}
              </h4>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider block mt-0.5">
                Marca: {selectedItem.brand || 'Sem Marca'}
              </p>
            </div>

            {/* Info Estoque e Preço */}
            <div className="grid grid-cols-2 gap-4 bg-[var(--theme-glass)] p-4 rounded-2xl border border-[var(--theme-border-subtle)] text-xs text-left">
              <div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Estoque Atual</span>
                <p className="font-bold text-sm text-white mt-0.5">{selectedItem.quantity} {selectedItem.unit}</p>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Preço Unitário</span>
                <p className="font-black text-sm text-emerald-400 mt-0.5">
                  R$ {selectedItem.price ? Number(selectedItem.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmSale} className="space-y-6">
              
              {/* Seletor de Quantidade */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Quantidade a ser Vendida</label>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                    className="p-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-white transition-all cursor-pointer select-none bg-transparent"
                  >
                    <Minus size={16} />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    required
                    value={sellQuantity}
                    onChange={(e) => setSellQuantity(Math.min(selectedItem.quantity, Math.max(1, Number(e.target.value))))}
                    className="flex-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl py-2.5 text-center text-sm font-black focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                  />

                  <button
                    type="button"
                    onClick={() => setSellQuantity(Math.min(selectedItem.quantity, sellQuantity + 1))}
                    className="p-3 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-white transition-all cursor-pointer select-none bg-transparent"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Totalizador da Venda */}
              {selectedItem.price > 0 && (
                <div className="flex items-center justify-between border-t border-[var(--theme-border-subtle)] pt-4 text-xs font-bold">
                  <span className="text-gray-500 uppercase">Valor Total</span>
                  <span className="text-emerald-400 text-base font-black">
                    R$ {(selectedItem.price * sellQuantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Botões Ação */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-emerald-700/10 border-0 cursor-pointer"
              >
                <Check size={16} />
                {isSubmitting ? 'Processando...' : 'Confirmar e Subtrair do Estoque'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
