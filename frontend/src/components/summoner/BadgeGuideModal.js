"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const TIERS = [
  { key: "challenger",  label: "Challenger",  gradient: "linear-gradient(90deg, #f0e6d2, #c8aa6e, #78c8e6, #c8aa6e)", bg: "from-[#c8aa6e]/20 via-[#78c8e6]/15 to-[#c8aa6e]/20", border: "border-[#c8aa6e]/40" },
  { key: "grandmaster", label: "Grandmaster", gradient: "linear-gradient(90deg, #cd3737, #ff6b6b, #cd3737)", bg: "from-[#1a0505]/30 via-[#cd3737]/15 to-[#1a0505]/30", border: "border-[#cd3737]/30" },
  { key: "diamond",     label: "Diamond",     gradient: "linear-gradient(90deg, #4a9bd9, #78c8e6, #576ece)", bg: "from-[#576ece]/12 to-[#4a9bd9]/8", border: "border-[#4a9bd9]/25" },
  { key: "emerald",     label: "Emerald",     color: "#2d9e6e", bg: "bg-[#2d9e6e]/8", border: "border-[#2d9e6e]/20" },
  { key: "gold",        label: "Gold",        color: "#c89b3c", bg: "bg-[#c89b3c]/8", border: "border-[#c89b3c]/20" },
  { key: "silver",      label: "Silver",      color: "#80939e", bg: "bg-[#80939e]/6", border: "border-[#80939e]/15" },
];

function tierStyle(tierKey) { return TIERS.find((t) => t.key === tierKey) || TIERS[5]; }

function TierText({ tier, children, className = "" }) {
  const t = tierStyle(tier);
  if (t.gradient) return <span className={`bg-clip-text text-transparent font-bold ${className}`} style={{ backgroundImage: t.gradient }}>{children}</span>;
  return <span className={`font-bold ${className}`} style={{ color: t.color }}>{children}</span>;
}

