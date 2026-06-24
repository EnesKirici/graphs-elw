"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const OPTIONS = [
  {
    key: "label",
    title: "Veri yetersiz göster (önerilen)",
    desc: "Yeterli örneklemi (20+ maç) olmayan şampiyonlarda WR/pick/ban yerine \"veri yetersiz\" yazılır. Dürüst yaklaşım — uydurma sayı göstermez.",
  },
  {
    key: "sim",
    title: "Sahte veriyle doldur",
    desc: "Verisi az olan şampiyonlar için tahmini (simüle) WR/pick/ban üretilir. Sayfa dolu görünür ama bu sayılar GERÇEK DEĞİLDİR.",
  },
];

export default function MetaInsufficientSettingsPage() {
  const [mode, setMode] = useState("label");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/settings/meta_insufficient_mode")
      .then((res) => setMode(res.value === "sim" ? "sim" : "label"))
      .catch(() => setMode("label"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/meta_insufficient_mode", { value: mode });
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
          <h1 className="text-xl font-bold text-white">Meta Verisi — Yetersiz Örneklem</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ana sayfadaki şampiyon WR/pick/ban için yeterli maç verisi (20+) olmayan şampiyonlarda ne gösterilsin?
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg === "ok" && <span className="text-xs text-emerald-400">Kaydedildi!</span>}
          {msg === "error" && <span className="text-xs text-red-400">Hata!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 mb-6 border border-blue-500/10">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>
              Verimiz şu an küçük (~2000 maç) ve yanlı (aranan/takip edilen TR oyuncuları).
              Bu yüzden çok az oynanan şampiyonların WR'si gürültülü olur. <strong className="text-gray-300">"Veri yetersiz"</strong>
              {" "}seçeneği bu şampiyonlarda uydurma sayı yerine dürüstçe boş bırakır.
            </p>
            <p className="text-gray-500">Not: Sunucu önbelleği nedeniyle değişiklik birkaç saniye gecikebilir (sayfa yenileyin).</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`text-left glass rounded-2xl p-5 border transition-all cursor-pointer ${
                active
                  ? "border-blue-500/60 ring-1 ring-blue-500/40"
                  : "border-edge hover:border-edge/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-100">{opt.title}</h3>
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    active ? "border-blue-400" : "border-gray-600"
                  }`}
                >
                  {active && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}
