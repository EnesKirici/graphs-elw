"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const DEFAULT_BADGES = {
  solo_killer:    { label: "Duellocu",      threshold: 2, enabled: true, desc: "Solo kills >= {threshold}" },
  high_kda:       { label: "Yüksek KDA",    threshold: 4, enabled: true, desc: "KDA >= {threshold} ve K+A >= 5" },
  immortal:       { label: "Ölümsüz",       threshold: 0, enabled: true, desc: "0 ölüm + galibiyet" },
  first_blood:    { label: "İlk Kan",       threshold: 0, enabled: true, desc: "İlk kanı alan oyuncu" },
  penta:          { label: "PENTA KILL",     threshold: 0, enabled: true, desc: "Penta kill yapan oyuncu" },
  quadra:         { label: "Quadra Kill",    threshold: 0, enabled: true, desc: "Quadra kill yapan oyuncu" },
  survivor:       { label: "Son Nefes",      threshold: 1, enabled: true, desc: "Düşük HP ile hayatta kalma >= {threshold}" },
  dodge_master:   { label: "Kaçış Ustası",   threshold: 20, enabled: true, desc: "Skillshot dodge >= {threshold}" },
  damage_dealer:  { label: "Hasar Makinesi", threshold: 0.28, enabled: true, desc: "Takım hasarı >= %{threshold}" },
  high_dpm:       { label: "Yüksek DPM",    threshold: 600, enabled: true, desc: "Dakika başı hasar >= {threshold}" },
  tank:           { label: "Duvar",          threshold: 0.28, enabled: true, desc: "Alınan hasar >= %{threshold} (Tank rolleri)" },
  cs_master:      { label: "CS Ustası",      threshold: 65, enabled: true, desc: "İlk 10dk CS >= {threshold}" },
  cs_lead:        { label: "CS Baskını",     threshold: 15, enabled: true, desc: "CS avantajı >= {threshold}" },
  gold_maker:     { label: "Altın Madencisi",threshold: 400, enabled: true, desc: "Dakika başı altın >= {threshold}" },
  plate_taker:    { label: "Kule Yıkıcı",   threshold: 3, enabled: true, desc: "Kule plakası >= {threshold}" },
  objective_steal:{ label: "Hırsız",         threshold: 1, enabled: true, desc: "Ejderha/Baron çalma >= {threshold}" },
  first_tower:    { label: "İlk Kule",       threshold: 0, enabled: true, desc: "İlk kuleyi yıkan oyuncu" },
  vision_master:  { label: "Görüş Ustası",   threshold: 1.0, enabled: true, desc: "Görüş skoru/dk >= {threshold}" },
  ward_master:    { label: "Ward Ustası",     threshold: 4, enabled: true, desc: "Kontrol ward >= {threshold}" },
  team_player:    { label: "Takım Oyuncusu", threshold: 0.65, enabled: true, desc: "Kill katılımı >= %{threshold}" },
};

const CATEGORIES = {
  "Savaş":    ["solo_killer", "high_kda", "immortal", "first_blood", "penta", "quadra", "survivor", "dodge_master"],
  "Hasar":    ["damage_dealer", "high_dpm", "tank"],
  "Farm":     ["cs_master", "cs_lead", "gold_maker"],
  "Objektif": ["plate_taker", "objective_steal", "first_tower"],
  "Görüş":    ["vision_master", "ward_master"],
  "Takım":    ["team_player"],
};

export default function BadgesSettingsPage() {
  const [badges, setBadges] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/settings/badge_config")
      .then((res) => setBadges(res.value || DEFAULT_BADGES))
      .catch(() => setBadges(DEFAULT_BADGES))
      .finally(() => setLoading(false));
  }, []);

  function updateBadge(key, field, value) {
    setBadges((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/badge_config", { value: badges });
      setMsg("Kaydedildi!");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setMsg("Hata oluştu!");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 rounded-xl bg-[#0d1117] animate-pulse" />;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Rozet Sistemi</h1>
          <p className="text-sm text-gray-500 mt-1">Rozet eşik değerlerini ve görünümlerini düzenle</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes("Hata") ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(CATEGORIES).map(([category, keys]) => (
          <div key={category} className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1b2230]/50">
              <h3 className="text-sm font-semibold text-gray-200">{category} Rozetleri</h3>
            </div>
            <div className="divide-y divide-[#1b2230]/30">
              {keys.map((key) => {
                const b = badges[key] || DEFAULT_BADGES[key];
                if (!b) return null;
                return (
                  <div key={key} className={`px-5 py-3.5 flex items-center gap-4 transition-opacity ${b.enabled === false ? "opacity-40" : ""}`}>
                    {/* Toggle */}
                    <button
                      onClick={() => updateBadge(key, "enabled", !(b.enabled ?? true))}
                      className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${
                        b.enabled !== false ? "bg-emerald-500" : "bg-gray-700"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                        b.enabled !== false ? "translate-x-4.5" : "translate-x-0.5"
                      }`} />
                    </button>

                    {/* Label */}
                    <input value={b.label} onChange={(e) => updateBadge(key, "label", e.target.value)}
                      className="bg-white/5 border border-[#1b2230] rounded px-2.5 py-1.5 text-sm text-gray-200 w-36" />

                    {/* Açıklama */}
                    <span className="text-xs text-gray-500 flex-1 truncate">{b.desc?.replace("{threshold}", b.threshold)}</span>

                    {/* Threshold */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-600">Eşik:</span>
                      <input type="number" step="any" value={b.threshold ?? 0}
                        onChange={(e) => updateBadge(key, "threshold", Number(e.target.value))}
                        className="bg-white/5 border border-[#1b2230] rounded px-2 py-1 text-xs text-gray-300 w-20 text-center" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
