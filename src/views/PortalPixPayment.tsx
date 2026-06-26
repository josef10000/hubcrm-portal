import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { DollarSign, Copy, Check, Shield, Globe } from 'lucide-react';
import { generateStaticPix } from '../lib/pix';
import { toast, Toaster } from 'sonner';
import { usePublicTheme } from '../lib/ThemeContext';

export default function PortalPixPayment() {
  usePublicTheme();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [pixCode, setPixCode] = useState('');

  // Parâmetros da URL
  const key = searchParams.get('key') || '';
  const name = searchParams.get('name') || 'Empresa';
  const city = searchParams.get('city') || 'Sao Paulo';
  const amountStr = searchParams.get('amount') || '0';
  const txid = searchParams.get('txid') || '***';

  const amount = parseFloat(amountStr);

  useEffect(() => {
    if (key) {
      const code = generateStaticPix({
        key,
        name,
        city,
        amount: amount > 0 ? amount : undefined,
        txid: txid.substring(0, 25)
      });
      setPixCode(code);
    }
  }, [key, name, city, amount, txid]);

  const handleCopy = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success('Código Pix Copia e Cola copiado com sucesso!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!key) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] flex flex-col items-center justify-center p-4">
        <div className="bg-[var(--theme-glass)] border border-[var(--theme-border)] p-6 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <Shield className="text-rose-500 mx-auto" size={40} />
          <h2 className="text-[var(--theme-text-primary)] text-lg font-bold">Link de Pagamento Inválido</h2>
          <p className="text-[var(--theme-text-secondary)] text-xs">Os parâmetros de cobrança Pix estão ausentes ou incorretos. Por favor, solicite um novo link de pagamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      <Toaster position="top-center" richColors />
      
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[var(--theme-glass)] backdrop-blur-xl border border-[var(--theme-border)] p-6 md:p-8 rounded-[2rem] shadow-2xl relative z-10 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Shield size={10} />
            <span>Pagamento Pix Seguro</span>
          </div>
          <h2 className="text-[var(--theme-text-tertiary)] font-bold text-sm uppercase tracking-widest text-center">Checkout</h2>
          
          {amount > 0 && (
            <div className="pt-2">
              <span className="text-xs text-[var(--theme-text-secondary)] block font-medium">Valor a pagar</span>
              <span className="text-3xl md:text-4xl font-extrabold text-[var(--theme-text-primary)] tracking-tight">
                R$ {amount.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center bg-white p-5 rounded-2xl shadow-inner max-w-[240px] mx-auto relative group">
          {pixCode ? (
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`}
              alt="QR Code Pix"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-[180px] h-[180px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Instruções */}
        <div className="text-center text-xs text-[var(--theme-text-secondary)] space-y-1 max-w-[280px] mx-auto">
          <p className="font-semibold text-[var(--theme-text-primary)]">Escaneie o QR Code acima com o app do seu banco</p>
          <p className="text-[10px] opacity-70">Ou copie o código copia e cola abaixo para pagar</p>
        </div>

        {/* Pix Copia e Cola */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--theme-text-secondary)] uppercase tracking-wider block text-center">Pix Copia e Cola</label>
          <div className="flex flex-col gap-2">
            <div className="w-full px-4 py-3 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] rounded-xl text-xs font-mono break-all text-center select-all max-h-24 overflow-y-auto custom-scrollbar">
              {pixCode}
            </div>
            
            <button
              type="button"
              onClick={handleCopy}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border-0 shadow-md ${
                copied 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10' 
                  : 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/10'
              }`}
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Código Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copiar Código Pix</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Beneficiário Info */}
        <div className="border-t border-[var(--theme-border)] pt-4 mt-2 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-[var(--theme-text-tertiary)] uppercase tracking-wider block">Beneficiário</span>
            <span className="text-[var(--theme-text-primary)] font-medium truncate block">{name}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--theme-text-tertiary)] uppercase tracking-wider block">Cidade</span>
            <span className="text-[var(--theme-text-primary)] font-medium truncate block">{city}</span>
          </div>
        </div>

        {/* Footer Brand */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--theme-text-tertiary)] border-t border-[var(--theme-border)] pt-4">
          <Globe size={10} />
          <span>Processado com segurança via HubCRM</span>
        </div>
      </motion.div>
    </div>
  );
}
