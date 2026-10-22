import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react';

// ── Toast context ──────────────────────────────────────────────────────────────

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastItem['type']) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

// ── Toast provider ─────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  );
}

// ── Toast container ────────────────────────────────────────────────────────────

const TOAST_STYLES = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error:   'bg-red-50 text-red-800 border-red-200',
  info:    'bg-blue-50 text-blue-800 border-blue-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
};

const TOAST_ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-2.5 rounded-xl border shadow-lg px-4 py-3 text-sm font-medium max-w-sm animate-in pointer-events-auto cursor-pointer ${TOAST_STYLES[toast.type]}`}
          onClick={() => onDismiss(toast.id)}
          style={{ animation: 'slideIn 0.2s ease-out' }}
        >
          <span className="text-base flex-shrink-0">{TOAST_ICONS[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
          <svg className="w-3 h-3 opacity-40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ))}
    </div>
  );
}
