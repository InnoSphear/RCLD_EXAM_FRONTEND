import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorState, EmptyState, Badge, StatCard } from '../../components/ui';
import { ConfirmDialog } from '../../components/Modal';

const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function ExamCard({ exam, showStart, onStart }) {
  return (
    <article className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge tone="blue">{exam.subject?.name}</Badge>
            {exam.hasInProgress && <Badge tone="amber">in progress</Badge>}
          </div>
          <h3 className="font-semibold text-slate-800">{exam.title}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {fmt(exam.startsAt)} → {fmt(exam.endsAt)}
          </p>
          <p className="text-xs text-slate-500">
            {exam.questionCount} questions · {exam.totalMarks} marks · {exam.durationMinutes} min
          </p>
        </div>
        {showStart && (
          <button className="btn btn-primary btn-sm shrink-0" onClick={() => onStart(exam)}>
            {exam.hasInProgress ? 'Resume' : 'Start'}
          </button>
        )}
      </div>
    </article>
  );
}

export default function StudentDashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get('/student/dashboard');
      setData(d.data);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const startExam = (exam) => {
    setConfirm({
      title: `Start "${exam.title}"?`,
      message: `Duration: ${exam.durationMinutes} minutes · ${exam.questionCount} questions · ${exam.totalMarks} marks\nThe timer begins immediately once you start.`,
      confirmLabel: 'Start now',
      onConfirm: async () => {
        setConfirm(null);
        try {
          const d = await post('/exam-attempts/start', { examId: exam._id });
          navigate(`/student/exam/${d.data.attempt._id}`);
        } catch (e) {
          const er = apiError(e);
          toast.error(er.message);
        }
      },
    });
  };

  if (loading) return <Spinner full />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const resume = (exam) => {
    const inProgress = data.recentAttempts.find((a) => String(a.exam) === String(exam._id) && a.status === 'in_progress');
    if (inProgress) navigate(`/student/exam/${inProgress._id}`);
    else startExam(exam);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {data.student.name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500">{data.student.studentId} · {data.student.semester?.title || 'Semester not assigned'}</p>
        </div>
        <span className="text-xs text-slate-400">Server time: {new Date(data.serverTime).toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Available now" value={data.available.length} icon="▶" />
        <StatCard label="Upcoming" value={data.upcoming.length} tone="purple" icon="◷" />
        <StatCard label="Completed" value={data.completed.length} tone="amber" icon="✓" />
        <StatCard label="Released results" value={data.releasedResults.length} tone="green" icon="★" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Available now</h2>
          <Link to="/student/exams" className="btn btn-ghost btn-sm">All exams →</Link>
        </div>
        {data.available.length === 0 ? (
          <EmptyState title="No exams available right now" message="Check the My Exams page for upcoming papers." />
        ) : (
          data.available.map((e) => <ExamCard key={e._id} exam={e} showStart onStart={resume} />)
        )}
      </section>

      {data.upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-700">Upcoming</h2>
          {data.upcoming.map((e) => (
            <article key={e._id} className="glass rounded-2xl p-4">
              <h3 className="font-semibold text-slate-800">{e.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {e.subject?.name} · starts {fmt(e.startsAt)}
              </p>
            </article>
          ))}
        </section>
      )}

      {data.completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-700">Completed</h2>
          {data.completed.slice(0, 5).map((e) => (
            <article key={e._id} className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800">{e.title}</h3>
                <p className="text-xs text-slate-500">{e.subject?.name} · ended {fmt(e.endsAt)}</p>
              </div>
              {e.result ? (
                <Link to="/student/results" className="btn btn-ghost btn-sm">
                  Result: {e.result.marksObtained}/{e.result.maxMarks}
                </Link>
              ) : (
                <Badge tone="gray">awaiting result</Badge>
              )}
            </article>
          ))}
        </section>
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
