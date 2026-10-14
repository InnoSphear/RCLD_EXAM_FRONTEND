import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, post, patch, download } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge, StatCard, Field, inputClass } from '../../components/ui';
import Modal, { ConfirmDialog } from '../../components/Modal';

const EMPTY_FILTERS = { exam: '', semester: '', subject: '', status: '', passStatus: '', minScore: '', maxScore: '', from: '', to: '', search: '' };

export default function Results() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, exam: searchParams.get('exam') || '' });

  const [exams, setExams] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get('/exams', { limit: 100 }).then((d) => setExams(d.data.items)).catch(() => {});
    get('/academics/semesters').then((d) => setSemesters(d.data.items)).catch(() => {});
    get('/academics/subjects').then((d) => setSubjects(d.data.items)).catch(() => {});
  }, []);

  const clean = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get('/results', { page, limit, ...clean(filters) });
      setItems(d.data.items);
      setTotal(d.data.total);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, limit]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    (async () => {
      if (filters.exam) {
        try {
          const d = await get(`/results/summary/exam/${filters.exam}`);
          setSummary(d.data);
        } catch {
          setSummary(null);
        }
      } else {
        setSummary(null);
      }
    })();
  }, [filters.exam]);

  const setF = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
    if (k === 'exam') {
      const next = new URLSearchParams(searchParams);
      if (e.target.value) next.set('exam', e.target.value);
      else next.delete('exam');
      setSearchParams(next, { replace: true });
    }
  };

  const openDetail = async (row) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      const d = await get(`/results/${row._id}`);
      setDetail(d.data);
    } catch (e) {
      toast.error(apiError(e).message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const doExport = async (format) => {
    try {
      await download('/exports/results', { ...clean(filters), format }, `results_export.${format}`);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };

  const submitAdjust = async () => {
    setBusy(true);
    try {
      await patch(`/results/${adjusting._id}/adjust`, { delta: Number(adjustForm.delta), reason: adjustForm.reason });
      toast.success('Marks adjusted');
      setAdjusting(null);
      setAdjustForm({ delta: '', reason: '' });
      load();
      if (detail?.result?._id === adjusting._id) openDetail(adjusting);
    } catch (e) {
      const er = apiError(e);
      toast.error(er.details ? Object.values(er.details).join(' ') : er.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRelease = (row) => {
    const releasing = row.status !== 'released';
    setConfirm({
      title: releasing ? 'Release this result?' : 'Withhold this result?',
      message: `${row.studentDoc?.name || 'Student'} — ${row.examDoc?.title || 'exam'}`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await post(`/results/${row._id}/release`, { release: releasing });
          toast.success(releasing ? 'Result released' : 'Result withheld');
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        }
      },
    });
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Results</h1>
          <p className="text-sm text-slate-500">{total} result(s)</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('results.export') && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('xlsx')}>⬇ Excel</button>
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')}>⬇ CSV</button>
            </>
          )}
        </div>
      </div>

      {summary?.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Submissions" value={summary.stats.count} icon="✓" />
          <StatCard label="Average score" value={`${summary.stats.avgPercent?.toFixed(1)}%`} tone="green" icon="◔" />
          <StatCard label="Highest" value={summary.stats.maxScore} tone="purple" icon="↑" />
          <StatCard label="Lowest" value={summary.stats.minScore} tone="amber" icon="↓" />
          <StatCard label="Correct answers" value={summary.stats.totalCorrect} icon="●" />
        </div>
      )}

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            className="glass-input rounded-xl px-3.5 py-2 text-sm flex-1 min-w-[200px]"
            placeholder="Search student name / ID / exam…"
            value={filters.search}
            onChange={setF('search')}
            aria-label="Search results"
          />
          <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.exam} onChange={setF('exam')} aria-label="Filter by exam">
            <option value="">All exams</option>
            {exams.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
          </select>
          <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.semester} onChange={setF('semester')} aria-label="Filter by semester">
            <option value="">All semesters</option>
            {semesters.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
          </select>
          <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.subject} onChange={setF('subject')} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.status} onChange={setF('status')} aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="evaluated">Evaluated</option>
            <option value="released">Released</option>
            <option value="pending">Pending</option>
          </select>
          <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.passStatus} onChange={setF('passStatus')} aria-label="Filter by pass status">
            <option value="">Pass / fail</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Min %">
            <input type="number" className={`${inputClass} !w-24`} value={filters.minScore} onChange={setF('minScore')} />
          </Field>
          <Field label="Max %">
            <input type="number" className={`${inputClass} !w-24`} value={filters.maxScore} onChange={setF('maxScore')} />
          </Field>
          <Field label="From">
            <input type="date" className={`${inputClass} !w-40`} value={filters.from} onChange={setF('from')} />
          </Field>
          <Field label="To">
            <input type="date" className={`${inputClass} !w-40`} value={filters.to} onChange={setF('to')} />
          </Field>
          {activeFilterCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilters(EMPTY_FILTERS); setSearchParams({}, { replace: true }); setPage(1); }}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No results found" message="Adjust the filters, or results appear after students submit." />
      ) : (
        <>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Exam</th>
                    <th>Submitted</th>
                    <th>Score</th>
                    <th>%</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r._id}>
                      <td className="font-medium text-slate-700">
                        {r.studentDoc?.name || '—'}
                        <span className="block text-xs text-slate-400 font-mono">{r.studentDoc?.studentId}</span>
                      </td>
                      <td className="text-sm">{r.examDoc?.title}</td>
                      <td className="text-xs">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
                      <td>{r.marksObtained}/{r.maxMarks}</td>
                      <td>
                        <Badge tone={r.percentage >= 40 ? 'green' : 'red'}>{r.percentage?.toFixed(1)}%</Badge>
                      </td>
                      <td>
                        <Badge tone={r.status === 'released' ? 'green' : r.status === 'pending' ? 'amber' : 'gray'}>{r.status}</Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn btn-ghost btn-sm" onClick={() => openDetail(r)}>View</button>
                          {hasPermission('results.grade') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setAdjusting(r); setAdjustForm({ delta: '', reason: '' }); }}>Adjust</button>
                          )}
                          {hasPermission('results.view') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleRelease(r)}>
                              {r.status === 'released' ? 'Withhold' : 'Release'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                    <p className="text-xl font-bold text-slate-700">{r.passStatus}</p>
                    <p className="text-xs text-slate-500">Pass status</p>
                  </div>
                </div>

                <div className="text-sm text-slate-600 space-y-1">
                  <p><span className="font-semibold">Student:</span> {r.student?.name} ({r.student?.studentId})</p>
                  <p><span className="font-semibold">Exam:</span> {r.exam?.title}</p>
                  <p><span className="font-semibold">Correct / Incorrect / Unanswered:</span> {r.correct} / {r.incorrect} / {r.unanswered}</p>
                  <p><span className="font-semibold">Submitted:</span> {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</p>
                  <p><span className="font-semibold">Status:</span> {r.status}</p>
                </div>

                {detail.canSeeAnswers && (r.evaluation || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Question-wise evaluation</p>
                    <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                      {r.evaluation.map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-lg bg-white/70 border border-slate-200/70 px-3 py-2 text-sm">
                          <span className={`font-bold ${ev.isCorrect ? 'text-emerald-600' : ev.awarded > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                            {ev.isCorrect ? '✓' : ev.awarded > 0 ? '~' : '✗'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-slate-700 truncate">{ev.question?.statement || ev.question}</span>
                            <span className="text-xs text-slate-500">
                              Selected: {Array.isArray(ev.selected) && ev.selected.length ? ev.selected.join(', ') : '—'} · awarded {ev.awarded}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!detail.canSeeAnswers && (
                  <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    Answer details are not visible until the result is released.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title="Adjust marks" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {adjusting?.studentDoc?.name} — current {adjusting?.marksObtained}/{adjusting?.maxMarks}
          </p>
          <Field label="Delta (e.g. 1 or -0.5)" required>
            <input type="number" step="0.5" className={inputClass} value={adjustForm.delta} onChange={(e) => setAdjustForm((f) => ({ ...f, delta: e.target.value }))} />
          </Field>
          <Field label="Reason" required hint="Stored in the audit trail">
            <input className={inputClass} value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setAdjusting(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitAdjust} disabled={busy || !adjustForm.delta || !adjustForm.reason}>
              {busy ? 'Saving…' : 'Apply adjustment'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} title={confirm?.title} message={confirm?.message} confirmLabel="Confirm" />
    </div>
  );
}
