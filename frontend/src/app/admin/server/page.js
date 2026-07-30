"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdmin } from "@/lib/adminApi";
import { Card, StatTile, Badge, Button, DataTable } from "@/components/admin/ui";
import { toneOf, TONES } from "@/components/admin/ui/tones";

const nf = (n) => (n ?? 0).toLocaleString("tr-TR");
function fmtBytes(b) {
  b = Number(b) || 0;
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 || b >= 100 ? 0 : 1)} ${u[i]}`;
}
// Yük rengi: rahat=mint, yükseliyor=gold, kritik=rose.
const barTone = (p) => (p == null ? "neutral" : p < 70 ? "mint" : p < 88 ? "gold" : "rose");

const ICON_CPU = "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 7h10v10H7z";
const ICON_RAM = "M5 12V7a2 2 0 012-2h10a2 2 0 012 2v5M5 12h14M5 12v5a2 2 0 002 2h10a2 2 0 002-2v-5M8 16h.01M12 16h.01M16 16h.01";
const ICON_DISK = "M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3";
const ICON_DB = "M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3";
const ICON_REFRESH = "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15";

function MetricBar({ label, percent, sub, icon }) {
  const t = toneOf(barTone(percent));
  return (
    <div className="relative rounded-xl border border-edge bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider truncate">{label}</p>
        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-2xl font-semibold mt-1.5 tabular-nums" style={{ color: t.fg }}>
        {percent != null ? `${percent}%` : "—"}
      </p>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-2">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${percent || 0}%`, background: t.bar }} />
      </div>
      {sub && <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{sub}</p>}
    </div>
  );
}

export default function ServerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchAdmin("/server"));
      setErr("");
    } catch {
      setErr("Sunucu durumu alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // canlı yenile
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <div className="h-64 rounded-2xl bg-soft animate-pulse" />;
  if (!data) return <p className="text-sm" style={{ color: TONES.rose.fg }}>{err || "Veri yok."}</p>;

  const { cpu = {}, ram = {}, disk = {}, db = {}, queue = {} } = data;

  const dbCols = [
    { key: "name", label: "Tablo", render: (r) => <span className="text-gray-200 font-medium">{r.name}</span> },
    { key: "rows", label: "Satır", align: "right", render: (r) => <span className="tabular-nums text-gray-400">{nf(r.rows)}</span> },
    {
      key: "bar", label: "Pay", width: "34%",
      render: (r) => {
        const max = Math.max(1, ...(db.tables || []).map((x) => x.bytes || 0));
        return (
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden min-w-[80px]">
            <div className="h-full rounded-full" style={{ width: `${(r.bytes / max) * 100}%`, background: TONES.azure.bar }} />
          </div>
        );
      },
    },
    { key: "bytes", label: "Boyut", align: "right", render: (r) => <span className="tabular-nums text-gray-300">{fmtBytes(r.bytes)}</span> },
  ];

  return (
    <>
      {/* Ana metrikler */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricBar label="CPU" percent={cpu.percent} icon={ICON_CPU}
          sub={`yük ${cpu.load1 ?? "—"} / ${cpu.load5 ?? "—"} / ${cpu.load15 ?? "—"} · ${cpu.cores ?? "?"} çekirdek`} />
        <MetricBar label="RAM" percent={ram.percent} icon={ICON_RAM}
          sub={`${fmtBytes(ram.used)} / ${fmtBytes(ram.total)} kullanımda`} />
        <MetricBar label="Disk" percent={disk.percent} icon={ICON_DISK}
          sub={`${fmtBytes(disk.used)} / ${fmtBytes(disk.total)} · boş ${fmtBytes(disk.free)}`} />
        <StatTile label="Veritabanı" value={fmtBytes(db.total)} tone="azure" icon={ICON_DB}
          hint={`${(db.tables || []).length}+ tablo`} />
      </div>

      {/* Kuyruk + PHP + yenile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Kuyruk (bekleyen)" value={nf(queue.pending)} tone={queue.pending > 500 ? "gold" : "mint"} hint="işlenmeyi bekleyen iş" />
        <StatTile label="Başarısız İş" value={nf(queue.failed)} tone={queue.failed > 0 ? "rose" : "neutral"} hint="failed_jobs" />
        <StatTile label="PHP" value={data.php || "—"} hint="sürüm" />
        <div className="rounded-xl border border-edge bg-card/60 p-4 flex flex-col justify-between">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Güncelleme</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <Badge tone="mint" dot>Canlı · 10sn</Badge>
            <Button variant="neutral" size="sm" icon={ICON_REFRESH} onClick={load}>Yenile</Button>
          </div>
        </div>
      </div>

      {/* DB tabloları */}
      <Card title="Veritabanı — en büyük tablolar" subtitle="Disk kullanımına göre (boyut + satır)." icon={ICON_DB} flush
        actions={<Badge tone="azure">{fmtBytes(db.total)}</Badge>}>
        <DataTable columns={dbCols} rows={db.tables || []} rowKey={(r) => r.name} empty="Tablo verisi yok." />
      </Card>

      {err && <p className="mt-3 text-xs" style={{ color: TONES.rose.fg }}>{err}</p>}
    </>
  );
}
