"use client";

const metrics = [
  { key: "damagePerMinute",              label: "Ort. DPM",       format: (v) => v.toFixed(0),        max: 1200, color: "#ef4444" },
  { key: "killParticipation",            label: "Kill Katılım",   format: (v) => `${(v * 100).toFixed(0)}%`, max: 1, color: "#3b82f6", isRatio: true },
  { key: "soloKills",                    label: "Solo Kill",      format: (v) => v.toFixed(1),        max: 5,   color: "#f59e0b" },
  { key: "visionScorePerMinute",         label: "Vision/dk",      format: (v) => v.toFixed(2),        max: 2,   color: "#8b5cf6" },
  { key: "teamDamagePercentage",         label: "Takım Hasar",    format: (v) => `${v.toFixed(1)}%`,  max: 40,  color: "#ec4899" },
  { key: "laneMinionsFirst10Minutes",    label: "10dk CS",        format: (v) => v.toFixed(0),        max: 90,  color: "#06b6d4" },
  { key: "turretPlatesTaken",            label: "Plaka",          format: (v) => v.toFixed(1),        max: 5,   color: "#f97316" },
  { key: "controlWardsPlaced",           label: "Kontrol Ward",   format: (v) => v.toFixed(1),        max: 5,   color: "#14b8a6" },
  { key: "firstBloodKill",              label: "First Blood",    format: (v) => `${(v * 100).toFixed(0)}%`, max: 1, color: "#eab308", isRatio: true },
];

export default function ChallengesCard({ challenges }) {
  if (!challenges?.averages || Object.keys(challenges.averages).length === 0) return null;

  const avgs = challenges.averages;
  const totalGames = challenges.totalGames;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Performans Metrikleri</h3>
        <span className="text-[10px] text-gray-600">{totalGames} maç</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        {metrics.map((m) => {
          const raw = avgs[m.key];
          if (raw == null) return null;
          const value = m.isRatio ? raw : raw;
          const pct = Math.min((value / m.max) * 100, 100);

          return (
            <div key={m.key} className="text-center">
              <p className="text-[10px] text-gray-500 mb-1">{m.label}</p>
              <p className="text-sm font-bold text-gray-200">{m.format(value)}</p>
              <div className="mt-1.5 h-1 rounded-full bg-[#1b2230] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
