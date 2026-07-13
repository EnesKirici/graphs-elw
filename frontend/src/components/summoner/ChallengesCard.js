"use client";

const metrics = [
  { key: "damagePerMinute",              label: "Ort. DPM",       format: (v) => v.toFixed(0),        max: 1200, color: "#ef4444" },
  { key: "killParticipation",            label: "Kill Katılım",   format: (v) => `${(v * 100).toFixed(0)}%`, max: 1, color: "#3b82f6", isRatio: true },
  { key: "soloKills",                    label: "Solo Kill",      format: (v) => v.toFixed(1),        max: 5,   color: "#f59e0b" },
  { key: "visionScorePerMinute",         label: "Vision/dk",      format: (v) => v.toFixed(2),        max: 2,   color: "#8b5cf6" },
  { key: "teamDamagePercentage",         label: "Takım Hasar",    format: (v) => `${(v * 100).toFixed(0)}%`, max: 1, color: "#ec4899", isRatio: true },
  { key: "laneMinionsFirst10Minutes",    label: "10dk CS",        format: (v) => v.toFixed(0),        max: 90,  color: "#06b6d4" },
  { key: "turretPlatesTaken",            label: "Plaka",          format: (v) => v.toFixed(1),        max: 5,   color: "#f97316", roleNormalized: true },
  { key: "controlWardsPlaced",           label: "Kontrol Ward",   format: (v) => v.toFixed(1),        max: 5,   color: "#14b8a6" },
  { key: "firstBloodKill",              label: "First Blood",    format: (v) => `${(v * 100).toFixed(0)}%`, max: 1, color: "#eab308", isRatio: true },
];

const ROLE_TR = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support" };

// plain=true → dış .glass kart yok; birleşik kartın (Koridorlar altı) bölümü olur.
export default function ChallengesCard({ challenges, plain = false }) {
  if (!challenges?.averages || Object.keys(challenges.averages).length === 0) return null;

  const avgs = challenges.averages;
  const totalGames = challenges.totalGames;

  const inner = (
    <>
      <div className={`px-5 py-3.5 border-b border-edge/50 flex items-center justify-between ${plain ? "border-t" : ""}`}>
        <h3 className="text-sm font-semibold text-gray-200">Performans Metrikleri</h3>
        <span className="text-[10px] text-gray-600">{totalGames} maç</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        {metrics.map((m) => {
          const raw = avgs[m.key];
          if (raw == null) return null;
          const value = raw;
          // Plaka: sabit max yerine ana role göre "beklenen" hedefe göre normalize
          // (top laner'ın 4 plakası ile jungle'ın 1 plakası kendi bağlamında okunur).
          const roleMax = m.roleNormalized ? challenges.plate?.expected : null;
          const max = roleMax || m.max;
          const pct = Math.min((value / max) * 100, 100);
          const title = m.roleNormalized && challenges.plate?.role
            ? `${ROLE_TR[challenges.plate.role] ?? challenges.plate.role} rolüne göre — hedef ${max} plaka`
            : undefined;

          return (
            <div key={m.key} className="text-center" title={title}>
              <p className="text-[10px] text-gray-500 mb-1">{m.label}</p>
              <p className="text-sm font-bold text-gray-200">{m.format(value)}</p>
              <div className="mt-1.5 h-1 rounded-full bg-edge overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (plain) return inner;
  return <div className="glass rounded-xl overflow-hidden">{inner}</div>;
}
