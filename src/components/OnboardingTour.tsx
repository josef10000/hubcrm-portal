import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';

interface TourStep {
  elementId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom';
}

interface OnboardingTourProps {
  setActiveTab: (tab: string) => void;
}

export default function OnboardingTour({ setActiveTab }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      elementId: 'tour-logo',
      title: '🚀 Bem-vindo ao Portal Hub!',
      description: 'Este é o novo painel do cliente independente, o canal integrado para acompanhar suas assinaturas, contratos e gerenciar as operações do seu negócio no dia a dia.',
      position: 'bottom'
    },
    {
      elementId: 'tour-dock',
      title: '🛠️ Suas Ferramentas Diárias',
      description: 'O Floating Dock inferior reúne seus atalhos mais importantes: Dashboard, Agenda, CRM Financeiro, Estoque & Negócio e Hub de Crescimento. Tudo em um design moderno e limpo.',
      position: 'top'
    },
    {
      elementId: 'tour-notifications',
      title: '🔔 Alertas e Avisos',
      description: 'Fique de olho no sininho! Aqui você recebe notificações em tempo real sobre respostas de chamados abertos e avisos importantes da nossa equipe.',
      position: 'bottom'
    },
    {
      elementId: 'tour-profile',
      title: '👤 Menu do Administrador',
      description: 'Clicando no seu avatar de perfil, você acessa rapidamente a Central de Ajuda & FAQ, Documentos de auditoria, faturas pendentes, e o atalho de Configurações da Agenda/Pix.',
      position: 'bottom'
    }
  ];

  // Verifica se o tour deve ser exibido
  useEffect(() => {
    const completed = localStorage.getItem('hub_onboarding_completed');
    if (!completed) {
      // Pequeno timeout para esperar o carregamento inicial da página e posicionamento do DOM
      const timer = setTimeout(() => {
        setIsOpen(true);
        setActiveTab('home'); // Garante que começa na home
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [setActiveTab]);

  // Atualiza as coordenadas do elemento focado
  useEffect(() => {
    if (!isOpen) return;

    const updateRect = () => {
      const step = steps[currentStep];
      const element = document.getElementById(step.elementId);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
        // Rola a tela até o elemento se necessário
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    // Re-calcula no resize da janela
    window.addEventListener('resize', updateRect);
    // Re-calcula após scroll sutil
    window.addEventListener('scroll', updateRect);
    
    // Pequeno intervalo de segurança caso o layout se mova
    const interval = setInterval(updateRect, 500);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      clearInterval(interval);
    };
  }, [currentStep, isOpen]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('hub_onboarding_completed', 'true');
    setIsOpen(false);
  };

  if (!isOpen || !targetRect) return null;

  const currentStepData = steps[currentStep];
  
  // Cálculo de posicionamento do balão explicativo
  const padding = 8;
  const balloonStyles: React.CSSProperties = {};

  if (currentStepData.position === 'bottom') {
    balloonStyles.top = `${targetRect.bottom + window.scrollY + 16}px`;
  } else {
    // Para 'top', fica acima do elemento
    balloonStyles.bottom = `${window.innerHeight - targetRect.top - window.scrollY + 16}px`;
  }

  // Centraliza horizontalmente com limites seguros nas laterais
  const balloonWidth = 320;
  const leftPos = targetRect.left + targetRect.width / 2 - balloonWidth / 2;
  const safeLeft = Math.max(16, Math.min(window.innerWidth - balloonWidth - 16, leftPos));
  balloonStyles.left = `${safeLeft}px`;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* SVG Overlay com Spotlight recortado */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-45">
        <defs>
          <mask id="spotlight-mask">
            {/* O rect branco cobre a tela toda (mantendo a máscara escura) */}
            <rect width="100%" height="100%" fill="white" />
            {/* O rect preto recorta o spotlight (deixando-o transparente e visível) */}
            <rect 
              x={targetRect.x - padding} 
              y={targetRect.y - padding} 
              width={targetRect.width + padding * 2} 
              height={targetRect.height + padding * 2} 
              rx="12" 
              fill="black" 
            />
          </mask>
        </defs>
        {/* Renderiza o background escurecido com o furo da máscara */}
        <rect 
          width="100%" 
          height="100%" 
          fill="rgba(0,0,0,0.75)" 
          mask="url(#spotlight-mask)" 
          className="transition-all duration-300 pointer-events-auto"
        />
      </svg>

      {/* Balão Explicativo do Onboarding */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95, y: currentStepData.position === 'bottom' ? 10 : -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          ref={tourRef}
          style={balloonStyles}
          className="absolute w-[320px] bg-[#0d0f14]/95 border border-white/10 backdrop-blur-2xl p-5 rounded-[2rem] shadow-[0_15px_50px_-10px_rgba(0,0,0,0.8)] z-50 pointer-events-auto flex flex-col gap-4 text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <span className="text-[10px] font-black uppercase text-primary-400 tracking-widest flex items-center gap-1.5">
              <Sparkles size={12} className="animate-pulse" />
              Guia Rápido • {currentStep + 1}/{steps.length}
            </span>
            <button
              onClick={handleComplete}
              className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              title="Pular Guia"
            >
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="space-y-1.5">
            <h4 className="font-extrabold text-white text-sm tracking-tight leading-snug">
              {currentStepData.title}
            </h4>
            <p className="text-gray-400 text-xs leading-relaxed">
              {currentStepData.description}
            </p>
          </div>

          {/* Rodapé / Controles */}
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
            <button
              onClick={handleComplete}
              className="text-[10px] text-gray-500 hover:text-white font-bold uppercase tracking-wider cursor-pointer"
            >
              Pular
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  Voltar
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-lg shadow-primary-500/20"
              >
                <span>{currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
