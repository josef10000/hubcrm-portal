import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { Scissors, Plus, Trash2, Check, X, Phone, Search, Sliders, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from './CustomSelect';

interface PortalPackagesProps {
  orgId: string;
}

export default function PortalPackages({ orgId }: PortalPackagesProps) {
  const [packagesActive, setPackagesActive] = useState(false);
  const [clientPackages, setClientPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário de novo pacote
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [pkgClientName, setPkgClientName] = useState('');
  const [pkgClientPhone, setPkgClientPhone] = useState('');
  const [pkgServiceId, setPkgServiceId] = useState('');
  const [pkgTotalSessions, setPkgTotalSessions] = useState(10);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Barra de pesquisa
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Escuta se a funcionalidade de pacotes está ativa
  useEffect(() => {
    if (!orgId) return;
    const docRef = doc(db, 'organizations', orgId, 'settings', 'scheduling');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPackagesActive(data.packagesActive || false);
      }
    });
    return () => unsub();
  }, [orgId]);

  // 2. Escuta os pacotes do cliente
  useEffect(() => {
    if (!orgId) return;
    const packagesRef = collection(db, 'organizations', orgId, 'client_packages');
    const q = query(packagesRef, orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClientPackages(list);
      setLoading(false);
    }, (err) => {
      console.error('Erro ao ler pacotes do Firestore:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  // 3. Escuta os serviços disponíveis
  useEffect(() => {
    if (!orgId) return;
    const servicesRef = collection(db, 'organizations', orgId, 'client_services');
    const q = query(servicesRef, orderBy('name', 'asc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(list);
    });

    return () => unsub();
  }, [orgId]);

  // Alternar ativação de pacotes
  const handleToggleActive = async (newVal: boolean) => {
    if (!orgId) return;
    try {
      const docRef = doc(db, 'organizations', orgId, 'settings', 'scheduling');
      await setDoc(docRef, { packagesActive: newVal }, { merge: true });
      setPackagesActive(newVal);
      toast.success(newVal ? 'Uso de pacotes ativado!' : 'Uso de pacotes desativado.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alterar status da funcionalidade.');
    }
  };

  // Salvar novo pacote
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgClientName.trim() || !pkgClientPhone.trim() || !pkgServiceId || !orgId) {
      toast.error('Preencha todos os campos obrigatórios do pacote.');
      return;
    }

    setIsSavingPackage(true);
    try {
      const selectedService = services.find(s => s.id === pkgServiceId);
      const serviceName = selectedService ? selectedService.name : 'Serviço';
      const cleanedPhone = pkgClientPhone.replace(/\D/g, '');

      const payload = {
        clientName: pkgClientName.trim(),
        clientPhone: cleanedPhone,
        serviceId: pkgServiceId,
        serviceName: serviceName,
        totalSessions: Number(pkgTotalSessions),
        usedSessions: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        sessionsHistory: []
      };

      await addDoc(collection(db, 'organizations', orgId, 'client_packages'), payload);
      toast.success('Pacote cadastrado com sucesso!');
      
      setPkgClientName('');
      setPkgClientPhone('');
      setPkgServiceId('');
      setPkgTotalSessions(10);
      setIsAddingPackage(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cadastrar pacote.');
    } finally {
      setIsSavingPackage(false);
    }
  };

  // Ajustar sessões usadas do pacote
  const handleAdjustPackageSessions = async (packageId: string, usedAdj: number, totalAdj: number) => {
    if (!orgId) return;
    const pkg = clientPackages.find(p => p.id === packageId);
    if (!pkg) return;

    const newUsed = Math.max(0, pkg.usedSessions + usedAdj);
    const newTotal = Math.max(1, pkg.totalSessions + totalAdj);
    const newStatus = newUsed >= newTotal ? 'completed' : 'active';

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'client_packages', packageId), {
        usedSessions: newUsed,
        totalSessions: newTotal,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success('Saldo do pacote ajustado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao ajustar sessões do pacote.');
    }
  };

  // Excluir pacote
  const handleDeletePackage = async (packageId: string) => {
    if (!orgId) return;
    if (!confirm('Deseja realmente excluir este pacote? Todos os créditos restantes serão perdidos.')) return;
    
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'client_packages', packageId));
      toast.success('Pacote excluído com sucesso.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir pacote.');
    }
  };

  // Filtra pacotes na barra de busca
  const getFilteredPackages = () => {
    if (!searchQuery.trim()) return clientPackages;
    return clientPackages.filter(pkg => 
      pkg.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      pkg.clientPhone?.includes(searchQuery)
    );
  };

  const filteredPackages = getFilteredPackages();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bloco de Ativação / Configuração Geral */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Scissors size={18} className="text-primary-400" />
              Funcionalidade de Pacotes de Sessões
            </h4>
            <p className="text-xs text-gray-400 mt-1">
              Permite a venda de pacotes e a dedução automática de saldos ao agendar atendimentos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="packagesActive"
              checked={packagesActive}
              onChange={(e) => handleToggleActive(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 text-primary-500 bg-black/40 focus:ring-primary-500 focus:ring-offset-black cursor-pointer"
            />
            <label htmlFor="packagesActive" className="text-xs font-bold text-white cursor-pointer select-none">
              Ativar funcionalidade de pacotes
            </label>
          </div>
        </div>
      </div>

      {packagesActive && (
        <div className="space-y-6">
          {/* Cabeçalho da Listagem / Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Gerenciamento de Pacotes Ativos
              </h4>
              <p className="text-xs text-gray-400">
                Acompanhe o consumo e controle o saldo de créditos dos clientes.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Barra de Pesquisa */}
              <div className="relative flex-1 sm:max-w-xs sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente ou telefone..."
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0d0e12]/80 backdrop-blur-xl border border-white/10 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600"
                />
              </div>

              {!isAddingPackage && (
                <button
                  type="button"
                  onClick={() => setIsAddingPackage(true)}
                  className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                >
                  <Plus size={12} />
                  <span>Vender Pacote</span>
                </button>
              )}
            </div>
          </div>

          {/* Formulário Novo Pacote */}
          {isAddingPackage && (
            <form onSubmit={handleSavePackage} className="p-5 bg-black/40 border border-white/10 rounded-2xl space-y-4 animate-in fade-in duration-200">
              <h4 className="text-xs font-black uppercase tracking-wider text-primary-400">Cadastrar Novo Pacote de Sessões</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome do Cliente</label>
                  <input
                    type="text"
                    value={pkgClientName}
                    onChange={(e) => setPkgClientName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">WhatsApp do Cliente</label>
                  <input
                    type="text"
                    value={pkgClientPhone}
                    onChange={(e) => setPkgClientPhone(e.target.value)}
                    placeholder="Ex: 11999999999"
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Serviço do Pacote</label>
                  <CustomSelect
                    value={pkgServiceId}
                    onChange={(val) => setPkgServiceId(val)}
                    options={[
                      { value: '', label: 'Selecione um serviço...' },
                      ...services.map(s => ({ value: s.id, label: `${s.name} (R$ ${s.price?.toFixed(2)})` }))
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total de Sessões</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pkgTotalSessions}
                    onChange={(e) => setPkgTotalSessions(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="submit"
                  disabled={isSavingPackage}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border-0 disabled:opacity-50"
                >
                  <Check size={12} />
                  <span>{isSavingPackage ? 'Salvando...' : 'Confirmar Venda'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingPackage(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Listagem de Pacotes Cadastrados */}
          {filteredPackages.length === 0 ? (
            <div className="p-10 text-center bg-black/20 rounded-2xl border border-white/5">
              <p className="text-xs text-gray-500">Nenhum pacote encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPackages.map((pkg) => {
                const percent = Math.min(100, (pkg.usedSessions / pkg.totalSessions) * 100);
                const isCompleted = pkg.status === 'completed';
                return (
                  <div key={pkg.id} className="bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white block">{pkg.clientName}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isCompleted 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                        }`}>
                          {isCompleted ? 'Concluído' : 'Ativo'}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                        <Phone size={10} className="text-gray-500" />
                        {pkg.clientPhone}
                      </p>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400 font-medium">{pkg.serviceName}</span>
                          <span className="text-white font-black">{pkg.usedSessions} / {pkg.totalSessions} sessões</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-primary-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                      {/* Ajuste Rápido de Créditos */}
                      <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustPackageSessions(pkg.id, -1, 0)}
                          className="px-2.5 py-1 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
                          title="Deduzir 1 sessão usada"
                        >
                          -1
                        </button>
                        <span className="text-[10px] font-black px-1.5 text-gray-400 select-none">Usadas</span>
                        <button
                          type="button"
                          onClick={() => handleAdjustPackageSessions(pkg.id, 1, 0)}
                          className="px-2.5 py-1 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
                          title="Adicionar 1 sessão usada"
                        >
                          +1
                        </button>
                      </div>

                      {/* Excluir Pacote */}
                      <button
                        type="button"
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition-all cursor-pointer border-0"
                        title="Excluir pacote"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
