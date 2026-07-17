"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAdmin, putAdmin, postAdmin } from "@/lib/adminApi";

const TIER_LABELS = {
  EMERALD: "Zümrüt",
  DIAMOND: "Elmas",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

const TIER_COLORS = {
  EMERALD: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  DIAMOND: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  MASTER: "text-purple-400 border-purple-500/40 bg-purple-500/10",
  GRANDMASTER: "text-red-400 border-red-500/40 bg-red-500/10",
  CHALLENGER: "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

function StatCard({ label, value, hint }) {
  return (
    <div className="glass rounded-2xl p-4 border border-edge">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
      {hint ? <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p> : null}
    </div>
  );
}

export default function WorkerPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(""); // "crawl" | "collect" | ""
  const [msg, setMsg] = useState("");
  const [runOutput, setRunOutput] = useState("");

  // Form state (status'tan beslenir, kullanıcı değiştirir, Kaydet ile yazılır)
  const [enabled, setEnabled] = useState(false);
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

  return (
    <>
      {/* Başlık + kaydet */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Meta Worker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ladder taraması + maç toplama. Personal key bütçesiyle küçük turlar halinde çalışır;
            bir kullanıcı siteyi kullanırken worker otomatik yol verir.
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

      {/* Aç / Kapa */}
      <div className="glass rounded-2xl p-5 mb-4 border border-edge flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Worker</h3>
          <p className="text-xs text-gray-500 mt-1">
            Açıkken: ladder taraması her gece 04:15, maç toplama 10 dakikada bir (tur başına ~40 maç).
            Kapatınca kuyruktaki işler biter, yenisi başlamaz.
          </p>
        </div>
        <button
          onClick={() => { dirtyRef.current = true; setEnabled((v) => !v); }}
          role="switch"
          aria-checked={enabled}
          className={`relative w-14 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
            enabled ? "bg-emerald-500/80" : "bg-gray-600/60"
          }`}
        >
          <span
            className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
              enabled ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* Lig seçimi + tarih */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="glass rounded-2xl p-5 border border-edge">
          <h3 className="text-sm font-semibold text-gray-100 mb-1">Taranacak ligler</h3>
          <p className="text-xs text-gray-500 mb-3">
            Maçlar seçili liglerdeki oyunculardan toplanır. Her maç bulunduğu ligle damgalanır →
            ileride kullanıcıya "hangi elodan istatistik" filtresi bu veriden gelecek.
          </p>
          <div className="flex flex-wrap gap-2">
            {(status?.tiersAvailable || []).map((t) => {
              const active = tiers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTier(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    active
                      ? TIER_COLORS[t] || "text-blue-400 border-blue-500/40 bg-blue-500/10"
                      : "text-gray-500 border-edge hover:border-gray-500/50"
                  }`}
                >
                  {TIER_LABELS[t] || t}
                  {poolByTier[t] ? (
                    <span className="ml-1.5 opacity-70">{poolByTier[t]}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-5 border border-edge">
          <h3 className="text-sm font-semibold text-gray-100 mb-1">Maç başlangıç tarihi</h3>
          <p className="text-xs text-gray-500 mb-3">
            Bu tarihten eski maçlar toplanmaz (istek bütçesi yeni patch verisine harcanır).
          </p>
          <input
            type="date"
            value={since}
            onChange={(e) => { dirtyRef.current = true; setSince(e.target.value); }}
            className="bg-soft border border-edge rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500/60 [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Durum kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Havuz" value={status?.poolSize ?? 0} hint="taranan oyuncu havuzu" />
        <StatCard label="Kuyruk" value={status?.queueDepth ?? 0} hint="işlenmeyi bekleyen maç" />
        <StatCard label="Bugün İşlenen" value={status?.processedToday ?? 0} hint={`toplam ${status?.processedTotal ?? 0}`} />
        <StatCard
          label="Rate Limit"
          value={rate.cooldownUntil > 0 ? `${rate.cooldownUntil}s bekle` : "Normal"}
          hint={rate.appCount ? `sayaç: ${rate.appCount}` : "son 10dk istek: " + (rate.requests ?? 0)}
        />
      </div>

      {/* Elle tetikleme */}
      <div className="glass rounded-2xl p-5 border border-edge">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Elle çalıştır</h3>
            <p className="text-xs text-gray-500 mt-1">
              Cron beklemeden bir tur çalıştırır. Son tarama: {status?.lastCrawlAt || "—"} ·
              Son toplama: {status?.lastCollectAt || "—"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runNow("crawl")}
              disabled={!!running}
              className="text-xs font-medium px-4 py-2 rounded-xl border border-edge text-gray-300 hover:text-white hover:border-gray-500/60 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {running === "crawl" ? "Taranıyor..." : "Havuzu Tara"}
            </button>
            <button
              onClick={() => runNow("collect")}
              disabled={!!running}
              className="text-xs font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              {running === "collect" ? "Toplanıyor..." : "Maç Topla"}
            </button>
          </div>
        </div>
        {runOutput ? (
          <pre className="mt-3 text-[11px] text-gray-400 bg-soft rounded-xl p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">{runOutput}</pre>
        ) : null}
      </div>
    </>
  );
}
