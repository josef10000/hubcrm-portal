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
  Loader2 
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
  const [name, setName] = useState(userProfile?.name || client?.name || '');
  const [phone, setPhone] = useState(userProfile?.phone || client?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // Imagem do Avatar
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.imageUrl || client?.imageUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Mantém os estados em sincronia com o banco de dados
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || client?.name || '');
      setPhone(userProfile.phone || client?.phone || '');
      setAvatarUrl(userProfile.imageUrl || client?.imageUrl || '');
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
      await updateDoc(profileRef, { imageUrl: secureUrl });
      
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
        phone: phone.trim()
      });

      toast.success('Configurações salvas com sucesso!');
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
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
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
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white text-sm outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <Phone size={16} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
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
        </div>
      </div>
    </div>
  );
}
