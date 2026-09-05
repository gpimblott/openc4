import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

interface Props {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const type = toast.type || 'info';

  const typeStyles = {
    success: 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40',
    error: 'bg-slate-900/95 border-rose-500/40 text-rose-300 shadow-rose-950/40',
    info: 'bg-slate-900/95 border-cyan-500/40 text-cyan-300 shadow-cyan-950/40',
  }[type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }[type];

  const iconColor = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    info: 'text-cyan-400',
  }[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
      <div
        role="alert"
        className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md ${typeStyles}`}
      >
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
        <div className="flex-1 text-xs font-medium leading-relaxed pr-2 text-slate-100">
          {toast.message}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition -mr-1 -mt-1"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
