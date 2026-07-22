"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";

/*
  SEO Ayarları — sayfa title/description ezmeleri.
  Boş bırakılan alan koddaki varsayılan metni kullanır (placeholder'da görünür).
  Kaydedilen değerler deploy gerektirmeden ~1-2 dk içinde yayına yansır
  (sunucu tarafı metadata cache'i 60 sn).
*/

const PAGES = [
  {
    key: "home",
    label: "Ana Sayfa",
    path: "/",
    defaults: {
      title: "ElwGraphs — LoL Oyuncu İstatistikleri, Maç Analizi ve Meta",
      description:
        "League of Legends oyuncu profilleri, detaylı maç analizi, ELW Score performans puanlaması, canlı maç ön-analizi ve güncel şampiyon meta/tier listesi. Riot ID ile oyuncu ara, performansını incele.",
    },
  },
  {
    key: "champions",
    label: "Şampiyonlar",
    path: "/champions",
    defaults: {
      title: "Tüm LoL Şampiyonları — Build, Rün ve İstatistik",
      description:
        "League of Legends'ın tüm şampiyonları tek listede: yetenekler, build önerileri, rünler, tier sıralaması ve istatistikler. Aradığın LoL karakterini bul ve incele.",
    },
  },
  {
    key: "tier-list",
    label: "Tier List",
    path: "/tier-list",
    defaults: {
      title: "LoL Tier List — Güncel Meta Şampiyon Sıralaması",
      description:
        "Güncel patch League of Legends meta tier list: şampiyonların kazanma, seçilme ve banlanma oranları, koridor dağılımı ve S/A/B tier sıralaması. En güçlü şampiyonlar tek listede.",
    },
  },
  {
    key: "leaderboard",
    label: "Sıralama",
    path: "/leaderboard",
    defaults: {
      title: "LoL Sıralama — TR Challenger & Grandmaster",
      description:
        "Türkiye (TR1) League of Legends sıralaması: Challenger, Grandmaster ve Master oyuncular. LP, kazanma oranı, en çok oynanan şampiyonlar ve koridor dağılımı canlı listede.",
    },
  },
  {
    key: "champion_detail",
    label: "Şampiyon Detay (şablon)",
    path: "/champions/[şampiyon] — 171 sayfa",
    template: true,
    defaults: {
      title: "{name} Build, Rünler ve İstatistikler — {position}, Patch {patch}",
      description:
        "{name} Patch {patch} {position} rehberi: {winrate} kazanma oranlı build, rün dizilimi, eşya sırası, sihirdar büyüleri ve güncel maç istatistikleri.",
    },
  },
];

export default function SeoSettingsPage() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAdmin("/settings/seo_overrides")
      .then((res) => setValues(res.value || {}))
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, []);

  function setField(pageKey, field, val) {
    setValues((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [field]: val },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    // Boş string'leri temizle → o alan varsayılana döner
    const cleaned = {};
    for (const [pageKey, fields] of Object.entries(values)) {
      const entry = {};
      if (fields?.title?.trim()) entry.title = fields.title.trim();
      if (fields?.description?.trim()) entry.description = fields.description.trim();
      if (Object.keys(entry).length) cleaned[pageKey] = entry;
    }
    try {
      await putAdmin("/settings/seo_overrides", { value: cleaned });
      setValues(cleaned);
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
          <h1 className="text-xl font-bold text-white">SEO — Başlık ve Açıklamalar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Google sonuçlarında görünen title/description metinleri. Boş alan = koddaki varsayılan (soluk yazı).
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
              İpucu: title <strong className="text-gray-300">50-60 karakter</strong>, description{" "}
              <strong className="text-gray-300">140-160 karakter</strong> arasında en iyi görünür.
              Şampiyon detay şablonunda yer tutucular kullanılır:{" "}
              <code className="text-blue-300">{"{name}"}</code> <code className="text-blue-300">{"{position}"}</code>{" "}
              <code className="text-blue-300">{"{patch}"}</code> <code className="text-blue-300">{"{winrate}"}</code>{" "}
              <code className="text-blue-300">{"{title}"}</code> (şampiyonun unvanı).
            </p>
            <p className="text-gray-500">
              Değişiklik deploy gerektirmez; sunucu önbelleği nedeniyle 1-2 dakika içinde yayına yansır.
              Sonuçları Google Search Console → Performans'tan takip edebilirsin.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {PAGES.map((page) => {
          const v = values[page.key] || {};
          const titleLen = (v.title || "").length;
          const descLen = (v.description || "").length;
          return (
            <div key={page.key} className="glass rounded-2xl p-5 border border-edge">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-semibold text-gray-100">{page.label}</h3>
                  <span className="text-[10px] text-gray-600 font-mono">{page.path}</span>
                </div>
                {(v.title || v.description) && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    özel metin aktif
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wider">Title</label>
                    {titleLen > 0 && (
                      <span className={`text-[10px] ${titleLen > 65 ? "text-amber-400" : "text-gray-600"}`}>
                        {titleLen} karakter
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={v.title || ""}
                    onChange={(e) => setField(page.key, "title", e.target.value)}
                    placeholder={page.defaults.title}
                    className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wider">Description</label>
                    {descLen > 0 && (
                      <span className={`text-[10px] ${descLen > 170 ? "text-amber-400" : "text-gray-600"}`}>
                        {descLen} karakter
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={v.description || ""}
                    onChange={(e) => setField(page.key, "description", e.target.value)}
                    placeholder={page.defaults.description}
                    className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 resize-y"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
