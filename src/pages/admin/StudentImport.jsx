import { useState, useRef } from 'react';
import { upload, post, download } from '../../api/endpoints';
import { apiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui';
import { ConfirmDialog } from '../../components/Modal';

export default function StudentImport() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showErrors, setShowErrors] = useState(false);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(xlsx|csv)$/i.test(f.name)) {
      toast.error('Only .xlsx or .csv files are supported');
      return;
    }
    setFile(f);
  };

  const doPreview = async () => {
    if (!file) return toast.error('Choose a file first');
    setBusy(true);
    try {
      const d = await upload('/students/import/preview', file);
      setPreview(d.data);
      setStep(2);
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = () => {
    setConfirm({
      title: `Import ${preview.valid} valid record(s)?`,
      message: `${preview.invalid} invalid row(s) will be skipped. Duplicates are never created.`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(true);
        try {
          const items = preview.items.map((i) => ({ row: i.row, record: i.record, errors: i.errors }));
          const d = await post('/students/import/confirm', { items, skipInvalid: true });
          setResult(d.data);
          setStep(3);
        } catch (e) {
          toast.error(apiError(e).message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const downloadReport = () => {
    if (!result) return;
    const rows = [
      ...result.report.imported.map((r) => ({ Row: r.row, Status: 'imported', Email: r.email || '', 'Student ID': r.studentId || '', Error: '' })),
      ...result.report.skipped.map((r) => ({ Row: r.row, Status: 'skipped', Email: '', 'Student ID': '', Error: JSON.stringify(r.errors || {}) })),
      ...result.report.failed.map((r) => ({ Row: r.row, Status: 'failed', Email: '', 'Student ID': '', Error: JSON.stringify(r.errors || {}) })),
    ];
    const csv = [Object.keys(rows[0] || { Row: 1 }).join(','), ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `import_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep(1);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bulk student import</h1>
          <p className="text-sm text-slate-500">Upload an Excel (.xlsx) or CSV file with student records</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => download('/students/template', {}, 'student_import_template.xlsx')}>
          ⬇ Download template
        </button>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs font-semibold">
        {['Upload', 'Preview & validate', 'Confirm & report'].map((label, i) => (
          <li
            key={label}
            className={`px-3 py-1.5 rounded-full ${step === i + 1 ? 'bg-brand-600 text-white' : step > i + 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-white/70 text-slate-500'}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <label
            htmlFor="bulk-file"
            className="block border-2 border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 transition focus-ring"
          >
            <input id="bulk-file" ref={fileRef} type="file" accept=".xlsx,.csv" className="sr-only" onChange={pick} />
            <div className="text-3xl mb-2">⇪</div>
            <p className="font-semibold text-slate-700">{file ? file.name : 'Click to choose an Excel or CSV file'}</p>
            <p className="text-sm text-slate-500 mt-1">Required columns: fullName, email, studentId (plus optional phone, rollNumber, course, semester, status)</p>
          </label>
          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary" onClick={doPreview} disabled={busy || !file}>
              {busy ? 'Validating…' : 'Upload & validate'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{preview.total}</p>
              <p className="text-xs text-slate-500">Total rows</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{preview.valid}</p>
              <p className="text-xs text-slate-500">Valid</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{preview.invalid}</p>
              <p className="text-xs text-slate-500">Invalid / skipped</p>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60">
              <h2 className="font-semibold text-slate-700 text-sm">Preview</h2>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={showErrors} onChange={(e) => setShowErrors(e.target.checked)} />
                Show errors only
              </label>
            </div>
            <div className="table-shell max-h-[420px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Student ID</th>
                    <th>Semester</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items
                    .filter((i) => !showErrors || Object.keys(i.errors).length)
                    .map((i) => {
                      const errs = Object.entries(i.errors || {});
                      return (
                        <tr key={i.row}>
                          <td>{i.row}</td>
                          <td>{i.record.fullName}</td>
                          <td>{i.record.email}</td>
                          <td className="font-mono text-xs">{i.record.studentId}</td>
                          <td>{i.record.semester || '—'}</td>
                          <td>
                            {errs.length ? (
                              <ul className="space-y-0.5">
                                {errs.map(([k, v]) => (
                                  <li key={k} className="text-xs text-red-600">
                                    <span className="font-semibold">{k}:</span> {v}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <Badge tone="green">valid</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <button className="btn btn-ghost" onClick={reset}>
              ← Start over
            </button>
            <button className="btn btn-primary" onClick={doImport} disabled={busy || preview.valid === 0}>
              {busy ? 'Importing…' : `Import ${preview.valid} student(s)`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">Import report</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="text-xs text-emerald-700">Imported</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="text-xs text-amber-700">Skipped</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-2xl font-bold text-red-700">{result.failed}</p>
              <p className="text-xs text-red-700">Failed</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Imported students can sign in with the initial password and must change it on first login.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={downloadReport}>
              ⬇ Download detailed report
            </button>
            <button className="btn btn-primary" onClick={reset}>
              Import another file
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Import now"
      />
    </div>
  );
}
