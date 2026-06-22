"use client";

/*
  Ortak ELW skor dial'ı — summoner sayfasındaki ScoreBlock ile AYNI yapı:
  koyu dolgulu halka + skor + altında sıralama rozeti (MVP/ACE/#N).
  rank verilmezse sadece halka gösterilir (ortalama skor için).
*/

function scoreColor(s) {
  if (s == null) return "var(--c-edge)";
  if (s >= 7.5) return "#f0c674";
  if (s >= 6) return "#5a8fe6";
  if (s >= 4.5) return "#9fb0bd";
  return "#cd7f32";
}

function placement(rank, win) {
  if (!rank) return null;
  if (rank === 1) return win ? "MVP" : "ACE";
  return `${rank}.`;
}

function badgeCls(rank, win) {
  if (rank === 1 && win) return "text-amber-300 border-amber-400/50 bg-[#1c1604]";
  if (rank === 1 && !win) return "text-cyan-300 border-cyan-400/50 bg-[#04161c]";
  if (rank <= 3) return "text-sky-300 border-sky-400/40 bg-[#06141c]";
  return "text-gray-300 border-edge bg-[#0c1220]";
}

export default function ScoreDial({ score, rank, win, size = 46 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, (score ?? 0) / 10));
  const color = scoreColor(score);
  const place = rank ? placement(rank, win) : null;

  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size + (place ? 6 : 0) }}>
      <svg width={size} height={size} className="-rotate-90 absolute top-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="#0a0e14" stroke="#27303f" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - fill)} />
      </svg>
      <span className="absolute top-0 flex items-center justify-center tabular-nums" style={{ width: size, height: size, color, fontSize: size * 0.32, fontWeight: 800 }}>
        {score != null ? score.toFixed(1) : "—"}
      </span>
      {place && (
        <span className={`absolute bottom-0 px-1 py-px rounded-full text-[8px] font-bold leading-none border ${badgeCls(rank, win)}`}>
          {place}
        </span>
      )}
    </span>
  );
}
