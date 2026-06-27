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
import { useTheme } from '../lib/ThemeContext';

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
  const { isLight } = useTheme();

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
              className={`w-full border rounded-2xl pl-12 pr-6 py-3.5 outline-none transition-all text-xs font-bold ${
                isLight 
                  ? 'bg-white border-black/35 text-black placeholder:text-gray-400 focus:ring-black/20 focus:border-black' 
                  : 'bg-[var(--theme-input-bg)] border-[var(--theme-border)] text-white placeholder:text-gray-500 focus:ring-primary-500/50'
              }`}
            />
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
              isLight ? 'text-black/50' : 'text-gray-500'
            }`} size={16} />
            {searchQuery.trim() !== '' && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-2 p-1.5 rounded-xl transition-all cursor-pointer border-0 bg-transparent ${
                  isLight ? 'text-black/40 hover:text-black hover:bg-black/5' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Listagem de Botões de Produtos */}
          {loading ? (
            <div className={`py-20 flex flex-col items-center justify-center border rounded-3xl ${
              isLight ? 'bg-white border-black/10' : 'bg-white/[0.02] border-white/5'
            }`}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
              <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-black/60' : 'text-gray-500'}`}>Carregando estoque...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={`py-20 text-center border border-dashed rounded-[2rem] p-12 space-y-4 ${
              isLight ? 'bg-white border-black/20' : 'bg-white/[0.02] border-white/5'
            }`}>
              <Package className="w-12 h-12 text-gray-600 mx-auto" strokeWidth={1} />
              <p className={`text-xs font-bold ${isLight ? 'text-black/60' : 'text-gray-500'}`}>Nenhum produto disponível para exibição no PDV.</p>
              <p className={`text-[10px] max-w-sm mx-auto ${isLight ? 'text-black/40' : 'text-gray-600'}`}>
                Cadastre seus produtos na aba **Estoque & Produtos** e ative a marcação **"Exibir no PDV"** para criar atalhos rápidos aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <span className={`text-[10px] font-black uppercase tracking-widest block pl-1 ${
                isLight ? 'text-black/80' : 'text-gray-500'
              }`}>
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
                          ? isLight 
                            ? 'bg-black/5 border-black/10 opacity-40 cursor-not-allowed' 
                            : 'bg-black/20 border-white/5 opacity-35 cursor-not-allowed'
                          : isLight
                            ? 'bg-white border-black/35 hover:border-black hover:bg-black/5 active:scale-95 active:bg-black/10 shadow-sm'
                            : 'bg-white/[0.03] border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 active:scale-95 active:bg-purple-500/10 shadow-md hover:shadow-purple-500/5'
                      }`}
                    >
                      {/* Efeito de brilho de fundo no hover */}
                      {!isOutOfStock && !isLight && (
                        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-purple-500/5 to-transparent group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
                      )}

                      {/* Header do Botão: Marca e Estoque */}
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className={`text-[8px] font-bold uppercase tracking-wider truncate ${
                          isLight ? 'text-black/60' : 'text-gray-500'
                        }`}>
                          {item.brand || 'Sem Marca'}
                        </span>
                        
                        {isOutOfStock ? (
                          <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 border ${
                            isLight 
                              ? 'bg-red-100 border-red-300 text-red-800' 
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}>
                            Sem Estoque
                          </span>
                        ) : isLowStock ? (
                          <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 border animate-pulse ${
                            isLight 
                              ? 'bg-amber-100 border-amber-300 text-amber-800' 
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            Baixo {item.quantity}un
                          </span>
                        ) : (
                          <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 border ${
                            isLight 
                              ? 'bg-black/5 border-black/10 text-black/80' 
                              : 'bg-white/5 border border-white/5 text-gray-400'
                          }`}>
                            {item.quantity} {item.unit}
                          </span>
                        )}
                      </div>

                      {/* Nome do Produto */}
                      <h5 className={`text-xs md:text-sm font-black transition-colors leading-snug line-clamp-2 uppercase ${
                        isOutOfStock 
                          ? isLight ? 'text-black/40' : 'text-gray-600' 
                          : isLight ? 'text-black' : 'text-white group-hover:text-purple-400'
                      }`}>
                        {item.name}
                      </h5>

                      {/* Preço de Venda */}
                      <div className={`border-t pt-3 w-full ${
                        isLight ? 'border-black/10' : 'border-white/5'
                      }`}>
                        <span className={`text-xs md:text-sm font-black block ${
                          isOutOfStock 
                            ? isLight ? 'text-black/40' : 'text-gray-600' 
                            : isLight ? 'text-black font-extrabold' : 'text-emerald-400 font-extrabold'
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
        <div className={`border rounded-[2rem] p-5 flex flex-col h-[650px] justify-between text-left ${
          isLight 
            ? 'bg-white border-black/35 text-black shadow-lg' 
            : 'bg-white/[0.03] border-white/10 text-white shadow-2xl backdrop-blur-2xl'
        }`}>
          
          <div className="space-y-4 flex flex-col min-h-0 flex-1">
            {/* Título do Carrinho */}
            <div className={`flex items-center justify-between pb-3 border-b ${
              isLight ? 'border-black/10' : 'border-white/5'
            }`}>
              <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                isLight ? 'text-black' : 'text-white'
              }`}>
                <ShoppingCart className={isLight ? 'text-black' : 'text-purple-400'} size={16} />
                Carrinho
              </h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                isLight 
                  ? 'bg-black/5 border-black/10 text-black' 
                  : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
              }`}>
                {getTotalItemsCount()} {getTotalItemsCount() === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {/* Associar Cliente à Venda */}
            <div className="space-y-1">
              <label className={`text-[9px] font-bold uppercase tracking-wider block ${
                isLight ? 'text-black/60' : 'text-gray-400'
              }`}>Associar Cliente (Opcional)</label>
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
                <div className={`py-20 text-center border border-dashed rounded-2xl flex flex-col justify-center items-center gap-2 h-full ${
                  isLight ? 'border-black/20' : 'border-white/5'
                }`}>
                  <ShoppingCart size={24} className={isLight ? 'text-black/30' : 'text-gray-700'} />
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-black/50' : 'text-gray-500'}`}>Carrinho Vazio</p>
                  <p className={`text-[9px] max-w-[150px] mx-auto leading-normal ${isLight ? 'text-black/40' : 'text-gray-600'}`}>
                    Clique nos botões de produtos ao lado para iniciar a venda.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const itemTotal = item.price * item.quantityInCart;
                  return (
                    <div 
                      key={item.id} 
                      className={`rounded-xl p-3 flex flex-col gap-2 relative group transition-colors border ${
                        isLight 
                          ? 'bg-black/5 border-black/15 hover:border-black/30' 
                          : 'bg-black/20 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className={`absolute right-2 top-2 transition-colors bg-transparent border-0 cursor-pointer p-0 ${
                          isLight ? 'text-black/40 hover:text-red-600' : 'text-gray-500 hover:text-red-400'
                        }`}
                        title="Remover"
                      >
                        <X size={12} />
                      </button>

                      <div className="pr-6 text-left">
                        <span className={`text-[8px] font-bold uppercase block tracking-wider truncate ${
                          isLight ? 'text-black/60' : 'text-gray-500'
                        }`}>
                          {item.brand || 'Sem Marca'}
                        </span>
                        <h6 className={`text-[11px] font-black truncate uppercase ${
                          isLight ? 'text-black' : 'text-white'
                        }`}>{item.name}</h6>
                      </div>

                      <div className={`flex items-center justify-between border-t pt-2 mt-0.5 ${
                        isLight ? 'border-black/10' : 'border-white/5'
                      }`}>
                        <span className={`text-xs font-black ${
                          isLight ? 'text-black' : 'text-emerald-400'
                        }`}>
                          R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>

                        {/* Controles de Quantidade */}
                        <div className={`flex items-center gap-1.5 rounded-lg p-0.5 border ${
                          isLight ? 'bg-black/10 border-black/10' : 'bg-black/40 border-white/5'
                        }`}>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityInCart - 1)}
                            className={`p-1 rounded transition-colors cursor-pointer border-0 bg-transparent ${
                              isLight ? 'text-black hover:bg-black/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Minus size={10} />
                          </button>
                          <span className={`text-[10px] font-black px-1 font-mono ${
                            isLight ? 'text-black' : 'text-white'
                          }`}>{item.quantityInCart}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityInCart + 1)}
                            className={`p-1 rounded transition-colors cursor-pointer border-0 bg-transparent ${
                              isLight ? 'text-black hover:bg-black/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
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
          <div className={`pt-4 space-y-4 shrink-0 bg-transparent border-t ${
            isLight ? 'border-black/15' : 'border-white/5'
          }`}>
            <div className="space-y-1.5 text-xs font-bold text-left">
              <div className="flex justify-between items-center text-gray-500">
                <span>Total de Itens:</span>
                <span className={isLight ? 'text-black' : 'text-white'}>{getTotalItemsCount()} un</span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span className={`uppercase tracking-wider ${isLight ? 'text-black' : 'text-white'}`}>Valor Total:</span>
                <span className={`text-lg font-black font-mono ${
                  isLight ? 'text-black' : 'text-emerald-400'
                }`}>
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
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:opacity-50 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-purple-600/10 cursor-pointer border-0"
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
            className={`w-full max-w-md border rounded-[2rem] p-6 md:p-8 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left ${
              isLight ? 'bg-white border-black/35 text-black' : 'bg-[#0b0c10] border-white/10 text-white'
            }`}
          >
            {/* Fechar */}
            <button 
              onClick={() => setIsCheckoutModalOpen(false)}
              className={`absolute right-6 top-6 p-1.5 border rounded-xl transition-all cursor-pointer border-0 ${
                isLight 
                  ? 'bg-black/5 border-black/10 hover:bg-black/10 text-black/60 hover:text-black' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <span className="text-[8px] text-purple-600 font-black uppercase tracking-widest block flex items-center gap-1">
                <Sparkles size={8} /> Operação de Fechamento de Caixa
              </span>
              <h4 className={`text-base font-black uppercase tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
                Checkout de Venda
              </h4>
              <p className={`text-[11px] ${isLight ? 'text-black/60' : 'text-gray-500'}`}>
                Registre a forma de pagamento física e confirme para deduzir o estoque e criar o lançamento financeiro.
              </p>
            </div>

            {/* Display Gigante de Cobrança */}
            <div className={`p-5 rounded-2xl text-center space-y-1 shadow-inner border ${
              isLight ? 'bg-black/5 border-black/15' : 'bg-black/40 border border-white/10'
            }`}>
              <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                isLight ? 'text-black/60' : 'text-gray-500'
              }`}>Inserir Valor na Maquininha / Cobrar</span>
              <p className={`text-3xl font-black font-mono ${isLight ? 'text-black' : 'text-emerald-400'}`}>
                R$ {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className={`text-[9px] italic block mt-1 ${isLight ? 'text-black/60' : 'text-gray-500'}`}>
                Cliente: {consolidatedClients.find(c => c.phone.replace(/\D/g, '') === selectedClientPhone)?.name || 'Cliente Avulso'}
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleCheckoutSubmit} className="space-y-5">
              
              {/* Seletor de Forma de Pagamento */}
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-wider block pl-0.5 ${
                  isLight ? 'text-black/60' : 'text-gray-500'
                }`}>Forma de Pagamento Recebida</label>
                
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'dinheiro', label: 'Dinheiro', icon: DollarSign, color: isLight ? 'hover:bg-black/5 text-black border-black/20' : 'hover:text-emerald-400 hover:border-emerald-500/30' },
                    { id: 'pix', label: 'PIX', icon: Sparkles, color: isLight ? 'hover:bg-black/5 text-black border-black/20' : 'hover:text-cyan-400 hover:border-cyan-500/30' },
                    { id: 'cartao_credito', label: 'C. Crédito', icon: CreditCard, color: isLight ? 'hover:bg-black/5 text-black border-black/20' : 'hover:text-purple-400 hover:border-purple-500/30' },
                    { id: 'cartao_debito', label: 'C. Débito', icon: CreditCard, color: isLight ? 'hover:bg-black/5 text-black border-black/20' : 'hover:text-blue-400 hover:border-blue-500/30' }
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
                            ? isLight
                              ? 'bg-black text-white border-black font-black shadow-md'
                              : 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/10 font-black' 
                            : isLight
                              ? 'bg-white border border-black/35 text-black hover:bg-black/5'
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
                <div className={`border rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2 duration-200 ${
                  isLight ? 'bg-black/5 border-black/15' : 'bg-white/[0.02] border-white/5'
                }`}>
                  <div className="space-y-1">
                    <label className={`text-[9px] font-bold uppercase tracking-wider block ${
                      isLight ? 'text-black/60' : 'text-gray-400'
                    }`}>Valor Pago em Espécie (R$)</label>
                    <input
                      type="text"
                      placeholder="Ex: 50,00"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs outline-none transition-all placeholder-gray-500 font-mono focus:ring-1 border ${
                        isLight 
                          ? 'bg-white border-black/35 text-black focus:ring-black' 
                          : 'bg-black/40 border border-white/10 text-white focus:ring-purple-500'
                      }`}
                      autoFocus
                    />
                  </div>

                  {amountPaid && (
                    <div className={`flex justify-between items-center pt-2 border-t text-xs font-bold ${
                      isLight ? 'border-black/15' : 'border-white/5'
                    }`}>
                      <span className={isLight ? 'text-black/60' : 'text-gray-500'}>Troco a Devolver:</span>
                      <span className={`font-mono text-sm ${
                        changeValue > 0 
                          ? isLight ? 'text-black font-black' : 'text-amber-400 font-black' 
                          : isLight ? 'text-black/40' : 'text-gray-400'
                      }`}>
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
                  className={`flex-1 py-3.5 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0 ${
                    isLight 
                      ? 'bg-black/5 hover:bg-black/10 text-black' 
                      : 'bg-white/5 hover:bg-white/10 text-white'
                  }`}
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
