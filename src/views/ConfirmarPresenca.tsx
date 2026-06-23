import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Loader2, Star, Gift, DollarSign, MapPin } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { db } from '../lib/firebase';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { generateStaticPix } from '../lib/pix';

export default function ConfirmarPresenca() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appointmentId = searchParams.get('id');
  const orgId = searchParams.get('orgId');
  const clientId = searchParams.get('clientId');

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successStatus, setSuccessStatus] = useState<'confirmed' | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados do Clube de Fidelidade
  const [fidelityConfig, setFidelityConfig] = useState<any>(null);
  const [fidelityLoading, setFidelityLoading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  // Estados do Pix
  const [pixConfig, setPixConfig] = useState<any>(null);
  const [pixCode, setPixCode] = useState<string>('');
  
  // Estado para Endereço da Organização
  const [orgAddress, setOrgAddress] = useState('');

  const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';

  useEffect(() => {
    if (!orgId || !appointmentId) {
      setError('Link inválido. Certifique-se de usar o link enviado pelo estabelecimento.');
      setLoading(false);
      return;
    }

    const fetchAppointment = async () => {
      try {
        const url = `${crmApiUrl}/api/portal_handler?action=public_get_appointment&orgId=${orgId}&appointmentId=${appointmentId}${clientId ? `&clientId=${clientId}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Erro ao carregar dados do agendamento.');
        }

        const data = await response.json();
        setAppointment(data);
        if (data.status === 'confirmed') {
          setSuccessStatus('confirmed');
        } else if (data.status === 'cancelled') {
          setSuccessStatus('cancelled');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Não foi possível carregar os dados do agendamento.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [orgId, appointmentId, clientId, crmApiUrl]);

  // Busca dados da organização, incluindo o endereço para o "Como Chegar"
  useEffect(() => {
    if (!orgId) return;
    const fetchOrgData = async () => {
      try {
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          const data = orgSnap.data();
          setOrgAddress(data?.address || data?.endereco || data?.city || '');
        }
      } catch (e) {
        console.error('Erro ao buscar dados da organização:', e);
      }
    };
    fetchOrgData();
  }, [orgId]);

  // Carrega configurações de fidelidade e histórico do cliente
  useEffect(() => {
    if (!orgId || !appointment || !appointment.clientPhone) return;

    const loadFidelity = async () => {
      setFidelityLoading(true);
      try {
        let config: any = null;
        if (clientId) {
          const clientRef = doc(db, 'organizations', orgId, 'clients', clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            config = clientSnap.data()?.fidelitySettings || null;
          }
        }

        // Fallback para subcoleção do cliente ou coleção global se não houver o campo no documento
        if (!config) {
          const fidelityRef = clientId 
            ? doc(db, 'organizations', orgId, 'clients', clientId, 'settings', 'fidelity')
            : doc(db, 'organizations', orgId, 'settings', 'fidelity');
          const fidelitySnap = await getDoc(fidelityRef);
          if (fidelitySnap.exists()) {
            config = fidelitySnap.data();
          }
        }

        if (config && config.active) {
          setFidelityConfig(config);

          // Busca agendamentos completed do mesmo telefone
          const apptsRef = collection(db, 'organizations', orgId, 'appointments');
          const q = query(
            apptsRef, 
            where('clientPhone', '==', appointment.clientPhone),
            where('status', '==', 'completed')
          );
          const snap = await getDocs(q);
          setCompletedCount(snap.size);
        }
      } catch (e) {
        console.error('Erro ao buscar fidelidade do cliente:', e);
      } finally {
        setFidelityLoading(false);
      }
    };

    loadFidelity();
  }, [orgId, appointment, clientId]);

  // Busca configurações de Pix do Firestore
  useEffect(() => {
    if (!orgId) return;
    const loadPixSettings = async () => {
      try {
        let data: any = null;
        if (clientId) {
          const clientRef = doc(db, 'organizations', orgId, 'clients', clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            data = clientSnap.data()?.schedulingSettings || null;
          }
        }

        // Fallback para subcoleção do cliente ou coleção global se não houver no documento
        if (!data) {
          const docRef = clientId 
            ? doc(db, 'organizations', orgId, 'clients', clientId, 'settings', 'scheduling')
            : doc(db, 'organizations', orgId, 'settings', 'scheduling');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            data = docSnap.data();
          }
        }

        if (data) {
          if (data.pixKey && data.pixEnabled) {
            setPixConfig(data);
          }
        }
      } catch (e) {
        console.error('Erro ao buscar configurações de Pix:', e);
      }
    };
    loadPixSettings();
  }, [orgId, clientId]);

  // Gera o código Pix Copia e Cola
  useEffect(() => {
    if (!pixConfig || !appointment || appointment.paymentStatus === 'paid' || appointment.price <= 0) return;
    
    try {
      const code = generateStaticPix({
        key: pixConfig.pixKey,
        name: pixConfig.pixName || 'Empresa',
        city: pixConfig.pixCity || 'Sao Paulo',
        amount: appointment.price,
        txid: appointmentId ? appointmentId.substring(0, 25) : '***'
      });
      setPixCode(code);
    } catch (e) {
      console.error('Erro ao gerar código Pix:', e);
    }
  }, [pixConfig, appointment, appointmentId]);

  const handleConfirm = async (confirm: boolean) => {
    const targetStatus = confirm ? 'confirmed' : 'cancelled';
    setActionLoading(true);
    try {
      const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'public_confirm_appointment',
          orgId,
          appointmentId,
          status: targetStatus
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Falha ao atualizar o agendamento.');
      }

      setSuccessStatus(targetStatus);
      toast.success(confirm ? 'Presença confirmada com sucesso!' : 'Agendamento cancelado.');

      if (confirm) {
        // Dispara efeito de confetes simplificado via CSS/DOM
        triggerConfetti();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao processar sua solicitação.');
    } finally {
      setActionLoading(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const interval = setInterval(() => {
      if (Date.now() > end) {
        return clearInterval(interval);
      }

      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.backgroundColor = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6'][Math.floor(Math.random() * 5)];
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.top = '-10px';
      confetti.style.zIndex = '9999';
      confetti.style.borderRadius = '50%';
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      
      // Animação de queda livre
      confetti.animate([
        { top: '-10px', transform: `translateX(0) rotate(0)` },
        { top: '100vh', transform: `translateX(${Math.sin(Math.random()) * 200 - 100}px) rotate(720deg)` }
      ], {
        duration: Math.random() * 1500 + 1500,
        easing: 'ease-out'
      });

      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3000);
    }, 50);
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '';
    const date = new Date(dataStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center max-w-sm w-full text-center shadow-2xl">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
          <p className="text-gray-400 font-medium animate-pulse">Carregando dados do agendamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-white/[0.02] border border-red-500/20 rounded-3xl flex flex-col items-center max-w-md w-full text-center shadow-2xl space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 animate-bounce" />
          <h2 className="text-lg font-bold text-white">Oops! Algo deu errado.</h2>
          <p className="text-gray-400 text-xs leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <Toaster theme="dark" position="top-center" richColors />
      
      {/* Detalhes Visuais no Fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        
        {/* Logo da Organização */}
        <div className="flex justify-center mb-6">
          <div className="p-2 bg-white/[0.02] border border-white/10 rounded-3xl shadow-xl max-w-[240px] h-28 flex items-center justify-center overflow-hidden">
            <img 
              src={appointment?.logoUrl || "https://i.imgur.com/zCvL7xy.png"} 
              alt="Logo" 
              className="max-w-full max-h-full object-contain" 
            />
          </div>
        </div>

        {/* Card Principal */}
        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
          
          {successStatus === null ? (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-black text-white leading-tight">Confirmação de Agendamento</h1>
                <p className="text-gray-400 text-xs mt-1">Por favor, confirme se você comparecerá ao horário abaixo.</p>
              </div>

              {/* Informações do Agendamento */}
              <div className="bg-black/30 border border-white/5 rounded-2xl p-5 space-y-4">
                <div>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Cliente</span>
                  <span className="text-white font-bold text-base mt-0.5 block">{appointment?.clientName}</span>
                </div>

                <div className="h-[1px] bg-white/5" />

                <div>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Serviço</span>
                  <span className="text-white font-bold text-sm mt-0.5 block">{appointment?.serviceName}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Data</span>
                      <span className="text-white font-bold text-xs mt-0.5 block">
                        {appointment?.date ? new Date(appointment.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Horário</span>
                      <span className="text-white font-bold text-xs mt-0.5 block">{appointment?.time}</span>
                    </div>
                  </div>
                </div>

                {appointment?.price > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Valor</span>
                    <span className="text-emerald-400 font-black text-lg mt-0.5 block">
                      R$ {appointment.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={actionLoading}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span>Confirmar Presença</span>
                </button>

                <button
                  onClick={() => handleConfirm(false)}
                  disabled={actionLoading}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-300 hover:text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <span>Não posso ir / Reagendar</span>
                </button>
              </div>
            </div>
          ) : successStatus === 'confirmed' ? (
            <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-white">Presença Confirmada!</h1>
                <p className="text-gray-400 text-xs max-w-xs mx-auto leading-relaxed font-sans">
                  Obrigado por confirmar! Sua vaga está oficialmente reservada para o dia <span className="text-white font-bold">{appointment?.date ? new Date(appointment.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span> às <span className="text-white font-bold">{appointment?.time}</span>.
                </p>
                {orgAddress && (
                  <div className="flex justify-center mt-3 pb-1">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orgAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer decoration-none"
                    >
                      <MapPin size={11} className="text-primary-400" />
                      <span>Como Chegar ({orgAddress})</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Cartão Fidelidade Digital */}
              {fidelityConfig && (
                <div 
                  className="border border-white/10 rounded-3xl p-5 text-center space-y-4 shadow-xl"
                  style={{
                    backgroundColor: `${fidelityConfig.walletCardColor || '#6366f1'}15`,
                    borderColor: `${fidelityConfig.walletCardColor || '#6366f1'}30`,
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Gift className="w-5 h-5" style={{ color: fidelityConfig.walletCardColor || '#6366f1' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: fidelityConfig.walletTextColor || '#ffffff' }}>
                      Cartão Fidelidade
                    </h3>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Acumule <span className="text-white font-bold">{fidelityConfig.goal}</span> atendimentos concluídos e ganhe: <span className="font-bold" style={{ color: fidelityConfig.walletCardColor || '#6366f1' }}>{fidelityConfig.reward}</span>
                  </p>

                  {/* Grid de Carimbos */}
                  <div className="flex flex-wrap items-center justify-center gap-2 py-2">
                    {Array.from({ length: fidelityConfig.goal }).map((_, i) => {
                      const isStamped = i < completedCount;
                      return (
                        <div
                          key={i}
                          className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold transition-all ${
                            isStamped
                              ? 'border-amber-500 text-amber-400 shadow-md shadow-amber-500/10 animate-in zoom-in-75 duration-300'
                              : 'bg-black/40 border-white/10 text-gray-600 border-dashed'
                          }`}
                          style={isStamped ? {
                            backgroundColor: `${fidelityConfig.walletCardColor || '#6366f1'}30`,
                            borderColor: fidelityConfig.walletCardColor || '#6366f1',
                            color: fidelityConfig.walletTextColor || '#ffffff'
                          } : {}}
                        >
                          {isStamped ? (
                            <Star size={16} style={{ color: fidelityConfig.walletCardColor || '#6366f1', fill: fidelityConfig.walletCardColor || '#6366f1' }} />
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {completedCount >= fidelityConfig.goal ? (
                    <div className="bg-amber-500/20 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 font-bold leading-relaxed animate-pulse">
                      🎉 Parabéns! Você completou seu cartão fidelidade e ganhou: {fidelityConfig.reward}. Resgate agora mesmo com o estabelecimento!
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic">
                      Você possui {completedCount} {completedCount === 1 ? 'carimbo' : 'carimbos'}. Faltam {fidelityConfig.goal - completedCount} para ganhar!
                    </p>
                  )}

                  {/* Carteiras Digitais (Apple & Google Wallet) - Loyalty Card */}
                  <div className="border-t border-white/5 pt-3.5 space-y-2">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Salvar Cartão de Fidelidade no Celular</span>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <a
                        href={`${crmApiUrl}/api/portal_handler?action=public_get_wallet_pass&type=fidelity&orgId=${orgId}&clientId=${clientId || ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-black border border-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md decoration-none shrink-0"
                      >
                        <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                        </svg>
                        <span>Apple Wallet</span>
                      </a>
                      <a
                        href={`${crmApiUrl}/api/portal_handler?action=public_get_wallet_pass&type=fidelity&orgId=${orgId}&clientId=${clientId || ''}&platform=google`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-black border border-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md decoration-none shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#4285F4" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                          <path fill="#34A853" d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                        </svg>
                        <span>Google Wallet</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {pixCode && (
                <div className="bg-black/30 border border-white/5 rounded-3xl p-5 space-y-4 text-left animate-in fade-in duration-300">
                  <div className="text-center space-y-1">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-center gap-1.5">
                      <DollarSign className="text-primary-400" size={14} />
                      Garanta sua Vaga com Pix
                    </h3>
                    <p className="text-[10px] text-gray-500">Pague o Pix e envie o comprovante pelo WhatsApp abaixo.</p>
                  </div>
                  
                  {/* QR Code */}
                  <div className="bg-white p-2.5 rounded-2xl w-40 h-40 mx-auto flex items-center justify-center border border-white/10">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`} 
                      alt="Pix QR Code" 
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Pix Copia e Cola */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Pix Copia e Cola</span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={pixCode}
                        className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-white text-[10px] font-mono rounded-xl outline-none select-all truncate"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(pixCode);
                          toast.success('Código Pix copiado!');
                        }}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-0 shrink-0"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  {/* Botão de Confirmação WhatsApp */}
                  <button
                    type="button"
                    onClick={() => {
                      const dateObj = new Date(appointment.date + 'T12:00:00');
                      const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      const text = `Olá! Confirmei minha presença no agendamento de *${appointment.serviceName}* no dia *${dateFormatted}* às *${appointment.time}*.\n\nFiz o pagamento do Pix no valor de *R$ ${appointment.price.toFixed(2).replace('.', ',')}*. Segue o comprovante em anexo.`;
                      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                      window.open(url, '_blank');
                    }}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 cursor-pointer border-0 mt-2 hover:scale-[1.02]"
                  >
                    <MessageSquare size={16} />
                    <span>Confirmar Pagamento (Enviar Comprovante)</span>
                  </button>
                </div>
              )}

              <div className="bg-black/30 border border-white/5 rounded-2xl p-4 text-[11px] text-gray-500 text-left space-y-1">
                <p className="font-bold text-gray-400 mb-1">Informações importantes:</p>
                <p>&bull; Recomendamos chegar com 5 a 10 minutos de antecedência.</p>
                <p>&bull; Caso precise desmarcar de última hora, entre em contato diretamente com o estabelecimento.</p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-rose-400" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-black text-white">Agendamento Cancelado</h1>
                <p className="text-gray-400 text-xs max-w-xs mx-auto leading-relaxed">
                  Entendemos que imprevistos acontecem. O estabelecimento já foi notificado sobre o seu cancelamento para liberar o horário.
                </p>
              </div>

              {/* Botões de Ação para Reagendamento */}
              <div className="pt-2 space-y-2.5">
                <button
                  onClick={() => navigate(`/agendar/${orgId}`)}
                  className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-primary-500/10 cursor-pointer border-0"
                >
                  <Calendar className="w-4.5 h-4.5" />
                  <span>Reagendar Online agora</span>
                </button>

                <button
                  onClick={() => {
                    toast.info('Redirecionando para o atendimento...');
                    setTimeout(() => {
                      window.location.href = `https://wa.me/?text=Olá, gostaria de reagendar meu serviço de ${appointment?.serviceName} que estava agendado para o dia ${appointment?.date ? new Date(appointment.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}.`;
                    }, 1000);
                  }}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer border-0"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Falar com Estabelecimento (WhatsApp)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé institucional */}
        <div className="text-center">
          <p className="text-gray-600 text-[10px]">
            Desenvolvido por Hub CRM &bull; Gestão de Negócios Simplificada
          </p>
        </div>
      </div>
    </div>
  );
}
