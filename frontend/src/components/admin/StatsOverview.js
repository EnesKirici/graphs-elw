"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";

function StatCard({ label, value, sub, icon, color }) {
  const gradients = {
    blue:    "from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20",
    emerald: "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20",
    purple:  "from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20",
    yellow:  "from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20",
  };
  const iconBg = {
    blue: "bg-blue-500/15 text-blue-400",
    emerald: "bg-emerald-500/15 text-emerald-400",
    purple: "bg-purple-500/15 text-purple-400",
    yellow: "bg-amber-500/15 text-amber-400",
  };

  return (
    <div className={`bg-gradient-to-br ${gradients[color]} border rounded-2xl p-5 relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-gray-500 mt-1.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${iconBg[color]} flex items-center justify-center`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, label, color = "bg-blue-500", emptyText = "Veri yok." }) {
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
              className={`w-full rounded-t-md ${color} transition-all duration-300 group-hover:opacity-80`}
              style={{ height: `${Math.max(h, 6)}%` }}
            />
            <span className="text-[9px] text-gray-600">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankList({ items, color = "bg-blue-500", emptyText = "Veri yok." }) {
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
                className={`h-full rounded-full ${color} transition-all duration-500`}
                style={{ width: `${(item.count / max) * 100}%` }}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="glass rounded-2xl p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="text-sm text-gray-400">Dashboard verileri yuklenemedi.</p>
        <p className="text-xs text-gray-600 mt-1">Backend baglantisini kontrol edin.</p>
      </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Bugun Ziyaretci" value={data.sessions.today}
          sub={`Bu hafta: ${data.sessions.week}`} color="blue"
          icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
        <StatCard
          label="Aylik Ziyaretci" value={data.sessions.month}
          color="purple"
          icon="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
        />
        <StatCard
          label="Bugun Arama" value={data.searchesToday}
          sub={`Event: ${data.events.today}`} color="emerald"
          icon="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
        <StatCard
          label="Ort. Sure" value={data.avgDuration > 0 ? `${durationMin}dk ${durationSec}s` : "—"}
          sub="Son 7 gun" color="yellow"
          icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gunluk trend */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-200">Gunluk Ziyaretci</h3>
            <span className="text-[10px] text-gray-600">Son 7 gun</span>
          </div>
          <BarChart data={chartData} color="bg-blue-500/70" emptyText="Henuz ziyaretci verisi yok." />
        </div>

        {/* En cok aranan */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-200">En Cok Aranan Profiller</h3>
            <span className="text-[10px] text-gray-600">Son 7 gun</span>
          </div>
          <RankList items={topSearchList.slice(0, 8)} color="bg-emerald-500/70" emptyText="Henuz arama verisi yok." />
        </div>
      </div>

      {/* En cok ziyaret edilen sayfalar */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-200">En Cok Ziyaret Edilen Sayfalar</h3>
          <span className="text-[10px] text-gray-600">Son 7 gun</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
          <RankList items={topPageList.slice(0, 5)} color="bg-purple-500/70" emptyText="Henuz sayfa verisi yok." />
          <RankList items={topPageList.slice(5, 10)} color="bg-purple-500/70" emptyText="" />
        </div>
      </div>
    </div>
  );
}
