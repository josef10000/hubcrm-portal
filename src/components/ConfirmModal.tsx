import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      {/* Backdrop overlay clicável */}
      <div className="absolute inset-0" onClick={onCancel} />
      
      {/* Container do Modal */}
      <div className="bg-gradient-to-b from-[#161618] to-[#0d0d0e] border border-white/10 p-6 md:p-8 rounded-[2rem] max-w-sm w-full shadow-2xl relative text-center flex flex-col items-center z-10 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          title="Fechar"
        >
          <X size={20} />
        </button>

        {/* Ícone de Alerta */}
        <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 mb-5 animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Texto do Diálogo */}
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-xs leading-relaxed mb-6">{message}</p>

        {/* Botões de Ação */}
        <div className="w-full flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all active:scale-95 text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-500/15"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
