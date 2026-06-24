import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LifeBuoy, 
  Plus, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  MessageSquare,
  X,
  Zap,
  Shield,
  HelpCircle,
  Lightbulb,
  DollarSign,
  Image as ImageIcon,
  Paperclip,
  Download,
  Search,
  ChevronDown,
  BookOpen,
  Package,
  QrCode
} from 'lucide-react';
import { usePortalSupport } from '../hooks/usePortalSupport';
import { useParams } from 'react-router-dom';
import { uploadToCloudinary } from '../lib/cloudinary';
import { toast } from 'sonner';
import { SupportTicket } from '../types';
import CustomSelect from '../components/CustomSelect';

interface PortalSupportProps {
  client: any;
  requests: SupportTicket[];
  onViewTicket: (ticketId: string) => void;
}

export default function PortalSupport({ client, requests, onViewTicket }: PortalSupportProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { loading, createRequest, addMessageToRequest } = usePortalSupport(orgId, client?.id);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const selectedTicket = requests.find(r => r.id === selectedTicketId) || null;

  // Estados para a Central de FAQ
  const [activeSection, setActiveSection] = useState<'faq' | 'tickets'>('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const handleRestartTour = () => {
    localStorage.removeItem('hub_onboarding_completed');
    toast.success('Reiniciando o guia interativo de boas-vindas...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const faqCategories = [
    { id: 'todos', label: 'Todos', icon: HelpCircle },
    { id: 'geral', label: 'Geral', icon: BookOpen },
    { id: 'agenda', label: 'Agenda', icon: Clock },
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'pix', label: 'Pix & QR Code', icon: QrCode }
  ];

  const faqData = [
    {
      id: 'g1',
      category: 'geral',
      question: 'Como funciona o Portal Hub?',
      answer: 'O Portal Hub é a sua central de gestão integrada. Aqui você acompanha o faturamento do seu negócio, gerencia agendamentos de clientes, controla os níveis de estoque e acessa o suporte técnico sempre que necessário. O dock flutuante na parte inferior (ou menu móvel) é o seu atalho principal para todas as funcionalidades.'
    },
    {
      id: 'g2',
      category: 'geral',
      question: 'Como posso reiniciar o guia de boas-vindas do portal?',
      answer: 'Se você deseja rever os balões de ajuda que explicam cada área do sistema, clique no botão "Iniciar Guia Interativo" posicionado logo acima nesta tela de ajuda. Isso limpará o registro de Onboarding e guiará você passo a passo novamente pelos elementos principais.'
    },
    {
      id: 'a1',
      category: 'agenda',
      question: 'Como configuro meus dias e horários de atendimento?',
      answer: 'Acesse a aba "Agenda" no dock inferior, e então clique no botão "Configurações" no topo da página (ou use o atalho rápido "Configurações da Agenda" ao clicar no seu perfil no canto superior direito). Lá, você poderá gerenciar a jornada diária, definir horários de intervalo e selecionar os dias da semana em que atende.'
    },
    {
      id: 'a2',
      category: 'agenda',
      question: 'Consigo sincronizar a agenda do portal com o Google Agenda?',
      answer: 'Sim! Na seção de Configurações de Agenda, selecione a sub-aba "Google Calendar" para vincular sua conta Google. Uma vez ativada, todos os novos agendamentos e alterações feitos no portal serão transmitidos em tempo real para a sua conta do Google, garantindo que você nunca perca um compromisso.'
    },
    {
      id: 'e1',
      category: 'estoque',
      question: 'O estoque é decrementado automaticamente após uma venda/serviço?',
      answer: 'Sim, o sistema possui baixa automatizada de insumos. Ao configurar um serviço, você pode associar a ele os produtos e as quantidades gastas em cada execução. Quando o atendimento é concluído (checkout feito), o sistema deduz automaticamente esses insumos do seu inventário geral e notifica caso atinja o limite mínimo.'
    },
    {
      id: 'e2',
      category: 'estoque',
      question: 'Como cadastro um novo produto no estoque?',
      answer: 'Abra a aba "Estoque & Negócio" (ícone de caixa no dock flutuante), navegue até a seção de produtos e clique no botão de cadastrar novo produto. Preencha informações fundamentais como nome, código de barras/SKU, preço de custo, preço de venda sugerido e a quantidade inicial em mãos.'
    },
    {
      id: 'p1',
      category: 'pix',
      question: 'Como configuro a chave Pix para receber pagamentos dos clientes?',
      answer: 'Vá até a aba "Agenda" no menu inferior e selecione a aba superior "Configurações". Depois, navegue até a opção "Pix". Lá você poderá cadastrar seu Nome Completo/Razão Social, Cidade da sua empresa e a Chave Pix (CPF, CNPJ, Celular, E-mail ou Chave Aleatória) onde deseja receber os pagamentos.'
    },
    {
      id: 'p2',
      category: 'pix',
      question: 'Os pagamentos via Pix gerados no portal caem na hora na minha conta?',
      answer: 'Sim! O QR Code gerado pelo sistema no momento do pagamento de um agendamento é uma instrução estática baseada no padrão do Banco Central (Pix Copia e Cola). O dinheiro é enviado diretamente da conta do seu cliente para a sua chave cadastrada, sem taxas ou retenção pelo portal, caindo na sua conta instantaneamente.'
    }
  ];

  const filteredFaq = faqData.filter(item => {
    const matchesCategory = selectedCategory === 'todos' || item.category === selectedCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (id: string) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    onViewTicket(ticketId);
  };

  useEffect(() => {
    if (selectedTicketId && selectedTicket && selectedTicket.reply && selectedTicket.repliedAt) {
      onViewTicket(selectedTicketId);
    }
  }, [selectedTicketId, selectedTicket?.reply, selectedTicket?.repliedAt]);

  // Lógica de resposta do cliente (tréplica)
  const [clientReplyText, setClientReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const handleSendClientReply = async () => {
    if (!clientReplyText.trim() || !selectedTicket) return;
    setIsSendingReply(true);

    const formatTime = () => {
      const now = new Date();
      return now.toLocaleString('pt-BR');
    };

    // Inclui a resposta anterior do consultor no histórico antes de adicionar a réplica do cliente
    let historicalBase = selectedTicket.message || '';
    if (selectedTicket.reply) {
      historicalBase += `\n\n[Consultor - ${selectedTicket.repliedAt?.toDate ? selectedTicket.repliedAt.toDate().toLocaleString('pt-BR') : formatTime()}]:\n${selectedTicket.reply}`;
    }

    const newHistoricalMessage = `${historicalBase}\n\n[Cliente - ${formatTime()}]:\n${clientReplyText}`;

    const success = await addMessageToRequest(selectedTicket.id, newHistoricalMessage, selectedTicket.reply);

    if (success) {
      setClientReplyText('');
      toast.success('Mensagem enviada com sucesso!');
    } else {
      toast.error('Erro ao enviar mensagem.');
    }
    setIsSendingReply(false);
  };
  
  // Form State
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('media');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const categories = [
    { id: 'Financeiro', label: 'Financeiro', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'Suporte Técnico', label: 'Suporte Técnico', icon: LifeBuoy, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'Sugestão', label: 'Sugestão', icon: Lightbulb, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'Solicitação de Serviço', label: 'Solicitação', icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10' }
  ];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'concluido': return { label: 'Concluído', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle2 };
      case 'em_analise': return { label: 'Em Análise', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Clock };
      case 'resolvido': return { label: 'Resolvido', color: 'text-violet-400', bg: 'bg-violet-500/20', icon: CheckCircle2 };
      default: return { label: 'Aberto', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: MessageSquare };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !message) return;

    setIsSubmitting(true);
    
    let imageUrl = '';
    if (selectedImage) {
      try {
        imageUrl = await uploadToCloudinary(selectedImage);
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    }

    const success = await createRequest({
      category,
      message,
      priority,
      clientName: client.name,
      imageUrl
    });

    if (success) {
      setIsModalOpen(false);
      setCategory('');
      setMessage('');
      setPriority('media');
      setSelectedImage(null);
      setImagePreview(null);
    }
    setIsSubmitting(false);
  };

  const openTickets = requests.filter(r => r.status !== 'concluido').length;
  const resolvedTickets = requests.filter(r => r.status === 'concluido').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-xl">
              <LifeBuoy className="text-primary-400 w-6 h-6" />
            </div>
            Central de Ajuda & Suporte
          </h3>
          <p className="text-gray-500 text-sm mt-1">Gerencie suas solicitações e tire suas dúvidas.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3.5 bg-white text-black font-bold rounded-2xl hover:bg-gray-100 transition-all active:scale-95 shadow-xl"
        >
          <Plus size={20} />
          Novo Chamado
        </button>
      </div>

      {/* Abas Superiores de Seção */}
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl w-fit">
        <button
          onClick={() => {
            setActiveSection('faq');
            setSearchQuery('');
            setSelectedCategory('todos');
            setOpenFaqId(null);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'faq' 
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <HelpCircle size={16} />
          Perguntas Frequentes
        </button>
        <button
          onClick={() => setActiveSection('tickets')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'tickets' 
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare size={16} />
          Meus Chamados
        </button>
      </div>

      {activeSection === 'faq' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Banner do Tour */}
          <div className="bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border border-primary-500/20 p-6 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-500/20 rounded-2xl text-primary-400 shrink-0">
                <Zap size={24} className="fill-current animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Precisa de ajuda para começar?</h4>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Preparamos um guia passo a passo interativo para apresentar as principais funções e áreas do seu portal.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleRestartTour}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all active:scale-95 shrink-0 text-xs shadow-lg shadow-primary-500/20"
            >
              <BookOpen size={16} />
              Iniciar Guia Interativo
            </button>
          </div>

          {/* Busca e Filtros */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquise por termos como Pix, estoque, agenda, horários..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
              {faqCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setOpenFaqId(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold shrink-0 transition-all border ${
                      isSelected 
                        ? 'bg-white border-white text-black shadow-lg shadow-white/10' 
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Icon size={14} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Acordeões de FAQ */}
          <div className="space-y-4">
            {filteredFaq.length === 0 ? (
              <div className="p-20 text-center border border-dashed border-white/10 rounded-[2rem] bg-white/[0.01]">
                <HelpCircle className="mx-auto mb-4 text-gray-600 animate-pulse" size={32} />
                <p className="text-gray-500 text-sm">Nenhuma pergunta encontrada para "{searchQuery}".</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('todos'); }}
                  className="mt-4 text-xs font-bold text-primary-400 hover:underline"
                >
                  Limpar busca e filtros
                </button>
              </div>
            ) : (
              filteredFaq.map((item) => {
                const isOpen = openFaqId === item.id;
                return (
                  <div 
                    key={item.id}
                    className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[1.5rem] overflow-hidden transition-all hover:border-white/20 shadow-lg animate-in fade-in duration-300"
                  >
                    <button
                      onClick={() => toggleFaq(item.id)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 group"
                    >
                      <span className="font-bold text-white text-sm sm:text-base group-hover:text-primary-400 transition-colors">
                        {item.question}
                      </span>
                      <div className={`p-1.5 bg-white/5 rounded-lg text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all duration-300 shrink-0 ${isOpen ? 'rotate-180 text-white bg-primary-500/20 text-primary-400' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="pb-6 px-6 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 bg-white/[0.01]">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex items-center gap-5">
              <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                <MessageSquare size={24} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Abertos</p>
                <p className="text-2xl font-black text-white">{openTickets}</p>
              </div>
            </div>
            
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex items-center gap-5">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Resolvidos</p>
                <p className="text-2xl font-black text-white">{resolvedTickets}</p>
              </div>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex items-center gap-5">
              <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center text-violet-400">
                <Shield size={24} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Tempo de Resposta</p>
                <p className="text-2xl font-black text-white">~4h Úteis</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-white/10 bg-white/[0.02]">
              <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                <Clock size={16} className="text-primary-400" />
                Histórico de Chamados
              </h4>
            </div>
            
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-20 text-center text-gray-500 italic animate-pulse">Carregando seus chamados...</div>
              ) : requests.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                    <HelpCircle className="text-gray-600" size={32} />
                  </div>
                  <p className="text-gray-500">Você ainda não possui nenhum chamado aberto.</p>
                </div>
              ) : (
                requests.map((ticket, index) => {
                  const status = getStatusInfo(ticket.status);
                  const cat = categories.find(c => c.id === ticket.category) || categories[1];
                  
                  return (
                    <motion.div 
                      key={ticket.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectTicket(ticket.id)}
                      className="px-8 py-6 flex items-center justify-between hover:bg-white/[0.02] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 ${cat.bg} rounded-2xl flex items-center justify-center ${cat.color} group-hover:scale-110 transition-transform`}>
                          <cat.icon size={20} />
                        </div>
                        <div>
                          <h5 className="font-bold text-white mb-1 group-hover:text-primary-400 transition-colors">#{ticket.id.slice(-6).toUpperCase()} - {ticket.category}</h5>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-gray-600 group-hover:text-white transition-colors">
                        <span className="text-xs font-bold hidden sm:block">Ver Detalhes</span>
                        <ChevronRight size={20} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#0f0f0f] border border-white/10 w-full max-w-xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-primary-500/20 rounded-xl">
                    <Plus className="text-primary-400 w-5 h-5" />
                  </div>
                  Abrir Novo Chamado
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Selecione o Assunto</label>
                  <CustomSelect
                    value={category}
                    onChange={(val) => setCategory(val)}
                    placeholder="Escolha o motivo do contato..."
                    options={categories.map(cat => ({
                       value: cat.id,
                       label: cat.label
                    }))}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-4 text-right">Urgência</label>
                  <div className="flex items-center justify-end gap-3">
                    {['baixa', 'media', 'alta'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${
                          priority === p 
                            ? p === 'alta' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 
                              p === 'media' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 
                              'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-gray-600 hover:text-gray-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Descreva sua solicitação</label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Detalhe o que você precisa..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-700 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-4">Anexar Imagem (Opcional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400 group-hover:scale-110 transition-transform">
                          <Paperclip size={20} />
                        </div>
                        <span className="text-xs text-gray-500 font-bold">Clique para selecionar uma imagem</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange} 
                          className="hidden" 
                        />
                      </div>
                    </label>

                    {imagePreview && (
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl group">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setImagePreview(null);
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !category || !message}
                  className="w-full py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-black rounded-2xl hover:shadow-lg hover:shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Enviando...' : 'Abrir Chamado'}
                  <Zap size={20} className="fill-current" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
              onClick={() => {
                setSelectedTicketId(null);
                setClientReplyText('');
              }} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#0f0f0f] border border-white/10 w-full max-w-2xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    Chamado #{selectedTicket.id.slice(-6).toUpperCase()}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Status: {selectedTicket.status}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedTicketId(null);
                    setClientReplyText('');
                  }} 
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-xs uppercase">
                      {client.name.charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-tighter">Sua Solicitação</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-sm text-gray-200 leading-relaxed shadow-inner">
                    {selectedTicket.message}
                    
                    {selectedTicket.imageUrl && (
                      <div className="mt-6 space-y-3">
                        <div className="relative group rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center">
                          <img 
                            src={selectedTicket.imageUrl} 
                            alt="Anexo" 
                            className="max-h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => window.open(selectedTicket.imageUrl, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button 
                              onClick={() => window.open(selectedTicket.imageUrl, '_blank')}
                              className="p-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 text-white transition-all"
                              title="Visualizar"
                            >
                              <ImageIcon size={20} />
                            </button>
                            <a 
                              href={selectedTicket.imageUrl} 
                              download={`anexo-${selectedTicket.id}.jpg`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 text-white transition-all"
                              title="Baixar"
                            >
                              <Download size={20} />
                            </a>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                          <ImageIcon size={12} />
                          Anexo enviado pelo cliente
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 font-bold uppercase">
                    {selectedTicket.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleString() : ''}
                  </span>
                </div>

                {selectedTicket.reply ? (
                  <div className="flex flex-col gap-3 items-end">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-primary-400 uppercase tracking-tighter text-right">Resposta do Consultor</span>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-lg shadow-primary-500/20">
                        <Shield size={14} />
                      </div>
                    </div>
                    <div className="bg-primary-500/10 border border-primary-500/20 p-5 rounded-2xl text-sm text-white leading-relaxed shadow-lg">
                      {selectedTicket.reply}
                    </div>
                    <span className="text-[10px] text-gray-600 font-bold uppercase">
                      {selectedTicket.repliedAt?.toDate ? selectedTicket.repliedAt.toDate().toLocaleString() : ''}
                    </span>
                  </div>
                ) : (
                  <div className="py-10 text-center border border-dashed border-white/10 rounded-[2rem]">
                    <Clock className="mx-auto mb-4 text-gray-600 animate-pulse" size={32} />
                    <p className="text-sm text-gray-500">Aguardando resposta do consultor...</p>
                    <p className="text-[10px] text-gray-600 uppercase font-bold mt-2 tracking-widest">SLA Estimado: 4 Horas Úteis</p>
                  </div>
                )}
              </div>

              {/* Caixa de Tréplica/Mensagem do Cliente */}
              {selectedTicket.status !== 'concluido' && (
                <div className="p-8 border-t border-white/10 bg-white/[0.01]">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Enviar mensagem para o suporte</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <textarea
                      value={clientReplyText}
                      onChange={(e) => setClientReplyText(e.target.value)}
                      placeholder="Digite sua resposta ou réplica aqui..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-gray-700 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all resize-none h-20 custom-scrollbar"
                    />
                    <button
                      onClick={handleSendClientReply}
                      disabled={isSendingReply || !clientReplyText.trim()}
                      className="px-6 py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold rounded-2xl transition-all flex items-center justify-center shrink-0 active:scale-95"
                    >
                      {isSendingReply ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'concluido' && (
                <div className="p-8 border-t border-white/10 bg-emerald-500/5 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs mb-2">
                    <CheckCircle2 size={16} />
                    Chamado Finalizado
                  </div>
                  <p className="text-gray-500 text-xs">Este atendimento foi concluído. Se precisar de algo mais, abra um novo chamado.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
