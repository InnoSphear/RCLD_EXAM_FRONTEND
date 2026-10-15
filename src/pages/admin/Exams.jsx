import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get, post, del } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge } from '../../components/ui';
import { ConfirmDialog } from '../../components/Modal';
import { STATUS_TONE, EXAM_TRANSITIONS } from './examStatus';

const TRANSITION_LABEL = {
  draft: 'Revert to draft',
  scheduled: 'Schedule',
  published: 'Publish',
  active: 'Activate',
  completed: 'Complete',
  cancelled: 'Cancel exam',
};

export default function Exams() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const d = await get('/exams', params);
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

  const changeStatus = (exam, status) => {
    setConfirm({
      title: `Mark "${exam.title}" as ${status}?`,
      message:
        status === 'published'
          ? 'Students of the assigned semester will see this examination.'
          : status === 'active'
            ? 'Students will be able to start attempts now.'
            : `This moves the exam to "${status}".`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await post(`/exams/${exam._id}/status`, { status });
          toast.success(`Status changed to ${status}`);
          load();
        } catch (e) {
          const er = apiError(e);
          toast.error(er.details ? `${er.message}: ${er.details.allowed?.join(', ') || JSON.stringify(er.details)}` : er.message);
        }
      },
    });
  };

  const removeExam = (exam) => {
    setConfirm({
      title: `Delete "${exam.title}"?`,
      message: 'This permanently removes the exam and all its attempts and results.',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await del(`/exams/${exam._id}`);
          toast.success('Exam deleted');
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        }
      },
    });
  };


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Examinations</h1>
          <p className="text-sm text-slate-500">{total} exam(s)</p>
        </div>
        {hasPermission('exams.create') && (
          <Link to="/admin/exams/new" className="btn btn-primary btn-sm">
            + New examination
          </Link>
        )}
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3">
        <input
          className="glass-input rounded-xl px-3.5 py-2 text-sm flex-1 min-w-[200px]"
          placeholder="Search by title…"
          value={filters.search}
          onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
          aria-label="Search exams"
        />
        <select
          className="glass-input rounded-xl px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {['draft', 'scheduled', 'published', 'active', 'completed', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No examinations found"
          message="Create an examination and assign questions to it."
          action={hasPermission('exams.create') ? <Link className="btn btn-primary" to="/admin/exams/new">Create examination</Link> : null}
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((e) => (
              <article key={e._id} className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                      <span className="text-xs text-slate-400">
                        {e.semester?.title} · {e.subject?.name}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{e.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(e.startsAt).toLocaleString()} → {new Date(e.endsAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.questionCount} questions · {e.totalMarks} marks · {e.durationMinutes} min · max {e.maxAttempts} attempt(s)
                      {e.resultsReleased && ' · results released'}
                    </p>
                    {e.status === 'draft' && (
                      <p className="text-xs font-medium text-amber-700 mt-1">
                        Draft — students cannot see this exam until you click <b>Publish</b>.
                      </p>
                    )}
                    {e.status === 'scheduled' && (
                      <p className="text-xs font-medium text-blue-700 mt-1">
                        Scheduled — students will not see it until you click <b>Publish</b>.
                      </p>
                    )}
                    {e.status === 'published' && new Date(e.endsAt) < new Date() && (
                      <p className="text-xs font-medium text-slate-500 mt-1">Window closed — students can no longer attempt this exam.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {hasPermission('exams.create') && !['completed', 'cancelled'].includes(e.status) && (
                      <Link className="btn btn-ghost btn-sm" to={`/admin/exams/${e._id}/edit`}>Edit</Link>
                    )}
                    {hasPermission('exams.monitor') && (
                      <Link className="btn btn-ghost btn-sm" to={`/admin/exams/${e._id}/monitor`}>Monitor</Link>
                    )}
                    <Link className="btn btn-ghost btn-sm" to={`/admin/results?exam=${e._id}`}>Results</Link>
                    {(EXAM_TRANSITIONS[e.status] || []).map((s) => {
                      const needsPublish = ['published', 'active'].includes(s) && !hasPermission('exams.publish');
                      const needsSchedule = s === 'scheduled' && !hasPermission('exams.schedule') && !hasPermission('exams.create');
                      if (needsPublish || needsSchedule) return null;
                      return (
                        <button
                          key={s}
                          className={`btn btn-sm ${s === 'published' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => changeStatus(e, s)}
                        >
                          {TRANSITION_LABEL[s] || s}
                        </button>
                      );
                    })}
                    {hasPermission('exams.delete') && (
                      <button className="btn btn-ghost btn-sm text-red-600" onClick={() => removeExam(e)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={page} limit={limit} total={total} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || 'Change status'}
        danger={confirm?.danger}
      />
    </div>
  );
}
