"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { Card, Badge, Button, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

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
      {/* Bilgi + kaydet aksiyonu */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <InfoNote tone="info" title="İpucu" className="flex-1 min-w-[280px]">
          Title <strong className="text-gray-300">50-60 karakter</strong>, description{" "}
          <strong className="text-gray-300">140-160 karakter</strong> arasında en iyi görünür. Şampiyon detay
          şablonunda yer tutucular kullanılır:{" "}
          <code className="text-gray-300 bg-black/25 px-1 py-0.5 rounded">{"{name}"}</code>{" "}
          <code className="text-gray-300 bg-black/25 px-1 py-0.5 rounded">{"{position}"}</code>{" "}
          <code className="text-gray-300 bg-black/25 px-1 py-0.5 rounded">{"{patch}"}</code>{" "}
          <code className="text-gray-300 bg-black/25 px-1 py-0.5 rounded">{"{winrate}"}</code>{" "}
          <code className="text-gray-300 bg-black/25 px-1 py-0.5 rounded">{"{title}"}</code> (şampiyonun unvanı).
          Değişiklik deploy gerektirmez; sunucu önbelleği nedeniyle 1-2 dakika içinde yayına yansır. Sonuçları
          Google Search Console → Performans&apos;tan takip edebilirsin.
        </InfoNote>

        <div className="flex items-center gap-3 shrink-0 pt-1">
          {msg === "ok" && <Badge tone="mint" dot>Kaydedildi</Badge>}
          {msg === "error" && <Badge tone="rose" dot>Hata</Badge>}
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      {/* Sayfa başına title/description override'ları */}
      <div className="space-y-4">
        {PAGES.map((page) => {
          const v = values[page.key] || {};
          const titleLen = (v.title || "").length;
          const descLen = (v.description || "").length;
          const active = !!(v.title || v.description);
          return (
            <Card
              key={page.key}
              title={page.label}
              subtitle={page.path}
              actions={active ? <Badge tone="azure" dot>özel metin aktif</Badge> : null}
            >
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wider">Title</label>
                    {titleLen > 0 && (
                      titleLen > 65 ? (
                        <span className="text-[10px]" style={{ color: TONES.gold.fg }}>{titleLen} karakter</span>
                      ) : (
                        <span className="text-[10px] text-gray-600">{titleLen} karakter</span>
                      )
                    )}
                  </div>
                  <input
                    type="text"
                    value={v.title || ""}
                    onChange={(e) => setField(page.key, "title", e.target.value)}
                    placeholder={page.defaults.title}
                    className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#5b8def]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wider">Description</label>
                    {descLen > 0 && (
                      descLen > 170 ? (
                        <span className="text-[10px]" style={{ color: TONES.gold.fg }}>{descLen} karakter</span>
                      ) : (
                        <span className="text-[10px] text-gray-600">{descLen} karakter</span>
                      )
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={v.description || ""}
                    onChange={(e) => setField(page.key, "description", e.target.value)}
                    placeholder={page.defaults.description}
                    className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#5b8def] resize-y"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
