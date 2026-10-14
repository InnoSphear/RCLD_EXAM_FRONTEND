import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, put, post } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorState, Badge } from '../../components/ui';
import { ConfirmDialog } from '../../components/Modal';

const fmtClock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};

export default function ExamPlayer() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [savingIds, setSavingIds] = useState(new Set());

  const submittedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get(`/exam-attempts/${attemptId}`);
      setData(d.data);
      setAnswers(d.data.attempt.answers || {});
      setRemaining(d.data.remainingMs);
      setCurrent(0);
      if (d.data.attempt.status !== 'in_progress') submittedRef.current = true;
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  // warn before closing/refreshing an in-progress attempt
  useEffect(() => {
    if (!data || data.attempt.status !== 'in_progress') return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [data]);

  const persist = async (questionId, patch) => {
    setSavingIds((s) => new Set(s).add(questionId));
    try {
      const d = await put(`/exam-attempts/${attemptId}/answers`, { questionId, ...patch });
      if (typeof d.data.remainingMs === 'number') setRemaining(d.data.remainingMs);
      setAnswers((a) => ({
        ...a,
        [questionId]: { ...(a[questionId] || {}), ...(patch.selected ? { selected: patch.selected } : {}), ...(patch.markedForReview !== undefined ? { markedForReview: patch.markedForReview } : {}), ...(patch.visited !== undefined ? { visited: patch.visited } : {}) },
      }));
    } catch (e) {
      const er = apiError(e);
      if (e?.response?.status === 410 || e?.response?.status === 409) {
        toast.error(er.message);
        submittedRef.current = true;
        load();
      } else {
        toast.error('Could not save answer — check your connection');
      }
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(questionId);
        return next;
      });
    }
  };

  const selectAnswer = (q, key) => {
    const prev = answers[q._id]?.selected || [];
    let next;
    if (q.type === 'msq') {
      next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    } else {
      next = prev[0] === key ? [] : [key];
    }
    setAnswers((a) => ({ ...a, [q._id]: { ...(a[q._id] || {}), selected: next, visited: true } }));
    persist(q._id, { selected: next, visited: true });
  };

  const toggleMark = (q) => {
    const marked = !answers[q._id]?.markedForReview;
    setAnswers((a) => ({ ...a, [q._id]: { ...(a[q._id] || {}), markedForReview: marked } }));
    persist(q._id, { markedForReview: marked, visited: true });
  };

  const doSubmit = async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    try {
      const d = await post(`/exam-attempts/${attemptId}/submit`);
      setSubmitted(d.data);
      setConfirmSubmit(false);
      if (auto) toast.success('Time is up — your attempt was submitted automatically');
    } catch (e) {
      submittedRef.current = false;
      toast.error(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const goTo = (i) => {
    setCurrent(i);
    const q = (data?.questions || [])[i];
    if (!q) return;
    if (!answers[q._id]?.visited) {
      setAnswers((a) => ({ ...a, [q._id]: { ...(a[q._id] || {}), visited: true } }));
      persist(q._id, { visited: true });
    }
  };

  // countdown + auto submit
  useEffect(() => {
    if (remaining === null || submittedRef.current) return undefined;
    const tick = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1000;
        if (next <= 0) {
          clearInterval(tick);
          doSubmit(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === null, submitted]);

  const confirmAndLeave = () => {
    setConfirmLeave(null);
    navigate('/student');
  };

  if (loading) return <Spinner full label="Loading your paper…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { attempt, exam, questions, showAnswers } = data;
  const finished = attempt.status !== 'in_progress' || submitted;

  // ---- submission outcome screen ----
  if (finished) {
    const result = submitted?.result;
    const pending = submitted?.resultPending || (!result && !submitted?.alreadySubmitted);
    return (
      <div className="max-w-xl mx-auto py-10 space-y-5 text-center">
        <div className="glass rounded-2xl p-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-700 grid place-items-center text-2xl">✓</div>
          <h1 className="text-xl font-bold text-slate-800">Attempt submitted</h1>
          <p className="text-sm text-slate-500 mt-1">{exam.title}</p>
          {result ? (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-3">
                <p className="text-lg font-bold text-brand-700">{result.marksObtained}/{result.maxMarks}</p>
                <p className="text-xs text-brand-700">Marks</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-lg font-bold text-slate-700">{result.percentage?.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">Score</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-lg font-bold text-slate-700">{result.correct}/{result.correct + result.incorrect + result.unanswered}</p>
                <p className="text-xs text-slate-500">Correct</p>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-800">
              {pending
                ? 'Your answers are recorded. The result will appear once it is released by your administrator.'
                : 'Your attempt is complete.'}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn btn-ghost" onClick={() => navigate('/student')}>Dashboard</button>
            <button className="btn btn-primary" onClick={() => navigate('/student/results')}>View results</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const selected = answers[q._id]?.selected || [];
  const answeredCount = questions.filter((x) => (answers[x._id]?.selected || []).length > 0).length;
  const markedCount = questions.filter((x) => answers[x._id]?.markedForReview).length;
  const urgent = remaining !== null && remaining <= 5 * 60 * 1000;
  const critical = remaining !== null && remaining <= 60 * 1000;

  const stateClass = (qq) => {
    const a = answers[qq._id] || {};
    if (qq._id === q._id) return 'ring-2 ring-brand-600';
    if ((a.selected || []).length) return 'bg-brand-600 text-white';
    if (a.markedForReview) return 'bg-amber-100 text-amber-800 border border-amber-300';
    if (a.visited) return 'bg-white text-slate-500 border border-slate-300';
    return 'bg-white/70 text-slate-500 border border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-30">
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-800 truncate">{exam.title}</h1>
          <p className="text-xs text-slate-500">
            {answeredCount}/{questions.length} answered · {markedCount} marked
            {savingIds.size > 0 && ' · saving…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl px-3 py-2 font-mono font-bold text-lg ${
              critical ? 'bg-red-100 text-red-700 animate-pulse' : urgent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
            }`}
            role="timer"
            aria-live="off"
          >
            {fmtClock(remaining ?? 0)}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave({})}>
            ← Leave
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setConfirmSubmit(true)}>
            Submit
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
        {/* question panel */}
        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">Q{current + 1} of {questions.length}</Badge>
            <Badge tone="purple">{q.marks} mark{q.marks !== 1 && 's'}</Badge>
            <Badge tone="gray">{q.type}</Badge>
            {q.topic && <Badge tone="gray">{q.topic}</Badge>}
            {showAnswers && q.correctAnswers?.length > 0 && (
              <Badge tone="green">correct: {q.correctAnswers.join(', ')}</Badge>
            )}
          </div>

          <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">{q.statement}</p>

          {q.type === 'descriptive' ? (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
              This question is evaluated manually by your instructor. No online answer is required.
            </div>
          ) : q.type === 'tf' || q.type === 'fill' || q.type === 'mcq' || q.type === 'msq' ? (
            <div className="space-y-2">
              {(q.options || []).map((o) => {
                const isOn = selected.includes(o.key);
                const correct = showAnswers && (q.correctAnswers || []).includes(o.key);
                return (
                  <label
                    key={o.key}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                      isOn ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white/70 hover:border-brand-300'
                    } ${correct ? 'ring-2 ring-emerald-400' : ''}`}
                  >
                    <input
                      type={q.type === 'msq' ? 'checkbox' : 'radio'}
                      name={`q-${q._id}`}
                      checked={isOn}
                      onChange={() => selectAnswer(q, o.key)}
                      className="mt-1"
                    />
                    <span className="text-slate-700">
                      <span className="font-bold mr-1">{o.key})</span>
                      {o.text}
                      {correct && <span className="ml-2 text-emerald-600 font-semibold">✓ correct</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {showAnswers && q.explanation && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              <p className="font-semibold text-xs uppercase tracking-wide mb-1">Explanation</p>
              {q.explanation}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-4">
            <button className="btn btn-ghost btn-sm" disabled={current === 0} onClick={() => goTo(current - 1)}>
              ← Previous
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!answers[q._id]?.markedForReview} onChange={() => toggleMark(q)} />
              Mark for review
            </label>
            <button
              className="btn btn-primary btn-sm"
              disabled={current === questions.length - 1}
              onClick={() => goTo(current + 1)}
            >
              Next →
            </button>
          </div>
        </section>

        {/* palette */}
        <aside className="glass rounded-2xl p-4 lg:sticky lg:top-24 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Question palette</p>
          <div className="grid grid-cols-6 lg:grid-cols-5 gap-2">
            {questions.map((qq, i) => (
              <button
                key={qq._id}
                onClick={() => goTo(i)}
                className={`h-9 rounded-lg text-sm font-semibold transition ${stateClass(qq)}`}
                aria-label={`Question ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <ul className="text-[11px] text-slate-500 space-y-1">
            <li><span className="inline-block h-3 w-3 rounded bg-brand-600 align-middle mr-1.5" /> Answered</li>
            <li><span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-300 align-middle mr-1.5" /> Marked for review</li>
            <li><span className="inline-block h-3 w-3 rounded bg-white border border-slate-300 align-middle mr-1.5" /> Visited, not answered</li>
            <li><span className="inline-block h-3 w-3 rounded bg-white/70 border border-slate-200 align-middle mr-1.5" /> Not visited</li>
          </ul>
          <button className="btn btn-primary w-full" onClick={() => setConfirmSubmit(true)}>
            Submit attempt
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => doSubmit(false)}
        title="Submit your attempt?"
        message={`Answered ${answeredCount} of ${questions.length} questions.\nYou cannot change answers after submitting.`}
        confirmLabel="Submit now"
        busy={busy}
      />

      <ConfirmDialog
        open={!!confirmLeave}
        onClose={() => setConfirmLeave(null)}
        onConfirm={confirmAndLeave}
        title="Leave the exam?"
        message="Your answers are saved continuously. You can resume while the exam window is still open."
        confirmLabel="Leave"
        danger
      />
    </div>
  );
}
