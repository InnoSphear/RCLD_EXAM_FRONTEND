import { useEffect, useState, useCallback, useRef } from 'react';
import { get, post, put, del, upload } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge, Field, inputClass } from '../../components/ui';
import Modal, { ConfirmDialog } from '../../components/Modal';

const ISSUE_LABELS = {
  duplicate_in_bank: 'Already exists in question bank',
  duplicate: 'Duplicate within this document',
  duplicate_option_keys: 'Duplicate option labels',
  missing_answer: 'No correct answer',
  answer_letter_not_in_options: 'Answer letter does not match an option',
  answer_letter_mismatch: 'Answer letter does not match an option',
  answer_text_mismatch: 'Answer text does not match an option',
  answer_letter_text_conflict: 'Answer letter and text disagree',
  answer_not_matching_options: 'Answer does not match any option',
  no_options: 'No options detected',
  too_few_options: 'Fewer than 2 options',
  empty_statement: 'Empty statement',
};

export default function QuestionImport() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const fileRef = useRef(null);

  const [batch, setBatch] = useState(null);
  const [warning, setWarning] = useState('');
  const [batches, setBatches] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [publish, setPublish] = useState(false);
  const [report, setReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteQuestions, setDeleteQuestions] = useState(false);
  const [useAI, setUseAI] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get('/questions/imports', { page, limit: 10 });
      setBatches(d.data.items);
      setTotal(d.data.total);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    (async () => {
      await loadBatches();
    })();
  }, [loadBatches]);

  useEffect(() => {
    get('/academics/semesters').then((d) => setSemesters(d.data.items)).catch(() => {});
    get('/academics/subjects').then((d) => setSubjects(d.data.items)).catch(() => {});
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(pdf|docx|doc|txt)$/i.test(file.name)) {
      toast.error('Only PDF, DOCX, DOC and TXT files are supported');
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      const d = await upload('/questions/imports/upload', file, 'file', useAI ? { useAI: 'true' } : {});
      setBatch(d.data.batch);
      setWarning(d.data.warning || '');
      toast.success(`Parsed ${d.data.batch.stats.total} question(s)`);
      loadBatches();
    } catch (err) {
      const er = apiError(err);
      toast.error(er.message);
      if (er.details?.batchId) loadBatches();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openBatch = async (id) => {
    setBusy(true);
    try {
      const d = await get(`/questions/imports/${id}`);
      setBatch(d.data.batch);
      setWarning('');
      setReport(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const saveBatch = async (questions, extra = {}) => {
    try {
      const d = await put(`/questions/imports/${batch._id}`, { questions, ...extra });
      setBatch(d.data.batch);
      return d.data.batch;
    } catch (e) {
      toast.error(apiError(e).message);
      return null;
    }
  };

  const saveMeta = async (fields) => {
    setBusy(true);
    const b = await saveBatch(undefined, fields);
    setBusy(false);
    if (b) toast.success('Assignment saved');
  };

  const editQuestion = (i) => {
    setEditIdx(i);
    setForm(JSON.parse(JSON.stringify(batch.questions[i])));
  };

  const saveQuestion = async () => {
    const questions = batch.questions.map((q, i) => (i === editIdx ? form : q));
    const b = await saveBatch(questions);
    if (b) {
      setEditIdx(null);
      toast.success('Question updated');
    }
  };

  const excludeQuestion = (i) => {
    const q = batch.questions[i];
    setConfirm({
      title: 'Exclude this question?',
      message: q.statement.slice(0, 140),
      danger: true,
      onConfirm: async () => {
        const questions = batch.questions.filter((_, idx) => idx !== i);
        const b = await saveBatch(questions);
        setConfirm(null);
        if (b) toast.success('Question excluded from this import');
      },
    });
  };

  const deleteQuestionAt = (i) => {
    const q = batch.questions[i];
    setConfirm({
      title: 'Delete this extracted question?',
      message: q.statement.slice(0, 140),
      danger: true,
      onConfirm: async () => {
        try {
          const d = await del(`/questions/imports/${batch._id}/questions/${i}`);
          setBatch(d.data.batch);
          toast.success('Question removed from this import');
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const confirmImport = () => {
    setConfirm({
      title: `Import ${batch.stats.valid} valid question(s)?`,
      message: `Duplicates and rows without answers are skipped automatically. ${batch.stats.needsReview} question(s) still need review.\n\nImport as: ${publish ? 'published' : 'draft'} status.`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(true);
        try {
          const d = await post(`/questions/imports/${batch._id}/confirm`, { publish });
          setReport(d.data);
          setBatch(null);
          loadBatches();
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const removeBatch = (b) => {
    setDeleteQuestions(false);
    setDeleteTarget(b);
  };

  const confirmDeleteBatch = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const d = await del(`/questions/imports/${deleteTarget._id}${deleteQuestions ? '?deleteQuestions=true' : ''}`);
      const removed = d?.data?.deletedQuestions || 0;
      toast.success(`Batch deleted${removed ? ` (${removed} question(s) removed)` : ''}`);
      if (batch?._id === deleteTarget._id) setBatch(null);
      setDeleteTarget(null);
      loadBatches();
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const batchSemester = batch?.semester?._id || batch?.semester || '';
  const filteredSubjects = subjects.filter((s) => !batchSemester || s.semester?._id === batchSemester);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Import questions</h1>
          <p className="text-sm text-slate-500">Upload a PDF, DOCX, DOC or TXT question paper — questions are parsed, reviewed, then imported</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="btn btn-primary btn-sm cursor-pointer">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="sr-only" onChange={onFile} disabled={busy} />
            {busy ? 'Parsing…' : '⇪ Upload document'}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} disabled={busy} />
            Use AI-assisted parsing (Groq) — answers are marked and still require review
          </label>
        </div>
      </div>

      {report && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-700">Import complete</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-2xl font-bold text-emerald-700">{report.imported}</p>
              <p className="text-xs text-emerald-700">Imported</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-2xl font-bold text-amber-700">{report.skipped}</p>
              <p className="text-xs text-amber-700">Skipped</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-2xl font-bold text-red-700">{report.failed}</p>
              <p className="text-xs text-red-700">Failed</p>
            </div>
          </div>
          {report.failures?.length > 0 && (
            <ul className="text-xs text-red-600 space-y-1">
              {report.failures.slice(0, 8).map((f, i) => (
                <li key={i}>#{f.sourceOrder}: {f.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {batch && (
        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">{batch.fileName}</p>
              <p className="text-xs text-slate-500 capitalize">Status: {batch.status}</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setBatch(null)}>Close</button>
          </div>

          {warning && <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">{warning}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[
              ['Total', batch.stats.total, 'text-slate-800'],
              ['Valid', batch.stats.valid, 'text-emerald-600'],
              ['Need review', batch.stats.needsReview, 'text-amber-600'],
              ['Missing answer', batch.stats.missingAnswer, 'text-red-600'],
              ['Duplicates', batch.stats.duplicates, 'text-violet-600'],
            ].map(([label, value, cls]) => (
              <div key={label} className="rounded-xl bg-white/70 border border-slate-200/70 p-3">
                <p className={`text-lg font-bold ${cls}`}>{value}</p>
                <p className="text-[11px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Semester">
              <select className={inputClass} value={batch.semester?._id || batch.semester || ''} onChange={(e) => saveMeta({ semester: e.target.value })} disabled={batch.status === 'imported'}>
                <option value="">Not assigned</option>
                {semesters.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select className={inputClass} value={batch.subject?._id || batch.subject || ''} onChange={(e) => saveMeta({ subject: e.target.value })} disabled={batch.status === 'imported'}>
                <option value="">Not assigned</option>
                {filteredSubjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="space-y-3">
            {batch.questions.map((q, i) => (
              <article key={i} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge tone="blue">{q.type}</Badge>
                  <Badge tone="purple">{q.marks} mark{q.marks !== 1 && 's'}</Badge>
                  {q.ai && <Badge tone="violet">AI answer — review</Badge>}
                  {q.issues?.map((iss) => (
                    <Badge key={iss} tone="amber">{ISSUE_LABELS[iss] || iss}</Badge>
                  ))}
                  {!q.issues?.length && <Badge tone="green">ready</Badge>}
                </div>
                <p className="text-slate-700 font-medium">{q.statement || <span className="text-red-500 italic">Empty statement</span>}</p>
                <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-sm">
                  {q.options?.map((o) => (
                    <li key={o.key} className={`rounded-lg px-2.5 py-1.5 ${q.correctAnswers?.includes(o.key) ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'bg-slate-50 text-slate-600'}`}>
                      {o.key}) {o.text}
                    </li>
                  ))}
                </ul>
                {batch.status !== 'imported' && (
                  <div className="flex gap-2 mt-3">
                    <button className="btn btn-ghost btn-sm" onClick={() => editQuestion(i)}>Edit</button>
                    <button className="btn btn-ghost btn-sm text-amber-600" onClick={() => excludeQuestion(i)}>Exclude</button>
                    <button className="btn btn-ghost btn-sm text-red-600" onClick={() => deleteQuestionAt(i)}>Delete</button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {batch.status !== 'imported' && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4">
              {hasPermission('questions.publish') ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                  Publish immediately (otherwise imported as draft)
                </label>
              ) : (
                <p className="text-sm text-slate-500">Imported as drafts — publish them later from the question bank.</p>
              )}
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => setBatch(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmImport} disabled={busy || batch.stats.valid === 0}>
                  {busy ? 'Importing…' : `Import ${batch.stats.valid} question(s)`}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="font-semibold text-slate-700 mb-3">Import history</h2>
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={loadBatches} />
        ) : batches.length === 0 ? (
          <EmptyState title="No imports yet" message="Upload a PDF, DOCX, DOC or TXT question paper to begin." />
        ) : (
          <>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Imported</th>
                      <th>Uploaded</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b._id}>
                        <td className="font-medium text-slate-700">{b.fileName}</td>
                        <td>
                          <Badge tone={b.status === 'imported' ? 'green' : b.status === 'failed' ? 'red' : 'amber'}>{b.status}</Badge>
                        </td>
                        <td>{b.stats?.total ?? '—'}</td>
                        <td>{b.stats?.imported ?? '—'}</td>
                        <td className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button className="btn btn-ghost btn-sm" onClick={() => openBatch(b._id)}>
                              {b.status === 'imported' ? 'View' : 'Review'}
                            </button>
                            <button className="btn btn-ghost btn-sm text-red-600" onClick={() => removeBatch(b)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} limit={10} total={total} onChange={setPage} />
          </>
        )}
      </section>

      <Modal open={editIdx !== null} onClose={() => setEditIdx(null)} title="Edit question" width="max-w-2xl">
        {form && (
          <div className="space-y-4">
            <Field label="Statement" required>
              <textarea className={`${inputClass} min-h-[80px]`} value={form.statement} onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))} />
            </Field>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Options</p>
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="glass-input w-12 text-center rounded-lg px-2 py-2 text-sm font-bold"
                    value={o.key}
                    maxLength={4}
                    aria-label="Option key"
                    onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, idx) => (idx === i ? { ...x, key: e.target.value.toLowerCase() } : x)) }))}
                  />
                  <input
                    className="glass-input flex-1 rounded-lg px-3 py-2 text-sm"
                    value={o.text}
                    aria-label="Option text"
                    onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)) }))}
                  />
                  <input
                    type={form.type === 'msq' ? 'checkbox' : 'radio'}
                    name="q-correct"
                    checked={form.correctAnswers.includes(o.key)}
                    aria-label="Mark correct"
                    className="h-4 w-4"
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        correctAnswers: f.type === 'msq'
                          ? f.correctAnswers.includes(o.key) ? f.correctAnswers.filter((k) => k !== o.key) : [...f.correctAnswers, o.key]
                          : [o.key],
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Correct answer keys" hint="comma separated, e.g. b">
                <input
                  className={inputClass}
                  value={(form.correctAnswers || []).join(', ')}
                  onChange={(e) => setForm((f) => ({ ...f, correctAnswers: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) }))}
                />
              </Field>
              <Field label="Marks">
                <input type="number" min="0" step="0.5" className={inputClass} value={form.marks} onChange={(e) => setForm((f) => ({ ...f, marks: Number(e.target.value) }))} />
              </Field>
            </div>
            <Field label="Explanation">
              <textarea className={`${inputClass} min-h-[60px]`} value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setEditIdx(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveQuestion}>Save question</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete import batch?" width="max-w-md">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{deleteTarget.fileName}</span> will be removed from the import history.
            </p>
            {(deleteTarget.stats?.imported || 0) > 0 && (
              <label className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={deleteQuestions}
                  onChange={(e) => setDeleteQuestions(e.target.checked)}
                />
                <span>
                  Also delete the {deleteTarget.stats.imported} question(s) previously imported from this batch.
                  Questions already used in published or active exams are kept safely.
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteBatch} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete batch'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} confirmLabel="Confirm" busy={busy} />
    </div>
  );
}
