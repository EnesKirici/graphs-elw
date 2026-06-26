"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

// Bağlam sekmeleri (catalog'da live dolu; profile/match ileride).
const CONTEXTS = [
  { id: "live", label: "Canlı Maç", desc: "Canlı maç kartının ön yüzünde gösterilen bağlamsal etiketler" },
  { id: "profile", label: "Profil", desc: "Profil sayfası etiketleri (yakında)" },
  { id: "match", label: "Maç Geçmişi", desc: "Maç geçmişi etiketleri (yakında)" },
];

// Ton → kullanıcı dostu ad (renk backend'den tones ile gelir).
const TONES = [
  { id: "good", label: "İyi" },
  { id: "bad", label: "Kötü" },
  { id: "info", label: "Bilgi" },
  { id: "neutral", label: "Nötr" },
];

// Eşik anahtarı → kullanıcı dostu etiket + yardım.
const TH_META = {
  share: { label: "Oran %", help: "Tüm sezon maçlarının yüzde kaçı bu şampiyon (örn. 70 = %70'i)" },
  minGames: { label: "Min maç", help: "OTP için: bu şampiyonda sezon en az kaç maç (1/1=%100 yanılgısını önler)" },
  games: { label: "Sezon maç", help: "Bu şampiyonda bu sezon oynanan maç sayısı eşiği (DB)" },
  wr: { label: "WR %", help: "Bu şampiyonda sezon kazanma oranı (0-100)" },
  perMin: { label: "Vizyon/dk", help: "Dakika başına vizyon skoru eşiği (genel, tüm roller)" },
  streak: { label: "Seri", help: "Üst üste galibiyet/mağlubiyet sayısı (son maçlar)" },
  csPerMin: { label: "CS/dk", help: "Dakika başına minyon eşiği (son maçlar)" },
  deaths: { label: "Ölüm", help: "Son maçlarda ortalama ölüm eşiği" },
  kills: { label: "Kill", help: "Son maçlarda ortalama kill eşiği" },
  elw: { label: "ELW", help: "Son maç ELW ortalama eşiği" },
};

const SAMPLE_CHAMP = "Yasuo";

// catalog + kaydedilmiş config → düzenlenebilir çalışma durumu (efektif değerler).
function buildWorking(catalog, tones, savedConfig) {
  const working = {};
  for (const ctx of Object.keys(catalog)) {
    working[ctx] = {};
    for (const key of Object.keys(catalog[ctx])) {
      const def = catalog[ctx][key];
      const cfg = savedConfig?.[ctx]?.[key] || {};
      const tone = cfg.tone || def.tone;
      working[ctx][key] = {
        enabled: cfg.enabled !== false,
        name: cfg.name || def.name,
        tone,
        customColor: !!cfg.color,
        color: cfg.color || tones[tone] || "#94a3b8",
        thresholds: { ...(def.thresholds || {}), ...(cfg.thresholds || {}) },
        desc: def.desc,
      };
    }
  }
  return working;
}

// Çalışma durumu → minimal config (yalnız varsayılandan SAPAN değerleri kaydet).
function buildSaveConfig(working, catalog) {
  const out = {};
  for (const ctx of Object.keys(catalog)) {
    const ctxOut = {};
    for (const key of Object.keys(catalog[ctx])) {
      const def = catalog[ctx][key];
      const w = working[ctx]?.[key];
      if (!w) continue;
      const entry = {};
      if (w.enabled === false) entry.enabled = false;
      if (w.name && w.name !== def.name) entry.name = w.name;
      if (w.customColor) {
        entry.color = w.color;
      } else if (w.tone && w.tone !== def.tone) {
        entry.tone = w.tone;
      }
      const thDiff = {};
      for (const tk of Object.keys(def.thresholds || {})) {
        const v = w.thresholds?.[tk];
        if (v !== undefined && v !== "" && Number(v) !== Number(def.thresholds[tk])) {
          thDiff[tk] = Number(v);
        }
      }
      if (Object.keys(thDiff).length) entry.thresholds = thDiff;
      if (Object.keys(entry).length) ctxOut[key] = entry;
    }
    if (Object.keys(ctxOut).length) out[ctx] = ctxOut;
  }
  return out;
}

function LabelChip({ name, color }) {
  const text = (name || "").replaceAll("{champ}", SAMPLE_CHAMP) || "İsimsiz";
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap"
      style={{ color, borderColor: `${color}55`, background: `${color}1a` }}
    >
      {text}
    </span>
  );
}

