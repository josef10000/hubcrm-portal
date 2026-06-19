import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { 
  Instagram, 
  Phone, 
  Facebook, 
  Youtube, 
  Globe, 
  Calendar, 
  ChevronRight, 
  Loader2, 
  AlertTriangle,
  Search,
  Award,
  Sparkles,
  X,
  Gift
} from 'lucide-react';

export default function PortalBioSite() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClientId = searchParams.get('clientId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioData, setBioData] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [schedulingConfig, setSchedulingConfig] = useState<any>(null);
  const [fidelityConfig, setFidelityConfig] = useState<any>(null);
  
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);

  useEffect(() => {
    if (!orgId) {
      setError('Identificador da organização ausente.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
        const clientQueryParam = queryClientId ? `&clientId=${queryClientId}` : '';
        const res = await fetch(`${crmApiUrl}/api/portal_handler?action=public_get_bio&orgId=${orgId}${clientQueryParam}`);
        
        if (!res.ok) {
          throw new Error('Erro ao buscar dados do Mini-Site na API.');
        }

        const data = await res.json();
        
        if (data.org) {
          setOrgData(data.org);
        }
        if (data.bioSettings) {
          setBioData(data.bioSettings);
        }
        if (data.schedulingSettings) {
          setSchedulingConfig(data.schedulingSettings);
        }
        if (data.fidelitySettings) {
          setFidelityConfig(data.fidelitySettings);
        }
      } catch (err: any) {
        console.error('Erro ao buscar dados do Mini-Site:', err);
        setError('Não foi possível carregar as informações do Mini-Site.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId, queryClientId]);

  const handleSearchCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone.trim() || !orgId) return;

    setIsSearching(true);
    try {
      const cleanedPhone = searchPhone.replace(/\D/g, '');
      
      const packagesRef = collection(db, 'organizations', orgId, 'client_packages');
      const qPackages = query(
        packagesRef,
        where('clientPhone', '==', cleanedPhone),
        where('status', '==', 'active')
      );
      const snapPackages = await getDocs(qPackages);
      const packagesList = snapPackages.docs.map(d => ({ id: d.id, ...d.data() }));

      let completedFidelityCount = 0;
      if (fidelityConfig?.active) {
        const apptsRef = collection(db, 'organizations', orgId, 'appointments');
        const qFidelity = query(
          apptsRef,
          where('clientPhone', '==', cleanedPhone),
          where('status', '==', 'completed')
        );
        const snapFidelity = await getDocs(qFidelity);
        completedFidelityCount = snapFidelity.size;
      }

      setSearchResults({
        packages: packagesList,
        completedFidelityCount
      });
    } catch (err) {
      console.error('Erro ao buscar saldos:', err);
    } finally {
      setIsSearching(false);
    }
  };

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

  const formatInputPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 15);
    }
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

          {/* Botão de Consulta de Saldos (Se ativo nas configs) */}
          {((schedulingConfig?.packagesActive) || (fidelityConfig?.active)) && (
            <button
              onClick={() => {
                setIsQueryModalOpen(true);
                setSearchResults(null);
                setSearchPhone('');
              }}
              className="w-full p-4.5 bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 hover:bg-white/10 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                  <Search className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm block">Consultar Créditos & Fidelidade</span>
                  <span className="text-[10px] text-gray-400 font-medium">Veja seus saldos e carimbos fidelidade</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
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

      {/* Modal Glassmorphism de Consulta de Saldos */}
      {isQueryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0d0d0d]/90 border border-white/10 backdrop-blur-xl rounded-[2rem] p-6 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar">
            
            {/* Header do Modal */}
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Minha Área de Créditos</h3>
              </div>
              <button
                onClick={() => setIsQueryModalOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer border-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Se ainda não buscou */}
            {!searchResults ? (
              <form onSubmit={handleSearchCredits} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Digite o número do seu celular com WhatsApp para consultar seus pacotes de sessões e carimbos de fidelidade ativos.
                  </p>
                  
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="tel"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(formatInputPhone(e.target.value))}
                      placeholder="Ex: (11) 99999-9999"
                      className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/15 focus:border-indigo-500 text-white rounded-2xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-indigo-500 font-bold"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSearching || !searchPhone.trim()}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-white/5 disabled:text-gray-500 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      <span>Buscando informações...</span>
                    </>
                  ) : (
                    <span>Consultar Meus Saldos</span>
                  )}
                </button>
              </form>
            ) : (
              /* Se buscou e trouxe resultados */
              <div className="space-y-6">
                
                {/* Cabeçalho do Resultado */}
                <div className="flex justify-between items-center text-xs text-gray-400 bg-white/5 border border-white/5 p-3.5 rounded-2xl">
                  <span>Consulta para: <strong className="text-white">{searchPhone}</strong></span>
                  <button
                    onClick={() => setSearchResults(null)}
                    className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer border-0 bg-transparent"
                  >
                    Mudar telefone
                  </button>
                </div>

                {/* Exibição do Cartão Fidelidade */}
                {fidelityConfig?.active && (
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-400" />
                      <div>
                        <h4 className="text-sm font-black text-white">Clube de Fidelidade</h4>
                        <p className="text-[10px] text-gray-400">Junte carimbos e ganhe prêmios</p>
                      </div>
                    </div>
                    
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-medium">Recompensa:</span>
                      <span className="text-emerald-400 font-black uppercase tracking-wider">{fidelityConfig.reward || 'Prêmio Especial'}</span>
                    </div>

                    {/* Grid dos Carimbos */}
                    <div className="grid grid-cols-5 gap-3 pt-2">
                      {(() => {
                        const goal = fidelityConfig.goal || 10;
                        const currentPoints = searchResults.completedFidelityCount || 0;
                        const progress = currentPoints % goal;
                        
                        return Array.from({ length: goal }).map((_, i) => {
                          const isStamped = i < progress;
                          const isLast = i === goal - 1;
                          return (
                            <div 
                              key={i} 
                              className={`aspect-square rounded-full border flex items-center justify-center relative transition-all duration-500 ${
                                isStamped 
                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent shadow-lg shadow-indigo-500/20 text-white scale-105' 
                                  : 'bg-black/30 border-white/10 text-gray-600'
                              }`}
                            >
                              {isStamped ? (
                                isLast ? <Gift className="w-5 h-5 animate-bounce" /> : <Sparkles className="w-4 h-4 animate-pulse" />
                              ) : (
                                isLast ? <Gift className="w-4 h-4 opacity-40" /> : <span className="text-[10px] font-bold font-mono">{i + 1}</span>
                              )}
                              {isStamped && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full border border-black animate-ping" />
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    <p className="text-[10px] text-center text-gray-400">
                      Você tem <strong className="text-white">{(searchResults.completedFidelityCount % (fidelityConfig.goal || 10))}</strong> de <strong className="text-white">{fidelityConfig.goal || 10}</strong> carimbos para o próximo prêmio!
                    </p>
                  </div>
                )}

                {/* Exibição de Pacotes de Créditos */}
                {schedulingConfig?.packagesActive && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest block">Meus Pacotes Ativos</h4>
                    
                    {searchResults.packages.length === 0 ? (
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                        <p className="text-xs text-gray-500 italic">Nenhum pacote de créditos ativo encontrado.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {searchResults.packages.map((pkg: any) => {
                          const percent = (pkg.usedSessions / pkg.totalSessions) * 100;
                          const remaining = pkg.totalSessions - pkg.usedSessions;
                          return (
                            <div key={pkg.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-xs font-black text-white uppercase tracking-wider">{pkg.serviceName}</h4>
                                  <p className="text-[10px] text-indigo-400 font-bold">Pacote de Crédito</p>
                                </div>
                                <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
                                  {remaining} sessões restantes
                                </span>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-gray-500 font-bold">
                                  <span>Utilizadas: {pkg.usedSessions}</span>
                                  <span>Total: {pkg.totalSessions}</span>
                                </div>
                              </div>

                              {pkg.sessionsHistory && pkg.sessionsHistory.length > 0 && (
                                <div className="space-y-1.5 pt-2.5 border-t border-white/5">
                                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Últimas visitas realizadas</p>
                                  <div className="max-h-20 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {pkg.sessionsHistory.slice(-3).reverse().map((h: any, i: number) => (
                                      <div key={i} className="flex justify-between items-center text-[10px] text-gray-400 bg-black/35 px-2.5 py-1.5 rounded-lg border border-white/5">
                                        <span>{h.date.split('-').reverse().join('/')} às {h.time}</span>
                                        <span className="text-gray-500 font-bold text-[9px] uppercase">Prof: {h.professional}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Se não houver nada ativo em nenhuma das duas abas */}
                {searchResults.packages.length === 0 && (!fidelityConfig?.active || searchResults.completedFidelityCount === 0) && (
                  <div className="text-center py-8 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                    <AlertTriangle className="w-10 h-10 text-amber-500/50 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Nenhum crédito localizado</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-[260px] mx-auto">
                        Não encontramos nenhum pacote de créditos ou histórico de fidelidade ativo para o telefone informado.
                      </p>
                    </div>
                  </div>
                )}

                {/* Atalho Rápido para Agendamento */}
                {showBooking && (
                  <button
                    onClick={() => {
                      setIsQueryModalOpen(false);
                      navigate(`/agendar/${orgId}`);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Ir para o Agendamento Online</span>
                  </button>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
