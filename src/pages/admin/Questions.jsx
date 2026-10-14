import { useEffect, useState, useCallback } from 'react';
import { get, post, patch, del } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge, Field, inputClass } from '../../components/ui';
import Modal, { ConfirmDialog } from '../../components/Modal';

const BLANK = {
  type: 'mcq',
  statement: '',
  options: [
    { key: 'a', text: '' },
    { key: 'b', text: '' },
    { key: 'c', text: '' },
    { key: 'd', text: '' },
  ],
  correctAnswers: [],
  explanation: '',
  marks: 1,
  negativeMarks: 0,
  semester: '',
  subject: '',
  topic: '',
  difficulty: 'medium',
  status: 'draft',
};

export default function Questions() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', semester: '', subject: '', status: '', type: '' });
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(new Set());
    try {
      const params = { page, limit, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const d = await get('/questions', params);
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

  useEffect(() => {
    get('/academics/semesters').then((d) => setSemesters(d.data.items)).catch(() => {});
    get('/academics/subjects').then((d) => setSubjects(d.data.items)).catch(() => {});
  }, []);

  const openCreate = () => {
    setForm({
      ...BLANK,
      options: BLANK.options.map((o) => ({ ...o })),
      correctAnswers: [],
      semester: filters.semester || '',
      subject: filters.subject || '',
    });
    setFormErrors({});
    setModal({});
  };

  const openEdit = (q) => {
    setForm({
      ...q,
      semester: q.semester?._id || '',
      subject: q.subject?._id || '',
      options: q.options?.length ? q.options : BLANK.options,
      correctAnswers: q.correctAnswers || [],
    });
    setFormErrors({});
    setModal(q);
  };

  const setOption = (i, key, val) => {
    setForm((f) => {
      const options = f.options.map((o, idx) => (idx === i ? { ...o, [key]: val } : o));
      return { ...f, options };
    });
  };

  const toggleCorrect = (key) => {
    setForm((f) => {
      const isMulti = f.type === 'msq';
      let next;
      if (isMulti) {
        next = f.correctAnswers.includes(key) ? f.correctAnswers.filter((k) => k !== key) : [...f.correctAnswers, key];
      } else {
        next = f.correctAnswers[0] === key ? [] : [key];
      }
      return { ...f, correctAnswers: next };
    });
  };

  const changeType = (e) => {
    const type = e.target.value;
    setForm((f) => {
      if (type === 'tf') {
        return { ...f, type, options: [{ key: 'true', text: 'True' }, { key: 'false', text: 'False' }], correctAnswers: [] };
      }
      if (type === 'fill' || type === 'descriptive') {
        return { ...f, type, options: [], correctAnswers: type === 'fill' ? f.correctAnswers : [] };
      }
      const looksLikeTf = f.options?.length === 2 && f.options.every((o) => o.key === 'true' || o.key === 'false');
      const options = !f.options || f.options.length < 2 || looksLikeTf
        ? BLANK.options.map((o) => ({ ...o }))
        : f.options;
      return { ...f, type, options, correctAnswers: [] };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormErrors({});
    try {
      const payload = { ...form };
      if (payload.type === 'tf') {
        payload.options = payload.options?.length === 2
          ? payload.options
          : [{ key: 'true', text: 'True' }, { key: 'false', text: 'False' }];
        payload.correctAnswers = (payload.correctAnswers || []).filter((c) => c === 'true' || c === 'false');
      } else if (payload.type === 'fill') {
        payload.options = [];
      } else if (payload.type === 'descriptive') {
        payload.options = [];
        payload.correctAnswers = [];
      }
      if (form._id) {
        await patch(`/questions/${form._id}`, payload);
        toast.success('Question updated');
      } else {
        await post('/questions', payload);
        toast.success('Question created');
      }
      setModal(null);
      load();
    } catch (err) {
      const er = apiError(err);
      setFormErrors(er.details || {});
      if (!er.details) toast.error(er.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (q) => {
    setConfirm({
      title: 'Delete this question?',
      message: q.statement.slice(0, 140),
      danger: true,
      onConfirm: async () => {
        try {
          await del(`/questions/${q._id}`);
          toast.success('Question deleted');
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const publish = async (q, status) => {
    try {
      await patch(`/questions/${q._id}`, { status });
      toast.success(`Question ${status}`);
      load();
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulkRemove = () => {
    const ids = [...selected];
    setConfirm({
      title: `Delete ${ids.length} question${ids.length > 1 ? 's' : ''}?`,
      message: 'Questions used in published or active exams will be skipped automatically.',
      danger: true,
      onConfirm: async () => {
        try {
          const d = await post('/questions/bulk-delete', { ids });
          const skipped = d.data.skipped ? ` (${d.data.skipped} skipped)` : '';
          toast.success(`Deleted ${d.data.deleted} question${d.data.deleted === 1 ? '' : 's'}${skipped}`);
          clearSelection();
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const filteredSubjects = subjects.filter((s) => !form.semester || s.semester?._id === form.semester);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Question bank</h1>
          <p className="text-sm text-slate-500">{total} questions</p>
        </div>
        {hasPermission('questions.create') && (
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            + New question
          </button>
        )}
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3">
        <input
          className="glass-input rounded-xl px-3.5 py-2 text-sm flex-1 min-w-[200px]"
          placeholder="Search statement or topic…"
          value={filters.search}
          onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
          aria-label="Search questions"
        />
        <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.semester} onChange={(e) => { setFilters((f) => ({ ...f, semester: e.target.value })); setPage(1); }}>
          <option value="">All semesters</option>
          {semesters.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
        </select>
        <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.subject} onChange={(e) => { setFilters((f) => ({ ...f, subject: e.target.value })); setPage(1); }}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
        </select>
        <select className="glass-input rounded-xl px-3 py-2 text-sm" value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}>
          <option value="">All types</option>
          <option value="mcq">MCQ</option>
          <option value="msq">Multiple select</option>
          <option value="tf">True/False</option>
          <option value="fill">Fill in the blank</option>
          <option value="descriptive">Descriptive</option>
        </select>
      </div>

      {hasPermission('questions.delete') && selected.size > 0 && (
        <div className="glass rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-600">{selected.size} question{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Clear</button>
            <button className="btn btn-danger btn-sm" onClick={bulkRemove}>Delete selected</button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No questions found"
          message="Create a question manually or import from a document."
          action={hasPermission('questions.import') ? <a className="btn btn-ghost" href="/admin/questions/import">Import documents</a> : null}
        />
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <article key={q._id} className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {hasPermission('questions.delete') && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={selected.has(q._id)}
                    onChange={() => toggleSelect(q._id)}
                    aria-label="Select question"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge tone="blue">{q.type}</Badge>
                    <Badge tone={q.status === 'published' ? 'green' : q.status === 'review' ? 'amber' : 'gray'}>{q.status}</Badge>
                    <Badge tone="purple">{q.marks} mark{q.marks !== 1 && 's'}</Badge>
                    <span className="text-xs text-slate-400">{q.semester?.title} · {q.subject?.name}</span>
                    {q.sourceFileName && <span className="text-xs text-slate-400">from {q.sourceFileName}</span>}
                  </div>
                  <p className="text-slate-700 font-medium whitespace-pre-wrap">{q.statement}</p>
                  <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-sm">
                    {q.options?.map((o) => (
                      <li key={o.key} className={`rounded-lg px-2.5 py-1.5 ${q.correctAnswers?.includes(o.key) ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'bg-white/60 text-slate-600'}`}>
                        <span className="font-bold mr-1">{o.key})</span> {o.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewing(q)}>Preview</button>
                  {hasPermission('questions.edit') && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)}>Edit</button>}
                  {q.status !== 'published' && hasPermission('questions.publish') && (
                    <button className="btn btn-success btn-sm" onClick={() => publish(q, 'published')}>Publish</button>
                  )}
                  {q.status === 'published' && hasPermission('questions.publish') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => publish(q, 'draft')}>Unpublish</button>
                  )}
                  {hasPermission('questions.delete') && <button className="btn btn-ghost btn-sm text-red-600" onClick={() => remove(q)}>Delete</button>}
                </div>
              </div>
            </article>
          ))}
          <Pagination page={page} limit={limit} total={total} onChange={setPage} />
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={form._id ? 'Edit question' : 'New question'} width="max-w-3xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type" required>
              <select className={inputClass} value={form.type} onChange={changeType}>
                <option value="mcq">Single-correct MCQ</option>
                <option value="msq">Multiple-select</option>
                <option value="tf">True / False</option>
                <option value="fill">Fill in the blank</option>
                <option value="descriptive">Descriptive (manual evaluation)</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={setF('status')} disabled={form.status === 'published' && !hasPermission('questions.publish')}>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                {hasPermission('questions.publish') && <option value="published">Published</option>}
              </select>
            </Field>
          </div>

          <Field label="Question statement" required error={formErrors.statement}>
            <textarea className={`${inputClass} min-h-[90px]`} value={form.statement} onChange={setF('statement')} required />
          </Field>

          {form.type !== 'descriptive' && form.type !== 'fill' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Options <span className="text-xs font-normal text-slate-400">({form.type === 'msq' ? 'select all correct' : 'select the correct one'})</span>
              </p>
              {form.type === 'tf' ? (
                <div className="flex gap-2">
                  {['true', 'false'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleCorrect(k)}
                      className={`btn ${form.correctAnswers[0] === k ? 'btn-success' : 'btn-ghost'} flex-1 capitalize`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {form.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="glass-input w-12 text-center rounded-lg px-2 py-2 text-sm font-bold"
                        value={o.key}
                        onChange={(e) => setOption(i, 'key', e.target.value.toLowerCase())}
                        maxLength={4}
                        aria-label={`Option ${i + 1} key`}
                      />
                      <input
                        className="glass-input flex-1 rounded-lg px-3 py-2 text-sm"
                        placeholder={`Option ${i + 1}`}
                        value={o.text}
                        onChange={(e) => setOption(i, 'text', e.target.value)}
                        aria-label={`Option ${i + 1} text`}
                      />
                      <input
                        type={form.type === 'msq' ? 'checkbox' : 'radio'}
                        name="correct"
                        checked={form.correctAnswers.includes(o.key)}
                        onChange={() => toggleCorrect(o.key)}
                        aria-label={`Mark option ${o.key} correct`}
                        className="h-4 w-4"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !px-2"
                        onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))}
                        aria-label="Remove option"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {form.options.length < 6 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          options: [...f.options, { key: String.fromCharCode(97 + f.options.length), text: '' }],
                        }))
                      }
                    >
                      + Add option
                    </button>
                  )}
                </div>
              )}
              {formErrors.options && <p className="text-xs text-red-600">{formErrors.options}</p>}
              {formErrors.correctAnswers && <p className="text-xs text-red-600">{formErrors.correctAnswers}</p>}
            </div>
          )}

          {(form.type === 'fill' || form.type === 'descriptive') && (
            <Field label={form.type === 'fill' ? 'Correct answer(s)' : 'Model answer (optional, for evaluators)'} required={form.type === 'fill'} error={formErrors.correctAnswers}>
              <input
                className={inputClass}
                value={(form.correctAnswers || []).join(', ')}
                onChange={(e) => setForm((f) => ({ ...f, correctAnswers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                placeholder={form.type === 'fill' ? 'comma separated accepted answers' : ''}
              />
            </Field>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Semester">
              <select className={inputClass} value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value, subject: '' }))}>
                <option value="">Unassigned</option>
                {semesters.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select className={inputClass} value={form.subject} onChange={setF('subject')}>
                <option value="">Unassigned</option>
                {filteredSubjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Topic">
              <input className={inputClass} value={form.topic} onChange={setF('topic')} />
            </Field>
            <Field label="Difficulty">
              <select className={inputClass} value={form.difficulty} onChange={setF('difficulty')}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
            <Field label="Marks">
              <input type="number" min="0" step="0.5" className={inputClass} value={form.marks} onChange={setF('marks')} />
            </Field>
            <Field label="Negative marks">
              <input type="number" min="0" step="0.5" className={inputClass} value={form.negativeMarks} onChange={setF('negativeMarks')} />
            </Field>
          </div>

          <Field label="Explanation / solution">
            <textarea className={`${inputClass} min-h-[60px]`} value={form.explanation} onChange={setF('explanation')} />
          </Field>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form._id ? 'Save changes' : 'Create question'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Question preview" width="max-w-xl">
        {viewing && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Badge tone="blue">{viewing.type}</Badge>
              <Badge tone="purple">{viewing.marks} marks</Badge>
              {viewing.topic && <Badge tone="gray">{viewing.topic}</Badge>}
            </div>
            <p className="text-slate-700 whitespace-pre-wrap font-medium">{viewing.statement}</p>
            <ul className="space-y-1.5 text-sm">
              {viewing.options?.map((o) => (
                <li key={o.key} className={`rounded-lg px-3 py-2 ${viewing.correctAnswers?.includes(o.key) ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'bg-white/70 text-slate-600'}`}>
                  {o.key}) {o.text} {viewing.correctAnswers?.includes(o.key) && '✓'}
                </li>
              ))}
            </ul>
            {viewing.explanation && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                <p className="font-semibold text-xs uppercase tracking-wide mb-1">Explanation</p>
                {viewing.explanation}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} title={confirm?.title} message={confirm?.message} danger confirmLabel="Delete" />
    </div>
  );
}
