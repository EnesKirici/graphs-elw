"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAdmin, putAdmin, postAdmin } from "@/lib/adminApi";
import { Card, StatTile, Badge, Button, InfoNote } from "@/components/admin/ui";
import { TONES, toneOf } from "@/components/admin/ui/tones";

const TIER_LABELS = {
  EMERALD: "Zümrüt",
  DIAMOND: "Elmas",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

// Tarama modu seçenekleri (panelden tam kontrol) — CollectMatches::scanMode uygular.
const SCAN_MODES = [
  { key: "apex", label: "Sadece Apex", desc: "Challenger/GM/Master. Yeni patch EN hızlı dolar; Zümrüt/Elmas beklemede." },
  { key: "mixed", label: "Karışık", desc: "Apex ağırlıklı ama Zümrüt/Elmas da az az taranır (~%70 / %30)." },
  { key: "fair", label: "Tüm ligler eşit", desc: "Hepsi adil sırayla → en geniş meta; 16.15 daha yavaş dolar." },
];

// Lig → tone paleti (muted, neon değil). Aktif çipin rengini buradan alır.
const TIER_TONES = {
  EMERALD: "mint",
  DIAMOND: "azure",
  MASTER: "violet",
  GRANDMASTER: "rose",
  CHALLENGER: "gold",
};

const ICON_COG = "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";
const ICON_BOLT = "M13 10V3L4 14h7v7l9-11h-7z";
const ICON_CHECK = "M5 13l4 4L19 7";
const ICON_USERS = "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z";
const ICON_QUEUE = "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4";
const ICON_ACTIVITY = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
const ICON_SEARCH = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z";
const ICON_DOWNLOAD = "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4";

export default function WorkerPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(""); // "crawl" | "collect" | ""
  const [msg, setMsg] = useState("");
  const [runOutput, setRunOutput] = useState("");

  // Form state (status'tan beslenir, kullanıcı değiştirir, Kaydet ile yazılır)
  const [enabled, setEnabled] = useState(false);
  const [scanMode, setScanMode] = useState("apex");
  const [matchBudget, setMatchBudget] = useState(40);
  const [players, setPlayers] = useState(15);
  const [userYield, setUserYield] = useState(8);
  const [tiers, setTiers] = useState([]);
  const [since, setSince] = useState("2026-07-16");
  const dirtyRef = useRef(false);

  const load = useCallback(async (syncForm = false) => {
    try {
      const s = await fetchAdmin("/worker");
      setStatus(s);
      // Form yalnız ilk yüklemede (veya kayıt sonrası) durumdan beslenir —
      // otomatik yenileme kullanıcının seçimini ezmesin.
      if (syncForm || !dirtyRef.current) {
        setEnabled(!!s.enabled);
        setScanMode(s.scanMode || "apex");
        setMatchBudget(s.matchBudget ?? 40);
        setPlayers(s.playersPerRun ?? 15);
        setUserYield(s.userYield ?? 8);
        setTiers(s.tiers || []);
        setSince(s.collectSince || "2026-07-16");
      }
    } catch {
      setMsg("load-error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 15000); // canlı durum
    return () => clearInterval(t);
  }, [load]);

  function toggleTier(t) {
    dirtyRef.current = true;
    setTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await putAdmin("/settings/worker_enabled", { value: enabled });
      await putAdmin("/settings/worker_scan_mode", { value: scanMode });
      await putAdmin("/settings/worker_match_budget", { value: Number(matchBudget) });
      await putAdmin("/settings/worker_players", { value: Number(players) });
      await putAdmin("/settings/worker_user_yield", { value: Number(userYield) });
      await putAdmin("/settings/worker_tiers", { value: tiers });
      await putAdmin("/settings/worker_collect_since", { value: since });
      dirtyRef.current = false;
      setMsg("ok");
      setTimeout(() => setMsg(""), 3000);
      load(true);
    } catch {
      setMsg("error");
    } finally {
      setSaving(false);
    }
  }

  async function runNow(kind) {
    setRunning(kind);
    setRunOutput("");
    try {
      const res = await postAdmin(`/worker/${kind}`, {});
      setRunOutput(res.output || "Tamamlandı.");
      if (res.status) setStatus(res.status);
    } catch (e) {
      setRunOutput("Hata: " + (e.message || "çalıştırılamadı"));
    } finally {
      setRunning("");
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;

  const rate = status?.rate || {};
  const poolByTier = status?.poolByTier || {};
  const onCooldown = rate.cooldownUntil > 0;

  return (
    <>
      {/* Canlı worker durumu */}
      {status && (
        <InfoNote
          tone={status.enabled ? "success" : "warn"}
          title={status.enabled ? "Worker çalışıyor" : "Worker kapalı"}
          className="mb-4"
        >
          {status.enabled ? (
            <>
              Ladder taraması her gece 04:15, maç toplama 10 dakikada bir (tur başına ~40 maç).
              Personal key bütçesiyle küçük turlar halinde çalışır; bir kullanıcı siteyi kullanırken
              worker otomatik yol verir.
            </>
          ) : (
            <>
              Kuyruktaki işler biter, yenisi başlamaz. Yeniden başlatmak için aşağıdaki anahtarı aç
              ve Kaydet&apos;e bas.
            </>
          )}
        </InfoNote>
      )}

      {/* Worker ayarları — aç/kapa + ligler + tarih (hepsi tek Kaydet ile yazılır) */}
      <Card
        title="Worker Ayarları"
        subtitle="Ladder taraması + maç toplama. Değişiklikler Kaydet'e basana kadar uygulanmaz."
        icon={ICON_COG}
        className="mb-4"
        actions={
          <div className="flex items-center gap-2">
            {msg === "ok" && <Badge tone="mint" dot>Kaydedildi</Badge>}
            {msg === "error" && <Badge tone="rose" dot>Hata</Badge>}
            <Button variant="primary" size="sm" icon={ICON_CHECK} onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        }
      >
        {/* Aç / Kapa */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-edge/50">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100">Worker&apos;ı çalıştır</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Açıkken ladder taraması + maç toplama otomatik döner. Kapatınca kuyruktaki işler biter,
              yenisi başlamaz.
            </p>
          </div>
          <button
            onClick={() => { dirtyRef.current = true; setEnabled((v) => !v); }}
            role="switch"
            aria-checked={enabled}
            className={`relative w-14 h-8 rounded-full border transition-colors cursor-pointer shrink-0 ${enabled ? "" : "border-edge"}`}
            style={enabled
              ? { background: TONES.mint.bg, borderColor: TONES.mint.bd }
              : { background: "rgba(255,255,255,0.05)" }}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full shadow transition-all ${enabled ? "left-7" : "left-1"}`}
              style={{ background: enabled ? TONES.mint.bar : "#868fa2" }}
            />
          </button>
        </div>

        {/* Lig seçimi + tarih */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
          <div>
            <p className="text-sm font-medium text-gray-100 mb-1">Taranacak ligler</p>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Maçlar seçili liglerdeki oyunculardan toplanır. Her maç bulunduğu ligle damgalanır →
              ileride kullanıcıya &quot;hangi elodan istatistik&quot; filtresi bu veriden gelecek.
            </p>
            <div className="flex flex-wrap gap-2">
              {(status?.tiersAvailable || []).map((t) => {
                const active = tiers.includes(t);
                const tone = toneOf(TIER_TONES[t] || "azure");
                return (
                  <button
                    key={t}
                    onClick={() => toggleTier(t)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      active ? "" : "text-gray-500 border-edge hover:text-gray-300 hover:border-gray-500/50"
                    }`}
                    style={active ? { color: tone.fg, background: tone.bg, borderColor: tone.bd } : undefined}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.dot }} />}
                    {TIER_LABELS[t] || t}
                    {poolByTier[t] ? <span className="opacity-70 tabular-nums">{poolByTier[t]}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-100 mb-1">Maç başlangıç tarihi</p>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Bu tarihten eski maçlar toplanmaz (istek bütçesi yeni patch verisine harcanır).
            </p>
            <input
              type="date"
              value={since}
              onChange={(e) => { dirtyRef.current = true; setSince(e.target.value); }}
              className="bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5b8def] [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Tarama modu — 3 seçenek, tam kontrol */}
        <div className="pt-4 mt-4 border-t border-edge/50">
          <p className="text-sm font-medium text-gray-100 mb-1">Tarama modu</p>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed max-w-2xl">
            Worker hangi ligleri ne öncelikle tarasın. Yeni patch tazeliği için <b className="text-gray-300">Sadece Apex</b> en
            hızlısı; geniş meta için <b className="text-gray-300">Tüm ligler eşit</b>. İkisinin arası: <b className="text-gray-300">Karışık</b>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SCAN_MODES.map((m) => {
              const active = scanMode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => { dirtyRef.current = true; setScanMode(m.key); }}
                  className="text-left rounded-xl border p-3 transition-colors cursor-pointer"
                  style={active
                    ? { borderColor: TONES.gold.bd, background: TONES.gold.bg }
                    : { borderColor: "var(--c-edge)", background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border grid place-items-center shrink-0"
                      style={{ borderColor: active ? TONES.gold.bar : "#4b5563" }}>
                      {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: TONES.gold.bar }} />}
                    </span>
                    <span className="text-sm font-medium" style={active ? { color: TONES.gold.fg } : undefined}>{m.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Performans — hız ↔ site payı (panelden tam kontrol) */}
        <div className="pt-4 mt-4 border-t border-edge/50">
          <p className="text-sm font-medium text-gray-100 mb-1">Performans (hız ↔ site payı)</p>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed max-w-2xl">
            Worker ne kadar agresif toplasın. Yüksek maç/oyuncu + düşük &quot;yol verme&quot; = hızlı veri
            ama <b className="text-gray-300">canlı site yavaşlar</b> (aynı Riot key paylaşılıyor). Dev key
            sınırı tavan; prod key gelince serbest bırakabilirsin.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Tur başına maç", val: matchBudget, set: setMatchBudget, min: 1, max: 300, hint: "Her turda toplanacak maks maç. Yüksek = hızlı ama dev key'i çok yer." },
              { label: "Tur başına oyuncu", val: players, set: setPlayers, min: 1, max: 200, hint: "Her turda taranacak oyuncu — bütçeyi doldurmak için." },
              { label: "Kullanıcıya yol ver (sn)", val: userYield, set: setUserYield, min: 0, max: 60, hint: "0 = worker öncelikli (site yavaşlar) · 8+ = site öncelikli. Kullanıcı Riot'a istek atınca worker bu kadar bekler." },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={f.val}
                  onChange={(e) => { dirtyRef.current = true; f.set(e.target.value); }}
                  className="w-full bg-soft border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5b8def] [color-scheme:dark]"
                />
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Durum kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Havuz" value={status?.poolSize ?? 0} hint="taranan oyuncu havuzu" tone="azure" icon={ICON_USERS} />
        <StatTile label="Kuyruk" value={status?.queueDepth ?? 0} hint="işlenmeyi bekleyen maç" icon={ICON_QUEUE} />
        <StatTile label="Bugün İşlenen" value={status?.processedToday ?? 0} hint={`toplam ${status?.processedTotal ?? 0}`} tone="mint" icon={ICON_ACTIVITY} />
        <StatTile
          label="Rate Limit"
          value={onCooldown ? `${rate.cooldownUntil}s bekle` : "Normal"}
          hint={rate.appCount ? `sayaç: ${rate.appCount}` : "son 10dk istek: " + (rate.requests ?? 0)}
          tone={onCooldown ? "rose" : "mint"}
          icon={ICON_BOLT}
        />
      </div>

      {/* Elle tetikleme */}
      <Card
        title="Elle çalıştır"
        subtitle={`Cron beklemeden bir tur çalıştırır. Son tarama: ${status?.lastCrawlAt || "—"} · Son toplama: ${status?.lastCollectAt || "—"}`}
        icon={ICON_BOLT}
        actions={
          <>
            <Button variant="neutral" size="sm" icon={ICON_SEARCH} onClick={() => runNow("crawl")} disabled={!!running}>
              {running === "crawl" ? "Taranıyor..." : "Havuzu Tara"}
            </Button>
            <Button variant="primary" size="sm" icon={ICON_DOWNLOAD} onClick={() => runNow("collect")} disabled={!!running}>
              {running === "collect" ? "Toplanıyor..." : "Maç Topla"}
            </Button>
          </>
        }
      >
        {runOutput ? (
          <pre className="text-[11px] text-gray-400 bg-soft rounded-xl p-3 border border-edge/50 whitespace-pre-wrap max-h-40 overflow-y-auto">{runOutput}</pre>
        ) : (
          <p className="text-xs text-gray-600">
            Henüz çalıştırılmadı. Bir tur başlatmak için yukarıdaki butonları kullan.
          </p>
        )}
      </Card>
    </>
  );
}
