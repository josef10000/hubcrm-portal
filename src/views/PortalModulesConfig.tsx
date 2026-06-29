import React from 'react';
import { Sliders, Loader2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface PortalModulesConfigProps {
  userProfile: any;
}

export default function PortalModulesConfig({ userProfile }: PortalModulesConfigProps) {
  const modulesConfig = userProfile?.modulesConfig || {
    onboardingCompleted: true,
    activeModules: {
      agenda: true,
      agenda_public: true,
      agenda_pix: true,
      crm_finance: true,
      management: true,
      management_pos: true,
      management_calc: true,
      management_rentals: true,
      growth: true,
      clients: true,
      clients_fidelity: true,
      clients_pets: true,
      clients_vehicles: true
    }
  };
  const loadingModules = !userProfile;

  const toggleModule = async (key: string) => {
    const user = auth.currentUser;
    if (!user || !userProfile || !modulesConfig) return;
    
    const newActiveModules = { ...modulesConfig.activeModules };
    const newValue = !newActiveModules[key];
    newActiveModules[key] = newValue;
    
    // Tratamentos de Dependência e Lógica Hierárquica:
    if (key === 'management' && !newValue) {
      newActiveModules.management_pos = false;
      newActiveModules.management_calc = false;
      newActiveModules.management_rentals = false;
    }
    if (key === 'agenda' && !newValue) {
      newActiveModules.agenda_public = false;
      newActiveModules.agenda_pix = false;
    }
    if (key === 'clients' && !newValue) {
      newActiveModules.clients_fidelity = false;
      newActiveModules.clients_pets = false;
      newActiveModules.clients_vehicles = false;
    }
    
    // E se o filho for ativado? Garante que o pai esteja ativado
    if (key === 'management_pos' && newValue) newActiveModules.management = true;
    if (key === 'management_calc' && newValue) newActiveModules.management = true;
    if (key === 'management_rentals' && newValue) newActiveModules.management = true;
    if (key === 'agenda_public' && newValue) newActiveModules.agenda = true;
    if (key === 'agenda_pix' && newValue) newActiveModules.agenda = true;
    if (key === 'clients_fidelity' && newValue) newActiveModules.clients = true;
    if (key === 'clients_pets' && newValue) newActiveModules.clients = true;
    if (key === 'clients_vehicles' && newValue) newActiveModules.clients = true;

    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        'modulesConfig.activeModules': newActiveModules,
        'modulesConfig.onboardingCompleted': true
      });
      toast.success("Recursos updated!");
    } catch (err) {
      console.error("[PortalModulesConfig] Erro ao salvar módulos:", err);
      toast.error("Erro ao salvar alterações.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 rounded-xl">
            <Sliders className="text-primary-400 w-6 h-6" />
          </div>
          Personalizar Módulos
        </h3>
        <p className="text-gray-500 text-sm mt-1 font-medium">Ative ou desative módulos e ferramentas do seu portal para simplificar sua interface de trabalho.</p>
      </div>

      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
        {loadingModules ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agenda */}
            <div className="space-y-4 bg-white/[0.01] p-5 rounded-3xl border border-white/5 md:col-span-2">
              <CustomSwitch
                checked={modulesConfig?.activeModules?.agenda !== false}
                onChange={() => toggleModule('agenda')}
                label="📅 Agenda & Agendamentos"
                description="Aba principal para gerenciar horários, consultas e timelines."
              />
              
              {/* Filhos da Agenda */}
              {(modulesConfig?.activeModules?.agenda !== false) && (
                <div className="pl-6 border-l border-white/10 space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.agenda_public !== false}
                    onChange={() => toggleModule('agenda_public')}
                    label="🔗 Link de Agendamento Público"
                    description="Permite que seus clientes realizem agendamentos sozinhos por um link externo."
                  />
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.agenda_pix !== false}
                    onChange={() => toggleModule('agenda_pix')}
                    label="💳 Garantia por PIX"
                    description="Exige o pagamento de uma taxa de sinal via PIX para que o cliente confirme o agendamento."
                  />
                </div>
              )}
            </div>

            {/* Clientes */}
            <div className="space-y-4 bg-white/[0.01] p-5 rounded-3xl border border-white/5 md:col-span-2">
              <CustomSwitch
                checked={modulesConfig?.activeModules?.clients !== false}
                onChange={() => toggleModule('clients')}
                label="👥 Cadastro de Clientes (CRM)"
                description="Gerencie fichas clínicas, prontuários, contatos e histórico dos seus pacientes."
              />
              
              {/* Filhos de Clientes */}
              {(modulesConfig?.activeModules?.clients !== false) && (
                <div className="pl-6 border-l border-white/10 space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.clients_fidelity !== false}
                    onChange={() => toggleModule('clients_fidelity')}
                    label="🏆 Clube de Fidelidade"
                    description="Habilita sistema de pontuação e recompensas acumuladas por visitas ou compras."
                  />
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.clients_pets !== false}
                    onChange={() => toggleModule('clients_pets')}
                    label="🐶 Prontuário Multi-Pets"
                    description="Permite cadastrar múltiplos animais de estimação para cada tutor no CRM, com prontuários e fichas de histórico individuais."
                  />
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.clients_vehicles !== false}
                    onChange={() => toggleModule('clients_vehicles')}
                    label="🚗 Cadastro de Veículos"
                    description="Permite cadastrar carros, motos e outros veículos vinculados aos clientes no CRM para controle e histórico."
                  />
                </div>
              )}
            </div>

            {/* Finanças */}
            <div className="bg-white/[0.01] p-5 rounded-3xl border border-white/5 md:col-span-2">
              <CustomSwitch
                checked={modulesConfig?.activeModules?.crm_finance !== false}
                onChange={() => toggleModule('crm_finance')}
                label="💰 Finanças & Fluxo de Caixa"
                description="Habilita aba contábil para monitoramento de receitas, despesas e lucros reais da clínica."
              />
            </div>

            {/* Estoque */}
            <div className="space-y-4 bg-white/[0.01] p-5 rounded-3xl border border-white/5 md:col-span-2">
              <CustomSwitch
                checked={modulesConfig?.activeModules?.management !== false}
                onChange={() => toggleModule('management')}
                label="📦 Estoque & Insumos"
                description="Controle de inventário de uso interno, compras, valoração e movimentações físicas."
              />
              
              {/* Filhos de Estoque */}
              {(modulesConfig?.activeModules?.management !== false) && (
                <div className="pl-6 border-l border-white/10 space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.management_pos !== false}
                    onChange={() => toggleModule('management_pos')}
                    label="🛒 Frente de Caixa / PDV Rápido"
                    description="Habilita tela de vendas rápidas direta ao cliente com baixa física automática no estoque."
                  />
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.management_calc !== false}
                    onChange={() => toggleModule('management_calc')}
                    label="🧮 Calculadora de Orçamentos"
                    description="Ferramenta de precificação dinâmica para simular custos de produção e propor preços de venda."
                  />
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.management_rentals !== false}
                    onChange={() => toggleModule('management_rentals')}
                    label="🏠 Gestão de Aluguel por Temporada & Itens"
                    description="Permite cadastrar imóveis, salões, brinquedos e outros itens locáveis e gerenciar suas regras e informações de acesso."
                  />
                </div>
              )}
            </div>

            {/* Crescer */}
            <div className="bg-white/[0.01] p-5 rounded-3xl border border-white/5 md:col-span-2">
              <CustomSwitch
                checked={modulesConfig?.activeModules?.growth !== false}
                onChange={() => toggleModule('growth')}
                label="🚀 Crescer & Marketing"
                description="Aba com recursos de atração de clientes, criativos para mídias sociais e divulgação."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}

const CustomSwitch = ({ checked, onChange, label, description }: SwitchProps) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all">
      <div className="pr-4 text-left">
        <span className="text-xs font-bold text-white block">{label}</span>
        <span className="text-[10px] text-gray-500 block mt-0.5 leading-relaxed">{description}</span>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors duration-200 outline-none cursor-pointer ${
          checked ? 'bg-primary-500' : 'bg-white/10'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
