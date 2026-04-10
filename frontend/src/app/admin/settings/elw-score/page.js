"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const DEFAULT_CONFIG = {
  labels: [
    { min: 8.0, label: "Olağanüstü" },
    { min: 6.5, label: "Çok İyi" },
    { min: 5.0, label: "İyi" },
    { min: 3.5, label: "Mücadele" },
    { min: 0,   label: "Zor Maç" },
  ],
  colorThresholds: { emerald: 7, blue: 5, yellow: 3 },
  glowThreshold: 8.5,
  shimmerEnabled: true,
};

const COLOR_CLASSES = {
  emerald: "bg-emerald-500", blue: "bg-blue-500", yellow: "bg-yellow-500", red: "bg-red-500",
};

export default function ElwScoreSettingsPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/settings/elw_score")
      .then((res) => setConfig(res.value || DEFAULT_CONFIG))
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setLoading(false));
  }, []);

  function updateLabel(idx, field, value) {
    setConfig((prev) => ({
      ...prev,
      labels: prev.labels.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    }));
  }

  function updateColor(color, value) {
    setConfig((prev) => ({
      ...prev,
      colorThresholds: { ...prev.colorThresholds, [color]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/elw_score", { value: config });
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
          <h1 className="text-xl font-bold text-white">ELW Skor Ayarları</h1>
          <p className="text-sm text-gray-500 mt-1">Skor etiketleri, renk eşikleri ve glow efekti ayarları</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes("Hata") ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skor Etiketleri */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Skor Etiketleri</h3>
          <p className="text-xs text-gray-500 mb-4">Üsttekiler öncelikli — skor bu değerin üstündeyse bu etiket gösterilir</p>
          <div className="space-y-3">
            {config.labels.map((l, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-600">{">="}</span>
                  <input type="number" step="0.5" value={l.min}
                    onChange={(e) => updateLabel(idx, "min", Number(e.target.value))}
                    className="bg-white/5 border border-[#1b2230] rounded px-2 py-1.5 text-sm text-gray-300 w-16 text-center" />
                </div>
                <input value={l.label} onChange={(e) => updateLabel(idx, "label", e.target.value)}
                  className="bg-white/5 border border-[#1b2230] rounded px-3 py-1.5 text-sm text-gray-200 flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Renk Eşikleri */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Renk Eşikleri</h3>
          <p className="text-xs text-gray-500 mb-4">Skor bu değerin üstündeyse ilgili renk kullanılır</p>
          <div className="space-y-4">
            {Object.entries(config.colorThresholds).map(([color, value]) => (
              <div key={color} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${COLOR_CLASSES[color]}`} />
                <span className="text-sm text-gray-300 w-16 capitalize">{color}</span>
                <span className="text-[10px] text-gray-600">{">="}</span>
                <input type="number" step="0.5" value={value}
                  onChange={(e) => updateColor(color, Number(e.target.value))}
                  className="bg-white/5 border border-[#1b2230] rounded px-2 py-1.5 text-sm text-gray-300 w-20 text-center" />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-sm text-gray-500 w-16">red</span>
              <span className="text-[10px] text-gray-600">altı</span>
              <span className="text-xs text-gray-600">({`< ${config.colorThresholds.yellow}`} otomatik)</span>
            </div>
          </div>

          {/* Glow Ayarları */}
          <div className="mt-6 pt-5 border-t border-[#1b2230]/50">
            <h4 className="text-sm font-semibold text-gray-200 mb-3">Glow Efekti</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-28">Glow Eşiği</span>
                <input type="number" step="0.5" value={config.glowThreshold}
                  onChange={(e) => setConfig((prev) => ({ ...prev, glowThreshold: Number(e.target.value) }))}
                  className="bg-white/5 border border-[#1b2230] rounded px-2 py-1.5 text-sm text-gray-300 w-20 text-center" />
                <span className="text-[10px] text-gray-600">ve üzeri skor parlama efekti alır</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-28">Shimmer Text</span>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, shimmerEnabled: !prev.shimmerEnabled }))}
                  className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
                    config.shimmerEnabled ? "bg-emerald-500" : "bg-gray-700"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    config.shimmerEnabled ? "translate-x-4.5" : "translate-x-0.5"
                  }`} />
                </button>
                <span className="text-[10px] text-gray-600">Yüksek skorlarda parlak metin efekti</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
