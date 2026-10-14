import { useEffect, useState, useCallback } from 'react';
import { get, post, patch, del } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Badge, Field, inputClass } from '../../components/ui';
import Modal, { ConfirmDialog } from '../../components/Modal';

const EMPTY = { name: '', email: '', phone: '', password: '', role: 'subadmin', permissions: [] };

const GROUPS = [
  { label: 'Dashboard & Academics', keys: ['dashboard.view', 'semesters.manage', 'subjects.manage'] },
  { label: 'Students', keys: ['students.view', 'students.register', 'students.edit', 'students.import', 'students.export'] },
  { label: 'Questions', keys: ['questions.view', 'questions.create', 'questions.edit', 'questions.delete', 'questions.import', 'questions.publish'] },
  { label: 'Exams', keys: ['exams.view', 'exams.create', 'exams.schedule', 'exams.publish', 'exams.monitor'] },
  { label: 'Results', keys: ['results.view', 'results.grade', 'results.export'] },
  { label: 'System', keys: ['subadmins.manage', 'audit.view'] },
];

export default function Staff() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get('/users/staff');
      setItems(d.data.items);
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

  useEffect(() => {
    get('/users/permissions/catalog')
      .then((d) => setCatalog(d.data.permissions))
      .catch(() => setCatalog([]));
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY, role: me.role === 'superadmin' ? 'admin' : 'subadmin' });
    setFormErrors({});
    setModal({});
  };

  const openEdit = (u) => {
    setForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      password: '',
      role: u.role,
      permissions: u.permissions || [],
      status: u.status || 'active',
      _id: u._id,
    });
    setFormErrors({});
    setModal(u);
  };

  const togglePerm = (p) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormErrors({});
    try {
      if (form._id) {
        const payload = { name: form.name, email: form.email, phone: form.phone, status: form.status };
        if (form.role === 'subadmin') payload.permissions = form.permissions;
        if (form.password) payload.password = form.password;
        if (me.role === 'superadmin') payload.role = form.role;
        await patch(`/users/${form._id}`, payload);
        toast.success('Account updated');
      } else {
        await post('/users', form);
        toast.success('Account created — they must change password on first login');
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

  const remove = (u) => {
    setConfirm({
      title: `Delete ${u.email}?`,
      message: 'This removes the account permanently. Their audit history is kept.',
      danger: true,
      onConfirm: async () => {
        try {
          await del(`/users/${u._id}`);
          toast.success('Account deleted');
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const roleTone = (r) => (r === 'superadmin' ? 'purple' : r === 'admin' ? 'blue' : 'gray');
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admins & Sub Admins</h1>
          <p className="text-sm text-slate-500">Staff accounts and their granular permissions</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New account</button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No staff accounts" message="Create an admin or sub admin account." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((u) => (
            <article key={u._id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                  <Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {u.role === 'subadmin' ? `${u.permissions?.length || 0} permission(s)` : u.role === 'admin' ? 'All permissions except audit logs' : 'Full access'}
              </p>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-ghost btn-sm" onClick={() => setDetail(u)}>Permissions</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                {me.role === 'superadmin' && u.role !== 'superadmin' && (
                  <button className="btn btn-ghost btn-sm text-red-600" onClick={() => remove(u)}>Delete</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={form._id ? 'Edit account' : 'New staff account'} width="max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" required error={formErrors.name}>
              <input className={inputClass} value={form.name} onChange={setF('name')} required />
            </Field>
            <Field label="Email" required error={formErrors.email}>
              <input type="email" className={inputClass} value={form.email} onChange={setF('email')} required />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone || ''} onChange={setF('phone')} />
            </Field>
            <Field label={form._id ? 'New password (optional)' : 'Temporary password'} required={!form._id} error={formErrors.password} hint="They must change it on first login">
              <input type="text" className={inputClass} value={form.password} onChange={setF('password')} required={!form._id} />
            </Field>
            <Field label="Role" required error={formErrors.role}>
              <select className={inputClass} value={form.role} onChange={setF('role')} disabled={!!form._id || me.role !== 'superadmin'}>
                {me.role === 'superadmin' && <option value="admin">Admin</option>}
                <option value="subadmin">Sub Admin</option>
              </select>
            </Field>
            {form._id && (
              <Field label="Status">
                <select className={inputClass} value={form.status} onChange={setF('status')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
          </div>

          {form.role === 'subadmin' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Permissions</p>
                <div className="flex gap-2 text-xs">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, permissions: catalog }))}>Select all</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, permissions: [] }))}>Clear</button>
                </div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto rounded-xl border border-slate-200/70 p-3">
                {GROUPS.map((g) => (
                  <fieldset key={g.label}>
                    <legend className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{g.label}</legend>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {g.keys
                        .filter((p) => catalog.length === 0 || catalog.includes(p))
                        .map((p) => (
                          <label key={p} className="flex items-center gap-2 text-sm text-slate-600 px-2 py-1 rounded-lg hover:bg-white/70">
                            <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                            {p}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form._id ? 'Save changes' : 'Create account'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${detail?.name} — permissions`} width="max-w-md">
        {detail?.role === 'subadmin' ? (
          <ul className="space-y-1.5">
            {(detail.permissions || []).length === 0 && <li className="text-sm text-slate-500">No permissions assigned.</li>}
            {(detail.permissions || []).map((p) => (
              <li key={p} className="rounded-lg bg-white/70 border border-slate-200/70 px-3 py-1.5 text-sm text-slate-700">{p}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">
            {detail?.role === 'admin'
              ? 'Admins have every permission except audit logs.'
              : 'Super admin has full access.'}
          </p>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} title={confirm?.title} message={confirm?.message} danger confirmLabel="Delete" />
    </div>
  );
}
