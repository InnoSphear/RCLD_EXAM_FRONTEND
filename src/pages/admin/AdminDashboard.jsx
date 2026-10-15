import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { StatCard, Spinner, ErrorState, Badge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await get('/admin/dashboard');
      setData(d.data);
      if (hasPermission('results.view')) {
        try {
          const s = await get('/admin/stats/overview');
          setStats(s.data);
        } catch {
          /* stats optional */
        }
      }
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner full />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const c = data.counts;
  const maxSem = Math.max(1, ...(stats?.bySemester || []).map((s) => s.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of the examination portal</p>
        </div>
        <span className="text-xs text-slate-400">
          Server time: {new Date(data.serverTime).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Students" value={c.students} sub={`${c.totalStudents} total · ${c.inactiveStudents} inactive`} icon="☺" tone="brand" />
        <StatCard label="Examinations" value={c.exams} sub={`${data.activeExams.length} running now`} icon="✎" tone="purple" />
        <StatCard label="Question Bank" value={c.questions} sub={`${c.publishedQuestions} published`} icon="❓" tone="amber" />
        <StatCard label="Submitted Attempts" value={c.attempts} sub={`${c.results} evaluated results`} icon="✓" tone="green" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-700 mb-4">Upcoming examinations</h2>
          {data.upcomingExams.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming examinations scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {data.upcomingExams.map((e) => (
                <li key={e._id} className="flex items-center justify-between gap-3 rounded-xl bg-white/60 border border-white/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 truncate">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {e.semester?.title} · {e.subject?.name} · {e.questionCount} questions · {e.totalMarks} marks
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone="blue">{e.status}</Badge>
                    <p className="text-xs text-slate-500 mt-1">{new Date(e.startsAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Students per semester</h2>
          {stats?.bySemester?.length ? (
            <ul className="space-y-3">
              {stats.bySemester.map((s, i) => (
                <li key={i}>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{s.label}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${(s.count / maxSem) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No student data yet.</p>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Questions by subject</h2>
          {hasPermission('questions.view') && (
            <Link to="/admin/questions" className="text-sm text-brand-600 hover:underline">
              Open question bank →
            </Link>
          )}
        </div>
        {data.questionsBySubject?.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.questionsBySubject.map((s, i) => (
              <div key={i} className="rounded-xl bg-white/60 border border-white/70 px-4 py-3">
                <p className="font-medium text-slate-700 truncate">{s.subject}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {s.count} question{s.count === 1 ? '' : 's'} · {s.published} published
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No questions yet.</p>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Recent activity</h2>
          {hasPermission('audit.view') && (
            <Link to="/admin/audit-logs" className="text-sm text-brand-600 hover:underline">
              View all →
            </Link>
          )}
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200/60">
            {data.recentActivity.slice(0, 10).map((a) => (
              <li key={a._id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600 truncate">{a.summary || a.action}</span>
                <span className="text-xs text-slate-400 shrink-0">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
