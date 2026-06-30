import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  Clock, MapPin, Check, X, Phone, MessageSquare, AlertCircle, Play, ShoppingBag, CheckCircle2, ChevronRight, Volume2, VolumeX
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  additions?: { name: string; price: number }[];
}

interface Order {
  id: string;
  orderNumber?: string;
  clientName: string;
  clientPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address: string;
  paymentMethod: 'pix' | 'card' | 'cash';
  total: number;
  status: 'pendente' | 'preparo' | 'pronto' | 'finalizado' | 'cancelado';
  createdAt: any;
  items: OrderItem[];
}

interface PortalOrdersProps {
  orgId: string;
}

export default function PortalOrders({ orgId }: PortalOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sintetizador de áudio nativo (Web Audio API) para tocar notificação de novos pedidos
  const playNewOrderNotification = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Tom 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Ré5
      gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      
      // Tom 2 (um acorde maior ligeiramente depois)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // Lá5
      gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.65);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);

      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.4);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.65);
    } catch (e) {
      console.warn('Web Audio API bloqueada ou indisponível:', e);
    }
  };

  // Escuta pedidos em tempo real
  useEffect(() => {
    if (!orgId) return;

    const ordersRef = collection(db, 'organizations', orgId, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    let isFirstLoad = true;

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      // Toca áudio se entrou um pedido novo pendente após o carregamento inicial
      if (!isFirstLoad && list.length > orders.length) {
        const hasNewPending = list.some(
          newOrd => newOrd.status === 'pendente' && !orders.some(oldOrd => oldOrd.id === newOrd.id)
        );
        if (hasNewPending) {
          playNewOrderNotification();
          toast.success('Novo pedido recebido no painel de delivery!', {
            action: {
              label: 'Ver Pedido',
              onClick: () => {
                const pending = list.find(o => o.status === 'pendente');
                if (pending) setSelectedOrder(pending);
              }
            }
          });
        }
      }

      setOrders(list);
      setLoading(false);
      isFirstLoad = false;
    }, (error) => {
      console.error('Erro ao ler pedidos:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId, orders.length, soundEnabled]);

  // Atualiza Status do Pedido
  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'organizations', orgId, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
      
      toast.success(`Pedido atualizado para: ${getStatusLabel(newStatus)}`);
      
      // Atualiza o pedido selecionado se for o mesmo
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao atualizar status do pedido.');
    }
  };

  // Mensagem rápida de WhatsApp para informar status
  const handleSendStatusWhatsApp = (order: Order) => {
    const cleanPhone = order.clientPhone.replace(/\D/g, '');
    let text = '';
    const displayId = order.orderNumber || order.id.slice(-6).toUpperCase();
    
    if (order.status === 'preparo') {
      text = `Olá, *${order.clientName}*! Seu pedido *#${displayId}* já está sendo preparado com muito carinho por nossa equipe. Logo sairá para você! 🍔`;
    } else if (order.status === 'pronto') {
      text = `Olá, *${order.clientName}*! Seu pedido *#${displayId}* está *PRONTO*! ${order.deliveryType === 'delivery' ? 'O motoboy já está saindo para entrega!' : 'Você já pode vir retirar no nosso balcão!'} 🛵🏪`;
    } else if (order.status === 'finalizado') {
      text = `Olá, *${order.clientName}*! Seu pedido *#${displayId}* foi entregue/finalizado. Esperamos que tenha gostado! Se puder, nos avalie. Bom apetite! ❤️`;
    } else {
      text = `Olá, *${order.clientName}*! Entramos em contato para falar sobre seu pedido *#${displayId}*.`;
    }

    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'preparo': return 'Em Preparo';
      case 'pronto': return 'Pronto';
      case 'finalizado': return 'Finalizado';
      case 'cancelado': return 'Cancelado';
    }
  };

  const getStatusBadgeClass = (status: Order['status']) => {
    switch (status) {
      case 'pendente': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'preparo': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'pronto': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'finalizado': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'cancelado': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    }
  };

  const activeOrdersCount = orders.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado').length;

  return (
    <div className="space-y-6 text-left">
      
      {/* Cabeçalho de Controle Operacional */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] p-6 rounded-[2rem] shadow-xl">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <ShoppingBag className="text-rose-500" size={16} />
            Mesa de Pedidos Delivery
          </h3>
          <p className="text-xs text-gray-500">Acompanhamento e despacho de pedidos do cardápio online em tempo real.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 rounded-2xl transition-all cursor-pointer bg-transparent"
            title={soundEnabled ? "Desativar alerta sonoro" : "Ativar alerta sonoro"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          
          <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            {activeOrdersCount} Pedidos Ativos
          </span>
        </div>
      </div>

      {/* Grid de Pedidos e Detalhes */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-[2rem]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-gray-500 text-xs">Carregando pedidos...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-[2rem] p-12 text-center shadow-xl">
          <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" strokeWidth={1} />
          <p className="text-gray-400 text-xs italic">Nenhum pedido recebido ainda no cardápio público.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Coluna da Esquerda: Lista de Pedidos */}
          <div className="lg:col-span-2 space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {orders.map(order => {
              const formattedDate = order.createdAt?.seconds 
                ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '';
              
              const isSelected = selectedOrder?.id === order.id;

              return (
                <div 
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`
                    p-5 bg-[var(--theme-glass)] border rounded-[2rem] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-all cursor-pointer hover:bg-[var(--theme-glass-hover)] hover:-translate-y-0.5 shadow-md
                    ${isSelected 
                      ? 'border-rose-500/50 shadow-rose-500/5 ring-1 ring-rose-500/35 bg-white/5' 
                      : 'border-[var(--theme-border-subtle)]'}
                  `}
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-black text-white font-mono uppercase">
                        #{order.orderNumber || order.id.slice(-6).toUpperCase()}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                        <Clock size={12} />
                        {formattedDate}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white truncate uppercase">{order.clientName}</h4>
                    
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 font-bold">
                      <MapPin size={12} />
                      {order.deliveryType === 'delivery' ? 'Entrega em casa' : 'Retirada no Balcão'}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2">
                    <span className="text-base font-black text-emerald-400 font-mono">
                      R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">
                      {order.items.reduce((sum, i) => sum + i.quantity, 0)} itens
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coluna da Direita: Detalhe do Pedido Selecionado */}
          <div className="bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] rounded-[2rem] p-6 space-y-6 shadow-2xl relative min-h-[400px]">
            {selectedOrder ? (
              <div className="space-y-6">
                
                {/* Cabeçalho Detalhe */}
                <div className="flex justify-between items-start border-b border-[var(--theme-border-subtle)] pb-4">
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Pedido Selecionado</span>
                    <h3 className="text-sm font-black text-white font-mono uppercase mt-0.5">
                      #{selectedOrder.orderNumber || selectedOrder.id.slice(-6).toUpperCase()}
                    </h3>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </div>

                {/* Cliente */}
                <div className="space-y-2 border-b border-[var(--theme-border-subtle)] pb-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Cliente:</span>
                    <span className="text-white font-bold uppercase">{selectedOrder.clientName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">WhatsApp:</span>
                    <a 
                      href={`https://api.whatsapp.com/send?phone=${selectedOrder.clientPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-400 font-mono font-bold flex items-center gap-1 hover:underline"
                    >
                      <Phone size={12} />
                      {selectedOrder.clientPhone}
                    </a>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider shrink-0 mt-0.5">Endereço:</span>
                    <span className="text-gray-300 text-right leading-tight font-bold">{selectedOrder.address}</span>
                  </div>
                </div>

                {/* Itens do Pedido */}
                <div className="space-y-3">
                  <h4 className="text-[9px] text-gray-500 font-black uppercase tracking-wider block">Itens do Pedido</h4>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar text-xs">
                    {selectedOrder.items.map((item, idx) => {
                      const additionsTotal = item.additions?.reduce((sum, a) => sum + a.price, 0) || 0;
                      const subtotal = (item.price + additionsTotal) * item.quantity;
                      
                      return (
                        <div key={idx} className="p-3 bg-black/20 border border-[var(--theme-border-subtle)] rounded-2xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-black uppercase truncate max-w-[70%]">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {item.additions && item.additions.length > 0 && (
                            <div className="text-[9px] text-gray-500 font-bold uppercase pl-2 border-l border-white/5">
                              {item.additions.map(a => `+ ${a.name}`).join(', ')}
                            </div>
                          )}
                          {item.notes?.trim() && (
                            <p className="text-[9px] text-amber-500 font-bold italic">Obs: "{item.notes.trim()}"</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Forma de Pagamento:</span>
                    <span className="text-white font-bold uppercase font-mono">
                      {selectedOrder.paymentMethod === 'pix' ? 'Pix' : selectedOrder.paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-white/5 mt-2">
                    <span className="text-white font-black uppercase text-[10px] tracking-wider">Total Geral:</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      R$ {selectedOrder.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Ações Operacionais de Status */}
                <div className="space-y-2 border-t border-[var(--theme-border-subtle)] pt-4">
                  <h4 className="text-[9px] text-gray-500 font-black uppercase tracking-wider block text-center mb-2">Ações Operacionais</h4>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {selectedOrder.status === 'pendente' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'preparo')}
                          className="py-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 border-0 cursor-pointer"
                        >
                          <Play size={12} />
                          <span>Aceitar / Preparar</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelado')}
                          className="py-3 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer bg-transparent"
                        >
                          <X size={12} />
                          <span>Rejeitar</span>
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'preparo' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'pronto')}
                          className="py-3 bg-purple-500 hover:bg-purple-600 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 border-0 cursor-pointer"
                        >
                          <CheckCircle2 size={12} />
                          <span>Pronto p/ Entrega</span>
                        </button>
                        <button
                          onClick={() => handleSendStatusWhatsApp(selectedOrder)}
                          className="py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer bg-transparent"
                        >
                          <MessageSquare size={12} />
                          <span>Aviso WhatsApp</span>
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'pronto' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'finalizado')}
                          className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 border-0 cursor-pointer"
                        >
                          <Check size={12} />
                          <span>Entregue / Concluir</span>
                        </button>
                        <button
                          onClick={() => handleSendStatusWhatsApp(selectedOrder)}
                          className="py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer bg-transparent"
                        >
                          <MessageSquare size={12} />
                          <span>Aviso WhatsApp</span>
                        </button>
                      </>
                    )}

                    {(selectedOrder.status === 'finalizado' || selectedOrder.status === 'cancelado') && (
                      <button
                        onClick={() => handleSendStatusWhatsApp(selectedOrder)}
                        className="col-span-2 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer bg-transparent w-full"
                      >
                        <MessageSquare size={12} />
                        <span>Agradecer / Falar no WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-10 h-10 text-gray-600 mb-3 animate-pulse" />
                <p className="text-gray-500 text-xs italic">Selecione um pedido na lista para visualizar os detalhes operacionais e despachar.</p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
