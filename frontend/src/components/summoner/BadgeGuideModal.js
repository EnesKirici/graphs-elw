"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const TIERS = [
  { key: "challenger",  label: "Challenger",  gradient: "linear-gradient(90deg, #f0e6d2, #c8aa6e, #78c8e6, #c8aa6e)", bg: "from-[#c8aa6e]/20 via-[#78c8e6]/15 to-[#c8aa6e]/20", border: "border-[#c8aa6e]/40" },
  { key: "grandmaster", label: "Grandmaster", gradient: "linear-gradient(90deg, #cd3737, #ff6b6b, #cd3737)", bg: "from-[#1a0505]/30 via-[#cd3737]/15 to-[#1a0505]/30", border: "border-[#cd3737]/30" },
  { key: "diamond",     label: "Diamond",     gradient: "linear-gradient(90deg, #4a9bd9, #78c8e6, #576ece)", bg: "from-[#576ece]/12 to-[#4a9bd9]/8", border: "border-[#4a9bd9]/25" },
  { key: "emerald",     label: "Emerald",     color: "#2d9e6e", bg: "bg-[#2d9e6e]/8", border: "border-[#2d9e6e]/20" },
  { key: "gold",        label: "Gold",        color: "#c89b3c", bg: "bg-[#c89b3c]/8", border: "border-[#c89b3c]/20" },
  { key: "silver",      label: "Silver",      color: "#80939e", bg: "bg-[#80939e]/6", border: "border-[#80939e]/15" },
];

function tierStyle(tierKey) {
  return TIERS.find((t) => t.key === tierKey) || TIERS[5];
}

function TierText({ tier, children, className = "" }) {
  const t = tierStyle(tier);
  if (t.gradient) {
    return <span className={`bg-clip-text text-transparent font-bold ${className}`} style={{ backgroundImage: t.gradient }}>{children}</span>;
  }
  return <span className={`font-bold ${className}`} style={{ color: t.color }}>{children}</span>;
}

