"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { Card, Button, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

// Kart başlıkları için ikon (nav'daki etiket ikonuyla aynı).
const ICON_TAG = "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z";

// Renk kimliği (DATA — backend'e aynen kaydedilir) → panelin kendi tone paleti.
// Ham neon Tailwind (bg-emerald-500 vb.) YOK; görsel yalnız tones.js'ten gelir.
const COLORS = [
  { id: "emerald", label: "Yesil", tone: "mint" },
  { id: "blue", label: "Mavi", tone: "azure" },
  { id: "yellow", label: "Sari", tone: "gold" },
  { id: "red", label: "Kirmizi", tone: "rose" },
  { id: "gray", label: "Gri", tone: "neutral" },
];
const toneForColor = (id) => TONES[COLORS.find((c) => c.id === id)?.tone] || TONES.neutral;

const DEFAULT_LABELS = [
  { label: "Durdurulamaz", desc: "Essiz performans sergileyerek takimini zafere tasidi.", color: "emerald", conditions: { rank_max: 2, win: true, kda_min: 4 } },
  { label: "Lider", desc: "Iyi kararlar verip takimini zafere tasidi.", color: "emerald", conditions: { rank_max: 3, win: true } },
  { label: "Gec Acilan", desc: "Zaman icinde giderek artan performans gostererek zafere ulasti.", color: "blue", conditions: { earlyGold_max: -300, lateGold_min: 500, win: true } },
  { label: "Erken Baskin", desc: "Iyi bir baslangic yapti ama avantaji koruyamadi.", color: "yellow", conditions: { earlyGold_min: 500, lateGold_max: -200, win: false } },
  { label: "Direncli", desc: "Yenilgiye ragmen takimindaki en iyi performansi gosterdi.", color: "blue", conditions: { rank_max: 3, win: false } },
  { label: "Katkici", desc: "Takimina istikrarli katki saglayarak galibiyete yardimci oldu.", color: "gray", conditions: { rank_min: 4, rank_max: 6, win: true } },
  { label: "Mucadele", desc: "Zor bir mac gecirdi.", color: "red", conditions: { rank_min: 8 } },
  { label: "Ortalama", desc: "Standart bir performans sergiledi.", color: "gray", conditions: { rank_min: 5, rank_max: 7 } },
];

const CONDITION_FIELDS = [
  { key: "win", label: "Galibiyet", type: "select", help: "Oyuncu mac kazandi mi?" },
  { key: "rank_max", label: "Max Siralama", type: "number", help: "Macta en fazla kacinci olmali (1=en iyi)" },
  { key: "rank_min", label: "Min Siralama", type: "number", help: "Macta en az kacinci olmali" },
  { key: "kda_min", label: "Min KDA", type: "number", help: "Minimum KDA orani" },
  { key: "earlyGold_min", label: "Erken Altin >", type: "number", help: "Erken oyun altin avantaji (pozitif = onde)" },
  { key: "earlyGold_max", label: "Erken Altin <", type: "number", help: "Erken oyun altin dezavantaji (negatif = geride)" },
  { key: "lateGold_min", label: "Gec Altin >", type: "number", help: "Gec oyun altin avantaji" },
  { key: "lateGold_max", label: "Gec Altin <", type: "number", help: "Gec oyun altin dezavantaji" },
];

function LabelPreview({ label }) {
  const t = toneForColor(label.color);
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap"
      style={{ color: t.fg, background: t.bg, borderColor: t.bd }}
    >
      {label.label || "Isimsiz"}
    </span>
  );
}

