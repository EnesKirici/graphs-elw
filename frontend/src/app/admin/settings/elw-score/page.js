"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const DEFAULT_CONFIG = {
  labels: [
    { min: 8.0, label: "Olaganustu" },
    { min: 6.5, label: "Cok Iyi" },
    { min: 5.0, label: "Iyi" },
    { min: 3.5, label: "Mucadele" },
    { min: 0,   label: "Zor Mac" },
  ],
  colorThresholds: { emerald: 7, blue: 5, yellow: 3 },
  glowThreshold: 8.5,
  shimmerEnabled: true,
  rainbowThreshold: 8.5,
  rainbowRankRequired: 1,
};

const SCORE_COLORS = [
  { key: "emerald", label: "Yesil", css: "bg-emerald-500", textCss: "text-emerald-400", desc: "Mükemmel performans" },
  { key: "blue", label: "Mavi", css: "bg-blue-500", textCss: "text-blue-400", desc: "Iyi performans" },
  { key: "yellow", label: "Sari", css: "bg-yellow-500", textCss: "text-yellow-400", desc: "Ortalama performans" },
  { key: "red", label: "Kirmizi", css: "bg-red-500", textCss: "text-red-400", desc: "Dusuk performans (otomatik)" },
];

function ScorePreview({ score, config }) {
  const label = config.labels.find((l) => score >= l.min) || config.labels[config.labels.length - 1];
  const ct = config.colorThresholds;
  const color = score >= ct.emerald ? "emerald" : score >= ct.blue ? "blue" : score >= ct.yellow ? "yellow" : "red";
  const isRainbow = score >= (config.rainbowThreshold || 8.5) && true;
  const isGlow = score >= (config.glowThreshold || 8.5) && !isRainbow;

  const colorMap = { emerald: "text-emerald-400", blue: "text-blue-400", yellow: "text-yellow-400", red: "text-red-400" };
  const bgMap = { emerald: "bg-emerald-500", blue: "bg-blue-500", yellow: "bg-yellow-500", red: "bg-red-500" };
  const colorLabel = { emerald: "Yesil", blue: "Mavi", yellow: "Sari", red: "Kirmizi" };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-[#1b2230]/50 ${isRainbow ? "bg-gradient-to-r from-amber-500/5 via-cyan-500/5 to-emerald-500/5" : isGlow ? "bg-emerald-500/5" : "bg-white/[0.02]"}`}>
      <div className="flex flex-col items-center w-14">
        <span className={`text-lg font-bold ${isRainbow ? "elw-rainbow-text bg-clip-text text-transparent" : colorMap[color]}`}>
          {score.toFixed(1)}
        </span>
        {isRainbow && <div className="h-0.5 w-10 rounded-full elw-rainbow-bar mt-1" />}
        {isGlow && !isRainbow && <div className={`h-0.5 w-10 rounded-full ${bgMap[color]} mt-1`} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-300">{label?.label}</span>
        <div className="flex items-center gap-2 mt-0.5">
          {isRainbow && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">MVP RAINBOW</span>}
          {isGlow && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">GLOW</span>}
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${bgMap[color]}`} />
            <span className="text-[9px] text-gray-500">{colorLabel[color]}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ElwScoreSettingsPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/settings/elw_score")
      .then((res) => {
        const val = res.value || DEFAULT_CONFIG;
        setConfig({ ...DEFAULT_CONFIG, ...val });
      })
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

  function update(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/elw_score", { value: config });
      setMsg("ok");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("error"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-white/2 animate-pulse" />;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">ELW Skor Ayarlari</h1>
          <p className="text-sm text-gray-500 mt-1">Skor etiketleri, renkler, glow ve rainbow efektleri</p>
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
            <p><strong className="text-gray-300">ELW Skor</strong>, her oyuncunun mac icindeki performansini 0-10 arasi puanlayan ozel bir metriktir. Takimdaki diger oyuncularla karsilastirmali Z-score normalizasyonu kullanir.</p>
            <p><strong className="text-emerald-400">Glow efekti:</strong> Yuksek skor alan oyuncularin kartinda parlama animasyonu gosterilir.</p>
            <p><strong className="text-amber-400">Rainbow (Gokkusagi):</strong> Hem yuksek skor hem de macin 1. si olan oyuncuya ozel gokkusagi renk animasyonu uygulanir — MVP odulu.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Etiketler + Renkler */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skor etiketleri */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Skor Etiketleri</h3>
            <p className="text-[11px] text-gray-600 mb-4">Skor bu degerin ustundeyse ilgili etiket gosterilir (yukaridan asagiya kontrol edilir)</p>
            <div className="space-y-2.5">
              {config.labels.map((l, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-[#1b2230]/30">
                  <div className="flex items-center gap-1.5 shrink-0 w-20">
                    <span className="text-[10px] text-gray-600">{">="}</span>
                    <input type="number" step="0.5" value={l.min}
                      onChange={(e) => updateLabel(idx, "min", Number(e.target.value))}
                      className="w-14 bg-[#0d1117] border border-[#1b2230] rounded-lg px-2 py-1.5 text-sm text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <input value={l.label} onChange={(e) => updateLabel(idx, "label", e.target.value)}
                    className="flex-1 bg-[#0d1117] border border-[#1b2230] rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50" />
                </div>
              ))}
            </div>
          </div>

          {/* Renk esikleri */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Renk Esikleri</h3>
            <p className="text-[11px] text-gray-600 mb-4">Skor kartinin ve barinin renk sinirlarini belirler</p>
            <div className="space-y-3">
              {SCORE_COLORS.map((c) => {
                const value = config.colorThresholds[c.key];
                if (c.key === "red") {
                  return (
                    <div key={c.key} className="flex items-center gap-3 opacity-50">
                      <div className={`w-4 h-4 rounded-full ${c.css} shrink-0`} />
                      <span className="text-sm text-gray-500 w-16">{c.label}</span>
                      <span className="text-xs text-gray-600">{"<"} {config.colorThresholds.yellow} (otomatik — sari esiginin altindaki her sey)</span>
                    </div>
                  );
                }
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${c.css} shrink-0`} />
                    <span className="text-sm text-gray-300 w-16">{c.label}</span>
                    <span className="text-[10px] text-gray-600">{">="}</span>
                    <input type="number" step="0.5" value={value}
                      onChange={(e) => updateColor(c.key, Number(e.target.value))}
                      className="w-16 bg-[#0d1117] border border-[#1b2230] rounded-lg px-2 py-1.5 text-sm text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                    <span className="text-[10px] text-gray-600">{c.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Glow + Rainbow */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Efekt Ayarlari</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Glow */}
              <div className="bg-white/[0.02] rounded-xl p-4 border border-emerald-500/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 perf-glow perf-glow-emerald" />
                  <h4 className="text-sm font-medium text-emerald-400">Glow Efekti</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Esik Skoru</span>
                    <input type="number" step="0.5" value={config.glowThreshold}
                      onChange={(e) => update("glowThreshold", Number(e.target.value))}
                      className="w-16 bg-[#0d1117] border border-[#1b2230] rounded-lg px-2 py-1.5 text-sm text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Shimmer Metin</span>
                    <button onClick={() => update("shimmerEnabled", !config.shimmerEnabled)}
                      className={`w-10 h-5.5 rounded-full relative transition-colors cursor-pointer ${config.shimmerEnabled ? "bg-emerald-500" : "bg-gray-700"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform ${config.shimmerEnabled ? "left-[22px]" : "left-[3px]"}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600">Bu esik ve uzerindeki skorlar parlama animasyonu alir</p>
                </div>
              </div>

              {/* Rainbow */}
              <div className="bg-white/[0.02] rounded-xl p-4 border border-amber-500/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full elw-rainbow-bar" />
                  <h4 className="text-sm font-medium text-amber-400">Gokkusagi (MVP)</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Esik Skoru</span>
                    <input type="number" step="0.5" value={config.rainbowThreshold}
                      onChange={(e) => update("rainbowThreshold", Number(e.target.value))}
                      className="w-16 bg-[#0d1117] border border-[#1b2230] rounded-lg px-2 py-1.5 text-sm text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Gerekli Siralama</span>
                    <input type="number" value={config.rainbowRankRequired}
                      onChange={(e) => update("rainbowRankRequired", Number(e.target.value))}
                      className="w-16 bg-[#0d1117] border border-[#1b2230] rounded-lg px-2 py-1.5 text-sm text-gray-300 text-center focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <p className="text-[10px] text-gray-600">Skor esigi + macta {config.rainbowRankRequired}. sirada olan oyuncuya ozel gokkusagi efekti uygulanir</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sag: Canli onizleme */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Canli Onizleme</h3>
            <div className="space-y-2.5">
              <ScorePreview score={9.2} config={config} />
              <ScorePreview score={8.5} config={config} />
              <ScorePreview score={7.5} config={config} />
              <ScorePreview score={5.8} config={config} />
              <ScorePreview score={4.0} config={config} />
              <ScorePreview score={2.5} config={config} />
            </div>
            <p className="text-[10px] text-gray-600 mt-3 text-center">Ayarlari degistirdikce bu onizleme guncellenir</p>
          </div>
        </div>
      </div>
    </>
  );
}
