// Tek tip panel/kart. İsteğe bağlı başlık (title + subtitle + actions) + gövde.
// flush=true → gövde padding'i kalkar (tablo gibi kenara yaslanan içerik için).

export default function Card({
  title, subtitle, actions, icon,
  children, flush = false, className = "", bodyClassName = "",
}) {
  const hasHeader = title || actions;
  return (
    <section className={`rounded-2xl border border-edge bg-card/80 backdrop-blur-sm ${className}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-edge/60">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <span className="mt-0.5 shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-white/[0.04] border border-edge text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : `p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
