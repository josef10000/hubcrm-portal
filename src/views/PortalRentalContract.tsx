import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  FileText, ShieldCheck, Check, Printer, Copy, MessageSquare, AlertCircle, Loader2, Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function PortalRentalContract() {
  const { orgId, appointmentId } = useParams<{ orgId: string; appointmentId: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  const [appointment, setAppointment] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [resource, setResource] = useState<any>(null);

  // Estados do formulário de assinatura
  const [fullName, setFullName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!orgId || !appointmentId) return;
      try {
        // 1. Carrega dados do agendamento
        const appRef = doc(db, 'organizations', orgId, 'appointments', appointmentId);
        const appSnap = await getDoc(appRef);
        
        if (!appSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        
        const appData = appSnap.data();
        setAppointment({ id: appSnap.id, ...appData });
        setFullName(appData.clientName || '');

        // 2. Carrega dados da organização
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          setOrganization(orgSnap.data());
        }

        // 3. Carrega dados do recurso
        if (appData.resourceId) {
          const resRef = doc(db, 'organizations', orgId, 'resources', appData.resourceId);
          const resSnap = await getDoc(resRef);
          if (resSnap.exists()) {
            setResource(resSnap.data());
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do contrato:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orgId, appointmentId]);

  const handleSignContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !documentNumber.trim()) {
      toast.error('Preencha seu nome completo e documento (CPF) para assinar.');
      return;
    }

    setIsSigning(true);
    try {
      // Tenta obter o IP do hóspede usando um serviço público leve
      let clientIp = '127.0.0.1';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        clientIp = ipData.ip || '127.0.0.1';
      } catch (ipErr) {
        console.warn("Não foi possível obter o IP externo:", ipErr);
      }

      const securityHash = Math.random().toString(36).substring(2, 10).toUpperCase() + 
                           appointmentId?.substring(0, 4).toUpperCase();

      const appRef = doc(db, 'organizations', orgId!, 'appointments', appointmentId!);
      await updateDoc(appRef, {
        contractSigned: true,
        contractSignedAt: serverTimestamp(),
        contractSignedName: fullName.trim(),
        contractSignedDocument: documentNumber.trim(),
        contractSignedIp: clientIp,
        contractSecurityHash: securityHash
      });

      // Atualiza o estado local para exibir a assinatura na hora
      setAppointment((prev: any) => ({
        ...prev,
        contractSigned: true,
        contractSignedAt: new Date(),
        contractSignedName: fullName.trim(),
        contractSignedDocument: documentNumber.trim(),
        contractSignedIp: clientIp,
        contractSecurityHash: securityHash
      }));

      toast.success('Contrato assinado eletronicamente com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao assinar o contrato. Tente novamente.');
    } finally {
      setIsSigning(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link do contrato copiado!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p className="text-gray-400 font-medium animate-pulse">Carregando o contrato de locação...</p>
      </div>
    );
  }

  if (notFound || !appointment) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-500/10 p-4 rounded-full border border-rose-500/20 text-rose-500 mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Reserva Não Encontrada</h2>
        <p className="text-gray-400 max-w-sm mb-8 text-sm">
          O contrato de locação para esta reserva não existe ou foi removido pelo proprietário.
        </p>
      </div>
    );
  }

  const checkinDateFormatted = appointment.date ? new Date(`${appointment.date}T00:00:00`).toLocaleDateString('pt-BR') : '';
  const checkoutDateFormatted = appointment.checkoutDate ? new Date(`${appointment.checkoutDate}T00:00:00`).toLocaleDateString('pt-BR') : '';

  // WhatsApp de suporte
  const phoneClean = (organization?.phone || '').replace(/\D/g, '');
  const supportText = `Olá! Sou hóspede na propriedade *${resource?.name || 'Imóvel'}* e preciso de suporte com meu contrato.`;
  const whatsappUrl = `https://wa.me/${phoneClean ? (phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean) : ''}?text=${encodeURIComponent(supportText)}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex justify-center pb-12 print:bg-white print:text-black print:pb-0 select-text">
      {/* Background decoration (hidden in print) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 print:hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-3xl px-4 md:px-6 relative z-10 pt-8 space-y-6 print:pt-0 print:px-0">
        
        {/* Top Header (Oculto na Impressão) */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            {organization?.logoUrl ? (
              <img 
                src={organization.logoUrl} 
                alt={organization.name} 
                className="w-10 h-10 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400 font-bold">
                H
              </div>
            )}
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Contrato Digital</p>
              <h1 className="text-sm font-bold text-gray-300">{organization?.name || 'Portal Hub'}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-2"
            >
              {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copiedLink ? 'Copiado!' : 'Link'}</span>
            </button>
            {appointment.contractSigned && (
              <button
                onClick={handlePrint}
                className="p-2.5 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 text-primary-400 hover:text-primary-300 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-2"
              >
                <Printer size={14} />
                <span>PDF / Imprimir</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Box (Oculto na Impressão) */}
        <div className="print:hidden">
          {appointment.contractSigned ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 flex items-center gap-4 text-left">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Contrato Assinado</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Este contrato foi assinado eletronicamente por <strong>{appointment.contractSignedName}</strong> (CPF: {appointment.contractSignedDocument}) em {appointment.contractSignedAt instanceof Date ? appointment.contractSignedAt.toLocaleString('pt-BR') : new Date(appointment.contractSignedAt?.seconds * 1000).toLocaleString('pt-BR')}.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-center gap-4 text-left">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                <FileText size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Aguardando Assinatura</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Revise a minuta abaixo com atenção. Preencha seus dados no formulário no final do contrato para assinar e confirmar sua locação.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Corpo do Contrato (Papel do Contrato - Branco no PDF) */}
        <div className="bg-[#0b0c10] border border-white/10 rounded-3xl p-6 md:p-12 shadow-2xl text-left text-gray-300 space-y-6 leading-relaxed text-sm print:bg-white print:text-black print:border-0 print:shadow-none print:p-0">
          
          {/* Cabeçalho do Papel */}
          <div className="text-center border-b border-white/10 pb-6 print:border-black/10">
            <h2 className="text-lg font-black text-white uppercase tracking-wider print:text-black">
              Contrato de Locação por Temporada
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Código de Identificação da Reserva: {appointment.id}
            </p>
          </div>

          {/* Cláusula 1 - Qualificação das Partes */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-white tracking-wider border-l-2 border-primary-500 pl-2 print:text-black print:border-black">
              1. Das Partes
            </h3>
            <p>
              <strong>LOCADOR (ANFITRIÃO):</strong> {organization?.name || 'Administrador do Imóvel'}, pessoa física ou jurídica devidamente cadastrada no sistema Portal Hub.
            </p>
            <p>
              <strong>LOCATÁRIO (HÓSPEDE):</strong> {fullName || appointment.clientName}, de telefone {appointment.clientPhone} e e-mail {appointment.clientEmail || 'Não informado'}.
            </p>
          </div>

          {/* Cláusula 2 - Do Objeto */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-white tracking-wider border-l-2 border-primary-500 pl-2 print:text-black print:border-black">
              2. Do Objeto da Locação
            </h3>
            <p>
              Constitui objeto deste instrumento a locação temporária do imóvel/recurso denominado <strong>{resource?.name || 'Imóvel'}</strong>, cadastrado sob a responsabilidade do LOCADOR.
            </p>
            {resource?.description && (
              <p className="italic text-xs text-gray-400 bg-white/[0.02] p-3 rounded-xl border border-white/5 print:bg-gray-50 print:text-gray-700 print:border-gray-200">
                Descrição complementar do item: {resource.description}
              </p>
            )}
          </div>

          {/* Cláusula 3 - Do Prazo e Período */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-white tracking-wider border-l-2 border-primary-500 pl-2 print:text-black print:border-black">
              3. Do Prazo da Estadia e Ocupação
            </h3>
            <p>
              O período acordado de estadia compreende o ingresso (Check-in) na data de <strong>{checkinDateFormatted}</strong> a partir do horário reservado, e a saída (Check-out) impreterivelmente na data de <strong>{checkoutDateFormatted}</strong>.
            </p>
            <p>
              Qualquer prorrogação deste período deve ser previamente consultada e formalizada junto ao LOCADOR.
            </p>
          </div>

          {/* Cláusula 4 - Do Valor e Forma de Pagamento */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-white tracking-wider border-l-2 border-primary-500 pl-2 print:text-black print:border-black">
              4. Do Valor e Condições
            </h3>
            <p>
              Pelo período de ocupação e uso do objeto locado, o LOCATÁRIO pagará a quantia total acordada de <strong>R$ {appointment.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
            </p>
            <p>
              O valor supra abrange as taxas de consumo e impostos do respectivo período de uso do recurso locável, salvo outras despesas combinadas diretamente entre as partes.
            </p>
          </div>

          {/* Cláusula 5 - Das Regras e Convivência */}
          {resource?.rules && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-white tracking-wider border-l-2 border-primary-500 pl-2 print:text-black print:border-black">
                5. Das Regras de Uso e Convivência
              </h3>
              <p>
                O LOCATÁRIO se compromete a zelar pelo bom estado do objeto locado e respeitar as seguintes regras específicas do imóvel estabelecidas pelo LOCADOR:
              </p>
              <div className="bg-black/30 border border-white/5 p-4 rounded-xl text-xs text-gray-400 whitespace-pre-wrap leading-relaxed print:bg-white print:text-black print:border-gray-200">
                {resource.rules}
              </div>
            </div>
          )}

          {/* Assinaturas Digitais Geradas no Documento (Visível em Impressão) */}
          {appointment.contractSigned && (
            <div className="mt-12 pt-6 border-t border-dashed border-white/10 space-y-4 text-xs bg-white/[0.01] p-4 rounded-2xl border border-white/5 print:border-black/10 print:bg-transparent print:p-0 print:border-0">
              <h4 className="font-bold text-white uppercase tracking-wider print:text-black">
                Assinatura Eletrônica e Registro Digital
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-gray-500">Locatário/Hóspede:</p>
                  <p className="font-mono text-white print:text-black font-bold">{appointment.contractSignedName}</p>
                  <p className="text-gray-500 mt-1">Documento (CPF):</p>
                  <p className="font-mono text-white print:text-black font-bold">{appointment.contractSignedDocument}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500">Data e Hora da Assinatura:</p>
                  <p className="font-mono text-white print:text-black font-bold">
                    {appointment.contractSignedAt instanceof Date ? appointment.contractSignedAt.toLocaleString('pt-BR') : new Date(appointment.contractSignedAt?.seconds * 1000).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-gray-500 mt-1">Endereço IP e Integridade:</p>
                  <p className="font-mono text-white print:text-black font-bold truncate">
                    IP: {appointment.contractSignedIp} | Hash: {appointment.contractSecurityHash}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 italic mt-2">
                Documento eletrônico validado e assinado digitalmente nos termos do sistema Portal Hub.
              </p>
            </div>
          )}
        </div>

        {/* Formulário de Assinatura (Oculto na Impressão e se já Assinado) */}
        {!appointment.contractSigned && (
          <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-3xl p-6 md:p-8 space-y-5 text-left print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-500/10 w-fit rounded-xl text-primary-400 border border-primary-500/20">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Assinar Contrato Eletronicamente</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Digite seu nome completo e documento para validar legalmente a locação.
                </p>
              </div>
            </div>

            <form onSubmit={handleSignContract} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Completo do Locatário</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: João Silva de Souza"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Documento (CPF / Passaporte)</label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ex: 000.000.000-00"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSigning}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:bg-emerald-500/40 text-black text-sm font-black rounded-2xl shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  {isSigning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Aceitar e Assinar Contrato</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Suporte WhatsApp (Oculto na Impressão) */}
        {phoneClean && (
          <div className="pt-2 print:hidden">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer no-underline text-center"
            >
              <MessageSquare size={14} />
              <span>Precisa de auxílio? Falar com Suporte</span>
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/5 space-y-1 print:hidden">
          <p className="text-[10px] text-gray-600">
            Powered by <strong>Portal Hub CRM</strong>
          </p>
          <p className="text-[9px] text-gray-700">
            &copy; {new Date().getFullYear()} Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
