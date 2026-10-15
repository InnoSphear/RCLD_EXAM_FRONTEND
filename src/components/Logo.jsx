import logoUrl from '../assets/logo.png';

export default function Logo({ size = 40, withText = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoUrl}
        alt="RCLD ISLAMPUR"
        width={size}
        height={size}
        className="rounded-xl object-contain shrink-0"
        style={{ width: size, height: size }}
      />
      {withText && (
        <span className="leading-tight">
          <span className="block font-extrabold tracking-tight text-slate-800">RCLD ISLAMPUR</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">Examination Portal</span>
        </span>
      )}
    </span>
  );
}
