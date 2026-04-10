"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";

function StatCard({ label, value, sub, color = "blue" }) {
  const colors = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    yellow: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20",
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, color = "bg-blue-500" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-[#1b2230] overflow-hidden flex-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[#0d1117] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-gray-500">Veri yüklenemedi.</p>;
  }

  const maxSearch = data.topSearches?.length > 0 ? data.topSearches[0].cnt : 1;
  const maxPage = data.topPages?.length > 0 ? data.topPages[0].cnt : 1;

  return (
    <div className="space-y-6">
      {/* Stat kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bugün Ziyaretçi" value={data.sessions.today} sub={`Bu hafta: ${data.sessions.week}`} color="blue" />
        <StatCard label="Aylık Ziyaretçi" value={data.sessions.month} color="purple" />
        <StatCard label="Bugün Arama" value={data.searchesToday} sub={`Event: ${data.events.today}`} color="emerald" />
        <StatCard label="Ort. Süre" value={data.avgDuration > 0 ? `${Math.floor(data.avgDuration / 60)}dk ${data.avgDuration % 60}s` : "—"} sub="Son 7 gün" color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Günlük ziyaretçi trendi */}
        {data.dailyTrend?.length > 0 && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">Günlük Ziyaretçi (7 gün)</h3>
            <div className="flex items-end gap-2 h-32">
              {data.dailyTrend.map((d) => {
                const maxSessions = Math.max(...data.dailyTrend.map((x) => x.sessions));
                const h = maxSessions > 0 ? (d.sessions / maxSessions) * 100 : 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 font-mono">{d.sessions}</span>
                    <div className="w-full rounded-t bg-blue-500/60 transition-all" style={{ height: `${Math.max(h, 4)}%` }} />
                    <span className="text-[9px] text-gray-600">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* En çok aranan profiller */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">En Çok Aranan (7 gün)</h3>
          <div className="space-y-2.5">
            {data.topSearches?.length > 0 ? (
              data.topSearches.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-500 w-4 text-right">{i + 1}</span>
                  <span className="text-sm text-gray-300 flex-1 truncate">{s.query}</span>
                  <MiniBar value={s.cnt} max={maxSearch} color="bg-emerald-500" />
                  <span className="text-xs text-gray-400 font-mono w-8 text-right">{s.cnt}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600">Henüz arama verisi yok.</p>
            )}
          </div>
        </div>
      </div>

      {/* En çok ziyaret edilen sayfalar */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">En Çok Ziyaret Edilen Sayfalar (7 gün)</h3>
        <div className="space-y-2.5">
          {data.topPages?.length > 0 ? (
            data.topPages.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500 w-4 text-right">{i + 1}</span>
                <span className="text-sm text-gray-300 flex-1 truncate font-mono">{p.page}</span>
                <MiniBar value={p.cnt} max={maxPage} color="bg-purple-500" />
                <span className="text-xs text-gray-400 font-mono w-8 text-right">{p.cnt}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-600">Henüz sayfa ziyaret verisi yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
