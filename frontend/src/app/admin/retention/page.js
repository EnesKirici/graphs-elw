"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdmin, postAdmin } from "@/lib/adminApi";

function StatCard({ label, value, hint, tone = "white" }) {
  const valueCls = tone === "red" ? "text-red-400" : tone === "blue" ? "text-blue-300" : "text-white";
  return (
    <div className="glass rounded-2xl p-4 border border-edge">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueCls}`}>{value}</p>
      {hint ? <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p> : null}
    </div>
  );
}

const nf = (n) => (n ?? 0).toLocaleString("tr-TR");

export default function RetentionPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setReport(await fetchAdmin("/retention"));
      setErr("");
    } catch {
      setErr("Rapor yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doPrune() {
    setPruning(true);
    setResult(null);
    try {
      const res = await postAdmin("/retention/prune", {});
      setResult(res);
      setConfirming(false);
      await load();
    } catch (e) {
      setErr("Silme başarısız: " + (e.message || ""));
    } finally {
      setPruning(false);
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;
  if (!report) return <p className="text-sm text-red-400">{err || "Veri yok."}</p>;

  const s = report.sizes || {};
  const canPrune = report.prunableMatches > 0;

  return (
    <>
      {/* Başlık */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Veri Saklama</h1>
        <p className="text-sm text-gray-500 mt-1">
          Eski patch maçlarının disk kullanımı ve elle temizleme. Silme kararı sende — otomatik silme yok.
        </p>
      </div>

      {/* Otomatik silme kapalı bilgisi */}
      <div className="glass rounded-2xl p-4 mb-4 border border-edge flex items-start gap-3">
        <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm text-gray-200 font-medium">Otomatik silme kapalı</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Yeni yama gelince eski maçlar kendiliğinden silinmez; yalnızca meta gösterimi tutulan patch
            penceresine (güncel + önceki) kayar. Diskteki eski maçlar burada, sen &quot;Sil&quot; diyene kadar durur.
          </p>
        </div>
      </div>

      {/* Durum kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Toplam Maç" value={nf(report.totalMatches)} hint={`~${s.totalMb ?? 0} MB (maç+timeline)`} />
        <StatCard label="Kalacak" value={nf(report.keptMatches)} tone="blue" hint={`tutulan: ${(report.keptPatches || []).join(" + ")}`} />
        <StatCard label="Silinebilir" value={nf(report.prunableMatches)} tone="red" hint={`${report.cutoff || "—"} öncesi`} />
        <StatCard label="Tahmini Kazanç" value={`~${report.estFreedMb ?? 0} MB`} hint={`maç ${s.matchesMb ?? 0} · timeline ${s.timelinesMb ?? 0} MB`} />
      </div>

      {/* Prune (elle silme) */}
      <div className="glass rounded-2xl p-5 mb-4 border border-edge">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Eski Maçları Sil</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
              {canPrune ? (
                <>
                  <span className="text-red-400 font-medium">{report.cutoff}</span> tarihinden eski{" "}
                  <span className="text-red-400 font-medium">{nf(report.prunableMatches)} maç</span> ve ilişkili
                  timeline&apos;lar silinir (~{report.estFreedMb} MB). Profiller bozulmaz — özet/LP ayrı tabloda,
                  detay gerekirse Riot&apos;tan yeniden çekilir. <b>Geri alınamaz.</b>
                </>
              ) : (
                "Tutulan patch penceresinden eski maç yok — silinecek bir şey yok."
              )}
            </p>
          </div>
          {canPrune && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs font-medium px-4 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
            >
              Eski Maçları Sil
            </button>
          )}
          {confirming && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-amber-400">Emin misin? Geri alınamaz.</span>
              <button
                onClick={doPrune}
                disabled={pruning}
                className="text-xs font-medium px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
              >
                {pruning ? "Siliniyor..." : "Evet, sil"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={pruning}
                className="text-xs font-medium px-4 py-2 rounded-xl border border-edge text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
        {result && (
          <div className="mt-3 text-xs bg-soft rounded-xl p-3">
            <p className="text-emerald-400">{result.message}</p>
            {!result.skipped && (
              <p className="text-gray-500 mt-1">
                Kalan maç: {nf(result.remaining)}. Sayaçları tazelemek için sunucuda{" "}
                <code className="text-gray-400">php artisan stats:rebuild</code> çalıştırılabilir.
              </p>
            )}
          </div>
        )}
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
      </div>

      {/* Patch dağılımı */}
      <div className="glass rounded-2xl border border-edge overflow-hidden">
        <div className="px-5 py-3.5 border-b border-edge/50">
          <h3 className="text-sm font-semibold text-gray-100">Patch Dağılımı</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Hangi yamada kaç maç var, hangileri tutuluyor.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-gray-600 uppercase tracking-wider">
              <th className="text-left font-medium px-5 py-2">Patch</th>
              <th className="text-right font-medium px-5 py-2">Maç</th>
              <th className="text-right font-medium px-5 py-2">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/30">
            {(report.patches || []).map((p) => (
              <tr key={p.patch} className="hover:bg-hover transition-colors">
                <td className="px-5 py-2.5 text-gray-200 font-medium">{p.patch}</td>
                <td className="px-5 py-2.5 text-right text-gray-400">{nf(p.matches)}</td>
                <td className="px-5 py-2.5 text-right">
                  {p.kept ? (
                    <span className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">Tutuluyor</span>
                  ) : (
                    <span className="text-[11px] text-red-400/90 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">Silinebilir</span>
                  )}
                </td>
              </tr>
            ))}
            {!(report.patches || []).length && (
              <tr><td colSpan={3} className="px-5 py-6 text-center text-xs text-gray-600">Patch verisi yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
