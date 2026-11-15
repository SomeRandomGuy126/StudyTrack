import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative card w-full ${sizeClass} max-h-[90vh] overflow-hidden flex flex-col animate-scale-in`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-app">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
            <button onClick={onClose} className="btn-ghost btn !p-1.5">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
};

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm' }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-secondary text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="btn btn-danger"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
