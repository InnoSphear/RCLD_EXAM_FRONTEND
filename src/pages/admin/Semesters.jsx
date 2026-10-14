import { useEffect, useState, useCallback } from 'react';
import { get, post, patch, del } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Badge, Field, inputClass } from '../../components/ui';
import Modal, { ConfirmDialog } from '../../components/Modal';

export default function Semesters() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('semesters.manage');
  const canManageSubjects = hasPermission('subjects.manage');

  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [semModal, setSemModal] = useState(null); // null | {} | semester
  const [subModal, setSubModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, sub] = await Promise.all([get('/academics/semesters'), get('/academics/subjects')]);
      setSemesters(s.data.items);
      setSubjects(sub.data.items);
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

  const saveSem = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (form._id) {
        await patch(`/academics/semesters/${form._id}`, form);
        toast.success('Semester updated');
      } else {
        await post('/academics/semesters', form);
        toast.success('Semester created');
      }
      setSemModal(null);
      load();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const saveSub = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (form._id) {
        await patch(`/academics/subjects/${form._id}`, form);
        toast.success('Subject updated');
      } else {
        await post('/academics/subjects', form);
        toast.success('Subject created');
      }
      setSubModal(null);
      load();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (kind, obj) => {
    setConfirm({
      title: `Delete ${kind} "${obj.title || obj.name}"?`,
      message: kind === 'semester' ? 'Subjects under this semester will also be removed. Students and exams block deletion.' : 'This cannot be undone. Related exams/questions block deletion.',
      danger: true,
      onConfirm: async () => {
        try {
          await del(`/academics/${kind === 'semester' ? 'semesters' : 'subjects'}/${obj._id}`);
          toast.success(`${kind} deleted`);
          load();
        } catch (e) {
          const er = apiError(e);
          toast.error(er.details ? `${er.message} — ${JSON.stringify(er.details)}` : er.message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  if (loading) return <Spinner full />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Semesters & Subjects</h1>
          <p className="text-sm text-slate-500">Configurable academic structure used by students, questions and exams</p>
        </div>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ title: '', number: '', course: '', status: 'active' }); setSemModal({}); }}>
            + New semester
          </button>
        )}
      </div>

      <section>
        <h2 className="font-semibold text-slate-700 mb-3">Semesters</h2>
        {semesters.length === 0 ? (
          <EmptyState title="No semesters yet" message="Create your first semester to get started." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {semesters.map((s) => (
              <div key={s._id} className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500">Semester {s.number}{s.course ? ` · ${s.course}` : ''}</p>
                  </div>
                  <Badge tone={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  {subjects.filter((sub) => sub.semester?._id === s._id).length} subject(s)
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setForm({ ...s, number: String(s.number) }); setSemModal(s); }}
                    disabled={!canManage}
                  >
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-sm text-red-600" onClick={() => remove('semester', s)} disabled={!canManage}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Subjects</h2>
          {canManageSubjects && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setForm({ name: '', code: '', semester: semesters[0]?._id || '', status: 'active' }); setSubModal({}); }}
              disabled={!semesters.length}
            >
              + New subject
            </button>
          )}
        </div>
        {subjects.length === 0 ? (
          <EmptyState title="No subjects yet" message="Subjects belong to a semester." />
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Semester</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s._id}>
                      <td className="font-medium text-slate-700">{s.name}</td>
                      <td className="font-mono text-xs">{s.code || '—'}</td>
                      <td>{s.semester?.title}</td>
                      <td>
                        <Badge tone={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...s, semester: s.semester?._id }); setSubModal(s); }} disabled={!canManageSubjects}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-sm text-red-600" onClick={() => remove('subject', s)} disabled={!canManageSubjects}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <Modal open={!!semModal} onClose={() => setSemModal(null)} title={form._id ? 'Edit semester' : 'New semester'}>
        <form onSubmit={saveSem} className="space-y-4">
          <Field label="Title" required>
            <input className={inputClass} value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Semester 1" required />
          </Field>
          <Field label="Number" required>
            <input type="number" min="1" className={inputClass} value={form.number || ''} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} required />
          </Field>
          <Field label="Course / Program">
            <input className={inputClass} value={form.course || ''} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))} placeholder="BCA" />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status || 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setSemModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!subModal} onClose={() => setSubModal(null)} title={form._id ? 'Edit subject' : 'New subject'}>
        <form onSubmit={saveSub} className="space-y-4">
          <Field label="Name" required>
            <input className={inputClass} value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Mathematics" required />
          </Field>
          <Field label="Code">
            <input className={inputClass} value={form.code || ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="MATH101" />
          </Field>
          <Field label="Semester" required>
            <select className={inputClass} value={form.semester || ''} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} required>
              <option value="">Select…</option>
              {semesters.map((s) => (
                <option key={s._id} value={s._id}>{s.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status || 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setSubModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        danger
        confirmLabel="Delete"
      />
    </div>
  );
}