export default function LabelsSettingsPage() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    fetchAdmin("/settings/performance_labels")
      .then((res) => setLabels(res.value || DEFAULT_LABELS))
      .catch(() => setLabels(DEFAULT_LABELS))
      .finally(() => setLoading(false));
  }, []);

  function updateLabel(idx, field, value) {
    setLabels((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function updateCondition(idx, field, value) {
    setLabels((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const conditions = { ...l.conditions };
        if (value === undefined || value === null) delete conditions[field];
        else conditions[field] = value;
        return { ...l, conditions };
      })
    );
  }

  function moveLabel(idx, dir) {
    setLabels((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/performance_labels", { value: labels });
      setMsg("ok");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setMsg("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;

  const saveAction = (
    <div className="flex items-center gap-3">
      {msg === "ok" && <span className="text-xs" style={{ color: TONES.mint.fg }}>Kaydedildi!</span>}
      {msg === "error" && <span className="text-xs" style={{ color: TONES.rose.fg }}>Hata olustu!</span>}
      <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </div>
  );

  return (
    <>
      {/* Bilgi kutusu */}
      <InfoNote tone="info" title="Nasil calisir?" className="mb-4">
        <span className="block">
          Her mac sonrasi oyuncunun performansi bu listedeki etiketlerle degerlendirilir. Etiketler{" "}
          <strong className="text-gray-300">yukaridan asagiya</strong> sirayla kontrol edilir — ilk eslesen etiket atanir.
        </span>
        <span className="block mt-1.5">
          <strong className="text-gray-300">Siralama (Rank):</strong> Oyuncunun mac icindeki ELW skoruna gore sirasi (1 = en iyi, 10 = en kotu).
        </span>
        <span className="block mt-1.5">
          <strong className="text-gray-300">Ornek:</strong> &quot;Durdurulamaz&quot; etiketi icin oyuncu macta ilk 2de olmali (rank {"<="} 2), mac kazanilmis olmali ve KDA {">="} 4 olmali. Uc kosul da saglanirsa bu etiket atanir.
        </span>
      </InfoNote>

      {/* Etiket listesi */}
      <Card
        title="Performans Etiketleri"
        subtitle="Mac sonrasi oyunculara verilen performans etiketleri — yukaridan asagiya oncelik sirasiyla"
        icon={ICON_TAG}
        actions={saveAction}
      >
        <div className="space-y-3">
          {labels.map((l, idx) => {
            const isExpanded = expandedIdx === idx;
            const activeConditions = Object.entries(l.conditions || {}).filter(([, v]) => v !== null && v !== undefined);

            return (
              <div key={idx} className="rounded-xl border border-edge bg-card/60 overflow-hidden transition-all">
                {/* Ana satir */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Siralama */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveLabel(idx, -1)} disabled={idx === 0}
                      className="text-gray-600 hover:text-gray-300 disabled:text-gray-800 cursor-pointer text-[10px] leading-none">&#9650;</button>
                    <span className="text-[10px] text-gray-600 text-center font-mono">{idx + 1}</span>
                    <button onClick={() => moveLabel(idx, 1)} disabled={idx === labels.length - 1}
                      className="text-gray-600 hover:text-gray-300 disabled:text-gray-800 cursor-pointer text-[10px] leading-none">&#9660;</button>
                  </div>

                  {/* Onizleme */}
                  <LabelPreview label={l} />

                  {/* Isim input */}
                  <input value={l.label} onChange={(e) => updateLabel(idx, "label", e.target.value)}
                    className="bg-soft border border-edge rounded-lg px-3 py-1.5 text-sm text-gray-200 w-40 focus:outline-none focus:border-[#5b8def]" />

                  {/* Renk secici (deger DATA olarak korunur, gorsel tones.js'ten) */}
                  <div className="flex items-center gap-1">
                    {COLORS.map((c) => (
                      <button key={c.id} onClick={() => updateLabel(idx, "color", c.id)} title={c.label}
                        style={{ background: TONES[c.tone].bar }}
                        className={`w-5 h-5 rounded-full cursor-pointer transition-all ${
                          l.color === c.id ? "ring-2 ring-white/70 ring-offset-1 ring-offset-card scale-110" : "opacity-30 hover:opacity-60"
                        }`} />
                    ))}
                  </div>

                  {/* Aktif kosul sayisi */}
                  <span className="text-[10px] text-gray-600 ml-auto">{activeConditions.length} kosul</span>

                  {/* Genislet */}
                  <button onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="text-gray-500 hover:text-gray-300 cursor-pointer p-1 transition-colors">
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Sil */}
                  <button onClick={() => { setLabels((p) => p.filter((_, i) => i !== idx)); if (expandedIdx === idx) setExpandedIdx(null); }}
                    title="Sil"
                    className="text-gray-700 hover:text-[#ef8ba0] cursor-pointer p-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Genisletilmis alan */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-4 border-t border-edge/40">
                    {/* Aciklama */}
                    <div className="pt-4">
                      <label className="text-[11px] text-gray-500 block mb-1">Aciklama (oyuncuya gosterilir)</label>
                      <input value={l.desc} onChange={(e) => updateLabel(idx, "desc", e.target.value)}
                        className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#5b8def]" />
                    </div>

                    {/* Kosullar */}
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-3">Kosullar (bos birakilanlar kontrol edilmez)</label>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {CONDITION_FIELDS.map((field) => {
                          const value = l.conditions?.[field.key];
                          return (
                            <div key={field.key} className="bg-soft rounded-lg p-3 border border-edge/60">
                              <label className="text-[10px] text-gray-500 block mb-1.5">{field.label}</label>
                              {field.type === "select" ? (
                                <select
                                  value={value === true ? "true" : value === false ? "false" : ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    updateCondition(idx, field.key, v === "" ? null : v === "true");
                                  }}
                                  className="w-full bg-card border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-[#5b8def]"
                                >
                                  <option value="">Farketmez</option>
                                  <option value="true">Evet (Galibiyet)</option>
                                  <option value="false">Hayir (Maglubiyet)</option>
                                </select>
                              ) : (
                                <input
                                  type="number" step="any"
                                  value={value ?? ""}
                                  onChange={(e) => updateCondition(idx, field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                                  placeholder="—"
                                  className="w-full bg-card border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-[#5b8def]"
                                />
                              )}
                              <p className="text-[9px] text-gray-600 mt-1">{field.help}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Yeni ekle */}
          <button onClick={() => { setLabels((p) => [...p, { label: "Yeni Etiket", desc: "", color: "gray", conditions: {} }]); setExpandedIdx(labels.length); }}
            className="w-full border-2 border-dashed border-edge hover:border-[#5b8def]/50 rounded-xl py-4 text-sm text-gray-600 hover:text-[#8ab4f8] transition-all cursor-pointer">
            + Yeni Etiket Ekle
          </button>
        </div>
      </Card>
    </>
  );
}
