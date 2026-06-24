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
  ChevronLeft
} from 'lucide-react';
import { BlogPost } from '../types';
import { toast } from 'sonner';

interface PortalInsightsProps {
  setActiveTab: (tab: string) => void;
  // Preparado para receber orgId ou props do Firestore futuramente
  orgId?: string;
  clientId?: string;
}

// Interface estendida para suportar blocos ricos no conteúdo dos artigos
interface ArticleBlock {
  type: 'paragraph' | 'heading' | 'list' | 'quote' | 'cta';
  text?: string;
  items?: string[];
  ctaText?: string;
  ctaAction?: string; // Para redirecionar para abas do portal
}

interface RichBlogPost extends Omit<BlogPost, 'content'> {
  blocks: ArticleBlock[];
}

export default function PortalInsights({ setActiveTab, orgId, clientId }: PortalInsightsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedPost, setSelectedPost] = useState<RichBlogPost | null>(null);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false); // Simulação de busca do Firestore

  // Artigos ricos iniciais (MOCK - Opção 1 aprovada pelo usuário)
  const insightsData: RichBlogPost[] = [
    {
      id: 'reduzir-faltas-no-shows',
      title: '5 Estratégias Práticas para Reduzir Faltas e No-Shows de Clientes na sua Agenda',
      excerpt: 'Faltas e cancelamentos de última hora são os maiores vilões do faturamento de profissionais de serviços. Aprenda a blindar sua agenda usando confirmação ativa e sinal Pix.',
      category: 'Vendas',
      imageUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=600&auto=format&fit=crop',
      publishedAt: '24 Jun 2026',
      readTime: '4 min',
      author: {
        name: 'Equipe Hub Symples',
        role: 'Consultoria de Crescimento',
        avatarUrl: 'https://i.imgur.com/zCvL7xy.png'
      },
      blocks: [
        {
          type: 'paragraph',
          text: 'Se você trabalha com agendamentos, conhece bem essa dor: o horário está reservado, você organizou seus materiais, reservou sua equipe, mas o cliente simplesmente não aparece e nem avisa. Esse horário perdido representa um prejuízo direto no seu caixa, pois o tempo é um insumo que você não pode estocar.'
        },
        {
          type: 'paragraph',
          text: 'Felizmente, no-shows não são uma fatalidade incontrolável. Existem técnicas comportamentais e financeiras que reduzem a taxa de faltas de mais de 25% para menos de 3%. Abaixo, estruturamos as 5 estratégias mais eficientes aplicáveis hoje mesmo no seu negócio.'
        },
        {
          type: 'heading',
          text: '1. O Poder do Compromisso Financeiro (Sinal Pix Obrigatório)'
        },
        {
          type: 'paragraph',
          text: 'A psicologia humana funciona por aversão à perda. Quando o agendamento é 100% gratuito e sem garantias, o cliente sente que não tem nada a perder se faltar. Ao cobrar um pequeno sinal de reserva (por exemplo, 20% do valor do serviço ou um valor fixo de R$ 20), você cria um gatilho de comprometimento.'
        },
        {
          type: 'paragraph',
          text: 'No Portal Hub, você pode habilitar o Sinal Pix Obrigatório. Assim, quando um cliente tenta agendar pelo seu link público, o slot de horário só é confirmado após a detecção do pagamento via Pix copia-e-cola gerado na hora.'
        },
        {
          type: 'cta',
          ctaText: 'Configurar Sinal Pix Obrigatório na Agenda',
          ctaAction: 'agenda_settings'
        },
        {
          type: 'heading',
          text: '2. Confirmação Ativa via WhatsApp'
        },
        {
          type: 'paragraph',
          text: 'Muitas vezes a falta ocorre por simples esquecimento. Enviar lembretes prévios é obrigatório, mas a forma de enviar faz a diferença. Mensagens informativas ("Seu agendamento é amanhã") são ignoradas. Prefira mensagens de confirmação ativa com tags dinâmicas que exigem resposta, contendo o link de confirmação do Portal Hub.'
        },
        {
          type: 'quote',
          text: 'O tempo de um profissional de serviços é o seu produto mais valioso. Quando um cliente falta sem avisar, você perde um estoque de tempo que nunca mais poderá ser recuperado.'
        },
        {
          type: 'heading',
          text: '3. Facilite o Reagendamento Autônomo'
        },
        {
          type: 'paragraph',
          text: 'Se o cliente percebe que não vai conseguir comparecer, ele muitas vezes tem vergonha de ligar ou mandar mensagem para cancelar, optando pelo no-show silencioso. A solução é dar a ele uma saída fácil.'
        },
        {
          type: 'paragraph',
          text: 'O link de confirmação de presença do Portal Hub oferece uma rota pública onde o cliente, além de confirmar presencialmente, pode clicar em "Solicitar Reagendamento". Ele escolhe outra data no seu calendário online sem precisar falar com ninguém, liberando a vaga antiga para outro interessado.'
        },
        {
          type: 'heading',
          text: '4. Estabeleça uma Política de Cancelamento Clara'
        },
        {
          type: 'paragraph',
          text: 'Crie uma regra formal de cancelamento (ex: tolerância de 15 minutos e prazo de 12 horas de antecedência para remarcações sem perda do sinal). Deixe essa política visível na bio do seu agendamento e nas mensagens automáticas. A clareza gera respeito profissional.'
        },
        {
          type: 'heading',
          text: '5. Crie um Histórico de Fidelidade e Faltas'
        },
        {
          type: 'paragraph',
          text: 'Acompanhe a recorrência dos clientes. Na sua Timeline Diária no Portal Hub, o sistema exibe badges de progresso de fidelidade. Clientes frequentes que valorizam seu tempo merecem prioridade, enquanto faltadores reincidentes devem ser bloqueados para reservas públicas automáticas, exigindo agendamento manual ou sinal completo (100% do valor) antecipadamente.'
        }
      ]
    },
    {
      id: 'precificacao-inteligente-lucro',
      title: 'Como Precificar seus Serviços de Forma Inteligente e Calcular seu Lucro Líquido Real',
      excerpt: 'Muitos empreendedores definem preços olhando apenas para a concorrência e acabam pagando para trabalhar. Aprenda a calcular sua hora com base nos custos fixos e variáveis.',
      category: 'Finanças',
      imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600&auto=format&fit=crop',
      publishedAt: '20 Jun 2026',
      readTime: '5 min',
      author: {
        name: 'Equipe Hub Symples',
        role: 'Consultoria Financeira',
        avatarUrl: 'https://i.imgur.com/zCvL7xy.png'
      },
      blocks: [
        {
          type: 'paragraph',
          text: 'Definir o preço de um serviço é um dos maiores desafios de um empreendedor. Se cobrar caro demais, perde clientes; se cobrar barato demais, trabalha sem parar e não vê a cor do dinheiro. O erro comum é copiar o preço do concorrente sem conhecer a própria realidade financeira.'
        },
        {
          type: 'paragraph',
          text: 'Cada negócio tem um custo de operação único. A sua precificação deve cobrir seus custos fixos, pagar seus custos variáveis (insumos), remunerar suas horas de trabalho e, acima de tudo, deixar lucro livre para o caixa da empresa crescer.'
        },
        {
          type: 'heading',
          text: 'Passo 1: Levante os Custos Fixos Mensais'
        },
        {
          type: 'paragraph',
          text: 'Custo fixo é tudo o que você paga para manter a porta aberta, mesmo se não atender nenhum cliente. Isso inclui aluguel, energia, água, internet, assinatura de sistemas (como o Portal Hub), taxas bancárias e o seu pró-labore (o salário do dono). Nunca misture despesas pessoais com despesas da empresa!'
        },
        {
          type: 'heading',
          text: 'Passo 2: Defina as Horas Produtivas Disponíveis'
        },
        {
          type: 'paragraph',
          text: 'Você não trabalha 24 horas por dia. Calcule quantas horas reais de atendimento você consegue realizar no mês. Por exemplo: 8 horas por dia, de segunda a sexta (20 dias), equivale a 160 horas por mês. Contudo, considere uma taxa de ocupação realista de 70% (112 horas de atendimento faturável), pois o restante do tempo é gasto com administrativo, limpeza e marketing.'
        },
        {
          type: 'quote',
          text: 'Faturamento é vaidade, lucro é sanidade. Não adianta ter a agenda lotada e fazer muito barulho se, no final do mês, o seu caixa termina no vermelho.'
        },
        {
          type: 'heading',
          text: 'Passo 3: Determine o Custo de Sua Hora de Trabalho'
        },
        {
          type: 'paragraph',
          text: 'Divida o valor total dos seus custos fixos pelas horas faturáveis disponíveis. Exemplo: se seus custos fixos somam R$ 4.500 e você atende 112 horas, o custo básico de sua hora operacional é R$ 40,17. Ou seja, cada hora que você passa atendendo custa R$ 40,17 à empresa apenas para empatar.'
        },
        {
          type: 'heading',
          text: 'Passo 4: Calcule os Custos Variáveis do Serviço'
        },
        {
          type: 'paragraph',
          text: 'Custos variáveis são os insumos consumidos em cada atendimento (produtos químicos, descartáveis, energia extra, taxas do cartão). Se você gasta R$ 15 em produtos para fazer um determinado atendimento, este é o seu custo variável.'
        },
        {
          type: 'cta',
          ctaText: 'Acessar Calculadora de Orçamentos do Portal',
          ctaAction: 'management'
        },
        {
          type: 'heading',
          text: 'Passo 5: Adicione a Margem de Lucro'
        },
        {
          type: 'paragraph',
          text: 'O lucro não é o seu salário (pró-labore), mas sim o valor que fica na conta da empresa para investimentos, reservas de emergência e distribuição de dividendos. Se você deseja uma margem de lucro líquido de 20%, deve aplicar o markup correto sobre o custo operacional somado ao variável.'
        },
        {
          type: 'paragraph',
          text: 'Para simplificar essa conta sem precisar ser um expert em matemática financeira, utilize o módulo "Meu Negócio" no Portal Hub, que conta com a Calculadora de Orçamentos Dinâmica e a Projeção de DRE de Caixa no CRM Financeiro para você acompanhar sua lucratividade em tempo real.'
        }
      ]
    },
    {
      id: 'fidelizacao-clientes-ltv',
      title: 'O Poder da Recorrência: Como Reativar Clientes Inativos e Gamificar com Cartão Fidelidade',
      excerpt: 'Conquistar um novo cliente custa até 7 vezes mais caro do que vender para quem já confia em você. Aprenda como criar um fluxo de reativação inteligente e usar fidelização recorrente.',
      category: 'Marketing',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop',
      publishedAt: '15 Jun 2026',
      readTime: '4 min',
      author: {
        name: 'Equipe Hub Symples',
        role: 'Consultoria de LTV',
        avatarUrl: 'https://i.imgur.com/zCvL7xy.png'
      },
      blocks: [
        {
          type: 'paragraph',
          text: 'A maioria dos negócios de serviços foca 90% de sua energia em atrair novos clientes através de anúncios ou redes sociais. Mas a verdade financeira é assustadora: reter e aumentar a frequência de compra dos clientes que você já possui é infinitamente mais barato e lucrativo.'
        },
        {
          type: 'paragraph',
          text: 'Se um cliente faz um serviço a cada 60 dias, e você consegue convencê-lo a vir a cada 30 dias com um Clube de Fidelidade, você dobra o faturamento gerado por esse cliente no ano sem gastar um centavo em marketing de atração. Isso é aumentar o LTV (Lifetime Value).'
        },
        {
          type: 'heading',
          text: '1. Diagnóstico de Clientes Inativos (Quem sumiu?)'
        },
        {
          type: 'paragraph',
          text: 'O primeiro passo é identificar os clientes inativos. Divida-os em faixas temporais: inativos há mais de 30 dias, 45 dias e 60 dias. No painel inicial do Portal Hub, a inteligência analisa seus agendamentos antigos e exibe uma lista automatizada de clientes em risco de evasão.'
        },
        {
          type: 'cta',
          ctaText: 'Ver Painel de Reativação na Dashboard',
          ctaAction: 'home'
        },
        {
          type: 'heading',
          text: '2. Abordagem Atenciosa e Script de Resgate'
        },
        {
          type: 'paragraph',
          text: 'Ao entrar em contato com um cliente sumido pelo WhatsApp, nunca pareça desesperado por vendas. Faça uma abordagem amigável, demonstre atenção e, opcionalmente, ofereça uma vantagem exclusiva para o retorno.'
        },
        {
          type: 'quote',
          text: 'O cliente que já comprou de você confia no seu trabalho. Muitas vezes, ele só precisa de um lembrete atencioso e personalizado no WhatsApp para voltar a agendar.'
        },
        {
          type: 'heading',
          text: '3. A Gamificação do Clube de Fidelidade Digital'
        },
        {
          type: 'paragraph',
          text: 'Substitua os antigos cartões de papel que os clientes sempre perdem por um Cartão Fidelidade Digital integrado. No Portal Hub, você parametriza o número de carimbos necessários (ex: 10 visitas) e define o prêmio (ex: R$ 30 de desconto ou um serviço complementar).'
        },
        {
          type: 'paragraph',
          text: 'Cada vez que o cliente realiza um atendimento registrado como "Concluído" no portal, o sistema adiciona automaticamente um carimbo digital ao cadastro dele. O cliente pode consultar o cartão fidelidade dele em tempo real na sua página de Bio Link digitando apenas o número de WhatsApp.'
        },
        {
          type: 'heading',
          text: '4. Pacotes de Crédito Recorrentes'
        },
        {
          type: 'paragraph',
          text: 'Outra ferramenta fantástica de LTV é o Pacote de Clientes. Vender pacotes (como "compre 10 sessões, pague 8") garante fluxo de caixa imediato para o seu negócio e trava o cliente com você no longo prazo. À medida que ele agenda online, os créditos são deduzidos automaticamente na conclusão do atendimento.'
        }
      ]
    }
  ];

  // Simulação de delay ao carregar (caráter preparatório para requisições dinâmicas à API no futuro)
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
      
      // Inicializar curtidas/visualizações de memória local
      const savedLikes = localStorage.getItem('hub_portal_likes');
      const savedViews = localStorage.getItem('hub_portal_views');
      
      const parsedLikes = savedLikes ? JSON.parse(savedLikes) : {};
      const parsedViews = savedViews ? JSON.parse(savedViews) : {};
      
      setLikedPosts(parsedLikes);
      
      // Mock inicial de visualizações/curtidas
      const initialLikes: Record<string, number> = {
        'reduzir-faltas-no-shows': 42,
        'precificacao-inteligente-lucro': 29,
        'fidelizacao-clientes-ltv': 35
      };
      
      const initialViews: Record<string, number> = {
        'reduzir-faltas-no-shows': 158,
        'precificacao-inteligente-lucro': 114,
        'fidelizacao-clientes-ltv': 137
      };
      
      // Soma os dados persistidos localmente
      Object.keys(initialLikes).forEach(id => {
        if (parsedLikes[id]) {
          initialLikes[id] += 1;
        }
      });
      
      Object.keys(initialViews).forEach(id => {
        if (parsedViews[id]) {
          initialViews[id] = Math.max(initialViews[id], parsedViews[id]);
        } else {
          parsedViews[id] = initialViews[id] + Math.floor(Math.random() * 5);
          initialViews[id] = parsedViews[id];
        }
      });
      
      localStorage.setItem('hub_portal_views', JSON.stringify(parsedViews));
      setLikeCounts(initialLikes);
      setViewCounts(initialViews);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const handleLike = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const alreadyLiked = likedPosts[postId];
    const newLiked = { ...likedPosts, [postId]: !alreadyLiked };
    setLikedPosts(newLiked);
    localStorage.setItem('hub_portal_likes', JSON.stringify(newLiked));
    
    setLikeCounts(prev => ({
      ...prev,
      [postId]: alreadyLiked ? (prev[postId] || 1) - 1 : (prev[postId] || 0) + 1
    }));

    if (!alreadyLiked) {
      toast.success('Você curtiu este artigo! Obrigado pelo feedback.');
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

  const openPost = (post: RichBlogPost) => {
    // Incrementa visualização local
    const currentViews = viewCounts[post.id] || 0;
    const newViews = currentViews + 1;
    setViewCounts(prev => ({ ...prev, [post.id]: newViews }));
    
    const savedViews = localStorage.getItem('hub_portal_views');
    const parsedViews = savedViews ? JSON.parse(savedViews) : {};
    parsedViews[post.id] = newViews;
    localStorage.setItem('hub_portal_views', JSON.stringify(parsedViews));

    setSelectedPost(post);
  };

  // Filtragem e Busca dos Artigos
  const filteredPosts = insightsData.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPost = insightsData[0];
  const categories = ['Todos', 'Vendas', 'Finanças', 'Marketing'];

  const getCategoryClass = (cat: string) => {
    switch (cat) {
      case 'Vendas': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'Finanças': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Marketing': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      default: return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
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
                        
                        <h4 className="text-xl lg:text-2xl font-extrabold text-white group-hover:text-primary-400 transition-colors leading-snug">
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
                    const isFeatured = post.id === featuredPost.id && searchTerm === '' && selectedCategory === 'Todos';
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
                              {likeCounts[post.id] || 0}
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
                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><Eye size={12} /> {viewCounts[selectedPost.id] || 0} visualizações</span>
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

              {/* Corpo do Artigo Renderizado por Blocos */}
              <div className="space-y-6 text-gray-300 text-sm md:text-base leading-relaxed text-left">
                {selectedPost.blocks.map((block, idx) => {
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
                                toast.info(`Redirecionando você para a seção de ${block.ctaText}...`);
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
                    {likedPosts[selectedPost.id] ? 'Curtido!' : 'Curtir Artigo'} ({likeCounts[selectedPost.id] || 0})
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
