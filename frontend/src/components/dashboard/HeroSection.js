export default function HeroSection({ version, championCount }) {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient arka plan */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-cyan-600/8 animate-gradient" />

      <div className="relative max-w-7xl mx-auto px-6 py-10 text-center">
        <div className="animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              League Analytics
            </span>
          </h1>
          <p className="text-gray-500 text-base">
            Meta istatistikleri ve şampiyon analizleri
          </p>
        </div>

        {/* İstatistik badge'leri */}
        <div className="mt-6 flex items-center justify-center gap-8 animate-fade-in-up delay-200" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          <StatBadge label="Patch" value={version} />
          <div className="w-px h-6 bg-edge" />
          <StatBadge label="Şampiyon" value={championCount} />
          <div className="w-px h-6 bg-edge" />
          <StatBadge label="Sunucu" value="TR1" />
        </div>
      </div>
    </section>
  );
}

function StatBadge({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
