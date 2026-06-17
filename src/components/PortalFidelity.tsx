import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, collection, updateDoc } from 'firebase/firestore';
import { Award, Sparkles, Edit2, Check, X, Users, Search, Phone, Star } from 'lucide-react';
import { toast } from 'sonner';

interface PortalFidelityProps {
  orgId: string;
  clientId: string;
}

export default function PortalFidelity({ orgId, clientId }: PortalFidelityProps) {
  const [fidelityActive, setFidelityActive] = useState(false);
  const [fidelityGoal, setFidelityGoal] = useState(10);
  const [fidelityReward, setFidelityReward] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [fidelityBackup, setFidelityBackup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Estados para buscar o progresso de fidelidade dos clientes
  const [appointments, setAppointments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Busca configurações de fidelidade
  useEffect(() => {
    if (!orgId || !clientId) return;

    const docRef = doc(db, 'organizations', orgId, 'clients', clientId, 'settings', 'fidelity');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFidelityActive(data.active || false);
        setFidelityGoal(data.goal || 10);
        setFidelityReward(data.reward || '');
      }
      setLoading(false);
    }, (err) => {
      console.error('Erro ao ler fidelity settings:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId, clientId]);

  // Busca atendimentos em tempo real para calcular a lista de fidelidade dos clientes
  useEffect(() => {
    if (!orgId) return;

    const appRef = collection(db, 'organizations', orgId, 'appointments');
    const unsub = onSnapshot(appRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    }, (err) => {
      console.error('Erro ao ler appointments para fidelidade:', err);
    });

    return () => unsub();
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId || !clientId) return;
    try {
      const docRef = doc(db, 'organizations', orgId, 'clients', clientId, 'settings', 'fidelity');
      const dataToSave = {
        active: fidelityActive,
        goal: Number(fidelityGoal),
        reward: fidelityReward
      };
      try {
        await updateDoc(docRef, dataToSave);
      } catch (err) {
        await setDoc(docRef, dataToSave, { merge: true });
      }
      toast.success('Configurações do Clube de Fidelidade salvas!');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar Clube de Fidelidade.');
    }
  };

  // Processa e agrupa atendimentos por telefone do cliente
  const getFidelityRanking = () => {
    const completedApps = appointments.filter(app => app.status === 'completed' && app.clientPhone);
    const clientsMap: { [phone: string]: { name: string; phone: string; count: number } } = {};

    completedApps.forEach(app => {
      const cleanPhone = app.clientPhone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone === '000000000') return;

      if (!clientsMap[cleanPhone]) {
        clientsMap[cleanPhone] = {
          name: app.clientName || 'Cliente sem nome',
          phone: app.clientPhone,
          count: 0
        };
      }
      clientsMap[cleanPhone].count += 1;
    });

    const ranking = Object.values(clientsMap).sort((a, b) => b.count - a.count);

    if (!searchQuery.trim()) return ranking;

    return ranking.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone.includes(searchQuery)
    );
  };

  const ranking = getFidelityRanking();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bloco de Configurações do Clube de Fidelidade */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Award size={18} className="text-primary-400" />
              Configuração do Clube de Fidelidade
            </h4>
            <p className="text-xs text-gray-400 mt-1">
              Ative e configure o cartão fidelidade para gamificar a experiência do cliente final.
            </p>
          </div>

          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setFidelityBackup({
                  active: fidelityActive,
                  goal: fidelityGoal,
                  reward: fidelityReward
                });
                setIsEditing(true);
              }}
              className="px-4 py-2.5 bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-primary-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border-0"
            >
              <Edit2 size={12} />
              <span>Editar Campanha</span>
            </button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border-0"
              >
                <Check size={12} />
                <span>Salvar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFidelityActive(fidelityBackup.active);
                  setFidelityGoal(fidelityBackup.goal);
                  setFidelityReward(fidelityBackup.reward);
                  setIsEditing(false);
                }}
                className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="p-5 bg-black/40 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="fidelityActive"
                checked={fidelityActive}
                onChange={(e) => setFidelityActive(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 text-primary-500 bg-black/40 focus:ring-primary-500 focus:ring-offset-black cursor-pointer"
              />
              <label htmlFor="fidelityActive" className="text-xs font-bold text-white cursor-pointer select-none">
                Ativar Clube de Fidelidade Digital
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Meta de Atendimentos Concluídos</label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={fidelityGoal}
                  disabled={!fidelityActive}
                  onChange={(e) => setFidelityGoal(Number(e.target.value))}
                  placeholder="Ex: 10"
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 disabled:opacity-30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição do Prêmio</label>
                <input
                  type="text"
                  value={fidelityReward}
                  disabled={!fidelityActive}
                  onChange={(e) => setFidelityReward(e.target.value)}
                  placeholder="Ex: Corte de Cabelo Grátis"
                  className="w-full px-4 py-3 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 disabled:opacity-30"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-black/20 border border-white/5 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${fidelityActive ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-white/5 border border-white/10 text-gray-500'}`}>
                <Sparkles size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Status: {fidelityActive ? 'Ativo' : 'Desativado'}
                </span>
                {fidelityActive && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Meta: {fidelityGoal} atendimentos concluídos para ganhar "{fidelityReward}".
                  </p>
                )}
              </div>
            </div>
            {fidelityActive && (
              <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-lg text-[10px] text-amber-400 font-bold uppercase tracking-wider self-start md:self-auto">
                Campanha Ativa
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bloco de Ranking / Cartão dos Clientes no Clube de Fidelidade */}
      {fidelityActive && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users size={18} className="text-primary-400" />
                Acompanhamento dos Clientes
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Veja a pontuação de fidelidade de seus clientes em tempo real.
              </p>
            </div>

            {/* Barra de Pesquisa */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente ou telefone..."
                className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/15 focus:border-primary-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600"
              />
            </div>
          </div>

          {ranking.length === 0 ? (
            <div className="p-10 text-center bg-black/20 rounded-2xl border border-white/5">
              <p className="text-xs text-gray-500">Nenhum cliente possui atendimentos concluídos no sistema ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ranking.map((client) => {
                const completedSessions = client.count;
                const remainingToGoal = fidelityGoal - (completedSessions % fidelityGoal);
                const currentCycleCount = completedSessions % fidelityGoal;
                const completedCycles = Math.floor(completedSessions / fidelityGoal);
                const percent = (currentCycleCount / fidelityGoal) * 100;

                return (
                  <div key={client.phone} className="bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-white block">{client.name}</span>
                          <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <Phone size={10} className="text-gray-500" />
                            {client.phone}
                          </span>
                        </div>
                        {completedCycles > 0 && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Star size={8} className="fill-amber-400 text-amber-400" />
                            {completedCycles} {completedCycles === 1 ? 'Prêmio ganho' : 'Prêmios ganhos'}
                          </span>
                        )}
                      </div>

                      {/* Progresso do Ciclo Atual */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-400 font-medium">Progresso para o próximo prêmio</span>
                          <span className="text-white font-black">{currentCycleCount} / {fidelityGoal} atendimentos</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className="h-full bg-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {currentCycleCount === 0 && completedCycles > 0 
                            ? `Resgate o prêmio "${fidelityReward}"! O progresso reiniciará na próxima visita.`
                            : `Faltam ${remainingToGoal} atendimentos para o prêmio.`}
                        </p>
                      </div>
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
