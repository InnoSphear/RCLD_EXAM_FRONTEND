import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorState, EmptyState, Badge } from '../../components/ui';
import { ConfirmDialog } from '../../components/Modal';

const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function StudentExams() {
  const toast = useToast();
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    get('/student/dashboard')
      .then((d) => {
        setSemesters(d.data.semesters || []);
        const ownId = String(d.data.student.semester?._id || d.data.student.semester || '');
        const own = d.data.semesters?.find((s) => String(s._id) === ownId);
        setActive(own || (ownId ? { _id: ownId, title: 'My semester' } : null));
      })
      .catch((e) => setError(apiError(e).message))
      .finally(() => setLoading(false));
  }, []);

  const loadSemester = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try {
      const d = await get(`/student/semesters/${active._id}/exams`);
      setData(d.data);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    (async () => {
      await loadSemester();
    })();
  }, [loadSemester]);

  const start = (exam) => {
    setConfirm({
      title: `Start "${exam.title}"?`,
      message: `Duration: ${exam.durationMinutes} minutes · ${exam.questionCount} questions\nThe timer starts immediately.`,
      confirmLabel: 'Start now',
      onConfirm: async () => {
        setConfirm(null);
        try {
          const d = await post('/exam-attempts/start', { examId: exam._id });
          navigate(`/student/exam/${d.data.attempt._id}`);
        } catch (e) {
          toast.error(apiError(e).message);
          loadSemester();
        }
      },
    });
  };

  const resume = (exam) => {
    if (exam.inProgressAttemptId) navigate(`/student/exam/${exam.inProgressAttemptId}`);
    else start(exam);
  };

  if (!semesters.length && loading) return <Spinner full />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My exams</h1>
        <p className="text-sm text-slate-500">Papers for your semester</p>
      </div>

      {semesters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {semesters.map((s) => (
            <button
              key={s._id}
              className={`btn btn-sm ${active?._id === s._id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActive(s)}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {!data && loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSemester} />
      ) : !data ? (
        <EmptyState title="No semester assigned" message="Contact your administrator." />
      ) : !data.authorized ? (
        <EmptyState title="Not your semester" message="You can only attempt exams for your own semester." />
      ) : data.items.length === 0 ? (
        <EmptyState title="No exams published yet" message="New papers will appear here once published." />
      ) : (
        <div className="space-y-3">
          {data.items.map((e) => {
            const now = new Date();
            const state =
              e.status === 'completed' || now > new Date(e.endsAt)
                ? 'closed'
                : now < new Date(e.startsAt)
                  ? 'upcoming'
                  : 'open';
            return (
              <article key={e._id} className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge tone="blue">{e.subject?.name}</Badge>
                      <Badge tone={state === 'open' ? 'green' : state === 'upcoming' ? 'amber' : 'gray'}>{state}</Badge>
                      {e.hasInProgress && <Badge tone="amber">in progress</Badge>}
                      {e.myAttempts > 0 && <Badge tone="purple">{e.myAttempts}/{e.maxAttempts} attempts</Badge>}
                    </div>
                    <h3 className="font-semibold text-slate-800">{e.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {fmt(e.startsAt)} → {fmt(e.endsAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.questionCount} questions · {e.totalMarks} marks · {e.durationMinutes} min
                      {e.negativeMarking && ' · negative marking'}
                    </p>
                    {e.result && (
                      <p className="text-xs text-emerald-700 mt-1 font-semibold">
                        Score: {e.result.marksObtained}/{e.result.maxMarks} ({e.result.percentage?.toFixed(1)}%)
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {e.hasInProgress ? (
                      <button className="btn btn-primary btn-sm" onClick={() => resume(e)}>Resume</button>
                    ) : e.canAttempt ? (
                      <button className="btn btn-primary btn-sm" onClick={() => start(e)}>Start exam</button>
                    ) : (
                      <span className="text-xs text-slate-400 self-end">
                        {e.myAttempts >= e.maxAttempts ? 'Attempts used' : 'Not available'}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
      />
    </div>
  );
}
