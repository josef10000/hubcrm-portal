import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Wifi, Key, Copy, Check, MessageSquare, Home, ArrowLeft, AlertTriangle, 
  MapPin, ShieldCheck, HeartHandshake, EyeOff, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function PortalResourceGuide() {
  const { orgId, resourceId } = useParams<{ orgId: string; resourceId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resource, setResource] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!orgId || !resourceId) return;
      
      try {
        // Carrega dados da organização
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          setOrganization(orgSnap.data());
        }
        
        // Carrega dados do recurso
        const resourceRef = doc(db, 'organizations', orgId, 'resources', resourceId);
        const resourceSnap = await getDoc(resourceRef);
        if (resourceSnap.exists()) {
          setResource(resourceSnap.data());
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do guia:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [orgId, resourceId]);

  const handleCopyWifiPassword = () => {
    if (!resource?.wifiPassword) return;
    navigator.clipboard.writeText(resource.wifiPassword);
    setCopiedWifi(true);
    toast.success('Senha do Wi-Fi copiada para a área de transferência!');
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const handleCopyShareLink = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success('Link do Guia copiado com sucesso!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p className="text-gray-400 font-medium animate-pulse">Carregando o manual de acesso...</p>
      </div>
    );
  }

  if (notFound || !resource) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-500/10 p-4 rounded-full border border-rose-500/20 text-rose-500 mb-6">
          <EyeOff size={40} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Guia Não Encontrado</h2>
        <p className="text-gray-400 max-w-sm mb-8 text-sm">
          Este manual de acesso não existe ou foi removido pelo anfitrião. Por favor, verifique o link enviado.
        </p>
      </div>
    );
  }

  // Prepara link de suporte via WhatsApp
  const phoneClean = (organization?.phone || '').replace(/\D/g, '');
  const supportText = `Olá! Sou hóspede na propriedade *${resource.name}* e preciso de suporte com a minha estadia.`;
  const whatsappUrl = `https://wa.me/${phoneClean ? (phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean) : ''}?text=${encodeURIComponent(supportText)}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex justify-center selection:bg-primary-500 selection:text-white pb-12">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-xl px-4 md:px-6 relative z-10 pt-8 space-y-6">
        {/* Header da Organização */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {organization?.logoUrl ? (
              <img 
                src={organization.logoUrl} 
                alt={organization.name} 
                className="w-10 h-10 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400 font-bold">
                H
              </div>
            )}
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Manual da Propriedade</p>
              <h1 className="text-sm font-bold text-gray-300">{organization?.name || 'Portal Hub'}</h1>
            </div>
          </div>
          <button
            onClick={handleCopyShareLink}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-2"
          >
            {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            <span>{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>

        {/* Card do Imóvel */}
        <div className="bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20 text-primary-300 text-[10px] font-black uppercase tracking-wider">
            {resource.type === 'property' ? '🏠 Imóvel' : resource.type === 'space' ? '🎉 Espaço' : '📦 Item'}
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-primary-500/10 w-fit rounded-2xl text-primary-400 border border-primary-500/20">
              <Home size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">{resource.name}</h2>
              {resource.description && (
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  {resource.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card Wi-Fi */}
        {resource.wifiSsid && (
          <div className="bg-gradient-to-br from-purple-500/[0.04] to-transparent backdrop-blur-2xl border border-purple-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 text-purple-500/5 pointer-events-none">
              <Wifi size={140} />
            </div>
            
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-purple-500/10 w-fit rounded-xl text-purple-400 border border-purple-500/20">
                <Wifi size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Conexão Wi-Fi</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rede (SSID)</span>
                <div className="px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-mono text-white select-all">
                  {resource.wifiSsid}
                </div>
              </div>
              {resource.wifiPassword && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Senha da Rede</span>
                  <div className="relative">
                    <div className="px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-mono text-white pr-12 select-all">
                      {resource.wifiPassword}
                    </div>
                    <button
                      onClick={handleCopyWifiPassword}
                      className="absolute right-2.5 top-2.5 p-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer border-0"
                      title="Copiar senha"
                    >
                      {copiedWifi ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card Instruções de Acesso */}
        {resource.accessInstructions && (
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 w-fit rounded-xl text-amber-400 border border-amber-500/20">
                <Key size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Instruções de Acesso</h3>
            </div>
            
            <div className="bg-black/30 border border-white/5 p-4 rounded-2xl text-sm text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">
              {resource.accessInstructions}
            </div>
          </div>
        )}

        {/* Card Regras e Convivência */}
        {resource.rules && (
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 w-fit rounded-xl text-rose-400 border border-rose-500/20">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Regras e Convivência</h3>
            </div>
            
            <div className="bg-black/30 border border-white/5 p-4 rounded-2xl text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
              {resource.rules}
            </div>
          </div>
        )}

        {/* Card Segurança */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="text-emerald-500 shrink-0 mt-0.5" size={16} />
            <div>
              <h4 className="text-xs font-bold text-white">Segurança</h4>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                Ambiente monitorado e protegido contra acessos não autorizados.
              </p>
            </div>
          </div>
          <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex items-start gap-3">
            <HeartHandshake className="text-primary-400 shrink-0 mt-0.5" size={16} />
            <div>
              <h4 className="text-xs font-bold text-white">Estadia Feliz</h4>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                Preparamos tudo com carinho para que você tenha a melhor experiência!
              </p>
            </div>
          </div>
        </div>

        {/* Suporte Rápido WhatsApp */}
        {phoneClean && (
          <div className="pt-4">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black text-sm font-black rounded-2xl shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer no-underline text-center"
            >
              <MessageSquare size={18} />
              <span>Precisa de ajuda? Falar com Anfitrião</span>
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/5 space-y-1">
          <p className="text-[10px] text-gray-600">
            Powered by <strong>Portal Hub CRM</strong>
          </p>
          <p className="text-[9px] text-gray-700">
            &copy; {new Date().getFullYear()} Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
