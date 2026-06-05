"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const COLORS = [
  { id: "emerald", label: "Yesil", bg: "bg-emerald-500", text: "text-emerald-400" },
  { id: "blue", label: "Mavi", bg: "bg-blue-500", text: "text-blue-400" },
  { id: "yellow", label: "Sari", bg: "bg-yellow-500", text: "text-yellow-400" },
  { id: "red", label: "Kirmizi", bg: "bg-red-500", text: "text-red-400" },
  { id: "gray", label: "Gri", bg: "bg-gray-500", text: "text-gray-400" },
];

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
  const colorMap = { emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", blue: "bg-blue-500/15 text-blue-400 border-blue-500/30", yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", red: "bg-red-500/15 text-red-400 border-red-500/30", gray: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorMap[label.color] || colorMap.gray}`}>
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

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Performans Etiketleri</h1>
          <p className="text-sm text-gray-500 mt-1">Mac sonrasi oyunculara verilen performans etiketleri</p>
        </div>
        <div className="flex items-center gap-3">
          {msg === "ok" && <span className="text-xs text-emerald-400">Kaydedildi!</span>}
          {msg === "error" && <span className="text-xs text-red-400">Hata olustu!</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer">
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
            <p><strong className="text-gray-300">Nasil calisir?</strong> Her mac sonrasi oyuncunun performansi bu listedeki etiketlerle degerlendirilir. Etiketler <strong className="text-gray-300">yukaridan asagiya</strong> sirayla kontrol edilir — ilk eslesen etiket atanir.</p>
            <p><strong className="text-gray-300">Siralama (Rank):</strong> Oyuncunun mac icindeki ELW skoruna gore sirasi (1 = en iyi, 10 = en kotu).</p>
            <p><strong className="text-gray-300">Ornek:</strong> &quot;Durdurulamaz&quot; etiketi icin oyuncu macta ilk 2de olmali (rank {"<="} 2), mac kazanilmis olmali ve KDA {">="} 4 olmali. Uc kosul da saglanirsa bu etiket atanir.</p>
          </div>
        </div>
      </div>

      {/* Etiket listesi */}
      <div className="space-y-3">
        {labels.map((l, idx) => {
          const isExpanded = expandedIdx === idx;
          const activeConditions = Object.entries(l.conditions || {}).filter(([, v]) => v !== null && v !== undefined);

          return (
            <div key={idx} className="glass rounded-2xl overflow-hidden transition-all">
              {/* Ana satir */}
              <div className="flex items-center gap-3 px-5 py-4">
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
                  className="bg-soft border border-edge rounded-lg px-3 py-1.5 text-sm text-gray-200 w-40 focus:outline-none focus:border-blue-500/50" />

                {/* Renk secici */}
                <div className="flex items-center gap-1">
                  {COLORS.map((c) => (
                    <button key={c.id} onClick={() => updateLabel(idx, "color", c.id)} title={c.label}
                      className={`w-5 h-5 rounded-full ${c.bg} cursor-pointer transition-all ${
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
                  className="text-gray-700 hover:text-red-400 cursor-pointer p-1 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Genisletilmis alan */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-0 space-y-4 border-t border-edge/30">
                  {/* Aciklama */}
                  <div className="pt-4">
                    <label className="text-[11px] text-gray-500 block mb-1">Aciklama (oyuncuya gosterilir)</label>
                    <input value={l.desc} onChange={(e) => updateLabel(idx, "desc", e.target.value)}
                      className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50" />
                  </div>

                  {/* Kosullar */}
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-3">Kosullar (bos birakilanlar kontrol edilmez)</label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {CONDITION_FIELDS.map((field) => {
                        const value = l.conditions?.[field.key];
                        return (
                          <div key={field.key} className="bg-soft rounded-xl p-3 border border-edge/50">
                            <label className="text-[10px] text-gray-500 block mb-1.5">{field.label}</label>
                            {field.type === "select" ? (
                              <select
                                value={value === true ? "true" : value === false ? "false" : ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateCondition(idx, field.key, v === "" ? null : v === "true");
                                }}
                                className="w-full bg-card border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50"
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
                                className="w-full bg-card border border-edge rounded-lg px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50"
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
          className="w-full border-2 border-dashed border-edge hover:border-blue-500/40 rounded-2xl py-5 text-sm text-gray-600 hover:text-blue-400 transition-all cursor-pointer">
          + Yeni Etiket Ekle
        </button>
      </div>
    </>
  );
}
