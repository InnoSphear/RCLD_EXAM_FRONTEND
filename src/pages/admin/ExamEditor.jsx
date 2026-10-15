import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { get, post, put } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorState, Badge, Field, inputClass } from '../../components/ui';

const EMPTY = {
  title: '',
  description: '',
  instructions: '',
  semester: '',
  subject: '',
  course: '',
  durationMinutes: 60,
  startsAt: '',
  endsAt: '',
  maxAttempts: 1,
  negativeMarking: false,
  shuffleQuestions: false,
  shuffleOptions: false,
  resultRelease: 'immediate',
  allowMultipleAttempts: false,
};

const toLocalInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

// datetime-local has no timezone; convert the user's local wall-clock time to an
// absolute ISO instant so the server stores/compares the correct moment in time.
const toIso = (v) => (v ? new Date(v).toISOString() : v);

export default function ExamEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exam, setExam] = useState(null);

  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [selected, setSelected] = useState([]); // [{ question, marks }]
  const [pool, setPool] = useState([]);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolPage, setPoolPage] = useState(1);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    get('/academics/semesters').then((d) => setSemesters(d.data.items)).catch(() => {});
    get('/academics/subjects').then((d) => setSubjects(d.data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await get(`/exams/${id}`);
        if (!alive) return;
        const e = d.data.exam;
        setExam(e);
        setForm({
          ...EMPTY,
          ...e,
          semester: e.semester?._id || e.semester || '',
          subject: e.subject?._id || e.subject || '',
          startsAt: toLocalInput(e.startsAt),
          endsAt: toLocalInput(e.endsAt),
        });
        setSelected((e.questions || []).map((q) => ({ question: q.question?._id || q.question, marks: q.marks, ref: q.question })));
      } catch (err) {
        if (alive) setError(apiError(err).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const params = { page: poolPage, limit: 50 };
      if (form.semester) params.semester = form.semester;
      if (form.subject) params.subject = form.subject;
      if (poolSearch) params.search = poolSearch;
      const d = await get('/exams/preview-questions', params);
      setPool(d.data.items);
      setPoolTotal(d.data.total);
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setPoolLoading(false);
    }
  }, [form.semester, form.subject, poolPage, poolSearch, toast]);

  useEffect(() => {
    (async () => {
      await loadPool();
    })();
  }, [loadPool]);

  const setF = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const isSel = (qid) => selected.some((s) => String(s.question) === String(qid));

  const toggle = (q) => {
    setSelected((sel) =>
      sel.some((s) => String(s.question) === String(q._id))
        ? sel.filter((s) => String(s.question) !== String(q._id))
        : [...sel, { question: q._id, marks: q.marks ?? 1, ref: q }]
    );
  };

  const setMarks = (qid, marks) => {
    setSelected((sel) => sel.map((s) => (String(s.question) === String(qid) ? { ...s, marks: Number(marks) } : s)));
  };

  const totalMarks = selected.reduce((sum, s) => sum + (Number(s.marks) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const payload = {
      ...form,
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt),
      questions: selected.map((s, i) => ({ question: s.question, marks: s.marks, order: i })),
    };
    try {
      if (id) {
        try {
          await put(`/exams/${id}`, payload);
        } catch (err) {
          const er = apiError(err);
          if (err?.response?.status === 409 && er.details && ('activeAttempts' in er.details || 'submitted' in er.details)) {
            const rest = { ...payload };
            delete rest.questions;
            await put(`/exams/${id}`, rest);
            toast.success('Exam updated (questions locked because attempts exist)');
            navigate('/admin/exams');
            return;
          }
          throw err;
        }
        toast.success('Examination updated');
      } else {
        await post('/exams', payload);
        toast.success('Examination created as draft');
      }
      navigate('/admin/exams');
    } catch (err) {
      const er = apiError(err);
      setErrors(er.details || {});
      if (!er.details) toast.error(er.message);
      else toast.error(er.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner full />;
  if (error) return <ErrorState message={error} onRetry={() => navigate(0)} />;

  const filteredSubjects = subjects.filter((s) => !form.semester || s.semester?._id === form.semester);
  const locked = exam && ['completed', 'cancelled'].includes(exam.status);
  const questionsLocked = exam && exam.attemptsExist;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{id ? 'Edit examination' : 'New examination'}</h1>
          <p className="text-sm text-slate-500">
            {id ? exam?.title : 'Draft — publish it when you are ready'}
          </p>
        </div>
        <Link to="/admin/exams" className="btn btn-ghost btn-sm">← Back to exams</Link>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <section className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Details</h2>
          <Field label="Title" required error={errors.title}>
            <input className={inputClass} value={form.title} onChange={setF('title')} required disabled={locked} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Semester" required error={errors.semester}>
              <select className={inputClass} value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value, subject: '' }))} disabled={locked}>
                <option value="">Select…</option>
                {semesters.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
              </select>
            </Field>
            <Field label="Subject" required error={errors.subject}>
              <select className={inputClass} value={form.subject} onChange={setF('subject')} disabled={locked}>
                <option value="">Select…</option>
                {filteredSubjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea className={`${inputClass} min-h-[60px]`} value={form.description} onChange={setF('description')} disabled={locked} />
          </Field>
          <Field label="Instructions shown to students">
            <textarea className={`${inputClass} min-h-[60px]`} value={form.instructions} onChange={setF('instructions')} disabled={locked} />
          </Field>
        </section>

        <section className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Schedule & rules</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Starts at" required error={errors.startsAt}>
              <input type="datetime-local" className={inputClass} value={form.startsAt} onChange={setF('startsAt')} disabled={locked} />
            </Field>
            <Field label="Ends at" required error={errors.endsAt}>
              <input type="datetime-local" className={inputClass} value={form.endsAt} onChange={setF('endsAt')} disabled={locked} />
            </Field>
            <Field label="Duration (minutes)" required error={errors.durationMinutes}>
              <input type="number" min="1" className={inputClass} value={form.durationMinutes} onChange={setF('durationMinutes')} disabled={locked} />
            </Field>
            <Field label="Max attempts" error={errors.maxAttempts}>
              <input type="number" min="1" className={inputClass} value={form.maxAttempts} onChange={setF('maxAttempts')} disabled={locked} />
            </Field>
            <Field label="Result release">
              <select className={inputClass} value={form.resultRelease} onChange={setF('resultRelease')} disabled={locked}>
                <option value="immediate">Immediate</option>
                <option value="after_deadline">After deadline</option>
                <option value="manual">Manual release</option>
              </select>
            </Field>
            <Field label="Course (optional)">
              <input className={inputClass} value={form.course || ''} onChange={setF('course')} disabled={locked} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              ['negativeMarking', 'Negative marking'],
              ['shuffleQuestions', 'Shuffle questions'],
              ['shuffleOptions', 'Shuffle options'],
              ['allowMultipleAttempts', 'Allow multiple attempts'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form[key]} onChange={setF(key)} disabled={locked} />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-700">
              Questions <span className="text-sm font-normal text-slate-500">({selected.length} selected · {totalMarks} marks)</span>
            </h2>
            <span className="text-xs text-red-600">{errors.questions}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              className="glass-input rounded-xl px-3.5 py-2 text-sm flex-1 min-w-[200px]"
              placeholder="Search published questions…"
              value={poolSearch}
              onChange={(e) => { setPoolSearch(e.target.value); setPoolPage(1); }}
              aria-label="Search questions"
            />
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white/60 max-h-72 overflow-y-auto divide-y divide-slate-100">
            {poolLoading ? (
              <Spinner label="Loading questions…" />
            ) : pool.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No published questions match this filter.</p>
            ) : (
              pool.map((q) => (
                <label key={q._id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-brand-50/40">
                  <input type="checkbox" checked={isSel(q._id)} onChange={() => toggle(q)} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-700 font-medium">{q.statement}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="blue">{q.type}</Badge>
                      <Badge tone="purple">{q.marks}m</Badge>
                      {q.topic && <Badge tone="gray">{q.topic}</Badge>}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          {poolTotal > 50 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Page {poolPage} · {poolTotal} published questions</span>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" disabled={poolPage <= 1} onClick={() => setPoolPage((p) => p - 1)}>← Prev</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={poolPage * 50 >= poolTotal} onClick={() => setPoolPage((p) => p + 1)}>Next →</button>
              </div>
            </div>
          )}

          {selected.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Selected questions</p>
              {selected.map((s) => (
                <div key={String(s.question)} className="flex items-center gap-3 rounded-xl bg-white/70 border border-slate-200/70 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm text-slate-700 truncate">
                    {s.ref?.statement || 'Question'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="glass-input w-20 rounded-lg px-2 py-1.5 text-sm text-right"
                    value={s.marks}
                    onChange={(e) => setMarks(s.question, e.target.value)}
                    aria-label="Marks"
                    disabled={!!questionsLocked}
                  />
                  <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => toggle({ _id: s.question })} disabled={!!questionsLocked} aria-label="Remove">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Link to="/admin/exams" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy || locked}>
            {busy ? 'Saving…' : id ? 'Save changes' : 'Create examination'}
          </button>
        </div>
      </form>
    </div>
  );
}
