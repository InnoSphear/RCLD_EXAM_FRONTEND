/**
 * RCLD brand logo.
 * Official logo asset could not be retrieved (rcld.org DNS unavailable from build network).
 * Drop the approved asset at frontend/public/rcld-logo.png (or .svg) and it is used automatically.
 * Until then a clearly-labelled configurable monogram placeholder is rendered.
 */
const LOGO_SRC = '/rcld-logo.png';

export default function Logo({ size = 40, withText = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={LOGO_SRC}
        alt="RCLD"
        width={size}
        height={size}
        className="rounded-xl object-contain"
        style={{ width: size, height: size }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.removeAttribute('hidden');
        }}
      />
      <span
        hidden
        aria-hidden
        style={{ width: size, height: size }}
        className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white grid place-items-center font-extrabold shrink-0"
      >
        R
      </span>
      {withText && (
        <span className="leading-tight">
          <span className="block font-extrabold tracking-tight text-slate-800">RCLD</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">Examination Portal</span>
        </span>
      )}
    </span>
  );
}
