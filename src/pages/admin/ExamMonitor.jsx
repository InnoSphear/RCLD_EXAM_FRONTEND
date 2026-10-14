import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get, post } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge, StatCard } from '../../components/ui';
import { ConfirmDialog } from '../../components/Modal';
import { STATUS_TONE } from './examStatus';

const POLL_MS = 10000;

export default function ExamMonitor() {
  const { id } = useParams();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [data, setData] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [tab, setTab] = useState('live');
  const tabRef = useRef(tab);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const loadLive = useCallback(async () => {
    try {
      const d = await get(`/exams/${id}/monitor`);
      setData(d.data);
      setError('');
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAttempts = useCallback(async () => {
    try {
      const d = await get(`/exams/${id}/attempts`, { page, limit });
      setAttempts(d.data.items);
      setTotal(d.data.total);
    } catch (e) {
      toast.error(apiError(e).message);
    }
  }, [id, page, limit, toast]);

  useEffect(() => {
    (async () => {
      await loadLive();
      await loadAttempts();
    })();
  }, [loadLive, loadAttempts]);

  useEffect(() => {
    const t = setInterval(() => {
      if (tabRef.current === 'live') loadLive();
      loadAttempts();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loadLive, loadAttempts]);

  const toggleRelease = () => {
    const exam = data?.exam;
    const releasing = !exam.resultsReleased;
    setConfirm({
      title: releasing ? 'Release results to students?' : 'Hide results from students?',
      message: releasing
        ? 'Students will see their scores and, depending on release policy, the answer key.'
        : 'Students will no longer see results for this exam.',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await post(`/exams/${id}/release-results`, { release: releasing });
          toast.success(releasing ? 'Results released' : 'Results hidden');
          loadLive();
        } catch (e) {
          toast.error(apiError(e).message);
        }
      },
    });
  };

  if (loading) return <Spinner full />;
  if (error && !data) return <ErrorState message={error} onRetry={loadLive} />;
  if (!data) return null;

  const { exam, counts, registered, results, recent, serverTime } = data;
  const notStarted = registered - counts.started;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">{exam.title}</h1>
            <Badge tone={STATUS_TONE[exam.status]}>{exam.status}</Badge>
            {exam.resultsReleased && <Badge tone="green">results released</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {exam.semester?.title} · {exam.subject?.name} · server time {new Date(serverTime).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-ghost btn-sm" to="/admin/exams">← Exams</Link>
          {hasPermission('exams.publish') && (
            <button className={`btn btn-sm ${exam.resultsReleased ? 'btn-ghost' : 'btn-success'}`} onClick={toggleRelease}>
              {exam.resultsReleased ? 'Hide results' : 'Release results'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Registered" value={registered} icon="☺" />
        <StatCard label="Started" value={counts.started} tone="purple" icon="▶" />
        <StatCard label="In progress" value={counts.in_progress} tone="amber" icon="◐" />
        <StatCard label="Submitted" value={counts.submitted} tone="green" icon="✓" />
        <StatCard label="Not started" value={Math.max(0, notStarted)} icon="…" />
      </div>

      <div className="flex gap-2">
        {['live', 'attempts'].map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'live' ? 'Live activity' : `Attempts (${total})`}
          </button>
        ))}
      </div>

      {tab === 'live' ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{counts.totalAttempts}</p>
              <p className="text-xs text-slate-500">Total attempts</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{(counts.expired || 0) + (counts.auto_submitted || 0)}</p>
              <p className="text-xs text-slate-500">Expired / auto-submitted</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{results}</p>
              <p className="text-xs text-slate-500">Results generated</p>
            </div>
          </div>

          <section className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 text-sm">Most recent activity</h2>
              <span className="text-xs text-slate-400">auto-refreshes every {POLL_MS / 1000}s</span>
            </div>
            {recent.length === 0 ? (
              <EmptyState title="No activity yet" message="Students will appear here once they start." />
            ) : (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Last update</th>
                      <th>Answered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((a) => (
                      <tr key={a._id}>
                        <td className="font-medium text-slate-700">
                          {a.student?.name}
                          <span className="block text-xs text-slate-400 font-mono">{a.student?.studentId}</span>
                        </td>
                        <td>
                          <Badge tone={a.status === 'in_progress' ? 'amber' : a.status === 'submitted' ? 'green' : 'gray'}>{a.status}</Badge>
                        </td>
                        <td className="text-xs">{a.startedAt ? new Date(a.startedAt).toLocaleTimeString() : '—'}</td>
                        <td className="text-xs">{new Date(a.updatedAt).toLocaleTimeString()}</td>
                        <td>{a.answeredCount ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="glass rounded-2xl overflow-hidden">
          {attempts.length === 0 ? (
            <EmptyState title="No attempts yet" />
          ) : (
            <>
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>#</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Submitted</th>
                      <th>Score</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a._id}>
                        <td className="font-medium text-slate-700">
                          {a.student?.name}
                          <span className="block text-xs text-slate-400 font-mono">{a.student?.studentId}</span>
                        </td>
                        <td>{a.attemptNumber}</td>
                        <td>
                          <Badge tone={a.status === 'in_progress' ? 'amber' : a.status === 'submitted' ? 'green' : 'gray'}>{a.status}</Badge>
                        </td>
                        <td className="text-xs">{a.startedAt ? new Date(a.startedAt).toLocaleString() : '—'}</td>
                        <td className="text-xs">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}</td>
                        <td>{a.result ? `${a.result.marksObtained}/${a.result.maxMarks}` : '—'}</td>
                        <td>{a.result ? <Badge tone={a.result.percentage >= 40 ? 'green' : 'red'}>{a.result.percentage?.toFixed(1)}%</Badge> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4">
                <Pagination page={page} limit={limit} total={total} onChange={setPage} />
              </div>
            </>
          )}
        </section>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} title={confirm?.title} message={confirm?.message} confirmLabel="Confirm" />
    </div>
  );
}
