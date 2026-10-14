export function Spinner({ label = 'Loading…', full = false }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-slate-500 ${full ? 'py-16' : 'py-8'}`} role="status">
      <span className="inline-block h-5 w-5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message = '', action }) {
  return (
    <div className="glass rounded-2xl py-12 px-6 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl text-slate-400">∅</div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="glass rounded-2xl py-8 px-6 text-center border-red-200">
      <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center text-xl text-red-400">!</div>
      <h3 className="font-semibold text-red-700">Request failed</h3>
      <p className="text-sm text-slate-600 mt-1">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost mt-4" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = 'brand', icon }) {
  const tones = {
    brand: 'from-brand-500/15 to-brand-700/5 text-brand-700',
    green: 'from-emerald-500/15 to-emerald-700/5 text-emerald-700',
    amber: 'from-amber-500/15 to-amber-700/5 text-amber-700',
    purple: 'from-violet-500/15 to-violet-700/5 text-violet-700',
  };
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg ${tones[tone]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}

export function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="text-slate-500">
        Page {page} of {pages} · {total} records
      </span>
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← Prev
        </button>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Field({ label, error, children, hint, required }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}

export const inputClass = 'glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400';
