"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdmin, postAdmin } from "@/lib/adminApi";
import { Card, StatTile, Badge, Button, ConfirmButton, InfoNote, DataTable } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

const nf = (n) => (n ?? 0).toLocaleString("tr-TR");
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function fmtDate(iso) {
  if (!iso) return null;
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
function rangeLabel(start, end) {
  const s = fmtDate(start), e = fmtDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s && !e) return `${s} → şimdi`;
  if (!s && e) return `${e} öncesi`;
  return "—";
}

const ICON_REFRESH = "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15";
const ICON_TRASH = "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16";
const ICON_DB = "M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3";

export default function RetentionPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
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
      await load();
    } catch (e) {
      setErr("Silme başarısız: " + (e.message || ""));
    } finally {
      setPruning(false);
    }
  }

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;
  if (!report) return <p className="text-sm" style={{ color: TONES.rose.fg }}>{err || "Veri yok."}</p>;

  const s = report.sizes || {};
  const patches = report.patches || [];
  const maxMatches = Math.max(1, ...patches.map((p) => p.matches || 0));
  const canPrune = report.prunableMatches > 0;

  const columns = [
    { key: "patch", label: "Patch", render: (p) => <span className="text-gray-100 font-medium">{p.patch}</span> },
    { key: "range", label: "Tarih Aralığı", render: (p) => <span className="text-xs text-gray-500">{rangeLabel(p.start, p.end)}</span> },
    {
      key: "bar", label: "Dağılım", width: "34%",
      render: (p) => (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden min-w-[80px]">
          <div className="h-full rounded-full" style={{ width: `${(p.matches / maxMatches) * 100}%`, background: p.kept ? TONES.azure.bar : TONES.rose.bar }} />
        </div>
      ),
    },
    { key: "matches", label: "Maç", align: "right", render: (p) => <span className="tabular-nums text-gray-300">{nf(p.matches)}</span> },
    {
      key: "status", label: "Durum", align: "right",
      render: (p) => p.kept ? <Badge tone="azure" dot>Tutuluyor</Badge> : <Badge tone="rose" dot>Silinebilir</Badge>,
    },
  ];

  return (
    <>
      {/* KPI kutuları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Toplam Maç" value={nf(report.totalMatches)} hint={`~${s.totalMb ?? 0} MB · maç + timeline`} icon={ICON_DB} />
        <StatTile label="Kalacak" value={nf(report.keptMatches)} tone="azure" hint={`tutulan: ${(report.keptPatches || []).join(" + ")}`} />
        <StatTile label="Silinebilir" value={nf(report.prunableMatches)} tone="rose" hint={`${report.cutoff || "—"} öncesi`} />
        <StatTile label="Tahmini Kazanç" value={`~${report.estFreedMb ?? 0} MB`} tone="mint" hint={`maç ${s.matchesMb ?? 0} · timeline ${s.timelinesMb ?? 0} MB`} />
      </div>

      <InfoNote tone="success" title="Otomatik silme kapalı" className="mb-4">
        Yeni yama gelince eski maçlar kendiliğinden silinmez; yalnızca meta gösterimi tutulan patch
        penceresine (güncel + önceki) kayar. Diskteki eski maçlar burada, sen &quot;Sil&quot; diyene kadar durur.
      </InfoNote>

      {/* Elle silme */}
      <Card
        title="Eski Maçları Sil"
        icon={ICON_TRASH}
        className="mb-4"
        actions={canPrune ? (
          <ConfirmButton label="Eski Maçları Sil" confirmLabel="Evet, sil" busyLabel="Siliniyor..." onConfirm={doPrune} busy={pruning} icon={ICON_TRASH} />
        ) : null}
      >
        <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
          {canPrune ? (
            <>
              <span className="font-medium" style={{ color: TONES.rose.fg }}>{report.cutoff}</span> tarihinden eski{" "}
              <span className="font-medium" style={{ color: TONES.rose.fg }}>{nf(report.prunableMatches)} maç</span> ve ilişkili
              timeline&apos;lar silinir (~{report.estFreedMb} MB). Profiller bozulmaz — özet/LP ayrı tabloda,
              detay gerekirse Riot&apos;tan yeniden çekilir. <b className="text-gray-200">Geri alınamaz.</b>
            </>
          ) : (
            "Tutulan patch penceresinden eski maç yok — silinecek bir şey yok."
          )}
        </p>
        {result && (
          <div className="mt-3 text-xs bg-soft rounded-xl p-3 border border-edge/50">
            <p style={{ color: TONES.mint.fg }}>{result.message}</p>
            {!result.skipped && (
              <p className="text-gray-500 mt-1">
                Kalan maç: {nf(result.remaining)}. Sayaçları tazelemek için sunucuda{" "}
                <code className="text-gray-400 bg-black/30 px-1 py-0.5 rounded">php artisan stats:rebuild</code> çalıştırılabilir.
              </p>
            )}
          </div>
        )}
        {err && <p className="mt-3 text-xs" style={{ color: TONES.rose.fg }}>{err}</p>}
      </Card>

      {/* Patch dağılımı */}
      <Card
        title="Patch Dağılımı"
        subtitle="Hangi yamada kaç maç var, hangi tarihleri kapsıyor, hangileri tutuluyor. (Sayım maç tarihine göredir.)"
        flush
        actions={<Button variant="neutral" size="sm" icon={ICON_REFRESH} onClick={load}>Yenile</Button>}
      >
        <DataTable columns={columns} rows={patches} rowKey={(p) => p.patch} empty="Patch verisi yok." />
      </Card>
    </>
  );
}
