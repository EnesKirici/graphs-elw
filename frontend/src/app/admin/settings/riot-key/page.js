"use client";

import { useState, useEffect } from "react";
import { fetchAdmin, putAdmin } from "@/lib/adminApi";
import { Card, Button, InfoNote } from "@/components/admin/ui";
import { toneOf } from "@/components/admin/ui/tones";

const ICON_KEY = "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z";
const ICON_CHECK = "M5 13l4 4L19 7";

const PORTAL_URL = "https://developer.riotgames.com/";

/** Saniye → "3s 12dk" / "47dk" / "bitti". */
function fmtLeft(sec) {
  if (sec === null || sec === undefined) return null;
  if (sec <= 0) return "süresi doldu";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} saat ${m} dk` : `${m} dk`;
}

export default function RiotKeyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "ok"|"error", text }
  const [left, setLeft] = useState(null);

  async function load() {
    try {
      const res = await fetchAdmin("/riot-key");
      setData(res);
      setLeft(res.expiresIn);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Kalan süre canlı sayaç — her saniye azalt (sunucuya tekrar sormadan).
  useEffect(() => {
    if (left === null || left === undefined) return;
    const id = setInterval(() => setLeft((v) => (v === null ? null : Math.max(0, v - 1))), 1000);
    return () => clearInterval(id);
  }, [left === null]);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await putAdmin("/riot-key", { key: input.trim() });
      setInput("");
      setMsg({ type: "ok", text: `Kaydedildi: ${res.masked} — anında geçerli.` });
      await load();
    } catch (e) {
      // Backend doğrulama mesajını olduğu gibi göster ("Riot bu anahtarı kabul etmedi" vb.)
      setMsg({ type: "error", text: e.message || "Kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;

  const invalid = !!data?.invalid;
  const expiring = left !== null && left !== undefined && left <= 3600;
  const tone = toneOf(invalid || left === 0 ? "rose" : expiring ? "gold" : "mint");
  const inEnv = data && !data.source;

  return (
    <>
      <Card
        title="Riot API Anahtarı"
        subtitle="Geliştirme anahtarı 24 saatte bir sona erer. Buradan değiştirmek deploy, SSH veya cache temizliği gerektirmez."
        icon={ICON_KEY}
        className="mb-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-edge bg-card/60 p-4">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Şu anki anahtar</p>
            <p className="font-mono text-sm text-gray-100 break-all">{data?.masked || "—"}</p>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: tone.bd, background: tone.bg }}>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Kalan süre</p>
            <p className="text-lg font-semibold" style={{ color: tone.fg }}>
              {invalid ? "geçersiz" : (fmtLeft(left) ?? "bilinmiyor")}
            </p>
          </div>

          <div className="rounded-2xl border border-edge bg-card/60 p-4">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Kaynak</p>
            <p className="text-sm text-gray-300">
              {data?.source === "manual" ? "panelden girildi" : ".env dosyası"}
            </p>
          </div>
        </div>

        {invalid && (
          <InfoNote tone="danger" title="Anahtar şu an geçersiz" className="mt-4">
            Riot son isteklerde 401/403 döndü — site canlı veri çekemiyor. Aşağıdan yeni anahtarı gir.
          </InfoNote>
        )}

        {!invalid && expiring && (
          <InfoNote tone="warn" title="Anahtarın ömrü bitmek üzere" className="mt-4">
            Süre dolduğunda site canlı veri çekemez. Portaldan yenile ve aşağıya yapıştır.
          </InfoNote>
        )}

        {inEnv && (
          <InfoNote tone="info" title="Anahtar hâlâ .env dosyasından okunuyor" className="mt-4">
            Aşağıdan bir anahtar kaydedince veritabanına geçer; bundan sonra değişiklikler
            deploy gerektirmez ve kalan süre takip edilebilir.
          </InfoNote>
        )}
      </Card>

      <Card
        title="Anahtarı değiştir"
        subtitle="Portaldan kopyala, buraya yapıştır. Kaydetmeden önce Riot'a sorulur."
        icon={ICON_CHECK}
        actions={
          <a
            href={PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-4"
          >
            Portalı aç
          </a>
        }
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && input.trim() && !saving) handleSave(); }}
            placeholder="RGAPI-..."
            spellCheck={false}
            autoComplete="off"
            className="flex-1 rounded-xl bg-card border border-edge px-4 py-3 font-mono text-sm text-gray-100 placeholder:text-gray-600 outline-none focus:border-gray-500"
          />
          <Button
            variant="primary"
            icon={ICON_CHECK}
            onClick={handleSave}
            disabled={saving || !input.trim()}
          >
            {saving ? "Doğrulanıyor..." : "Doğrula ve kaydet"}
          </Button>
        </div>

        {msg && (
          <InfoNote tone={msg.type === "ok" ? "success" : "danger"} className="mt-4">
            {msg.text}
          </InfoNote>
        )}

        <p className="text-xs text-gray-500 mt-4 leading-relaxed">
          Anahtar veritabanına şifreli yazılır ve tüm süreçlere anında yayılır. Riot kabul etmezse
          kaydedilmez — eski anahtar yerinde kalır, yani hatalı yapıştırma siteyi düşürmez.
        </p>
      </Card>

      <InfoNote tone="info" title="Neden otomatik değil?" className="mt-4">
        Portaldan anahtarı otomatik almak denendi: Riot, otomasyon tarayıcısından girişi
        reddediyor. Bot korumasını atlatmaya çalışmak, incelemede bekleyen production key
        başvurusunu riske atacağı için bu yol kapatıldı.
      </InfoNote>
    </>
  );
}