function TierPill({ tier, value }) {
  const t = tierStyle(tier);
  const bgClass = t.gradient ? `bg-gradient-to-r ${t.bg}` : t.bg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${bgClass} ${t.border}`}>
      <TierText tier={tier} className="text-[10px]">{value}</TierText>
    </span>
  );
}

const CATEGORIES = [
  {
    title: "Savaş",
    badges: [
      { label: "Düellocu", desc: "Solo kill sayısı", tiers: [{ t: "silver", v: "2+" }, { t: "gold", v: "3+" }, { t: "diamond", v: "4+" }, { t: "grandmaster", v: "6+" }, { t: "challenger", v: "8+" }] },
      { label: "Yüksek KDA", desc: "(Kill+Assist)/Death oranı, min 5 K+A", tiers: [{ t: "gold", v: "4+" }, { t: "emerald", v: "5+" }, { t: "diamond", v: "7+" }, { t: "grandmaster", v: "10+" }, { t: "challenger", v: "15+" }] },
      { label: "Ölümsüz", desc: "0 ölüm ile galibiyet, K+A toplamı", tiers: [{ t: "emerald", v: "Galibiyet" }, { t: "diamond", v: "10+ K+A" }, { t: "challenger", v: "15+ K+A" }] },
      { label: "İlk Kan", desc: "Maçta ilk öldürme", tiers: [{ t: "gold", v: "First Blood" }] },
      { label: "PENTA KILL", desc: "5 kişiyi ard arda öldürme", tiers: [{ t: "challenger", v: "Pentakill" }] },
      { label: "Quadra Kill", desc: "4 kişiyi ard arda öldürme", tiers: [{ t: "grandmaster", v: "Quadrakill" }] },
      { label: "Son Nefes", desc: "10 HP altında hayatta kalma sayısı", tiers: [{ t: "silver", v: "1x" }, { t: "gold", v: "2x" }, { t: "diamond", v: "3x" }, { t: "challenger", v: "5x" }] },
      { label: "Kaçış Ustası", desc: "Savuşturulan skillshot sayısı", tiers: [{ t: "gold", v: "20+" }, { t: "emerald", v: "35+" }, { t: "diamond", v: "50+" }, { t: "challenger", v: "70+" }] },
    ],
  },
  {
    title: "Hasar",
    badges: [
      { label: "Hasar Makinesi", desc: "Takım toplam hasarındaki payın (%)", tiers: [{ t: "silver", v: "%28" }, { t: "gold", v: "%30" }, { t: "diamond", v: "%35" }, { t: "grandmaster", v: "%42" }, { t: "challenger", v: "%50" }] },
      { label: "Yüksek DPM", desc: "Dakika başı şampiyonlara verilen hasar", tiers: [{ t: "gold", v: "600" }, { t: "emerald", v: "800" }, { t: "diamond", v: "1000" }, { t: "grandmaster", v: "1200" }, { t: "challenger", v: "1500" }] },
      { label: "Duvar", desc: "Takım için alınan hasar payı (Top/JG/Sup)", tiers: [{ t: "gold", v: "%28" }, { t: "emerald", v: "%35" }, { t: "diamond", v: "%45" }] },
    ],
  },
  {
    title: "Farming",
    badges: [
      { label: "CS Ustası", desc: "İlk 10 dakikadaki CS sayısı (Top/Mid/ADC)", tiers: [{ t: "gold", v: "65" }, { t: "emerald", v: "72" }, { t: "diamond", v: "80" }, { t: "grandmaster", v: "88" }, { t: "challenger", v: "95" }] },
      { label: "CS Baskını", desc: "Lane rakibine karşı max CS farkı", tiers: [{ t: "gold", v: "+15" }, { t: "emerald", v: "+25" }, { t: "diamond", v: "+40" }, { t: "challenger", v: "+60" }] },
      { label: "Altın Madencisi", desc: "Dakika başı kazanılan gold", tiers: [{ t: "gold", v: "400" }, { t: "emerald", v: "480" }, { t: "diamond", v: "550" }, { t: "challenger", v: "650" }] },
    ],
  },
  {
    title: "Objektif",
    badges: [
      { label: "Kule Yıkıcı", desc: "Alınan kule plakası sayısı", tiers: [{ t: "silver", v: "2" }, { t: "gold", v: "3" }, { t: "diamond", v: "5" }, { t: "challenger", v: "7" }] },
      { label: "Hırsız", desc: "Çalınan epic monster (Baron/Dragon/Herald)", tiers: [{ t: "diamond", v: "1" }, { t: "grandmaster", v: "2" }, { t: "challenger", v: "3" }] },
      { label: "İlk Kule", desc: "Maçtaki ilk kuleyi yıkmak", tiers: [{ t: "gold", v: "İlk Kule" }] },
    ],
  },
  {
    title: "Görüş & Takım",
    badges: [
      { label: "Görüş Ustası", desc: "Dakika başı vision score", tiers: [{ t: "gold", v: "1.0" }, { t: "emerald", v: "1.5" }, { t: "diamond", v: "2.0" }, { t: "challenger", v: "2.5" }] },
      { label: "Ward Ustası", desc: "Yerleştirilen kontrol ward sayısı", tiers: [{ t: "silver", v: "4" }, { t: "gold", v: "7" }, { t: "emerald", v: "10" }, { t: "diamond", v: "15" }] },
      { label: "Takım Oyuncusu", desc: "Kill katılım oranı (%)", tiers: [{ t: "gold", v: "%65" }, { t: "emerald", v: "%72" }, { t: "diamond", v: "%80" }, { t: "challenger", v: "%90" }] },
    ],
  },
];

export default function BadgeGuideModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#0d1117] border border-[#1b2230] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b2230]/50">
          <div>
            <h2 className="text-base font-bold text-white">Rozet Rehberi</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Maç performansına göre rozetler kazanılır. Renk zorluk seviyesini gösterir.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1">
            <X size={18} />
          </button>
        </div>

        {/* Tier bar */}
        <div className="flex items-center justify-center gap-4 px-6 py-2.5 border-b border-[#1b2230]/30 bg-[#0a0e14]/50">
          {TIERS.map((t) => (
            <TierText key={t.key} tier={t.key} className="text-[10px] capitalize">{t.label}</TierText>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">{cat.title}</h3>
              <div className="space-y-2.5">
                {cat.badges.map((b) => (
                  <div key={b.label} className="flex items-start gap-3 py-1">
                    <div className="w-28 flex-shrink-0">
                      <p className="text-[12px] font-semibold text-gray-200">{b.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{b.desc}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {b.tiers.map((t, i) => (
                        <TierPill key={i} tier={t.t} value={t.v} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
