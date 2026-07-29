"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { Card, Badge, Button, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

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

// Card ikonları (heroicons outline `d` — kit stiliyle uyumlu)
const ICON_TAG = "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 8V4a1 1 0 011-1z";
const ICON_SWATCH = "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01";
const ICON_SPARKLE = "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z";
const ICON_EYE = "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z";
const ICON_SAVE = "M5 13l4 4L19 7";

// Ortak input stili (sayısal/merkezli). Neon yok; focus = azure barı (#5b8def).
const numInput = "bg-soft border border-edge rounded-lg px-2 py-1.5 text-sm text-gray-200 text-center focus:outline-none focus:border-[#5b8def]";
const textInput = "bg-soft border border-edge rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#5b8def]";

// Canlı önizleme — SİTEDE görünen gerçek skor çipini birebir yansıtır (glow/rainbow
// efektleri gerçek site CSS'iyle; renkler kullanıcının ayarladığı ürün renkleridir).
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
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-edge/50 ${isRainbow ? "bg-gradient-to-r from-amber-500/5 via-cyan-500/5 to-emerald-500/5" : isGlow ? "bg-emerald-500/5" : "bg-soft"}`}>
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

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;

  return (
    <>
      {/* Global kaydet + durum */}
      <div className="mb-5 flex items-center justify-end gap-3">
        {msg === "ok" && <Badge tone="mint" dot>Kaydedildi</Badge>}
        {msg === "error" && <Badge tone="rose" dot>Hata</Badge>}
        <Button variant="primary" size="md" icon={ICON_SAVE} onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      {/* ELW Skor açıklaması. Glow = yeşil parlama; Rainbow = MVP gökkuşağı. */}
      <InfoNote tone="info" title="ELW Skor" className="mb-4">
        Her oyuncunun maç içindeki performansını 0-10 arası puanlayan özel bir metriktir. Takımdaki diğer
        oyuncularla karşılaştırmalı Z-score normalizasyonu kullanır. Aşağıdaki etiketler, renk eşikleri ve
        glow/rainbow efektleri skor çipinin sitede nasıl görüneceğini belirler; sağdaki önizleme değişiklikleri
        anında yansıtır.
      </InfoNote>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sol: Etiketler + Renkler + Efektler */}
        <div className="lg:col-span-2 space-y-4">
          {/* Skor etiketleri */}
          <Card
            title="Skor Etiketleri"
            subtitle="Skor bu değerin üstündeyse ilgili etiket gösterilir (yukarıdan aşağıya kontrol edilir)."
            icon={ICON_TAG}
          >
            <div className="space-y-2.5">
              {config.labels.map((l, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-soft/60 rounded-xl p-3 border border-edge/40">
                  <div className="flex items-center gap-1.5 shrink-0 w-20">
                    <span className="text-[10px] text-gray-500">{">="}</span>
                    <input type="number" step="0.5" value={l.min}
                      onChange={(e) => updateLabel(idx, "min", Number(e.target.value))}
                      className={`w-14 ${numInput}`} />
                  </div>
                  <input value={l.label} onChange={(e) => updateLabel(idx, "label", e.target.value)}
                    className={`flex-1 ${textInput}`} />
                </div>
              ))}
            </div>
          </Card>

          {/* Renk esikleri */}
          <Card
            title="Renk Eşikleri"
            subtitle="Skor kartının ve barının renk sınırlarını belirler. Renk göstergeleri sitede görünen gerçek renklerdir."
            icon={ICON_SWATCH}
          >
            <div className="space-y-3">
              {SCORE_COLORS.map((c) => {
                const value = config.colorThresholds[c.key];
                if (c.key === "red") {
                  return (
                    <div key={c.key} className="flex items-center gap-3 opacity-60">
                      <div className={`w-4 h-4 rounded-full ${c.css} shrink-0`} />
                      <span className="text-sm text-gray-400 w-16">{c.label}</span>
                      <span className="text-xs text-gray-500">{"<"} {config.colorThresholds.yellow} (otomatik — sarı eşiğinin altındaki her şey)</span>
                    </div>
                  );
                }
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${c.css} shrink-0`} />
                    <span className="text-sm text-gray-300 w-16">{c.label}</span>
                    <span className="text-[10px] text-gray-500">{">="}</span>
                    <input type="number" step="0.5" value={value}
                      onChange={(e) => updateColor(c.key, Number(e.target.value))}
                      className={`w-16 ${numInput}`} />
                    <span className="text-[10px] text-gray-500">{c.desc}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Glow + Rainbow */}
          <Card
            title="Efekt Ayarları"
            subtitle="Glow: yüksek skor alan oyuncunun kartında parlama animasyonu. Gökkuşağı (MVP): hem yüksek skor hem maçın 1.si olan oyuncuya özel gökkuşağı renk animasyonu — MVP ödülü."
            icon={ICON_SPARKLE}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Glow */}
              <div className="rounded-xl p-4 border" style={{ borderColor: TONES.mint.bd, background: TONES.mint.bg }}>
                <div className="flex items-center gap-2 mb-3">
                  {/* gerçek site glow efekti önizlemesi */}
                  <span className="w-3 h-3 rounded-full bg-emerald-500 perf-glow perf-glow-emerald" />
                  <h4 className="text-sm font-medium" style={{ color: TONES.mint.fg }}>Glow Efekti</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Eşik Skoru</span>
                    <input type="number" step="0.5" value={config.glowThreshold}
                      onChange={(e) => update("glowThreshold", Number(e.target.value))}
                      className={`w-16 ${numInput}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Shimmer Metin</span>
                    <button onClick={() => update("shimmerEnabled", !config.shimmerEnabled)}
                      className="w-10 h-5.5 rounded-full relative transition-colors cursor-pointer"
                      style={{ background: config.shimmerEnabled ? TONES.mint.bar : "rgba(255,255,255,0.12)" }}>
                      <span className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform ${config.shimmerEnabled ? "left-[22px]" : "left-[3px]"}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">Bu eşik ve üzerindeki skorlar parlama animasyonu alır.</p>
                </div>
              </div>

              {/* Rainbow */}
              <div className="rounded-xl p-4 border" style={{ borderColor: TONES.gold.bd, background: TONES.gold.bg }}>
                <div className="flex items-center gap-2 mb-3">
                  {/* gerçek site rainbow efekti önizlemesi */}
                  <span className="w-3 h-3 rounded-full elw-rainbow-bar" />
                  <h4 className="text-sm font-medium" style={{ color: TONES.gold.fg }}>Gökkuşağı (MVP)</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Eşik Skoru</span>
                    <input type="number" step="0.5" value={config.rainbowThreshold}
                      onChange={(e) => update("rainbowThreshold", Number(e.target.value))}
                      className={`w-16 ${numInput}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Gerekli Sıralama</span>
                    <input type="number" value={config.rainbowRankRequired}
                      onChange={(e) => update("rainbowRankRequired", Number(e.target.value))}
                      className={`w-16 ${numInput}`} />
                  </div>
                  <p className="text-[10px] text-gray-500">Skor eşiği + maçta {config.rainbowRankRequired}. sırada olan oyuncuya özel gökkuşağı efekti uygulanır.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sag: Canli onizleme */}
        <div className="space-y-4">
          <Card title="Canlı Önizleme" icon={ICON_EYE} className="sticky top-6">
            <div className="space-y-2.5">
              <ScorePreview score={9.2} config={config} />
              <ScorePreview score={8.5} config={config} />
              <ScorePreview score={7.5} config={config} />
              <ScorePreview score={5.8} config={config} />
              <ScorePreview score={4.0} config={config} />
              <ScorePreview score={2.5} config={config} />
            </div>
            <p className="text-[10px] text-gray-500 mt-3 text-center">Ayarları değiştirdikçe bu önizleme güncellenir.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
