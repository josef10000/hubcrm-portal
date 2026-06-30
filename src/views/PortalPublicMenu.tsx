import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, setDoc, addDoc, getDocs, updateDoc, increment, query, where, serverTimestamp, arrayUnion 
} from 'firebase/firestore';
import { 
  ShoppingBag, Search, Plus, Minus, X, Check, Phone, MapPin, Send, ArrowLeft, CheckCircle2, Globe, Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  brand?: string;
  visibleOnline?: boolean;
  imageUrl?: string;
}

interface CartItem {
  product: MenuItem;
  quantity: number;
  notes: string;
  selectedAdditions: { name: string; price: number }[];
}

export default function PortalPublicMenu() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Organização
  const [orgData, setOrgData] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Modal de Detalhes
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');
  const [tempAdditions, setTempAdditions] = useState<{ name: string; price: number; checked: boolean }[]>([]);

  // Checkout
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  // Opcionais padrão sugeridos por categoria
  const getAdditionsForCategory = (categoryName: string) => {
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('burger') || cat.includes('lanche') || cat.includes('hambú')) {
      return [
        { name: 'Cheddar Extra', price: 4.50 },
        { name: 'Bacon Crocante', price: 5.00 },
        { name: 'Hambúrguer Adicional', price: 9.00 },
        { name: 'Molho Especial Extra', price: 2.00 }
      ];
    }
    if (cat.includes('pizza') || cat.includes('massa')) {
      return [
        { name: 'Borda Recheada Catupiry', price: 8.00 },
        { name: 'Borda Recheada Cheddar', price: 8.00 },
        { name: 'Queijo Extra', price: 6.00 },
        { name: 'Orégano Extra', price: 0.00 }
      ];
    }
    if (cat.includes('bebida') || cat.includes('suco')) {
      return [
        { name: 'Gelo e Limão', price: 1.00 },
        { name: 'Copo Descartável', price: 0.00 }
      ];
    }
    return [
      { name: 'Embalagem Especial para Viagem', price: 2.00 }
    ];
  };

  // Carrega Organização e Produtos
  useEffect(() => {
    if (!orgId) {
      setError('Organização não informada.');
      setLoading(false);
      return;
    }

    const loadMenu = async () => {
      try {
        // Carrega dados da Org pela API pública do CRM para manter consistência de logotipo/identidade
        const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
        let orgDetails = { name: 'Estabelecimento', imageUrl: '', phone: '', active: true, bannerUrl: '' };
        
        try {
          const res = await fetch(`${crmApiUrl}/api/portal_handler?action=public_get_bio&orgId=${orgId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.org) {
              orgDetails = {
                name: data.org.name || 'Estabelecimento',
                imageUrl: data.org.logoUrl || data.org.logo || data.org.imageUrl || '',
                phone: data.org.phone || '',
                active: true,
                bannerUrl: ''
              };
            }
          }
        } catch (apiErr) {
          console.warn('Erro ao ler org via API do CRM, utilizando fallback.', apiErr);
        }

        // Tenta buscar configurações específicas de delivery do Firestore
        try {
          const orgDocRef = doc(db, 'organizations', orgId);
          const orgSnap = await getDoc(orgDocRef);
          if (orgSnap.exists()) {
            const orgData = orgSnap.data();
            const data = orgData.deliverySettings || {};
            orgDetails = {
              name: data.name || orgData.name || orgDetails.name,
              imageUrl: data.logoUrl || orgData.logoUrl || orgData.logo || orgData.imageUrl || orgDetails.imageUrl,
              phone: data.whatsapp || orgData.phone || orgDetails.phone,
              active: data.active !== undefined ? data.active : true,
              bannerUrl: data.bannerUrl || ''
            };
          }
        } catch (settingsErr) {
          console.warn('Erro ao ler configurações de delivery do Firestore:', settingsErr);
        }

        setOrgData(orgDetails);

        // Carrega os produtos da coleção inventory
        const inventoryRef = collection(db, 'organizations', orgId, 'inventory');
        const snapshot = await getDocs(inventoryRef);
        
        const parseNameAndMetadataLocal = (rawName: string) => {
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
                if (key === 'price') {
                  const parsed = Number(value.replace(',', '.'));
                  price = isNaN(parsed) ? 0 : parsed;
                }
                if (key === 'pdv') showInPos = value === 'true';
                if (key === 'sales') {
                  const parsed = Number(value);
                  sales = isNaN(parsed) ? 0 : parsed;
                }
              }
            });
          }
          return { name, brand, price, showInPos, sales };
        };

        const items: MenuItem[] = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          const meta = parseNameAndMetadataLocal(data.name);
          const price = meta.price !== undefined ? Number(meta.price) : 0;

          return {
            id: doc.id,
            name: meta.name,
            price: price,
            quantity: Number(data.quantity || 0),
            unit: data.unit || 'un',
            category: data.category || 'Geral',
            brand: meta.brand,
            visibleOnline: data.visibleOnline !== undefined ? data.visibleOnline : false,
            imageUrl: data.imageUrl || ''
          };
        });

        // Filtra apenas produtos marcados como visíveis online OU com preço cadastrado se nada estiver configurado
        const hasAnyOnline = items.some(i => i.visibleOnline === true);
        const filtered = items.filter(i => {
          if (hasAnyOnline) return i.visibleOnline === true;
          return i.price > 0; // fallback se nada estiver ativo explicitamente
        });

        setMenuItems(filtered);

        // Extrai categorias únicas
        const cats = Array.from(new Set(filtered.map(i => i.category || 'Geral')));
        setCategories(cats);

      } catch (err: any) {
        console.error('Erro ao ler cardápio:', err);
        setError('Não foi possível carregar o cardápio no momento.');
      } finally {
        setLoading(false);
      }
    };

    // Preenche dados do formulário a partir do localStorage
    const savedName = localStorage.getItem('hubcrm_client_name') || '';
    const savedPhone = localStorage.getItem('hubcrm_client_phone') || '';
    const savedAddress = localStorage.getItem('hubcrm_client_address') || '';
    setClientName(savedName);
    setClientPhone(savedPhone);
    setAddress(savedAddress);

    loadMenu();
  }, [orgId]);

  // Abre Modal de Detalhes
  const handleOpenProduct = (product: MenuItem) => {
    setSelectedProduct(product);
    setDetailQty(1);
    setDetailNotes('');
    
    // Carrega opcionais
    const opts = getAdditionsForCategory(product.category);
    setTempAdditions(opts.map(o => ({ ...o, checked: false })));
  };

  // Salva no Carrinho
  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    // 1. Calcula a quantidade que já está no carrinho para este produto
    const currentQtyInCart = cart
      .filter(item => item.product.id === selectedProduct.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    // 2. A quantidade total proposta é a atual no carrinho + a que quer adicionar agora
    const totalProposedQty = currentQtyInCart + detailQty;

    // 3. Faz o bloqueio se a quantidade proposta ultrapassar o estoque disponível
    if (totalProposedQty > selectedProduct.quantity) {
      const remaining = selectedProduct.quantity - currentQtyInCart;
      if (remaining <= 0) {
        toast.error(`Produto sem estoque suficiente! Já existem ${currentQtyInCart} unidades no carrinho.`);
      } else {
        toast.error(`Estoque insuficiente! Temos apenas mais ${remaining} unidade(s) de ${selectedProduct.name} disponível(is).`);
      }
      return;
    }

    const selected = tempAdditions.filter(t => t.checked).map(t => ({ name: t.name, price: t.price }));
    
    const cartItem: CartItem = {
      product: selectedProduct,
      quantity: detailQty,
      notes: detailNotes,
      selectedAdditions: selected
    };

    setCart(prev => [...prev, cartItem]);
    setSelectedProduct(null);
    toast.success(`${selectedProduct.name} adicionado ao carrinho!`);
  };

  // Remove do Carrinho
  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    toast.info('Item removido do carrinho.');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const itemAdditionsTotal = item.selectedAdditions.reduce((sum, add) => sum + add.price, 0);
      return total + ((item.product.price + itemAdditionsTotal) * item.quantity);
    }, 0);
  };

  // Gera um número de pedido aleatório de 6 caracteres no frontend de forma síncrona
  const generateOrderNumber = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Finaliza Pedido (WhatsApp + Firestore + CRM + Dedução de Estoque)
  const handleCheckout = async (method: 'site' | 'whatsapp') => {
    if (!orgId) return;

    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Preencha seu Nome e Telefone WhatsApp.');
      return;
    }
    if (deliveryType === 'delivery' && !address.trim()) {
      toast.error('Informe o endereço para entrega.');
      return;
    }

    // 1. Abre a aba em branco de forma síncrona imediata para evitar Popup Blocker do navegador
    const whatsappWindow = method === 'whatsapp' ? window.open('', '_blank') : null;

    setIsSubmitting(true);

    try {
      // 2. Salva dados no localStorage para facilitar próximas compras
      localStorage.setItem('hubcrm_client_name', clientName.trim());
      localStorage.setItem('hubcrm_client_phone', clientPhone.trim());
      if (deliveryType === 'delivery') {
        localStorage.setItem('hubcrm_client_address', address.trim());
      }

      const total = getCartTotal();

      // 3. Gera o código de pedido curto no frontend de forma síncrona
      const displayOrderNumber = generateOrderNumber();

      // 4. Montagem da Mensagem do WhatsApp
      let msg = `*🍔 NOVO PEDIDO - ${orgData?.name?.toUpperCase() || 'DELIVERY'}*\n`;
      msg += `===============================\n`;
      msg += `*Cliente:* ${clientName.trim()}\n`;
      msg += `*WhatsApp:* ${clientPhone.trim()}\n`;
      msg += `*Tipo:* ${deliveryType === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}\n`;
      if (deliveryType === 'delivery') {
        msg += `*Endereço:* ${address.trim()}\n`;
      }
      msg += `*Pagamento:* ${paymentMethod === 'pix' ? 'Pix' : paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}\n`;
      msg += `===============================\n\n`;
      msg += `*📋 ITENS DO PEDIDO:*\n`;

      cart.forEach((item, index) => {
        msg += `*${index + 1}. ${item.quantity}x ${item.product.name}* (R$ ${item.product.price.toFixed(2)})\n`;
        if (item.selectedAdditions.length > 0) {
          msg += `  _Adicionais:_\n`;
          item.selectedAdditions.forEach(add => {
            msg += `  + ${add.name} (+ R$ ${add.price.toFixed(2)})\n`;
          });
        }
        if (item.notes.trim()) {
          msg += `  _Obs:_ "${item.notes.trim()}"\n`;
        }
        msg += `\n`;
      });

      msg += `===============================\n`;
      msg += `*VALOR TOTAL:* R$ ${total.toFixed(2)}\n\n`;
      msg += `*Código do Pedido:* #${displayOrderNumber}\n`;
      msg += `Obrigado pela preferência!`;

      // 5. Transação Firestore: Salva o pedido usando addDoc (compatível com regras de escrita livre na subcoleção orders)
      const orderPayload = {
        orderNumber: displayOrderNumber,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        deliveryType,
        address: deliveryType === 'delivery' ? address.trim() : 'Retirada no Balcão',
        paymentMethod,
        total,
        status: 'pendente',
        createdAt: serverTimestamp(),
        checkoutMethod: method,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          notes: item.notes,
          additions: item.selectedAdditions
        }))
      };

      // Gravação robusta no Firestore com ID automático
      await addDoc(collection(db, 'organizations', orgId, 'orders'), orderPayload);



      // 9. Redireciona a janela em branco aberta anteriormente após o salvamento no Firestore
      if (whatsappWindow) {
        let phone = orgData?.phone ? orgData.phone.replace(/\D/g, '') : '';
        if (phone && phone.length <= 11) {
          phone = '55' + phone; // Garante o DDI do Brasil para números de DDD
        }
        const text = encodeURIComponent(msg);
        whatsappWindow.location.href = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;
      }

      // 10. Define estado de sucesso
      setOrderSuccess({
        id: displayOrderNumber,
        total,
        message: msg,
        method
      });

      setCart([]);
      setIsCartOpen(false);

    } catch (err: any) {
      console.error(err);
      // Se falhou ao salvar o pedido no Firestore, fechamos a nova janela do WhatsApp
      if (whatsappWindow) {
        whatsappWindow.close();
      }
      toast.error('Erro ao registrar o pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!orderSuccess) return;
    let phone = orgData?.phone ? orgData.phone.replace(/\D/g, '') : '';
    if (phone && phone.length <= 11) {
      phone = '55' + phone; // Garante o DDI do Brasil para números de DDD
    }
    const text = encodeURIComponent(orderSuccess.message);
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
  };

  // Filtra itens
  const filteredProducts = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.brand || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4 animate-spin" />
        <p className="text-gray-400 font-bold animate-pulse text-xs uppercase tracking-widest">Carregando Cardápio Digital...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <X className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
        <h3 className="text-white font-black uppercase text-sm tracking-wider mb-2">Ops! Ocorreu um erro</h3>
        <p className="text-gray-400 text-xs max-w-xs">{error}</p>
      </div>
    );
  }

  if (orgData && orgData.active === false) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center text-left">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center mb-6 text-amber-500">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-white font-black uppercase text-sm tracking-wider mb-2">Cardápio Temporariamente Indisponível</h3>
        <p className="text-gray-400 text-xs max-w-sm">No momento, este estabelecimento pausou o recebimento de novos pedidos pelo cardápio online. Tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans pb-24 text-left">
      
      {/* Banner / Header do Estabelecimento */}
      <div 
        className="relative py-12 px-6 text-center border-b border-white/5 overflow-hidden bg-cover bg-center"
        style={orgData?.bannerUrl ? { backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.4), rgba(5, 5, 5, 0.95)), url(${orgData.bannerUrl})` } : {}}
      >
        <div className="max-w-2xl mx-auto flex flex-col items-center">
          {orgData?.imageUrl ? (
            <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-primary-500 shadow-2xl shadow-primary-500/10 mb-4">
              <img src={orgData.imageUrl} alt={orgData.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-primary-500/20 border-2 border-primary-500/30 flex items-center justify-center mb-4 text-primary-400 font-black text-2xl uppercase">
              {orgData?.name?.slice(0, 2)}
            </div>
          )}
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">{orgData?.name}</h2>
          
          <div className="flex items-center gap-3 mt-1.5 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Clock size={11} />
              Aberto
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
              <Globe size={11} />
              Pedido Online
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-8 space-y-6">
        
        {/* Barra de Pesquisa */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input 
            type="text" 
            placeholder="Buscar produtos no cardápio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-xs font-bold placeholder:text-gray-500 text-white"
          />
        </div>

        {/* Categorias (Filtro Horizontal) */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('Todos')}
              className={`px-4.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border-0 ${
                selectedCategory === 'Todos' 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10' 
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border-0 ${
                  selectedCategory === cat 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10' 
                    : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Lista de Produtos */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Produtos disponíveis</h3>
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center bg-white/5 rounded-2xl border border-white/5">
              <ShoppingBag size={28} className="mx-auto text-gray-600 mb-2" />
              <p className="text-gray-500 text-xs italic">Nenhum item encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredProducts.map(product => {
                const isOutOfStock = product.quantity <= 0;
                return (
                  <div 
                    key={product.id}
                    onClick={() => !isOutOfStock && handleOpenProduct(product)}
                    className={`bg-white/5 border border-white/5 hover:border-primary-500/30 p-4 rounded-2xl flex gap-4 transition-all duration-300 ${
                      isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10 active:scale-[0.99]'
                    }`}
                  >
                    {product.imageUrl ? (
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-bold uppercase text-xs flex-shrink-0">
                        {product.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-tight text-white line-clamp-1">{product.name}</h4>
                        {product.brand && (
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">{product.brand}</span>
                        )}
                        <span className="text-[9px] text-primary-400 font-bold uppercase tracking-wider mt-1 block">
                          {product.category}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-black text-emerald-400">
                          R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                            Esgotado
                          </span>
                        ) : (
                          <span className="p-1 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                            <Plus size={14} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Botão Fixo do Carrinho no Rodapé */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="max-w-2xl mx-auto w-full bg-primary-500 hover:bg-primary-600 text-white font-black px-6 py-4 rounded-2xl flex items-center justify-between shadow-xl shadow-primary-500/20 active:scale-95 transition-all uppercase tracking-wider text-xs border-0 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} />
              <span>Ver meu pedido ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
            </div>
            <span>R$ {getCartTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </button>
        </div>
      )}

      {/* Modal de Opcionais & Detalhes do Item */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0c0c0c] border border-white/10 p-6 md:p-8 rounded-[2rem] max-w-md w-full shadow-2xl relative max-h-[85vh] overflow-y-auto scrollbar-none animate-in fade-in zoom-in duration-200 text-left">
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-6 right-6 p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Cabeçalho do Produto */}
            <div className="flex gap-4 items-start mb-6">
              {selectedProduct.imageUrl ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-bold uppercase text-xs flex-shrink-0">
                  {selectedProduct.name.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[10px] text-primary-400 font-bold uppercase tracking-wider block mb-0.5">{selectedProduct.category}</span>
                <h3 className="text-sm font-black text-white uppercase tracking-tight line-clamp-2">{selectedProduct.name}</h3>
                <span className="text-sm font-black text-emerald-400 mt-1 block">
                  R$ {selectedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Adicionais / Opcionais */}
            {tempAdditions.length > 0 && (
              <div className="mb-6 space-y-3">
                <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-wider block">Adicionar opcionais</h4>
                <div className="space-y-2">
                  {tempAdditions.map((addition, i) => (
                    <div 
                      key={addition.name}
                      onClick={() => {
                        const copy = [...tempAdditions];
                        copy[i].checked = !copy[i].checked;
                        setTempAdditions(copy);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-200 select-none ${
                        addition.checked 
                          ? 'bg-primary-500/10 border-primary-500/40 text-white' 
                          : 'bg-white/5 border-white/5 hover:border-white/10 text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          addition.checked ? 'bg-primary-500 border-primary-500' : 'border-gray-600'
                        }`}>
                          {addition.checked && <Check size={10} className="text-white" />}
                        </div>
                        <span>{addition.name}</span>
                      </div>
                      {addition.price > 0 && (
                        <span className="text-[11px] font-black text-emerald-400 font-mono">
                          + R$ {addition.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="mb-6 space-y-1.5">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-wider block">Observações do Item</label>
              <textarea 
                placeholder="Ex: Sem sal, molho extra, bem passado, etc."
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold text-white resize-none"
              />
            </div>

            {/* Totalizadores e Quantidade */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDetailQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer bg-transparent border-0"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-black text-white font-mono w-4 text-center">{detailQty}</span>
                <button
                  onClick={() => setDetailQty(q => {
                    const currentQtyInCart = selectedProduct 
                      ? cart.filter(item => item.product.id === selectedProduct.id).reduce((sum, item) => sum + item.quantity, 0)
                      : 0;
                    const maxAvailableToAdd = selectedProduct 
                      ? selectedProduct.quantity - currentQtyInCart
                      : 1;

                    if (q >= maxAvailableToAdd) {
                      toast.warning(`Limite de estoque atingido! (${selectedProduct?.quantity} unidades no total)`);
                      return q;
                    }
                    return q + 1;
                  })}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer bg-transparent border-0"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Subtotal</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  R$ {((selectedProduct.price + tempAdditions.filter(t => t.checked).reduce((sum, add) => sum + add.price, 0)) * detailQty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Botão de Adição Final */}
            <button
              onClick={handleAddToCart}
              className="w-full mt-6 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-0 cursor-pointer"
            >
              <ShoppingBag size={14} />
              Adicionar ao pedido
            </button>
          </div>
        </div>
      )}

      {/* Slide-over / Gaveta do Carrinho & Checkout */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex justify-end">
          <div className="bg-[#0c0c0c] border-l border-white/10 w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200 text-left">
            
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="text-primary-500" size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest text-white">Meu Pedido</h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corpo / Lista e Formulário */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
              
              {/* Lista de Itens do Carrinho */}
              <div className="space-y-3">
                <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-wider block">Itens selecionados</h4>
                {cart.map((item, index) => {
                  const additionsTotal = item.selectedAdditions.reduce((sum, add) => sum + add.price, 0);
                  const itemSubtotal = (item.product.price + additionsTotal) * item.quantity;
                  
                  return (
                    <div key={index} className="p-3.5 bg-white/5 border border-white/5 rounded-xl flex gap-3 relative group">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-primary-400 font-bold uppercase tracking-wider block mb-0.5">{item.product.category}</span>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">{item.quantity}x {item.product.name}</h4>
                        {item.selectedAdditions.length > 0 && (
                          <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wide mt-1 pl-2 border-l border-white/10">
                            {item.selectedAdditions.map(a => `+ ${a.name}`).join(', ')}
                          </div>
                        )}
                        {item.notes.trim() && (
                          <p className="text-[9px] text-gray-500 italic mt-1 font-bold">Obs: "{item.notes.trim()}"</p>
                        )}
                        <span className="text-[11px] font-black text-emerald-400 font-mono mt-1.5 block">
                          R$ {itemSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(index)}
                        className="p-1.5 bg-white/5 hover:bg-rose-500/25 border border-white/5 rounded-lg text-gray-500 hover:text-rose-400 cursor-pointer self-start transition-colors border-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="h-[1px] bg-white/5" />

              {/* Formulário de Finalização */}
              <form onSubmit={(e) => { e.preventDefault(); handleCheckout('whatsapp'); }} className="space-y-4">
                <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-wider block">Informações de entrega</h4>

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Seu Nome *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: José Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold text-white"
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Telefone WhatsApp *</label>
                  <input 
                    type="tel" 
                    required
                    placeholder="Ex: 11999999999"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold text-white font-mono"
                  />
                </div>

                {/* Opção de Retirada/Entrega */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                      deliveryType === 'delivery'
                        ? 'bg-primary-500 border-primary-500 text-white font-black'
                        : 'bg-white/5 border-white/5 hover:border-white/10 text-gray-400'
                    }`}
                  >
                    <MapPin size={12} />
                    <span>Entrega</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                      deliveryType === 'pickup'
                        ? 'bg-primary-500 border-primary-500 text-white font-black'
                        : 'bg-white/5 border-white/5 hover:border-white/10 text-gray-400'
                    }`}
                  >
                    <Clock size={12} />
                    <span>Retirada</span>
                  </button>
                </div>

                {/* Endereço */}
                {deliveryType === 'delivery' && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Endereço Completo (Rua, Número, Bairro, Complemento) *</label>
                    <textarea 
                      required
                      placeholder="Ex: Rua das Flores, 123 - Apto 12 - Centro"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold text-white resize-none"
                    />
                  </div>
                )}

                {/* Método de Pagamento */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Forma de Pagamento *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['pix', 'card', 'cash'].map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method as any)}
                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer border-0 ${
                          paymentMethod === method
                            ? 'bg-primary-500 border-primary-500 text-white font-black'
                            : 'bg-white/5 border-white/5 hover:border-white/10 text-gray-400'
                        }`}
                      >
                        {method === 'pix' ? 'Pix' : method === 'card' ? 'Cartão' : 'Dinheiro'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Itens:</span>
                    <span className="text-white font-bold font-mono">
                      R$ {getCartTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Taxa de Entrega:</span>
                    <span className="text-emerald-400 font-bold uppercase text-[10px]">
                      {deliveryType === 'delivery' ? 'Grátis' : '--'}
                    </span>
                  </div>
                  <div className="w-full h-[1px] bg-white/5 my-1" />
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-white font-black uppercase tracking-wider text-[10px]">Total do Pedido:</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      R$ {getCartTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Botão de Checkout Único (WhatsApp) */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-0 cursor-pointer shadow-lg shadow-emerald-600/10 active:scale-98"
                  >
                    {isSubmitting ? (
                      <span>Processando...</span>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Confirmar via WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso Final */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#0c0c0c] border border-white/10 p-6 md:p-8 rounded-[2rem] max-w-md w-full shadow-2xl text-center relative animate-in fade-in zoom-in duration-200">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-bounce" />
            
            <h3 className="text-white font-black uppercase text-sm tracking-wider mb-2">
              {orderSuccess.method === 'site' ? 'Pedido Recebido!' : 'Pedido Enviado!'}
            </h3>
            
            <p className="text-gray-400 text-xs max-w-xs mx-auto mb-6">
              {orderSuccess.method === 'site' ? (
                <>
                  O seu pedido <span className="text-white font-black font-mono">#{orderSuccess.id}</span> foi registrado diretamente no nosso sistema. Em instantes, nosso atendente entrará em contato com você pelo WhatsApp para prosseguir!
                </>
              ) : (
                <>
                  O seu pedido <span className="text-white font-black font-mono">#{orderSuccess.id}</span> foi registrado. Caso a janela de chat do WhatsApp não tenha aberto automaticamente, clique no botão verde abaixo para enviar a mensagem do pedido.
                </>
              )}
            </p>

            <div className="space-y-3">
              {orderSuccess.method === 'whatsapp' && (
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-0 cursor-pointer shadow-xl shadow-emerald-500/10"
                >
                  <Phone size={14} />
                  <span>Enviar para WhatsApp</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOrderSuccess(null)}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all border border-white/10 cursor-pointer bg-transparent"
              >
                Fazer Novo Pedido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