function TierPill({ tier, value, isNegative }) {
  if (isNegative) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 border-red-500/20">
        <span className="text-[10px] font-bold text-red-400">{value}</span>
      </span>
    );
  }
  const t = tierStyle(tier);
  const bgClass = t.gradient ? `bg-gradient-to-r ${t.bg}` : t.bg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${bgClass} ${t.border}`}>
      <TierText tier={tier} className="text-[10px]">{value}</TierText>
    </span>
  );
}

const BADGE_CATEGORIES = [
  {
    title: "Savaş",
    badges: [
      { label: "Düellocu", desc: "Solo kill sayısı", tiers: [{ t: "silver", v: "2+" }, { t: "gold", v: "3+" }, { t: "diamond", v: "4+" }, { t: "grandmaster", v: "6+" }, { t: "challenger", v: "8+" }] },
      { label: "Yüksek KDA", desc: "(Kill+Assist)/Death oranı, min 5 K+A", tiers: [{ t: "gold", v: "4+" }, { t: "emerald", v: "5+" }, { t: "diamond", v: "7+" }, { t: "grandmaster", v: "10+" }, { t: "challenger", v: "15+" }] },
      { label: "Ölümsüz", desc: "0 ölüm ile galibiyet", tiers: [{ t: "emerald", v: "Galibiyet" }, { t: "diamond", v: "10+ K+A" }, { t: "challenger", v: "15+ K+A" }] },
      { label: "İlk Kan", desc: "Maçta ilk öldürme", tiers: [{ t: "gold", v: "First Blood" }] },
      { label: "PENTA KILL", desc: "5 kişiyi ard arda öldürme", tiers: [{ t: "challenger", v: "Pentakill" }] },
      { label: "Son Nefes", desc: "10 HP altında hayatta kalma", tiers: [{ t: "silver", v: "1x" }, { t: "gold", v: "2x" }, { t: "diamond", v: "3x" }, { t: "challenger", v: "5x" }] },
      { label: "Kaçış Ustası", desc: "Savuşturulan skillshot sayısı", tiers: [{ t: "gold", v: "20+" }, { t: "emerald", v: "35+" }, { t: "diamond", v: "50+" }, { t: "challenger", v: "70+" }] },
    ],
  },
  {
    title: "Hasar",
    badges: [
      { label: "Hasar Makinesi", desc: "Takım toplam hasarındaki pay (%)", tiers: [{ t: "silver", v: "%28" }, { t: "gold", v: "%30" }, { t: "diamond", v: "%35" }, { t: "grandmaster", v: "%42" }, { t: "challenger", v: "%50" }] },
      { label: "Yüksek DPM", desc: "Dakika başı şampiyonlara verilen hasar", tiers: [{ t: "gold", v: "600" }, { t: "emerald", v: "800" }, { t: "diamond", v: "1000" }, { t: "grandmaster", v: "1200" }, { t: "challenger", v: "1500" }] },
      { label: "Duvar", desc: "Takım için alınan hasar payı (Top/JG/Sup)", tiers: [{ t: "gold", v: "%28" }, { t: "emerald", v: "%35" }, { t: "diamond", v: "%45" }] },
    ],
  },
  {
    title: "Farming & Objektif",
    badges: [
      { label: "CS Ustası", desc: "İlk 10dk CS (Top/Mid/ADC)", tiers: [{ t: "gold", v: "65" }, { t: "emerald", v: "72" }, { t: "diamond", v: "80" }, { t: "grandmaster", v: "88" }, { t: "challenger", v: "95" }] },
      { label: "CS Baskını", desc: "Lane rakibine max CS farkı", tiers: [{ t: "gold", v: "+15" }, { t: "emerald", v: "+25" }, { t: "diamond", v: "+40" }, { t: "challenger", v: "+60" }] },
      { label: "Altın Madencisi", desc: "Dakika başı gold", tiers: [{ t: "gold", v: "400" }, { t: "emerald", v: "480" }, { t: "diamond", v: "550" }, { t: "challenger", v: "650" }] },
      { label: "Kule Yıkıcı", desc: "Alınan kule plakası", tiers: [{ t: "gold", v: "3" }, { t: "emerald", v: "5" }, { t: "diamond", v: "7" }, { t: "challenger", v: "10" }] },
      { label: "Hırsız", desc: "Çalınan epic monster", tiers: [{ t: "diamond", v: "1" }, { t: "grandmaster", v: "2" }, { t: "challenger", v: "3" }] },
    ],
  },
  {
    title: "Görüş & Takım",
    badges: [
      { label: "Görüş Ustası", desc: "Dakika başı vision score", tiers: [{ t: "gold", v: "1.0" }, { t: "emerald", v: "1.5" }, { t: "diamond", v: "2.0" }, { t: "challenger", v: "2.5" }] },
      { label: "Ward Ustası", desc: "Kontrol ward sayısı", tiers: [{ t: "silver", v: "4" }, { t: "gold", v: "7" }, { t: "emerald", v: "10" }, { t: "diamond", v: "15" }] },
      { label: "Takım Oyuncusu", desc: "Kill katılım oranı", tiers: [{ t: "gold", v: "%65" }, { t: "emerald", v: "%72" }, { t: "diamond", v: "%80" }, { t: "challenger", v: "%90" }] },
    ],
  },
  {
    title: "Diğer",
    badges: [
      { label: "????", desc: "Rozet kazanılamadı + 6'dan fazla ölüm", tiers: [{ t: "silver", v: "????" }] },
    ],
  },
  {
    title: "Negatif / Uyarı",
    badges: [
      { label: "Erken Ölüm", desc: "10dk başına ortalama 3+ ölüm", tiers: [{ t: "silver", v: "3+/10dk" }], negative: true },
      { label: "Altın Kaybı", desc: "Takım goldda önde ama maç kaybedilmiş", tiers: [{ t: "silver", v: "Gold↑ + Kayıp" }], negative: true },
      { label: "Kayıp Serisi", desc: "Art arda 3+ mağlubiyet", tiers: [{ t: "silver", v: "3+ kayıp" }], negative: true },
      { label: "[Şampiyon] ile Kötü", desc: "Belirli şampiyonla %35 altı kazanma oranı (3+ maç)", tiers: [{ t: "silver", v: "≤%35 WR" }], negative: true },
    ],
  },
];

const ELW_METRICS = [
  { key: "kda",      label: "KDA",           desc: "(Kill + Assist) / Death oranı (log ölçek)", max: "≈9 = max" },
  { key: "dpm",      label: "Hasar/dk",      desc: "Dakika başı şampiyonlara verilen hasar", max: "1500 DPM = max" },
  { key: "gpm",      label: "Gold/dk",       desc: "Dakika başı kazanılan gold",         max: "700 GPM = max" },
  { key: "kp",       label: "Kill Katılımı", desc: "Takım kill'lerine katılım oranı",    max: "%100 = max" },
  { key: "vision",   label: "Görüş/dk",      desc: "Dakika başı vision score",           max: "3.0 VS/dk = max" },
  { key: "towerDmg", label: "Kule Hasarı",   desc: "Kulelere verilen toplam hasar",      max: "10000 = max" },
  { key: "objDmg",   label: "Objektif Hasarı",desc: "Baron/Dragon/Herald hasarı",        max: "30000 = max" },
  { key: "tankPct",  label: "Tank Katkısı",  desc: "Takım için alınan hasar payı",       max: "%100 = max" },
  { key: "healing",  label: "İyileştirme & Kalkan",  desc: "Takım arkadaşlarına heal + shield /dk", max: "800/dk = max" },
];

// Bireysel mod ağırlıkları — backend ElwScoreService.INDIVIDUAL_WEIGHTS ile birebir (2026-06-25).
// Destek 3 alt-tipe ayrılır (otomatik seçilir): Şifa (enchanter), Hasar, Tank.
// Ek: tüm rollere eşit CC bonusu (1.0, bonus-only) + ölüm dengesi (×0.4). Galibiyet/Mağlubiyet
// puana GİRMEZ — "sonuca değil, ne yaptığına" göre puan.
const ELW_WEIGHTS = {
  TOP:     { kda: 2.5, dpm: 2.0, gpm: 1.5, kp: 1.5, vision: 1.0, towerDmg: 2.0, objDmg: 0.5, tankPct: 1.0, healing: 0.0 },
  JUNGLE:  { kda: 2.5, dpm: 1.5, gpm: 1.0, kp: 2.0, vision: 2.0, towerDmg: 0.0, objDmg: 2.5, tankPct: 0.5, healing: 0.0 },
  MIDDLE:  { kda: 2.5, dpm: 2.5, gpm: 2.0, kp: 2.0, vision: 1.0, towerDmg: 1.5, objDmg: 0.5, tankPct: 0.0, healing: 0.0 },
  BOTTOM:  { kda: 2.5, dpm: 3.0, gpm: 2.0, kp: 2.0, vision: 0.5, towerDmg: 1.5, objDmg: 0.5, tankPct: 0.0, healing: 0.0 },
  UTILITY_ENCHANTER: { kda: 2.5, dpm: 0.5, gpm: 0.5, kp: 2.0, vision: 2.5, towerDmg: 0.0, objDmg: 0.5, tankPct: 1.0, healing: 2.0 },
  UTILITY_DAMAGE:    { kda: 2.0, dpm: 2.0, gpm: 0.5, kp: 2.5, vision: 2.0, towerDmg: 0.0, objDmg: 0.5, tankPct: 0.5, healing: 2.0 },
  UTILITY_TANK:      { kda: 2.0, dpm: 1.0, gpm: 0.5, kp: 2.5, vision: 2.5, towerDmg: 0.0, objDmg: 0.5, tankPct: 2.0, healing: 0.5 },
};

const ROLE_LABELS = {
  TOP: "Top", JUNGLE: "Orman", MIDDLE: "Orta", BOTTOM: "ADC",
  UTILITY_ENCHANTER: "Dst·Şifa", UTILITY_DAMAGE: "Dst·Hasar", UTILITY_TANK: "Dst·Tank",
};

const LANE_METRICS = [
  { name: "KDA", desc: "(K+A)/D farkı, ±3 normalize" },
  { name: "CS", desc: "CS/dk farkı, ±3 normalize" },
  { name: "Gold", desc: "Toplam gold farkı, ±4000" },
  { name: "Hasar", desc: "Şampiyonlara verilen hasar farkı, ±8000" },
  { name: "Alınan Hasar", desc: "Fazla hasar almak aktiflik göstergesi, ağırlık rolle değişir" },
  { name: "Kule Hasarı", desc: "Kulelere verilen hasar farkı, ±5000" },
  { name: "Obj. Hasarı", desc: "Objektif hasarı (ejder/baron), ±15000" },
  { name: "Görüş", desc: "Vision score (%60) + ward activity (%40) birleşik" },
  { name: "İyileştirme", desc: "Takım arkadaşlarına heal + kalkan farkı" },
];

const LANE_WEIGHTS = [
  { role: "Top",    vals: [3.0, 2.5, 2.0, 2.5, 1.5, 2.0, 0.5, 1.5, 0.5] },
  { role: "Orman",  vals: [3.0, 1.5, 2.0, 2.0, 1.0, 1.0, 3.5, 2.5, 0.5] },
  { role: "Orta",   vals: [3.0, 2.5, 2.0, 3.0, 0.5, 1.5, 0.5, 1.5, 0.5] },
  { role: "Alt",    vals: [3.0, 3.0, 2.5, 3.5, 0.5, 1.5, 0.5, 1.5, 0.5] },
  { role: "Destek", vals: [3.0, 0.0, 1.0, 1.0, 2.5, 0.5, 0.5, 3.5, 2.5] },
];

const PERF_LABELS = [
  { label: "Durdurulamaz", desc: "1-2. sıra + galibiyet + yüksek KDA", color: "text-emerald-400" },
  { label: "Lider",        desc: "1-3. sıra + galibiyet",              color: "text-emerald-400" },
  { label: "Geç Açılan",   desc: "Erken gold düşük → geç gold yüksek + galibiyet", color: "text-blue-400" },
  { label: "Erken Baskın",  desc: "Erken gold yüksek → düşüş + yenilgi", color: "text-yellow-400" },
  { label: "Dirençli",     desc: "Yenilgiye rağmen 1-3. sıra",         color: "text-blue-400" },
  { label: "Katkıcı",      desc: "Galibiyet, 4-6. sıra",              color: "text-gray-400" },
  { label: "Ortalama",     desc: "5-7. sıra",                          color: "text-gray-500" },
  { label: "Mücadele",     desc: "8-10. sıra",                         color: "text-red-400" },
];

export default function BadgeGuideModal({ open, onClose }) {
  const [tab, setTab] = useState("badges");

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Portal ile body'ye render — navbar'ın backdrop-filter/transform'u yüzünden
  // fixed konum bozulmasın (modal viewport'a göre ortalansın).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-card border border-edge rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge/50">
          <div>
            <h2 className="text-base font-bold text-white">Rozet & Skor Rehberi</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Performans metrikleri ve rozet sistemi hakkında bilgi</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-edge/30">
          {[
            { key: "badges", label: "Rozetler" },
            { key: "elw", label: "ELW Score" },
            { key: "lane", label: "Koridor Analizi" },
            { key: "labels", label: "Performans Etiketleri" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-[11px] font-medium transition-colors cursor-pointer ${tab === t.key ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ROZETLER TAB */}
          {tab === "badges" && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-4 pb-1.5 border-b border-edge/30">
                {TIERS.map((t) => <TierText key={t.key} tier={t.key} className="text-[10px] capitalize">{t.label}</TierText>)}
              </div>
              <p className="text-[10px] text-gray-500 text-center pb-1">
                Maç kartlarında yalnızca <span className="text-gray-300">Master / Grandmaster / Challenger</span> rozetleri renkli vurgulanır; alt tier'lar sade gri gösterilir.
              </p>
              {BADGE_CATEGORIES.map((cat) => (
                <div key={cat.title}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${cat.badges.some(b => b.negative) ? "text-red-400" : "text-gray-300"}`}>{cat.title}</h3>
                  <div className="space-y-2.5">
                    {cat.badges.map((b) => (
                      <div key={b.label} className="flex items-start gap-3 py-1">
                        <div className="w-28 flex-shrink-0">
                          <p className={`text-[12px] font-semibold ${b.negative ? "text-red-400" : "text-gray-200"}`}>{b.label}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{b.desc}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {b.tiers.map((t, i) => <TierPill key={i} tier={t.t} value={t.v} isNegative={b.negative} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ELW SCORE TAB */}
          {tab === "elw" && (
            <div className="space-y-5">
              <div className="tip-dark bg-[#0a0e14] rounded-lg p-4 border border-edge/30">
                <h3 className="text-sm font-bold text-white mb-1">ELW Score Nedir?</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Her maçta 10 oyuncunun performansı 8 farklı metrikle puanlanır. Her metrik 0-1 arası normalize edilir ve koridora özel ağırlıklarla çarpılır. Sonuç Z-score ile 0-10 arasına dönüştürülür. Maç ortalaması = 5.0.
                </p>
              </div>

              {/* Metrikler */}
              <div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Metrikler</h3>
                <div className="space-y-2">
                  {ELW_METRICS.map((m) => (
                    <div key={m.key} className="flex items-center gap-3 py-1.5 border-b border-edge/15">
                      <span className="text-[11px] font-semibold text-gray-200 w-32">{m.label}</span>
                      <span className="text-[10px] text-gray-500 flex-1">{m.desc}</span>
                      <span className="text-[9px] text-gray-600">{m.max}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rol ağırlık tablosu */}
              <div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Koridor Çarpanları <span className="text-gray-600 normal-case font-normal">(Bireysel mod)</span></h3>
                <p className="text-[10px] text-gray-500 mb-3">Her koridorun güçlü olması gereken metriklere daha fazla ağırlık verilir. Destek; maçtaki şifa/kalkan, hasar ve alınan-hasar oranına göre <strong className="text-gray-400">Şifa, Hasar veya Tank</strong> alt-tipine ayrılır — Leona/Alistar gibi tank destekler tank katkısından tam puan alır.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-edge/30">
                        <th className="text-left text-gray-500 py-1.5 pr-2">Metrik</th>
                        {Object.keys(ELW_WEIGHTS).map((role) => (
                          <th key={role} className="text-center text-gray-400 py-1.5 px-1 font-semibold">{ROLE_LABELS[role]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ELW_METRICS.map((m) => (
                        <tr key={m.key} className="border-b border-edge/10">
                          <td className="text-gray-300 py-1.5 pr-2 font-medium">{m.label}</td>
                          {Object.entries(ELW_WEIGHTS).map(([role, weights]) => {
                            const v = weights[m.key];
                            const maxInRow = Math.max(...Object.values(ELW_WEIGHTS).map((w) => w[m.key]));
                            const isMax = v === maxInRow && v > 0;
                            return (
                              <td key={role} className={`text-center py-1.5 px-1 font-mono ${v === 0 ? "text-gray-700" : isMax ? "text-emerald-400 font-bold" : "text-gray-400"}`}>
                                {v === 0 ? "—" : v.toFixed(1)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Skor aralıkları */}
              <div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Skor Aralıkları</h3>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { range: "8-10", label: "Olağanüstü", color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    { range: "6-8",  label: "İyi",        color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { range: "4-6",  label: "Ortalama",   color: "text-blue-400",    bg: "bg-blue-500/10" },
                    { range: "2-4",  label: "Düşük",      color: "text-gray-400",    bg: "bg-gray-500/10" },
                    { range: "0-2",  label: "Kötü",       color: "text-red-400",     bg: "bg-red-500/10" },
                  ].map((s) => (
                    <span key={s.range} className={`px-2.5 py-1 rounded ${s.bg} ${s.color} text-[10px] font-semibold`}>
                      {s.range}: {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* KORİDOR ANALİZİ TAB */}
          {tab === "lane" && (
            <div className="space-y-5">
              <div className="tip-dark bg-[#0a0e14] rounded-lg p-4 border border-edge/30">
                <h3 className="text-sm font-bold text-white mb-1">Koridor Analizi Nedir?</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Her koridor, aynı roldeki iki oyuncuyu <strong className="text-gray-200">9 metrik</strong> üzerinden karşılaştırır. Her metrik -1 ile +1 arası normalize edilir ve rol bazlı ağırlıkla çarpılır. Pozitif skor mavi tarafın, negatif skor kırmızı tarafın üstünlüğünü gösterir.
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  <strong className="text-gray-400">Not:</strong> Koridor analizi sadece 1v1 karşılaştırmadır. ELW Score ise maçtaki 10 oyuncuya göre hesaplanır — ikisi birbirinden bağımsızdır. Bir oyuncu lane'de dengeli olabilir ama takım katkısı sayesinde yüksek ELW alabilir.
                </p>
              </div>

              {/* Verdict eşikleri */}
              <div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Sonuç Eşikleri</h3>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "◀◀ Baskın", range: "> +5", color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/25" },
                    { label: "◀ Önde", range: "+2 ~ +5", color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15" },
                    { label: "= Dengeli", range: "-2 ~ +2", color: "text-gray-400", bg: "bg-card/50", border: "border-edge/30" },
                    { label: "▶ Önde", range: "-2 ~ -5", color: "text-red-400", bg: "bg-red-500/8", border: "border-red-500/15" },
                    { label: "▶▶ Baskın", range: "< -5", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/25" },
                  ].map(v => (
                    <div key={v.label} className={`text-center py-2 rounded-lg border text-[10px] font-bold ${v.color} ${v.bg} ${v.border}`}>
                      <p>{v.label}</p>
                      <p className="text-[9px] font-normal opacity-70 mt-0.5">{v.range}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 9 Metrik */}
              <div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">9 Metrik</h3>
                <div className="space-y-2">
                  {LANE_METRICS.map((m) => (
                    <div key={m.name} className="flex items-center gap-3 py-1.5 border-b border-edge/15">
                      <span className="text-[11px] font-semibold text-blue-400 w-28">{m.name}</span>
                      <span className="text-[10px] text-gray-500 flex-1">{m.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rol ağırlık tablosu */}
              <div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Rol Bazlı Ağırlıklar</h3>
                <p className="text-[10px] text-gray-500 mb-3">Her koridorun güçlü olması gereken metriklere daha fazla ağırlık verilir. Yüksek değerler yeşil ile gösterilir.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-edge/30">
                        <th className="text-left text-gray-500 py-1.5 pr-2">Rol</th>
                        {LANE_METRICS.map(m => (
                          <th key={m.name} className="text-center text-gray-400 py-1.5 px-1 font-semibold">{m.name.split(" ")[0]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {LANE_WEIGHTS.map(r => (
                        <tr key={r.role} className="border-b border-edge/10">
                          <td className="text-gray-300 font-medium py-1.5 pr-2">{r.role}</td>
                          {r.vals.map((v, i) => (
                            <td key={i} className={`text-center py-1.5 px-1 font-mono ${v >= 3.0 ? "text-emerald-400 font-bold" : v >= 2.0 ? "text-blue-400" : v >= 1.0 ? "text-gray-400" : "text-gray-600"}`}>
                              {v === 0 ? "—" : v.toFixed(1)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PERFORMANS ETİKETLERİ TAB */}
          {tab === "labels" && (
            <div className="space-y-5">
              <div className="tip-dark bg-[#0a0e14] rounded-lg p-4 border border-edge/30">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Her maç sonunda ELW Score, sıralama ve Timeline verisi analiz edilerek performans etiketi belirlenir. Timeline API maç içi gold/XP değişimini dakika dakika takip eder.
                </p>
              </div>
              <div className="space-y-2">
                {PERF_LABELS.map((pl) => (
                  <div key={pl.label} className="flex items-center gap-3 py-2 border-b border-edge/15">
                    <span className={`text-[12px] font-bold w-28 ${pl.color}`}>{pl.label}</span>
                    <span className="text-[10px] text-gray-500 flex-1">{pl.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
