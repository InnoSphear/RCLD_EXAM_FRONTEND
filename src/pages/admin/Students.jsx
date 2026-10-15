import { useEffect, useState, useCallback } from 'react';
import { get, post, patch, del, download } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorState, EmptyState, Pagination, Badge, Field, inputClass } from '../../components/ui';
import Modal, { ConfirmDialog } from '../../components/Modal';

const EMPTY = { fullName: '', email: '', phone: '', studentId: '', course: '', semester: '', status: 'active', password: '' };

export default function Students() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({ semester: '', status: '' });
  const [sort, setSort] = useState('-createdAt');

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit, search: debouncedSearch, sort, ...filters };
      const d = await get('/students', params);
      setItems(d.data.items);
      setTotal(d.data.total);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sort, filters]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    get('/academics/semesters')
      .then((d) => setSemesters(d.data.items))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormErrors({});
    setEditOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      fullName: s.name || '',
      email: s.email || '',
      phone: s.phone || '',
      studentId: s.studentId || '',
      course: s.course || '',
      semester: s.semester?._id || '',
      status: s.status,
      password: '',
    });
    setFormErrors({});
    setEditOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormErrors({});
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await patch(`/students/${editing._id}`, payload);
        toast.success('Student updated');
      } else {
        await post('/students', payload);
        toast.success('Student registered');
      }
      setEditOpen(false);
      load();
    } catch (err) {
      const er = apiError(err);
      setFormErrors(er.details || {});
      if (!er.details) toast.error(er.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const bulkStatus = (status) => {
    setConfirm({
      title: `${status === 'active' ? 'Activate' : 'Deactivate'} ${selected.size} student(s)?`,
      message: 'This changes account access for the selected students.',
      danger: status === 'inactive',
      onConfirm: async () => {
        try {
          const r = await post('/students/bulk-status', { ids: [...selected], status });
          toast.success(`${r.data.modified} student(s) ${status === 'active' ? 'activated' : 'deactivated'}`);
          setSelected(new Set());
          setConfirm(null);
          load();
        } catch (e) {
          toast.error(apiError(e).message);
          setConfirm(null);
        }
      },
    });
  };

  const removeStudent = (s) => {
    setConfirm({
      title: `Delete "${s.name}"?`,
      message: 'This permanently removes the student and all their exam attempts and results.',
      danger: true,
      onConfirm: async () => {
        try {
          await del(`/students/${s._id}`);
          toast.success('Student deleted');
          setSelected((prev) => {
            const n = new Set(prev);
            n.delete(s._id);
            return n;
          });
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const bulkRemove = () => {
    const ids = [...selected];
    setConfirm({
      title: `Delete ${ids.length} student${ids.length > 1 ? 's' : ''}?`,
      message: 'This permanently removes the selected students and all their exam attempts and results.',
      danger: true,
      onConfirm: async () => {
        try {
          const r = await post('/students/bulk-delete', { ids });
          toast.success(`${r.data.deleted} student(s) deleted`);
          setSelected(new Set());
          load();
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const allSelected = items.length > 0 && items.every((s) => selected.has(s._id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSelected) items.forEach((s) => n.delete(s._id));
      else items.forEach((s) => n.add(s._id));
      return n;
    });
  };

  const doExport = async (format) => {
    try {
      await download('/students/export', { format, ...filters, search: debouncedSearch }, `students_${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-sm text-slate-500">{total} records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('students.export') && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('xlsx')}>
                ⬇ Excel
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')}>
                ⬇ CSV
              </button>
            </>
          )}
          {hasPermission('students.register') && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Register student
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <input
          className="glass-input rounded-xl px-3.5 py-2 text-sm flex-1 min-w-[200px]"
          placeholder="Search name, email, phone, student ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search students"
        />
        <select
          className="glass-input rounded-xl px-3 py-2 text-sm"
          value={filters.semester}
          onChange={(e) => {
            setFilters((f) => ({ ...f, semester: e.target.value }));
            setPage(1);
          }}
          aria-label="Filter by semester"
        >
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s._id} value={s._id}>
              {s.title}
            </option>
          ))}
        </select>
        <select
          className="glass-input rounded-xl px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="glass-input rounded-xl px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="name">Name A→Z</option>
          <option value="-name">Name Z→A</option>
          <option value="studentId">Student ID</option>
        </select>
      </div>

      {selected.size > 0 && (hasPermission('students.edit') || hasPermission('students.delete')) && (
        <div className="glass rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-600">{selected.size} selected</span>
          {hasPermission('students.edit') && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => bulkStatus('active')}>
                Activate
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => bulkStatus('inactive')}>
                Deactivate
              </button>
            </>
          )}
          {hasPermission('students.delete') && (
            <button className="btn btn-danger btn-sm" onClick={bulkRemove}>
              Delete
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No students found" message="Adjust the filters or register a new student." />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  {hasPermission('students.delete') && (
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all students"
                      />
                    </th>
                  )}
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Semester</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id}>
                    {hasPermission('students.delete') && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(s._id)}
                          onChange={() => toggleSelect(s._id)}
                          aria-label={`Select ${s.name}`}
                        />
                      </td>
                    )}
                    <td>
                      <p className="font-medium text-slate-700">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.email}</p>
                      {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                    </td>
                    <td className="font-mono text-xs">{s.studentId}</td>
                    <td>{s.semester?.title || '—'}</td>
                    <td>
                      <Badge tone={s.status === 'active' ? 'green' : 'red'}>{s.status}</Badge>
                    </td>
                    <td className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetail(s)}>
                          View
                        </button>
                        {hasPermission('students.edit') && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                            Edit
                          </button>
                        )}
                        {hasPermission('students.delete') && (
                          <button className="btn btn-ghost btn-sm text-red-600" onClick={() => removeStudent(s)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={page} limit={limit} total={total} onChange={setPage} />
          </div>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editing ? 'Edit student' : 'Register student'} width="max-w-2xl">
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" required error={formErrors.fullName}>
            <input className={inputClass} value={form.fullName} onChange={set('fullName')} required />
          </Field>
          <Field label="Email" required error={formErrors.email}>
            <input type="email" className={inputClass} value={form.email} onChange={set('email')} required />
          </Field>
          <Field label="Phone" error={formErrors.phone}>
            <input className={inputClass} value={form.phone} onChange={set('phone')} placeholder="9876543210" />
          </Field>
          <Field label="Student ID" required error={formErrors.studentId}>
            <input className={inputClass} value={form.studentId} onChange={set('studentId')} required />
          </Field>
          <Field label="Course" error={formErrors.course}>
            <input className={inputClass} value={form.course} onChange={set('course')} placeholder="BCA" />
          </Field>
          <Field label="Semester" error={formErrors.semester}>
            <select className={inputClass} value={form.semester} onChange={set('semester')}>
              <option value="">Select semester…</option>
              {semesters.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={formErrors.status}>
            <select className={inputClass} value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={editing ? 'Reset password (optional)' : 'Initial password (optional)'}
              error={formErrors.password}
              hint={editing ? 'Leave blank to keep current password. Student must change after reset.' : 'Defaults to the configured shared initial password. Student must change it on first login.'}
            >
              <input type="text" className={inputClass} value={form.password} onChange={set('password')} autoComplete="new-password" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Register student'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Student detail" width="max-w-lg">
        {detail && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Name', detail.name],
              ['Email', detail.email],
              ['Phone', detail.phone || '—'],
              ['Student ID', detail.studentId],
              ['Course', detail.course || '—'],
              ['Semester', detail.semester?.title || '—'],
              ['Status', detail.status],
              ['Registered', new Date(detail.createdAt).toLocaleString()],
              ['Last login', detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : 'Never'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="font-medium text-slate-700 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        confirmLabel="Yes, proceed"
      />
    </div>
  );
}
