import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function ConfirmarPresenca() {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('id');
  const orgId = searchParams.get('orgId');
  const clientId = searchParams.get('clientId');

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successStatus, setSuccessStatus] = useState<'confirmed' | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        {appointment?.logoUrl ? (
          <div className="flex justify-center mb-6">
            <div className="p-2 bg-white/[0.02] border border-white/10 rounded-3xl shadow-xl max-w-[240px] h-28 flex items-center justify-center overflow-hidden">
              <img src={appointment.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="text-center mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400 bg-primary-500/10 px-3.5 py-1.5 rounded-full border border-primary-500/20">
              Hub Agenda
            </span>
          </div>
        )}

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
                <p className="text-gray-400 text-xs max-w-xs mx-auto leading-relaxed">
                  Obrigado por confirmar! Sua vaga está oficialmente reservada para o dia <span className="text-white font-bold">{appointment?.date ? new Date(appointment.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span> às <span className="text-white font-bold">{appointment?.time}</span>.
                </p>
              </div>

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

              {/* Botão para falar direto no WhatsApp do estabelecimento para reagendar */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    // Direciona para o WhatsApp de suporte ou geral
                    toast.info('Redirecionando para o atendimento...');
                    setTimeout(() => {
                      window.location.href = `https://wa.me/?text=Olá, gostaria de reagendar meu serviço de ${appointment?.serviceName} que estava agendado para o dia ${appointment?.date ? new Date(appointment.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}.`;
                    }, 1000);
                  }}
                  className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-primary-500/10 cursor-pointer"
                >
                  <MessageSquare size={14} />
                  <span>Reagendar via WhatsApp</span>
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
