import { useEffect, useState, useCallback } from 'react';
import { get } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge, StatCard } from '../../components/ui';
import Modal from '../../components/Modal';

export default function StudentResults() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get('/student/results', { page, limit });
      setItems(d.data.items);
      setTotal(d.data.total);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const open = async (r) => {
    setDetail(r);
    setDetailLoading(true);
    try {
      const d = await get(`/results/${r._id}`);
      setDetail(d.data);
    } catch (e) {
      toast.error(apiError(e).message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const avg = items.length ? items.reduce((s, r) => s + (r.percentage || 0), 0) / items.length : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My results</h1>
        <p className="text-sm text-slate-500">Released results only</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Results" value={total} icon="✓" />
        <StatCard label="Average score" value={`${avg.toFixed(1)}%`} tone="green" icon="◔" />
        <StatCard label="Best" value={items.length ? `${Math.max(...items.map((r) => r.percentage || 0)).toFixed(1)}%` : '—'} tone="purple" icon="★" />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No results yet" message="Results appear here after they are released." />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((r) => (
              <article key={r._id} className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge tone="blue">{r.subject?.name}</Badge>
                    <Badge tone={r.status === 'released' ? 'green' : 'gray'}>{r.status}</Badge>
                    {r.passStatus && <Badge tone={r.passStatus === 'pass' ? 'green' : 'red'}>{r.passStatus}</Badge>}
                  </div>
                  <h3 className="font-semibold text-slate-800">{r.exam?.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{r.marksObtained}/{r.maxMarks}</p>
                    <p className="text-xs text-slate-500">{r.percentage?.toFixed(1)}%</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => open(r)}>View</button>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={page} limit={limit} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Result detail" width="max-w-2xl">
        {detailLoading || !detail ? (
          <Spinner />
        ) : (
          (() => {
            const r = detail.result;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-brand-50 border border-brand-200 p-3">
                    <p className="text-xl font-bold text-brand-700">{r.marksObtained}/{r.maxMarks}</p>
                    <p className="text-xs text-brand-700">Marks</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xl font-bold text-slate-700">{r.percentage?.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">Percentage</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xl font-bold text-slate-700 capitalize">{r.passStatus || '—'}</p>
                    <p className="text-xs text-slate-500">Status</p>
                  </div>
                </div>

                <p className="text-sm text-slate-600">
                  <span className="font-semibold">Exam:</span> {r.exam?.title} · <span className="font-semibold">Correct:</span> {r.correct} ·{' '}
                  <span className="font-semibold">Incorrect:</span> {r.incorrect} · <span className="font-semibold">Unanswered:</span> {r.unanswered}
                </p>

                {detail.canSeeAnswers && (r.evaluation || []).length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Question-wise breakdown</p>
                    <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                      {r.evaluation.map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-lg bg-white/70 border border-slate-200/70 px-3 py-2 text-sm">
                          <span className={`font-bold ${ev.isCorrect ? 'text-emerald-600' : ev.awarded > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                            {ev.isCorrect ? '✓' : ev.awarded > 0 ? '~' : '✗'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-slate-700">{ev.question?.statement || 'Question'}</span>
                            <span className="text-xs text-slate-500">
                              Your answer: {Array.isArray(ev.selected) && ev.selected.length ? ev.selected.join(', ') : '—'} · awarded {ev.awarded}
                              {detail.canSeeAnswers && ev.question?.correctAnswers?.length > 0 && ` · correct: ${ev.question.correctAnswers.join(', ')}`}
                            </span>
                            {ev.question?.explanation && <span className="block text-xs text-slate-500 mt-0.5">↳ {ev.question.explanation}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    Detailed answers are not available for this result.
                  </p>
                )}

                <div className="flex justify-end">
                  <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>
    </div>
  );
}
