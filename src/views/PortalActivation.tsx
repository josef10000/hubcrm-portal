import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { toast, Toaster } from 'sonner';
import { Key, Globe, Loader2, ShieldAlert, LogOut } from 'lucide-react';

export default function PortalActivation() {
  const navigate = useNavigate();
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        toast.error('Você precisa estar logado para ativar um portal.');
        navigate('/login');
      }
      setCheckingAuth(false);
    });
    return () => unsub();
  }, [navigate]);

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      toast.error('Por favor, insira o código de ativação.');
      return;
    }

    if (!currentUser) {
      toast.error('Sessão expirada. Faça login novamente.');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const formattedCode = activationCode.trim().toUpperCase();
      
      const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          activationCode: formattedCode,
          email: currentUser.email,
          uid: currentUser.uid
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Portal ativado com sucesso! Redirecionando...');
        
        // Salva o token de segurança retornado no localStorage
        if (data.token) {
          localStorage.setItem('portalToken', data.token);
          sessionStorage.setItem('portalToken', data.token);
        }

        setTimeout(() => {
          navigate(`/${data.orgId}/${data.clientId}${data.token ? `?token=${data.token}` : ''}`);
        }, 1500);
      } else {
        toast.error(data.error || 'Código de ativação inválido ou já utilizado.');
      }
    } catch (err) {
      console.error('[ActivationError]', err);
      toast.error('Erro de conexão ao ativar o portal. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Desconectado com sucesso.');
      navigate('/login');
    } catch (e) {
      toast.error('Erro ao sair da conta.');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center select-none font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mb-4"></div>
        <p className="text-gray-400 font-medium animate-pulse">Verificando conta...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
      <Toaster position="top-right" richColors />
      
      {/* Orbes Decorativas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[50vw] h-[50vw] bg-primary-600/10 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[50vw] h-[50vw] bg-emerald-600/10 rounded-full blur-[140px]"></div>
      </div>

      <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500 relative z-10">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/20 border border-white/15">
              <Globe className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">PORTAL HUB</h1>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-[0.2em] font-bold">Ativação de Área Restrita</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-[35px] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-6 text-left">
          <div className="space-y-2 text-center pb-2 border-b border-white/5">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 mb-3">
              <Key size={22} className="animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-white">Insira o Código Único</h2>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              Sua conta <strong>{currentUser?.email}</strong> está logada, mas ainda não está associada a nenhuma empresa. Cole o código fornecido pelo suporte.
            </p>
          </div>

          <form onSubmit={handleActivation} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Código de Ativação</label>
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="Ex: HUB-A5B2C3"
                className="w-full px-4 py-3.5 bg-black/30 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-center font-mono font-bold tracking-widest text-lg outline-none transition-all placeholder-gray-700 focus:ring-1 focus:ring-primary-500 uppercase"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-600/50 text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-primary-500/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 text-white" />
                  <span>Vinculando Portal...</span>
                </>
              ) : (
                <>
                  <span>Ativar Meu Portal</span>
                  <Key size={16} />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 flex justify-between items-center text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <ShieldAlert size={14} className="text-gray-600" />
              <span>Precisa de ajuda? Fale com o suporte</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors"
            >
              <LogOut size={14} />
              Sair da conta
            </button>
          </div>
        </div>

        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-medium">
          Portal Hub &copy; 2026 - Área Restrita
        </p>
      </div>
    </div>
  );
}
