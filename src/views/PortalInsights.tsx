import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Search, 
  ThumbsUp, 
  Eye, 
  Share2, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Sparkles,
  Bookmark,
  Check,
  Copy,
  TrendingUp,
  ArrowRight,
  ChevronLeft,
  Play,
  Pause,
  Volume2
} from 'lucide-react';
import { BlogPost, ArticleBlock } from '../types';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, increment } from 'firebase/firestore';

interface PortalInsightsProps {
  setActiveTab: (tab: string) => void;
  orgId?: string;
  clientId?: string;
}

interface RichBlogPost extends Omit<BlogPost, 'content'> {
  blocks: ArticleBlock[];
}

export default function PortalInsights({ setActiveTab, orgId, clientId }: PortalInsightsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedPost, setSelectedPost] = useState<RichBlogPost | null>(null);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [posts, setPosts] = useState<RichBlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Player de Áudio
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Monitora mudança de artigo para pausar e resetar o player de áudio anterior
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
  }, [selectedPost?.id]);

  // Efeito para ajustar o playbackRate no elemento de áudio real
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Escutar artigos em tempo real do Firestore
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'blog_posts'),
      where('status', '==', 'published')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPosts: RichBlogPost[] = [];
      snapshot.forEach((doc) => {
        loadedPosts.push({
          id: doc.id,
          ...doc.data()
        } as RichBlogPost);
      });

      // Ordenar localmente por createdAt desc (Firebase Timestamp ou Date) para evitar erro de índice composto
      loadedPosts.sort((a, b) => {
        const dateA = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      });

      setPosts(loadedPosts);
      setLoading(false);

      // Sincronizar curtidas locais
      const savedLikes = localStorage.getItem('hub_portal_likes');
      const parsedLikes = savedLikes ? JSON.parse(savedLikes) : {};
      setLikedPosts(parsedLikes);
    }, (error) => {
      console.error('Erro ao carregar artigos do Firestore:', error);
      toast.error('Não foi possível carregar os artigos de dicas e insights.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Se redirecionado a partir de um card da Home, abre o post correspondente automaticamente
  useEffect(() => {
    if (posts.length > 0) {
      const targetPostId = localStorage.getItem('selected_insight_post_id');
      if (targetPostId) {
        const found = posts.find(p => p.id === targetPostId);
        if (found) {
          openPost(found);
        }
        localStorage.removeItem('selected_insight_post_id');
      }
    }
  }, [posts]);

  const handleLike = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const alreadyLiked = likedPosts[postId];
    const newLiked = { ...likedPosts, [postId]: !alreadyLiked };
    setLikedPosts(newLiked);
    localStorage.setItem('hub_portal_likes', JSON.stringify(newLiked));
    
    // Atualiza contagem local de forma otimista no estado local (atualizado em tempo real pelo listener)
    try {
      const docRef = doc(db, 'blog_posts', postId);
      await updateDoc(docRef, {
        likes: increment(alreadyLiked ? -1 : 1)
      });

      if (!alreadyLiked) {
        toast.success('Você curtiu este artigo! Obrigado pelo feedback.');
      }
    } catch (error) {
      console.error('Erro ao atualizar curtida no Firestore:', error);
      toast.error('Erro ao registrar curtida.');
    }
  };

  const handleShare = (post: RichBlogPost, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `Confira este artigo sensacional do Portal Hub: "${post.title}" - Dicas para escalar seu negócio!`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: shareText,
        url: shareUrl
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
        .then(() => toast.success('Link de compartilhamento copiado! Envie no WhatsApp de outros empreendedores.'))
        .catch(() => toast.error('Não foi possível copiar o link.'));
    }
  };

  const openPost = async (post: RichBlogPost) => {
    setSelectedPost(post);
    
    // Incrementa visualização apenas uma vez por sessão/máquina
    const savedViews = localStorage.getItem('hub_portal_views');
    const parsedViews = savedViews ? JSON.parse(savedViews) : {};
    
    if (!parsedViews[post.id]) {
      parsedViews[post.id] = true;
      localStorage.setItem('hub_portal_views', JSON.stringify(parsedViews));
      
      try {
        const docRef = doc(db, 'blog_posts', post.id);
        await updateDoc(docRef, {
          views: increment(1)
        });
      } catch (error) {
        console.error('Erro ao incrementar visualização no Firestore:', error);
      }
    }
  };

  // Filtragem e Busca dos Artigos
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPost = posts.find(p => p.featured) || posts[0];
  const categories = ['Todos', 'Vendas', 'Finanças', 'Marketing', 'Gestão', 'Geral'];

  const getCategoryClass = (cat: string) => {
    switch (cat) {
      case 'Vendas': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'Finanças': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Marketing': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'Gestão': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <AnimatePresence mode="wait">
        {!selectedPost ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Filtros e Barra de Busca */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-3xl backdrop-blur-md">
              {/* Categorias */}
              <div className="flex gap-2 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
                {categories.map(cat => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                        isActive 
                          ? 'bg-[#f97316] text-white shadow-lg shadow-primary-500/20' 
                          : 'bg-white/5 border border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              
              {/* Busca */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Pesquisar artigos ou guias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-2xl text-xs font-medium text-white outline-none placeholder:text-gray-500 transition-all"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">Sincronizando insights...</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-16 text-center">
                <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" strokeWidth={1} />
                <h4 className="text-white font-bold mb-2">Nenhum Insights Encontrado</h4>
                <p className="text-gray-500 text-xs max-w-sm mx-auto leading-relaxed">
                  Não encontramos artigos correspondentes aos critérios de busca ou filtros selecionados. Tente ajustar o texto pesquisado.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Artigo em Destaque (Apenas quando não há filtro de busca ativo ou categoria selecionada) */}
                {searchTerm === '' && selectedCategory === 'Todos' && featuredPost && (
                  <div 
                    onClick={() => openPost(featuredPost)}
                    className="relative bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden group cursor-pointer flex flex-col lg:flex-row premium-card-hover shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
                  >
                    {/* Imagem de Capa do Destaque */}
                    <div className="w-full lg:w-[45%] aspect-video lg:aspect-auto min-h-[250px] relative overflow-hidden bg-black/30">
                      <img 
                        src={featuredPost.imageUrl} 
                        alt={featuredPost.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/85 via-black/20 to-transparent" />
                      
                      {/* Selo Destaque */}
                      <div className="absolute top-6 left-6 flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">
                        <Sparkles size={10} className="animate-pulse" />
                        Destaque
                      </div>
                    </div>

                    {/* Conteúdo do Destaque */}
                    <div className="flex-1 p-8 lg:p-10 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest ${getCategoryClass(featuredPost.category)}`}>
                            {featuredPost.category}
                          </span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Clock size={12} /> {featuredPost.readTime}
                          </span>
                        </div>
                        
                        <h4 className="text-xl lg:text-2xl font-extrabold text-white group-hover:text-primary-400 transition-colors leading-snug text-left">
                          {featuredPost.title}
                        </h4>
                        
                        <p className="text-gray-400 text-xs md:text-sm leading-relaxed line-clamp-3 text-left">
                          {featuredPost.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
                        <div className="flex items-center gap-3">
                          <img 
                            src={featuredPost.author.avatarUrl} 
                            alt={featuredPost.author.name} 
                            className="w-8 h-8 rounded-full border border-white/10"
                          />
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-bold text-white leading-none">{featuredPost.author.name}</span>
                            <span className="text-[9px] text-gray-500 mt-0.5 leading-none">{featuredPost.author.role}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-primary-400 text-xs font-black uppercase tracking-wider group-hover:gap-2 transition-all">
                          Ler Insights
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid de Artigos */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPosts.map(post => {
                    const isFeatured = featuredPost && post.id === featuredPost.id && searchTerm === '' && selectedCategory === 'Todos';
                    if (isFeatured) return null; // Não duplica o destaque no grid
                    
                    const isLiked = likedPosts[post.id];
                    return (
                      <div 
                        key={post.id}
                        onClick={() => openPost(post)}
                        className="bg-white/[0.02] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col justify-between shadow-xl group cursor-pointer premium-card-hover"
                      >
                        <div>
                          {/* Imagem de Capa do Card */}
                          <div className="w-full aspect-video relative overflow-hidden bg-black/20">
                            <img 
                              src={post.imageUrl} 
                              alt={post.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <span className={`absolute top-4 left-4 px-2.5 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest ${getCategoryClass(post.category)}`}>
                              {post.category}
                            </span>
                          </div>

                          {/* Conteúdo do Card */}
                          <div className="p-6 space-y-3">
                            <div className="text-[10px] text-gray-500 flex items-center gap-3">
                              <span className="flex items-center gap-1"><Calendar size={12} /> {post.publishedAt}</span>
                              <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                            </div>
                            
                            <h4 className="font-bold text-white text-base leading-snug group-hover:text-primary-400 transition-colors line-clamp-2 text-left">
                              {post.title}
                            </h4>
                            
                            <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 text-left">
                              {post.excerpt}
                            </p>
                          </div>
                        </div>

                        {/* Roda-pé do Card */}
                        <div className="p-6 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img 
                              src={post.author.avatarUrl} 
                              alt={post.author.name} 
                              className="w-6 h-6 rounded-full border border-white/10"
                            />
                            <span className="text-[10px] font-bold text-gray-400 truncate max-w-[100px]">{post.author.name}</span>
                          </div>

                          <div className="flex items-center gap-3 text-gray-500">
                            <button 
                              onClick={(e) => handleLike(post.id, e)}
                              className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px] font-semibold ${isLiked ? 'text-primary-400' : ''}`}
                            >
                              <ThumbsUp size={12} className={isLiked ? 'fill-current' : ''} />
                              {post.likes || 0}
                            </button>
                            <button 
                              onClick={(e) => handleShare(post, e)}
                              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px] font-semibold"
                            >
                              <Share2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="reader"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="max-w-3xl mx-auto bg-[#0a0c10]/40 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative"
          >
            {/* Imagem de Capa do Leitor */}
            <div className="w-full aspect-[21/9] md:aspect-[2.4/1] relative overflow-hidden bg-black/40">
              <img 
                src={selectedPost.imageUrl} 
                alt={selectedPost.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
              
              {/* Botão de Voltar sobreposto à imagem */}
              <button 
                onClick={() => setSelectedPost(null)}
                className="absolute top-6 left-6 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-lg z-20"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="absolute bottom-6 left-6 md:left-8 right-6 flex items-center justify-between z-10">
                <span className={`px-2.5 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest ${getCategoryClass(selectedPost.category)}`}>
                  {selectedPost.category}
                </span>
                <div className="flex gap-4">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={12} /> {selectedPost.readTime}</span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><Eye size={12} /> {selectedPost.views || 0} visualizações</span>
                </div>
              </div>
            </div>

            {/* Conteúdo do Leitor */}
            <div className="p-6 md:p-10 space-y-8">
              {/* Cabeçalho */}
              <div className="space-y-4">
                <h3 className="text-xl md:text-3xl font-extrabold text-white leading-snug text-left">
                  {selectedPost.title}
                </h3>

                <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                  <img 
                    src={selectedPost.author.avatarUrl} 
                    alt={selectedPost.author.name} 
                    className="w-9 h-9 rounded-full border border-white/10"
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white leading-none">{selectedPost.author.name}</span>
                    <span className="text-[9px] text-gray-500 mt-0.5 leading-none">{selectedPost.author.role}</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono ml-auto">Publicado em: {selectedPost.publishedAt}</span>
                </div>
              </div>

              {/* Player de Áudio Premium / Mini Podcast */}
              {selectedPost.audioUrl && (
                <div className="bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-white/[0.02] border border-white/10 p-5 rounded-[2rem] flex flex-col gap-4 shadow-xl animate-in fade-in duration-300">
                  <audio
                    ref={audioRef}
                    src={selectedPost.audioUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={() => {
                      setIsPlaying(false);
                      setCurrentTime(0);
                    }}
                  />
                  
                  {/* Info & Velocidade */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-xl">
                        <Volume2 size={16} className={isPlaying ? "animate-bounce" : ""} />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] text-[#f97316] font-black uppercase tracking-widest block">Áudio-Resumo / Podcast</span>
                        <span className="text-xs text-gray-300 font-bold mt-0.5 block">Ouça a versão em áudio deste artigo</span>
                      </div>
                    </div>
                    
                    {/* Velocidade */}
                    <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-xl">
                      {[1, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => setPlaybackRate(rate)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                            playbackRate === rate
                              ? 'bg-[#f97316] text-white shadow-md'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {rate.toFixed(1)}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Controles do Player */}
                  <div className="flex items-center gap-4 bg-black/30 border border-white/5 p-3 rounded-2xl">
                    <button
                      onClick={() => {
                        if (audioRef.current) {
                          if (isPlaying) {
                            audioRef.current.pause();
                          } else {
                            audioRef.current.play().catch(console.error);
                          }
                        }
                      }}
                      className="p-3 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-primary-500/25 shrink-0"
                    >
                      {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                    </button>

                    {/* Barra de Progresso */}
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-[10px] font-mono text-gray-400 w-8 text-right shrink-0">{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleProgressChange}
                        className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500 focus:outline-none"
                        style={{
                          background: `linear-gradient(to right, #f97316 0%, #f97316 ${(currentTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.1) ${(currentTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                        }}
                      />
                      <span className="text-[10px] font-mono text-gray-400 w-8 shrink-0">{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Corpo do Artigo Renderizado por Blocos */}
              <div className="space-y-6 text-gray-300 text-sm md:text-base leading-relaxed text-left">
                {selectedPost.blocks && selectedPost.blocks.map((block, idx) => {
                  switch (block.type) {
                    case 'paragraph':
                      return (
                        <p key={idx} className="font-normal text-gray-300">
                          {block.text}
                        </p>
                      );
                    case 'heading':
                      return (
                        <h4 key={idx} className="text-lg md:text-xl font-bold text-white pt-4 pb-1">
                          {block.text}
                        </h4>
                      );
                    case 'quote':
                      return (
                        <div key={idx} className="pl-5 border-l-3 border-[#f97316] my-6 bg-primary-500/5 py-4 pr-4 rounded-r-2xl">
                          <p className="text-xs md:text-sm font-medium italic text-gray-200 leading-relaxed">
                            "{block.text}"
                          </p>
                        </div>
                      );
                    case 'cta':
                      return (
                        <div key={idx} className="relative bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border border-primary-500/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 my-6">
                          <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary-500/15 text-primary-400 rounded-lg shrink-0">
                              <TrendingUp size={16} />
                            </div>
                            <div>
                              <span className="text-[9px] text-primary-400 font-black uppercase tracking-widest block">Dica de Crescimento</span>
                              <span className="text-xs text-gray-300 font-medium mt-0.5 block">Esta funcionalidade está disponível no seu Portal Hub.</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (block.ctaAction) {
                                setActiveTab(block.ctaAction);
                                setSelectedPost(null);
                                toast.info(`Redirecionando você para a seção...`);
                              }
                            }}
                            className="px-4 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-primary-500/15 w-full md:w-auto justify-center"
                          >
                            {block.ctaText}
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      );
                    default:
                      return null;
                  }
                })}
              </div>

              {/* Rodapé de Ações do Artigo */}
              <div className="border-t border-white/5 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={() => setSelectedPost(null)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-bold rounded-xl transition-colors cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  Voltar para lista
                </button>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={(e) => handleLike(selectedPost.id, e)}
                    className={`flex-1 sm:flex-none px-6 py-2.5 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                      likedPosts[selectedPost.id]
                        ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <ThumbsUp size={14} className={likedPosts[selectedPost.id] ? 'fill-current' : ''} />
                    {likedPosts[selectedPost.id] ? 'Curtido!' : 'Curtir Artigo'} ({selectedPost.likes || 0})
                  </button>

                  <button
                    onClick={(e) => handleShare(selectedPost, e)}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-white text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md"
                  >
                    <Share2 size={14} />
                    Compartilhar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
