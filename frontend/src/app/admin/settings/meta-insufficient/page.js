"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { Card, Button, InfoNote } from "@/components/admin/ui";
import { TONES, toneOf } from "@/components/admin/ui/tones";

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

const ICON_CHART = "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
const ICON_CHECK = "M5 13l4 4L19 7";

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
      {/* Açıklama + kaydet */}
      <Card
        title="Meta Verisi — Yetersiz Örneklem"
        subtitle="Ana sayfadaki şampiyon WR/pick/ban için yeterli maç verisi (20+) olmayan şampiyonlarda ne gösterilsin?"
        icon={ICON_CHART}
        className="mb-4"
        actions={
          <div className="flex items-center gap-3">
            {msg === "ok" && <span className="text-xs" style={{ color: TONES.mint.fg }}>Kaydedildi!</span>}
            {msg === "error" && <span className="text-xs" style={{ color: TONES.rose.fg }}>Hata!</span>}
            <Button variant="primary" size="sm" icon={ICON_CHECK} onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        }
      >
        <div className="text-xs text-gray-400 space-y-2 leading-relaxed max-w-3xl">
          <p>
            Verimiz şu an küçük (~2000 maç) ve yanlı (aranan/takip edilen TR oyuncuları). Bu yüzden çok az
            oynanan şampiyonların WR&apos;si gürültülü olur. <strong className="text-gray-200">&quot;Veri yetersiz&quot;</strong>{" "}
            seçeneği bu şampiyonlarda uydurma sayı yerine dürüstçe boş bırakır.
          </p>
          <p className="text-gray-500">Not: Sunucu önbelleği nedeniyle değişiklik birkaç saniye gecikebilir (sayfa yenileyin).</p>
        </div>
      </Card>

      {/* Gösterim modu seçimi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const active = mode === opt.key;
          const t = toneOf(opt.key === "label" ? "mint" : "gold");
          return (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`text-left rounded-2xl p-5 border bg-card/60 transition-all cursor-pointer ${active ? "" : "border-edge hover:border-edge/80 hover:bg-hover"}`}
              style={active ? { borderColor: t.bd, background: t.bg } : undefined}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-gray-100">{opt.title}</h3>
                <span
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: active ? t.bar : "rgba(255,255,255,0.25)" }}
                >
                  {active && <span className="w-2 h-2 rounded-full" style={{ background: t.bar }} />}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Simüle mod uyarısı */}
      {mode === "sim" && (
        <InfoNote tone="warn" title="Dikkat: simüle veri açık" className="mt-4">
          Bu modda az örneklemli şampiyonlar için gösterilen WR/pick/ban değerleri GERÇEK DEĞİLDİR — tahminidir.
          Kaydettikten sonra ana sayfada dolu ama uydurma sayılar görünür.
        </InfoNote>
      )}
    </>
  );
}
