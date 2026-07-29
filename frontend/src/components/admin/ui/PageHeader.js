// Sayfa başlığı — her admin sayfasının en üstünde. title + subtitle + sağda actions.

export default function PageHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap mb-5 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1 leading-relaxed max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
