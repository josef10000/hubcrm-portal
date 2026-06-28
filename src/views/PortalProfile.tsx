import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Camera, 
  Phone, 
  Mail, 
  FileText, 
  Lock, 
  Globe, 
  Save, 
  Loader2,
  Pencil,
  Sliders
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { uploadToCloudinary } from '../lib/cloudinary';
import { toast } from 'sonner';

interface PortalProfileProps {
  client: any;
  userProfile: any;
  orgId: string | undefined;
  clientId: string | undefined;
}

export default function PortalProfile({ client, userProfile, orgId, clientId }: PortalProfileProps) {
  const [name, setName] = useState(userProfile?.displayName || userProfile?.name || client?.name || '');
  const [phone, setPhone] = useState(userProfile?.phone || client?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Imagem do Avatar
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.photoURL || userProfile?.imageUrl || client?.imageUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Configurações de Módulos e Recursos
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
      growth: true,
      clients: true,
      clients_fidelity: true
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
    // Se o pai for desativado, os filhos são desligados internamente
    if (key === 'management' && !newValue) {
      newActiveModules.management_pos = false;
      newActiveModules.management_calc = false;
    }
    if (key === 'agenda' && !newValue) {
      newActiveModules.agenda_public = false;
      newActiveModules.agenda_pix = false;
    }
    if (key === 'clients' && !newValue) {
      newActiveModules.clients_fidelity = false;
    }
    
    // E se o filho for ativado? Garante que o pai esteja ativado
    if (key === 'management_pos' && newValue) newActiveModules.management = true;
    if (key === 'management_calc' && newValue) newActiveModules.management = true;
    if (key === 'agenda_public' && newValue) newActiveModules.agenda = true;
    if (key === 'agenda_pix' && newValue) newActiveModules.agenda = true;
    if (key === 'clients_fidelity' && newValue) newActiveModules.clients = true;

    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        'modulesConfig.activeModules': newActiveModules,
        'modulesConfig.onboardingCompleted': true
      });
      toast.success("Recursos atualizados!");
    } catch (err) {
      console.error("[PortalProfile] Erro ao salvar módulos:", err);
      toast.error("Erro ao salvar alterações.");
    }
  };

  // Mantém os estados em sincronia com o banco de dados
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.displayName || userProfile.name || client?.name || '');
      setPhone(userProfile.phone || client?.phone || '');
      setAvatarUrl(userProfile.photoURL || userProfile.imageUrl || client?.imageUrl || '');
    }
  }, [userProfile, client]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    
    // Máscara (XX) XXXXX-XXXX
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 10) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    
    setPhone(value);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const user = auth.currentUser;
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      
      // Salva a nova imagem diretamente no documento de perfil do usuário logado no Firestore
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, { 
        imageUrl: secureUrl,
        photoURL: secureUrl 
      });
      
      setAvatarUrl(secureUrl);
      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (err) {
      console.error('[Profile] Upload failed:', err);
      toast.error('Erro ao fazer upload da foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !name.trim()) {
      toast.error('O nome do perfil é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      // Salva as alterações de Nome e Telefone no perfil do usuário no Firestore
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        name: name.trim(),
        displayName: name.trim(),
        phone: phone.trim()
      });

      // Sincroniza em tempo real as alterações com o card do CRM
      try {
        const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
        const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
        
        if (orgId && clientId && token) {
          const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_client',
              orgId,
              clientId,
              token,
              uid: user.uid,
              email: user.email,
              clientName: name.trim(),
              clientPhone: phone.trim()
            })
          });
          
          if (!response.ok) {
            console.warn('[Profile] CRM data synchronization failed.');
          }
        }
      } catch (crmErr) {
        console.error('[Profile] CRM synchronization error:', crmErr);
      }

      toast.success('Configurações salvas com sucesso!');
      setIsEditing(false);
    } catch (err) {
      console.error('[Profile] Save error:', err);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast.error('Nenhum e-mail de acesso detectado.');
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success(`Link de alteração de senha enviado para: ${user.email}`);
    } catch (err) {
      console.error('[Profile] Password reset error:', err);
      toast.error('Erro ao enviar link de alteração de senha.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 rounded-xl">
            <User className="text-primary-400 w-6 h-6" />
          </div>
          Configurações de Perfil
        </h3>
        <p className="text-gray-500 text-sm mt-1">Gerencie sua foto de exibição, dados de contato e segurança.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Avatar Card */}
        <div className="md:col-span-1 bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-white/10 bg-black shadow-2xl flex items-center justify-center">
            {isUploading ? (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Enviando...</span>
              </div>
            ) : null}

            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center font-black text-3xl uppercase text-white">
                {name ? name.charAt(0) : 'U'}
              </div>
            )}

            <label className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer z-10 text-white gap-1 select-none">
              <Camera size={20} className="text-white/80 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Alterar Foto</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarChange} 
                className="hidden" 
                disabled={isUploading}
              />
            </label>
          </div>

          <h4 className="font-bold text-white mt-4 text-base truncate w-full">{name || 'Seu Nome'}</h4>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Plano {client?.plan || 'Ativo'}</span>

          <div className="w-full h-px bg-white/10 my-6" />

          <div className="w-full text-left space-y-3">
            <div>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">E-mail de Acesso</span>
              <span className="text-xs text-gray-300 font-medium break-all">{client?.email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">CNPJ / CPF</span>
              <span className="text-xs text-gray-300 font-medium">{client?.cpfCnpj || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Form & Security Cards */}
        <div className="md:col-span-2 space-y-6">
          {/* Edit Data */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[2.5rem]">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <FileText size={16} className="text-primary-400" />
              Dados de Contato
            </h4>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Nome ou Razão Social</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Digite seu nome completo..."
                    className={`w-full rounded-2xl px-4 py-4 text-sm outline-none transition-all ${
                      isEditing 
                        ? 'bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary-500/50' 
                        : 'bg-white/[0.01] border border-white/5 text-gray-400 cursor-not-allowed'
                    }`}
                    readOnly={!isEditing}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Telefone / WhatsApp</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="(00) 00000-0000"
                      className={`w-full pl-12 pr-4 py-4 text-sm outline-none transition-all ${
                        isEditing 
                          ? 'bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary-500/50' 
                          : 'bg-white/[0.01] border border-white/5 text-gray-400 cursor-not-allowed'
                      }`}
                      readOnly={!isEditing}
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <Phone size={16} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setName(userProfile?.displayName || userProfile?.name || client?.name || '');
                        setPhone(userProfile?.phone || client?.phone || '');
                        setIsEditing(false);
                      }}
                      className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-wider"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || !name.trim()}
                      className="px-6 py-4 bg-white hover:bg-gray-100 disabled:opacity-50 text-black font-black rounded-2xl transition-all flex items-center justify-center gap-2.5 active:scale-95 text-xs uppercase tracking-wider"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Salvar Alterações
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-4 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2.5 active:scale-95 text-xs uppercase tracking-wider"
                  >
                    <Pencil size={16} className="text-white" />
                    Editar Informações
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Security / Password Reset */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[2.5rem]">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
              <Lock size={16} className="text-primary-400" />
              Segurança e Acesso
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              Para alterar sua senha com segurança, enviaremos um link oficial de redefinição para o seu e-mail cadastrado.
            </p>

            <button
              onClick={handlePasswordReset}
              disabled={isSendingReset}
              className="py-4 px-6 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 disabled:opacity-50 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-95"
            >
              {isSendingReset ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Enviar E-mail de Redefinição
                </>
              )}
            </button>
          </div>

          {/* Central de Módulos e Recursos */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[2.5rem] space-y-6">
            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                <Sliders size={16} className="text-primary-400" />
                Personalizar Recursos do Portal
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ative ou desative módulos e ferramentas do seu portal para personalizar sua barra de navegação e simplificar sua interface.
              </p>
            </div>

            {loadingModules ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Agenda */}
                <div className="space-y-2">
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.agenda !== false}
                    onChange={() => toggleModule('agenda')}
                    label="📅 Agenda & Agendamentos"
                    description="Aba principal para gerenciar horários, consultas e timelines."
                  />
                  
                  {/* Filhos da Agenda */}
                  {(modulesConfig?.activeModules?.agenda !== false) && (
                    <div className="pl-6 border-l border-white/10 space-y-2 animate-in slide-in-from-top-1 duration-200">
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
                <div className="space-y-2">
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.clients !== false}
                    onChange={() => toggleModule('clients')}
                    label="👥 Cadastro de Clientes (CRM)"
                    description="Gerencie fichas clínicas, prontuários, contatos e histórico dos seus pacientes."
                  />
                  
                  {/* Filhos de Clientes */}
                  {(modulesConfig?.activeModules?.clients !== false) && (
                    <div className="pl-6 border-l border-white/10 space-y-2 animate-in slide-in-from-top-1 duration-200">
                      <CustomSwitch
                        checked={modulesConfig?.activeModules?.clients_fidelity !== false}
                        onChange={() => toggleModule('clients_fidelity')}
                        label="🏆 Clube de Fidelidade"
                        description="Habilita sistema de pontuação e recompensas acumuladas por visitas ou compras."
                      />
                    </div>
                  )}
                </div>

                {/* Finanças */}
                <CustomSwitch
                  checked={modulesConfig?.activeModules?.crm_finance !== false}
                  onChange={() => toggleModule('crm_finance')}
                  label="💰 Finanças & Fluxo de Caixa"
                  description="Habilita aba contábil para monitoramento de receitas, despesas e lucros reais da clínica."
                />

                {/* Estoque */}
                <div className="space-y-2">
                  <CustomSwitch
                    checked={modulesConfig?.activeModules?.management !== false}
                    onChange={() => toggleModule('management')}
                    label="📦 Estoque & Insumos"
                    description="Controle de inventário de uso interno, compras, valoração e movimentações físicas."
                  />
                  
                  {/* Filhos de Estoque */}
                  {(modulesConfig?.activeModules?.management !== false) && (
                    <div className="pl-6 border-l border-white/10 space-y-2 animate-in slide-in-from-top-1 duration-200">
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
                    </div>
                  )}
                </div>

                {/* Crescer */}
                <CustomSwitch
                  checked={modulesConfig?.activeModules?.growth !== false}
                  onChange={() => toggleModule('growth')}
                  label="🚀 Crescer & Marketing"
                  description="Aba com recursos de atração de clientes, criativos para mídias sociais e divulgação."
                />
              </div>
            )}
          </div>
        </div>
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
