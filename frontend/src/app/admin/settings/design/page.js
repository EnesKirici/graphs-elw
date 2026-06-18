"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

const OPTIONS = [
  {
    key: "classic",
    title: "Klasik",
    desc: "Mevcut profil ve sıralama tasarımı. Açık/koyu mod ve accent renk seçimini destekler.",
  },
  {
    key: "pro",
    title: "Pro — dpm.lol stili",
    desc: "Yeni sabit koyu (navy) tasarım. LP yükseliş grafiği, koridor eşleşmeli maç satırları, takım kalite etiketleri ve ELW skoru daire/sıra gösterimi.",
  },
];

export default function DesignSettingsPage() {
  const [design, setDesign] = useState("classic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/settings/profile_design")
      .then((res) => setDesign(res.value === "pro" ? "pro" : "classic"))
      .catch(() => setDesign("classic"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/profile_design", { value: design });
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
          <h1 className="text-xl font-bold text-white">Profil Tasarımı</h1>
          <p className="text-sm text-gray-500 mt-1">
            Profil ve sıralama sayfalarının hangi tasarımla gösterileceğini seç (siteye geneline uygulanır).
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
              <strong className="text-gray-300">Pro tasarım</strong> sabit koyu temadır — site açık moddayken bile profil/sıralama
              sayfaları koyu (navy) kalır. Değişiklik tüm ziyaretçilere uygulanır.
            </p>
            <p className="text-gray-500">Not: Sunucu önbelleği nedeniyle değişiklik birkaç saniye gecikebilir (sayfa yenileyin).</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const active = design === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setDesign(opt.key)}
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
