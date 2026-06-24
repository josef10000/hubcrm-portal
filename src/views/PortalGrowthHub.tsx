import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, 
  Palette, 
  Layout, 
  FileText, 
  Video, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Layers,
  ArrowUpRight,
  ChevronDown,
  Play,
  X,
  BookOpen
} from 'lucide-react';
import { Client, GrowthAsset } from '../types';
import { toast } from 'sonner';
import PortalInsights from './PortalInsights';

type TabId = 'brand' | 'insights' | 'templates' | 'sales' | 'trainings';

interface PortalGrowthHubProps {
  client: Client | null;
  growthAssets: GrowthAsset[];
  activeSubTab: TabId;
  setActiveSubTab: (tab: TabId) => void;
  setActiveTab: (tab: string) => void;
}

export default function PortalGrowthHub({ 
  client, 
  growthAssets, 
  activeSubTab, 
  setActiveSubTab,
  setActiveTab
}: PortalGrowthHubProps) {
  const [copiedColorIndex, setCopiedColorIndex] = useState<number | null>(null);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const brandAssets = client?.brandAssets || null;

  // Função auxiliar para classificar e estilizar links
  const getLinkTypeDetails = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('canva.com')) {
      return {
        badge: 'Canva Template',
        badgeClass: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        buttonText: 'Abrir no Canva',
        buttonClass: 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/20',
        description: 'Link direto do editor do Canva para criar novos materiais com base na identidade visual oficial.'
      };
    }
    if (lowerUrl.includes('trello.com')) {
      return {
        badge: 'Painel do Trello',
        badgeClass: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
        buttonText: 'Abrir no Trello',
        buttonClass: 'bg-sky-600 hover:bg-sky-700 shadow-sky-900/20',
        description: 'Quadro do Trello para gerenciar tarefas, cronograma de postagens ou fluxos de trabalho da marca.'
      };
    }
    if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) {
      return {
        badge: 'Google Drive',
        badgeClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        buttonText: 'Abrir no Drive',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20',
        description: 'Pasta compartilhada no Google Drive contendo arquivos, fotos, vídeos ou documentos da marca.'
      };
    }
    return {
      badge: 'Link Útil',
      badgeClass: 'bg-primary-500/10 border-primary-500/20 text-primary-400',
      buttonText: 'Acessar Link',
      buttonClass: 'bg-white hover:bg-gray-100 text-black shadow-md',
      description: 'Link útil ou template personalizado configurado para acesso rápido à sua marca.'
    };
  };

  // Filtragem dos assets por tipo
  const templateAssets = growthAssets.filter(asset => asset.type === 'template');
  const scriptAssets = growthAssets.filter(asset => asset.type === 'script');
  const videoAssets = growthAssets.filter(asset => asset.type === 'video');

  // Função auxiliar para copiar texto
  const handleCopyText = async (text: string, id: string, isColor = false, colorIndex?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isColor && typeof colorIndex === 'number') {
        setCopiedColorIndex(colorIndex);
        setTimeout(() => setCopiedColorIndex(null), 2000);
        toast.success(`Cor ${text} copiada para a área de transferência!`);
      } else {
        setCopiedScriptId(id);
        setTimeout(() => setCopiedScriptId(null), 2000);
        toast.success('Roteiro copiado com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao copiar:', err);
      toast.error('Não foi possível copiar o texto.');
    }
  };

  // Identifica se o vídeo é do YouTube e obtém o ID do embed
  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return null;
  };

  const getYouTubeId = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
    return null;
  };

  const getYouTubeThumbnail = (url?: string) => {
    const id = getYouTubeId(url);
    if (id) {
      return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    return null;
  };

  const tabs = [
    { id: 'brand', label: 'Cofre da Marca', icon: Palette },
    { id: 'insights', label: 'Dicas & Insights', icon: BookOpen },
    { id: 'templates', label: 'Templates Rápidos', icon: Layout },
    { id: 'sales', label: 'Arsenal de Vendas', icon: FileText },
    { id: 'trainings', label: 'Treinamentos', icon: Video },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-xl">
              <Rocket className="text-primary-400 w-6 h-6" />
            </div>
            Hub de Crescimento
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            Seu cofre de identidade de marca, materiais de vendas e treinamentos de alta conversão.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] font-black uppercase text-primary-400 tracking-widest">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          Foco em Escalar
        </div>
      </div>

      {/* Pills de Navegação Horizontal (Desktop & Mobile) */}
      <div 
        className="flex overflow-x-auto gap-2 pb-2 w-full no-scrollbar scroll-smooth"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full border flex items-center gap-2 transition-all duration-300 relative whitespace-nowrap outline-none shrink-0 cursor-pointer active:scale-95 z-10
                ${isActive 
                  ? 'text-white border-primary-500/30' 
                  : 'border-white/5 text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10'}
              `}
            >
              <Icon size={14} className={isActive ? 'text-primary-400' : 'text-gray-500'} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="activeGrowthTabIndicator" 
                  className="absolute inset-0 bg-primary-500/10 border border-primary-500/20 rounded-full -z-10" 
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Sub-Abas */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeSubTab === 'brand' && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {!brandAssets ? (
                <div className="relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-12 text-center overflow-hidden">
                  {/* Brilho Radial de Fundo */}
                  <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0%,transparent_60%)]" />
                  <Palette className="relative z-10 w-12 h-12 text-primary-400/80 mx-auto mb-4 animate-pulse" strokeWidth={1} />
                  <h4 className="relative z-10 text-white font-bold mb-2">Cofre da Marca Vazio</h4>
                  <p className="relative z-10 text-gray-500 text-xs max-w-sm mx-auto leading-relaxed">
                    Seus ativos visuais institucionais (logotipos, cores e fontes) ainda não foram configurados. Solicite a integração ao seu consultor para ter acesso rápido aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Logos Section */}
                  <div className="md:col-span-1 space-y-6">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Logotipos Oficiais</span>
                    
                    {brandAssets.logos && brandAssets.logos.length > 0 ? (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {brandAssets.logos.map((logo, idx) => (
                          <div 
                            key={idx} 
                            className="bg-white/[0.03] border border-white/10 p-5 rounded-[2rem] flex flex-col items-center justify-between text-center relative overflow-hidden group gap-4 premium-card-hover"
                          >
                            <div className="w-full">
                              <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest block text-left mb-3">
                                {logo.name}
                              </span>
                              <div className="w-full h-32 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center p-4 overflow-hidden relative group">
                                <img 
                                  src={logo.url} 
                                  alt={logo.name} 
                                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                />
                              </div>
                            </div>
                            <a 
                              href={logo.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="w-full py-2.5 bg-white hover:bg-gray-100 text-black font-black rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95"
                            >
                              <Download size={12} />
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : brandAssets.logoUrl ? (
                      <div className="bg-white/[0.03] border border-white/10 p-6 rounded-[2rem] flex flex-col items-center justify-between text-center relative overflow-hidden group gap-4 premium-card-hover">
                        <div className="w-full">
                          <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest block text-left mb-3">Logotipo Padrão</span>
                          <div className="w-full aspect-square bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center p-6 overflow-hidden relative group">
                            <img 
                              src={brandAssets.logoUrl} 
                              alt="Logo oficial" 
                              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        </div>
                        <a 
                          href={brandAssets.logoUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="w-full py-4 bg-white hover:bg-gray-100 text-black font-black rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      </div>
                    ) : (
                      <div className="bg-white/[0.03] border border-white/10 p-6 rounded-[2rem] text-center text-gray-500 text-xs italic">
                        Nenhum logotipo cadastrado
                      </div>
                    )}
                  </div>

                  {/* Colors & Typography Cards */}
                  <div className="md:col-span-2 space-y-6">
                    {/* Cores Card */}
                    <div className="bg-white/[0.03] border border-white/10 p-6 md:p-8 rounded-[2rem]">
                      <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Layers size={16} className="text-primary-400" />
                        Paleta de Cores Oficial
                      </h4>
                      
                      {!brandAssets.colors || brandAssets.colors.length === 0 ? (
                        <p className="text-gray-500 text-xs italic">Nenhuma cor configurada na paleta.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {brandAssets.colors.map((color, index) => {
                            const isCopied = copiedColorIndex === index;
                            return (
                              <div 
                                key={index}
                                className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-between text-center gap-4 group"
                              >
                                <div 
                                  className="w-16 h-16 rounded-full border border-white/10 shadow-lg"
                                  style={{ backgroundColor: color }}
                                />
                                <div className="w-full">
                                  <span className="text-[10px] text-gray-500 font-mono block mb-2">{color.toUpperCase()}</span>
                                  <button
                                    onClick={() => handleCopyText(color, `color_${index}`, true, index)}
                                    className={`
                                      w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95
                                      ${isCopied 
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'}
                                    `}
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check size={10} />
                                        Copiado!
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={10} />
                                        Copiar HEX
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Tipografia Card */}
                    <div className="bg-white/[0.03] border border-white/10 p-6 md:p-8 rounded-[2rem]">
                      <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText size={16} className="text-primary-400" />
                        Tipografia da Marca
                      </h4>
                      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                        Fontes e tipografias oficiais da sua marca recomendadas para manter a consistência de design nos criativos.
                      </p>

                      <div className="bg-black/30 border border-white/5 p-6 rounded-2xl">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Família Tipográfica</span>
                            <span className="text-white font-bold text-base mt-0.5 block">{brandAssets.typography || 'Inter, sans-serif'}</span>
                          </div>
                        </div>
                        <div className="border-t border-white/5 pt-4 mt-4 space-y-2">
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">Visualização de Amostra</span>
                          <p 
                            className="text-white text-lg font-medium leading-normal tracking-wide"
                            style={{ fontFamily: brandAssets.typography || 'inherit' }}
                          >
                            O Hub de Crescimento ajuda a escalar as vendas do seu negócio.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeSubTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <PortalInsights 
                setActiveTab={setActiveTab} 
                orgId={client?.id}
                clientId={client?.id}
              />
            </motion.div>
          )}

          {activeSubTab === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {(!brandAssets?.customCanvaLinks || brandAssets.customCanvaLinks.length === 0) && templateAssets.length === 0 ? (
                <div className="relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-12 text-center overflow-hidden">
                  {/* Brilho Radial de Fundo */}
                  <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0%,transparent_60%)]" />
                  <Layout className="relative z-10 w-12 h-12 text-primary-400/80 mx-auto mb-4 animate-pulse" strokeWidth={1} />
                  <h4 className="relative z-10 text-white font-bold mb-2">Nenhum Template Encontrado</h4>
                  <p className="relative z-10 text-gray-500 text-xs max-w-sm mx-auto leading-relaxed">
                    Você ainda não possui modelos rápidos ou links do Canva recomendados configurados. Fale com seu suporte técnico.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Canva / Trello / Google Drive / Custom Links */}
                  {brandAssets?.customCanvaLinks?.map((link, index) => {
                    const details = getLinkTypeDetails(link.url);
                    return (
                      <div 
                        key={`custom_link_${index}`}
                        className="bg-white/[0.03] border border-white/10 p-6 rounded-[2rem] flex flex-col justify-between shadow-xl group premium-card-hover"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className={`px-2.5 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest ${details.badgeClass}`}>
                              {details.badge}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-base mb-2 group-hover:text-primary-400 transition-colors line-clamp-1">{link.title}</h4>
                          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                            {details.description}
                          </p>
                        </div>

                        <a 
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-6 py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95 shadow-lg ${details.buttonClass} ${details.buttonText === 'Acessar Link' ? 'text-black' : 'text-white'}`}
                        >
                          {details.buttonText}
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    );
                  })}

                  {/* Outros Templates */}
                  {templateAssets.map((asset) => (
                    <div 
                      key={asset.id}
                      className="bg-white/[0.03] border border-white/10 p-6 rounded-[2rem] flex flex-col justify-between shadow-xl group premium-card-hover"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[9px] font-black text-blue-400 uppercase tracking-widest">
                            {asset.category || 'Modelo / Template'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-base mb-2 group-hover:text-primary-400 transition-colors line-clamp-1">{asset.title}</h4>
                        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                          {asset.content || 'Arquivo de modelo para download de identidade visual ou estrutura pré-definida.'}
                        </p>
                      </div>

                      {asset.url && (
                        <a 
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-6 py-3.5 bg-white hover:bg-gray-100 text-black font-black rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95 shadow-md"
                        >
                          Acessar Template
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeSubTab === 'sales' && (
            <motion.div
              key="sales"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {scriptAssets.length === 0 ? (
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" strokeWidth={1} />
                  <h4 className="text-white font-bold mb-2">Arsenal de Vendas Vazio</h4>
                  <p className="text-gray-500 text-xs max-w-sm mx-auto leading-relaxed">
                    Nenhum roteiro comercial ou script de vendas cadastrado até o momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {scriptAssets.map((asset) => {
                    const isCopied = copiedScriptId === asset.id;
                    return (
                      <div 
                        key={asset.id}
                        className="bg-white/[0.03] border border-white/10 p-6 md:p-8 rounded-[2rem] flex flex-col justify-between gap-6"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-widest mb-3 inline-block">
                              {asset.category || 'Roteiro de Vendas'}
                            </span>
                            <h4 className="font-bold text-white text-lg">{asset.title}</h4>
                          </div>

                          <button
                            onClick={() => handleCopyText(asset.content || '', asset.id)}
                            className={`
                              px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap
                              ${isCopied 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-white hover:bg-gray-100 text-black'}
                            `}
                          >
                            {isCopied ? (
                              <>
                                <Check size={14} />
                                Roteiro Copiado!
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                Copiar Texto
                              </>
                            )}
                          </button>
                        </div>

                        <div className="bg-black/40 border border-white/5 rounded-2xl p-5 md:p-6 max-h-[300px] overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                          {asset.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeSubTab === 'trainings' && (
            <motion.div
              key="trainings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {videoAssets.length === 0 ? (
                <div className="relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-12 text-center overflow-hidden">
                  {/* Brilho Radial de Fundo */}
                  <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0%,transparent_60%)]" />
                  <Video className="relative z-10 w-12 h-12 text-primary-400/80 mx-auto mb-4 animate-pulse" strokeWidth={1} />
                  <h4 className="relative z-10 text-white font-bold mb-2">Nenhum Treinamento Disponível</h4>
                  <p className="relative z-10 text-gray-500 text-xs max-w-sm mx-auto leading-relaxed">
                    Nenhuma videoaula ou material complementar em vídeo disponível atualmente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {videoAssets.map((asset) => {
                    const youtubeId = asset.url ? getYouTubeId(asset.url) : null;
                    const thumbnailUrl = youtubeId ? getYouTubeThumbnail(asset.url) : null;
                    return (
                      <div 
                        key={asset.id}
                        className="bg-white/[0.03] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col justify-between shadow-2xl relative group premium-card-hover"
                      >
                        {/* Player / Preview */}
                        <div className="w-full aspect-video bg-black relative overflow-hidden">
                          {youtubeId ? (
                            <div 
                              onClick={() => setActiveVideoId(youtubeId)}
                              className="w-full h-full relative cursor-pointer group/thumb"
                            >
                              {/* Imagem de Capa do YouTube */}
                              <img 
                                src={thumbnailUrl || ''} 
                                alt={asset.title} 
                                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                              />
                              {/* Overlay de Degradê Escuro */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20 group-hover/thumb:from-black/90 transition-all" />
                              
                              {/* Botão Play Centralizado */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="p-4 bg-primary-500 text-white rounded-full shadow-lg shadow-primary-500/30 transform group-hover/thumb:scale-110 group-hover/thumb:bg-primary-600 transition-all duration-300">
                                  <Play size={24} fill="currentColor" className="ml-0.5" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4 bg-gradient-to-br from-black/60 to-black/20">
                              <Video size={40} className="text-gray-600" />
                              <span className="text-gray-400 text-xs font-medium max-w-xs leading-relaxed">
                                Este treinamento está disponível em uma plataforma externa.
                              </span>
                              {asset.url && (
                                <a 
                                  href={asset.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-primary-500/10"
                                >
                                  Acessar Vídeo Externo
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Detalhes do Vídeo */}
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              {asset.category || 'Treinamento Estratégico'}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-base leading-snug line-clamp-1">{asset.title}</h4>
                          <p className="text-gray-500 text-xs mt-2 leading-relaxed line-clamp-2">
                            {asset.content || 'Aprenda estratégias valiosas criadas para impulsionar suas conversões e elevar o nível das suas operações comerciais.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal / Lightbox do Vídeo do YouTube */}
      <AnimatePresence>
        {activeVideoId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          >
            {/* Overlay invisível para fechar ao clicar fora do player */}
            <div 
              className="absolute inset-0 cursor-default" 
              onClick={() => setActiveVideoId(null)}
            />
            
            <div className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
              {/* Botão de Fechar */}
              <button
                onClick={() => setActiveVideoId(null)}
                className="absolute top-4 right-4 z-20 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
              
              <iframe
                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
                title="Treinamento"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
