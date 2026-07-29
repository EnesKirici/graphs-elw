"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { Card, Badge, Button, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

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

const ICON_SAVE = "M5 13l4 4L19 7";
const ICON_LAYOUT = "M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 9h16M9 20V9";

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
      {/* Global kaydet + durum */}
      <div className="mb-5 flex items-center justify-end gap-3">
        {msg === "ok" && <Badge tone="mint" dot>Kaydedildi</Badge>}
        {msg === "error" && <Badge tone="rose" dot>Hata</Badge>}
        <Button variant="primary" size="md" icon={ICON_SAVE} onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      {/* Pro tasarım = sabit koyu tema; değişiklik tüm ziyaretçilere uygulanır. */}
      <InfoNote tone="info" title="Pro tasarım sabit koyu temadır" className="mb-4">
        Site açık moddayken bile profil/sıralama sayfaları koyu (navy) kalır. Değişiklik tüm ziyaretçilere uygulanır.
      </InfoNote>

      <Card
        title="Görünüm"
        subtitle="Profil ve sıralama sayfalarının hangi tasarımla gösterileceğini seç (siteye geneline uygulanır). Not: Sunucu önbelleği nedeniyle değişiklik birkaç saniye gecikebilir (sayfa yenileyin)."
        icon={ICON_LAYOUT}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OPTIONS.map((opt) => {
            const active = design === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setDesign(opt.key)}
                className={`text-left rounded-xl p-4 border transition-all cursor-pointer ${
                  active ? "" : "border-edge bg-card/40 hover:bg-hover"
                }`}
                style={active ? { borderColor: TONES.azure.bar, background: TONES.azure.bg, boxShadow: `inset 0 0 0 1px ${TONES.azure.bd}` } : undefined}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className={`text-sm font-semibold truncate ${active ? "text-white" : "text-gray-200"}`}>{opt.title}</h3>
                    {active && <Badge tone="azure" dot>Seçili</Badge>}
                  </div>
                  <span
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: active ? TONES.azure.bar : "#4b5563" }}
                  >
                    {active && <span className="w-2 h-2 rounded-full" style={{ background: TONES.azure.bar }} />}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}
