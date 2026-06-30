import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, limit, setDoc 
} from 'firebase/firestore';
import { 
  Plus, Trash2, Edit2, Search, AlertTriangle, CheckCircle2, Package, Coins, Minus, X, ArrowUpRight, ArrowDownRight, History, ShoppingCart, Globe, Copy, ExternalLink, Palette
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';
import CustomSelect from './CustomSelect';
import { uploadToCloudinary } from '../lib/cloudinary';

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
  category?: string;
  visibleOnline?: boolean;
  imageUrl?: string;
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

// Função utilitária para comprimir e converter imagem para WebP no frontend
export const compressImageToWebP = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calcula a proporção mantendo maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Falha ao converter o Canvas para Blob WebP.'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
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
  const [category, setCategory] = useState('');
  const [visibleOnline, setVisibleOnline] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      toast.info('Otimizando imagem para WebP...');
      const compressedBlob = await compressImageToWebP(file, 800, 0.8);
      
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
        type: 'image/webp'
      });

      const secureUrl = await uploadToCloudinary(compressedFile);
      setImageUrl(secureUrl);
      toast.success('Imagem otimizada e enviada com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao otimizar ou fazer upload da imagem: ' + (err.message || 'Tente novamente.'));
    } finally {
      setUploadingImage(false);
    }
  };

  // Estado para Confirmação Customizada
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    itemId: string;
  }>({
    isOpen: false,
    itemId: ''
  });

  // Estados de Configuração do Delivery
  const [deliveryActive, setDeliveryActive] = useState(true);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryWhatsapp, setDeliveryWhatsapp] = useState('');
  const [deliveryLogoUrl, setDeliveryLogoUrl] = useState('');
  const [deliveryBannerUrl, setDeliveryBannerUrl] = useState('');
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Escuta/Carrega as Configurações de Delivery do Firestore
  useEffect(() => {
    if (!orgId) return;
    const settingsDocRef = doc(db, 'organizations', orgId, 'settings', 'delivery');
    const unsub = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDeliveryActive(data.active !== undefined ? data.active : true);
        setDeliveryName(data.name || '');
        setDeliveryWhatsapp(data.whatsapp || '');
        setDeliveryLogoUrl(data.logoUrl || '');
        setDeliveryBannerUrl(data.bannerUrl || '');
      } else {
        setDeliveryActive(true);
        setDeliveryName('');
        setDeliveryWhatsapp('');
        setDeliveryLogoUrl('');
        setDeliveryBannerUrl('');
      }
    });
    return () => unsub();
  }, [orgId]);

  // Função para salvar configurações de delivery no Firestore
  const handleSaveDeliverySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setIsSavingSettings(true);
    try {
      const settingsDocRef = doc(db, 'organizations', orgId, 'settings', 'delivery');
      await setDoc(settingsDocRef, {
        active: deliveryActive,
        name: deliveryName,
        whatsapp: deliveryWhatsapp.replace(/\D/g, ''),
        logoUrl: deliveryLogoUrl,
        bannerUrl: deliveryBannerUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success('Configurações do cardápio salvas com sucesso!');
      setIsSettingsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar configurações: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Upload do Logotipo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      toast.info('Otimizando logotipo...');
      const compressedBlob = await compressImageToWebP(file, 400, 0.8);
      const compressedFile = new File([compressedBlob], 'logo_' + Date.now() + '.webp', { type: 'image/webp' });
      const secureUrl = await uploadToCloudinary(compressedFile);
      setDeliveryLogoUrl(secureUrl);
      toast.success('Logotipo atualizado!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao subir logotipo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Upload do Banner
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      toast.info('Otimizando banner de capa...');
      const compressedBlob = await compressImageToWebP(file, 1200, 0.75);
      const compressedFile = new File([compressedBlob], 'banner_' + Date.now() + '.webp', { type: 'image/webp' });
      const secureUrl = await uploadToCloudinary(compressedFile);
      setDeliveryBannerUrl(secureUrl);
      toast.success('Banner de capa atualizado!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao subir banner: ' + err.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const calculateStockDuration = (item: InventoryItem) => {
    const itemLogs = logs.filter(log => log.itemId === item.id && log.type === 'saida');
    if (itemLogs.length === 0) return { label: 'Giro Baixo (30d)', color: 'text-gray-500', days: Infinity };

    // Filtra logs de saída dos últimos 30 dias
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
    const recentLogs = itemLogs.filter(log => new Date(log.date).getTime() >= thirtyDaysAgo);

    if (recentLogs.length === 0) {
      return { label: 'Giro Baixo (30d)', color: 'text-gray-500', days: Infinity };
    }

    const totalOut = recentLogs.reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);
    
    // Calcula divisor de dias real com base no log mais antigo nos últimos 30 dias
    const nowTime = today.getTime();
    const oldestLogTime = Math.min(...recentLogs.map(l => new Date(l.date).getTime()));
    const diffDays = Math.max(1, Math.ceil((nowTime - oldestLogTime) / (1000 * 60 * 60 * 24)));
    const divisor = Math.min(30, diffDays);

    const dailyDemand = totalOut / divisor;
    if (dailyDemand <= 0) return { label: 'Giro Baixo (30d)', color: 'text-gray-500', days: Infinity };

    const daysRemaining = item.quantity / dailyDemand;
    const roundedDays = Math.ceil(daysRemaining);

    if (roundedDays <= 3) {
      return { label: `Ruptura (~${roundedDays}d)`, color: 'text-rose-400 font-extrabold animate-pulse', days: roundedDays };
    }
    if (roundedDays <= 7) {
      return { label: `Repor (~${roundedDays}d)`, color: 'text-amber-400 font-bold', days: roundedDays };
    }
    return { label: `Dura ~${roundedDays} dias`, color: 'text-emerald-400 font-bold', days: roundedDays };
  };

  // Escuta os itens no Firestore
  useEffect(() => {
    if (!orgId) return;
    const inventoryRef = collection(db, 'organizations', orgId, 'inventory');
    const q = query(inventoryRef, orderBy('name', 'asc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data() as any;
        const meta = parseNameAndMetadata(data.name);
        
        const quantity = data.quantity !== undefined && data.quantity !== null && !isNaN(Number(data.quantity)) ? Number(data.quantity) : 0;
        const minQuantity = data.minQuantity !== undefined && data.minQuantity !== null && !isNaN(Number(data.minQuantity)) ? Number(data.minQuantity) : 0;
        const costPerUnit = data.costPerUnit !== undefined && data.costPerUnit !== null && !isNaN(Number(data.costPerUnit)) ? Number(data.costPerUnit) : 0;
        const price = meta.price !== undefined && meta.price !== null && !isNaN(Number(meta.price)) ? Number(meta.price) : 0;

        return {
          id: d.id,
          ...data,
          name: meta.name,
          brand: meta.brand,
          price,
          showInPos: meta.showInPos,
          sales: meta.sales,
          costPerUnit,
          quantity,
          minQuantity,
          category: data.category || '',
          visibleOnline: data.visibleOnline || false,
          imageUrl: data.imageUrl || ''
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
    const q = query(logsRef, orderBy('date', 'desc'), limit(200));
    
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
    setCategory('');
    setVisibleOnline(false);
    setImageUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setName(item.name);
    setQuantity((item.quantity ?? 0).toString());
    setUnit(item.unit || 'un');
    setMinQuantity((item.minQuantity ?? 0).toString());
    setCostPerUnit((item.costPerUnit ?? 0).toString().replace('.', ','));
    setBrand(item.brand || '');
    setShowInPos(item.showInPos || false);
    setPrice(item.price ? item.price.toString().replace('.', ',') : '');
    setCategory(item.category || '');
    setVisibleOnline(item.visibleOnline || false);
    setImageUrl(item.imageUrl || '');
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
        category: category.trim(),
        visibleOnline: visibleOnline,
        imageUrl: imageUrl.trim(),
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
  const totalCostValuation = items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.costPerUnit || 0)), 0);
  const totalSellValuation = items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.price || 0)), 0);
  const totalProfitValuation = totalSellValuation - items.reduce((acc, item) => item.price ? acc + ((item.quantity || 0) * (item.costPerUnit || 0)) : acc, 0);

  const criticalItemsCount = items.filter(item => item.quantity <= item.minQuantity).length;

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    if (showCriticalOnly) {
      return matchesSearch && item.quantity <= item.minQuantity;
    }
    return matchesSearch;
  });

  // Recomendações de Compra com Base no Giro
  const purchaseRecommendations = items
    .map(item => ({ item, duration: calculateStockDuration(item) }))
    .filter(rec => rec.duration.days <= 7)
    .sort((a, b) => a.duration.days - b.duration.days);

  const publicMenuUrl = `${window.location.origin}/cardapio/${orgId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicMenuUrl);
    toast.success('Link do cardápio copiado com sucesso!');
  };

  return (
    <div className="space-y-6 text-left">

      {/* Banner de Acesso ao Cardápio Digital Público */}
      <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/25 p-6 rounded-[2rem] flex flex-col xl:flex-row xl:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        
        {/* Glow de Fundo */}
        <div className="absolute -right-16 -top-16 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 flex-1 text-left">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
              <Globe size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Seu Cardápio Digital está Ativo!</h3>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                  deliveryActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {deliveryActive ? 'Ativo' : 'Pausado'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">Link de Pedidos Online para Clientes</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 max-w-xl">
            Seus clientes podem fazer pedidos, escolher adicionais e enviar as propostas direto no seu WhatsApp por esta página pública.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-black/20 py-1 px-3 rounded-xl w-fit border border-white/5">
            <Palette size={12} className="text-primary-400" />
            <span>Customize logo, capa, WhatsApp e nome clicando em</span>
            <span className="text-white font-black cursor-pointer hover:underline" onClick={() => setIsSettingsModalOpen(true)}>Configurar</span>
          </div>
        </div>

        {/* Bloco de Ações com Link */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="bg-black/40 border border-white/10 px-4 py-3 rounded-2xl flex items-center justify-between gap-4">
            <span className="text-[11px] font-mono font-bold text-gray-400 truncate max-w-[180px] sm:max-w-[240px]">
              {publicMenuUrl}
            </span>
            <button 
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all active:scale-90 cursor-pointer border-0 bg-transparent"
              title="Copiar Link"
            >
              <Copy size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Palette size={13} />
            <span>Configurar</span>
          </button>

          <a 
            href={publicMenuUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 border-0 text-center select-none cursor-pointer decoration-none"
          >
            <span>Ver Cardápio</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
      
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
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Valoração de Venda</span>
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

      {/* Recomendações de Compra Inteligentes */}
      {purchaseRecommendations.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={18} />
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Recomendações Urgentes de Compra</h4>
          </div>
          <p className="text-[11px] text-gray-400">
            Com base no consumo diário dos últimos 30 dias, estes produtos precisam ser repostos para evitar desabastecimento:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {purchaseRecommendations.slice(0, 3).map(({ item, duration }) => (
              <div key={item.id} className="p-3.5 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate uppercase">{item.name}</span>
                  <span className="text-[10px] text-gray-500 mt-0.5 block">Estoque atual: {item.quantity} {item.unit}</span>
                </div>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border flex-shrink-0
                  ${duration.days <= 3 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
                >
                  {duration.days <= 3 ? 'Ruptura iminente' : 'Repor urgente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  relative bg-[var(--theme-glass)] border p-5 rounded-[2rem] flex flex-col justify-between shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--theme-glass-hover)] cursor-pointer hover:scale-[1.02] active:scale-[0.99] group/card overflow-hidden text-left
                  ${isLowStock 
                    ? 'border-amber-500/30' 
                    : 'border-[var(--theme-border-subtle)]'}
                `}
              >
                <div>
                  {/* Seção Superior: Mídia de Destaque com Badges Flutuantes */}
                  <div className="w-full h-36 relative rounded-2xl overflow-hidden border border-white/5 bg-black/20 mb-4 group/image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-350 group-hover/card:scale-105" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-gray-600 bg-gradient-to-br from-white/5 to-white/0">
                        <Package className="w-8 h-8 stroke-1 text-gray-700 animate-pulse" />
                        <span className="text-[8px] uppercase tracking-widest font-bold">Sem imagem</span>
                      </div>
                    )}

                    {/* Marca Flutuante (Top Left) */}
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg text-[8px] font-black text-gray-300 uppercase tracking-widest">
                      {item.brand || 'Sem Marca'}
                    </div>

                    {/* Badges Flutuantes (Top Right) */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                      <div className="flex gap-1 flex-wrap justify-end">
                        {item.showInPos && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary-500/80 backdrop-blur-md rounded-md text-[7px] font-black text-white uppercase tracking-tight">
                            <ShoppingCart className="w-2 h-2" />
                            PDV
                          </div>
                        )}
                        {item.visibleOnline && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/80 backdrop-blur-md rounded-md text-[7px] font-black text-white uppercase tracking-tight">
                            <Globe className="w-2 h-2" />
                            Cardápio
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {isLowStock ? (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/90 backdrop-blur-md rounded-md text-[7px] font-black text-white uppercase tracking-tight">
                            <AlertTriangle className="w-2 h-2" />
                            Baixo
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/90 backdrop-blur-md rounded-md text-[7px] font-black text-white uppercase tracking-tight">
                            <CheckCircle2 className="w-2 h-2" />
                            Saudável
                          </div>
                        )}
                        {(() => {
                          const duration = calculateStockDuration(item);
                          return (
                            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[7px] font-black uppercase tracking-tight ${duration.color}`}>
                              {duration.label}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Nome e Categoria do Produto */}
                  <div className="text-left space-y-1">
                    <h4 className="text-sm font-black text-white line-clamp-1 uppercase leading-tight tracking-tight group-hover/card:text-primary-400 transition-colors">{item.name}</h4>
                    {item.category && (
                      <span className="inline-block text-[8px] bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    )}
                  </div>
                  
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                      className="p-2.5 bg-white/5 hover:bg-primary-500/20 text-gray-400 hover:text-primary-400 border border-white/5 rounded-xl transition-all active:scale-90 cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                      className="p-2.5 bg-white/5 hover:bg-red-500/25 text-gray-400 hover:text-red-400 border border-white/5 rounded-xl transition-all active:scale-90 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
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
            className="border border-[var(--theme-border)] p-6 md:p-8 rounded-[2.5rem] max-w-3xl w-full shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-1.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-gray-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-left" style={{ color: 'var(--theme-text-primary)' }}>
              <Package className="text-primary-500 w-5 h-5" />
              {editingItemId ? 'Editar Produto' : 'Cadastrar Produto'}
            </h3>

            <form onSubmit={handleSaveItem} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* COLUNA ESQUERDA: Mídia e Visibilidade */}
              <div className="space-y-4 flex flex-col justify-between">
                
                {/* Imagem e Preview de Destaque */}
                <div className="text-left space-y-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Imagem do Produto (opcional)</label>
                  
                  {/* Container de Preview Gigante e Otimizado */}
                  <div className="w-full h-44 rounded-2xl overflow-hidden border border-[var(--theme-border)] bg-black/30 flex items-center justify-center relative shadow-inner group">
                    {imageUrl.trim() ? (
                      <img src={imageUrl} alt="Destaque" className="w-full h-full object-cover transition-transform duration-350 group-hover:scale-105" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Package className="w-10 h-10 stroke-1 animate-pulse" />
                        <span className="text-[9px] uppercase font-black tracking-widest">Sem Imagem</span>
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Otimizando...</span>
                      </div>
                    )}
                  </div>

                  {/* Upload e Input */}
                  <div className="flex gap-2 items-stretch mt-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      id="product-image-upload"
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <label 
                      htmlFor="product-image-upload"
                      className="inline-flex items-center justify-center px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                    >
                      {uploadingImage ? 'Processando...' : 'Fazer Upload'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ou cole a URL da foto..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500/50 text-[10px] font-bold font-mono text-gray-300 min-w-0"
                    />
                  </div>
                </div>

                {/* Categoria */}
                <div className="text-left">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Categoria do Produto</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Hamburgueres, Pizzas, Bebidas, Doces"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold"
                  />
                </div>

                {/* Swithes de Exibição lado a lado */}
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-around gap-4 text-left">
                  {/* Switch Exibir no PDV */}
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowInPos(!showInPos)}>
                    <input 
                      type="checkbox" 
                      checked={showInPos}
                      onChange={() => {}} 
                      className="w-4 h-4 accent-primary-500 cursor-pointer"
                    />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider select-none">Exibir no PDV</span>
                  </div>

                  {/* Switch Exibir no Cardápio */}
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setVisibleOnline(!visibleOnline)}>
                    <input 
                      type="checkbox" 
                      checked={visibleOnline}
                      onChange={() => {}} 
                      className="w-4 h-4 accent-primary-500 cursor-pointer"
                    />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider select-none">Exibir Online</span>
                  </div>
                </div>

              </div>

              {/* COLUNA DIREITA: Detalhes de Estoque e Preços */}
              <div className="space-y-4 text-left">
                
                {/* Nome */}
                <div>
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
                <div>
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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

                {/* Preço de Venda */}
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

                {/* Custo total do lote calculado em tempo real */}
                {Number(quantity) > 0 && Number(costPerUnit.replace(',', '.')) > 0 && (
                  <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                    <span>Custo Total do Lote ({quantity} {unit}):</span>
                    <span className="font-mono text-white text-xs">
                      R$ {(Number(quantity) * Number(costPerUnit.replace(',', '.'))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

              </div>

              {/* RODAPÉ: Ações de largura total */}
              <div className="md:col-span-2 pt-4 flex gap-3 border-t border-[var(--theme-border-subtle)] mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-gray-400 hover:text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer bg-transparent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingImage}
                  className="flex-1 py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/10 border-0 cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Configuração do Delivery */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="border border-[var(--theme-border)] p-6 md:p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl relative animate-in fade-in zoom-in duration-250 max-h-[90vh] overflow-y-auto custom-scrollbar text-left"
            style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          >
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-6 right-6 p-1.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] rounded-xl text-gray-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
              <Palette className="text-primary-500 w-5 h-5" />
              Configurar Cardápio Digital
            </h3>

            <form onSubmit={handleSaveDeliverySettings} className="space-y-6">
              
              {/* Status do Cardápio */}
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Cardápio Online Ativo</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Se desativado, os clientes não conseguirão fazer novos pedidos.</p>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all duration-300 ${
                    deliveryActive ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                  onClick={() => setDeliveryActive(!deliveryActive)}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                    deliveryActive ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Coluna 1: Dados do Negócio */}
                <div className="space-y-4">
                  {/* Nome do Estabelecimento */}
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Nome do Estabelecimento *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Pizzaria Bella Italia"
                      value={deliveryName}
                      onChange={(e) => setDeliveryName(e.target.value)}
                      className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold"
                    />
                  </div>

                  {/* WhatsApp de Recebimento */}
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">WhatsApp p/ Pedidos (com DDD) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: 11999999999"
                      value={deliveryWhatsapp}
                      onChange={(e) => setDeliveryWhatsapp(e.target.value)}
                      className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary-500/50 text-xs font-bold font-mono"
                    />
                    <p className="text-[9px] text-gray-500 mt-1">Este número receberá a conversa de confirmação dos clientes.</p>
                  </div>
                </div>

                {/* Coluna 2: Mídias do Cardápio */}
                <div className="space-y-4">
                  {/* Logotipo do Estabelecimento */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Logotipo do Estabelecimento</label>
                    <div className="flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--theme-border)] bg-black/20 flex-shrink-0 flex items-center justify-center relative">
                        {deliveryLogoUrl.trim() ? (
                          <img src={deliveryLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Palette className="w-5 h-5 text-gray-600" />
                        )}
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleLogoUpload}
                          id="delivery-logo-upload"
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <label 
                          htmlFor="delivery-logo-upload"
                          className="inline-flex px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          {uploadingLogo ? 'Enviando...' : 'Mudar Logo'}
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Banner de Capa */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Banner de Capa (Panorâmico)</label>
                    <div className="w-full h-16 rounded-xl overflow-hidden border border-[var(--theme-border)] bg-black/20 relative flex items-center justify-center">
                      {deliveryBannerUrl.trim() ? (
                        <img src={deliveryBannerUrl} alt="Banner" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest">Sem Banner</span>
                      )}
                      {uploadingBanner && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleBannerUpload}
                        id="delivery-banner-upload"
                        className="hidden"
                        disabled={uploadingBanner}
                      />
                      <label 
                        htmlFor="delivery-banner-upload"
                        className="inline-flex px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      >
                        {uploadingBanner ? 'Enviando...' : 'Mudar Capa'}
                      </label>
                    </div>
                  </div>
                </div>

              </div>

              {/* Ações */}
              <div className="pt-4 flex gap-3 border-t border-[var(--theme-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1 py-3.5 bg-[var(--theme-glass)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-glass-hover)] text-gray-400 hover:text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer bg-transparent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings || uploadingLogo || uploadingBanner}
                  className="flex-1 py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/10 border-0 cursor-pointer"
                >
                  {isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}
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
