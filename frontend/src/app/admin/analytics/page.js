"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";
import { Card, StatTile, Button, DataTable } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

const nf = (n) => (n ?? 0).toLocaleString("tr-TR");

const ICON_CHART = "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
const ICON_EYE = "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
const ICON_PAGES = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
const ICON_CLICK = "M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 6.257L6.166 4.666M4.5 10.5H2.25m4.007 4.243l-1.59 1.59";
const ICON_DB = "M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3";

// Sıralı-liste satırı için ince dağılım çubuğu — tone paletinden (neon değil).
function Bar({ value, max, tone = "azure" }) {
  const t = TONES[tone] || TONES.azure;
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden min-w-[80px]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.bar }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [pageViews, setPageViews] = useState(null);
  const [clickEvents, setClickEvents] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAdmin(`/analytics/page-views?days=${days}`),
      fetchAdmin("/analytics/events?type=click&per_page=30"),
    ])
      .then(([pv, ce]) => {
        setPageViews(pv);
        setClickEvents(ce);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-soft animate-pulse" />
          ))}
        </div>
        <div className="h-44 rounded-2xl bg-soft animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-soft animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  const maxPageView = pageViews?.pages?.[0]?.views || 1;
  const maxDaily = Math.max(1, ...(pageViews?.daily || []).map((d) => d.views));
  const totalViews = (pageViews?.daily || []).reduce((sum, d) => sum + (d.views || 0), 0);

  // Tıklama olaylarını element'e göre grupla
  const clickGroups = {};
  clickEvents?.data?.forEach((e) => {
    const el = e.data?.element || "unknown";
    if (!clickGroups[el]) clickGroups[el] = 0;
    clickGroups[el]++;
  });
  const clickList = Object.entries(clickGroups).sort((a, b) => b[1] - a[1]);
  const maxClick = clickList.length > 0 ? clickList[0][1] : 1;

  const pageColumns = [
    { key: "rank", label: "#", width: "36px", render: (p, i) => <span className="text-[11px] text-gray-500">{i + 1}</span> },
    { key: "page", label: "Sayfa", render: (p) => <span className="text-sm text-gray-300 font-mono truncate block">{p.page}</span> },
    { key: "bar", label: "Dağılım", width: "32%", render: (p) => <Bar value={p.views} max={maxPageView} tone="azure" /> },
    {
      key: "views", label: "Görüntüleme", align: "right",
      render: (p) => <span className="text-xs text-gray-400 font-mono">{nf(p.views)} <span className="text-gray-600">({nf(p.unique_views)})</span></span>,
    },
  ];

  const clickColumns = [
    { key: "rank", label: "#", width: "36px", render: (c, i) => <span className="text-[11px] text-gray-500">{i + 1}</span> },
    { key: "element", label: "Element", render: ([element]) => <span className="text-sm text-gray-300">{element}</span> },
    { key: "bar", label: "Dağılım", width: "32%", render: ([, count]) => <Bar value={count} max={maxClick} tone="gold" /> },
    { key: "count", label: "Tıklama", align: "right", render: ([, count]) => <span className="text-xs text-gray-400 font-mono">{nf(count)}</span> },
  ];

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-4">
        {[7, 14, 30].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "primary" : "neutral"} onClick={() => setDays(d)}>
            {d} gün
          </Button>
        ))}
      </div>

      {/* KPI kutuları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Toplam Görüntüleme" value={nf(totalViews)} tone="azure" hint={`son ${days} günde`} icon={ICON_EYE} />
        <StatTile label="İzlenen Sayfa" value={nf(pageViews?.pages?.length || 0)} tone="violet" hint="en çok görüntülenen ilk 50" icon={ICON_PAGES} />
        <StatTile label="Farklı Tıklama Elementi" value={nf(clickList.length)} tone="gold" hint="son 30 kayıt içinde" icon={ICON_CLICK} />
        <StatTile label="Toplam Tıklama Kaydı" value={nf(clickEvents?.total || 0)} tone="mint" hint="tüm zamanlar" icon={ICON_DB} />
      </div>

      {/* Günlük görüntüleme grafiği */}
      {pageViews?.daily?.length > 0 && (
        <Card title="Günlük Sayfa Görüntüleme" icon={ICON_CHART} className="mb-4">
          <div className="flex items-end gap-1.5 h-36">
            {pageViews.daily.map((d) => {
              const h = maxDaily > 0 ? (d.views / maxDaily) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-mono">{d.views}</span>
                  <div className="w-full rounded-t transition-all" style={{ height: `${Math.max(h, 4)}%`, background: TONES.violet.bar, opacity: 0.75 }} />
                  <span className="text-[9px] text-gray-600">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sayfalar */}
        <Card title="Sayfa Görüntülemeleri" flush>
          <DataTable
            columns={pageColumns}
            rows={(pageViews?.pages || []).slice(0, 15)}
            rowKey={(p, i) => p.page || i}
            empty="Veri yok."
          />
        </Card>

        {/* Tıklama olayları */}
        <Card title="Tıklama Olayları" flush>
          <DataTable
            columns={clickColumns}
            rows={clickList.slice(0, 15)}
            rowKey={([element]) => element}
            empty="Veri yok."
          />
        </Card>
      </div>
    </>
  );
}
