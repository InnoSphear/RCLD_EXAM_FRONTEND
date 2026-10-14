import { useEffect, useState, useCallback } from 'react';
import { get } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { Spinner, ErrorState, EmptyState, Pagination, Badge } from '../../components/ui';

const ENTITIES = ['User', 'Student', 'Exam', 'ExamAttempt', 'Question', 'QuestionImportBatch', 'Result', 'Semester', 'Subject'];

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', action: '', entity: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const d = await get('/admin/audit-logs', params);
      setItems(d.data.items);
      setTotal(d.data.total);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const setF = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const toneFor = (action = '') => {
    if (action.includes('delete')) return 'red';
    if (action.includes('create') || action.includes('import')) return 'green';
    if (action.includes('status') || action.includes('release')) return 'amber';
    if (action.includes('auth') || action.includes('password')) return 'purple';
    return 'blue';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit logs</h1>
        <p className="text-sm text-slate-500">{total} events recorded</p>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3">
        <input
          className="glass-input rounded-xl px-3.5 py-2 text-sm flex-1 min-w-[200px]"
          placeholder="Search summary or action…"
          value={filters.search}
          onChange={setF('search')}
          aria-label="Search audit logs"
        />
        <input
          className="glass-input rounded-xl px-3.5 py-2 text-sm w-48"
          placeholder="Action, e.g. exam."
          value={filters.action}
          onChange={setF('action')}
          aria-label="Filter by action"
        />
        <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.entity} onChange={setF('entity')} aria-label="Filter by entity">
          <option value="">All entities</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No audit events" message="Actions performed by staff will show up here." />
      ) : (
        <>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Summary</th>
                    <th>Entity</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l) => (
                    <tr key={l._id}>
                      <td className="text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="text-sm">
                        {l.actor?.name || 'System'}
                        <span className="block text-xs text-slate-400 capitalize">{l.actor?.role || ''}</span>
                      </td>
                      <td><Badge tone={toneFor(l.action)}>{l.action}</Badge></td>
                      <td className="text-sm text-slate-600">{l.summary}</td>
                      <td className="text-xs text-slate-500">{l.entity}{l.entityId ? ` · ${String(l.entityId).slice(-6)}` : ''}</td>
                      <td className="text-xs font-mono text-slate-400">{l.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} limit={limit} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
