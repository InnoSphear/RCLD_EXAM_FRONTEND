import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../api/endpoints';
import { apiError } from '../api/client';
import Logo from '../components/Logo';
import { Field, inputClass } from '../components/ui';
import { useToast } from '../context/ToastContext';

export default function ChangePassword() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) return setError('New passwords do not match');
    if (next.length < 8) return setError('New password must be at least 8 characters');
    if (next === current) return setError('New password must differ from the current password');
    setBusy(true);
    try {
      await changePassword(current, next);
      setUser({ ...user, mustChangePassword: false });
      toast.success('Password changed successfully');
      navigate(user.role === 'student' ? '/student' : '/admin', { replace: true });
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size={52} />
        </div>
        <div className="glass-strong rounded-3xl p-7 sm:p-8">
          <h1 className="text-xl font-bold text-slate-800">Change your password</h1>
          <p className="text-sm text-slate-500 mt-1">
            You are required to change the initial password before using the portal.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Current password" required>
              <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="New password" required hint="Minimum 8 characters">
              <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} required />
            </Field>
            <Field label="Confirm new password" required>
              <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
                {busy ? 'Saving…' : 'Change password'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login'); }}>
                Sign out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
