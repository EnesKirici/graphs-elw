"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";
import { Card, StatTile, InfoNote } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

function BarChart({ data, barColor, emptyText = "Veri yok." }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-36 text-xs text-gray-600">{emptyText}</div>
    );
  }

  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-1.5 h-36">
      {data.map((d, i) => {
        const h = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[10px] text-gray-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{d.value}</span>
            <div
              className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
              style={{ height: `${Math.max(h, 6)}%`, background: barColor }}
            />
            <span className="text-[9px] text-gray-600">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankList({ items, barColor, emptyText = "Veri yok." }) {
  if (!items?.length) {
    return <p className="text-xs text-gray-600 py-4 text-center">{emptyText}</p>;
  }

  const max = items[0]?.count || 1;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 group">
          <span className={`text-[11px] w-5 text-right font-mono ${i < 3 ? "text-gray-300 font-bold" : "text-gray-600"}`}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm truncate ${i < 3 ? "text-gray-200" : "text-gray-400"}`}>{item.label}</span>
              <span className="text-xs text-gray-500 font-mono ml-2 shrink-0">{item.count}</span>
            </div>
            <div className="h-1 rounded-full bg-edge overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(item.count / max) * 100}%`, background: barColor }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatsOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmin("/dashboard")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-soft border border-edge animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-soft border border-edge animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <InfoNote tone="danger" title="Dashboard verileri yuklenemedi.">
        Backend baglantisini kontrol edin.
      </InfoNote>
    );
  }

  const durationMin = Math.floor((data.avgDuration || 0) / 60);
  const durationSec = (data.avgDuration || 0) % 60;

  const chartData = (data.dailyTrend || []).map((d) => ({
    value: d.sessions,
    label: d.date.slice(5),
  }));

  const topSearchList = (data.topSearches || []).map((s) => ({ label: s.query, count: s.cnt }));
  const topPageList = (data.topPages || []).map((p) => ({ label: p.page, count: p.cnt }));

  return (
    <div className="space-y-6">
      {/* Stat kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Bugun Ziyaretci" value={data.sessions.today}
          hint={`Bu hafta: ${data.sessions.week}`} tone="azure"
          icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
        <StatTile
          label="Aylik Ziyaretci" value={data.sessions.month}
          tone="violet"
          icon="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
        />
        <StatTile
          label="Bugun Arama" value={data.searchesToday}
          hint={`Event: ${data.events.today}`} tone="mint"
          icon="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
        <StatTile
          label="Ort. Sure" value={data.avgDuration > 0 ? `${durationMin}dk ${durationSec}s` : "—"}
          hint="Son 7 gun" tone="gold"
          icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gunluk trend */}
        <Card title="Gunluk Ziyaretci" actions={<span className="text-[10px] text-gray-600">Son 7 gun</span>}>
          <BarChart data={chartData} barColor={TONES.azure.bar} emptyText="Henuz ziyaretci verisi yok." />
        </Card>

        {/* En cok aranan */}
        <Card title="En Cok Aranan Profiller" actions={<span className="text-[10px] text-gray-600">Son 7 gun</span>}>
          <RankList items={topSearchList.slice(0, 8)} barColor={TONES.mint.bar} emptyText="Henuz arama verisi yok." />
        </Card>
      </div>

      {/* En cok ziyaret edilen sayfalar */}
      <Card title="En Cok Ziyaret Edilen Sayfalar" actions={<span className="text-[10px] text-gray-600">Son 7 gun</span>}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
          <RankList items={topPageList.slice(0, 5)} barColor={TONES.violet.bar} emptyText="Henuz sayfa verisi yok." />
          <RankList items={topPageList.slice(5, 10)} barColor={TONES.violet.bar} emptyText="" />
        </div>
      </Card>
    </div>
  );
}
