"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const TIER_COLORS = {
  challenger:  { label: "Challenger",  bg: "bg-amber-400",   text: "text-amber-400",   ring: "ring-amber-400/40" },
  grandmaster: { label: "Grandmaster", bg: "bg-red-500",     text: "text-red-400",     ring: "ring-red-400/40" },
  diamond:     { label: "Diamond",     bg: "bg-blue-400",    text: "text-blue-400",    ring: "ring-blue-400/40" },
  emerald:     { label: "Emerald",     bg: "bg-emerald-500", text: "text-emerald-400", ring: "ring-emerald-400/40" },
  gold:        { label: "Gold",        bg: "bg-yellow-600",  text: "text-yellow-500",  ring: "ring-yellow-500/40" },
  silver:      { label: "Silver",      bg: "bg-gray-400",    text: "text-gray-400",    ring: "ring-gray-400/40" },
};

const DEFAULT_BADGES = {
  solo_killer:    { label: "Duellocu",       category: "combat",    enabled: true, threshold: 2,    stat: "soloKills",                    tiers: { gold: 2, diamond: 4, grandmaster: 6, challenger: 8 } },
  high_kda:       { label: "Yuksek KDA",     category: "combat",    enabled: true, threshold: 4,    stat: "kda",                          tiers: { emerald: 5, diamond: 7, grandmaster: 10, challenger: 15 } },
  immortal:       { label: "Olumsuz",        category: "combat",    enabled: true, threshold: 0,    stat: "deaths (0) + win",             tiers: { diamond: 10, challenger: 15 } },
  first_blood:    { label: "Ilk Kan",        category: "combat",    enabled: true, threshold: 0,    stat: "firstBloodKill",               tiers: { gold: 0 } },
  penta:          { label: "PENTA KILL",     category: "combat",    enabled: true, threshold: 0,    stat: "pentaKills",                   tiers: { challenger: 0 } },
  quadra:         { label: "Quadra Kill",    category: "combat",    enabled: true, threshold: 0,    stat: "quadraKills",                  tiers: { grandmaster: 0 } },
  survivor:       { label: "Son Nefes",      category: "combat",    enabled: true, threshold: 1,    stat: "survivedSingleDigitHpCount",   tiers: { gold: 2, diamond: 3, challenger: 5 } },
  dodge_master:   { label: "Kacis Ustasi",   category: "combat",    enabled: true, threshold: 20,   stat: "skillshotsDodged",             tiers: { emerald: 35, diamond: 50, challenger: 70 } },
  damage_dealer:  { label: "Hasar Makinesi", category: "damage",    enabled: true, threshold: 0.28, stat: "teamDamagePercentage",         tiers: { gold: 0.30, diamond: 0.35, grandmaster: 0.42, challenger: 0.50 } },
  high_dpm:       { label: "Yuksek DPM",     category: "damage",    enabled: true, threshold: 600,  stat: "damagePerMinute",              tiers: { emerald: 800, diamond: 1000, grandmaster: 1200, challenger: 1500 } },
  tank:           { label: "Duvar",          category: "damage",    enabled: true, threshold: 0.28, stat: "damageTakenPct (TOP/JG/SUP)",  tiers: { emerald: 0.35, diamond: 0.45 } },
  cs_master:      { label: "CS Ustasi",      category: "farming",   enabled: true, threshold: 65,   stat: "laneMinionsFirst10Min",        tiers: { emerald: 72, diamond: 80, grandmaster: 88, challenger: 95 } },
  cs_lead:        { label: "CS Baskini",     category: "farming",   enabled: true, threshold: 15,   stat: "maxCsAdvantage",               tiers: { emerald: 25, diamond: 40, challenger: 60 } },
  gold_maker:     { label: "Altin Madencisi",category: "farming",   enabled: true, threshold: 400,  stat: "goldPerMinute",                tiers: { emerald: 480, diamond: 550, challenger: 650 } },
  plate_taker:    { label: "Kule Yikici",    category: "objective", enabled: true, threshold: 3,    stat: "turretPlatesTaken",            tiers: { emerald: 5, diamond: 7, challenger: 10 } },
  objective_steal:{ label: "Hirsiz",         category: "objective", enabled: true, threshold: 1,    stat: "epicMonsterSteals",            tiers: { grandmaster: 2, challenger: 3 } },
  first_tower:    { label: "Ilk Kule",       category: "objective", enabled: true, threshold: 0,    stat: "firstTowerKill",               tiers: { gold: 0 } },
  vision_master:  { label: "Gorus Ustasi",   category: "vision",    enabled: true, threshold: 1.0,  stat: "visionScorePerMinute",         tiers: { emerald: 1.5, diamond: 2.0, challenger: 2.5 } },
  ward_master:    { label: "Ward Ustasi",    category: "vision",    enabled: true, threshold: 4,    stat: "controlWardsPlaced",           tiers: { gold: 7, emerald: 10, diamond: 15 } },
  team_player:    { label: "Takim Oyuncusu", category: "teamplay",  enabled: true, threshold: 0.65, stat: "killParticipation",            tiers: { emerald: 0.72, diamond: 0.80, challenger: 0.90 } },
};

