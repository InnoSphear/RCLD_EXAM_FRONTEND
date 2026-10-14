import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative glass-strong w-full ${width} rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto focus:outline-none`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/70 sticky top-0 bg-white/80 backdrop-blur z-10 rounded-t-2xl">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm !px-2" aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-200/70 flex justify-end gap-2 sticky bottom-0 bg-white/80">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || 'Are you sure?'}
      width="max-w-md"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 whitespace-pre-line">{message}</p>
    </Modal>
  );
}
