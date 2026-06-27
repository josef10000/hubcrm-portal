import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { 
  Search, ShoppingCart, Plus, Minus, X, Check, DollarSign, CreditCard, Users, Trash2, Package, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';

interface PortalPOSProps {
  orgId: string;
  clientId: string;
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

export default function PortalPOS({ orgId, clientId }: PortalPOSProps) {
  // Lista de produtos do Estoque
  const [items, setItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Lista de clientes para associar à venda
  const [manualClients, setManualClients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consolidatedClients, setConsolidatedClients] = useState<any[]>([]);
  const [deletedClientsPhones, setDeletedClientsPhones] = useState<string[]>([]);
  
  // Carrinho de Compras
  const [cart, setCart] = useState<any[]>([]);
  const [selectedClientPhone, setSelectedClientPhone] = useState<string>('');

  // Checkout Modal e Estados
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito'>('dinheiro');
  const [amountPaid, setAmountPaid] = useState<string>(''); // Para cálculo de troco
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

  // Escuta dados de clientes do profissional logado
  useEffect(() => {
    if (!orgId || !clientId) return;
    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fid = data.fidelitySettings || {};
        setManualClients(fid.crmClients || []);
        setDeletedClientsPhones(fid.crmDeletedPhones || []);
      }
    }, (error) => {
      console.warn("Erro ao escutar clientes manuais no PDV:", error.message);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // Escuta agendamentos da organização para obter mais clientes
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'appointments');
    const q = query(ref, orderBy('time', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    }, (error) => {
      console.warn("Erro ao escutar agendamentos no PDV:", error.message);
    });
    return () => unsub();
  }, [orgId]);

  // Consolidar lista de clientes cadastrados e da agenda
  useEffect(() => {
    const clientsMap = new Map<string, { id: string; name: string; phone: string; email?: string }>();

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

    const sorted = Array.from(clientsMap.values())
      .filter(c => {
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        return !deletedClientsPhones.includes(cleanPhone) && cleanPhone !== '11914573272' && c.id !== clientId;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setConsolidatedClients(sorted);
  }, [manualClients, appointments, deletedClientsPhones, clientId]);

  // Filtra itens favoritos (exibir no PDV) + mais vendidos
  const manualFavorites = items.filter(item => item.showInPos === true);
  const autoFavorites = items
    .filter(item => !item.showInPos && item.sales && item.sales > 0)
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 8);

  const posProducts = [...manualFavorites, ...autoFavorites];

  // Filtra por busca digitada
  const filteredProducts = searchQuery.trim() === ''
    ? posProducts
    : items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  // Adicionar produto ao carrinho
  const addToCart = (product: any) => {
    if (product.quantity <= 0) {
      toast.error(`O produto "${product.name}" está sem estoque.`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.id === product.id);
    if (existingIndex !== -1) {
      const currentQty = cart[existingIndex].quantityInCart;
      if (currentQty >= product.quantity) {
        toast.error(`Quantidade máxima em estoque atingida (${product.quantity} un).`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantityInCart += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...product, quantityInCart: 1 }]);
    }
    toast.success(`"${product.name}" adicionado ao carrinho!`);
  };

  // Atualiza quantidade no carrinho
  const updateCartQuantity = (itemId: string, newQty: number) => {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;

    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }

    if (newQty > item.quantity) {
      toast.error(`Estoque máximo disponível: ${item.quantity} ${item.unit}.`);
      return;
    }

    setCart(cart.map(i => i.id === itemId ? { ...i, quantityInCart: newQty } : i));
  };

  // Remover item do carrinho
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Calcular subtotal do carrinho
  const getSubtotal = () => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantityInCart), 0);
  };

  // Obter quantidade total de itens no carrinho
  const getTotalItemsCount = () => {
    return cart.reduce((acc, item) => acc + item.quantityInCart, 0);
  };

  // Converter método de pagamento para texto legível
  const paymentMethodLabel = (method: string) => {
    switch (method) {
      case 'dinheiro': return 'Dinheiro';
      case 'pix': return 'PIX';
      case 'cartao_credito': return 'Cartão de Crédito';
      case 'cartao_debito': return 'Cartão de Débito';
      default: return 'Outro';
    }
  };

  // Confirmação final da venda e integração com estoque + receitas financeiras
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !orgId) return;

    const totalAmount = getSubtotal();
    
    // Se for dinheiro, valida o troco
    if (checkoutPaymentMethod === 'dinheiro' && amountPaid) {
      const paidNum = Number(amountPaid.replace(',', '.'));
      if (paidNum < totalAmount) {
        toast.error('O valor pago pelo cliente é inferior ao total da venda.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Atualizar o estoque e sales de cada produto no Firestore
      for (const cartItem of cart) {
        const docRef = doc(db, 'organizations', orgId, 'inventory', cartItem.id);
        const newQty = Math.max(0, cartItem.quantity - cartItem.quantityInCart);
        const newSales = (cartItem.sales || 0) + cartItem.quantityInCart;
        
        const encodedName = `${cartItem.name.trim()} [brand: ${(cartItem.brand || '').trim()} | price: ${cartItem.price || 0} | pdv: ${cartItem.showInPos || false} | sales: ${newSales}]`;
        
        await updateDoc(docRef, {
          name: encodedName,
          quantity: newQty,
          updatedAt: serverTimestamp()
        });

        // 2. Gravar logs de movimentação de inventário (de forma discreta no Firestore)
        const itemPrice = cartItem.price || 0;
        const itemTotal = itemPrice * cartItem.quantityInCart;
        const logDescription = `Venda PDV (Método: ${paymentMethodLabel(checkoutPaymentMethod)}): -${cartItem.quantityInCart}${cartItem.unit} de ${cartItem.name}.${itemPrice > 0 ? ` Preço unitário: R$ ${itemPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Total: R$ ${itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.` : ''}`;
        
        try {
          await addDoc(collection(db, 'organizations', orgId, 'inventory_logs'), {
            itemId: cartItem.id,
            itemName: cartItem.name,
            type: 'saida',
            quantity: cartItem.quantityInCart,
            date: serverTimestamp(),
            description: logDescription
          });
        } catch (logErr) {
          console.info("[PortalPOS] Histórico de movimentações local indisponível para este perfil.");
        }
      }

      // 3. Registrar a receita no Financeiro (revenues) da organização
      const selectedClientObj = consolidatedClients.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientPhone);
      
      const revenuePayload = {
        description: `Venda de produtos PDV (${cart.map(i => `${i.quantityInCart}x ${i.name}`).join(', ')})`,
        amount: totalAmount,
        date: new Date().toISOString().split('T')[0],
        category: 'Venda de Produtos',
        paymentMethod: checkoutPaymentMethod,
        clientId: clientId, // Profissional logado
        clientName: selectedClientObj ? selectedClientObj.name : 'Cliente Avulso',
        clientPhone: selectedClientObj ? selectedClientObj.phone : '',
        createdAt: serverTimestamp(),
        status: 'paid'
      };

      await addDoc(collection(db, 'organizations', orgId, 'revenues'), revenuePayload);

      toast.success('Venda de produtos finalizada e registrada no financeiro!');
      
      // Limpeza de estados
      setCart([]);
      setSelectedClientPhone('');
      setAmountPaid('');
      setIsCheckoutModalOpen(false);
    } catch (err) {
      console.error("Erro ao registrar venda:", err);
      toast.error('Erro ao finalizar a transação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cálculos de troco no modal
  const totalToPay = getSubtotal();
  const paidValue = amountPaid ? Number(amountPaid.replace(',', '.')) : 0;
  const changeValue = Math.max(0, paidValue - totalToPay);

  return (
    <div className="space-y-6 text-left">
      
      {/* Grade Principal: Produtos na Esquerda, Carrinho na Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Coluna Esquerda: Listagem e Busca de Produtos */}
        <div className="lg:col-span-2 space-y-5">
          {/* Barra de Busca */}
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Buscar produtos por nome ou marca no estoque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-2xl pl-12 pr-6 py-3.5 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-xs font-bold placeholder:text-gray-500"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-500 transition-colors" size={16} />
            {searchQuery.trim() !== '' && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer border-0 bg-transparent"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Listagem de Botões de Produtos */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-3xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Carregando estoque...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.02] p-12 space-y-4">
              <Package className="w-12 h-12 text-gray-600 mx-auto" strokeWidth={1} />
              <p className="text-xs text-gray-500 font-bold">Nenhum produto disponível para exibição no PDV.</p>
              <p className="text-[10px] text-gray-600 max-w-sm mx-auto">
                Cadastre seus produtos na aba **Estoque & Produtos** e ative a marcação **"Exibir no PDV"** para criar atalhos rápidos aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest block pl-1">
                {searchQuery.trim() !== '' ? 'Resultados da Busca' : 'Botões Rápidos do Caixa'}
              </span>

              {/* Botões Reativos Reais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredProducts.map((item) => {
                  const isOutOfStock = item.quantity <= 0;
                  const isLowStock = item.quantity <= (item.minQuantity || 1);
                  return (
                    <button
                      key={item.id}
                      disabled={isOutOfStock}
                      onClick={() => addToCart(item)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between aspect-square transition-all relative overflow-hidden select-none outline-none group cursor-pointer border-0 ${
                        isOutOfStock
                          ? 'bg-black/20 border-white/5 opacity-35 cursor-not-allowed'
                          : 'bg-white/[0.03] border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 active:scale-95 active:bg-purple-500/10 shadow-md hover:shadow-purple-500/5'
                      }`}
                    >
                      {/* Efeito de brilho de fundo no hover */}
                      {!isOutOfStock && (
                        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-purple-500/5 to-transparent group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
                      )}

                      {/* Header do Botão: Marca e Estoque */}
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider truncate">
                          {item.brand || 'Sem Marca'}
                        </span>
                        
                        {isOutOfStock ? (
                          <span className="text-[7px] bg-red-500/10 border border-red-500/20 text-red-400 font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">
                            Sem Estoque
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[7px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
                            Baixo {item.quantity}un
                          </span>
                        ) : (
                          <span className="text-[7px] bg-white/5 border border-white/5 text-gray-400 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">
                            {item.quantity} {item.unit}
                          </span>
                        )}
                      </div>

                      {/* Nome do Produto */}
                      <h5 className={`text-xs md:text-sm font-black transition-colors leading-snug line-clamp-2 uppercase ${
                        isOutOfStock ? 'text-gray-600' : 'text-white group-hover:text-purple-400'
                      }`}>
                        {item.name}
                      </h5>

                      {/* Preço de Venda */}
                      <div className="border-t border-white/5 pt-3 w-full">
                        <span className={`text-xs md:text-sm font-black block ${
                          isOutOfStock ? 'text-gray-600' : 'text-emerald-400'
                        }`}>
                          {item.price ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Coluna Direita: Carrinho de Compras */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 shadow-2xl flex flex-col h-[650px] justify-between text-left">
          
          <div className="space-y-4 flex flex-col min-h-0 flex-1">
            {/* Título do Carrinho */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                <ShoppingCart className="text-purple-400" size={16} />
                Carrinho
              </h3>
              <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black px-2 py-0.5 rounded-lg">
                {getTotalItemsCount()} {getTotalItemsCount() === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {/* Associar Cliente à Venda */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Associar Cliente (Opcional)</label>
              <CustomSelect
                value={selectedClientPhone}
                onChange={(val) => setSelectedClientPhone(val)}
                placeholder="Cliente Avulso (Padrão)"
                options={[
                  { value: '', label: 'Cliente Avulso (Padrão)' },
                  ...consolidatedClients.map(c => ({
                    value: c.phone.replace(/\D/g, ''),
                    label: `${c.name} (${c.phone})`
                  }))
                ]}
              />
            </div>

            {/* Lista dos Itens no Carrinho */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar min-h-0 pt-2">
              {cart.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl flex flex-col justify-center items-center gap-2 h-full">
                  <ShoppingCart size={24} className="text-gray-700" />
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Carrinho Vazio</p>
                  <p className="text-[9px] text-gray-600 max-w-[150px] mx-auto leading-normal">
                    Clique nos botões de produtos ao lado para iniciar a venda.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const itemTotal = item.price * item.quantityInCart;
                  return (
                    <div 
                      key={item.id} 
                      className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative group hover:border-white/10 transition-colors"
                    >
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="absolute right-2 top-2 text-gray-500 hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer p-0"
                        title="Remover"
                      >
                        <X size={12} />
                      </button>

                      <div className="pr-6">
                        <span className="text-[8px] text-gray-500 font-bold uppercase block tracking-wider truncate">
                          {item.brand || 'Sem Marca'}
                        </span>
                        <h6 className="text-[11px] font-black text-white truncate uppercase">{item.name}</h6>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-0.5">
                        <span className="text-emerald-400 text-xs font-black">
                          R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>

                        {/* Controles de Quantidade */}
                        <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-lg p-0.5">
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityInCart - 1)}
                            className="p-1 hover:bg-white/5 text-gray-400 hover:text-white rounded transition-colors cursor-pointer border-0 bg-transparent"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-[10px] text-white font-black px-1 font-mono">{item.quantityInCart}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityInCart + 1)}
                            className="p-1 hover:bg-white/5 text-gray-400 hover:text-white rounded transition-colors cursor-pointer border-0 bg-transparent"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Resumo Financeiro e Finalização */}
          <div className="border-t border-white/5 pt-4 space-y-4 shrink-0 bg-transparent">
            <div className="space-y-1.5 text-xs font-bold">
              <div className="flex justify-between items-center text-gray-500">
                <span>Total de Itens:</span>
                <span>{getTotalItemsCount()} un</span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span className="uppercase tracking-wider">Valor Total:</span>
                <span className="text-emerald-400 text-lg font-black font-mono">
                  R$ {getSubtotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (cart.length === 0) return;
                setCheckoutPaymentMethod('dinheiro');
                setAmountPaid('');
                setIsCheckoutModalOpen(true);
              }}
              disabled={cart.length === 0}
              className="w-full py-4 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
            >
              <Check size={16} /> Finalizar Venda
            </button>
          </div>

        </div>

      </div>

      {/* Modal de Checkout / Recebimento */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 md:p-8 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left"
          >
            {/* Fechar */}
            <button 
              onClick={() => setIsCheckoutModalOpen(false)}
              className="absolute right-6 top-6 p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <span className="text-[8px] text-purple-400 font-black uppercase tracking-widest block flex items-center gap-1">
                <Sparkles size={8} /> Operação de Fechamento de Caixa
              </span>
              <h4 className="text-base font-black uppercase tracking-tight text-white">
                Checkout de Venda
              </h4>
              <p className="text-gray-500 text-[11px]">
                Registre a forma de pagamento física e confirme para deduzir o estoque e criar o lançamento financeiro.
              </p>
            </div>

            {/* Display Gigante de Cobrança */}
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl text-center space-y-1 shadow-inner">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Inserir Valor na Maquininha / Cobrar</span>
              <p className="text-3xl font-black text-emerald-400 font-mono">
                R$ {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[9px] text-gray-500 italic block mt-1">
                Cliente: {consolidatedClients.find(c => c.phone.replace(/\D/g, '') === selectedClientPhone)?.name || 'Cliente Avulso'}
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleCheckoutSubmit} className="space-y-5">
              
              {/* Seletor de Forma de Pagamento */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block pl-0.5">Forma de Pagamento Recebida</label>
                
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'dinheiro', label: 'Dinheiro', icon: DollarSign, color: 'hover:text-emerald-400 hover:border-emerald-500/30' },
                    { id: 'pix', label: 'PIX', icon: Sparkles, color: 'hover:text-cyan-400 hover:border-cyan-500/30' },
                    { id: 'cartao_credito', label: 'C. Crédito', icon: CreditCard, color: 'hover:text-purple-400 hover:border-purple-500/30' },
                    { id: 'cartao_debito', label: 'C. Débito', icon: CreditCard, color: 'hover:text-blue-400 hover:border-blue-500/30' }
                  ].map((method) => {
                    const isSelected = checkoutPaymentMethod === method.id;
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setCheckoutPaymentMethod(method.id as any);
                          if (method.id !== 'dinheiro') setAmountPaid('');
                        }}
                        className={`p-3.5 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-0 active:scale-95 ${
                          isSelected 
                            ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/10 font-black' 
                            : `bg-white/[0.02] border-white/5 text-gray-400 ${method.color}`
                        }`}
                      >
                        <Icon size={14} /> {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculadora de Troco (Se Dinheiro) */}
              {checkoutPaymentMethod === 'dinheiro' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Valor Pago em Espécie (R$)</label>
                    <input
                      type="text"
                      placeholder="Ex: 50,00"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 font-mono focus:ring-1 focus:ring-purple-500"
                      autoFocus
                    />
                  </div>

                  {amountPaid && (
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs font-bold">
                      <span className="text-gray-500 uppercase">Troco a Devolver:</span>
                      <span className={`font-mono text-sm ${changeValue > 0 ? 'text-amber-400 font-black' : 'text-gray-400'}`}>
                        R$ {changeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botões Ação */}
              <div className="flex gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-emerald-600/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {isSubmitting ? 'Processando...' : 'Confirmar Venda'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