const CATEGORIES = {
  combat:    { label: "Savas",    icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-red-400" },
  damage:    { label: "Hasar",    icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0 .9.656 1.344 1.5 2 .344.656.5 1.1.5 2a1 1 0 01-2 0c0-.4.156-.744.344-1.1C8.844 12.344 8 12.1 8 11c-.9-.656-1.344-1.5-2-1.5-.656-.344-1.1-.5-2-.5a1 1 0 010-2", color: "text-orange-400" },
  farming:   { label: "Farm",     icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-yellow-400" },
  objective: { label: "Objektif", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "text-purple-400" },
  vision:    { label: "Gorus",    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", color: "text-cyan-400" },
  teamplay:  { label: "Takim",    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", color: "text-blue-400" },
};

const TIER_ORDER = ["silver", "gold", "emerald", "diamond", "grandmaster", "challenger"];

export default function BadgesSettingsPage() {
  const [badges, setBadges] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    fetchAdmin("/settings/badge_config")
      .then((res) => setBadges(res.value || DEFAULT_BADGES))
      .catch(() => setBadges(DEFAULT_BADGES))
      .finally(() => setLoading(false));
  }, []);

  function updateBadge(key, field, value) {
    setBadges((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function updateTier(badgeKey, tierKey, value) {
    setBadges((prev) => ({
      ...prev,
      [badgeKey]: {
        ...prev[badgeKey],
        tiers: { ...prev[badgeKey].tiers, [tierKey]: value === "" ? undefined : Number(value) },
      },
    }));
  }

  function removeTier(badgeKey, tierKey) {
    setBadges((prev) => {
      const tiers = { ...prev[badgeKey].tiers };
      delete tiers[tierKey];
      return { ...prev, [badgeKey]: { ...prev[badgeKey], tiers } };
    });
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/badge_config", { value: badges });
      setMsg("ok");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("error"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-white/2 animate-pulse" />;

  const grouped = {};
  Object.entries(badges).forEach(([key, badge]) => {
    const cat = badge.category || "combat";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ key, ...badge });
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Rozet Sistemi</h1>
          <p className="text-sm text-gray-500 mt-1">Mac icinde kazanilan rozetlerin esik degerleri ve tier sinirlari</p>
        </div>
        <div className="flex items-center gap-3">
          {msg === "ok" && <span className="text-xs text-emerald-400">Kaydedildi!</span>}
          {msg === "error" && <span className="text-xs text-red-400">Hata!</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* Bilgi */}
      <div className="glass rounded-2xl p-5 mb-6 border border-blue-500/10">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p><strong className="text-gray-300">Rozetler</strong>, oyuncunun mac icindeki basarilarini ozel ikonlarla gosterir. Her rozet bir <strong className="text-gray-300">esik degeri</strong> (minimum kosul) ve <strong className="text-gray-300">tier sinirlari</strong> (ne kadar iyi oldugunu gosteren rank) icerir.</p>
            <p><strong className="text-gray-300">Tier sistemi:</strong> LoL rank sistemine benzer. Ornegin &quot;Duellocu&quot; rozeti icin 2 solo kill = Gold tier, 4 kill = Diamond, 8 kill = Challenger tier.</p>
            <div className="flex items-center gap-2 mt-2">
              {TIER_ORDER.slice().reverse().map((t) => (
                <span key={t} className={`inline-flex items-center gap-1 text-[10px] ${TIER_COLORS[t].text}`}>
                  <span className={`w-2 h-2 rounded-full ${TIER_COLORS[t].bg}`} />
                  {TIER_COLORS[t].label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kategori gruplari */}
      <div className="space-y-6">
        {Object.entries(CATEGORIES).map(([catKey, cat]) => {
          const items = grouped[catKey] || [];
          if (items.length === 0) return null;

          return (
            <div key={catKey} className="glass rounded-2xl overflow-hidden">
              {/* Kategori baslik */}
              <div className="px-5 py-3.5 border-b border-edge/50 flex items-center gap-2.5">
                <svg className={`w-4 h-4 ${cat.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                </svg>
                <h3 className="text-sm font-semibold text-gray-200">{cat.label} Rozetleri</h3>
                <span className="text-[10px] text-gray-600 ml-auto">{items.length} rozet</span>
              </div>

              {/* Rozet listesi */}
              <div className="divide-y divide-edge/20">
                {items.map((badge) => {
                  const isExpanded = expandedKey === badge.key;
                  const tierEntries = Object.entries(badge.tiers || {}).sort((a, b) => {
                    return TIER_ORDER.indexOf(a[0]) - TIER_ORDER.indexOf(b[0]);
                  });

                  return (
                    <div key={badge.key}>
                      {/* Ana satir */}
                      <div className={`px-5 py-3.5 flex items-center gap-4 transition-opacity ${badge.enabled === false ? "opacity-40" : ""}`}>
                        {/* Toggle */}
                        <button onClick={() => updateBadge(badge.key, "enabled", !(badge.enabled ?? true))}
                          className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${badge.enabled !== false ? "bg-emerald-500" : "bg-gray-700"}`}>
                          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${badge.enabled !== false ? "left-[18px]" : "left-[3px]"}`} />
                        </button>

                        {/* Label */}
                        <input value={badge.label} onChange={(e) => updateBadge(badge.key, "label", e.target.value)}
                          className="bg-white/5 border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-200 w-40 focus:outline-none focus:border-blue-500/50" />

                        {/* Stat */}
                        <span className="text-[11px] text-gray-600 font-mono flex-1 truncate">{badge.stat}</span>

                        {/* Esik */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-gray-600">Esik:</span>
                          <input type="number" step="any" value={badge.threshold ?? 0}
                            onChange={(e) => updateBadge(badge.key, "threshold", Number(e.target.value))}
                            className="w-16 bg-white/5 border border-edge rounded-lg px-2 py-1 text-xs text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                        </div>

                        {/* Tier badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          {tierEntries.map(([tier]) => (
                            <span key={tier} className={`w-2.5 h-2.5 rounded-full ${TIER_COLORS[tier]?.bg || "bg-gray-600"}`} title={TIER_COLORS[tier]?.label} />
                          ))}
                        </div>

                        {/* Genislet */}
                        <button onClick={() => setExpandedKey(isExpanded ? null : badge.key)}
                          className="text-gray-500 hover:text-gray-300 cursor-pointer p-1">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Genisletilmis: Tier duzenle */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-edge/20">
                          <p className="text-[11px] text-gray-500 mb-3">Tier sinirlari — deger ne kadar yuksekse tier o kadar iyi. Kullanilmayan tier&apos;leri kaldirabilirsiniz.</p>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {TIER_ORDER.map((tierKey) => {
                              const tierVal = badge.tiers?.[tierKey];
                              const tierInfo = TIER_COLORS[tierKey];
                              const hasValue = tierVal !== undefined && tierVal !== null;

                              return (
                                <div key={tierKey} className={`rounded-xl p-3 border transition-all ${hasValue ? `bg-white/[0.02] border-edge/50` : "bg-transparent border-dashed border-edge/20 opacity-40"}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-3 h-3 rounded-full ${tierInfo.bg}`} />
                                      <span className={`text-xs font-medium ${hasValue ? tierInfo.text : "text-gray-600"}`}>{tierInfo.label}</span>
                                    </div>
                                    {hasValue ? (
                                      <button onClick={() => removeTier(badge.key, tierKey)} className="text-gray-700 hover:text-red-400 cursor-pointer text-[10px]">Kaldir</button>
                                    ) : (
                                      <button onClick={() => updateTier(badge.key, tierKey, badge.threshold || 0)} className="text-gray-700 hover:text-blue-400 cursor-pointer text-[10px]">Ekle</button>
                                    )}
                                  </div>
                                  {hasValue && (
                                    <input type="number" step="any" value={tierVal}
                                      onChange={(e) => updateTier(badge.key, tierKey, e.target.value)}
                                      className="w-full bg-card border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
