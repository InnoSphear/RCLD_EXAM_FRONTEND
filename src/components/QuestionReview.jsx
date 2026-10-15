const MARKS_TONE = (ev) => (ev.isCorrect ? 'text-emerald-600' : ev.awarded > 0 ? 'text-amber-600' : 'text-red-500');
const MARKS_ICON = (ev) => (ev.isCorrect ? '✓' : ev.awarded > 0 ? '~' : '✗');

export default function QuestionReview({ item, index }) {
  const ev = item || {};
  const q = ev.question && typeof ev.question === 'object' ? ev.question : null;
  const selected = Array.isArray(ev.selected) ? ev.selected : [];
  const correct = Array.isArray(q?.correctAnswers) ? q.correctAnswers : Array.isArray(ev.correct) ? ev.correct : [];
  const options = Array.isArray(q?.options) ? q.options : [];
  const noChoice = !options.length;

  return (
    <li className="rounded-lg bg-white/70 border border-slate-200/70 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        <span className={`font-bold ${MARKS_TONE(ev)}`}>{MARKS_ICON(ev)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-slate-700 font-medium whitespace-pre-wrap">
            {index != null && <span className="text-slate-400 mr-1">{index + 1}.</span>}
            {q?.statement || (typeof ev.question === 'string' ? ev.question : 'Question')}
          </p>

          {options.length > 0 && (
            <ul className="mt-1.5 grid sm:grid-cols-2 gap-1">
              {options.map((o) => {
                const isCorrect = correct.includes(o.key);
                const isSelected = selected.includes(o.key);
                return (
                  <li
                    key={o.key}
                    className={`rounded-md px-2 py-1 ${isCorrect ? 'bg-emerald-50 text-emerald-800 font-semibold' : isSelected ? 'bg-red-50 text-red-700' : 'bg-white/60 text-slate-600'}`}
                  >
                    <span className="font-bold mr-1">{o.key})</span>
                    {o.text}
                    {isCorrect && ' ✓'}
                    {isSelected && !isCorrect && ' ✗'}
                    {isSelected && <span className="text-[10px] uppercase ml-1">your answer</span>}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-slate-500 mt-1">
            {noChoice ? (
              <>Your answer: {selected.length ? selected.join(', ') : '—'} · Correct answer: {correct.length ? correct.join(', ') : '—'}</>
            ) : (
              <>Your answer: {selected.length ? selected.join(', ') : '—'} · Correct: {correct.length ? correct.join(', ') : '—'}</>
            )}{' '}
            · awarded {ev.awarded ?? 0}
          </p>

          {q?.explanation && <p className="text-xs text-slate-500 mt-0.5">↳ {q.explanation}</p>}
        </div>
      </div>
    </li>
  );
}
