import { useState } from 'react';
import { changePassword } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Badge, Field, inputClass } from '../../components/ui';

export default function Profile() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (form.newPassword.length < 8) {
      setErrors({ newPassword: 'Minimum 8 characters' });
      return;
    }
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      const er = apiError(err);
      setErrors(er.details || {});
      if (!er.details) toast.error(er.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
        <p className="text-sm text-slate-500">Your account details</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-brand-100 text-brand-700 grid place-items-center text-xl font-bold">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{user?.name}</p>
            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <Badge tone="blue">{user?.role}</Badge>
          </div>
        </div>
        <dl className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ['Student ID', user?.studentId],
            ['Roll number', user?.rollNumber],
            ['Course', user?.course],
            ['Phone', user?.phone],
            ['Semester', user?.semester?.title || (typeof user?.semester === 'string' ? user.semester : '')],
            ['Status', user?.status],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="text-slate-700">{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Change password</h2>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current password" required error={errors.currentPassword}>
            <input
              type="password"
              className={inputClass}
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" required error={errors.newPassword} hint="Minimum 8 characters">
            <input
              type="password"
              className={inputClass}
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" required error={errors.confirm}>
            <input
              type="password"
              className={inputClass}
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
