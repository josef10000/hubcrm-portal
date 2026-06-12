import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Instagram, 
  Phone, 
  Facebook, 
  Youtube, 
  Globe, 
  Calendar, 
  ChevronRight, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';

export default function PortalBioSite() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioData, setBioData] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);

  useEffect(() => {
    if (!orgId) {
      setError('Identificador da organização ausente.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Carrega dados da Org para pegar nome padrão e logo
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          setOrgData(orgSnap.data());
        }

        // Carrega as configurações da bio
        const bioRef = doc(db, 'organizations', orgId, 'settings', 'biosite');
        const bioSnap = await getDoc(bioRef);
        if (bioSnap.exists()) {
          setBioData(bioSnap.data());
        } else {
          // Se não existir, define um fallback com base na organização
          setBioData({
            title: orgSnap.exists() ? orgSnap.data().name : 'Nosso Negócio',
            description: 'Seja bem-vindo à nossa página pública. Veja nossos links e faça um agendamento online.',
            avatarUrl: orgSnap.exists() ? orgSnap.data().logoUrl : '',
            links: [],
            showBooking: true
          });
        }
      } catch (err: any) {
        console.error('Erro ao buscar dados do Mini-Site:', err);
        setError('Não foi possível carregar as informações do Mini-Site.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4 animate-spin" />
        <p className="text-gray-400 font-medium animate-pulse">Carregando Mini-Site...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 text-center">
        <div className="p-8 bg-white/[0.02] border border-red-500/20 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
          <h2 className="text-lg font-bold text-white">Ops! Algo deu errado.</h2>
          <p className="text-gray-400 text-xs leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  const title = bioData?.title || orgData?.name || 'Nosso Negócio';
  const description = bioData?.description || 'Agende online e acesse nossas redes.';
  const avatarUrl = bioData?.avatarUrl || orgData?.logoUrl || '';
  const links = bioData?.links || [];
  const showBooking = bioData?.showBooking !== undefined ? bioData.showBooking : true;

  const iconMap: Record<string, React.ReactNode> = {
    instagram: <Instagram className="w-5 h-5 text-pink-400" />,
    whatsapp: <Phone className="w-5 h-5 text-emerald-400" />,
    facebook: <Facebook className="w-5 h-5 text-blue-400" />,
    youtube: <Youtube className="w-5 h-5 text-red-400" />,
    website: <Globe className="w-5 h-5 text-gray-300" />
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden flex flex-col items-center justify-start py-16 px-4">
      {/* Círculos decorativos de background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md flex flex-col items-center space-y-8 relative z-10">
        
        {/* Header da Bio */}
        <div className="flex flex-col items-center text-center space-y-4 w-full">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 p-1 bg-white/5 backdrop-blur-md shadow-xl flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={title} className="w-full h-full object-cover rounded-full" />
            ) : (
              <Globe className="w-10 h-10 text-gray-500" />
            )}
          </div>
          <div className="space-y-1.5 px-4">
            <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight">{title}</h1>
            <p className="text-gray-400 text-xs lg:text-sm leading-relaxed max-w-sm">{description}</p>
          </div>
        </div>

        {/* Links da Bio */}
        <div className="w-full space-y-4">
          
          {/* Link Principal de Agendamento (Destacado) */}
          {showBooking && (
            <button
              onClick={() => navigate(`/agendar/${orgId}`)}
              className="w-full p-4.5 bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-between border border-white/10 group cursor-pointer relative overflow-hidden"
            >
              {/* Brilho animado */}
              <div className="absolute inset-0 w-1/2 h-full bg-white/10 skew-x-[-25deg] -translate-x-full group-hover:animate-shine" />
              
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm block">Agendamento Online</span>
                  <span className="text-[10px] text-white/70 font-medium">Reserve seu horário agora mesmo</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          {/* Outros Links */}
          {links.length > 0 ? (
            links.map((link: any, idx: number) => (
              <a
                key={link.id || idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-4.5 bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-white/20 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2 bg-white/5 rounded-xl border border-white/5 group-hover:bg-white/10 transition-colors">
                    {iconMap[link.icon] || <Globe className="w-5 h-5 text-gray-300" />}
                  </div>
                  <span className="text-sm">{link.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </a>
            ))
          ) : (
            !showBooking && (
              <p className="text-center text-xs text-gray-600 italic">Nenhum link disponível no momento.</p>
            )
          )}
        </div>

        {/* Footer/Rodapé */}
        <div className="pt-8 text-center flex flex-col items-center">
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Tecnologia por</span>
          <span className="text-xs font-black bg-gradient-to-r from-primary-400 to-indigo-400 bg-clip-text text-transparent mt-1 select-none">
            Portal Hub
          </span>
        </div>

      </div>
    </div>
  );
}