export default function LiveLabelsSettingsPage() {
  const [catalog, setCatalog] = useState(null);
  const [tones, setTones] = useState({});
  const [working, setWorking] = useState({});
  const [activeCtx, setActiveCtx] = useState("live");
  const [expandedKey, setExpandedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/labels")
      .then((res) => {
        const cat = res.catalog || {};
        const tns = res.tones || {};
        setCatalog(cat);
        setTones(tns);
        setWorking(buildWorking(cat, tns, res.config || {}));
      })
      .catch(() => setCatalog({}))
      .finally(() => setLoading(false));
  }, []);

  function updateLabel(ctx, key, patch) {
    setWorking((prev) => ({
      ...prev,
      [ctx]: { ...prev[ctx], [key]: { ...prev[ctx][key], ...patch } },
    }));
  }

  function updateThreshold(ctx, key, tk, value) {
    setWorking((prev) => ({
      ...prev,
      [ctx]: {
        ...prev[ctx],
        [key]: {
          ...prev[ctx][key],
          thresholds: { ...prev[ctx][key].thresholds, [tk]: value },
        },
      },
    }));
  }

  function pickTone(ctx, key, toneId) {
    updateLabel(ctx, key, { tone: toneId, customColor: false, color: tones[toneId] || "#94a3b8" });
  }

  function resetLabel(ctx, key) {
    const def = catalog[ctx][key];
    updateLabel(ctx, key, {
      enabled: true,
      name: def.name,
      tone: def.tone,
      customColor: false,
      color: tones[def.tone] || "#94a3b8",
      thresholds: { ...(def.thresholds || {}) },
    });
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const config = buildSaveConfig(working, catalog);
      await putAdmin("/settings/labels_config", { value: config });
      setMsg("ok");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setMsg("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;

  const ctxKeys = catalog?.[activeCtx] ? Object.keys(catalog[activeCtx]) : [];
  const ctxMeta = CONTEXTS.find((c) => c.id === activeCtx);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Canlı Maç Etiketleri</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bağlamsal oynayış etiketleri (OTP, Main&apos;i Karşıda, Zayıf Farmcı…) — aç/kapa, ad, renk ve eşikleri buradan yönet
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg === "ok" && <span className="text-xs text-emerald-400">Kaydedildi!</span>}
          {msg === "error" && <span className="text-xs text-red-400">Hata oluştu!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* Bilgi kutusu */}
      <div className="glass rounded-2xl p-5 mb-6 border border-blue-500/10">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-xs text-gray-400 space-y-1.5">
            <p><strong className="text-gray-300">Nasıl çalışır?</strong> Her etiketin bir koşulu (kodda) ve bir eşiği vardır. Oyuncunun verisi eşiği geçerse etiket kart üzerinde gösterilir. <strong className="text-gray-300">{"{champ}"}</strong> şablonu otomatik olarak gerçek şampiyon adıyla değişir.</p>
            <p><strong className="text-gray-300">Eşikler (gelişmiş):</strong> Her satırı genişleterek (ok) sayısal eşikleri ayarlayabilirsin. Renk için 4 hazır ton ya da özel renk seçilebilir.</p>
            <p className="text-gray-500">Not: Yalnız varsayılandan değiştirdiğin değerler kaydedilir; gerisi koddaki katalog varsayılanını kullanır.</p>
          </div>
        </div>
      </div>

      {/* Bağlam sekmeleri */}
      <div className="flex items-center gap-2 mb-5">
        {CONTEXTS.map((c) => {
          const count = catalog?.[c.id] ? Object.keys(catalog[c.id]).length : 0;
          const active = activeCtx === c.id;
          const empty = count === 0;
          return (
            <button
              key={c.id}
              onClick={() => { setActiveCtx(c.id); setExpandedKey(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
                active
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                  : "text-gray-400 border-edge hover:text-gray-200 hover:border-edge/80"
              }`}
            >
              {c.label}
              <span className={`ml-2 text-[10px] ${empty ? "text-gray-600" : "text-gray-500"}`}>
                {empty ? "yakında" : count}
              </span>
            </button>
          );
        })}
      </div>

      {ctxKeys.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-sm text-gray-500">{ctxMeta?.label} etiketleri henüz tanımlı değil — yakında eklenecek.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ctxKeys.map((key) => {
            const def = catalog[activeCtx][key];
            const w = working[activeCtx]?.[key];
            if (!w) return null;
            const isExpanded = expandedKey === key;
            const thKeys = Object.keys(def.thresholds || {});

            return (
              <div key={key} className={`glass rounded-2xl overflow-hidden transition-all ${w.enabled ? "" : "opacity-50"}`}>
                {/* Ana satır — basit ayarlar */}
                <div className="flex items-center gap-3 px-5 py-4">
                  {/* Aç/kapa */}
                  <button
                    onClick={() => updateLabel(activeCtx, key, { enabled: !w.enabled })}
                    title={w.enabled ? "Açık" : "Kapalı"}
                    className={`w-10 h-5.5 rounded-full relative transition-colors cursor-pointer shrink-0 ${w.enabled ? "bg-emerald-500" : "bg-gray-700"}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform ${w.enabled ? "left-[22px]" : "left-[3px]"}`} />
                  </button>

                  {/* Önizleme */}
                  <div className="w-40 shrink-0">
                    <LabelChip name={w.name} color={w.color} />
                  </div>

                  {/* Ad input */}
                  <input
                    value={w.name}
                    onChange={(e) => updateLabel(activeCtx, key, { name: e.target.value })}
                    className="flex-1 min-w-0 bg-soft border border-edge rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                  />

                  {/* Ton renk seçici */}
                  <div className="flex items-center gap-1 shrink-0">
                    {TONES.map((t) => {
                      const c = tones[t.id] || "#94a3b8";
                      const selected = !w.customColor && w.tone === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => pickTone(activeCtx, key, t.id)}
                          title={t.label}
                          className={`w-5 h-5 rounded-full cursor-pointer transition-all ${selected ? "ring-2 ring-white/70 ring-offset-1 ring-offset-card scale-110" : "opacity-40 hover:opacity-70"}`}
                          style={{ background: c }}
                        />
                      );
                    })}
                  </div>

                  {/* Eşik sayısı */}
                  <span className="text-[10px] text-gray-600 w-12 text-right shrink-0">
                    {thKeys.length ? `${thKeys.length} eşik` : "eşiksiz"}
                  </span>

                  {/* Genişlet */}
                  <button
                    onClick={() => setExpandedKey(isExpanded ? null : key)}
                    className="text-gray-500 hover:text-gray-300 cursor-pointer p-1 transition-colors shrink-0"
                  >
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Genişletilmiş — gelişmiş ayarlar */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 space-y-4 border-t border-edge/30">
                    {/* Açıklama */}
                    <p className="text-[11px] text-gray-500 pt-4">{def.desc}</p>

                    {/* Özel renk */}
                    <div className="flex items-center gap-3">
                      <label className="text-[11px] text-gray-500">Özel renk</label>
                      <input
                        type="color"
                        value={w.color}
                        onChange={(e) => updateLabel(activeCtx, key, { color: e.target.value, customColor: true })}
                        className="w-8 h-8 rounded-lg bg-transparent border border-edge cursor-pointer p-0.5"
                      />
                      <span className="text-[11px] text-gray-600 font-mono">{w.color}</span>
                      {w.customColor && (
                        <button
                          onClick={() => pickTone(activeCtx, key, w.tone)}
                          className="text-[11px] text-gray-500 hover:text-blue-400 cursor-pointer"
                        >
                          tona dön
                        </button>
                      )}
                    </div>

                    {/* Eşikler */}
                    {thKeys.length > 0 && (
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-3">Eşikler (gelişmiş)</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          {thKeys.map((tk) => {
                            const meta = TH_META[tk] || { label: tk, help: "" };
                            return (
                              <div key={tk} className="bg-soft rounded-xl p-3 border border-edge/50">
                                <label className="text-[10px] text-gray-500 block mb-1.5">{meta.label}</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={w.thresholds?.[tk] ?? ""}
                                  onChange={(e) => updateThreshold(activeCtx, key, tk, e.target.value === "" ? "" : Number(e.target.value))}
                                  className="w-full bg-card border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50"
                                />
                                <p className="text-[9px] text-gray-600 mt-1">{meta.help}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Varsayılana dön */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => resetLabel(activeCtx, key)}
                        className="text-[11px] text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
                      >
                        Bu etiketi varsayılana döndür
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
